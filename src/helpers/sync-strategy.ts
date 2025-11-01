import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { DirectoryNotFoundError, isNodeError } from '../errors';
import { applyCursorFrontmatter } from './frontmatter';
import { ensureDir, fileExists } from './fs';

export type SyncResult = {
  commandsCount: number;
  rulesCount: number;
  agentsCount: number;
  skillsCount: number;
  hooksCount: number;
};

/**
 * Syncs a plugin to the correct Cursor directories:
 * - commands/*.md → .cursor/commands/marketplace-name/plugin-name/
 * - rules/*.mdc → .cursor/rules/marketplace-name/plugin-name/
 * - agents/*.md → .cursor/agents/marketplace-name/plugin-name/
 * - skills/*.md → .cursor/skills/marketplace-name/plugin-name/
 * - hooks/* → .cursor/hooks/marketplace-name/plugin-name/
 */
export async function syncPluginToCursor(
  pluginPath: string,
  marketplaceName: string,
  pluginName: string,
  cursorDir: string,
): Promise<SyncResult> {
  const result: SyncResult = {
    commandsCount: 0,
    rulesCount: 0,
    agentsCount: 0,
    skillsCount: 0,
    hooksCount: 0,
  };

  // Sync commands/*.md to .cursor/commands/marketplace/plugin/
  const commandsResult = await syncDirectory(
    join(pluginPath, 'commands'),
    join(cursorDir, 'commands', marketplaceName, pluginName),
    ['.md'],
  );
  result.commandsCount = commandsResult;

  // Sync rules/*.md and *.mdc to .cursor/rules/marketplace/plugin/
  // Apply .cursor.yaml frontmatter overrides if they exist
  const rulesResult = await syncRulesDirectory(
    join(pluginPath, 'rules'),
    join(cursorDir, 'rules', marketplaceName, pluginName),
  );
  result.rulesCount = rulesResult;

  // Sync agents/*.md to .cursor/agents/marketplace/plugin/
  const agentsResult = await syncDirectory(
    join(pluginPath, 'agents'),
    join(cursorDir, 'agents', marketplaceName, pluginName),
    ['.md'],
  );
  result.agentsCount = agentsResult;

  // Sync skills/*.md to .cursor/skills/marketplace/plugin/
  const skillsResult = await syncDirectory(
    join(pluginPath, 'skills'),
    join(cursorDir, 'skills', marketplaceName, pluginName),
    ['.md'],
  );
  result.skillsCount = skillsResult;

  // Sync hooks/* to .cursor/hooks/marketplace/plugin/
  const hooksResult = await syncDirectory(
    join(pluginPath, 'hooks'),
    join(cursorDir, 'hooks', marketplaceName, pluginName),
    [], // Copy all files in hooks
  );
  result.hooksCount = hooksResult;

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
    if (isNodeError(error) && error.code === 'ENOENT') {
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
    if (isNodeError(error) && error.code === 'ENOENT') {
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
 * Gets a summary string for sync results
 */
export function formatSyncResult(result: SyncResult): string {
  const parts: string[] = [];

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

  return parts.length > 0 ? parts.join(', ') : 'no files';
}
