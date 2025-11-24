import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getConfigPath, getNotInitializedMessage, loadPluginsConfig } from '../config/loader';
import { DIR_AIPM_NAMESPACE, DIR_CURSOR, FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL, PLUGIN_SUBDIRS } from '../constants';
import { loadTargetConfig, saveConfig } from '../helpers/aipm-config';
import { fileExists } from '../helpers/fs';
import { defaultIO } from '../helpers/io';

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
        const [pluginName, marketplaceName] = cmd.pluginId.split('@');

        if (pluginName && marketplaceName) {
          let deletedCount = 0;

          for (const subdir of PLUGIN_SUBDIRS) {
            const installedPath = join(cwd, DIR_CURSOR, subdir, DIR_AIPM_NAMESPACE, marketplaceName, pluginName);

            if (await fileExists(installedPath)) {
              await rm(installedPath, { recursive: true, force: true });
              deletedCount++;
            }
          }

          if (deletedCount > 0) {
            defaultIO.logSuccess(`Deleted plugin files from ${deletedCount} location(s) in .cursor/`);
          }
        }
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to uninstall plugin: ${message}`);
    throw error;
  }
}
