import merge from 'lodash.merge';
import { z } from 'zod';
import { getConfigPath, getNotInitializedMessage, loadPluginsConfig } from '../config/loader';
import { FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL } from '../constants';
import { getErrorMessage } from '../errors';
import { loadTargetConfig, saveConfig } from '../helpers/aipm-config';
import { defaultIO } from '../helpers/io';

const PluginDisableOptionsSchema = z.object({
  pluginId: z.string().min(1),
  cwd: z.string().optional(),
  local: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function pluginDisable(options: unknown): Promise<void> {
  const cmd = PluginDisableOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { config, sources } = await loadPluginsConfig(cwd);

    if (!sources.project && !sources.local) {
      defaultIO.logError(getNotInitializedMessage());
      return;
    }
    const configName = cmd.local ? getConfigPath(FILE_AIPM_CONFIG_LOCAL) : getConfigPath(FILE_AIPM_CONFIG);

    const plugin = config.plugins[cmd.pluginId];

    if (!plugin) {
      defaultIO.logError(`Plugin '${cmd.pluginId}' not found`);
      return;
    }

    if (!plugin.enabled) {
      defaultIO.logInfo(`Plugin '${cmd.pluginId}' is already disabled`);
      return;
    }

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would disable plugin '${cmd.pluginId}' in ${configName}`);
      return;
    }

    const targetConfig = await loadTargetConfig(cwd, cmd.local);
    const updatedConfig = merge({}, targetConfig, {
      plugins: { [cmd.pluginId]: { enabled: false } },
    });

    await saveConfig(cwd, updatedConfig, cmd.local);
    defaultIO.logSuccess(`Disabled plugin '${cmd.pluginId}' in ${configName}`);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    defaultIO.logError(`Failed to disable plugin: ${message}`);
    throw error;
  }
}
