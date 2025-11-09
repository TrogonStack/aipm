import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getConfigPaths, loadPluginsConfig } from '../config/loader';
import { DIR_CURSOR, DIR_MARKETPLACE } from '../constants';
import { ensureDir, fileExists } from '../helpers/fs';
import { resolveMarketplacePath } from '../helpers/git';
import { defaultIO } from '../helpers/io';
import { getPluginSourcePath, isPluginInManifest, loadMarketplaceManifest } from '../helpers/marketplace';
import { formatSyncResult, syncPluginToCursor } from '../helpers/sync-strategy';

const SyncOptionsSchema = z.object({
  cwd: z.string().optional(),
  dryRun: z.boolean().optional(),
});

type SyncOptions = z.infer<typeof SyncOptionsSchema>;

export async function sync(options: SyncOptions = {}): Promise<void> {
  const cmd = SyncOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();
  const paths = getConfigPaths(cwd);
  const cursorDir = join(cwd, DIR_CURSOR);

  try {
    if (!(await fileExists(paths.plugins))) {
      defaultIO.logError("No plugins.json found. Run 'aipm init' first.");
      return;
    }

    const config = await loadPluginsConfig(cwd);
    if (!config) {
      defaultIO.logError('Failed to load config');
      return;
    }

    const enabledPlugins = Object.entries(config.plugins)
      .filter(([_, plugin]) => plugin.enabled)
      .map(([id, _]) => id);

    if (enabledPlugins.length === 0) {
      defaultIO.logInfo('No enabled plugins found');
      return;
    }

    console.log(`\n🔄 Syncing ${enabledPlugins.length} enabled plugin(s)...\n`);

    if (!cmd.dryRun) {
      // Clean up old marketplace directory if it exists
      const oldMarketplaceDir = join(cursorDir, DIR_MARKETPLACE);
      if (await fileExists(oldMarketplaceDir)) {
        await rm(oldMarketplaceDir, { recursive: true, force: true });
      }

      // Clear and recreate cursor directories to remove disabled plugins
      const cursorSubdirs = ['commands', 'rules', 'agents', 'skills', 'hooks'];
      for (const subdir of cursorSubdirs) {
        const subdirPath = join(cursorDir, subdir);
        if (await fileExists(subdirPath)) {
          await rm(subdirPath, { recursive: true, force: true });
        }
        await ensureDir(subdirPath);
      }
    }

    let installedCount = 0;
    let skippedCount = 0;

    for (const pluginId of enabledPlugins) {
      const [pluginName, marketplaceName] = pluginId.split('@');

      if (!pluginName || !marketplaceName) {
        defaultIO.logError(`Invalid plugin ID format: ${pluginId} (expected: plugin@marketplace)`);
        skippedCount++;
        continue;
      }

      const marketplace = config.marketplaces[marketplaceName];

      if (!marketplace) {
        defaultIO.logError(`Marketplace '${marketplaceName}' not found for plugin ${pluginId}`);
        skippedCount++;
        continue;
      }

      const marketplacePath = await resolveMarketplacePath(marketplaceName, marketplace, cwd, {
        dryRun: cmd.dryRun,
      });

      if (!marketplacePath) {
        defaultIO.logError(`Marketplace '${marketplaceName}' has no path/url configured`);
        skippedCount++;
        continue;
      }

      if (!cmd.dryRun && !(await fileExists(marketplacePath))) {
        defaultIO.logError(`Marketplace path does not exist: ${marketplacePath}`);
        skippedCount++;
        continue;
      }

      const manifest = !cmd.dryRun ? await loadMarketplaceManifest(marketplacePath) : null;

      if (!isPluginInManifest(pluginName, manifest)) {
        defaultIO.logError(`Plugin '${pluginName}' not found in marketplace.json for '${marketplaceName}'`);
        skippedCount++;
        continue;
      }

      const pluginPath = getPluginSourcePath(marketplacePath, pluginName, manifest);

      if (!cmd.dryRun) {
        if (!(await fileExists(pluginPath))) {
          defaultIO.logError(`Plugin not found in marketplace: ${pluginPath}`);
          skippedCount++;
          continue;
        }

        const pluginStats = await stat(pluginPath);
        if (!pluginStats.isDirectory()) {
          defaultIO.logError(`Plugin path is not a directory: ${pluginPath}`);
          skippedCount++;
          continue;
        }
      }

      if (cmd.dryRun) {
        defaultIO.logInfo(`[DRY RUN] Would sync ${pluginId} to .cursor/`);
      } else {
        const syncResult = await syncPluginToCursor(pluginPath, marketplaceName, pluginName, cursorDir);
        const summary = formatSyncResult(syncResult);
        defaultIO.logSuccess(`Synced ${pluginId} (${summary})`);
      }

      installedCount++;
    }

    console.log('');

    if (cmd.dryRun) {
      console.log(`✨ [DRY RUN] Would install ${installedCount} plugin(s)`);
    } else {
      console.log(`✨ Successfully installed ${installedCount} plugin(s)`);
    }

    if (skippedCount > 0) {
      console.log(`⚠️  Skipped ${skippedCount} plugin(s)`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to sync: ${message}`);
    throw error;
  }
}
