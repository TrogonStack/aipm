import { join } from 'node:path';
import { FILE_MARKETPLACE_MANIFEST } from '../constants';
import type { MarketplaceManifest } from '../schema';
import { MarketplaceManifestSchema } from '../schema';
import { readJsonFile } from './fs';

export async function loadMarketplaceManifest(marketplacePath: string): Promise<MarketplaceManifest | null> {
  const manifestPath = join(marketplacePath, FILE_MARKETPLACE_MANIFEST);

  try {
    const manifest = await readJsonFile(manifestPath, MarketplaceManifestSchema);
    return manifest;
  } catch (_error) {
    return null;
  }
}

export async function fetchRemoteMarketplaceManifest(url: string): Promise<MarketplaceManifest> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch marketplace.json from ${url}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return MarketplaceManifestSchema.parse(data);
}

export async function getAvailablePlugins(
  marketplacePath: string,
  manifest: MarketplaceManifest | null,
): Promise<string[]> {
  if (manifest) {
    return manifest.plugins.map((p) => p.name);
  }

  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(marketplacePath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name);
}

export function isPluginInManifest(pluginName: string, manifest: MarketplaceManifest | null): boolean {
  if (!manifest) {
    return true;
  }

  return manifest.plugins.some((p) => p.name === pluginName);
}

export function getPluginSourcePath(
  marketplacePath: string,
  pluginName: string,
  manifest: MarketplaceManifest | null,
): string {
  if (manifest) {
    const pluginEntry = manifest.plugins.find((p) => p.name === pluginName);
    if (pluginEntry) {
      return join(marketplacePath, pluginEntry.source);
    }
  }

  return join(marketplacePath, pluginName);
}
