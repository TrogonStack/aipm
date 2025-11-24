import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pluginUninstall } from '../../src/commands/plugin-uninstall';

import { fileExists } from '../../src/helpers/fs';

describe('plugin-uninstall', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
    await mkdir(join(testDir, '.cursor'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('basic uninstall', () => {
    test('should remove plugin from config', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './plugins' },
          },
          plugins: {
            'my-plugin@local': { enabled: true },
            'other-plugin@local': { enabled: true },
          },
        }),
      );

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
      expect(config.plugins['other-plugin@local']).toBeDefined();
    });

    test('should error if plugin not found', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {},
        }),
      );

      const options = {
        pluginId: 'nonexistent@local',
        cwd: testDir,
      };

      await expect(pluginUninstall(options)).rejects.toThrow();
    });

    test('should error if no plugins.json found', async () => {
      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
      };

      await expect(pluginUninstall(options)).rejects.toThrow();
    });
  });

  describe('local config', () => {
    test('should remove from plugins.local.json when local=true', async () => {
      const pluginsLocalPath = join(testDir, '.aipm', 'config.local.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsLocalPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {},
        }),
      );

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        local: true,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsLocalPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
    });
  });

  describe('removeFiles option', () => {
    test('should delete plugin files when removeFiles=true', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const pluginDir = join(testDir, '.cursor', 'commands', 'aipm', 'local', 'my-plugin');
      await mkdir(pluginDir, { recursive: true });
      await writeFile(join(pluginDir, 'test.txt'), 'test content');

      expect(await fileExists(pluginDir)).toBe(true);

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      expect(await fileExists(pluginDir)).toBe(false);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
    });

    test('should not delete plugin files when removeFiles=false', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const pluginDir = join(testDir, '.cursor', 'commands', 'aipm', 'local', 'my-plugin');
      await mkdir(pluginDir, { recursive: true });
      await writeFile(join(pluginDir, 'test.txt'), 'test content');

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        removeFiles: false,
      };

      await pluginUninstall(options);

      expect(await fileExists(pluginDir)).toBe(true);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
    });

    test('should handle missing plugin files gracefully', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
    });
  });

  describe('dry-run mode', () => {
    test('should not modify config in dry-run mode', async () => {
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const originalConfig = {
        marketplaces: { local: { source: 'directory', path: './plugins' } },
        plugins: {
          'my-plugin@local': { enabled: true },
        },
      };
      await writeFile(pluginsPath, JSON.stringify(originalConfig));

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        dryRun: true,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config).toEqual(originalConfig);
    });

    test('should not delete files in dry-run mode', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const pluginDir = join(testDir, '.cursor', 'commands', 'aipm', 'local', 'my-plugin');
      await mkdir(pluginDir, { recursive: true });
      await writeFile(join(pluginDir, 'test.txt'), 'test content');

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        dryRun: true,
        removeFiles: true,
      };

      await pluginUninstall(options);

      expect(await fileExists(pluginDir)).toBe(true);
    });
  });

  describe('validation', () => {
    test('should reject empty pluginId', async () => {
      const options = {
        pluginId: '',
        cwd: testDir,
      };

      await expect(pluginUninstall(options)).rejects.toThrow();
    });

    test('should handle pluginId without @ separator', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin': { enabled: true },
          },
        }),
      );

      const pluginDir = join(testDir, '.cursor', 'commands', 'aipm');
      await mkdir(pluginDir, { recursive: true });

      const options = {
        pluginId: 'my-plugin',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin']).toBeUndefined();
    });
  });

  describe('multiple plugins', () => {
    test('should only remove specified plugin', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'plugin-a@local': { enabled: true },
            'plugin-b@local': { enabled: true },
            'plugin-c@local': { enabled: false },
          },
        }),
      );

      const options = {
        pluginId: 'plugin-b@local',
        cwd: testDir,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['plugin-a@local']).toBeDefined();
      expect(config.plugins['plugin-b@local']).toBeUndefined();
      expect(config.plugins['plugin-c@local']).toBeDefined();
    });
  });
});
