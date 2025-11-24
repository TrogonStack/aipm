import merge from 'lodash.merge';
import { join } from 'node:path';
import { z } from 'zod';
import { getConfigPath, getNotInitializedMessage, loadPluginsConfig } from '../config/loader';
import { DIR_CURSOR, FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL } from '../constants';
import { loadTargetConfig, saveConfig } from '../helpers/aipm-config';
import { fileExists } from '../helpers/fs';
import { resolveMarketplacePath } from '../helpers/git';
import { defaultIO } from '../helpers/io';
import {
  getMarketplaceType,
  getPluginSourcePath,
  isPluginInManifest,
  loadMarketplaceManifest,
} from '../helpers/marketplace';
import { validatePluginStructure } from '../helpers/plugin';
import { formatSyncResult, syncPluginToCursor } from '../helpers/sync-strategy';

const PluginInstallOptionsSchema = z.object({
  pluginId: z.string().min(1),
  cwd: z.string().optional(),
  local: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
});

export async function pluginInstall(options: unknown): Promise<void> {
  const cmd = PluginInstallOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { config, sources } = await loadPluginsConfig(cwd);

    if (!sources.project && !sources.local) {
      const error = new Error(getNotInitializedMessage());
      defaultIO.logError(error.message);
      throw error;
    }
    const configName = cmd.local ? getConfigPath(FILE_AIPM_CONFIG_LOCAL) : getConfigPath(FILE_AIPM_CONFIG);

    const [pluginName, marketplaceName] = cmd.pluginId.split('@');

    if (!pluginName || !marketplaceName) {
      const error = new Error(`Invalid plugin ID format: ${cmd.pluginId} (expected: plugin@marketplace)`);
      defaultIO.logError(error.message);
      throw error;
    }

    const marketplace = config.marketplaces[marketplaceName];

    if (!marketplace) {
      const error = new Error(`Marketplace '${marketplaceName}' not found. Add it first with 'marketplace add'.`);
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

    const manifest = !cmd.dryRun
      ? await loadMarketplaceManifest(marketplacePath, getMarketplaceType(marketplaceName))
      : null;

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

    const isAlreadyEnabled = config.plugins[cmd.pluginId]?.enabled;

    if (isAlreadyEnabled && !cmd.force) {
      defaultIO.logInfo(`Plugin '${cmd.pluginId}' is already installed`);
      return;
    }

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would enable plugin '${cmd.pluginId}' in ${configName}`);
      defaultIO.logInfo(`[DRY RUN] Would sync ${cmd.pluginId} to .cursor/`);
      return;
    }

    const targetConfig = await loadTargetConfig(cwd, cmd.local);
    const updatedConfig = merge({}, targetConfig, {
      plugins: { [cmd.pluginId]: { enabled: true } },
    });

    await saveConfig(cwd, updatedConfig, cmd.local);
    defaultIO.logSuccess(`Enabled plugin '${cmd.pluginId}' in ${configName}`);

    const cursorDir = join(cwd, DIR_CURSOR);
    const syncResult = await syncPluginToCursor(pluginPath, marketplaceName, pluginName, cursorDir);
    const summary = formatSyncResult(syncResult);

    defaultIO.logSuccess(`Installed ${cmd.pluginId}`);
    console.log(`\n✨ Plugin '${cmd.pluginId}' installed successfully! (${summary})\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to install plugin: ${message}`);
    throw error;
  }
}
