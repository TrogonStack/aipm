import { join } from 'node:path';
import { DIR_CURSOR, DIR_MARKETPLACE, ENV_AIPM_GLOBAL_DIR, ENV_HOME, ENV_USERPROFILE } from '../constants';

export function getGlobalDir(override?: string): string {
  if (override) {
    return override;
  }

  if (process.env[ENV_AIPM_GLOBAL_DIR]) {
    return process.env[ENV_AIPM_GLOBAL_DIR];
  }

  const homeDir = process.env[ENV_HOME] || process.env[ENV_USERPROFILE];
  if (!homeDir) {
    throw new Error('Could not determine home directory');
  }

  return join(homeDir, DIR_CURSOR, DIR_MARKETPLACE);
}
