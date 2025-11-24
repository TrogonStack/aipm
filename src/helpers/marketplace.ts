import { readdir, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { DIR_CLAUDE_PLUGIN, FILE_MARKETPLACE_MANIFEST } from '../constants';
import { isFileNotFoundError } from '../errors';
import type { MarketplaceManifest, MarketplaceType } from '../schema';
import { MarketplaceManifestSchema } from '../schema';
import { fileExists, JsonFileError, readJsonFile } from './fs';

/**
 * Determines the marketplace type based on the marketplace name.
 * Claude Code marketplaces are prefixed with 'claude/'.
 */
export function getMarketplaceType(marketplaceName: string): MarketplaceType {
  return marketplaceName.startsWith('claude/') ? 'claude' : 'aipm';
}

export async function loadAipmMarketplaceManifest(marketplacePath: string): Promise<MarketplaceManifest | null> {
  const manifestPath = join(marketplacePath, FILE_MARKETPLACE_MANIFEST);

  try {
    return await readJsonFile(manifestPath, MarketplaceManifestSchema);
  } catch (error) {
    // Handle missing file gracefully
    if (isFileNotFoundError(error)) {
      return null;
    }

    // Handle JSON parsing/validation errors
    if (error instanceof JsonFileError) {
      console.warn('\n⚠️  AIPM: Failed to parse marketplace manifest');
      console.warn(`    File: ${manifestPath}`);
      if (error.cause && typeof error.cause === 'object' && 'issues' in error.cause) {
        console.warn(`    Error: ${JSON.stringify(error.cause.issues, null, 2)}`);
      } else if (error.cause) {
        console.warn(`    Error: ${JSON.stringify(error.cause, null, 2)}`);
      }
      console.warn('    This might be due to a corrupted or invalid manifest file.');
      console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
    }
    return null;
  }
}

export async function loadClaudeCodeMarketplaceManifest(marketplacePath: string): Promise<MarketplaceManifest | null> {
  const claudePluginManifestPath = join(marketplacePath, DIR_CLAUDE_PLUGIN, FILE_MARKETPLACE_MANIFEST);

  try {
    return await readJsonFile(claudePluginManifestPath, MarketplaceManifestSchema);
  } catch (error) {
    // Handle missing file gracefully
    if (isFileNotFoundError(error)) {
      return null;
    }

    // Handle JSON parsing/validation errors
    if (error instanceof JsonFileError) {
      console.warn('\n⚠️  AIPM: Failed to parse Claude Code marketplace manifest');
      console.warn(`    File: ${claudePluginManifestPath}`);
      if (error.cause && typeof error.cause === 'object' && 'issues' in error.cause) {
        console.warn(`    Error: ${JSON.stringify(error.cause.issues, null, 2)}`);
      } else if (error.cause) {
        console.warn(`    Error: ${JSON.stringify(error.cause, null, 2)}`);
      }
      console.warn('    This might be due to a corrupted or invalid manifest file.');
      console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
    }
    return null;
  }
}

export async function loadMarketplaceManifest(
  marketplacePath: string,
  marketplaceType: MarketplaceType,
): Promise<MarketplaceManifest | null> {
  if (marketplaceType === 'claude') {
    return await loadClaudeCodeMarketplaceManifest(marketplacePath);
  }
  return await loadAipmMarketplaceManifest(marketplacePath);
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

/**
 * Resolves the plugin path from manifest or by searching recursively if no manifest exists.
 *
 * The marketplacePath is already resolved from installLocation in known_marketplaces.json,
 * so we have the authoritative marketplace root. The manifest's source field supports n-level
 * deep paths (e.g., "./available-plugins/code-review-ai"), so if the manifest exists and lists
 * the plugin, we try its source path first.
 *
 * If the manifest path doesn't exist (e.g., incorrect source path), we fall back to recursive
 * search to discover the plugin's actual location. Recursive search is also used when no manifest
 * exists (for auto-discovery).
 */
export async function resolvePluginPath(
  marketplacePath: string,
  pluginName: string,
  manifest: MarketplaceManifest | null,
): Promise<string> {
  // If manifest exists and lists the plugin, try its source path first
  if (manifest && isPluginInManifest(pluginName, manifest)) {
    const manifestPath = getPluginSourcePath(marketplacePath, pluginName, manifest);
    // Verify the manifest path actually exists
    if (await fileExists(manifestPath)) {
      return manifestPath;
    }
    // Manifest path doesn't exist (incorrect source), fall through to recursive search
  }

  // Search recursively when:
  // 1. No manifest exists (auto-discovery)
  // 2. Manifest exists but path doesn't exist (incorrect source path)
  const availablePlugins = await getAvailablePlugins(marketplacePath, null);
  const matchingPlugin = availablePlugins.find((p) => p === pluginName || p.split('/').pop() === pluginName);
  if (matchingPlugin) {
    return join(marketplacePath, matchingPlugin);
  }

  // Fallback: return path based on plugin name or manifest source (even if it doesn't exist)
  return getPluginSourcePath(marketplacePath, pluginName, manifest);
}
