import { AIPM_HOOK_PREFIX, CLAUDE_PLUGIN_ROOT_VAR, HOOK_ID_FIELD, HOOK_MANAGED_BY_FIELD } from '../constants';
import type { ClaudeCodeHook, CursorHooksConfig } from '../schema';
import { AipmManagedHookSchema } from '../schema';
import { defaultIO } from './io';

/**
 * Event mapping from Claude Code to Cursor hooks
 */
const EVENT_MAP: Record<string, string> = {
  SessionStart: 'beforeSubmitPrompt',
  UserPromptSubmit: 'beforeSubmitPrompt',
  PostToolUse: 'afterShellExecution', // Best approximation
  Stop: 'stop',
  SessionEnd: 'stop',
};

/**
 * Translate Claude Code hooks.json format to Cursor hooks.json format
 *
 * @param claudeHook - The Claude Code hook configuration
 * @param marketplaceName - Name of the marketplace (e.g., "claude/thedotmack")
 * @param pluginName - Name of the plugin (e.g., "claude-mem")
 * @param pluginPath - The actual plugin path (global location, e.g., ~/.claude/plugins/...)
 * @returns Translated Cursor hooks configuration
 */
export function translateClaudeCodeHook(
  claudeHook: ClaudeCodeHook,
  marketplaceName: string,
  pluginName: string,
  pluginPath: string,
): CursorHooksConfig {
  const result: CursorHooksConfig = {
    version: 1,
    hooks: {},
  };

  const pluginRootPath = pluginPath;

  for (const [claudeEvent, hookGroups] of Object.entries(claudeHook.hooks)) {
    const cursorEvent = EVENT_MAP[claudeEvent];

    if (!cursorEvent) {
      defaultIO.logInfo(
        `⚠️  Unknown Claude Code hook event '${claudeEvent}' - skipping (plugin: ${pluginName}@${marketplaceName})`,
      );
      continue;
    }

    if (!result.hooks[cursorEvent]) {
      result.hooks[cursorEvent] = [];
    }

    // Claude Code supports matchers and nested hook arrays
    for (let groupIndex = 0; groupIndex < hookGroups.length; groupIndex++) {
      const hookGroup = hookGroups[groupIndex];
      if (!hookGroup) {
        continue;
      }

      for (let hookIndex = 0; hookIndex < hookGroup.hooks.length; hookIndex++) {
        const hook = hookGroup.hooks[hookIndex];
        if (!hook) {
          continue;
        }

        const hookName = `${claudeEvent.toLowerCase()}-${groupIndex}-${hookIndex}`;
        const hookId = `${AIPM_HOOK_PREFIX}/${marketplaceName}/${pluginName}/${hookName}`;

        // Use function to prevent special replacement pattern interpretation ($&, $1, etc.)
        const resolvedCommand = hook.command.replaceAll(CLAUDE_PLUGIN_ROOT_VAR, () => pluginRootPath);

        const aipmHook = AipmManagedHookSchema.parse({
          [HOOK_MANAGED_BY_FIELD]: AIPM_HOOK_PREFIX,
          [HOOK_ID_FIELD]: hookId,
          command: resolvedCommand,
        });

        result.hooks[cursorEvent].push(aipmHook);
      }
    }
  }

  return result;
}

/**
 * Count the total number of hooks in a Cursor hooks configuration
 */
export function countTranslatedHooks(config: CursorHooksConfig): number {
  let count = 0;
  for (const hooks of Object.values(config.hooks)) {
    count += hooks.length;
  }
  return count;
}
