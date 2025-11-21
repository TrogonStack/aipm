import { z } from 'zod';
import { getNotInitializedMessage, loadPluginsConfig } from '../config/loader';
import { resolveMarketplacePath } from '../helpers/git';
import { defaultIO } from '../helpers/io';

const MarketplaceUpdateOptionsSchema = z.object({
  name: z.string().min(1),
  cwd: z.string().optional(),
  dryRun: z.boolean().optional(),
});

export async function marketplaceUpdate(options: unknown): Promise<void> {
  const cmd = MarketplaceUpdateOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { config, sources } = await loadPluginsConfig(cwd);

    if (!sources.project && !sources.local) {
      const error = new Error(getNotInitializedMessage());
      defaultIO.logError(error.message);
      throw error;
    }

    const marketplace = config.marketplaces[cmd.name];

    if (!marketplace) {
      const error = new Error(`Marketplace '${cmd.name}' not found`);
      defaultIO.logError(error.message);
      throw error;
    }

    if (marketplace.source === 'directory') {
      defaultIO.logInfo(`Marketplace '${cmd.name}' is a local directory, no update needed`);
      return;
    }

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would update marketplace '${cmd.name}' from ${marketplace.source} source`);
      return;
    }

    await resolveMarketplacePath(cmd.name, marketplace, cwd, {
      dryRun: cmd.dryRun,
    });

    defaultIO.logSuccess(`Updated marketplace '${cmd.name}'`);
    console.log(`\n✨ Marketplace '${cmd.name}' updated successfully!\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to update marketplace: ${message}`);
    throw error;
  }
}
