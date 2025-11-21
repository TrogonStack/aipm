import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getConfigPath, getNotInitializedMessage, loadPluginsConfig } from '../config/loader';
import { DIR_CURSOR, DIR_MARKETPLACE, FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL } from '../constants';
import { saveConfig } from '../helpers/aipm-config';
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

    if (!config.plugins[cmd.pluginId]) {
      const error = new Error(`Plugin '${cmd.pluginId}' is not installed`);
      defaultIO.logError(error.message);
      throw error;
    }

    const { [cmd.pluginId]: _removed, ...remainingPlugins } = config.plugins;

    const updatedConfig = {
      ...config,
      plugins: remainingPlugins,
    };

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would remove plugin '${cmd.pluginId}' from ${configName}`);
      if (cmd.removeFiles) {
        defaultIO.logInfo('[DRY RUN] Would delete files from .cursor/marketplace/');
      }
    } else {
      await saveConfig(cwd, updatedConfig, cmd.local);
      defaultIO.logSuccess(`Removed plugin '${cmd.pluginId}' from ${configName}`);

      if (cmd.removeFiles) {
        const [pluginName, marketplaceName] = cmd.pluginId.split('@');

        if (pluginName && marketplaceName) {
          const installedPath = join(cwd, DIR_CURSOR, DIR_MARKETPLACE, marketplaceName, pluginName);

          if (await fileExists(installedPath)) {
            await rm(installedPath, { recursive: true, force: true });
            defaultIO.logSuccess(`Deleted plugin files from .cursor/marketplace/${marketplaceName}/${pluginName}`);
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
