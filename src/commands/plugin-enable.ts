import { z } from 'zod';
import { getConfigPaths, loadPluginsConfig } from '../config/loader';
import { fileExists, writeJsonFile } from '../helpers/fs';
import { defaultIO } from '../helpers/io';
import { PluginsConfigSchema } from '../schema';

const PluginEnableOptionsSchema = z.object({
  pluginId: z.string().min(1),
  cwd: z.string().optional(),
  local: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function pluginEnable(options: unknown): Promise<void> {
  const cmd = PluginEnableOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();
  const paths = getConfigPaths(cwd);

  try {
    const targetPath = cmd.local ? paths.pluginsLocal : paths.plugins;
    const configName = cmd.local ? '.cursor/plugins.local.json' : '.cursor/plugins.json';

    if (!(await fileExists(paths.plugins))) {
      defaultIO.logError("No plugins.json found. Run 'aipm init' first.");
      return;
    }

    const config = await loadPluginsConfig(cwd);
    if (!config) {
      defaultIO.logError('Failed to load config');
      return;
    }

    if (!config.plugins[cmd.pluginId]) {
      defaultIO.logInfo(`Plugin '${cmd.pluginId}' not found, adding it as enabled`);

      const updatedConfig = {
        ...config,
        plugins: {
          ...config.plugins,
          [cmd.pluginId]: {
            enabled: true,
          },
        },
      };

      if (cmd.dryRun) {
        defaultIO.logInfo(`[DRY RUN] Would enable plugin '${cmd.pluginId}' in ${configName}`);
      } else {
        await writeJsonFile(targetPath, updatedConfig, PluginsConfigSchema, cmd.dryRun);
        defaultIO.logSuccess(`Enabled plugin '${cmd.pluginId}' in ${configName}`);
      }
      return;
    }

    const plugin = config.plugins[cmd.pluginId];

    if (plugin?.enabled) {
      defaultIO.logInfo(`Plugin '${cmd.pluginId}' is already enabled`);
      return;
    }

    const updatedConfig = {
      ...config,
      plugins: {
        ...config.plugins,
        [cmd.pluginId]: {
          ...config.plugins[cmd.pluginId],
          enabled: true,
        },
      },
    };

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would enable plugin '${cmd.pluginId}' in ${configName}`);
    } else {
      await writeJsonFile(targetPath, updatedConfig, PluginsConfigSchema, cmd.dryRun);
      defaultIO.logSuccess(`Enabled plugin '${cmd.pluginId}' in ${configName}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to enable plugin: ${message}`);
    throw error;
  }
}
