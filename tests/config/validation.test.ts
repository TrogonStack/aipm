import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { ConfigValidationError, loadPluginsConfig } from '../../src/config/loader';
import { JsonFileError, readJsonFile, writeJsonFile } from '../../src/helpers/fs';
import { GlobalMarketplaceConfigSchema, PluginsConfigSchema } from '../../src/schema';

describe('Zod validation', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-validation-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('config file validation', () => {
    test('validates correct plugins.json structure', async () => {
      await init({ cwd: testDir });

      const { config } = await loadPluginsConfig(testDir);

      expect(config).not.toBeNull();
      expect(config.marketplaces).toBeDefined();
      expect(config.plugins).toBeDefined();
    });

    test('rejects invalid marketplace source', async () => {
      await init({ cwd: testDir });

      const configPath = join(testDir, '.cursor', 'plugins.json');
      const invalidConfig = {
        marketplaces: {
          'bad-marketplace': {
            source: 'invalid-source', // Should fail - not "github" | "git" | "directory"
          },
        },
        plugins: {},
      };

      await Bun.write(configPath, JSON.stringify(invalidConfig));

      await expect(loadPluginsConfig(testDir)).rejects.toThrow(ConfigValidationError);
    });

    test('rejects invalid plugin config', async () => {
      await init({ cwd: testDir });

      const configPath = join(testDir, '.cursor', 'plugins.json');
      const invalidConfig = {
        marketplaces: {},
        plugins: {
          'test-plugin@marketplace': {
            enabled: 'yes', // Should fail - must be boolean
          },
        },
      };

      await Bun.write(configPath, JSON.stringify(invalidConfig));

      await expect(loadPluginsConfig(testDir)).rejects.toThrow(ConfigValidationError);
    });

    test('validates example config structure', async () => {
      await init({ cwd: testDir, example: true });

      const { config } = await loadPluginsConfig(testDir);

      expect(config).not.toBeNull();

      // Validate all marketplace sources
      for (const [_name, marketplace] of Object.entries(config.marketplaces ?? {})) {
        expect(marketplace.source).toMatch(/^(git|directory|url)$/);
      }

      // Validate all plugin configs
      for (const [_id, plugin] of Object.entries(config.plugins ?? {})) {
        expect(typeof plugin.enabled).toBe('boolean');
        if (plugin.scope) {
          expect(plugin.scope).toMatch(/^(global|project)$/);
        }
      }
    });

    test('throws error for malformed JSON', async () => {
      await init({ cwd: testDir });

      const configPath = join(testDir, '.cursor', 'plugins.json');
      await Bun.write(configPath, '{invalid json}');

      // loadPluginsConfig throws error for malformed JSON
      await expect(loadPluginsConfig(testDir)).rejects.toThrow();
    });

    test('validates merged config from plugins.json and plugins.local.json', async () => {
      await init({ cwd: testDir, example: true });

      const localConfigPath = join(testDir, '.cursor', 'plugins.local.json');
      const localConfig = {
        plugins: {
          'local-plugin@custom': {
            enabled: true,
            scope: 'project' as const,
          },
        },
      };

      await writeJsonFile(localConfigPath, localConfig);

      const { config: merged } = await loadPluginsConfig(testDir);

      expect(merged).not.toBeNull();
      expect(merged.plugins['local-plugin@custom']).toBeDefined();
      expect(merged.plugins['local-plugin@custom']?.enabled).toBe(true);
    });

    test('rejects invalid plugins.local.json', async () => {
      await init({ cwd: testDir });

      const localConfigPath = join(testDir, '.cursor', 'plugins.local.json');
      const invalidLocal = {
        plugins: {
          'test-plugin@marketplace': {
            enabled: 123, // Should fail - must be boolean
          },
        },
      };

      await Bun.write(localConfigPath, JSON.stringify(invalidLocal));

      await expect(loadPluginsConfig(testDir)).rejects.toThrow(ConfigValidationError);
    });
  });

  describe('writeJsonFile validation', () => {
    test('validates data before writing with schema', async () => {
      const filePath = join(testDir, 'test.json');

      const validData = {
        marketplaces: {},
        plugins: {},
      };

      await writeJsonFile(filePath, validData, PluginsConfigSchema);

      const content = await Bun.file(filePath).json();
      expect(content).toEqual(validData);
    });

    test('rejects invalid data when schema provided', async () => {
      const filePath = join(testDir, 'test.json');

      const invalidData = {
        marketplaces: 'not an object', // Should fail
        plugins: {},
      };

      try {
        await writeJsonFile(filePath, invalidData, PluginsConfigSchema);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(JsonFileError);
        expect((error as JsonFileError).message).toBe('JSON validation failed');
        expect((error as JsonFileError).filePath).toBe(filePath);
        expect((error as JsonFileError).cause).toBeDefined();
      }
    });

    test('writes without validation when schema not provided', async () => {
      const filePath = join(testDir, 'test.json');

      const anyData = { anything: 'goes', number: 123 };

      await writeJsonFile(filePath, anyData);

      const content = await Bun.file(filePath).json();
      expect(content).toEqual(anyData);
    });
  });

  describe('readJsonFile validation', () => {
    test('validates data when reading with schema', async () => {
      const filePath = join(testDir, 'test.json');

      const validData = {
        marketplaces: {},
        plugins: {},
      };

      await Bun.write(filePath, JSON.stringify(validData));

      const result = await readJsonFile(filePath, PluginsConfigSchema);
      expect(result).toEqual(validData);
    });

    test('rejects invalid data when reading with schema', async () => {
      const filePath = join(testDir, 'test.json');

      const invalidData = {
        marketplaces: [],
        plugins: {},
      };

      await Bun.write(filePath, JSON.stringify(invalidData));

      try {
        await readJsonFile(filePath, PluginsConfigSchema);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(JsonFileError);
        expect((error as JsonFileError).message).toBe('JSON validation failed');
        expect((error as JsonFileError).filePath).toBe(filePath);
        expect((error as JsonFileError).cause).toBeDefined();
      }
    });
  });

  describe('global config validation', () => {
    test('validates global marketplace config structure', async () => {
      const tempGlobalDir = await mkdtemp(join(tmpdir(), 'cursor-global-'));

      try {
        await init({
          global: true,
          globalDir: tempGlobalDir,
          force: true,
          skipConfirm: true,
        });

        const configPath = join(tempGlobalDir, 'config.json');
        const config = await readJsonFile(configPath, GlobalMarketplaceConfigSchema);

        expect(config).toHaveProperty('marketplaces');
        expect(config).toHaveProperty('plugins');
        expect(typeof config.marketplaces).toBe('object');
        expect(typeof config.plugins).toBe('object');
      } finally {
        await rm(tempGlobalDir, { recursive: true, force: true });
      }
    });

    test('rejects invalid global config', async () => {
      const configPath = join(testDir, 'config.json');

      const invalidConfig = {
        marketplaces: 'not an object',
        plugins: 'not an object',
      };

      await Bun.write(configPath, JSON.stringify(invalidConfig));

      try {
        await readJsonFile(configPath, GlobalMarketplaceConfigSchema);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(JsonFileError);
        expect((error as JsonFileError).message).toBe('JSON validation failed');
        expect((error as JsonFileError).filePath).toBe(configPath);
        expect((error as JsonFileError).cause).toBeDefined();
      }
    });
  });

  describe('schema edge cases', () => {
    test('accepts valid git URL in marketplace source', async () => {
      const configPath = join(testDir, 'test.json');

      const validConfig = {
        marketplaces: {
          'git-marketplace': {
            source: 'git' as const,
            url: 'https://github.com/org/repo.git',
          },
        },
        plugins: {},
      };

      await writeJsonFile(configPath, validConfig, PluginsConfigSchema);
      const result = await readJsonFile(configPath, PluginsConfigSchema);

      expect(result.marketplaces['git-marketplace']?.url).toBe('https://github.com/org/repo.git');
    });

    test('accepts any string for git marketplace URL', async () => {
      const configPath = join(testDir, 'test.json');

      const config = {
        marketplaces: {
          'git-marketplace': {
            source: 'git',
            url: '/path/to/local/repo',
          },
        },
        plugins: {},
      };

      await writeJsonFile(configPath, config, PluginsConfigSchema);

      const result = await readJsonFile(configPath, PluginsConfigSchema);
      expect(result.marketplaces['git-marketplace']?.url).toBe('/path/to/local/repo');
    });

    test('accepts optional version in plugin config', async () => {
      const configPath = join(testDir, 'test.json');

      const validConfig = {
        marketplaces: {},
        plugins: {
          'test-plugin@marketplace': {
            enabled: true,
            version: '1.2.3',
          },
        },
      };

      await writeJsonFile(configPath, validConfig, PluginsConfigSchema);
      const result = await readJsonFile(configPath, PluginsConfigSchema);

      expect(result.plugins['test-plugin@marketplace']?.version).toBe('1.2.3');
    });
  });
});
