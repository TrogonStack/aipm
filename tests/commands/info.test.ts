import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { info } from '../../src/commands/info';
import { init } from '../../src/commands/init';
import { marketplaceAdd } from '../../src/commands/marketplace-add';
import { pluginEnable } from '../../src/commands/plugin-enable';
import * as loader from '../../src/config/loader';

describe('info command', () => {
  let testDir: string;
  let marketplaceDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-info-test-'));
    marketplaceDir = join(testDir, 'marketplace');
    await mkdir(marketplaceDir);
    await init({ cwd: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function createMockPlugin(name: string, manifest: any = {}) {
    const pluginPath = join(marketplaceDir, name);
    await mkdir(pluginPath, { recursive: true });
    await mkdir(join(pluginPath, '.claude-plugin'));

    const defaultManifest = {
      name,
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test Author',
      ...manifest,
    };

    await writeFile(join(pluginPath, '.claude-plugin', 'plugin.json'), JSON.stringify(defaultManifest, null, 2));

    await mkdir(join(pluginPath, 'commands'));
    await writeFile(join(pluginPath, 'commands', 'test.md'), '# Test Command');
  }

  describe('basic functionality', () => {
    test('displays plugin information', async () => {
      await createMockPlugin('test-plugin', {
        name: 'Test Plugin',
        version: '2.0.0',
        description: 'A test plugin for testing',
        author: 'Test Author',
        homepage: 'https://example.com',
        repository: 'https://github.com/test/plugin',
      });

      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });

      await pluginEnable({
        pluginId: 'test-plugin@local',
        cwd: testDir,
      });

      await info({ pluginId: 'test-plugin@local', cwd: testDir });
    });

    test('shows commands list', async () => {
      const pluginPath = join(marketplaceDir, 'multi-command');
      await mkdir(pluginPath, { recursive: true });
      await mkdir(join(pluginPath, '.claude-plugin'));
      await writeFile(
        join(pluginPath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name: 'multi-command',
          version: '1.0.0',
          description: 'Plugin with multiple commands',
          author: 'Test Author',
        }),
      );

      await mkdir(join(pluginPath, 'commands'));
      await writeFile(join(pluginPath, 'commands', 'command-a.md'), '# A');
      await writeFile(join(pluginPath, 'commands', 'command-b.md'), '# B');
      await writeFile(join(pluginPath, 'commands', 'command-c.md'), '# C');

      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });

      await info({ pluginId: 'multi-command@local', cwd: testDir });
    });

    test('shows disabled status for disabled plugin', async () => {
      await createMockPlugin('disabled-plugin');

      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });

      await info({ pluginId: 'disabled-plugin@local', cwd: testDir });
    });
  });

  describe('error handling', () => {
    test('handles missing plugins.json', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'cursor-empty-'));

      try {
        await info({ pluginId: 'test@local', cwd: emptyDir });
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    test('handles invalid plugin ID format', async () => {
      await info({ pluginId: 'invalid-format', cwd: testDir });
    });

    test('handles non-existent marketplace', async () => {
      await info({ pluginId: 'test@nonexistent', cwd: testDir });
    });

    test('handles marketplace with missing url', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.marketplaces['no-url'] = {
        source: 'git',
      };
      await Bun.write(pluginsPath, JSON.stringify(config, null, 2));

      await info({ pluginId: 'test@no-url', cwd: testDir });
    });

    test('handles marketplace with missing path', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.marketplaces['no-path'] = {
        source: 'directory',
      };
      await Bun.write(pluginsPath, JSON.stringify(config, null, 2));

      await info({ pluginId: 'test@no-path', cwd: testDir });
    });

    test('handles non-existent marketplace path', async () => {
      await marketplaceAdd({
        name: 'missing',
        path: './does-not-exist',
        cwd: testDir,
      });

      await info({ pluginId: 'test@missing', cwd: testDir });
    });

    test('handles non-existent plugin', async () => {
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });

      await info({ pluginId: 'nonexistent@local', cwd: testDir });
    });

    test('handles plugin path that is a file', async () => {
      await writeFile(join(marketplaceDir, 'file-plugin'), 'not a directory');

      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });

      await info({ pluginId: 'file-plugin@local', cwd: testDir });
    });

    test('handles missing plugin manifest', async () => {
      const pluginPath = join(marketplaceDir, 'no-manifest');
      await mkdir(pluginPath, { recursive: true });

      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });

      await info({ pluginId: 'no-manifest@local', cwd: testDir });
    });
  });

  describe('plugin metadata', () => {
    test('handles plugin without optional fields', async () => {
      await createMockPlugin('minimal', {
        name: 'minimal',
        version: '1.0.0',
        author: 'Test Author',
      });

      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });

      await info({ pluginId: 'minimal@local', cwd: testDir });
    });

    test('handles plugin with scope', async () => {
      await createMockPlugin('scoped-plugin');

      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins['scoped-plugin@local'] = {
        enabled: true,
        scope: 'project',
      };
      await Bun.write(pluginsPath, JSON.stringify(config, null, 2));

      await info({ pluginId: 'scoped-plugin@local', cwd: testDir });
    });

    test('handles plugin without commands directory', async () => {
      const pluginPath = join(marketplaceDir, 'no-commands');
      await mkdir(pluginPath, { recursive: true });
      await mkdir(join(pluginPath, '.claude-plugin'));
      await writeFile(
        join(pluginPath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name: 'no-commands',
          version: '1.0.0',
          author: 'Test Author',
        }),
      );

      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });

      await info({ pluginId: 'no-commands@local', cwd: testDir });
    });
  });

  describe('error scenarios', () => {
    test('catches and logs errors from loadPluginsConfig', async () => {
      const spy = spyOn(loader, 'loadPluginsConfig').mockImplementation(() => {
        throw new Error('Config load failed');
      });

      await expect(info({ pluginId: 'test@local', cwd: testDir })).rejects.toThrow('Config load failed');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
