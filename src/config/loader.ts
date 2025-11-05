import { join } from 'node:path';
import {
  DIR_CURSOR,
  FILE_GITIGNORE,
  FILE_GLOBAL_CONFIG,
  FILE_PLUGINS_CONFIG,
  FILE_PLUGINS_EXAMPLE,
  FILE_PLUGINS_LOCAL,
} from '../constants';
import {
  convertClaudeMarketplaceToAIPM,
  isClaudeCodeInstalled,
  readClaudeCodeMarketplaces,
} from '../helpers/claude-code-config';
import { fileExists } from '../helpers/fs';
import { getGlobalDir } from '../helpers/paths';
import type { PluginsConfig } from '../schema';
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
): Promise<{ marketplaces: Record<string, any>; plugins: Record<string, any> }> {
  try {
    const file = Bun.file(path);
    const rawConfig = await file.json();

    const parseResult = PluginsConfigSchema.partial().safeParse(rawConfig);
    if (!parseResult.success) {
      const error = new ConfigValidationError(path, { cause: parseResult.error });
      if (options.ignoreValidationErrors) {
        return { marketplaces: {}, plugins: {} };
      }
      throw error;
    }

    return {
      marketplaces: parseResult.data.marketplaces || {},
      plugins: parseResult.data.plugins || {},
    };
  } catch (error) {
    if (error instanceof ConfigValidationError && !options.ignoreValidationErrors) {
      throw error;
    }
    return { marketplaces: {}, plugins: {} };
  }
}

export async function loadPluginsConfig(baseDir: string): Promise<PluginsConfig | null> {
  const configPath = join(baseDir, DIR_CURSOR, FILE_PLUGINS_CONFIG);
  const localConfigPath = join(baseDir, DIR_CURSOR, FILE_PLUGINS_LOCAL);

  try {
    const file = Bun.file(configPath);
    const rawConfig = await file.json();

    const parseResult = PluginsConfigSchema.safeParse(rawConfig);
    if (!parseResult.success) {
      throw new ConfigValidationError(configPath, { cause: parseResult.error });
    }

    const config = parseResult.data;

    const globalDir = getGlobalDir();
    const globalConfigPath = join(globalDir, FILE_GLOBAL_CONFIG);
    const globalConfigExists = await fileExists(globalConfigPath);

    const { marketplaces: globalMarketplaces, plugins: globalPlugins } = globalConfigExists
      ? await loadOptionalConfig(globalConfigPath, { ignoreValidationErrors: true })
      : { marketplaces: {}, plugins: {} };

    const { marketplaces: localMarketplaces, plugins: localPlugins } = await loadOptionalConfig(localConfigPath);

    const claudeMarketplaces: Record<string, ReturnType<typeof convertClaudeMarketplaceToAIPM>> = {};
    if (await isClaudeCodeInstalled()) {
      const claudeCodeMarketplaces = await readClaudeCodeMarketplaces();

      for (const marketplace of claudeCodeMarketplaces) {
        const prefixedName = `claude:${marketplace.name}`;

        if (globalMarketplaces[prefixedName] || config.marketplaces[prefixedName] || localMarketplaces[prefixedName]) {
          console.warn(
            `⚠️  Skipping Claude Code marketplace '${prefixedName}' - name conflict with existing AIPM marketplace`,
          );
          continue;
        }

        claudeMarketplaces[prefixedName] = convertClaudeMarketplaceToAIPM(marketplace);
      }
    }

    return {
      marketplaces: {
        ...globalMarketplaces,
        ...config.marketplaces,
        ...localMarketplaces,
        ...claudeMarketplaces,
      },
      plugins: {
        ...globalPlugins,
        ...config.plugins,
        ...localPlugins,
      },
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw error;
    }
    return null;
  }
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
