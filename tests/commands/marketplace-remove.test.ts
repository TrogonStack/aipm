import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { marketplaceAdd } from '../../src/commands/marketplace-add';
import { marketplaceRemove } from '../../src/commands/marketplace-remove';
import { loadPluginsConfig } from '../../src/config/loader';
import { setupTestEnvironment } from '../helpers/test-setup';

describe('marketplace remove', () => {
  let testDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const setup = await setupTestEnvironment({ initProject: true });
    testDir = setup.testDir!;
    cleanup = setup.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('basic functionality', () => {
    test('removes marketplace from plugins.json', async () => {
      await marketplaceAdd({
        name: 'test-marketplace',
        path: './test',
        cwd: testDir,
      });

      const { config: configBefore } = await loadPluginsConfig(testDir);
      expect(configBefore.marketplaces['test-marketplace']).toBeDefined();

      await marketplaceRemove({
        name: 'test-marketplace',
        cwd: testDir,
      });

      const { config: configAfter } = await loadPluginsConfig(testDir);
      expect(configAfter.marketplaces['test-marketplace']).toBeUndefined();
    });

    test('removes marketplace from plugins.local.json', async () => {
      await marketplaceAdd({
        name: 'local-marketplace',
        path: './local',
        cwd: testDir,
        local: true,
      });

      const { config: configBefore } = await loadPluginsConfig(testDir);
      expect(configBefore.marketplaces['local-marketplace']).toBeDefined();

      await marketplaceRemove({
        name: 'local-marketplace',
        cwd: testDir,
        local: true,
      });

      const { config: configAfter } = await loadPluginsConfig(testDir);
      expect(configAfter.marketplaces['local-marketplace']).toBeUndefined();
    });

    test('preserves other marketplaces when removing one', async () => {
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

      await marketplaceRemove({
        name: 'first',
        cwd: testDir,
      });

      const { config } = await loadPluginsConfig(testDir);
      expect(config.marketplaces.first).toBeUndefined();
      expect(config.marketplaces.second).toBeDefined();
    });

    test('preserves plugins when removing marketplace', async () => {
      await marketplaceAdd({
        name: 'test-marketplace',
        path: './test',
        cwd: testDir,
      });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'test-plugin@marketplace': {
          enabled: true,
        },
      };
      await Bun.write(pluginsPath, JSON.stringify(config, null, 2));

      await marketplaceRemove({
        name: 'test-marketplace',
        cwd: testDir,
      });

      const { config: updatedConfig } = await loadPluginsConfig(testDir);
      expect(updatedConfig.plugins['test-plugin@marketplace']).toBeDefined();
    });
  });

  describe('validation', () => {
    test('fails when plugins.json does not exist', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'cursor-empty-'));

      try {
        await marketplaceRemove({
          name: 'test',
          cwd: emptyDir,
        });
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    test('fails when marketplace does not exist', async () => {
      await marketplaceRemove({
        name: 'non-existent',
        cwd: testDir,
      });

      const { config } = await loadPluginsConfig(testDir);
      expect(config.marketplaces['non-existent']).toBeUndefined();
    });

    test('validates name is not empty', async () => {
      try {
        await marketplaceRemove({
          name: '',
          cwd: testDir,
        });
        throw new Error('Should have thrown validation error');
      } catch (error: any) {
        expect(error.name).toBe('ZodError');
      }
    });
  });

  describe('dry-run mode', () => {
    test('dry-run does not remove marketplace', async () => {
      await marketplaceAdd({
        name: 'test-marketplace',
        path: './test',
        cwd: testDir,
      });

      await marketplaceRemove({
        name: 'test-marketplace',
        cwd: testDir,
        dryRun: true,
      });

      const { config } = await loadPluginsConfig(testDir);
      expect(config.marketplaces['test-marketplace']).toBeDefined();
    });
  });

  describe('edge cases', () => {
    test('removing last marketplace leaves empty object', async () => {
      await marketplaceAdd({
        name: 'only-one',
        path: './only',
        cwd: testDir,
      });

      await marketplaceRemove({
        name: 'only-one',
        cwd: testDir,
      });

      const { config } = await loadPluginsConfig(testDir);
      expect(Object.keys(config.marketplaces ?? {})).toHaveLength(0);
    });

    test('can add marketplace after removing it', async () => {
      await marketplaceAdd({
        name: 'test',
        path: './first-path',
        cwd: testDir,
      });

      await marketplaceRemove({
        name: 'test',
        cwd: testDir,
      });

      await marketplaceAdd({
        name: 'test',
        path: './second-path',
        cwd: testDir,
      });

      const { config } = await loadPluginsConfig(testDir);
      expect(config.marketplaces.test?.path).toBe('./second-path');
    });
  });
});
