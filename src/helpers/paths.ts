import { join } from 'node:path';

export function getGlobalDir(override?: string): string {
  if (override) {
    return override;
  }

  if (process.env.AIPM_GLOBAL_DIR) {
    return process.env.AIPM_GLOBAL_DIR;
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    throw new Error('Could not determine home directory');
  }

  return join(homeDir, '.cursor', 'marketplace');
}
