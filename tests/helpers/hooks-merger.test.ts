import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FILE_HOOKS_JSON } from '../../src/constants';
import { fileExists, readJsonFile } from '../../src/helpers/fs';
import { mergeHooks, preserveUserHooks, readExistingHooks } from '../../src/helpers/hooks-merger';
import type { CursorHooksConfig } from '../../src/schema';

describe('hooks-merger', () => {
  let testDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'hooks-merger-test-'));
    cleanup = async () => {
      await rm(testDir, { recursive: true, force: true });
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  test('merges hooks from multiple plugins', async () => {
    const plugin1Hooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/marketplace1/plugin1/hook1',
            command: './hooks/aipm/marketplace1/plugin1/script1.sh',
          },
        ],
      },
    };

    const plugin2Hooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        stop: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/marketplace2/plugin2/hook1',
            command: './hooks/aipm/marketplace2/plugin2/script2.sh',
          },
        ],
      },
    };

    await mergeHooks(testDir, [plugin1Hooks, plugin2Hooks]);

    const result = await readJsonFile<CursorHooksConfig>(join(testDir, FILE_HOOKS_JSON));
    expect(result.version).toBe(1);
    expect(result.hooks.beforeSubmitPrompt).toHaveLength(1);
    expect(result.hooks.stop).toHaveLength(1);
    expect(result.hooks.beforeSubmitPrompt?.[0]?.['x-hookId']).toBe('aipm/marketplace1/plugin1/hook1');
    expect(result.hooks.stop?.[0]?.['x-hookId']).toBe('aipm/marketplace2/plugin2/hook1');
  });

  test('preserves user hooks without x-managedBy field', async () => {
    const existingHooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        afterFileEdit: [
          {
            command: './user-script.sh',
            // No x-managedBy field - this is a user hook
          } as any, // Type assertion needed because CursorHookSchema requires x-managedBy
        ],
      },
    };

    // Write existing hooks
    await Bun.write(join(testDir, FILE_HOOKS_JSON), JSON.stringify(existingHooks, null, 2));

    const aipmHooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/test/plugin/hook1',
            command: './hooks/aipm/test/plugin/script.sh',
          },
        ],
      },
    };

    await mergeHooks(testDir, [aipmHooks]);

    const result = await readJsonFile<any>(join(testDir, FILE_HOOKS_JSON));
    // User hook should be preserved (even though it doesn't match schema exactly)
    expect(result.hooks.afterFileEdit).toBeDefined();
    expect(result.hooks.afterFileEdit[0].command).toBe('./user-script.sh');
    // AIPM hook should also be present
    expect(result.hooks.beforeSubmitPrompt).toBeDefined();
    expect(result.hooks.beforeSubmitPrompt[0]['x-managedBy']).toBe('aipm');
  });

  test('preserves user hooks with different x-managedBy value', async () => {
    const existingHooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        afterFileEdit: [
          {
            'x-managedBy': 'other-tool',
            'x-hookId': 'other-tool/hook1',
            command: './other-script.sh',
          } as any, // Type assertion needed
        ],
      },
    };

    await Bun.write(join(testDir, FILE_HOOKS_JSON), JSON.stringify(existingHooks, null, 2));

    const aipmHooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/test/plugin/hook1',
            command: './hooks/aipm/test/plugin/script.sh',
          },
        ],
      },
    };

    await mergeHooks(testDir, [aipmHooks]);

    const result = await readJsonFile<any>(join(testDir, FILE_HOOKS_JSON));
    // User hook with different x-managedBy should be preserved
    expect(result.hooks.afterFileEdit).toBeDefined();
    expect(result.hooks.afterFileEdit[0]['x-managedBy']).toBe('other-tool');
    // AIPM hook should be present
    expect(result.hooks.beforeSubmitPrompt).toBeDefined();
  });

  test('removes disabled plugin hooks by x-hookId prefix', async () => {
    // First, merge hooks from plugin1
    const plugin1Hooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/marketplace1/plugin1/hook1',
            command: './hooks/aipm/marketplace1/plugin1/script1.sh',
          },
        ],
      },
    };

    await mergeHooks(testDir, [plugin1Hooks]);

    // Then merge empty array (simulating plugin1 being disabled)
    await mergeHooks(testDir, []);

    const result = await readJsonFile<CursorHooksConfig>(join(testDir, FILE_HOOKS_JSON));
    // Plugin1 hooks should be removed
    expect(result.hooks.beforeSubmitPrompt).toBeUndefined();
  });

  test('handles empty/missing existing hooks.json', async () => {
    const aipmHooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        stop: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/test/plugin/hook1',
            command: './hooks/aipm/test/plugin/script.sh',
          },
        ],
      },
    };

    // No existing hooks.json
    await mergeHooks(testDir, [aipmHooks]);

    expect(await fileExists(join(testDir, FILE_HOOKS_JSON))).toBe(true);
    const result = await readJsonFile<CursorHooksConfig>(join(testDir, FILE_HOOKS_JSON));
    expect(result.hooks.stop).toHaveLength(1);
    expect(result.hooks.stop?.[0]?.['x-hookId']).toBe('aipm/test/plugin/hook1');
  });

  test('preserveUserHooks filters correctly', () => {
    const existingHooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        afterFileEdit: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/old/plugin/hook1',
            command: './old.sh',
          },
          {
            command: './user-script.sh',
            // No x-managedBy - user hook
          } as any,
        ],
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'other-tool',
            'x-hookId': 'other/hook1',
            command: './other.sh',
          } as any,
        ],
      },
    };

    const aipmHooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/new/plugin/hook1',
            command: './new.sh',
          },
        ],
      },
    };

    const result = preserveUserHooks(existingHooks, [aipmHooks]);

    // User hooks should be preserved
    expect(result.hooks.afterFileEdit).toBeDefined();
    expect(result.hooks.afterFileEdit).toHaveLength(1);
    expect(result.hooks.afterFileEdit?.[0]?.command).toBe('./user-script.sh');

    // Other tool hooks should be preserved
    expect(result.hooks.beforeSubmitPrompt).toBeDefined();
    expect(result.hooks.beforeSubmitPrompt?.length).toBeGreaterThan(0);
    const otherToolHook = result.hooks.beforeSubmitPrompt?.find((h: any) => h['x-managedBy'] === 'other-tool');
    expect(otherToolHook).toBeDefined();

    // New AIPM hooks should be added
    const newAipmHook = result.hooks.beforeSubmitPrompt?.find((h) => h['x-hookId'] === 'aipm/new/plugin/hook1');
    expect(newAipmHook).toBeDefined();

    // Old AIPM hooks should be removed (replaced by new ones)
    const oldAipmHook = result.hooks.afterFileEdit?.find((h) => h['x-hookId'] === 'aipm/old/plugin/hook1');
    expect(oldAipmHook).toBeUndefined();
  });

  test('readExistingHooks returns null for missing file', async () => {
    const result = await readExistingHooks(testDir);
    expect(result).toBeNull();
  });

  test('readExistingHooks handles invalid JSON gracefully', async () => {
    // Write invalid JSON
    await Bun.write(join(testDir, FILE_HOOKS_JSON), '{ invalid json }');

    const result = await readExistingHooks(testDir);
    // Should return null and not throw
    expect(result).toBeNull();
  });

  test('readExistingHooks rejects hooks.json with hooks as array', async () => {
    // Write hooks.json with hooks as an array (invalid format)
    const malformedHooks = {
      version: 1,
      hooks: [
        {
          'x-managedBy': 'aipm',
          'x-hookId': 'test/hook1',
          command: './test.sh',
        },
      ],
    };

    await Bun.write(join(testDir, FILE_HOOKS_JSON), JSON.stringify(malformedHooks, null, 2));

    const result = await readExistingHooks(testDir);
    // Should return null because hooks must be an object, not an array
    expect(result).toBeNull();
  });

  test('readExistingHooks rejects hooks.json with non-array hook values', async () => {
    // Write hooks.json with hook values as strings/objects (invalid format)
    const malformedHooks = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: 'not-an-array', // Should be an array
        stop: {
          command: './test.sh', // Should be an array of hook objects
        },
      },
    };

    await Bun.write(join(testDir, FILE_HOOKS_JSON), JSON.stringify(malformedHooks, null, 2));

    const result = await readExistingHooks(testDir);
    // Should return null because hook values must be arrays
    expect(result).toBeNull();
  });

  test('readExistingHooks rejects hooks.json with some non-array hook values', async () => {
    // Write hooks.json where one event has valid array, but another doesn't
    const malformedHooks = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'test/hook1',
            command: './test.sh',
          },
        ],
        stop: 'not-an-array', // This one is invalid
      },
    };

    await Bun.write(join(testDir, FILE_HOOKS_JSON), JSON.stringify(malformedHooks, null, 2));

    const result = await readExistingHooks(testDir);
    // Should return null because all hook values must be arrays
    expect(result).toBeNull();
  });

  test('preserveUserHooks handles malformed hook entries (null, primitives)', () => {
    // Simulate a corrupted hooks.json file with malformed entries
    const existingHooks: any = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          null, // null hook
          123, // primitive number
          'string', // primitive string
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/test/plugin1/hook1',
            command: './test1.sh',
          },
          {
            command: './user-script.sh',
            // Valid user hook without x-managedBy
          },
        ],
      },
    };

    const aipmHooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/test/plugin2/hook1',
            command: './test2.sh',
          },
        ],
      },
    };

    // Should not throw TypeError
    const result = preserveUserHooks(existingHooks, [aipmHooks]);

    // Malformed entries (null, primitives) should be filtered out
    // Only valid user hook and new AIPM hook should remain
    expect(result.hooks.beforeSubmitPrompt).toBeDefined();
    expect(result.hooks.beforeSubmitPrompt).toHaveLength(2);

    // User hook should be preserved
    const userHook = result.hooks.beforeSubmitPrompt?.find((h: any) => h.command === './user-script.sh');
    expect(userHook).toBeDefined();

    // New AIPM hook should be added
    const newAipmHook = result.hooks.beforeSubmitPrompt?.find((h) => h['x-hookId'] === 'aipm/test/plugin2/hook1');
    expect(newAipmHook).toBeDefined();

    // Old AIPM hook should be removed (not preserved)
    const oldAipmHook = result.hooks.beforeSubmitPrompt?.find((h) => h['x-hookId'] === 'aipm/test/plugin1/hook1');
    expect(oldAipmHook).toBeUndefined();

    // Malformed entries should not be in result
    const hasNull = result.hooks.beforeSubmitPrompt?.some((h) => h === null);
    const hasPrimitive = result.hooks.beforeSubmitPrompt?.some((h) => typeof h !== 'object' || h === null);
    expect(hasNull).toBe(false);
    expect(hasPrimitive).toBe(false);
  });

  test('mergeHooks handles malformed entries in existing hooks.json', async () => {
    // Write corrupted hooks.json with malformed entries
    const corruptedHooks: any = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          null,
          undefined,
          123,
          'string',
          {
            command: './user-script.sh',
          },
        ],
        stop: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/test/old/hook1',
            command: './old.sh',
          },
          false, // boolean primitive
          [], // array (not a valid hook object)
        ],
      },
    };

    await Bun.write(join(testDir, FILE_HOOKS_JSON), JSON.stringify(corruptedHooks, null, 2));

    const aipmHooks: CursorHooksConfig = {
      version: 1,
      hooks: {
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'aipm',
            'x-hookId': 'aipm/test/new/hook1',
            command: './new.sh',
          },
        ],
      },
    };

    // Should not throw TypeError
    await mergeHooks(testDir, [aipmHooks]);

    const result = await readJsonFile<any>(join(testDir, FILE_HOOKS_JSON));

    // User hook should be preserved
    expect(result.hooks.beforeSubmitPrompt).toBeDefined();
    const userHook = result.hooks.beforeSubmitPrompt?.find((h: any) => h?.command === './user-script.sh');
    expect(userHook).toBeDefined();

    // New AIPM hook should be added
    const newAipmHook = result.hooks.beforeSubmitPrompt?.find((h: any) => h?.['x-hookId'] === 'aipm/test/new/hook1');
    expect(newAipmHook).toBeDefined();

    // Malformed entries should be filtered out
    const hasNull = result.hooks.beforeSubmitPrompt?.some((h: any) => h === null || h === undefined);
    expect(hasNull).toBe(false);

    // Stop event should not have old AIPM hooks (they were replaced)
    // but also should not have malformed entries
    if (result.hooks.stop) {
      const hasInvalid = result.hooks.stop.some((h: any) => !h || typeof h !== 'object' || Array.isArray(h));
      expect(hasInvalid).toBe(false);
    }
  });
});
