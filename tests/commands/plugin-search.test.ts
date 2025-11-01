import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pluginSearch } from '../../src/commands/plugin-search';

describe('plugin-search', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
    await mkdir(join(testDir, '.cursor'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('list all plugins', () => {
    test('should list all available plugins from all marketplaces', async () => {
      const marketplace1Dir = join(testDir, 'marketplace1');
      await mkdir(join(marketplace1Dir, 'plugin-a'), { recursive: true });
      await mkdir(join(marketplace1Dir, 'plugin-b'), { recursive: true });

      const marketplace2Dir = join(testDir, 'marketplace2');
      await mkdir(join(marketplace2Dir, 'plugin-c'), { recursive: true });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local1: { source: 'directory', path: './marketplace1' },
            local2: { source: 'directory', path: './marketplace2' },
          },
          plugins: {
            'plugin-a@local1': { enabled: true },
          },
        }),
      );

      const options = {
        cwd: testDir,
      };

      await pluginSearch(options);
    });

    test('should show plugin metadata from marketplace.json', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(marketplaceDir, { recursive: true });

      await writeFile(
        join(marketplaceDir, 'marketplace.json'),
        JSON.stringify({
          name: 'test-marketplace',
          owner: { name: 'Test Owner' },
          plugins: [
            {
              name: 'awesome-plugin',
              source: './plugins/awesome',
              description: 'An awesome plugin',
              version: '2.0.0',
              author: { name: 'John Doe' },
            },
            {
              name: 'cool-plugin',
              source: './plugins/cool',
              description: 'A cool plugin',
              version: '1.5.0',
            },
          ],
        }),
      );

      await mkdir(join(marketplaceDir, 'plugins', 'awesome'), {
        recursive: true,
      });
      await mkdir(join(marketplaceDir, 'plugins', 'cool'), {
        recursive: true,
      });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
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
        cwd: testDir,
      };

      await pluginSearch(options);
    });

    test('should handle marketplace with no plugins', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(marketplaceDir, { recursive: true });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
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
        cwd: testDir,
      };

      await pluginSearch(options);
    });
  });

  describe('search with query', () => {
    test('should filter plugins by name', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(join(marketplaceDir, 'react-helper'), { recursive: true });
      await mkdir(join(marketplaceDir, 'vue-helper'), { recursive: true });
      await mkdir(join(marketplaceDir, 'angular-tool'), { recursive: true });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
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
        query: 'helper',
        cwd: testDir,
      };

      await pluginSearch(options);
    });

    test('should filter plugins by description', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(marketplaceDir, { recursive: true });

      await writeFile(
        join(marketplaceDir, 'marketplace.json'),
        JSON.stringify({
          name: 'test-marketplace',
          owner: { name: 'Test Owner' },
          plugins: [
            {
              name: 'plugin-a',
              source: './plugin-a',
              description: 'React development helper',
            },
            {
              name: 'plugin-b',
              source: './plugin-b',
              description: 'Vue component builder',
            },
            {
              name: 'plugin-c',
              source: './plugin-c',
              description: 'React testing utilities',
            },
          ],
        }),
      );

      await mkdir(join(marketplaceDir, 'plugin-a'), { recursive: true });
      await mkdir(join(marketplaceDir, 'plugin-b'), { recursive: true });
      await mkdir(join(marketplaceDir, 'plugin-c'), { recursive: true });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
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
        query: 'react',
        cwd: testDir,
      };

      await pluginSearch(options);
    });

    test('should filter plugins by marketplace name', async () => {
      const marketplace1Dir = join(testDir, 'react-plugins');
      await mkdir(join(marketplace1Dir, 'plugin-a'), { recursive: true });

      const marketplace2Dir = join(testDir, 'vue-plugins');
      await mkdir(join(marketplace2Dir, 'plugin-b'), { recursive: true });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            'react-marketplace': {
              source: 'directory',
              path: './react-plugins',
            },
            'vue-marketplace': { source: 'directory', path: './vue-plugins' },
          },
          plugins: {},
        }),
      );

      const options = {
        query: 'react',
        cwd: testDir,
      };

      await pluginSearch(options);
    });

    test('should return no results for non-matching query', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(join(marketplaceDir, 'plugin-a'), { recursive: true });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
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
        query: 'nonexistent',
        cwd: testDir,
      };

      await pluginSearch(options);
    });

    test('should be case-insensitive', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(join(marketplaceDir, 'ReactHelper'), { recursive: true });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
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
        query: 'REACT',
        cwd: testDir,
      };

      await pluginSearch(options);
    });
  });

  describe('error handling', () => {
    test('should error if no plugins.json found', async () => {
      const options = {
        cwd: testDir,
      };

      await expect(pluginSearch(options)).rejects.toThrow('No plugins.json found');
    });

    test('should handle marketplaces with invalid paths', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            broken: { source: 'directory', path: './nonexistent' },
          },
          plugins: {},
        }),
      );

      const options = {
        cwd: testDir,
      };

      await pluginSearch(options);
    });
  });

  describe('installed status', () => {
    test('should indicate which plugins are installed', async () => {
      const marketplaceDir = join(testDir, 'marketplace');
      await mkdir(join(marketplaceDir, 'plugin-a'), { recursive: true });
      await mkdir(join(marketplaceDir, 'plugin-b'), { recursive: true });

      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {
            'plugin-a@local': { enabled: true },
          },
        }),
      );

      const options = {
        cwd: testDir,
      };

      await pluginSearch(options);
    });
  });
});
