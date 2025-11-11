import { z } from 'zod';
import { getConfigPaths, loadPluginsConfig } from '../config/loader';
import { fileExists, writeJsonFile } from '../helpers/fs';
import { defaultIO } from '../helpers/io';
import { PluginsConfigSchema } from '../schema';

const PluginDisableOptionsSchema = z.object({
  pluginId: z.string().min(1),
  cwd: z.string().optional(),
  local: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function pluginDisable(options: unknown): Promise<void> {
  const cmd = PluginDisableOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();
  const paths = getConfigPaths(cwd);

  try {
    const targetPath = cmd.local ? paths.pluginsLocal : paths.plugins;
    const configName = cmd.local ? '.cursor/plugins.local.json' : '.cursor/plugins.json';

    if (!(await fileExists(paths.plugins))) {
      defaultIO.logError("No plugins.json found. Run 'aipm init' first.");
      return;
    }

    const { config } = await loadPluginsConfig(cwd);

    const plugin = config.plugins[cmd.pluginId];

    if (!plugin) {
      defaultIO.logError(`Plugin '${cmd.pluginId}' not found`);
      return;
    }

    if (!plugin.enabled) {
      defaultIO.logInfo(`Plugin '${cmd.pluginId}' is already disabled`);
      return;
    }

    const updatedConfig = {
      ...config,
      plugins: {
        ...config.plugins,
        [cmd.pluginId]: {
          ...config.plugins[cmd.pluginId],
          enabled: false,
        },
      },
    };

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would disable plugin '${cmd.pluginId}' in ${configName}`);
    } else {
      await writeJsonFile(targetPath, updatedConfig, PluginsConfigSchema, cmd.dryRun);
      defaultIO.logSuccess(`Disabled plugin '${cmd.pluginId}' in ${configName}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to disable plugin: ${message}`);
    throw error;
  }
}
