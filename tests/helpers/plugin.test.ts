import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPluginManifest, validatePluginStructure } from '../../src/helpers/plugin';

describe('plugin', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadPluginManifest', () => {
    test('should load valid plugin.json', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');
      await mkdir(claudePluginDir, { recursive: true });

      await writeFile(
        join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      const manifest = await loadPluginManifest(pluginDir);
      expect(manifest.name).toBe('test-plugin');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.author).toBe('Test Author');
    });

    test('should load plugin.json with object author', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');
      await mkdir(claudePluginDir, { recursive: true });

      await writeFile(
        join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          author: {
            name: 'Test Author',
            email: 'test@example.com',
          },
        }),
      );

      const manifest = await loadPluginManifest(pluginDir);
      expect(manifest.author).toEqual({
        name: 'Test Author',
        email: 'test@example.com',
      });
    });

    test('should error if plugin.json not found', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      await mkdir(pluginDir, { recursive: true });

      await expect(loadPluginManifest(pluginDir)).rejects.toThrow('Plugin manifest not found');
    });

    test('should error if plugin.json is invalid JSON', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');
      await mkdir(claudePluginDir, { recursive: true });

      await writeFile(join(claudePluginDir, 'plugin.json'), 'invalid json {');

      await expect(loadPluginManifest(pluginDir)).rejects.toThrow('Invalid plugin.json');
    });

    test('should error if missing required fields', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');
      await mkdir(claudePluginDir, { recursive: true });

      await writeFile(
        join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          // missing version and author
        }),
      );

      await expect(loadPluginManifest(pluginDir)).rejects.toThrow('Invalid plugin.json');
    });

    test('should allow optional fields', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');
      await mkdir(claudePluginDir, { recursive: true });

      await writeFile(
        join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          author: 'Test Author',
          description: 'A test plugin',
          homepage: 'https://example.com',
          repository: 'https://github.com/test/plugin',
        }),
      );

      const manifest = await loadPluginManifest(pluginDir);
      expect(manifest.description).toBe('A test plugin');
      expect(manifest.homepage).toBe('https://example.com');
      expect(manifest.repository).toBe('https://github.com/test/plugin');
    });
  });

  describe('validatePluginStructure', () => {
    test('should validate plugin with all required fields', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');
      await mkdir(claudePluginDir, { recursive: true });

      await writeFile(
        join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      await expect(validatePluginStructure(pluginDir)).resolves.toBeUndefined();
    });

    test('should error if name is missing', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');
      await mkdir(claudePluginDir, { recursive: true });

      await writeFile(
        join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      await expect(validatePluginStructure(pluginDir)).rejects.toThrow();
    });

    test('should error if version is missing', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');
      await mkdir(claudePluginDir, { recursive: true });

      await writeFile(
        join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          author: 'Test Author',
        }),
      );

      await expect(validatePluginStructure(pluginDir)).rejects.toThrow();
    });

    test('should error if author is missing', async () => {
      const pluginDir = join(testDir, 'test-plugin');
      const claudePluginDir = join(pluginDir, '.claude-plugin');
      await mkdir(claudePluginDir, { recursive: true });

      await writeFile(
        join(claudePluginDir, 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
        }),
      );

      await expect(validatePluginStructure(pluginDir)).rejects.toThrow();
    });
  });
});
