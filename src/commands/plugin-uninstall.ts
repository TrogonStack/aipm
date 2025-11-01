import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getConfigPaths, loadPluginsConfig } from '../config/loader';
import { fileExists, writeJsonFile } from '../helpers/fs';
import { defaultIO } from '../helpers/io';
import { PluginsConfigSchema } from '../schema';

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
  const paths = getConfigPaths(cwd);

  try {
    const targetPath = cmd.local ? paths.pluginsLocal : paths.plugins;
    const configName = cmd.local ? '.cursor/plugins.local.json' : '.cursor/plugins.json';

    if (!(await fileExists(paths.plugins))) {
      const error = new Error("No plugins.json found. Run 'aipm init' first.");
      defaultIO.logError(error.message);
      throw error;
    }

    const config = await loadPluginsConfig(cwd);
    if (!config) {
      const error = new Error('Failed to load config');
      defaultIO.logError(error.message);
      throw error;
    }

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
        defaultIO.logInfo(`[DRY RUN] Would delete files from .cursor/marketplace/`);
      }
    } else {
      await writeJsonFile(targetPath, updatedConfig, PluginsConfigSchema);
      defaultIO.logSuccess(`Removed plugin '${cmd.pluginId}' from ${configName}`);

      if (cmd.removeFiles) {
        const [pluginName, marketplaceName] = cmd.pluginId.split('@');

        if (pluginName && marketplaceName) {
          const installedPath = join(cwd, '.cursor', 'marketplace', marketplaceName, pluginName);

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
