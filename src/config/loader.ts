import { join } from 'node:path';
import {
  DIR_CURSOR,
  FILE_GITIGNORE,
  FILE_GLOBAL_CONFIG,
  FILE_PLUGINS_CONFIG,
  FILE_PLUGINS_EXAMPLE,
  FILE_PLUGINS_LOCAL,
} from '../constants';
import { isFileNotFoundError } from '../errors';
import {
  convertClaudeMarketplaceToAIPM,
  getClaudeCodePluginsDir,
  isClaudeCodeInstalled,
  readClaudeCodeMarketplaces,
} from '../helpers/claude-code-config';
import { getGlobalDir } from '../helpers/paths';
import type { MarketplaceSource, PluginsConfig } from '../schema';
import { PluginsConfigSchema } from '../schema';

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

async function loadProjectConfig(configPath: string): Promise<PluginsConfig | null> {
  try {
    const file = Bun.file(configPath);
    const rawConfig = await file.json();

    const parseResult = PluginsConfigSchema.safeParse(rawConfig);
    if (!parseResult.success) {
      throw new ConfigValidationError(configPath, { cause: parseResult.error });
    }

    return parseResult.data;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }
    // File doesn't exist - return null so caller can check other sources
    if (isFileNotFoundError(error)) {
      return null;
    }
    // Other errors should be thrown
    throw error;
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
  const configPath = join(baseDir, DIR_CURSOR, FILE_PLUGINS_CONFIG);
  const localConfigPath = join(baseDir, DIR_CURSOR, FILE_PLUGINS_LOCAL);

  const config = await loadProjectConfig(configPath);
  const projectConfigPath = config !== null ? configPath : null;

  const globalDir = getGlobalDir();
  const globalConfigPath = join(globalDir, FILE_GLOBAL_CONFIG);

  const { config: globalConfig, path: globalConfigPathResult } = await loadOptionalConfig(globalConfigPath, {
    ignoreValidationErrors: true,
  });

  const { config: localConfig, path: localConfigPathResult } = await loadOptionalConfig(localConfigPath);

  const claudeMarketplaces: Record<string, MarketplaceSource> = {};
  let claudeConfigPath: string | null = null;
  if (await isClaudeCodeInstalled()) {
    const claudeCodeMarketplaces = await readClaudeCodeMarketplaces();

    for (const [marketplaceName, marketplaceConfig] of Object.entries(claudeCodeMarketplaces)) {
      const prefixedName = `claude:${marketplaceName}`;

      if (
        globalConfig.marketplaces[prefixedName] ||
        config?.marketplaces[prefixedName] ||
        localConfig.marketplaces[prefixedName]
      ) {
        console.warn(
          `⚠️  Skipping Claude Code marketplace '${prefixedName}' - name conflict with existing AIPM marketplace`,
        );
        continue;
      }

      claudeMarketplaces[prefixedName] = convertClaudeMarketplaceToAIPM(
        marketplaceName,
        marketplaceConfig,
      ) as MarketplaceSource;
      // Claude Code config is loaded from Claude Code's plugins directory
      if (claudeConfigPath === null) {
        claudeConfigPath = getClaudeCodePluginsDir();
      }
    }
  }

  return {
    config: {
      marketplaces: {
        ...globalConfig.marketplaces,
        ...(config?.marketplaces ?? {}),
        ...localConfig.marketplaces,
        ...claudeMarketplaces,
      },
      plugins: {
        ...globalConfig.plugins,
        ...(config?.plugins ?? {}),
        ...localConfig.plugins,
      },
    },
    sources: {
      project: projectConfigPath,
      global: globalConfigPathResult,
      local: localConfigPathResult,
      claude: claudeConfigPath,
    },
  };
}

export function getConfigPaths(baseDir: string) {
  return {
    cursor: join(baseDir, DIR_CURSOR),
    plugins: join(baseDir, DIR_CURSOR, FILE_PLUGINS_CONFIG),
    pluginsLocal: join(baseDir, DIR_CURSOR, FILE_PLUGINS_LOCAL),
    pluginsExample: join(baseDir, DIR_CURSOR, FILE_PLUGINS_EXAMPLE),
    gitignore: join(baseDir, FILE_GITIGNORE),
  };
}
