/**
 * File and directory names
 */
export const DIR_CURSOR = '.cursor';
export const DIR_CLAUDE = '.claude';
export const DIR_CLAUDE_PLUGIN = '.claude-plugin';
export const DIR_MARKETPLACE = 'marketplace';
export const DIR_CACHE = 'cache';
export const DIR_AIPM_NAMESPACE = 'aipm';

/**
 * Plugin subdirectory types
 */
export const PLUGIN_SUBDIRS = ['commands', 'rules', 'agents', 'skills', 'hooks'] as const;
export type PluginSubdir = (typeof PLUGIN_SUBDIRS)[number];

/**
 * Individual subdirectory names (for direct reference)
 */
export const DIR_SKILLS = 'skills' as const;

/**
 * Project-level AIPM directory
 */
export const DIR_AIPM = '.aipm';
export const FILE_AIPM_CONFIG = 'config.json';
export const FILE_AIPM_CONFIG_LOCAL = 'config.local.json';

/**
 * Global AIPM directory name (used within XDG directories)
 */
export const AIPM_GLOBAL_DEFAULT = 'aipm';

/**
 * Configuration file names
 */
export const FILE_GLOBAL_CONFIG = 'config.json';
export const FILE_MARKETPLACE_MANIFEST = 'marketplace.json';
export const FILE_PLUGIN_MANIFEST = 'plugin.json';
export const FILE_GITIGNORE = '.gitignore';

/**
 * Claude Code file names
 */
export const FILE_CLAUDE_KNOWN_MARKETPLACES = 'known_marketplaces.json';
export const FILE_CLAUDE_INSTALLED_PLUGINS = 'installed_plugins.json';
export const FILE_CLAUDE_CONFIG = 'config.json';

/**
 * Environment variables
 */
export const ENV_HOME = 'HOME';
export const ENV_USERPROFILE = 'USERPROFILE';
