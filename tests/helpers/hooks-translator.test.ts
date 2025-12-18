import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countTranslatedHooks, translateClaudeCodeHook } from '../../src/helpers/hooks-translator';
import type { ClaudeCodeHook } from '../../src/schema';

describe('hooks-translator', () => {
  let testDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'hooks-translator-test-'));
    cleanup = async () => {
      // Cleanup handled by test framework
    };
  });

  afterEach(async () => {
    await cleanup();
  });

  test('translates SessionStart to beforeSubmitPrompt', () => {
    const claudeHook: ClaudeCodeHook = {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: 'command',
                command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/context.js',
              },
            ],
          },
        ],
      },
    };

    const result = translateClaudeCodeHook(claudeHook, 'claude/test', 'test-plugin', testDir);

    expect(result.version).toBe(1);
    expect(result.hooks.beforeSubmitPrompt).toBeDefined();
    expect(result.hooks.beforeSubmitPrompt).toHaveLength(1);
    expect(result.hooks.beforeSubmitPrompt?.[0]?.['x-managedBy']).toBe('aipm');
    expect(result.hooks.beforeSubmitPrompt?.[0]?.['x-hookId']).toContain('aipm/claude/test/test-plugin');
    expect(result.hooks.beforeSubmitPrompt?.[0]?.command).toContain('node');
    expect(result.hooks.beforeSubmitPrompt?.[0]?.command).toContain('scripts/context.js');
    expect(result.hooks.beforeSubmitPrompt?.[0]?.command).not.toContain('${CLAUDE_PLUGIN_ROOT}');
  });

  test('translates Stop to stop', () => {
    const claudeHook: ClaudeCodeHook = {
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: 'command',
                command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/summary.js',
              },
            ],
          },
        ],
      },
    };

    const result = translateClaudeCodeHook(claudeHook, 'local', 'my-plugin', testDir);

    expect(result.hooks.stop).toBeDefined();
    expect(result.hooks.stop).toHaveLength(1);
    expect(result.hooks.stop?.[0]?.['x-managedBy']).toBe('aipm');
    expect(result.hooks.stop?.[0]?.['x-hookId']).toBe('aipm/local/my-plugin/stop-0-0');
  });

  test('handles nested hooks arrays', () => {
    const claudeHook: ClaudeCodeHook = {
      hooks: {
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: 'command',
                command: 'node ${CLAUDE_PLUGIN_ROOT}/script1.js',
              },
              {
                type: 'command',
                command: 'node ${CLAUDE_PLUGIN_ROOT}/script2.js',
              },
            ],
          },
          {
            hooks: [
              {
                type: 'command',
                command: 'node ${CLAUDE_PLUGIN_ROOT}/script3.js',
              },
            ],
          },
        ],
      },
    };

    const result = translateClaudeCodeHook(claudeHook, 'test', 'plugin', testDir);

    expect(result.hooks.beforeSubmitPrompt).toBeDefined();
    expect(result.hooks.beforeSubmitPrompt).toHaveLength(3);
    expect(result.hooks.beforeSubmitPrompt?.[0]?.['x-hookId']).toBe('aipm/test/plugin/userpromptsubmit-0-0');
    expect(result.hooks.beforeSubmitPrompt?.[1]?.['x-hookId']).toBe('aipm/test/plugin/userpromptsubmit-0-1');
    expect(result.hooks.beforeSubmitPrompt?.[2]?.['x-hookId']).toBe('aipm/test/plugin/userpromptsubmit-1-0');
  });

  test('resolves CLAUDE_PLUGIN_ROOT variable', () => {
    const claudeHook: ClaudeCodeHook = {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: 'command',
                command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/test.js" && echo ${CLAUDE_PLUGIN_ROOT}',
              },
            ],
          },
        ],
      },
    };

    const result = translateClaudeCodeHook(claudeHook, 'marketplace', 'plugin', testDir);

    const command = result.hooks.beforeSubmitPrompt?.[0]?.command;
    expect(command).toBeDefined();
    expect(command).not.toContain('${CLAUDE_PLUGIN_ROOT}');
    // Paths should point to the actual plugin path (absolute)
    expect(command).toContain(testDir);
  });

  test('adds x-managedBy and x-hookId fields correctly', () => {
    const claudeHook: ClaudeCodeHook = {
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: 'command',
                command: 'node test.js',
              },
            ],
          },
        ],
      },
    };

    const result = translateClaudeCodeHook(claudeHook, 'my-marketplace', 'my-plugin', testDir);

    const hook = result.hooks.stop?.[0];
    expect(hook).toBeDefined();
    expect(hook?.['x-managedBy']).toBe('aipm');
    expect(hook?.['x-hookId']).toBe('aipm/my-marketplace/my-plugin/stop-0-0');
    expect(hook?.command).toBeDefined();
  });

  test('generates correct x-hookId format', () => {
    const claudeHook: ClaudeCodeHook = {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: 'command',
                command: 'test',
              },
            ],
          },
        ],
        Stop: [
          {
            hooks: [
              {
                type: 'command',
                command: 'test2',
              },
            ],
          },
        ],
      },
    };

    const result = translateClaudeCodeHook(claudeHook, 'marketplace/name', 'plugin-name', testDir);

    expect(result.hooks.beforeSubmitPrompt?.[0]?.['x-hookId']).toBe(
      'aipm/marketplace/name/plugin-name/sessionstart-0-0',
    );
    expect(result.hooks.stop?.[0]?.['x-hookId']).toBe('aipm/marketplace/name/plugin-name/stop-0-0');
  });

  test('handles missing optional fields', () => {
    const claudeHook: ClaudeCodeHook = {
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: 'command',
                command: 'test',
                timeout: 300,
              },
            ],
          },
        ],
      },
    };

    const result = translateClaudeCodeHook(claudeHook, 'test', 'plugin', testDir);

    expect(result.hooks.stop).toBeDefined();
    expect(result.hooks.stop?.[0]?.command).toBe('test');
    // Timeout is not included in Cursor format, but command should still work
  });

  test('handles matcher field (ignored in translation)', () => {
    const claudeHook: ClaudeCodeHook = {
      hooks: {
        SessionStart: [
          {
            matcher: 'startup|clear',
            hooks: [
              {
                type: 'command',
                command: 'node test.js',
              },
            ],
          },
        ],
      },
    };

    const result = translateClaudeCodeHook(claudeHook, 'test', 'plugin', testDir);

    expect(result.hooks.beforeSubmitPrompt).toBeDefined();
    expect(result.hooks.beforeSubmitPrompt).toHaveLength(1);
    // Matcher is ignored - all hooks are translated
  });

  test('countTranslatedHooks counts all hooks', () => {
    const config = {
      version: 1 as const,
      hooks: {
        beforeSubmitPrompt: [
          {
            'x-managedBy': 'aipm' as const,
            'x-hookId': 'aipm/test/plugin/hook1',
            command: 'test1',
          },
          {
            'x-managedBy': 'aipm' as const,
            'x-hookId': 'aipm/test/plugin/hook2',
            command: 'test2',
          },
        ],
        stop: [
          {
            'x-managedBy': 'aipm' as const,
            'x-hookId': 'aipm/test/plugin/hook3',
            command: 'test3',
          },
        ],
      },
    };

    expect(countTranslatedHooks(config)).toBe(3);
  });

  test('replaces multiple occurrences of CLAUDE_PLUGIN_ROOT in command', () => {
    const claudeHook: ClaudeCodeHook = {
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: 'command',
                // Command with 3 occurrences of ${CLAUDE_PLUGIN_ROOT}
                command:
                  'cd ${CLAUDE_PLUGIN_ROOT} && node ${CLAUDE_PLUGIN_ROOT}/scripts/test.js && echo "Path: ${CLAUDE_PLUGIN_ROOT}"',
              },
            ],
          },
        ],
      },
    };

    const result = translateClaudeCodeHook(claudeHook, 'test', 'plugin', testDir);
    const command = result.hooks.beforeSubmitPrompt?.[0]?.command;

    expect(command).toBeDefined();
    expect(command).not.toContain('${CLAUDE_PLUGIN_ROOT}');

    // Verify all 3 occurrences were replaced
    const occurrences = command!.split(testDir).length - 1;
    expect(occurrences).toBe(3);

    // Verify the command structure is correct
    expect(command).toContain(`cd ${testDir}`);
    expect(command).toContain(`node ${testDir}/scripts/test.js`);
    expect(command).toContain(`echo "Path: ${testDir}"`);
  });

  test('handles plugin paths with special replacement characters ($1, $&, $$)', () => {
    // Test paths that would be corrupted if using replace() with string replacement
    const pathsWithSpecialChars = [
      '/home/$1user/plugins',
      '/var/lib/$&data/plugins',
      '/opt/$$cache/plugins',
      "/Users/test$'/plugins",
    ];

    for (const pluginPath of pathsWithSpecialChars) {
      const claudeHook: ClaudeCodeHook = {
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: 'command',
                  command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/test.js && echo ${CLAUDE_PLUGIN_ROOT}',
                },
              ],
            },
          ],
        },
      };

      const result = translateClaudeCodeHook(claudeHook, 'test', 'plugin', pluginPath);
      const command = result.hooks.beforeSubmitPrompt?.[0]?.command;

      expect(command).toBeDefined();
      // The path should be preserved exactly as-is, not interpreted as special replacement patterns
      expect(command).toContain(pluginPath);
      expect(command).not.toContain('${CLAUDE_PLUGIN_ROOT}');
      // Verify both occurrences were replaced with the correct path
      const occurrences = command!.split(pluginPath).length - 1;
      expect(occurrences).toBe(2);
    }
  });
});
