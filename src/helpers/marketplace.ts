import { readdir, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { DIR_CLAUDE_PLUGIN, FILE_MARKETPLACE_MANIFEST } from '../constants';
import type { MarketplaceManifest } from '../schema';
import { MarketplaceManifestSchema } from '../schema';
import { fileExists, readJsonFile } from './fs';

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

async function canonicalizePaths(
  basePath: string,
  marketplaceRoot: string,
): Promise<{ canonicalBase: string; canonicalRoot: string } | null> {
  try {
    const canonicalBase = await realpath(basePath);
    const canonicalRoot = await realpath(marketplaceRoot);
    return { canonicalBase, canonicalRoot };
  } catch {
    // If realpath fails (e.g., path doesn't exist), return null
    return null;
  }
}

async function findPluginsRecursively(
  basePath: string,
  marketplaceRoot: string,
  visited: Set<string> = new Set(),
): Promise<string[]> {
  // Canonicalize paths to handle symlinks properly
  const canonical = await canonicalizePaths(basePath, marketplaceRoot);
  if (!canonical) {
    return [];
  }

  // Safety 1: Don't escape the marketplace directory (with path separator to avoid prefix collision)
  if (
    !canonical.canonicalBase.startsWith(canonical.canonicalRoot + sep) &&
    canonical.canonicalBase !== canonical.canonicalRoot
  ) {
    return [];
  }

  // Safety 2: Detect symlink loops (prevent infinite recursion)
  if (visited.has(canonical.canonicalBase)) {
    return [];
  }

  visited.add(canonical.canonicalBase);

  // Try to read directory entries, gracefully handle errors (permission issues, deletion, etc.)
  let entries;
  try {
    entries = await readdir(basePath, { withFileTypes: true });
  } catch {
    // Directory cannot be read, skip it
    return [];
  }

  const plugins: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = join(basePath, entry.name);
    const pluginMarkerPath = join(fullPath, DIR_CLAUDE_PLUGIN);

    // Check if this directory contains a .claude-plugin folder (valid plugin)
    if (await fileExists(pluginMarkerPath)) {
      // Canonicalize the plugin path to verify it's within the marketplace boundary
      try {
        const canonicalPluginPath = await realpath(fullPath);

        // Security check: verify the canonical path is within the marketplace root
        if (
          !canonicalPluginPath.startsWith(canonical.canonicalRoot + sep) &&
          canonicalPluginPath !== canonical.canonicalRoot
        ) {
          // Plugin is outside marketplace boundary (symlink escape attempt), skip it
          continue;
        }

        // Return the relative path from marketplace root
        const relativePath = relative(canonical.canonicalRoot, canonicalPluginPath);
        plugins.push(relativePath);
      } catch {
        // If realpath fails, skip this plugin
        continue;
      }
    } else {
      // Recursively search subdirectories
      const subPlugins = await findPluginsRecursively(fullPath, marketplaceRoot, visited);
      plugins.push(...subPlugins);
    }
  }

  return plugins;
}

export async function getAvailablePlugins(
  marketplacePath: string,
  manifest: MarketplaceManifest | null,
): Promise<string[]> {
  if (manifest) {
    return manifest.plugins.map((p) => p.name);
  }

  // When no manifest exists, recursively search for directories containing .claude-plugin
  return findPluginsRecursively(marketplacePath, marketplacePath);
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
