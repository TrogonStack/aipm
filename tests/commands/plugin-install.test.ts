import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pluginInstall } from '../../src/commands/plugin-install';
import { fileExists } from '../../src/helpers/fs';

describe('plugin-install', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
    await mkdir(join(testDir, '.cursor'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Claude Code marketplace integration (zero-config)', () => {
    test('should install a plugin from Claude Code without init', async () => {
      // AIPM auto-discovers Claude Code marketplaces without requiring configuration
      // No .aipm/ directory needed
      const options = {
        pluginId: 'document-skills@claude/anthropic-agent-skills',
        cwd: testDir,
      };

      await pluginInstall(options);

      // Verify skills were synced to .cursor/
      const skillsDir = join(testDir, '.cursor', 'skills');
      expect(await fileExists(skillsDir)).toBe(true);

      // Verify each skill gets its own flattened directory (no nesting)
      // Addresses Claude Code limitation with nested skill directories
      const xlsxSkillDir = join(skillsDir, 'aipm-claude-anthropic-agent-skills-document-skills-xlsx');
      expect(await fileExists(xlsxSkillDir)).toBe(true);

      // Verify internal structure is preserved within the skill
      const skillMd = join(xlsxSkillDir, 'SKILL.md');
      expect(await fileExists(skillMd)).toBe(true);
    });

    test('should error if marketplace not found in Claude Code', async () => {
      const options = {
        pluginId: 'some-plugin@claude/nonexistent-marketplace',
        cwd: testDir,
      };

      await expect(pluginInstall(options)).rejects.toThrow(
        "Marketplace 'claude/nonexistent-marketplace' not found in Claude Code",
      );
    });

    test('should work from any directory without project setup', async () => {
      // Zero-config means no .aipm/ directory or initialization needed
      const options = {
        pluginId: 'example-skills@claude/anthropic-agent-skills',
        cwd: testDir,
      };

      // Should succeed without any config files or aipm init
      await pluginInstall(options);

      // Verify the plugin was installed to .cursor/
      const skillsDir = join(testDir, '.cursor', 'skills');
      expect(await fileExists(skillsDir)).toBe(true);
    });
  });
});
