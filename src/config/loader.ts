import merge from 'lodash.merge';
import { join } from 'node:path';
import { DIR_AIPM, FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL, FILE_GITIGNORE } from '../constants';
import { isFileNotFoundError } from '../errors';
import { loadAIPMConfig, loadAIPMLocalConfig } from '../helpers/aipm-config';
import {
  convertClaudeMarketplaceToAIPM,
  getClaudeCodePluginsDir,
  isClaudeCodeInstalled,
  readClaudeCodeMarketplaces,
} from '../helpers/claude-code-config';
import { fileExists } from '../helpers/fs';
import { getGlobalDir } from '../helpers/paths';
import type { MarketplaceSource, PluginsConfig } from '../schema';
import { PluginsConfigSchema } from '../schema';

/**
 * Get the relative path for a config file
 */
export function getConfigPath(fileName: string): string {
  return `${DIR_AIPM}/${fileName}`;
}

/**
 * Get a formatted error message for missing config files
 */
export function getNotInitializedMessage(): string {
  return `No ${getConfigPath(FILE_AIPM_CONFIG)} or ${getConfigPath(FILE_AIPM_CONFIG_LOCAL)} found. Run 'aipm init' first.`;
}

export class ConfigValidationError extends Error {
  constructor(
    public readonly filePath: string,
    options?: ErrorOptions,
  ) {
    super('Config validation failed', options);
    this.name = 'ConfigValidationError';
  }
}

async function loadOptionalConfig(
  path: string,
  options: { ignoreValidationErrors?: boolean } = {},
): Promise<{ config: PluginsConfig; path: string | null }> {
  try {
    const file = Bun.file(path);
    const rawConfig = await file.json();

    const parseResult = PluginsConfigSchema.partial().safeParse(rawConfig);
    if (!parseResult.success) {
      const error = new ConfigValidationError(path, { cause: parseResult.error });
      if (options.ignoreValidationErrors) {
        return { config: { marketplaces: {}, plugins: {} }, path: null };
      }
      throw error;
    }

    return {
      config: {
        marketplaces: parseResult.data.marketplaces || {},
        plugins: parseResult.data.plugins || {},
        ...(parseResult.data.integrations ? { integrations: parseResult.data.integrations } : {}),
      },
      path,
    };
  } catch (error) {
    if (error instanceof ConfigValidationError && !options.ignoreValidationErrors) {
      throw error;
    }
    if (isFileNotFoundError(error)) {
      return { config: { marketplaces: {}, plugins: {} }, path: null };
    }
    return { config: { marketplaces: {}, plugins: {} }, path: null };
  }
}

export type PluginsConfigWithMetadata = {
  config: PluginsConfig;
  sources: {
    project: string | null;
    global: string | null;
    local: string | null;
    claude: string | null;
  };
};

export async function loadPluginsConfig(baseDir: string): Promise<PluginsConfigWithMetadata> {
  const paths = getConfigPaths(baseDir);

  const projectConfig = await loadAIPMConfig(baseDir);
  const projectConfigPath = projectConfig !== null ? paths.aipmConfig : null;

  const localConfig = await loadAIPMLocalConfig(baseDir);
  const localConfigPath = (await fileExists(paths.aipmConfigLocal)) ? paths.aipmConfigLocal : null;

  const globalDir = getGlobalDir();
  const globalConfigPath = join(globalDir, FILE_AIPM_CONFIG);
  const { config: globalConfig, path: globalConfigPathResult } = await loadOptionalConfig(globalConfigPath, {
    ignoreValidationErrors: true,
  });

  const claudeMarketplaces: Record<string, MarketplaceSource> = {};
  let claudeConfigPath: string | null = null;
  if (await isClaudeCodeInstalled()) {
    const claudeCodeMarketplaces = await readClaudeCodeMarketplaces();

    for (const [marketplaceName, marketplaceConfig] of Object.entries(claudeCodeMarketplaces)) {
      const prefixedName = `claude/${marketplaceName}`;

      if (
        globalConfig.marketplaces[prefixedName] ||
        projectConfig?.marketplaces[prefixedName] ||
        localConfig.marketplaces[prefixedName]
      ) {
        console.warn(`⚠️  Skipping Claude Code marketplace '${prefixedName}' - name conflict`);
        continue;
      }

      claudeMarketplaces[prefixedName] = convertClaudeMarketplaceToAIPM(
        marketplaceName,
        marketplaceConfig,
      ) as MarketplaceSource;

      if (claudeConfigPath === null) {
        claudeConfigPath = getClaudeCodePluginsDir();
      }
    }
  }

  // 6. Deep merge configs using lodash.merge (priority: local > project > global > claude)
  const mergedConfig = merge({}, { marketplaces: claudeMarketplaces }, globalConfig, projectConfig ?? {}, localConfig);

  return {
    config: mergedConfig,
    sources: {
      project: projectConfigPath,
      global: globalConfigPathResult,
      local: localConfigPath,
      claude: claudeConfigPath,
    },
  };
}

export function getConfigPaths(baseDir: string) {
  return {
    // Project-level AIPM configs
    aipm: join(baseDir, DIR_AIPM),
    aipmConfig: join(baseDir, DIR_AIPM, FILE_AIPM_CONFIG),
    aipmConfigLocal: join(baseDir, DIR_AIPM, FILE_AIPM_CONFIG_LOCAL),

    // Utility paths
    gitignore: join(baseDir, FILE_GITIGNORE),
  };
}

function accumulateClaudeMarketplace(
  acc: Record<string, MarketplaceSource>,
  [marketplaceName, marketplaceConfig]: [string, unknown],
): Record<string, MarketplaceSource> {
  const prefixedName = `claude/${marketplaceName}`;
  acc[prefixedName] = convertClaudeMarketplaceToAIPM(marketplaceName, marketplaceConfig as never);
  return acc;
}

/**
 * Load Claude Code's marketplaces without requiring AIPM config
 */
export async function loadClaudeCodeMarketplaces(): Promise<Record<string, MarketplaceSource>> {
  if (!(await isClaudeCodeInstalled())) {
    return {};
  }

  const claudeCodeMarketplaces = await readClaudeCodeMarketplaces();

  return Object.entries(claudeCodeMarketplaces).reduce(
    accumulateClaudeMarketplace,
    {} as Record<string, MarketplaceSource>,
  );
}
