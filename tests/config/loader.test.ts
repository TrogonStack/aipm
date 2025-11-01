import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPluginsConfig } from '../../src/config/loader';
import { getGlobalDir } from '../../src/helpers/paths';

describe('loadPluginsConfig', () => {
  let testDir: string;
  let originalHome: string | undefined;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-loader-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = testDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(testDir, { recursive: true, force: true });
  });

  async function setupProjectConfig(config: any) {
    const cursorDir = join(testDir, '.cursor');
    await mkdir(cursorDir, { recursive: true });
    const configPath = join(cursorDir, 'plugins.json');
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }

  async function setupLocalConfig(config: any) {
    const cursorDir = join(testDir, '.cursor');
    await mkdir(cursorDir, { recursive: true });
    const configPath = join(cursorDir, 'plugins.local.json');
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }

  async function setupGlobalConfig(config: any) {
    const globalDir = getGlobalDir();
    await mkdir(globalDir, { recursive: true });
    const configPath = join(globalDir, 'config.json');
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }

  describe('three-way merge priority', () => {
    test('loads project config when only project config exists', async () => {
      await setupProjectConfig({
        marketplaces: {
          'project-marketplace': {
            source: 'directory',
            path: '/project/path',
          },
        },
        plugins: {
          'plugin@project-marketplace': {
            enabled: true,
          },
        },
      });

      const result = await loadPluginsConfig(testDir);

      expect(result).toEqual({
        marketplaces: {
          'project-marketplace': {
            source: 'directory',
            path: '/project/path',
          },
        },
        plugins: {
          'plugin@project-marketplace': {
            enabled: true,
          },
        },
      });
    });

    test('merges global and project config with project taking priority', async () => {
      await setupGlobalConfig({
        marketplaces: {
          'global-marketplace': {
            source: 'directory',
            path: '/global/path',
          },
        },
        plugins: {
          'plugin@global-marketplace': {
            enabled: true,
            scope: 'global',
          },
        },
      });

      await setupProjectConfig({
        marketplaces: {
          'project-marketplace': {
            source: 'directory',
            path: '/project/path',
          },
        },
        plugins: {
          'plugin@project-marketplace': {
            enabled: false,
          },
        },
      });

      const result = await loadPluginsConfig(testDir);

      expect(result).toEqual({
        marketplaces: {
          'global-marketplace': {
            source: 'directory',
            path: '/global/path',
          },
          'project-marketplace': {
            source: 'directory',
            path: '/project/path',
          },
        },
        plugins: {
          'plugin@global-marketplace': {
            enabled: true,
            scope: 'global',
          },
          'plugin@project-marketplace': {
            enabled: false,
          },
        },
      });
    });

    test('project config overrides global config for same keys', async () => {
      await setupGlobalConfig({
        marketplaces: {
          shared: {
            source: 'directory',
            path: '/global/path',
          },
        },
        plugins: {
          'plugin@shared': {
            enabled: false,
            version: '1.0.0',
          },
        },
      });

      await setupProjectConfig({
        marketplaces: {
          shared: {
            source: 'directory',
            path: '/project/path',
          },
        },
        plugins: {
          'plugin@shared': {
            enabled: true,
          },
        },
      });

      const result = await loadPluginsConfig(testDir);

      expect(result?.marketplaces.shared?.path).toBe('/project/path');
      expect(result?.plugins['plugin@shared']?.enabled).toBe(true);
      expect(result?.plugins['plugin@shared']?.version).toBeUndefined();
    });

    test('local config has highest priority', async () => {
      await setupGlobalConfig({
        marketplaces: {
          shared: {
            source: 'directory',
            path: '/global/path',
          },
        },
        plugins: {
          'plugin@shared': {
            enabled: false,
            scope: 'global',
          },
        },
      });

      await setupProjectConfig({
        marketplaces: {
          shared: {
            source: 'directory',
            path: '/project/path',
          },
        },
        plugins: {
          'plugin@shared': {
            enabled: true,
            scope: 'project',
          },
        },
      });

      await setupLocalConfig({
        marketplaces: {
          shared: {
            source: 'directory',
            path: '/local/path',
          },
        },
        plugins: {
          'plugin@shared': {
            enabled: false,
          },
        },
      });

      const result = await loadPluginsConfig(testDir);

      expect(result?.marketplaces.shared?.path).toBe('/local/path');
      expect(result?.plugins['plugin@shared']?.enabled).toBe(false);
      expect(result?.plugins['plugin@shared']?.scope).toBeUndefined();
    });

    test('merges all three configs with correct priority', async () => {
      await setupGlobalConfig({
        marketplaces: {
          'global-only': {
            source: 'directory',
            path: '/global/path',
          },
        },
        plugins: {
          'global-plugin@global-only': {
            enabled: true,
          },
        },
      });

      await setupProjectConfig({
        marketplaces: {
          'project-only': {
            source: 'directory',
            path: '/project/path',
          },
        },
        plugins: {
          'project-plugin@project-only': {
            enabled: true,
          },
        },
      });

      await setupLocalConfig({
        marketplaces: {
          'local-only': {
            source: 'directory',
            path: '/local/path',
          },
        },
        plugins: {
          'local-plugin@local-only': {
            enabled: true,
          },
        },
      });

      const result = await loadPluginsConfig(testDir);

      expect(result?.marketplaces).toEqual({
        'global-only': { source: 'directory', path: '/global/path' },
        'project-only': { source: 'directory', path: '/project/path' },
        'local-only': { source: 'directory', path: '/local/path' },
      });

      expect(result?.plugins).toEqual({
        'global-plugin@global-only': { enabled: true },
        'project-plugin@project-only': { enabled: true },
        'local-plugin@local-only': { enabled: true },
      });
    });
  });

  describe('global config handling', () => {
    test('works when global config does not exist', async () => {
      await setupProjectConfig({
        marketplaces: {},
        plugins: {},
      });

      const result = await loadPluginsConfig(testDir);

      expect(result).toEqual({
        marketplaces: {},
        plugins: {},
      });
    });

    test('handles empty global config', async () => {
      await setupGlobalConfig({
        marketplaces: {},
        plugins: {},
      });

      await setupProjectConfig({
        marketplaces: {
          'project-marketplace': {
            source: 'directory',
            path: '/project/path',
          },
        },
        plugins: {},
      });

      const result = await loadPluginsConfig(testDir);

      expect(result).toEqual({
        marketplaces: {
          'project-marketplace': {
            source: 'directory',
            path: '/project/path',
          },
        },
        plugins: {},
      });
    });

    test('handles global config with missing optional fields', async () => {
      await setupGlobalConfig({});

      await setupProjectConfig({
        marketplaces: {},
        plugins: {},
      });

      const result = await loadPluginsConfig(testDir);

      expect(result).toEqual({
        marketplaces: {},
        plugins: {},
      });
    });

    test('ignores invalid global config schema', async () => {
      await setupGlobalConfig({
        marketplaces: {
          invalid: {
            source: 'not-a-valid-source',
          },
        },
      });

      await setupProjectConfig({
        marketplaces: { test: { source: 'directory', path: '/test' } },
        plugins: {},
      });

      const result = await loadPluginsConfig(testDir);
      expect(result?.marketplaces).toEqual({
        test: { source: 'directory', path: '/test' },
      });
    });
  });

  describe('error handling', () => {
    test('returns null when project config does not exist', async () => {
      const result = await loadPluginsConfig(testDir);
      expect(result).toBe(null);
    });

    test('returns null on invalid project config JSON', async () => {
      const cursorDir = join(testDir, '.cursor');
      await mkdir(cursorDir, { recursive: true });
      const configPath = join(cursorDir, 'plugins.json');
      await writeFile(configPath, 'invalid json');

      const result = await loadPluginsConfig(testDir);
      expect(result).toBe(null);
    });

    test('ignores invalid local config JSON', async () => {
      await setupProjectConfig({
        marketplaces: { test: { source: 'directory', path: '/test' } },
        plugins: {},
      });

      const cursorDir = join(testDir, '.cursor');
      const localConfigPath = join(cursorDir, 'plugins.local.json');
      await writeFile(localConfigPath, 'invalid json');

      const result = await loadPluginsConfig(testDir);
      expect(result?.marketplaces).toEqual({
        test: { source: 'directory', path: '/test' },
      });
    });
  });
});
