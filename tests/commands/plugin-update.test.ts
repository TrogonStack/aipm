import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pluginUpdate } from '../../src/commands/plugin-update';

import { fileExists } from '../../src/helpers/fs';
import { createTestPlugin } from '../helpers/plugin';

describe('plugin-update', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
    await mkdir(join(testDir, '.cursor'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('basic update', () => {
    test('should update an installed plugin', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await createTestPlugin(marketplaceDir, 'test-plugin', {
        version: '2.0.0',
        commands: ['test', 'updated'],
      });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {
            'test-plugin@local': { enabled: true },
          },
        }),
      );

      const options = {
        pluginId: 'test-plugin@local',
        cwd: testDir,
      };

      await pluginUpdate(options);

      const updatedCommandPath = join(testDir, '.cursor', 'commands', 'local', 'test-plugin', 'updated.md');
      expect(await fileExists(updatedCommandPath)).toBe(true);
    });

    test('should error if plugin not installed', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {},
        }),
      );

      const options = {
        pluginId: 'nonexistent@local',
        cwd: testDir,
      };

      await expect(pluginUpdate(options)).rejects.toThrow("Plugin 'nonexistent@local' is not installed");
    });

    test('should error if marketplace not found', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {},
          plugins: {
            'test-plugin@local': { enabled: true },
          },
        }),
      );

      const options = {
        pluginId: 'test-plugin@local',
        cwd: testDir,
      };

      await expect(pluginUpdate(options)).rejects.toThrow("Marketplace 'local' not found");
    });

    test('should error if plugin not found in marketplace', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(marketplaceDir, { recursive: true });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {
            'nonexistent@local': { enabled: true },
          },
        }),
      );

      const options = {
        pluginId: 'nonexistent@local',
        cwd: testDir,
      };

      await expect(pluginUpdate(options)).rejects.toThrow("Plugin 'nonexistent' not found in marketplace 'local'");
    });

    test('should error if no plugins.json found', async () => {
      const options = {
        pluginId: 'test-plugin@local',
        cwd: testDir,
      };

      await expect(pluginUpdate(options)).rejects.toThrow('No plugins.json found');
    });

    test('should error if invalid plugin ID format', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {},
          plugins: {
            'invalid-format': { enabled: true },
          },
        }),
      );

      const options = {
        pluginId: 'invalid-format',
        cwd: testDir,
      };

      await expect(pluginUpdate(options)).rejects.toThrow('Invalid plugin ID format');
    });
  });

  describe('dry-run mode', () => {
    test('should not update files in dry-run mode', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await createTestPlugin(marketplaceDir, 'test-plugin', {
        version: '2.0.0',
        commands: ['test', 'new'],
      });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {
            'test-plugin@local': { enabled: true },
          },
        }),
      );

      await mkdir(join(testDir, '.cursor', 'commands', 'local', 'test-plugin'), { recursive: true });
      await writeFile(join(testDir, '.cursor', 'commands', 'local', 'test-plugin', 'test.md'), '# Old version');

      const options = {
        pluginId: 'test-plugin@local',
        cwd: testDir,
        dryRun: true,
      };

      await pluginUpdate(options);

      const newCommandPath = join(testDir, '.cursor', 'commands', 'local', 'test-plugin', 'new.md');
      expect(await fileExists(newCommandPath)).toBe(false);
    });
  });

  describe('marketplace.json support', () => {
    test('should update plugin with custom path from manifest', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(marketplaceDir, { recursive: true });

      await writeFile(
        join(marketplaceDir, 'marketplace.json'),
        JSON.stringify({
          name: 'test-marketplace',
          owner: { name: 'Test Owner' },
          plugins: [
            {
              name: 'custom-plugin',
              source: './custom/path/plugin',
            },
          ],
        }),
      );

      const customPluginParentDir = join(marketplaceDir, 'custom', 'path');
      await mkdir(customPluginParentDir, { recursive: true });
      await createTestPlugin(customPluginParentDir, 'plugin', {
        version: '3.0.0',
        commands: ['test', 'updated'],
      });

      const manifestPath = join(customPluginParentDir, 'plugin', '.claude-plugin', 'plugin.json');
      const manifest = JSON.parse(await Bun.file(manifestPath).text());
      manifest.name = 'custom-plugin';
      await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {
            'custom-plugin@local': { enabled: true },
          },
        }),
      );

      const options = {
        pluginId: 'custom-plugin@local',
        cwd: testDir,
      };

      await pluginUpdate(options);

      const updatedCommandPath = join(testDir, '.cursor', 'commands', 'local', 'custom-plugin', 'updated.md');
      expect(await fileExists(updatedCommandPath)).toBe(true);
    });
  });

  describe('validation', () => {
    test('should reject empty pluginId', async () => {
      const options = {
        pluginId: '',
        cwd: testDir,
      };

      await expect(pluginUpdate(options)).rejects.toThrow();
    });
  });
});
