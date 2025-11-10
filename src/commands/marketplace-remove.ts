import { z } from 'zod';
import { getConfigPaths, loadPluginsConfig } from '../config/loader';
import { fileExists, writeJsonFile } from '../helpers/fs';
import { defaultIO } from '../helpers/io';
import { PluginsConfigSchema } from '../schema';

const MarketplaceRemoveOptionsSchema = z.object({
  name: z.string().min(1),
  cwd: z.string().optional(),
  local: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function marketplaceRemove(options: unknown): Promise<void> {
  const cmd = MarketplaceRemoveOptionsSchema.parse(options);

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

    if (!config.marketplaces[cmd.name]) {
      defaultIO.logError(`Marketplace '${cmd.name}' not found`);
      return;
    }

    const { [cmd.name]: _removed, ...remainingMarketplaces } = config.marketplaces;

    const updatedConfig = {
      ...config,
      marketplaces: remainingMarketplaces,
    };

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would remove marketplace '${cmd.name}' from ${configName}`);
    } else {
      await writeJsonFile(targetPath, updatedConfig, PluginsConfigSchema, cmd.dryRun);
      defaultIO.logSuccess(`Removed marketplace '${cmd.name}' from ${configName}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to remove marketplace: ${message}`);
    throw error;
  }
}
