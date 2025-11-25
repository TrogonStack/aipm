import { join, normalize } from 'node:path';
import { DIR_CLAUDE_PLUGIN, FILE_PLUGIN_MANIFEST } from '../constants';
import { isFileNotFoundError, PluginManifestInvalidError, PluginManifestNotFoundError } from '../errors';
import type { MarketplaceManifest, PluginManifest } from '../schema';
import { PluginManifestSchema } from '../schema';
import { readJsonFile } from './fs';

export async function loadPluginManifest(pluginPath: string): Promise<PluginManifest> {
  const manifestPath = join(pluginPath, DIR_CLAUDE_PLUGIN, FILE_PLUGIN_MANIFEST);

  try {
    const manifest = await readJsonFile(manifestPath, PluginManifestSchema);
    return manifest;
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      throw new PluginManifestNotFoundError(pluginPath, { cause: error });
    }
    throw new PluginManifestInvalidError(pluginPath, { cause: error });
  }
}

export function isMetaPlugin(
  marketplacePath: string,
  pluginPath: string,
  marketplaceManifest: MarketplaceManifest | null,
): boolean {
  if (!marketplaceManifest) {
    return false;
  }

  const normalizedMarketplace = normalize(marketplacePath).replace(/\/$/, '');
  const normalizedPlugin = normalize(pluginPath).replace(/\/$/, '');

  return normalizedMarketplace === normalizedPlugin;
}

export async function validatePluginStructure(
  pluginPath: string,
  options?: {
    isMetaPlugin?: boolean;
  },
): Promise<void> {
  if (options?.isMetaPlugin) {
    return;
  }

  const manifest = await loadPluginManifest(pluginPath);

  if (!manifest.name) {
    throw new Error("Plugin manifest must include 'name' field");
  }

  if (!manifest.version) {
    throw new Error("Plugin manifest must include 'version' field");
  }

  if (!manifest.author) {
    throw new Error("Plugin manifest must include 'author' field");
  }
}
