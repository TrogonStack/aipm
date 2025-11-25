import { z } from 'zod';
import { getConfigPath, getNotInitializedMessage, loadPluginsConfig } from '../config/loader';
import { FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL } from '../constants';
import { getErrorMessage } from '../errors';
import { loadTargetConfig, saveConfig } from '../helpers/aipm-config';
import { defaultIO } from '../helpers/io';

const MarketplaceRemoveOptionsSchema = z.object({
  name: z.string().min(1),
  cwd: z.string().optional(),
  local: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function marketplaceRemove(options: unknown): Promise<void> {
  const cmd = MarketplaceRemoveOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    // Load merged config to check existence across all sources
    const { config: mergedConfig, sources } = await loadPluginsConfig(cwd);

    if (!sources.project && !sources.local) {
      defaultIO.logError(getNotInitializedMessage());
      return;
    }

    if (!mergedConfig.marketplaces[cmd.name]) {
      defaultIO.logError(`Marketplace '${cmd.name}' not found`);
      return;
    }

    // Load only the target config file for modification
    const targetConfig = await loadTargetConfig(cwd, cmd.local);
    const configName = cmd.local ? getConfigPath(FILE_AIPM_CONFIG_LOCAL) : getConfigPath(FILE_AIPM_CONFIG);

    // Check if it exists in the target config
    if (!targetConfig.marketplaces[cmd.name]) {
      defaultIO.logError(`Marketplace '${cmd.name}' not found in ${configName}`);
      return;
    }

    const { [cmd.name]: _removed, ...remainingMarketplaces } = targetConfig.marketplaces;

    const updatedConfig = {
      ...targetConfig,
      marketplaces: remainingMarketplaces,
    };

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would remove marketplace '${cmd.name}' from ${configName}`);
    } else {
      await saveConfig(cwd, updatedConfig, cmd.local);
      defaultIO.logSuccess(`Removed marketplace '${cmd.name}' from ${configName}`);
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    defaultIO.logError(`Failed to remove marketplace: ${message}`);
    throw error;
  }
}
