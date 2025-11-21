import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ensureAIPMDir,
  getAIPMDir,
  loadAIPMConfig,
  loadAIPMLocalConfig,
  saveAIPMConfig,
  saveAIPMLocalConfig,
} from '../../src/helpers/aipm-config';
import { fileExists } from '../../src/helpers/fs';
import type { PluginsConfig } from '../../src/schema';

describe('AIPM Config Helper', () => {
  const testDir = join(import.meta.dir, '../fixtures/aipm-config-test');

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getAIPMDir', () => {
    test('returns correct .aipm path', () => {
      const aipmDir = getAIPMDir(testDir);
      expect(aipmDir).toBe(join(testDir, '.aipm'));
    });
  });

  describe('ensureAIPMDir', () => {
    test('creates .aipm directory', async () => {
      const aipmDir = getAIPMDir(testDir);
      expect(await fileExists(aipmDir)).toBe(false);

      await ensureAIPMDir(testDir);
      expect(await fileExists(aipmDir)).toBe(true);
    });
  });

  describe('loadAIPMConfig', () => {
    test('returns null if config does not exist', async () => {
      const config = await loadAIPMConfig(testDir);
      expect(config).toBeNull();
    });

    test('loads valid config', async () => {
      const validConfig: PluginsConfig = {
        marketplaces: {
          local: { source: 'directory', path: './plugins' },
        },
        plugins: {
          'test@local': { enabled: true },
        },
      };

      await ensureAIPMDir(testDir);
      const configPath = join(getAIPMDir(testDir), 'config.json');
      await writeFile(configPath, JSON.stringify(validConfig));

      const config = await loadAIPMConfig(testDir);
      expect(config).toEqual(validConfig);
    });

    test('throws for invalid config', async () => {
      await ensureAIPMDir(testDir);
      const configPath = join(getAIPMDir(testDir), 'config.json');
      await writeFile(configPath, JSON.stringify({ invalid: 'config' }));

      await expect(loadAIPMConfig(testDir)).rejects.toThrow();
    });
  });

  describe('loadAIPMLocalConfig', () => {
    test('returns empty config if file does not exist', async () => {
      const config = await loadAIPMLocalConfig(testDir);
      expect(config).toEqual({ marketplaces: {}, plugins: {} });
    });

    test('loads valid local config', async () => {
      const validConfig: PluginsConfig = {
        marketplaces: {
          'local-override': { source: 'directory', path: './local-plugins' },
        },
        plugins: {
          'test@local': { enabled: false },
        },
      };

      await ensureAIPMDir(testDir);
      const configPath = join(getAIPMDir(testDir), 'config.local.json');
      await writeFile(configPath, JSON.stringify(validConfig));

      const config = await loadAIPMLocalConfig(testDir);
      expect(config).toEqual(validConfig);
    });
  });

  describe('saveAIPMConfig', () => {
    test('saves config to .aipm/config.json', async () => {
      const config: PluginsConfig = {
        marketplaces: { local: { source: 'directory', path: './plugins' } },
        plugins: { 'test@local': { enabled: true } },
      };

      await saveAIPMConfig(testDir, config);

      const configPath = join(getAIPMDir(testDir), 'config.json');
      expect(await fileExists(configPath)).toBe(true);

      const savedConfig = await loadAIPMConfig(testDir);
      expect(savedConfig).toEqual(config);
    });
  });

  describe('saveAIPMLocalConfig', () => {
    test('saves local config to .aipm/config.local.json', async () => {
      const config: PluginsConfig = {
        marketplaces: {},
        plugins: { 'test@local': { enabled: false } },
      };

      await saveAIPMLocalConfig(testDir, config);

      const configPath = join(getAIPMDir(testDir), 'config.local.json');
      expect(await fileExists(configPath)).toBe(true);

      const savedConfig = await loadAIPMLocalConfig(testDir);
      expect(savedConfig).toEqual(config);
    });
  });
});
