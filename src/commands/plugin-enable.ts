import merge from 'lodash.merge';
import { z } from 'zod';
import { getConfigPath, getNotInitializedMessage, loadPluginsConfig } from '../config/loader';
import { FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL } from '../constants';
import { getErrorMessage } from '../errors';
import { loadTargetConfig, saveConfig } from '../helpers/aipm-config';
import { defaultIO } from '../helpers/io';

const PluginEnableOptionsSchema = z.object({
  pluginId: z.string().min(1),
  cwd: z.string().optional(),
  local: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function pluginEnable(options: unknown): Promise<void> {
  const cmd = PluginEnableOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { config, sources } = await loadPluginsConfig(cwd);

    if (!sources.project && !sources.local) {
      defaultIO.logError(getNotInitializedMessage());
      return;
    }
    const configName = cmd.local ? getConfigPath(FILE_AIPM_CONFIG_LOCAL) : getConfigPath(FILE_AIPM_CONFIG);

    if (!config.plugins[cmd.pluginId]) {
      defaultIO.logInfo(`Plugin '${cmd.pluginId}' not found, adding it as enabled`);
    }

    const plugin = config.plugins[cmd.pluginId];

    if (plugin?.enabled) {
      defaultIO.logInfo(`Plugin '${cmd.pluginId}' is already enabled`);
      return;
    }

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would enable plugin '${cmd.pluginId}' in ${configName}`);
      return;
    }

    const targetConfig = await loadTargetConfig(cwd, cmd.local);
    const updatedConfig = merge({}, targetConfig, {
      plugins: { [cmd.pluginId]: { enabled: true } },
    });

    await saveConfig(cwd, updatedConfig, cmd.local);
    defaultIO.logSuccess(`Enabled plugin '${cmd.pluginId}' in ${configName}`);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    defaultIO.logError(`Failed to enable plugin: ${message}`);
    throw error;
  }
}
