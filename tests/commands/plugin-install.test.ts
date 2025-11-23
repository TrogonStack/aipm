import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pluginInstall } from '../../src/commands/plugin-install';

import { fileExists } from '../../src/helpers/fs';
import { createTestPlugin } from '../helpers/plugin';

describe('plugin-install', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
    await mkdir(join(testDir, '.cursor'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('basic install', () => {
    test('should install a plugin from local marketplace', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(marketplaceDir, { recursive: true });
      await createTestPlugin(marketplaceDir, 'test-plugin', {
        commands: ['test'],
      });

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
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
        pluginId: 'test-plugin@local',
        cwd: testDir,
      };

      await pluginInstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['test-plugin@local']).toBeDefined();
      expect(config.plugins['test-plugin@local'].enabled).toBe(true);

      const commandsPath = join(testDir, '.cursor', 'commands', 'local', 'test-plugin', 'test.md');
      expect(await fileExists(commandsPath)).toBe(true);
    });

    test('should error if marketplace not found', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {},
          plugins: {},
        }),
      );

      const options = {
        pluginId: 'test-plugin@nonexistent',
        cwd: testDir,
      };

      await expect(pluginInstall(options)).rejects.toThrow("Marketplace 'nonexistent' not found");
    });

    test('should error if plugin not found in marketplace', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(marketplaceDir, { recursive: true });

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
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

      await expect(pluginInstall(options)).rejects.toThrow("Plugin 'nonexistent' not found in marketplace 'local'");
    });

    test('should error if no plugins.json found', async () => {
      const options = {
        pluginId: 'test-plugin@local',
        cwd: testDir,
      };

      await expect(pluginInstall(options)).rejects.toThrow('No .aipm/config.json or .aipm/config.local.json found');
    });

    test('should error if invalid plugin ID format', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {},
          plugins: {},
        }),
      );

      const options = {
        pluginId: 'invalid-format',
        cwd: testDir,
      };

      await expect(pluginInstall(options)).rejects.toThrow('Invalid plugin ID format');
    });
  });

  describe('already installed', () => {
    test('should skip if plugin already enabled', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      const pluginDir = join(marketplaceDir, 'test-plugin');
      await mkdir(join(pluginDir, '.claude-plugin'), { recursive: true });
      await writeFile(
        join(pluginDir, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
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

      await pluginInstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['test-plugin@local'].enabled).toBe(true);
    });

    test('should reinstall with --force flag', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await createTestPlugin(marketplaceDir, 'test-plugin', {
        version: '2.0.0',
        commands: ['test'],
      });

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
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
        force: true,
      };

      await pluginInstall(options);

      const commandsPath = join(testDir, '.cursor', 'commands', 'local', 'test-plugin', 'test.md');
      expect(await fileExists(commandsPath)).toBe(true);
    });
  });

  describe('local config', () => {
    test('should install to plugins.local.json when local=true', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      const pluginDir = join(marketplaceDir, 'test-plugin');
      await mkdir(join(pluginDir, '.claude-plugin'), { recursive: true });
      await writeFile(
        join(pluginDir, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {},
        }),
      );

      const pluginsLocalPath = join(testDir, '.aipm', 'config.local.json');
      await writeFile(
        pluginsLocalPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {},
        }),
      );

      const options = {
        pluginId: 'test-plugin@local',
        cwd: testDir,
        local: true,
      };

      await pluginInstall(options);

      const config = JSON.parse(await Bun.file(pluginsLocalPath).text());
      expect(config.plugins['test-plugin@local']).toBeDefined();
      expect(config.plugins['test-plugin@local'].enabled).toBe(true);
    });
  });

  describe('dry-run mode', () => {
    test('should not modify config or install files in dry-run mode', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      const pluginDir = join(marketplaceDir, 'test-plugin');
      await mkdir(join(pluginDir, '.claude-plugin'), { recursive: true });
      await writeFile(
        join(pluginDir, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name: 'test-plugin',
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const originalConfig = {
        marketplaces: {
          local: { source: 'directory', path: './marketplace' },
        },
        plugins: {},
      };
      await writeFile(pluginsPath, JSON.stringify(originalConfig));

      const options = {
        pluginId: 'test-plugin@local',
        cwd: testDir,
        dryRun: true,
      };

      await pluginInstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config).toEqual(originalConfig);

      const commandsPath = join(testDir, '.cursor', 'commands', 'local', 'test-plugin');
      expect(await fileExists(commandsPath)).toBe(false);
    });
  });

  describe('marketplace.json support', () => {
    test('should install plugin from marketplace with manifest', async () => {
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
        commands: ['test'],
      });

      const manifestPath = join(customPluginParentDir, 'plugin', '.claude-plugin', 'plugin.json');
      const manifest = JSON.parse(await Bun.file(manifestPath).text());
      manifest.name = 'custom-plugin';
      await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
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
        pluginId: 'custom-plugin@local',
        cwd: testDir,
      };

      await pluginInstall(options);

      const commandsPath = join(testDir, '.cursor', 'commands', 'local', 'custom-plugin', 'test.md');
      expect(await fileExists(commandsPath)).toBe(true);
    });
  });

  describe('validation', () => {
    test('should reject empty pluginId', async () => {
      const options = {
        pluginId: '',
        cwd: testDir,
      };

      await expect(pluginInstall(options)).rejects.toThrow();
    });
  });

  describe('multiple plugins', () => {
    test('should not affect other installed plugins', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(marketplaceDir, { recursive: true });

      const plugin1Dir = join(marketplaceDir, 'plugin-1');
      await mkdir(join(plugin1Dir, '.claude-plugin'), { recursive: true });
      await writeFile(
        join(plugin1Dir, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name: 'plugin-1',
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      const plugin2Dir = join(marketplaceDir, 'plugin-2');
      await mkdir(join(plugin2Dir, '.claude-plugin'), { recursive: true });
      await writeFile(
        join(plugin2Dir, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name: 'plugin-2',
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {
            'plugin-1@local': { enabled: true },
          },
        }),
      );

      const installed1Path = join(testDir, '.cursor', 'marketplace', 'local', 'plugin-1');
      await mkdir(join(installed1Path, '.claude-plugin'), { recursive: true });
      await writeFile(
        join(installed1Path, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name: 'plugin-1',
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      const options = {
        pluginId: 'plugin-2@local',
        cwd: testDir,
      };

      await pluginInstall(options);

      expect(await fileExists(installed1Path)).toBe(true);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['plugin-1@local']).toBeDefined();
      expect(config.plugins['plugin-2@local']).toBeDefined();
    });
  });
});
