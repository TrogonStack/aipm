/**
 * File and directory names
 */
export const DIR_CURSOR = '.cursor' as const;
export const DIR_CLAUDE = '.claude' as const;
export const DIR_CLAUDE_PLUGIN = '.claude-plugin' as const;
export const DIR_MARKETPLACE = 'marketplace' as const;
export const DIR_CACHE = 'cache' as const;
export const DIR_AIPM_NAMESPACE = 'aipm' as const;

/**
 * Plugin subdirectory types
 */
export const PLUGIN_SUBDIRS = ['commands', 'rules', 'agents', 'skills', 'hooks'] as const;
export type PluginSubdir = (typeof PLUGIN_SUBDIRS)[number];

/**
 * Individual subdirectory names (for direct reference)
 */
export const DIR_SKILLS = 'skills' as const;
export const DIR_HOOKS = 'hooks' as const;

/**
 * Project-level AIPM directory
 */
export const DIR_AIPM = '.aipm' as const;
export const FILE_AIPM_CONFIG = 'config.json' as const;
export const FILE_AIPM_CONFIG_LOCAL = 'config.local.json' as const;

/**
 * Global AIPM directory name (used within XDG directories)
 */
export const AIPM_GLOBAL_DEFAULT = 'aipm' as const;

/**
 * Configuration file names
 */
export const FILE_GLOBAL_CONFIG = 'config.json' as const;
export const FILE_MARKETPLACE_MANIFEST = 'marketplace.json' as const;
export const FILE_PLUGIN_MANIFEST = 'plugin.json' as const;
export const FILE_GITIGNORE = '.gitignore' as const;

/**
 * Claude Code file names
 */
export const FILE_CLAUDE_KNOWN_MARKETPLACES = 'known_marketplaces.json' as const;
export const FILE_CLAUDE_INSTALLED_PLUGINS = 'installed_plugins.json' as const;
export const FILE_CLAUDE_CONFIG = 'config.json' as const;

/**
 * Environment variables
 */
export const ENV_HOME = 'HOME' as const;
export const ENV_USERPROFILE = 'USERPROFILE' as const;

/**
 * Hook-related constants
 */
export const CLAUDE_PLUGIN_ROOT_VAR = '${CLAUDE_PLUGIN_ROOT}' as const;
export const FILE_HOOKS_JSON = 'hooks.json' as const;
export const AIPM_HOOK_PREFIX = 'aipm' as const;
export const HOOK_MANAGED_BY_FIELD = 'x-managedBy' as const;
export const HOOK_ID_FIELD = 'x-hookId' as const;

/**
 * Integration configuration constants
 */
export const INTEGRATION_INCLUDE_ALL = 'all' as const;
