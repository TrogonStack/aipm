import * as path from 'node:path';
import { join } from 'node:path';
import { z } from 'zod';
import {
  DIR_CLAUDE,
  FILE_CLAUDE_CONFIG,
  FILE_CLAUDE_INSTALLED_PLUGINS,
  FILE_CLAUDE_KNOWN_MARKETPLACES,
} from '../constants';
import { fileExists } from './fs';
import { getHomeDir } from './paths';

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

const ClaudeKnownMarketplacesSchema = z.object({
  marketplaces: z.array(ClaudeMarketplaceEntrySchema),
});

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
export type ClaudeInstalledPlugin = z.infer<typeof ClaudeInstalledPluginSchema>;
export type ClaudeCodeConfig = z.infer<typeof ClaudeCodeConfigSchema>;

/**
 * Get the path to Claude Code's plugin directory
 */
export function getClaudeCodePluginsDir(): string {
  const homeDir = getHomeDir();
  return join(homeDir, DIR_CLAUDE, 'plugins');
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
 */
export async function readClaudeCodeMarketplaces(): Promise<ClaudeMarketplaceEntry[]> {
  try {
    const claudePluginsDir = getClaudeCodePluginsDir();
    const marketplacesPath = join(claudePluginsDir, FILE_CLAUDE_KNOWN_MARKETPLACES);

    if (!(await fileExists(marketplacesPath))) {
      return [];
    }

    const file = Bun.file(marketplacesPath);
    const data = await file.json();

    const result = ClaudeKnownMarketplacesSchema.safeParse(data);
    if (!result.success) {
      console.warn('\n⚠️  AIPM: Failed to parse Claude Code marketplaces');
      console.warn(`    File: ${marketplacesPath}`);
      console.warn(`    Error: ${result.error.message}`);
      console.warn('    This might be due to a Claude Code format change.');
      console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
      return [];
    }

    return result.data.marketplaces;
  } catch (error) {
    console.warn('\n⚠️  AIPM: Failed to read Claude Code marketplaces');
    console.warn(`    Error: ${error}`);
    console.warn('    Please report this at: https://github.com/TrogonStack/aipm/discussions/categories/buggy\n');
    return [];
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
 */
export function getClaudeCodeMarketplacePath(marketplace: ClaudeMarketplaceEntry): string {
  const claudePluginsDir = getClaudeCodePluginsDir();

  if (marketplace.source === 'directory' && marketplace.path) {
    // Check if path is absolute on either Windows or POSIX systems
    // This allows Claude Code configs to work cross-platform
    if (path.isAbsolute(marketplace.path) || path.win32.isAbsolute(marketplace.path)) {
      return marketplace.path;
    }
    return join(claudePluginsDir, 'marketplaces', marketplace.path);
  }

  // For git/url sources, Claude Code caches them in the marketplaces directory
  // This assumes Claude Code has already cloned/synced the marketplace
  return join(claudePluginsDir, 'marketplaces', marketplace.name);
}

/**
 * Convert Claude Code marketplace to AIPM marketplace format
 */
export function convertClaudeMarketplaceToAIPM(marketplace: ClaudeMarketplaceEntry) {
  const path = getClaudeCodeMarketplacePath(marketplace);

  return {
    source: marketplace.source,
    url: marketplace.url,
    path: marketplace.source === 'directory' ? path : undefined,
    branch: marketplace.branch,
  };
}
