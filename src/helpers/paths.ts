import { join } from 'node:path';
import { AIPM_GLOBAL_DEFAULT, DIR_CACHE } from '../constants';
import { ProcessEnvSchema, type ProcessEnv } from '../schema';

/**
 * Cached environment variables (lazy initialization)
 */
let cachedEnv: ProcessEnv | null = null;

/**
 * Get validated environment variables (cached for performance)
 * Parses process.env once on first call, then returns cached result
 */
export function getEnv(): ProcessEnv {
  if (cachedEnv !== null) {
    return cachedEnv;
  }

  // parse() throws on validation failure
  cachedEnv = ProcessEnvSchema.parse(process.env);
  return cachedEnv;
}

/**
 * Reset cached environment variables
 * Used by tests when modifying process.env
 * @internal
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}

/**
 * Get the home directory from environment variables
 * Throws if neither HOME nor USERPROFILE is set
 */
export function getHomeDir(): string {
  const env = getEnv();
  const homeDir = env.HOME || env.USERPROFILE;

  if (!homeDir) {
    throw new Error('Could not determine home directory: HOME and USERPROFILE are not set');
  }

  return homeDir;
}

/**
 * Get the global directory for AIPM
 * Defaults to ~/.aipm
 */
export function getGlobalDir(override?: string): string {
  if (override) {
    return override;
  }

  const env = getEnv();
  if (env.AIPM_GLOBAL_DIR) {
    return env.AIPM_GLOBAL_DIR;
  }

  const homeDir = getHomeDir();
  return join(homeDir, AIPM_GLOBAL_DEFAULT); // ~/.aipm
}

/**
 * Get the global cache directory for git marketplaces
 */
export function getGlobalCacheDir(override?: string): string {
  const globalDir = getGlobalDir(override);
  return join(globalDir, DIR_CACHE); // ~/.aipm/cache/
}
