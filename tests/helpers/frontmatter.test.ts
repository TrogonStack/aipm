import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyCursorFrontmatter, parseFrontmatter, serializeFrontmatter } from '../../src/helpers/frontmatter';

describe('frontmatter utilities', () => {
  describe('parseFrontmatter', () => {
    test('parses frontmatter from markdown', () => {
      const content = `---
alwaysApply: true
description: Test
---

# My Content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toEqual({
        alwaysApply: true,
        description: 'Test',
      });
      expect(result.content).toBe('# My Content');
    });

    test('handles markdown without frontmatter', () => {
      const content = '# Just Content';

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toBe(null);
      expect(result.content).toBe('# Just Content');
    });

    test('handles empty frontmatter', () => {
      const content = `---
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result.frontmatter).toBe(null);
      expect(result.content).toBe('# Content');
    });
  });

  describe('serializeFrontmatter', () => {
    test('serializes frontmatter and content', () => {
      const frontmatter = {
        alwaysApply: false,
        description: 'Test rule',
      };
      const content = '# My Rule';

      const result = serializeFrontmatter(frontmatter, content);

      expect(result).toContain('---');
      expect(result).toContain('alwaysApply: false');
      expect(result).toContain('description: Test rule');
      expect(result).toContain('# My Rule');
    });

    test('returns content only when frontmatter is null', () => {
      const content = '# Content';

      const result = serializeFrontmatter(null, content);

      expect(result).toBe('# Content');
    });

    test('returns content only when frontmatter is empty', () => {
      const content = '# Content';

      const result = serializeFrontmatter({}, content);

      expect(result).toBe('# Content');
    });
  });

  describe('applyCursorFrontmatter', () => {
    let testDir: string;

    test('applies cursor yaml override to markdown content', async () => {
      testDir = await mkdtemp(join(tmpdir(), 'frontmatter-test-'));

      const sourceContent = `---
alwaysApply: true
---

# My Rule Content`;

      const cursorYamlPath = join(testDir, 'test.cursor.yaml');
      await writeFile(
        cursorYamlPath,
        `cursorSetting: value
anotherSetting: true`,
      );

      const result = await applyCursorFrontmatter(sourceContent, cursorYamlPath);

      expect(result).toContain('cursorSetting: value');
      expect(result).toContain('anotherSetting: true');
      expect(result).toContain('# My Rule Content');
      expect(result).not.toContain('alwaysApply');

      await rm(testDir, { recursive: true, force: true });
    });

    test('returns original content when cursor yaml does not exist', async () => {
      testDir = await mkdtemp(join(tmpdir(), 'frontmatter-test-'));

      const sourceContent = `---
alwaysApply: true
---

# Content`;

      const cursorYamlPath = join(testDir, 'nonexistent.cursor.yaml');

      const result = await applyCursorFrontmatter(sourceContent, cursorYamlPath);

      expect(result).toBe(sourceContent);

      await rm(testDir, { recursive: true, force: true });
    });

    test('handles content without frontmatter', async () => {
      testDir = await mkdtemp(join(tmpdir(), 'frontmatter-test-'));

      const sourceContent = '# Just Content';

      const cursorYamlPath = join(testDir, 'test.cursor.yaml');
      await writeFile(cursorYamlPath, `newSetting: value`);

      const result = await applyCursorFrontmatter(sourceContent, cursorYamlPath);

      expect(result).toContain('newSetting: value');
      expect(result).toContain('# Just Content');

      await rm(testDir, { recursive: true, force: true });
    });
  });
});
