import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { marketplaceAdd } from '../../src/commands/marketplace-add';
import { loadPluginsConfig } from '../../src/config/loader';
import { fileExists } from '../../src/helpers/fs';

describe('marketplace add', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-add-'));
    await init({ cwd: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('basic functionality', () => {
    test('adds marketplace to plugins.json', async () => {
      await marketplaceAdd({
        name: 'local-plugins',
        path: './my-plugins',
        cwd: testDir,
      });

      const config = await loadPluginsConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.marketplaces['local-plugins']).toBeDefined();
      expect(config?.marketplaces['local-plugins']?.source).toBe('directory');
      expect(config?.marketplaces['local-plugins']?.path).toBe('./my-plugins');
    });

    test('adds marketplace to plugins.local.json', async () => {
      await marketplaceAdd({
        name: 'dev-plugins',
        path: '../dev-plugins',
        cwd: testDir,
        local: true,
      });

      const config = await loadPluginsConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.marketplaces['dev-plugins']).toBeDefined();
      expect(config?.marketplaces['dev-plugins']?.source).toBe('directory');
      expect(config?.marketplaces['dev-plugins']?.path).toBe('../dev-plugins');
    });

    test('supports absolute paths', async () => {
      const absolutePath = '/absolute/path/to/plugins';

      await marketplaceAdd({
        name: 'abs-plugins',
        path: absolutePath,
        cwd: testDir,
      });

      const config = await loadPluginsConfig(testDir);
      expect(config?.marketplaces['abs-plugins']?.path).toBe(absolutePath);
    });
  });

  describe('validation', () => {
    test('fails when plugins.json does not exist', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'cursor-empty-'));

      try {
        await marketplaceAdd({
          name: 'test',
          path: './plugins',
          cwd: emptyDir,
        });
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    test('prevents duplicate marketplace names', async () => {
      await marketplaceAdd({
        name: 'my-plugins',
        path: './plugins1',
        cwd: testDir,
      });

      await marketplaceAdd({
        name: 'my-plugins',
        path: './plugins2',
        cwd: testDir,
      });

      const config = await loadPluginsConfig(testDir);
      expect(config?.marketplaces['my-plugins']?.path).toBe('./plugins1');
    });

    test('validates name is not empty', async () => {
      try {
        await marketplaceAdd({
          name: '',
          path: './plugins',
          cwd: testDir,
        });
        throw new Error('Should have thrown validation error');
      } catch (error: any) {
        expect(error.name).toBe('ZodError');
      }
    });

    test('validates path is not empty', async () => {
      try {
        await marketplaceAdd({
          name: 'test',
          path: '',
          cwd: testDir,
        });
        throw new Error('Should have thrown validation error');
      } catch (error: any) {
        expect(error.name).toBe('ZodError');
      }
    });
  });

  describe('dry-run mode', () => {
    test('dry-run does not modify config', async () => {
      const configBefore = await loadPluginsConfig(testDir);

      await marketplaceAdd({
        name: 'test-plugins',
        path: './test',
        cwd: testDir,
        dryRun: true,
      });

      const configAfter = await loadPluginsConfig(testDir);
      expect(configAfter).toEqual(configBefore);
      expect(configAfter?.marketplaces['test-plugins']).toBeUndefined();
    });

    test('dry-run with local flag does not create local config', async () => {
      const localPath = join(testDir, '.cursor', 'plugins.local.json');

      await marketplaceAdd({
        name: 'local-test',
        path: './local',
        cwd: testDir,
        local: true,
        dryRun: true,
      });

      expect(await fileExists(localPath)).toBe(false);
    });
  });

  describe('config merging', () => {
    test('preserves existing marketplaces when adding new one', async () => {
      await marketplaceAdd({
        name: 'first',
        path: './first',
        cwd: testDir,
      });

      await marketplaceAdd({
        name: 'second',
        path: './second',
        cwd: testDir,
      });

      const config = await loadPluginsConfig(testDir);
      expect(Object.keys(config?.marketplaces ?? {})).toHaveLength(2);
      expect(config?.marketplaces.first).toBeDefined();
      expect(config?.marketplaces.second).toBeDefined();
    });

    test('preserves existing plugins when adding marketplace', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const initialConfig = await Bun.file(pluginsPath).json();
      initialConfig.plugins = {
        'test-plugin@marketplace': {
          enabled: true,
        },
      };
      await Bun.write(pluginsPath, JSON.stringify(initialConfig, null, 2));

      await marketplaceAdd({
        name: 'new-marketplace',
        path: './new',
        cwd: testDir,
      });

      const config = await loadPluginsConfig(testDir);
      expect(config?.plugins['test-plugin@marketplace']).toBeDefined();
      expect(config?.marketplaces['new-marketplace']).toBeDefined();
    });
  });
});
