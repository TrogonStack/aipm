import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadPluginsConfig } from '../../src/config/loader';
import { getGlobalDir } from '../../src/helpers/paths';
import { setupTestEnvironment, type TestSetup } from '../helpers/test-setup';

describe('loadPluginsConfig', () => {
  let setup: TestSetup;
  let testProject: string;

  beforeEach(async () => {
    setup = await setupTestEnvironment();
    // Create a separate project directory to avoid HOME/.aipm collision
    testProject = join(setup.testHome, 'project');
    await mkdir(testProject, { recursive: true });
  });

  afterEach(async () => {
    await setup.cleanup();
  });

  async function setupProjectConfig(config: any) {
    const aipmDir = join(testProject, '.aipm');
    await mkdir(aipmDir, { recursive: true });
    const configPath = join(aipmDir, 'config.json');
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }

  async function setupLocalConfig(config: any) {
    const aipmDir = join(testProject, '.aipm');
    await mkdir(aipmDir, { recursive: true });
    const configPath = join(aipmDir, 'config.local.json');
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

      const { config } = await loadPluginsConfig(testProject);

      expect(config).toEqual({
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

      const { config } = await loadPluginsConfig(testProject);

      expect(config).toEqual({
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

      const { config } = await loadPluginsConfig(testProject);

      expect(config.marketplaces.shared?.path).toBe('/project/path');
      expect(config.plugins['plugin@shared']?.enabled).toBe(true);
      // Deep merge keeps version from global config
      expect(config.plugins['plugin@shared']?.version).toBe('1.0.0');
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

      const { config } = await loadPluginsConfig(testProject);

      expect(config.marketplaces.shared?.path).toBe('/local/path');
      expect(config.plugins['plugin@shared']?.enabled).toBe(false);
      // Deep merge keeps scope from project config
      expect(config.plugins['plugin@shared']?.scope).toBe('project');
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

      const { config } = await loadPluginsConfig(testProject);

      expect(config.marketplaces).toEqual({
        'global-only': { source: 'directory', path: '/global/path' },
        'project-only': { source: 'directory', path: '/project/path' },
        'local-only': { source: 'directory', path: '/local/path' },
      });

      expect(config.plugins).toEqual({
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

      const { config } = await loadPluginsConfig(testProject);

      expect(config).toEqual({
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

      const { config } = await loadPluginsConfig(testProject);

      expect(config).toEqual({
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

      const { config } = await loadPluginsConfig(testProject);

      expect(config).toEqual({
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

      const { config } = await loadPluginsConfig(testProject);
      expect(config.marketplaces).toEqual({
        test: { source: 'directory', path: '/test' },
      });
    });
  });

  describe('error handling', () => {
    test('returns empty config when project config does not exist and no other sources', async () => {
      const { config, sources } = await loadPluginsConfig(testProject);
      expect(config).toEqual({
        marketplaces: {},
        plugins: {},
      });
      expect(sources.project).toBeNull();
    });

    test('returns config from global config even when plugins.json does not exist', async () => {
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
          },
        },
      });

      const { config, sources } = await loadPluginsConfig(testProject);

      expect(config).toEqual({
        marketplaces: {
          'global-marketplace': {
            source: 'directory',
            path: '/global/path',
          },
        },
        plugins: {
          'plugin@global-marketplace': {
            enabled: true,
          },
        },
      });
      expect(sources.project).toBeNull();
      expect(sources.global).not.toBeNull();
      expect(sources.global).toContain('config.json');
    });

    test('throws error on invalid project config JSON', async () => {
      const aipmDir = join(testProject, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      const configPath = join(aipmDir, 'config.json');
      await writeFile(configPath, 'invalid json');

      await expect(loadPluginsConfig(testProject)).rejects.toThrow();
    });

    test('ignores invalid local config JSON', async () => {
      await setupProjectConfig({
        marketplaces: { test: { source: 'directory', path: '/test' } },
        plugins: {},
      });

      const aipmDir = join(testProject, '.aipm');
      const localConfigPath = join(aipmDir, 'config.local.json');
      await writeFile(localConfigPath, 'invalid json');

      const { config } = await loadPluginsConfig(testProject);
      expect(config.marketplaces).toEqual({
        test: { source: 'directory', path: '/test' },
      });
    });
  });

  describe('integrations config merging', () => {
    test('merges integrations config from project and local', async () => {
      await setupProjectConfig({
        marketplaces: {},
        plugins: {},
        integrations: {
          cursor: {
            enabled: true,
            include: 'all',
          },
        },
      });

      await setupLocalConfig({
        integrations: {
          cursor: {
            include: {
              agents: false,
            },
          },
        },
      });

      const { config } = await loadPluginsConfig(testProject);

      // Local should override project's include
      expect(config.integrations?.cursor?.enabled).toBe(true);
      expect(config.integrations?.cursor?.include).toEqual({ agents: false });
    });

    test('local can disable cursor integration', async () => {
      await setupProjectConfig({
        marketplaces: {},
        plugins: {},
        integrations: {
          cursor: {
            enabled: true,
            include: 'all',
          },
        },
      });

      await setupLocalConfig({
        integrations: {
          cursor: {
            enabled: false,
          },
        },
      });

      const { config } = await loadPluginsConfig(testProject);

      expect(config.integrations?.cursor?.enabled).toBe(false);
      expect(config.integrations?.cursor?.include).toBe('all');
    });

    test('merges include objects properly', async () => {
      await setupProjectConfig({
        marketplaces: {},
        plugins: {},
        integrations: {
          cursor: {
            enabled: true,
            include: {
              rules: true,
              commands: true,
              agents: true,
            },
          },
        },
      });

      await setupLocalConfig({
        integrations: {
          cursor: {
            include: {
              agents: false,
              skills: false,
            },
          },
        },
      });

      const { config } = await loadPluginsConfig(testProject);

      // Should merge the include objects
      expect(config.integrations?.cursor?.include).toEqual({
        rules: true,
        commands: true,
        agents: false,
        skills: false,
      });
    });

    test('defaults to all when no integrations config', async () => {
      await setupProjectConfig({
        marketplaces: {},
        plugins: {},
      });

      const { config } = await loadPluginsConfig(testProject);

      expect(config.integrations).toBeUndefined();
    });
  });
});
