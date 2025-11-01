import { join } from 'node:path';
import { z } from 'zod';
import { getConfigPaths, loadPluginsConfig } from '../config/loader';
import { fileExists } from '../helpers/fs';
import { resolveMarketplacePath } from '../helpers/git';
import { defaultIO } from '../helpers/io';
import { getPluginSourcePath, isPluginInManifest, loadMarketplaceManifest } from '../helpers/marketplace';
import { validatePluginStructure } from '../helpers/plugin';
import { formatSyncResult, syncPluginToCursor } from '../helpers/sync-strategy';

const PluginUpdateOptionsSchema = z.object({
  pluginId: z.string().min(1),
  cwd: z.string().optional(),
  dryRun: z.boolean().optional(),
});

export async function pluginUpdate(options: unknown): Promise<void> {
  const cmd = PluginUpdateOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();
  const paths = getConfigPaths(cwd);

  try {
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

    const [pluginName, marketplaceName] = cmd.pluginId.split('@');

    if (!pluginName || !marketplaceName) {
      const error = new Error(`Invalid plugin ID format: ${cmd.pluginId} (expected: plugin@marketplace)`);
      defaultIO.logError(error.message);
      throw error;
    }

    const marketplace = config.marketplaces[marketplaceName];

    if (!marketplace) {
      const error = new Error(`Marketplace '${marketplaceName}' not found`);
      defaultIO.logError(error.message);
      throw error;
    }

    const marketplacePath = await resolveMarketplacePath(marketplaceName, marketplace, cwd, {
      dryRun: cmd.dryRun,
    });

    if (!marketplacePath) {
      const error = new Error(`Marketplace '${marketplaceName}' has no path/url configured`);
      defaultIO.logError(error.message);
      throw error;
    }

    const manifest = !cmd.dryRun ? await loadMarketplaceManifest(marketplacePath) : null;

    if (!isPluginInManifest(pluginName, manifest)) {
      const error = new Error(`Plugin '${pluginName}' not found in marketplace '${marketplaceName}'`);
      defaultIO.logError(error.message);
      throw error;
    }

    const pluginPath = getPluginSourcePath(marketplacePath, pluginName, manifest);

    if (!cmd.dryRun && !(await fileExists(pluginPath))) {
      const error = new Error(`Plugin '${pluginName}' not found in marketplace '${marketplaceName}'`);
      defaultIO.logError(error.message);
      throw error;
    }

    if (!cmd.dryRun) {
      try {
        await validatePluginStructure(pluginPath);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const validationError = new Error(`Invalid plugin '${pluginName}': ${message}`);
        defaultIO.logError(validationError.message);
        throw validationError;
      }
    }

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would update ${cmd.pluginId} from marketplace`);
      return;
    }

    const cursorDir = join(cwd, '.cursor');
    const syncResult = await syncPluginToCursor(pluginPath, marketplaceName, pluginName, cursorDir);
    const summary = formatSyncResult(syncResult);

    defaultIO.logSuccess(`Updated ${cmd.pluginId}`);
    console.log(`\n✨ Plugin '${cmd.pluginId}' updated successfully! (${summary})\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to update plugin: ${message}`);
    throw error;
  }
}
