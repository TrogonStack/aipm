import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { pluginDisable } from '../../src/commands/plugin-disable';
import { pluginEnable } from '../../src/commands/plugin-enable';
import { loadPluginsConfig } from '../../src/config/loader';
import { writeJsonFile } from '../../src/helpers/fs';

describe('plugin enable/disable', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-plugin-toggle-'));
    await init({ cwd: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('plugin enable', () => {
    test('enables a disabled plugin', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'test-plugin@marketplace': {
          enabled: false,
        },
      };
      await writeJsonFile(pluginsPath, config);

      await pluginEnable({
        pluginId: 'test-plugin@marketplace',
        cwd: testDir,
      });

      const updatedConfig = await loadPluginsConfig(testDir);
      expect(updatedConfig?.plugins['test-plugin@marketplace']?.enabled).toBe(true);
    });

    test("adds and enables a new plugin if it doesn't exist", async () => {
      await pluginEnable({
        pluginId: 'new-plugin@marketplace',
        cwd: testDir,
      });

      const config = await loadPluginsConfig(testDir);
      expect(config?.plugins['new-plugin@marketplace']).toBeDefined();
      expect(config?.plugins['new-plugin@marketplace']?.enabled).toBe(true);
    });

    test('handles already enabled plugin', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'enabled-plugin@marketplace': {
          enabled: true,
        },
      };
      await writeJsonFile(pluginsPath, config);

      await pluginEnable({
        pluginId: 'enabled-plugin@marketplace',
        cwd: testDir,
      });

      const updatedConfig = await loadPluginsConfig(testDir);
      expect(updatedConfig?.plugins['enabled-plugin@marketplace']?.enabled).toBe(true);
    });

    test('enables plugin in plugins.local.json', async () => {
      const localPath = join(testDir, '.cursor', 'plugins.local.json');
      const localConfig = {
        plugins: {
          'local-plugin@marketplace': {
            enabled: false,
          },
        },
      };
      await writeJsonFile(localPath, localConfig);

      await pluginEnable({
        pluginId: 'local-plugin@marketplace',
        cwd: testDir,
        local: true,
      });

      const config = await loadPluginsConfig(testDir);
      expect(config?.plugins['local-plugin@marketplace']?.enabled).toBe(true);
    });

    test('preserves other plugin properties when enabling', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'test-plugin@marketplace': {
          enabled: false,
          version: '1.0.0',
          scope: 'project' as const,
        },
      };
      await writeJsonFile(pluginsPath, config);

      await pluginEnable({
        pluginId: 'test-plugin@marketplace',
        cwd: testDir,
      });

      const updatedConfig = await loadPluginsConfig(testDir);
      expect(updatedConfig?.plugins['test-plugin@marketplace']).toEqual({
        enabled: true,
        version: '1.0.0',
        scope: 'project',
      });
    });

    test('dry-run does not enable plugin', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'test-plugin@marketplace': {
          enabled: false,
        },
      };
      await writeJsonFile(pluginsPath, config);

      await pluginEnable({
        pluginId: 'test-plugin@marketplace',
        cwd: testDir,
        dryRun: true,
      });

      const updatedConfig = await loadPluginsConfig(testDir);
      expect(updatedConfig?.plugins['test-plugin@marketplace']?.enabled).toBe(false);
    });

    test('dry-run does not add new plugin', async () => {
      await pluginEnable({
        pluginId: 'new-plugin@marketplace',
        cwd: testDir,
        dryRun: true,
      });

      const updatedConfig = await loadPluginsConfig(testDir);
      expect(updatedConfig?.plugins['new-plugin@marketplace']).toBeUndefined();
    });
  });

  describe('plugin disable', () => {
    test('disables an enabled plugin', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'test-plugin@marketplace': {
          enabled: true,
        },
      };
      await writeJsonFile(pluginsPath, config);

      await pluginDisable({
        pluginId: 'test-plugin@marketplace',
        cwd: testDir,
      });

      const updatedConfig = await loadPluginsConfig(testDir);
      expect(updatedConfig?.plugins['test-plugin@marketplace']?.enabled).toBe(false);
    });

    test('handles non-existent plugin', async () => {
      await pluginDisable({
        pluginId: 'non-existent@marketplace',
        cwd: testDir,
      });

      const config = await loadPluginsConfig(testDir);
      expect(config?.plugins['non-existent@marketplace']).toBeUndefined();
    });

    test('handles already disabled plugin', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'disabled-plugin@marketplace': {
          enabled: false,
        },
      };
      await writeJsonFile(pluginsPath, config);

      await pluginDisable({
        pluginId: 'disabled-plugin@marketplace',
        cwd: testDir,
      });

      const updatedConfig = await loadPluginsConfig(testDir);
      expect(updatedConfig?.plugins['disabled-plugin@marketplace']?.enabled).toBe(false);
    });

    test('disables plugin in plugins.local.json', async () => {
      const localPath = join(testDir, '.cursor', 'plugins.local.json');
      const localConfig = {
        plugins: {
          'local-plugin@marketplace': {
            enabled: true,
          },
        },
      };
      await writeJsonFile(localPath, localConfig);

      await pluginDisable({
        pluginId: 'local-plugin@marketplace',
        cwd: testDir,
        local: true,
      });

      const config = await loadPluginsConfig(testDir);
      expect(config?.plugins['local-plugin@marketplace']?.enabled).toBe(false);
    });

    test('preserves other plugin properties when disabling', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'test-plugin@marketplace': {
          enabled: true,
          version: '2.0.0',
          scope: 'global' as const,
        },
      };
      await writeJsonFile(pluginsPath, config);

      await pluginDisable({
        pluginId: 'test-plugin@marketplace',
        cwd: testDir,
      });

      const updatedConfig = await loadPluginsConfig(testDir);
      expect(updatedConfig?.plugins['test-plugin@marketplace']).toEqual({
        enabled: false,
        version: '2.0.0',
        scope: 'global',
      });
    });

    test('dry-run does not disable plugin', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'test-plugin@marketplace': {
          enabled: true,
        },
      };
      await writeJsonFile(pluginsPath, config);

      await pluginDisable({
        pluginId: 'test-plugin@marketplace',
        cwd: testDir,
        dryRun: true,
      });

      const updatedConfig = await loadPluginsConfig(testDir);
      expect(updatedConfig?.plugins['test-plugin@marketplace']?.enabled).toBe(true);
    });
  });

  describe('validation', () => {
    test('validates empty plugin ID', async () => {
      try {
        await pluginEnable({
          pluginId: '',
          cwd: testDir,
        });
        throw new Error('Should have thrown validation error');
      } catch (error: any) {
        expect(error.name).toBe('ZodError');
      }
    });

    test('fails when plugins.json does not exist', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'cursor-empty-'));

      try {
        await pluginEnable({
          pluginId: 'test',
          cwd: emptyDir,
        });
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe('enable then disable workflow', () => {
    test('can enable and then disable a plugin', async () => {
      await pluginEnable({
        pluginId: 'toggle-plugin@marketplace',
        cwd: testDir,
      });

      let config = await loadPluginsConfig(testDir);
      expect(config?.plugins['toggle-plugin@marketplace']?.enabled).toBe(true);

      await pluginDisable({
        pluginId: 'toggle-plugin@marketplace',
        cwd: testDir,
      });

      config = await loadPluginsConfig(testDir);
      expect(config?.plugins['toggle-plugin@marketplace']?.enabled).toBe(false);
    });
  });
});
