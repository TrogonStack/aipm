import { join } from 'node:path';
import { DIR_AIPM, FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL } from '../constants';
import type { PluginsConfig } from '../schema';
import { PluginsConfigSchema } from '../schema';
import { ensureDir, fileExists } from './fs';

/**
 * Get the project .aipm directory path
 */
export function getAIPMDir(baseDir: string): string {
  return join(baseDir, DIR_AIPM);
}

/**
 * Ensure .aipm directory exists
 */
export async function ensureAIPMDir(baseDir: string): Promise<void> {
  const aipmDir = getAIPMDir(baseDir);
  await ensureDir(aipmDir);
}

/**
 * Load AIPM project config (.aipm/config.json)
 * Returns null if file doesn't exist
 */
export async function loadAIPMConfig(baseDir: string): Promise<PluginsConfig | null> {
  const configPath = join(getAIPMDir(baseDir), FILE_AIPM_CONFIG);

  if (!(await fileExists(configPath))) {
    return null;
  }

  const file = Bun.file(configPath);
  const rawConfig = await file.json(); // Let JSON parse errors throw

  const parseResult = PluginsConfigSchema.safeParse(rawConfig);

  if (!parseResult.success) {
    const { ConfigValidationError } = await import('../config/loader');
    throw new ConfigValidationError(configPath, { cause: parseResult.error });
  }

  return parseResult.data;
}

/**
 * Load AIPM local config (.aipm/config.local.json)
 * Returns empty config if file doesn't exist
 */
export async function loadAIPMLocalConfig(baseDir: string): Promise<PluginsConfig> {
  const configPath = join(getAIPMDir(baseDir), FILE_AIPM_CONFIG_LOCAL);

  if (!(await fileExists(configPath))) {
    return { marketplaces: {}, plugins: {} };
  }

  try {
    const file = Bun.file(configPath);
    const rawConfig = await file.json();
    const parseResult = PluginsConfigSchema.partial().safeParse(rawConfig);

    if (!parseResult.success) {
      console.warn('[AIPM] Invalid local config format:', parseResult.error.message);
      return { marketplaces: {}, plugins: {} };
    }

    return {
      marketplaces: parseResult.data.marketplaces || {},
      plugins: parseResult.data.plugins || {},
      ...(parseResult.data.integrations ? { integrations: parseResult.data.integrations } : {}),
    };
  } catch (error) {
    console.warn('[AIPM] Failed to load local config:', error);
    return { marketplaces: {}, plugins: {} };
  }
}

/**
 * Save AIPM project config (.aipm/config.json)
 */
export async function saveAIPMConfig(baseDir: string, config: PluginsConfig): Promise<void> {
  await ensureAIPMDir(baseDir);
  const configPath = join(getAIPMDir(baseDir), FILE_AIPM_CONFIG);
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}

/**
 * Save AIPM local config (.aipm/config.local.json)
 */
export async function saveAIPMLocalConfig(baseDir: string, config: PluginsConfig): Promise<void> {
  await ensureAIPMDir(baseDir);
  const configPath = join(getAIPMDir(baseDir), FILE_AIPM_CONFIG_LOCAL);
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}

/**
 * Load the target config file (project or local) without merging
 */
export async function loadTargetConfig(baseDir: string, local: boolean = false): Promise<PluginsConfig> {
  if (local) {
    return await loadAIPMLocalConfig(baseDir);
  }
  const projectConfig = await loadAIPMConfig(baseDir);
  return projectConfig ?? { marketplaces: {}, plugins: {} };
}

/**
 * Save config to .aipm/ directory
 */
export async function saveConfig(baseDir: string, config: PluginsConfig, local: boolean = false): Promise<void> {
  if (local) {
    await saveAIPMLocalConfig(baseDir, config);
  } else {
    await saveAIPMConfig(baseDir, config);
  }
}
