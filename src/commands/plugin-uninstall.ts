import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getConfigPath, getNotInitializedMessage, loadPluginsConfig } from '../config/loader';
import {
  AIPM_HOOK_PREFIX,
  DIR_AIPM_NAMESPACE,
  DIR_CURSOR,
  DIR_SKILLS,
  FILE_AIPM_CONFIG,
  FILE_AIPM_CONFIG_LOCAL,
  FILE_HOOKS_JSON,
  HOOK_ID_FIELD,
  PLUGIN_SUBDIRS,
} from '../constants';
import { getErrorMessage, isFileNotFoundError } from '../errors';
import { loadTargetConfig, saveConfig } from '../helpers/aipm-config';
import { writeJsonFile } from '../helpers/fs';
import { resolveMarketplacePath } from '../helpers/git';
import { readExistingHooks } from '../helpers/hooks-merger';
import { defaultIO } from '../helpers/io';
import {
  getMarketplaceType,
  getPluginSourcePath,
  hasPluginName,
  loadMarketplaceManifest,
} from '../helpers/marketplace';
import { isMetaPlugin, tryParsePluginId } from '../helpers/plugin';
import type { CursorHooksConfig } from '../schema';
import { AipmManagedHookSchema, UserHookSchema } from '../schema';

const PluginUninstallOptionsSchema = z.object({
  pluginId: z.string().min(1),
  cwd: z.string().optional(),
  local: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  removeFiles: z.boolean().optional(),
});

export async function pluginUninstall(options: unknown): Promise<void> {
  const cmd = PluginUninstallOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { config, sources } = await loadPluginsConfig(cwd);

    if (!sources.project && !sources.local) {
      const error = new Error(getNotInitializedMessage());
      defaultIO.logError(error.message);
      throw error;
    }
    const configName = cmd.local ? getConfigPath(FILE_AIPM_CONFIG_LOCAL) : getConfigPath(FILE_AIPM_CONFIG);
    const targetConfig = await loadTargetConfig(cwd, cmd.local);

    if (!targetConfig.plugins[cmd.pluginId]) {
      if (config.plugins[cmd.pluginId]) {
        const error = new Error(
          `Plugin '${cmd.pluginId}' is not in ${configName} (exists in merged config from another source)`,
        );
        defaultIO.logError(error.message);
        throw error;
      }
      const error = new Error(`Plugin '${cmd.pluginId}' is not installed`);
      defaultIO.logError(error.message);
      throw error;
    }

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would remove plugin '${cmd.pluginId}' from ${configName}`);
      if (cmd.removeFiles) {
        defaultIO.logInfo('[DRY RUN] Would delete plugin files from .cursor/');
      }
    } else {
      const { [cmd.pluginId]: _removed, ...remainingPlugins } = targetConfig.plugins;

      const updatedConfig = {
        ...targetConfig,
        plugins: remainingPlugins,
      };

      await saveConfig(cwd, updatedConfig, cmd.local);
      defaultIO.logSuccess(`Removed plugin '${cmd.pluginId}' from ${configName}`);

      if (cmd.removeFiles) {
        const parsed = tryParsePluginId(cmd.pluginId);
        if (!parsed) {
          defaultIO.logError(
            `Cannot delete files: Invalid plugin ID format: ${cmd.pluginId} (expected: plugin@marketplace)`,
          );
          return;
        }

        const { pluginName, marketplaceName } = parsed;
        let deletedCount = 0;

        const marketplaceConfig = config.marketplaces[marketplaceName];
        const isClaudeCodeMarketplace = getMarketplaceType(marketplaceName) === 'claude';

        if (marketplaceConfig) {
          const marketplacePath = await resolveMarketplacePath(marketplaceName, marketplaceConfig, cwd);
          if (!marketplacePath) {
            throw new Error(`Could not resolve marketplace path for '${marketplaceName}'`);
          }
          const manifest = await loadMarketplaceManifest(marketplacePath, getMarketplaceType(marketplaceName));
          const pluginPath = getPluginSourcePath(marketplacePath, pluginName, manifest);

          const isMetaPluginCheck = isMetaPlugin(marketplacePath, pluginPath, manifest);

          if (isMetaPluginCheck && manifest) {
            const pluginEntry = manifest.plugins.find(hasPluginName(pluginName));
            if (pluginEntry?.skills) {
              for (const skillPath of pluginEntry.skills) {
                const normalizedSkillPath = skillPath.replace(/^\.\//, '');
                const marketplaceSegments = marketplaceName.split('/');
                const installedPath = join(
                  cwd,
                  DIR_CURSOR,
                  DIR_SKILLS,
                  DIR_AIPM_NAMESPACE,
                  ...marketplaceSegments,
                  normalizedSkillPath,
                );

                try {
                  await rm(installedPath, { recursive: true });
                  deletedCount++;
                } catch (error) {
                  // Ignore if path doesn't exist - that's fine
                  if (!isFileNotFoundError(error)) {
                    throw error;
                  }
                }
              }
            }
          } else {
            for (const subdir of PLUGIN_SUBDIRS) {
              const installedPath = join(cwd, DIR_CURSOR, subdir, DIR_AIPM_NAMESPACE, marketplaceName, pluginName);

              try {
                await rm(installedPath, { recursive: true });
                deletedCount++;
              } catch (error) {
                // Ignore if path doesn't exist - that's fine
                if (!isFileNotFoundError(error)) {
                  throw error;
                }
              }
            }

            // Remove flattened skill directories for this plugin
            // Pattern: .cursor/skills/aipm-<marketplace>-<plugin>[-subskill]
            // Must avoid prefix collisions when plugin names are prefixes of others
            // (e.g., "my-plugin" shouldn't match "my-plugin-extra")
            const skillsDir = join(cwd, DIR_CURSOR, DIR_SKILLS);
            try {
              const entries = await readdir(skillsDir, { withFileTypes: true });
              const flattenedPrefix = `aipm-${marketplaceName.replace(/\//g, '-')}-${pluginName}`;

              // Check for conflicting plugin names in this marketplace
              const otherPluginsInMarketplace = Object.keys(config.plugins).filter(
                (id) => id.endsWith(`@${marketplaceName}`) && id !== cmd.pluginId,
              );

              const hasConflictingNames = otherPluginsInMarketplace.some((id) => {
                const otherPluginName = id.substring(0, id.lastIndexOf('@'));
                return otherPluginName.startsWith(pluginName) && otherPluginName !== pluginName;
              });

              // When conflicts exist, we need exact skill information to avoid false positives
              // Read the plugin's skills directory to get the exact list
              const skillsToDelete = new Set<string>();

              if (hasConflictingNames && pluginPath) {
                // Load exact skill information from plugin directory
                const skillsSourcePath = join(pluginPath, 'skills');
                try {
                  const skillEntries = await readdir(skillsSourcePath, { withFileTypes: true });
                  for (const skillEntry of skillEntries) {
                    if (skillEntry.isDirectory()) {
                      // Reconstruct the exact flattened name for this skill
                      const flatSkillName = `${flattenedPrefix}-${skillEntry.name}`;
                      skillsToDelete.add(flatSkillName);
                    }
                  }
                } catch {
                  // No skills directory - plugin has no skills
                }
              }

              for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                let shouldDelete = false;

                if (hasConflictingNames) {
                  // With conflicts, only delete skills we explicitly found in the plugin directory
                  shouldDelete = skillsToDelete.has(entry.name);
                } else {
                  // No conflicts - safe to use prefix matching
                  shouldDelete = entry.name === flattenedPrefix || entry.name.startsWith(flattenedPrefix + '-');
                }

                if (shouldDelete) {
                  try {
                    await rm(join(skillsDir, entry.name), { recursive: true });
                    deletedCount++;
                  } catch (error) {
                    if (!isFileNotFoundError(error)) {
                      throw error;
                    }
                  }
                }
              }
            } catch (error) {
              // Ignore errors reading skills directory
              if (!isFileNotFoundError(error)) {
                throw error;
              }
            }
          }
        } else {
          // Marketplace config missing - can still delete AIPM plugins, but not Claude Code meta-plugins
          if (isClaudeCodeMarketplace) {
            defaultIO.logInfo(
              `⚠️  Cannot delete files for Claude Code plugin '${cmd.pluginId}': ` +
                `marketplace '${marketplaceName}' not found in config. ` +
                `Manual cleanup may be required in .cursor/skills/aipm/${marketplaceName}/`,
            );
          } else {
            // AIPM plugins have predictable paths - delete them directly
            for (const subdir of PLUGIN_SUBDIRS) {
              const installedPath = join(cwd, DIR_CURSOR, subdir, DIR_AIPM_NAMESPACE, marketplaceName, pluginName);

              try {
                await rm(installedPath, { recursive: true });
                deletedCount++;
              } catch (error) {
                // Ignore if path doesn't exist - that's fine
                if (!isFileNotFoundError(error)) {
                  throw error;
                }
              }
            }

            // Remove flattened skill directories for this plugin
            // Even when marketplace config is missing, we can clean up flattened skills
            // using prefix matching (safe when no conflicts exist)
            const skillsDir = join(cwd, DIR_CURSOR, DIR_SKILLS);
            try {
              const entries = await readdir(skillsDir, { withFileTypes: true });
              const flattenedPrefix = `aipm-${marketplaceName.replace(/\//g, '-')}-${pluginName}`;

              // Check for conflicting plugin names in this marketplace
              const otherPluginsInMarketplace = Object.keys(config.plugins).filter(
                (id) => id.endsWith(`@${marketplaceName}`) && id !== cmd.pluginId,
              );

              const hasConflictingNames = otherPluginsInMarketplace.some((id) => {
                const otherPluginName = id.substring(0, id.lastIndexOf('@'));
                return otherPluginName.startsWith(pluginName) && otherPluginName !== pluginName;
              });

              for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                let shouldDelete = false;

                if (hasConflictingNames) {
                  // With conflicts and no marketplace config, we can't read actual skills
                  // Be conservative and don't delete anything - admin should manually cleanup
                  shouldDelete = false;
                } else {
                  // No conflicts - safe to use prefix matching
                  shouldDelete = entry.name === flattenedPrefix || entry.name.startsWith(flattenedPrefix + '-');
                }

                if (shouldDelete) {
                  try {
                    await rm(join(skillsDir, entry.name), { recursive: true });
                    deletedCount++;
                  } catch (error) {
                    if (!isFileNotFoundError(error)) {
                      throw error;
                    }
                  }
                }
              }
            } catch (error) {
              // Ignore errors reading skills directory
              if (!isFileNotFoundError(error)) {
                throw error;
              }
            }
          }
        }

        if (deletedCount > 0) {
          defaultIO.logSuccess(`Deleted plugin files from ${deletedCount} location(s) in .cursor/`);
        }

        const cursorDir = join(cwd, DIR_CURSOR);
        const hookIdPrefix = `${AIPM_HOOK_PREFIX}/${marketplaceName}/${pluginName}/`;
        const existingHooks = await readExistingHooks(cursorDir);

        if (existingHooks) {
          const cleanedHooks: CursorHooksConfig = {
            version: 1,
            hooks: {},
          };

          for (const [eventName, hooks] of Object.entries(existingHooks.hooks)) {
            const filteredHooks = hooks.filter((hook) => {
              // safeParse returns success=false for malformed entries (null, primitives, arrays)
              const aipmParseResult = AipmManagedHookSchema.safeParse(hook);

              if (aipmParseResult.success) {
                const aipmHook = aipmParseResult.data;
                return !aipmHook[HOOK_ID_FIELD].startsWith(hookIdPrefix);
              }

              const userParseResult = UserHookSchema.safeParse(hook);
              return userParseResult.success;
            });

            if (filteredHooks.length > 0) {
              cleanedHooks.hooks[eventName] = filteredHooks;
            }
          }

          const hooksPath = join(cursorDir, FILE_HOOKS_JSON);
          await writeJsonFile(hooksPath, cleanedHooks, undefined, cmd.dryRun);
        }
      }
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    defaultIO.logError(`Failed to uninstall plugin: ${message}`);
    throw error;
  }
}
