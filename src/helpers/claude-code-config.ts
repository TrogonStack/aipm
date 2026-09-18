import { homedir } from 'node:os';
import * as path from 'node:path';
import { join } from 'node:path';
import { z } from 'zod';
import {
  DIR_CLAUDE,
  FILE_CLAUDE_CONFIG,
  FILE_CLAUDE_INSTALLED_PLUGINS,
  FILE_CLAUDE_KNOWN_MARKETPLACES,
} from '../constants';
import type { MarketplaceSource } from '../schema';
import { MarketplaceSourceSchema } from '../schema';
import { fileExists } from './fs';

/**
 * Schema for Claude Code's known_marketplaces.json
 * Based on standard plugin marketplace patterns
 */
const ClaudeMarketplaceEntrySchema = z.object({
  name: z.string(),
  source: z.enum(['directory', 'git', 'url']),
  path: z.string().optional(),
  url: z.string().optional(),
  branch: z.string().optional(),
  enabled: z.boolean().optional(),
});

/**
 * Schema for Claude Code's actual marketplace format (object with marketplace names as keys)
 */
const ClaudeMarketplaceObjectEntrySchema = z.object({
  source: z
    .object({
      source: z.string(),
      repo: z.string().optional(),
      url: z.string().optional(),
      branch: z.string().optional(),
    })
    .or(z.string())
    .optional(),
  installLocation: z.string().optional(),
  lastUpdated: z.string().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  branch: z.string().optional(),
  enabled: z.boolean().optional(),
});

/**
 * Schema for Claude Code's known_marketplaces.json
 * Claude Code uses object format: { "marketplace-name": { ... } }
 */
const ClaudeKnownMarketplacesSchema = z.record(z.string(), ClaudeMarketplaceObjectEntrySchema);

/**
 * Schema for Claude Code's installed_plugins.json
 */
const ClaudeInstalledPluginSchema = z.object({
  name: z.string(),
  marketplace: z.string(),
  version: z.string().optional(),
  enabled: z.boolean().optional(),
});

const ClaudeInstalledPluginsSchema = z.object({
  plugins: z.array(ClaudeInstalledPluginSchema),
});

/**
 * Schema for Claude Code's config.json
 * Using loose to allow unknown fields since Claude Code's config may evolve
 */
const ClaudeCodeConfigSchema = z
  .object({
    version: z.string().optional(),
    autoUpdate: z.boolean().optional(),
  })
  .loose();

export type ClaudeMarketplaceEntry = z.infer<typeof ClaudeMarketplaceEntrySchema>;
export type ClaudeMarketplaceObjectEntry = z.infer<typeof ClaudeMarketplaceObjectEntrySchema>;
export type ClaudeKnownMarketplaces = z.infer<typeof ClaudeKnownMarketplacesSchema>;
export type ClaudeInstalledPlugin = z.infer<typeof ClaudeInstalledPluginSchema>;
export type ClaudeCodeConfig = z.infer<typeof ClaudeCodeConfigSchema>;

/**
 * Get the path to Claude Code's plugin directory
 */
export function getClaudeCodePluginsDir(): string {
  return join(homedir(), DIR_CLAUDE, 'plugins');
}

/**
 * Check if Claude Code is installed by looking for its config directory
 */
export async function isClaudeCodeInstalled(): Promise<boolean> {
  try {
    const claudePluginsDir = getClaudeCodePluginsDir();
    return await fileExists(claudePluginsDir);
  } catch {
    return false;
  }
}

/**
 * Read Claude Code's known_marketplaces.json
 * Returns Claude Code's format as-is: { "marketplace-name": { ... } }
 */
export async function readClaudeCodeMarketplaces(): Promise<ClaudeKnownMarketplaces> {
  try {
    const claudePluginsDir = getClaudeCodePluginsDir();
    const marketplacesPath = join(claudePluginsDir, FILE_CLAUDE_KNOWN_MARKETPLACES);

    if (!(await fileExists(marketplacesPath))) {
      return {};
    }

    const file = Bun.file(marketplacesPath);
    const data = await file.json();

    const result = ClaudeKnownMarketplacesSchema.safeParse(data);
    if (!result.success) {
      console.warn('\n⚠️  AIPM: Failed to parse Claude Code marketplaces');
      console.warn(`    File: ${marketplacesPath}`);
      console.warn(`    Error: ${JSON.stringify(result.error.issues, null, 2)}`);
      console.warn('    This might be due to a Claude Code format change.');
      console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
      return {};
    }

    return result.data;
  } catch (error) {
    console.warn('\n⚠️  AIPM: Failed to read Claude Code marketplaces');
    console.warn(`    Error: ${error}`);
    console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
    return {};
  }
}

/**
 * Read Claude Code's installed_plugins.json
 */
export async function readClaudeCodeInstalledPlugins(): Promise<ClaudeInstalledPlugin[]> {
  try {
    const claudePluginsDir = getClaudeCodePluginsDir();
    const pluginsPath = join(claudePluginsDir, FILE_CLAUDE_INSTALLED_PLUGINS);

    if (!(await fileExists(pluginsPath))) {
      return [];
    }

    const file = Bun.file(pluginsPath);
    const data = await file.json();

    const result = ClaudeInstalledPluginsSchema.safeParse(data);
    if (!result.success) {
      console.warn('\n⚠️  AIPM: Failed to parse Claude Code installed plugins');
      console.warn(`    File: ${pluginsPath}`);
      console.warn(`    Error: ${result.error.message}`);
      console.warn('    This might be due to a Claude Code format change.');
      console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
      return [];
    }

    return result.data.plugins;
  } catch (error) {
    console.warn('\n⚠️  AIPM: Failed to read Claude Code installed plugins');
    console.warn(`    Error: ${error}`);
    console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
    return [];
  }
}

/**
 * Read Claude Code's config.json
 */
export async function readClaudeCodeConfig(): Promise<ClaudeCodeConfig | null> {
  try {
    const claudePluginsDir = getClaudeCodePluginsDir();
    const configPath = join(claudePluginsDir, FILE_CLAUDE_CONFIG);

    if (!(await fileExists(configPath))) {
      return null;
    }

    const file = Bun.file(configPath);
    const data = await file.json();

    const result = ClaudeCodeConfigSchema.safeParse(data);
    if (!result.success) {
      console.warn('\n⚠️  AIPM: Failed to parse Claude Code config');
      console.warn(`    File: ${configPath}`);
      console.warn(`    Error: ${result.error.message}`);
      console.warn('    This might be due to a Claude Code format change.');
      console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
      return null;
    }

    return result.data;
  } catch (error) {
    console.warn('\n⚠️  AIPM: Failed to read Claude Code config');
    console.warn(`    Error: ${error}`);
    console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
    return null;
  }
}

/**
 * Get the full path to a Claude Code marketplace
 *
 * Resolves relative paths relative to Claude Code's plugins directory.
 * Returns absolute paths as-is (supports both POSIX and Windows paths).
 * For git/url sources without a path, returns the expected cache location.
 *
 * @param marketplaceName - The name of the marketplace
 * @param marketplaceConfig - The Claude Code marketplace configuration
 * @returns The resolved absolute path to the marketplace
 */
export function getClaudeCodeMarketplacePath(
  marketplaceName: string,
  marketplaceConfig: ClaudeMarketplaceObjectEntry,
): string {
  const claudePluginsDir = getClaudeCodePluginsDir();

  // Use installLocation or path if available
  const marketplacePath = marketplaceConfig.installLocation || marketplaceConfig.path;
  if (marketplacePath) {
    // Check if path is absolute on either Windows or POSIX systems
    if (path.isAbsolute(marketplacePath) || path.win32.isAbsolute(marketplacePath)) {
      return marketplacePath;
    }
    return join(claudePluginsDir, 'marketplaces', marketplacePath);
  }

  // For git/url sources, Claude Code caches them in the marketplaces directory
  return join(claudePluginsDir, 'marketplaces', marketplaceName);
}

/**
 * Extract source info from Claude Code marketplace config
 * Validates and normalizes the source type
 */
function extractSourceInfo(source: ClaudeMarketplaceObjectEntry['source']): {
  source: 'directory' | 'git' | 'url';
  url?: string;
  branch?: string;
} {
  if (!source) {
    return { source: 'directory' };
  }

  if (typeof source === 'string') {
    // Validate source type
    if (source === 'directory' || source === 'git' || source === 'url') {
      return { source };
    }
    // Default to directory for unknown string values
    return { source: 'directory' };
  }

  // Handle nested source object
  if (source.source === 'github' && source.repo) {
    return {
      source: 'git',
      url: `https://github.com/${source.repo}.git`,
      branch: source.branch,
    };
  }

  if (source.url) {
    const sourceType = source.url.startsWith('http') ? 'url' : 'git';
    return {
      source: sourceType,
      url: source.url,
      branch: source.branch,
    };
  }

  return { source: 'directory' };
}

/**
 * Determine path from Claude Code marketplace config
 */
function determinePath(config: ClaudeMarketplaceObjectEntry): string | undefined {
  return config.installLocation || config.path;
}

/**
 * Apply fallback URL/branch from top-level config if not already set
 * Determines final source type based on available information
 */
function applyFallbackUrlBranch(
  sourceInfo: ReturnType<typeof extractSourceInfo>,
  config: ClaudeMarketplaceObjectEntry,
) {
  const url = sourceInfo.url || config.url;
  const branch = sourceInfo.branch || config.branch;

  // Determine source type: if we got URL from fallback and source was directory, infer from URL
  const source =
    !sourceInfo.url && url && sourceInfo.source === 'directory'
      ? url.startsWith('http')
        ? ('url' as const)
        : ('git' as const)
      : sourceInfo.source;

  return { source, url, branch };
}

/**
 * Convert Claude Code marketplace to AIPM marketplace format
 * Resolves paths relative to Claude Code's plugins directory
 */
export function convertClaudeMarketplaceToAIPM(
  marketplaceName: string,
  marketplaceConfig: ClaudeMarketplaceObjectEntry,
): MarketplaceSource {
  // If installLocation exists, treat as directory (already cloned)
  if (marketplaceConfig.installLocation) {
    return MarketplaceSourceSchema.parse({
      source: 'directory',
      path: marketplaceConfig.installLocation,
    });
  }

  // Extract source info and apply fallbacks
  const sourceInfo = extractSourceInfo(marketplaceConfig.source);
  const path = determinePath(marketplaceConfig);
  const finalSourceInfo = applyFallbackUrlBranch(sourceInfo, marketplaceConfig);

  // Return AIPM format
  if (finalSourceInfo.source === 'directory' && path) {
    // Resolve path relative to Claude Code's plugins directory
    const resolvedPath = getClaudeCodeMarketplacePath(marketplaceName, marketplaceConfig);
    return MarketplaceSourceSchema.parse({
      source: 'directory',
      path: resolvedPath,
    });
  }

  return MarketplaceSourceSchema.parse({
    source: finalSourceInfo.source,
    url: finalSourceInfo.url,
    branch: finalSourceInfo.branch,
  });
}
