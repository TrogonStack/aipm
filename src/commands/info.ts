import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getConfigPath, loadPluginsConfig } from '../config/loader';
import { FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL } from '../constants';
import { DirectoryNotFoundError, isFileNotFoundError, PluginNotFoundError } from '../errors';
import { resolveMarketplacePath } from '../helpers/git';
import { defaultIO } from '../helpers/io';
import { getMarketplaceType, getPluginSourcePath, loadMarketplaceManifest } from '../helpers/marketplace';
import { loadPluginManifest } from '../helpers/plugin';

const InfoOptionsSchema = z.object({
  pluginId: z.string().min(1),
  cwd: z.string().optional(),
});

export async function info(options: unknown): Promise<void> {
  const cmd = InfoOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { config, sources } = await loadPluginsConfig(cwd);

    if (!sources.project) {
      defaultIO.logError(`No ${getConfigPath(FILE_AIPM_CONFIG)} found. Run 'aipm init' first.`);
      defaultIO.logInfo(`(${getConfigPath(FILE_AIPM_CONFIG_LOCAL)} is optional for local overrides)`);
      return;
    }

    const parts = cmd.pluginId.split('@');
    if (parts.length !== 2) {
      defaultIO.logError(`Invalid plugin ID format: ${cmd.pluginId} (expected: plugin@marketplace)`);
      return;
    }

    const [pluginName, marketplaceName] = parts;

    if (!pluginName || !marketplaceName) {
      defaultIO.logError(`Invalid plugin ID format: ${cmd.pluginId} (expected: plugin@marketplace)`);
      return;
    }

    const marketplace = config.marketplaces[marketplaceName];
    if (!marketplace) {
      defaultIO.logError(`Marketplace '${marketplaceName}' not found`);
      return;
    }

    const marketplacePath = await resolveMarketplacePath(marketplaceName, marketplace, cwd);

    if (!marketplacePath) {
      defaultIO.logError(`Marketplace '${marketplaceName}' has no path/url configured`);
      return;
    }

    const marketplaceManifest = await loadMarketplaceManifest(marketplacePath, getMarketplaceType(marketplaceName));
    const pluginPath = getPluginSourcePath(marketplacePath, pluginName, marketplaceManifest);

    let pluginStats;
    try {
      pluginStats = await stat(pluginPath);
    } catch (error: unknown) {
      if (isFileNotFoundError(error)) {
        throw new PluginNotFoundError(pluginName, marketplaceName, { cause: error });
      }
      throw error;
    }

    if (!pluginStats.isDirectory()) {
      defaultIO.logError(`Plugin path is not a directory: ${pluginPath}`);
      return;
    }

    let manifest: Awaited<ReturnType<typeof loadPluginManifest>>;
    try {
      manifest = await loadPluginManifest(pluginPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      defaultIO.logError(`Failed to get plugin info: ${message}`);
      return;
    }

    const pluginConfig = config.plugins[cmd.pluginId];
    const isEnabled = pluginConfig?.enabled ?? false;

    console.log(`\n📦 ${manifest.name || pluginName}`);
    console.log('─'.repeat(50));

    if (manifest.description) {
      console.log(`\n${manifest.description}`);
    }

    console.log(`\n🔖 Version: ${manifest.version || 'unknown'}`);
    console.log(`📍 Marketplace: ${marketplaceName}`);
    console.log(`🔌 Status: ${isEnabled ? '✓ Enabled' : '✗ Disabled'}`);

    if (pluginConfig?.scope) {
      console.log(`📂 Scope: ${pluginConfig.scope}`);
    }

    if (manifest.author) {
      const authorName = typeof manifest.author === 'string' ? manifest.author : manifest.author.name;
      console.log(`👤 Author: ${authorName}`);
    }

    if (manifest.homepage) {
      console.log(`🌐 Homepage: ${manifest.homepage}`);
    }

    if (manifest.repository) {
      console.log(`📚 Repository: ${manifest.repository}`);
    }

    const commandsPath = join(pluginPath, 'commands');
    try {
      const commandStats = await stat(commandsPath);
      if (commandStats.isDirectory()) {
        const commandFiles = await readdir(commandsPath);
        const mdFiles = commandFiles.filter((f) => f.endsWith('.md'));

        if (mdFiles.length > 0) {
          console.log(`\n⚡ Commands (${mdFiles.length}):`);
          for (const file of mdFiles.sort()) {
            const commandName = file.replace(/\.md$/, '');
            console.log(`  • ${commandName}`);
          }
        }
      }
    } catch (error: unknown) {
      if (isFileNotFoundError(error)) {
        // No commands directory - that's ok
      } else {
        throw new DirectoryNotFoundError(commandsPath, { cause: error });
      }
    }

    console.log(`\n📁 Location: ${pluginPath}`);
    console.log('');
  } catch (error: unknown) {
    if (error instanceof PluginNotFoundError || error instanceof DirectoryNotFoundError) {
      defaultIO.logError(error.message);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to get plugin info: ${message}`);
    throw error;
  }
}
