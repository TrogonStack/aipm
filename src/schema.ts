import { z } from 'zod';
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

export const PluginsConfigSchema = z.object({
  marketplaces: z.record(z.string(), MarketplaceSourceSchema),
  plugins: z.record(z.string(), PluginConfigSchema),
});

export const GlobalMarketplaceConfigSchema = z.object({
  marketplaces: z.record(z.string(), MarketplaceSourceSchema).optional(),
  plugins: z.record(z.string(), PluginConfigSchema).optional(),
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
 */
export const ProcessEnvSchema = z.object({
  /**
   * Override the global AIPM directory
   * Default: ~/.cursor/marketplace
   */
  AIPM_GLOBAL_DIR: z.string().optional(),

  /**
   * User's home directory (Unix/Mac)
   */
  HOME: z.string().optional(),

  /**
   * User's home directory (Windows)
   */
  USERPROFILE: z.string().optional(),
});

export type ProcessEnv = z.infer<typeof ProcessEnvSchema>;
