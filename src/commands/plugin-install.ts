import merge from 'lodash.merge';
import { join } from 'node:path';
import { z } from 'zod';
import { loadClaudeCodeMarketplaces, loadPluginsConfig } from '../config/loader';
import { DIR_CURSOR } from '../constants';
import { getErrorMessage } from '../errors';
import { loadTargetConfig, saveConfig } from '../helpers/aipm-config';
import { isClaudeCodeInstalled } from '../helpers/claude-code-config';
import { fileExists } from '../helpers/fs';
import { resolveMarketplacePath } from '../helpers/git';
import { defaultIO } from '../helpers/io';
import { getMarketplaceType, loadMarketplaceManifest, resolvePluginPath } from '../helpers/marketplace';
import { isMetaPlugin, parsePluginId, validatePluginStructure } from '../helpers/plugin';
import { formatSyncResult, syncMetaPluginToCursor, syncPluginToCursor } from '../helpers/sync-strategy';

const PluginInstallOptionsSchema = z.object({
  pluginId: z.string().min(1),
  cwd: z.string().optional(),
  dryRun: z.boolean().optional(),
});

export async function pluginInstall(options: unknown): Promise<void> {
  const cmd = PluginInstallOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { pluginName, marketplaceName } = parsePluginId(cmd.pluginId);

    // Load AIPM config if available (optional for zero-config Claude Code mode)
    let config: any = {};
    let aipmInitialized = false;
    try {
      const loaded = await loadPluginsConfig(cwd);
      config = loaded.config;
      aipmInitialized = true;
    } catch {
      // AIPM not initialized - this is OK for Claude Code zero-config mode
      config = { marketplaces: {}, plugins: {} };
    }

    const aipmMarketplaces: Record<string, any> = config.marketplaces || {};

    // Check if plugin is already installed
    if (aipmInitialized && config.plugins[cmd.pluginId]) {
      defaultIO.logInfo(`Plugin '${cmd.pluginId}' is already installed`);
      return;
    }

    const claudeMarketplaces = await loadClaudeCodeMarketplaces();
    const allMarketplaces = merge({}, claudeMarketplaces, aipmMarketplaces);
    const marketplace = allMarketplaces[marketplaceName];

    if (!marketplace) {
      const availableMarketplaces = Object.keys(allMarketplaces);

      let errorMessage: string;
      if (!availableMarketplaces.includes(marketplaceName) && marketplaceName.startsWith('claude/')) {
        const claudeCodeInstalled = await isClaudeCodeInstalled();
        if (!claudeCodeInstalled) {
          errorMessage = `Claude Code is not installed. Install Claude Code to use Claude Code marketplaces like '${marketplaceName}'.`;
        } else {
          errorMessage =
            `Marketplace '${marketplaceName}' not found in Claude Code. ` +
            `Available marketplaces: ${availableMarketplaces.join(', ')}`;
        }
      } else if (availableMarketplaces.length === 0) {
        errorMessage = `Marketplace '${marketplaceName}' not found. No marketplaces available.`;
      } else {
        errorMessage =
          `Marketplace '${marketplaceName}' not found. ` +
          `Available marketplaces: ${availableMarketplaces.join(', ')}`;
      }

      const error = new Error(errorMessage);
      defaultIO.logError(error.message);
      throw error;
    }

    let marketplacePath: string | null = null;

    // For git/url sources, resolve the path (clone/download if needed)
    if (marketplace.source && marketplace.source !== 'directory') {
      marketplacePath = await resolveMarketplacePath(marketplaceName, marketplace, cwd, {
        dryRun: cmd.dryRun,
      });
    } else {
      // For directory sources, use the path directly
      marketplacePath = marketplace.path;
    }

    if (!marketplacePath) {
      const error = new Error(`Marketplace '${marketplaceName}' has no path/url configured`);
      defaultIO.logError(error.message);
      throw error;
    }

    let manifest: Awaited<ReturnType<typeof loadMarketplaceManifest>> = null;
    let pluginPath: string | null = null;

    // Always validate for directory sources; skip expensive operations for git/url in dry-run
    const isDirectorySource = !marketplace.source || marketplace.source === 'directory';
    const shouldValidate = isDirectorySource || !cmd.dryRun;

    if (shouldValidate) {
      manifest = await loadMarketplaceManifest(marketplacePath, getMarketplaceType(marketplaceName));

      // Resolve plugin path: try manifest first, then search recursively if needed
      pluginPath = await resolvePluginPath(marketplacePath, pluginName, manifest);

      if (!(await fileExists(pluginPath))) {
        const error = new Error(
          `Plugin '${pluginName}' not found in marketplace '${marketplaceName}'. ` + `Checked path: ${pluginPath}.`,
        );
        defaultIO.logError(error.message);
        throw error;
      }

      try {
        const isMetaPluginCheck = isMetaPlugin(marketplacePath, pluginPath, manifest);
        await validatePluginStructure(pluginPath, { isMetaPlugin: isMetaPluginCheck });
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        const validationError = new Error(`Invalid plugin '${pluginName}': ${message}`);
        defaultIO.logError(validationError.message);
        throw validationError;
      }
    }

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would sync ${cmd.pluginId} to .cursor/skills/`);
      return;
    }

    // For git/url sources in dry-run, we skip validation so pluginPath won't be set
    // In this case, we can't perform the sync, so we already returned above
    if (!pluginPath) {
      throw new Error(`Plugin path not resolved for '${pluginName}'`);
    }

    const cursorDir = join(cwd, DIR_CURSOR);
    const isMetaPluginCheck = isMetaPlugin(marketplacePath, pluginPath, manifest);

    // Check if it's a meta-plugin with skills defined in the manifest
    let syncResult;
    if (isMetaPluginCheck && manifest) {
      const pluginEntry = manifest.plugins.find((p) => p.name === pluginName);
      if (pluginEntry && pluginEntry.skills && pluginEntry.skills.length > 0) {
        // True meta-plugin with skills in manifest
        syncResult = await syncMetaPluginToCursor(marketplacePath, manifest, pluginName, marketplaceName, cursorDir);
      } else {
        // Meta-plugin path but skills are in plugin.json (not in marketplace manifest)
        // Fall back to regular plugin sync
        syncResult = await syncPluginToCursor(pluginPath, marketplaceName, pluginName, cursorDir);
      }
    } else {
      syncResult = await syncPluginToCursor(pluginPath, marketplaceName, pluginName, cursorDir);
    }

    // Save plugin to AIPM config if initialized (enables sync and uninstall)
    if (aipmInitialized) {
      const targetConfig = await loadTargetConfig(cwd, false);
      const updatedConfig = merge({}, targetConfig, {
        plugins: { [cmd.pluginId]: { enabled: true } },
      });
      await saveConfig(cwd, updatedConfig, false);
    }

    const summary = formatSyncResult(syncResult);

    defaultIO.logSuccess(`Installed ${cmd.pluginId}`);
    if (aipmInitialized) {
      defaultIO.logSuccess(`Added plugin '${cmd.pluginId}' to .aipm/config.json`);
    }
    console.log(`\n✨ Plugin '${cmd.pluginId}' installed successfully! (${summary})\n`);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    defaultIO.logError(`Failed to install plugin: ${message}`);
    throw error;
  }
}
