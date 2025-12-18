import { z } from 'zod';
import { AIPM_HOOK_PREFIX } from './constants';
import type { IO } from './helpers/io';

export const MarketplaceSourceSchema = z.object({
  source: z.enum(['git', 'directory', 'url']),
  url: z.string().optional(),
  path: z.string().optional(),
  branch: z.string().optional(),
});

export const MarketplaceTypeSchema = z.enum(['aipm', 'claude']);

export const MarketplaceOwnerSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
});

export const MarketplaceMetadataSchema = z.object({
  description: z.string().optional(),
  version: z.string().optional(),
});

export const MarketplacePluginEntrySchema = z.object({
  name: z.string(),
  source: z.string(),
  description: z.string().optional(),
  version: z.string().optional(),
  author: z
    .object({
      name: z.string(),
      email: z.string().optional(),
    })
    .optional(),
  skills: z.array(z.string()).optional(),
  strict: z.boolean().optional(),
});

export const MarketplaceManifestSchema = z.object({
  name: z.string(),
  owner: MarketplaceOwnerSchema,
  metadata: MarketplaceMetadataSchema.optional(),
  plugins: z.array(MarketplacePluginEntrySchema),
});

export const PluginManifestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  author: z.union([
    z.string(),
    z.object({
      name: z.string(),
      email: z.string().optional(),
    }),
  ]),
  homepage: z.string().optional(),
  repository: z.string().optional(),
});

export const PluginConfigSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(['global', 'project']).optional(),
  version: z.string().optional(),
});

export const IntegrationIncludeSchema = z.object({
  commands: z.boolean().optional(),
  rules: z.boolean().optional(),
  agents: z.boolean().optional(),
  skills: z.boolean().optional(),
  hooks: z.boolean().optional(),
});

export const IntegrationConfigSchema = z.object({
  enabled: z.boolean().optional(),
  include: z.union([z.literal('all'), IntegrationIncludeSchema]).optional(),
});

export const IntegrationsSchema = z.object({
  cursor: IntegrationConfigSchema.optional(),
});

export const PluginsConfigSchema = z.object({
  marketplaces: z.record(z.string(), MarketplaceSourceSchema),
  plugins: z.record(z.string(), PluginConfigSchema),
  integrations: IntegrationsSchema.optional(),
});

export const GlobalMarketplaceConfigSchema = z.object({
  marketplaces: z.record(z.string(), MarketplaceSourceSchema).optional(),
  plugins: z.record(z.string(), PluginConfigSchema).optional(),
  integrations: IntegrationsSchema.optional(),
});

export type MarketplaceSource = z.infer<typeof MarketplaceSourceSchema>;
export type MarketplaceType = z.infer<typeof MarketplaceTypeSchema>;
export type MarketplaceMetadata = z.infer<typeof MarketplaceMetadataSchema>;
export type MarketplaceOwner = z.infer<typeof MarketplaceOwnerSchema>;
export type MarketplacePluginEntry = z.infer<typeof MarketplacePluginEntrySchema>;
export type MarketplaceManifest = z.infer<typeof MarketplaceManifestSchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type PluginConfig = z.infer<typeof PluginConfigSchema>;
export type PluginsConfig = z.infer<typeof PluginsConfigSchema>;
export type GlobalMarketplaceConfig = z.infer<typeof GlobalMarketplaceConfigSchema>;

export type InitOptions = {
  global?: boolean;
  force?: boolean;
  example?: boolean;
  cwd?: string;
  globalDir?: string;
  skipConfirm?: boolean;
  dryRun?: boolean;
  io?: IO;
};

/**
 * Schema for AIPM environment variables
 *
 * Simple validation schema - all defaults and platform-specific logic
 * are handled by path helpers, not in the schema.
 */
export const ProcessEnvSchema = z.object({
  /**
   * User's home directory (Unix/Mac/Windows)
   */
  HOME: z.string().optional(),

  /**
   * User's home directory (Windows)
   */
  USERPROFILE: z.string().optional(),

  /**
   * XDG Base Directory: Config home (Unix/Mac)
   */
  XDG_CONFIG_HOME: z.string().optional(),

  /**
   * XDG Base Directory: Cache home (Unix/Mac)
   */
  XDG_CACHE_HOME: z.string().optional(),

  /**
   * Windows: Roaming application data
   */
  APPDATA: z.string().optional(),

  /**
   * Windows: Local application data
   */
  LOCALAPPDATA: z.string().optional(),
});

export type ProcessEnv = z.infer<typeof ProcessEnvSchema>;

/**
 * Schema for Claude Code hooks.json format
 */
export const ClaudeCodeHookSchema = z.object({
  description: z.string().optional(),
  hooks: z.record(
    z.string(),
    z.array(
      z.object({
        matcher: z.string().optional(),
        hooks: z.array(
          z.object({
            type: z.string(),
            command: z.string(),
            timeout: z.number().optional(),
          }),
        ),
      }),
    ),
  ),
});

/**
 * Schema for AIPM-managed hooks (strict validation)
 * Use this for validating hooks that we create
 */
export const AipmManagedHookSchema = z.object({
  'x-managedBy': z.literal(AIPM_HOOK_PREFIX),
  'x-hookId': z.string(),
  command: z.string(),
});

/**
 * Schema for user hooks (flexible validation - allows any hook structure)
 * User hooks must be objects with at least a command, but can have any additional properties
 */
export const UserHookSchema = z.object({ command: z.string() }).loose();

/**
 * Schema for validating individual hooks during parsing
 * Accepts any JSON value to handle malformed entries gracefully during validation
 * This is used ONLY for validation, not for TypeScript types
 */
const CursorHookValidationSchema = z.union([
  AipmManagedHookSchema,
  UserHookSchema,
  z.null(), // Allow null entries (will be filtered out)
  z.string(), // Allow primitive types (will be filtered out)
  z.number(),
  z.boolean(),
  z.array(z.unknown()), // Allow arrays (will be filtered out)
]);

/**
 * TypeScript type for valid hooks (union of AIPM and user hooks only)
 * Does NOT include primitives/malformed data
 */
export type CursorHook = AipmManagedHook | UserHook;

/**
 * Schema for Cursor hooks.json configuration file
 * Supports mixed hooks (both AIPM-managed and user-defined)
 * Uses flexible validation to handle malformed entries gracefully
 */
export const CursorHooksConfigSchema = z.object({
  version: z.literal(1),
  hooks: z.record(z.string(), z.array(CursorHookValidationSchema)),
});

/**
 * TypeScript type for CursorHooksConfig
 * Uses the strict CursorHook type (not the validation schema)
 */
export type CursorHooksConfig = {
  version: 1;
  hooks: Record<string, CursorHook[]>;
};

export type ClaudeCodeHook = z.infer<typeof ClaudeCodeHookSchema>;
export type AipmManagedHook = z.infer<typeof AipmManagedHookSchema>;
export type UserHook = z.infer<typeof UserHookSchema>;
