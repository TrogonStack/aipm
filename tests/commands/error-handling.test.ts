import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { list } from '../../src/commands/list';
import { marketplaceAdd } from '../../src/commands/marketplace-add';
import { marketplaceRemove } from '../../src/commands/marketplace-remove';
import { pluginDisable } from '../../src/commands/plugin-disable';
import { pluginEnable } from '../../src/commands/plugin-enable';
import { sync } from '../../src/commands/sync';
import * as loader from '../../src/config/loader';

describe('command error handling', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-error-test-'));
    await init({ cwd: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('list command', () => {
    test('catches and logs errors from loadPluginsConfig', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockImplementation(() => {
        throw new Error('Config load failed');
      });

      await expect(list({ cwd: testDir })).rejects.toThrow('Config load failed');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('sync command', () => {
    test('catches and logs errors during sync', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockImplementation(() => {
        throw new Error('Sync failed');
      });

      await expect(sync({ cwd: testDir })).rejects.toThrow('Sync failed');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('marketplace-add command', () => {
    test('catches and logs errors during add', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockImplementation(() => {
        throw new Error('Add failed');
      });

      await expect(marketplaceAdd({ name: 'test', path: '/test', cwd: testDir })).rejects.toThrow('Add failed');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    test('handles empty config from loadPluginsConfig', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockResolvedValue({
        config: { marketplaces: {}, plugins: {} },
        sources: { project: '/test/.aipm/config.json', global: null, local: null, claude: null },
      });

      await marketplaceAdd({ name: 'test', path: '/test', cwd: testDir });

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('marketplace-remove command', () => {
    test('catches and logs errors during remove', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockImplementation(() => {
        throw new Error('Remove failed');
      });

      await expect(marketplaceRemove({ name: 'test', cwd: testDir })).rejects.toThrow('Remove failed');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    test('handles empty config from loadPluginsConfig', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockResolvedValue({
        config: { marketplaces: {}, plugins: {} },
        sources: { project: '/test/.aipm/config.json', global: null, local: null, claude: null },
      });

      await marketplaceRemove({ name: 'test', cwd: testDir });

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('plugin-enable command', () => {
    test('catches and logs errors during enable', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockImplementation(() => {
        throw new Error('Enable failed');
      });

      await expect(pluginEnable({ pluginId: 'test@marketplace', cwd: testDir })).rejects.toThrow('Enable failed');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    test('handles empty config from loadPluginsConfig', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockResolvedValue({
        config: { marketplaces: {}, plugins: {} },
        sources: { project: '/test/.aipm/config.json', global: null, local: null, claude: null },
      });

      await pluginEnable({ pluginId: 'test@marketplace', cwd: testDir });

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('plugin-disable command', () => {
    test('catches and logs errors during disable', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockImplementation(() => {
        throw new Error('Disable failed');
      });

      await expect(pluginDisable({ pluginId: 'test@marketplace', cwd: testDir })).rejects.toThrow('Disable failed');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    test('handles empty config from loadPluginsConfig', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockResolvedValue({
        config: { marketplaces: {}, plugins: {} },
        sources: { project: '/test/.aipm/config.json', global: null, local: null, claude: null },
      });

      await pluginDisable({ pluginId: 'test@marketplace', cwd: testDir });

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    test('handles missing plugins.json file', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'cursor-empty-'));

      try {
        await pluginDisable({ pluginId: 'test@marketplace', cwd: emptyDir });
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe('sync command', () => {
    test('handles missing plugins.json file', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'cursor-empty-'));

      try {
        await sync({ cwd: emptyDir });
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    test('handles empty config from loadPluginsConfig', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockResolvedValue({
        config: { marketplaces: {}, plugins: {} },
        sources: { project: '/test/.aipm/config.json', global: null, local: null, claude: null },
      });
      const emptyDir = await mkdtemp(join(tmpdir(), 'cursor-empty-'));

      try {
        await init({ cwd: emptyDir });
        await sync({ cwd: emptyDir });
        expect(spy).toHaveBeenCalled();
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
        spy.mockRestore();
      }
    });
  });
});
