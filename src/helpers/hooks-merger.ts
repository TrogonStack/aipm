import { join } from 'node:path';
import { FILE_HOOKS_JSON } from '../constants';
import type { CursorHooksConfig } from '../schema';
import { AipmManagedHookSchema, CursorHooksConfigSchema, UserHookSchema } from '../schema';
import { fileExists, readJsonFile, writeJsonFile } from './fs';
import { defaultIO } from './io';

/**
 * Read existing Cursor hooks.json file
 *
 * @param cursorDir - The .cursor directory path
 * @returns Existing hooks configuration or null if file doesn't exist
 */
export async function readExistingHooks(cursorDir: string): Promise<CursorHooksConfig | null> {
  const hooksPath = join(cursorDir, FILE_HOOKS_JSON);

  if (!(await fileExists(hooksPath))) {
    return null;
  }

  try {
    // Validation schema accepts malformed data for resilience, cast to strict type after validation
    const hooksConfig = await readJsonFile(hooksPath, CursorHooksConfigSchema);
    return hooksConfig as CursorHooksConfig;
  } catch (error) {
    defaultIO.logInfo(`⚠️  Invalid ${FILE_HOOKS_JSON} format - will create new file: ${error}`);
    return null;
  }
}

/**
 * Preserve user hooks (hooks not managed by AIPM) and merge AIPM hooks
 *
 * @param existingHooks - Existing hooks configuration (may be null)
 * @param aipmHooks - Array of AIPM-managed hook configurations to merge
 * @returns Merged hooks configuration
 */
export function preserveUserHooks(
  existingHooks: CursorHooksConfig | null,
  aipmHooks: CursorHooksConfig[],
): CursorHooksConfig {
  const result: CursorHooksConfig = {
    version: 1,
    hooks: {},
  };

  if (existingHooks) {
    for (const [eventName, hooks] of Object.entries(existingHooks.hooks)) {
      const userHooks = hooks.filter((hook) => {
        // safeParse returns success=false for malformed entries (null, primitives, arrays)
        const aipmParseResult = AipmManagedHookSchema.safeParse(hook);

        if (aipmParseResult.success) {
          return false;
        }

        const userParseResult = UserHookSchema.safeParse(hook);
        return userParseResult.success;
      });

      if (userHooks.length > 0) {
        result.hooks[eventName] = [...(result.hooks[eventName] || []), ...userHooks];
      }
    }
  }

  for (const aipmHookConfig of aipmHooks) {
    for (const [eventName, hooks] of Object.entries(aipmHookConfig.hooks)) {
      if (!result.hooks[eventName]) {
        result.hooks[eventName] = [];
      }
      result.hooks[eventName].push(...hooks);
    }
  }

  return result;
}

/**
 * Merge hooks from multiple plugins into a single .cursor/hooks.json file
 *
 * @param cursorDir - The .cursor directory path
 * @param pluginHooks - Array of hook configurations from enabled plugins
 */
export async function mergeHooks(cursorDir: string, pluginHooks: CursorHooksConfig[]): Promise<void> {
  const existingHooks = await readExistingHooks(cursorDir);
  const mergedHooks = preserveUserHooks(existingHooks, pluginHooks);
  const hooksPath = join(cursorDir, FILE_HOOKS_JSON);
  await writeJsonFile(hooksPath, mergedHooks);
}
