import { homedir } from 'node:os';
import { join } from 'node:path';
import { DIR_CACHE } from '../constants';
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
 * Get the global config directory for AIPM
 * Follows XDG Base Directory Specification
 * - Linux/macOS: $XDG_CONFIG_HOME/aipm (default: ~/.config/aipm)
 * - Windows: %APPDATA%\aipm
 */
export function getGlobalDir(override?: string): string {
  if (override) {
    return override;
  }

  const env = getEnv();
  const homeDir = homedir();

  // Windows: Use APPDATA or fallback to homeDir\aipm
  if (process.platform === 'win32') {
    if (env.APPDATA) {
      return join(env.APPDATA, 'aipm');
    }
    // Fallback for Windows when APPDATA is not set
    return join(homeDir, 'aipm');
  }

  // Linux/macOS: Use XDG_CONFIG_HOME with fallback to ~/.config
  const configHome = env.XDG_CONFIG_HOME || join(homeDir, '.config');
  return join(configHome, 'aipm');
}

/**
 * Get the global cache directory for git marketplaces
 * Follows XDG Base Directory Specification
 * - Linux/macOS: $XDG_CACHE_HOME/aipm (default: ~/.cache/aipm)
 * - Windows: %LOCALAPPDATA%\aipm\cache
 */
export function getGlobalCacheDir(override?: string): string {
  if (override) {
    return join(override, DIR_CACHE);
  }

  const env = getEnv();
  const homeDir = homedir();

  // Windows: Use LOCALAPPDATA or fallback to homeDir\aipm\cache
  if (process.platform === 'win32') {
    if (env.LOCALAPPDATA) {
      return join(env.LOCALAPPDATA, 'aipm', DIR_CACHE);
    }
    // Fallback for Windows when LOCALAPPDATA is not set
    return join(homeDir, 'aipm', DIR_CACHE);
  }

  // Linux/macOS: Use XDG_CACHE_HOME with fallback to ~/.cache
  const cacheHome = env.XDG_CACHE_HOME || join(homeDir, '.cache');
  return join(cacheHome, 'aipm');
}
