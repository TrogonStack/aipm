import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getNotInitializedMessage, loadPluginsConfig } from '../config/loader';
import { DIR_AIPM_NAMESPACE, DIR_HOOKS, DIR_MARKETPLACE, INTEGRATION_INCLUDE_ALL, PLUGIN_SUBDIRS } from '../constants';
import { getErrorMessage } from '../errors';
import { ensureDir, fileExists } from '../helpers/fs';
import { resolveMarketplacePath } from '../helpers/git';
import { mergeHooks } from '../helpers/hooks-merger';
import { defaultIO } from '../helpers/io';
import {
  getMarketplaceType,
  getPluginSourcePath,
  isPluginInManifest,
  loadMarketplaceManifest,
} from '../helpers/marketplace';
import { tryParsePluginId } from '../helpers/plugin';
import { formatSyncResult, syncPluginToCursor } from '../helpers/sync-strategy';
import type { CursorHooksConfig, IntegrationConfigSchema } from '../schema';

const SyncOptionsSchema = z.object({
  cwd: z.string().optional(),
  dryRun: z.boolean().optional(),
});

type SyncOptions = z.infer<typeof SyncOptionsSchema>;

function isSubdirEnabled(
  subdir: string,
  includeConfig: Exclude<
    z.infer<typeof IntegrationConfigSchema>['include'],
    typeof INTEGRATION_INCLUDE_ALL | undefined
  >,
): boolean {
  const flag = includeConfig[subdir as keyof typeof includeConfig];
  return flag !== false;
}

function getEnabledSubdirs(includeConfig: z.infer<typeof IntegrationConfigSchema>['include']): readonly string[] {
  if (!includeConfig || includeConfig === INTEGRATION_INCLUDE_ALL) {
    return PLUGIN_SUBDIRS;
  }

  return PLUGIN_SUBDIRS.filter((subdir) => isSubdirEnabled(subdir, includeConfig));
}

export async function sync(options: SyncOptions = {}): Promise<void> {
  const cmd = SyncOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { config, sources } = await loadPluginsConfig(cwd);

    if (!sources.project && !sources.local) {
      defaultIO.logError(getNotInitializedMessage());
      return;
    }

    const cursorIntegration = config.integrations?.cursor;
    const isEnabled = cursorIntegration?.enabled !== false;

    if (!isEnabled) {
      defaultIO.logInfo('Cursor integration is disabled in config');
      return;
    }

    const targetDir = join(cwd, '.cursor');

    const enabledPlugins = Object.entries(config.plugins)
      .filter(([_, plugin]) => plugin.enabled)
      .map(([id, _]) => id);

    // Collect hooks early to enable cleanup even if no plugins are enabled
    const collectedPluginHooks: CursorHooksConfig[] = [];

    if (enabledPlugins.length === 0) {
      defaultIO.logInfo('No enabled plugins found');
      // Clean up hooks from disabled/uninstalled plugins
      if (!cmd.dryRun) {
        await mergeHooks(targetDir, collectedPluginHooks);
      }
      return;
    }

    console.log(`\n🔄 Syncing ${enabledPlugins.length} enabled plugin(s)...\n`);

    const targetSubdirs = getEnabledSubdirs(cursorIntegration?.include);

    if (!cmd.dryRun) {
      // Clean up old marketplace directory if it exists
      const oldMarketplaceDir = join(targetDir, DIR_MARKETPLACE);
      if (await fileExists(oldMarketplaceDir)) {
        await rm(oldMarketplaceDir, { recursive: true, force: true });
      }

      // Clear and recreate aipm subdirectories to remove disabled plugins
      // Only clears .cursor/<subdir>/aipm/, preserving user's own files
      for (const subdir of targetSubdirs) {
        const aipmSubdirPath = join(targetDir, subdir, DIR_AIPM_NAMESPACE);
        if (await fileExists(aipmSubdirPath)) {
          await rm(aipmSubdirPath, { recursive: true, force: true });
        }
        await ensureDir(aipmSubdirPath);
      }
    }

    let installedCount = 0;
    let skippedCount = 0;

    for (const pluginId of enabledPlugins) {
      const parsed = tryParsePluginId(pluginId);
      if (!parsed) {
        defaultIO.logError(`Invalid plugin ID format: ${pluginId} (expected: plugin@marketplace)`);
        skippedCount++;
        continue;
      }

      const { pluginName, marketplaceName } = parsed;

      const marketplace = config.marketplaces[marketplaceName];

      if (!marketplace) {
        defaultIO.logError(`Marketplace '${marketplaceName}' not found for plugin ${pluginId}`);
        skippedCount++;
        continue;
      }

      const marketplacePath = await resolveMarketplacePath(marketplaceName, marketplace, cwd, {
        dryRun: cmd.dryRun,
      });

      if (!marketplacePath) {
        defaultIO.logError(`Marketplace '${marketplaceName}' has no path/url configured`);
        skippedCount++;
        continue;
      }

      if (!cmd.dryRun && !(await fileExists(marketplacePath))) {
        defaultIO.logError(`Marketplace path does not exist: ${marketplacePath}`);
        skippedCount++;
        continue;
      }

      const manifest = !cmd.dryRun
        ? await loadMarketplaceManifest(marketplacePath, getMarketplaceType(marketplaceName))
        : null;

      if (!isPluginInManifest(pluginName, manifest)) {
        defaultIO.logError(`Plugin '${pluginName}' not found in marketplace.json for '${marketplaceName}'`);
        skippedCount++;
        continue;
      }

      const pluginPath = getPluginSourcePath(marketplacePath, pluginName, manifest);

      if (!cmd.dryRun) {
        if (!(await fileExists(pluginPath))) {
          defaultIO.logError(`Plugin not found in marketplace: ${pluginPath}`);
          skippedCount++;
          continue;
        }

        const pluginStats = await stat(pluginPath);
        if (!pluginStats.isDirectory()) {
          defaultIO.logError(`Plugin path is not a directory: ${pluginPath}`);
          skippedCount++;
          continue;
        }
      }

      if (cmd.dryRun) {
        defaultIO.logInfo(`[DRY RUN] Would sync ${pluginId} to .cursor/`);
      } else {
        const syncResult = await syncPluginToCursor(pluginPath, marketplaceName, pluginName, targetDir);

        const includeConfig = cursorIntegration?.include;

        // Collect translated hooks if hooks subdirectory is enabled
        if (syncResult.translatedHooks) {
          const hooksEnabled =
            !includeConfig || includeConfig === INTEGRATION_INCLUDE_ALL || isSubdirEnabled(DIR_HOOKS, includeConfig);
          if (hooksEnabled) {
            collectedPluginHooks.push(syncResult.translatedHooks);
          }
        }

        if (includeConfig && includeConfig !== INTEGRATION_INCLUDE_ALL) {
          const disabledSubdirs = PLUGIN_SUBDIRS.filter((subdir) => !isSubdirEnabled(subdir, includeConfig));

          for (const subdir of disabledSubdirs) {
            const subdirPath = join(targetDir, subdir, DIR_AIPM_NAMESPACE, marketplaceName, pluginName);
            if (await fileExists(subdirPath)) {
              await rm(subdirPath, { recursive: true, force: true });
            }
          }
        }

        const summary = formatSyncResult(syncResult);
        defaultIO.logSuccess(`Synced ${pluginId} (${summary})`);
      }

      installedCount++;
    }

    // Merge hooks (even with empty array) to clean up hooks from disabled/uninstalled plugins
    if (!cmd.dryRun) {
      await mergeHooks(targetDir, collectedPluginHooks);
    }

    console.log('');

    if (cmd.dryRun) {
      console.log(`✨ [DRY RUN] Would install ${installedCount} plugin(s)`);
    } else {
      console.log(`✨ Successfully installed ${installedCount} plugin(s)`);
    }

    if (skippedCount > 0) {
      console.log(`⚠️  Skipped ${skippedCount} plugin(s)`);
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    defaultIO.logError(`Failed to sync: ${message}`);
    throw error;
  }
}
