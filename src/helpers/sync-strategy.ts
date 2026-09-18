import type { Dirent } from 'node:fs';
import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { DIR_AIPM_NAMESPACE, DIR_HOOKS, DIR_SKILLS, FILE_HOOKS_JSON } from '../constants';
import { DirectoryNotFoundError, isFileNotFoundError } from '../errors';
import type { CursorHooksConfig, MarketplaceManifest } from '../schema';
import { ClaudeCodeHookSchema } from '../schema';
import { applyCursorFrontmatter } from './frontmatter';
import { ensureDir, fileExists, readJsonFile } from './fs';
import { countTranslatedHooks, translateClaudeCodeHook } from './hooks-translator';
import { defaultIO } from './io';
import { hasPluginName } from './marketplace';

export type AipmPluginSyncResult = {
  type: 'aipm';
  commandsCount: number;
  rulesCount: number;
  agentsCount: number;
  skillsCount: number;
  hooksCount: number;
  translatedHooks?: CursorHooksConfig | null;
};

export type ClaudeCodePluginSyncResult = {
  type: 'claudecode';
  skillsCount: number;
};

export type SyncResult = AipmPluginSyncResult | ClaudeCodePluginSyncResult;

/**
 * Syncs a plugin to the correct Cursor directories:
 * - commands/*.md → .cursor/commands/aipm/marketplace-name/plugin-name/
 * - rules/*.mdc → .cursor/rules/aipm/marketplace-name/plugin-name/
 * - agents/*.md → .cursor/agents/aipm/marketplace-name/plugin-name/
 * - skills/ → .cursor/skills/aipm-marketplace-plugin/ (flattened dir name, see #10238)
 * - hooks/* → .cursor/hooks/aipm/marketplace-name/plugin-name/
 */
export async function syncPluginToCursor(
  pluginPath: string,
  marketplaceName: string,
  pluginName: string,
  cursorDir: string,
): Promise<AipmPluginSyncResult> {
  const result: AipmPluginSyncResult = {
    type: 'aipm',
    commandsCount: 0,
    rulesCount: 0,
    agentsCount: 0,
    skillsCount: 0,
    hooksCount: 0,
  };

  // Sync commands/*.md to .cursor/commands/aipm/marketplace/plugin/
  const commandsResult = await syncDirectory(
    join(pluginPath, 'commands'),
    join(cursorDir, 'commands', DIR_AIPM_NAMESPACE, marketplaceName, pluginName),
    ['.md'],
  );
  result.commandsCount = commandsResult;

  // Sync rules/*.md and *.mdc to .cursor/rules/aipm/marketplace/plugin/
  // Apply .cursor.yaml frontmatter overrides if they exist
  const rulesResult = await syncRulesDirectory(
    join(pluginPath, 'rules'),
    join(cursorDir, 'rules', DIR_AIPM_NAMESPACE, marketplaceName, pluginName),
  );
  result.rulesCount = rulesResult;

  // Sync agents/*.md to .cursor/agents/aipm/marketplace/plugin/
  const agentsResult = await syncDirectory(
    join(pluginPath, 'agents'),
    join(cursorDir, 'agents', DIR_AIPM_NAMESPACE, marketplaceName, pluginName),
    ['.md'],
  );
  result.agentsCount = agentsResult;

  // Sync skills/ to .cursor/skills/aipm-marketplace-plugin-skill/ (flat directory names)
  // Each skill subdirectory gets its own flattened name to avoid nesting
  // Also handles files directly in skills/ directory for backwards compatibility
  const skillsSourcePath = join(pluginPath, 'skills');

  if (await fileExists(skillsSourcePath)) {
    let entries: Dirent[] = [];
    try {
      entries = await readdir(skillsSourcePath, { withFileTypes: true });
    } catch (error: unknown) {
      if (!isFileNotFoundError(error)) {
        throw new DirectoryNotFoundError(skillsSourcePath, { cause: error });
      }
    }

    for (const entry of entries) {
      const skillSourcePath = join(skillsSourcePath, entry.name);

      if (entry.isDirectory()) {
        // Flatten skill subdirectories to avoid nesting limitations
        const flattenedSkillName = getFlattenedSkillName(DIR_AIPM_NAMESPACE, marketplaceName, pluginName, entry.name);
        const skillTargetPath = join(cursorDir, 'skills', flattenedSkillName);
        await ensureDir(join(cursorDir, 'skills'));
        await cp(skillSourcePath, skillTargetPath, { recursive: true });
        result.skillsCount++;
      } else if (entry.isFile()) {
        // Handle files directly in skills/ directory (maintain nested structure for backwards compatibility)
        const fileTargetPath = join(cursorDir, 'skills', DIR_AIPM_NAMESPACE, marketplaceName, pluginName, entry.name);
        await ensureDir(join(cursorDir, 'skills', DIR_AIPM_NAMESPACE, marketplaceName, pluginName));
        await cp(skillSourcePath, fileTargetPath);
        result.skillsCount++;
      }
    }
  }

  // Sync hooks - check for hooks.json and translate if needed
  const hooksResult = await syncHooks(pluginPath, marketplaceName, pluginName, cursorDir);
  result.hooksCount = hooksResult.count;
  result.translatedHooks = hooksResult.translatedHooks;

  return result;
}

/**
 * Syncs rules directory with special handling for .cursor.yaml overrides
 * Rules can be .md or .mdc files, and output to .mdc in Cursor
 */
async function syncRulesDirectory(sourceDir: string, targetDir: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(sourceDir, { withFileTypes: true });
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return 0;
    }
    throw new DirectoryNotFoundError(sourceDir, { cause: error });
  }

  await ensureDir(targetDir);
  let count = 0;
  const processedFiles = new Set<string>();

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);

    if (entry.isDirectory()) {
      // Recursively sync subdirectories
      const targetPath = join(targetDir, entry.name);
      const subCount = await syncRulesDirectory(sourcePath, targetPath);
      count += subCount;
    } else if (entry.isFile()) {
      // Skip .cursor.yaml files (they're metadata, not content)
      if (entry.name.endsWith('.cursor.yaml')) {
        continue;
      }

      // Only process .md and .mdc files
      const ext = extname(entry.name);
      if (ext !== '.md' && ext !== '.mdc') {
        continue;
      }

      const baseNameWithoutExt = basename(entry.name, ext);

      // Skip if we already processed this base name
      if (processedFiles.has(baseNameWithoutExt)) {
        continue;
      }
      processedFiles.add(baseNameWithoutExt);

      // Check for .cursor.yaml override
      const cursorYamlPath = join(sourceDir, `${baseNameWithoutExt}.cursor.yaml`);
      const hasCursorOverride = await fileExists(cursorYamlPath);

      // Output file is always .mdc for Cursor
      const targetPath = join(targetDir, `${baseNameWithoutExt}.mdc`);

      if (hasCursorOverride) {
        // Apply .cursor.yaml frontmatter override
        const sourceContent = await readFile(sourcePath, 'utf-8');
        const transformedContent = await applyCursorFrontmatter(sourceContent, cursorYamlPath);
        await writeFile(targetPath, transformedContent, 'utf-8');
        count++;
      } else {
        // Copy as-is, but ensure it's .mdc
        const sourceContent = await readFile(sourcePath, 'utf-8');
        await writeFile(targetPath, sourceContent, 'utf-8');
        count++;
      }
    }
  }

  return count;
}

/**
 * Sync hooks directory - translate Claude Code hooks.json if present, otherwise copy as-is
 *
 * @param pluginPath - Path to the plugin directory
 * @param marketplaceName - Name of the marketplace
 * @param pluginName - Name of the plugin
 * @param cursorDir - The .cursor directory path
 * @returns Object with count and translated hooks config (if applicable)
 */
async function syncHooks(
  pluginPath: string,
  marketplaceName: string,
  pluginName: string,
  cursorDir: string,
): Promise<{ count: number; translatedHooks: CursorHooksConfig | null }> {
  const hooksJsonPath = join(pluginPath, DIR_HOOKS, FILE_HOOKS_JSON);

  if (await fileExists(hooksJsonPath)) {
    try {
      const claudeHook = await readJsonFile(hooksJsonPath, ClaudeCodeHookSchema);
      const translated = translateClaudeCodeHook(claudeHook, marketplaceName, pluginName, pluginPath);
      const count = countTranslatedHooks(translated);

      const targetHooksDir = join(cursorDir, DIR_HOOKS, DIR_AIPM_NAMESPACE, marketplaceName, pluginName);
      await syncDirectory(join(pluginPath, DIR_HOOKS), targetHooksDir, []);

      // Remove copied hooks.json (already translated and merged)
      const copiedHooksJson = join(targetHooksDir, FILE_HOOKS_JSON);
      if (await fileExists(copiedHooksJson)) {
        await rm(copiedHooksJson);
      }

      try {
        const remainingFiles = await readdir(targetHooksDir);
        if (remainingFiles.length === 0) {
          await rm(targetHooksDir, { recursive: true });
        }
      } catch {
        // Ignore - directory doesn't exist or can't be read
      }

      return { count, translatedHooks: translated };
    } catch (error) {
      defaultIO.logInfo(
        `⚠️  Failed to translate hooks.json for ${pluginName}@${marketplaceName}: ${error}. Copying as-is.`,
      );
      const targetHooksDir = join(cursorDir, DIR_HOOKS, DIR_AIPM_NAMESPACE, marketplaceName, pluginName);
      await syncDirectory(join(pluginPath, DIR_HOOKS), targetHooksDir, []);

      const copiedHooksJson = join(targetHooksDir, FILE_HOOKS_JSON);
      if (await fileExists(copiedHooksJson)) {
        await rm(copiedHooksJson);
      }

      try {
        const remainingFiles = await readdir(targetHooksDir);
        if (remainingFiles.length === 0) {
          await rm(targetHooksDir, { recursive: true });
        }
      } catch {
        // Ignore - directory doesn't exist or can't be read
      }

      return { count: 0, translatedHooks: null };
    }
  } else {
    const targetHooksDir = join(cursorDir, DIR_HOOKS, DIR_AIPM_NAMESPACE, marketplaceName, pluginName);
    await syncDirectory(join(pluginPath, DIR_HOOKS), targetHooksDir, []);

    const copiedHooksJson = join(targetHooksDir, FILE_HOOKS_JSON);
    if (await fileExists(copiedHooksJson)) {
      await rm(copiedHooksJson);
    }

    try {
      const remainingFiles = await readdir(targetHooksDir);
      if (remainingFiles.length === 0) {
        await rm(targetHooksDir, { recursive: true });
      }
    } catch {
      // Ignore - directory doesn't exist or can't be read
    }

    return { count: 0, translatedHooks: null };
  }
}

/**
 * Generates a flattened skill name using delimiter
 * e.g., "aipm-marketplace-plugin" or "aipm-marketplace-plugin-skill-subskill"
 *
 * Claude Code does not support nested directories for skills.
 * See: https://github.com/anthropics/claude-code/issues/10238
 * All skills must be flat files in .cursor/skills/ directory.
 *
 * NOTE: Using hyphens as delimiters creates a theoretical risk of name collisions
 * if marketplace or plugin names contain hyphens. For example:
 * - marketplace "a-b", plugin "c-d" → "aipm-a-b-c-d"
 * - marketplace "a", plugin "b-c-d" → "aipm-a-b-c-d" (collision!)
 * This is mitigated in practice by:
 * 1. Centralized marketplace management (limited namespace)
 * 2. Using "/" separators in marketplace names (rare hyphens)
 * 3. Plugin names typically use simple identifiers
 * Consider adding a hash suffix if collisions become an issue in production.
 */
function getFlattenedSkillName(
  namespace: string,
  marketplaceName: string,
  pluginName: string,
  skillPath?: string,
): string {
  const parts = [namespace, marketplaceName.replace(/\//g, '-'), pluginName];
  if (skillPath) {
    parts.push(skillPath.replace(/\//g, '-'));
  }
  return parts.join('-');
}

/**
 * Syncs a directory, copying files with specified extensions
 * @param sourceDir Source directory
 * @param targetDir Target directory
 * @param extensions Extensions to copy (empty array = copy all)
 * @returns Number of files copied
 */
async function syncDirectory(sourceDir: string, targetDir: string, extensions: string[]): Promise<number> {
  let entries;
  try {
    entries = await readdir(sourceDir, { withFileTypes: true });
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) {
      return 0;
    }
    throw new DirectoryNotFoundError(sourceDir, { cause: error });
  }

  await ensureDir(targetDir);
  let count = 0;

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      // Recursively sync subdirectories
      const subCount = await syncDirectory(sourcePath, targetPath, extensions);
      count += subCount;
    } else if (entry.isFile()) {
      // Check if we should copy this file
      const shouldCopy = extensions.length === 0 || extensions.some((ext) => entry.name.endsWith(ext));

      if (shouldCopy) {
        await cp(sourcePath, targetPath);
        count++;
      }
    }
  }

  return count;
}

/**
 * Syncs a Claude Code meta-plugin to Cursor directories.
 * Meta-plugins point to the marketplace root and define skills in the manifest.
 * We sync each skill directory listed in the manifest's skills array.
 *
 * Skill directory paths are flattened to avoid nested directories
 * (Claude Code does not support nested skill directories).
 * See: https://github.com/anthropics/claude-code/issues/10238
 */
export async function syncMetaPluginToCursor(
  marketplacePath: string,
  marketplaceManifest: MarketplaceManifest,
  pluginName: string,
  marketplaceName: string,
  cursorDir: string,
): Promise<ClaudeCodePluginSyncResult> {
  const pluginEntry = marketplaceManifest.plugins.find(hasPluginName(pluginName));
  if (!pluginEntry || !pluginEntry.skills) {
    return { type: 'claudecode', skillsCount: 0 };
  }

  await ensureDir(join(cursorDir, DIR_SKILLS));
  let skillsCount = 0;

  for (const skillPath of pluginEntry.skills) {
    const normalizedSkillPath = skillPath.replace(/^\.\//, '');
    const fullSkillPath = join(marketplacePath, normalizedSkillPath);

    // Strip 'skills/' prefix if present, then flatten the remaining path
    // e.g., 'skills/document-skills/xlsx' -> 'document-skills/xlsx' -> 'document-skills-xlsx'
    const skillNamePath = normalizedSkillPath.replace(/^skills\//, '');
    const flattenedSkillName = getFlattenedSkillName(DIR_AIPM_NAMESPACE, marketplaceName, pluginName, skillNamePath);
    const targetPath = join(cursorDir, DIR_SKILLS, flattenedSkillName);

    try {
      await cp(fullSkillPath, targetPath, { recursive: true });
      skillsCount++;
    } catch (error: unknown) {
      if (!isFileNotFoundError(error)) {
        throw error;
      }
      defaultIO.logInfo(`⚠️  Skill not found in manifest: ${skillNamePath} (expected at ${fullSkillPath})`);
    }
  }

  return { type: 'claudecode', skillsCount };
}

/**
 * Gets a summary string for sync results
 */
export function formatSyncResult(result: SyncResult): string {
  const parts: string[] = [];

  if (result.type === 'aipm') {
    if (result.commandsCount > 0) {
      parts.push(`${result.commandsCount} command(s)`);
    }
    if (result.rulesCount > 0) {
      parts.push(`${result.rulesCount} rule(s)`);
    }
    if (result.agentsCount > 0) {
      parts.push(`${result.agentsCount} agent(s)`);
    }
    if (result.skillsCount > 0) {
      parts.push(`${result.skillsCount} skill(s)`);
    }
    if (result.hooksCount > 0) {
      parts.push(`${result.hooksCount} hook(s)`);
    }
  } else if (result.type === 'claudecode') {
    if (result.skillsCount > 0) {
      parts.push(`${result.skillsCount} skill(s)`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'no files';
}
