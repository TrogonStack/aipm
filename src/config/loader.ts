import { join } from 'node:path';
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
  const configPath = join(baseDir, '.cursor', 'plugins.json');
  const localConfigPath = join(baseDir, '.cursor', 'plugins.local.json');

  try {
    const file = Bun.file(configPath);
    const rawConfig = await file.json();

    const parseResult = PluginsConfigSchema.safeParse(rawConfig);
    if (!parseResult.success) {
      throw new ConfigValidationError(configPath, { cause: parseResult.error });
    }

    const config = parseResult.data;

    const globalDir = getGlobalDir();
    const globalConfigPath = join(globalDir, 'config.json');
    const globalConfigExists = await fileExists(globalConfigPath);

    const { marketplaces: globalMarketplaces, plugins: globalPlugins } = globalConfigExists
      ? await loadOptionalConfig(globalConfigPath, { ignoreValidationErrors: true })
      : { marketplaces: {}, plugins: {} };

    const { marketplaces: localMarketplaces, plugins: localPlugins } = await loadOptionalConfig(localConfigPath);

    return {
      marketplaces: {
        ...globalMarketplaces,
        ...config.marketplaces,
        ...localMarketplaces,
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
    cursor: join(baseDir, '.cursor'),
    plugins: join(baseDir, '.cursor', 'plugins.json'),
    pluginsLocal: join(baseDir, '.cursor', 'plugins.local.json'),
    pluginsExample: join(baseDir, '.cursor', 'plugins.local.json.example'),
    gitignore: join(baseDir, '.gitignore'),
  };
}
