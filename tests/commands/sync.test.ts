import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { marketplaceAdd } from '../../src/commands/marketplace-add';
import { pluginEnable } from '../../src/commands/plugin-enable';
import { sync } from '../../src/commands/sync';
import { fileExists } from '../../src/helpers/fs';

describe('sync command', () => {
  let testDir: string;
  let marketplaceDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-sync-test-'));
    marketplaceDir = join(testDir, 'marketplace');
    await mkdir(marketplaceDir);
    await init({ cwd: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function createMockPlugin(name: string) {
    const pluginPath = join(marketplaceDir, name);
    await mkdir(pluginPath, { recursive: true });
    await mkdir(join(pluginPath, '.claude-plugin'));
    await writeFile(
      join(pluginPath, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name,
        version: '1.0.0',
        description: 'Test plugin',
      }),
    );
    await mkdir(join(pluginPath, 'commands'));
    await writeFile(join(pluginPath, 'commands', 'test.md'), '# Test Command');
  }

  describe('basic functionality', () => {
    test('syncs enabled plugin from marketplace', async () => {
      await createMockPlugin('test-plugin');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'test-plugin@local',
        cwd: testDir,
      });

      await sync({ cwd: testDir });

      const commandsPath = join(testDir, '.cursor', 'commands', 'aipm', 'local', 'test-plugin', 'test.md');
      expect(await fileExists(commandsPath)).toBe(true);
    });

    test('syncs multiple plugins', async () => {
      await createMockPlugin('plugin1');
      await createMockPlugin('plugin2');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'plugin1@local',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'plugin2@local',
        cwd: testDir,
      });

      await sync({ cwd: testDir });

      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'plugin1', 'test.md'))).toBe(true);
      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'plugin2', 'test.md'))).toBe(true);
    });

    test('only syncs enabled plugins', async () => {
      await createMockPlugin('enabled');
      await createMockPlugin('disabled');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'enabled@local',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'disabled@local',
        cwd: testDir,
      });

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins['disabled@local'].enabled = false;
      await Bun.write(pluginsPath, JSON.stringify(config, null, 2));

      await sync({ cwd: testDir });

      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'enabled', 'test.md'))).toBe(true);
      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'disabled', 'test.md'))).toBe(
        false,
      );
    });

    test('clears marketplace directory before syncing', async () => {
      await createMockPlugin('plugin1');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'plugin1@local',
        cwd: testDir,
      });

      await sync({ cwd: testDir });

      const oldPluginPath = join(testDir, '.cursor', 'commands', 'aipm', 'local', 'plugin1', 'test.md');
      expect(await fileExists(oldPluginPath)).toBe(true);

      await createMockPlugin('plugin2');
      await pluginEnable({
        pluginId: 'plugin2@local',
        cwd: testDir,
      });

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins['plugin1@local'].enabled = false;
      await Bun.write(pluginsPath, JSON.stringify(config, null, 2));

      await sync({ cwd: testDir });

      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'plugin1', 'test.md'))).toBe(false);
      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'plugin2', 'test.md'))).toBe(true);
    });
  });

  describe('error handling', () => {
    test('handles missing plugins.json', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'cursor-empty-'));

      try {
        await sync({ cwd: emptyDir });
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    test('handles no enabled plugins', async () => {
      await sync({ cwd: testDir });
    });

    test('skips invalid plugin ID format', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins['invalid-format'] = { enabled: true };
      await Bun.write(pluginsPath, JSON.stringify(config, null, 2));

      await sync({ cwd: testDir });
    });

    test('skips plugin with non-existent marketplace', async () => {
      await pluginEnable({
        pluginId: 'test@nonexistent',
        cwd: testDir,
      });

      await sync({ cwd: testDir });
    });

    test('skips git marketplace with missing url', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.marketplaces['git-no-url'] = {
        source: 'git',
      };
      config.plugins['test@git-no-url'] = { enabled: true };
      await Bun.write(pluginsPath, JSON.stringify(config, null, 2));

      await sync({ cwd: testDir });
    });

    test('skips marketplace with missing path', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.marketplaces.bad = {
        source: 'directory',
      };
      config.plugins['test@bad'] = { enabled: true };
      await Bun.write(pluginsPath, JSON.stringify(config, null, 2));

      await sync({ cwd: testDir });
    });

    test('skips non-existent marketplace path', async () => {
      await marketplaceAdd({
        name: 'missing',
        path: './does-not-exist',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'test@missing',
        cwd: testDir,
      });

      await sync({ cwd: testDir });
    });

    test('skips non-existent plugin in marketplace', async () => {
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'nonexistent@local',
        cwd: testDir,
      });

      await sync({ cwd: testDir });
    });

    test('skips plugin path that is a file instead of directory', async () => {
      const pluginFilePath = join(marketplaceDir, 'file-plugin');
      await writeFile(pluginFilePath, 'not a directory');

      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'file-plugin@local',
        cwd: testDir,
      });

      await sync({ cwd: testDir });

      const installedPath = join(testDir, '.cursor', 'marketplace', 'local', 'file-plugin');
      expect(await fileExists(installedPath)).toBe(false);
    });
  });

  describe('dry-run mode', () => {
    test('dry-run does not install plugins', async () => {
      await createMockPlugin('test-plugin');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'test-plugin@local',
        cwd: testDir,
      });

      await sync({ cwd: testDir, dryRun: true });

      const installedPath = join(testDir, '.cursor', 'marketplace', 'local', 'test-plugin');
      expect(await fileExists(installedPath)).toBe(false);
    });

    test('dry-run does not clear marketplace directory', async () => {
      const marketplaceDir = join(testDir, '.cursor', 'marketplace');
      await mkdir(marketplaceDir, { recursive: true });
      await writeFile(join(marketplaceDir, 'existing-file.txt'), 'test');

      await createMockPlugin('test-plugin');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'test-plugin@local',
        cwd: testDir,
      });

      await sync({ cwd: testDir, dryRun: true });

      expect(await fileExists(join(marketplaceDir, 'existing-file.txt'))).toBe(true);
    });
  });

  describe('integrations configuration', () => {
    async function createPluginWithTypes(name: string) {
      const pluginPath = join(marketplaceDir, name);
      await mkdir(pluginPath, { recursive: true });
      await mkdir(join(pluginPath, '.claude-plugin'));
      await writeFile(
        join(pluginPath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name,
          version: '1.0.0',
          description: 'Test plugin',
        }),
      );

      // Create different types of files
      await mkdir(join(pluginPath, 'commands'));
      await writeFile(join(pluginPath, 'commands', 'test.md'), '# Command');

      await mkdir(join(pluginPath, 'rules'));
      await writeFile(join(pluginPath, 'rules', 'test.md'), '# Rule');

      await mkdir(join(pluginPath, 'agents'));
      await writeFile(join(pluginPath, 'agents', 'test.md'), '# Agent');

      await mkdir(join(pluginPath, 'skills'));
      await writeFile(join(pluginPath, 'skills', 'test.md'), '# Skill');

      await mkdir(join(pluginPath, 'hooks'));
      await writeFile(join(pluginPath, 'hooks', 'test.md'), '# Hook');
    }

    test('disables cursor integration when enabled: false', async () => {
      await createPluginWithTypes('test-plugin');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'test-plugin@local',
        cwd: testDir,
      });

      // Disable cursor integration
      const configPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(configPath).json();
      config.integrations = { cursor: { enabled: false } };
      await Bun.write(configPath, JSON.stringify(config, null, 2));

      await sync({ cwd: testDir });

      // Nothing should be synced
      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        false,
      );
      expect(await fileExists(join(testDir, '.cursor', 'rules', 'aipm', 'local', 'test-plugin', 'test.mdc'))).toBe(
        false,
      );
    });

    test('syncs all types when include is "all"', async () => {
      await createPluginWithTypes('test-plugin');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'test-plugin@local',
        cwd: testDir,
      });

      // Explicitly set include to "all"
      const configPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(configPath).json();
      config.integrations = { cursor: { enabled: true, include: 'all' } };
      await Bun.write(configPath, JSON.stringify(config, null, 2));

      await sync({ cwd: testDir });

      // All types should be synced
      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'rules', 'aipm', 'local', 'test-plugin', 'test.mdc'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'agents', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'skills', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'hooks', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(true);
    });

    test('syncs only enabled types when include is object', async () => {
      await createPluginWithTypes('test-plugin');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'test-plugin@local',
        cwd: testDir,
      });

      // Only enable rules and commands
      const configPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(configPath).json();
      config.integrations = {
        cursor: {
          enabled: true,
          include: {
            rules: true,
            commands: true,
            agents: false,
            skills: false,
            hooks: false,
          },
        },
      };
      await Bun.write(configPath, JSON.stringify(config, null, 2));

      await sync({ cwd: testDir });

      // Only rules and commands should be synced
      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'rules', 'aipm', 'local', 'test-plugin', 'test.mdc'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'agents', 'aipm', 'local', 'test-plugin'))).toBe(false);
      expect(await fileExists(join(testDir, '.cursor', 'skills', 'aipm', 'local', 'test-plugin'))).toBe(false);
      expect(await fileExists(join(testDir, '.cursor', 'hooks', 'aipm', 'local', 'test-plugin'))).toBe(false);
    });

    test('defaults to true for unspecified types in include object', async () => {
      await createPluginWithTypes('test-plugin');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'test-plugin@local',
        cwd: testDir,
      });

      // Only disable agents, leave others unspecified
      const configPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(configPath).json();
      config.integrations = {
        cursor: {
          enabled: true,
          include: {
            agents: false,
          },
        },
      };
      await Bun.write(configPath, JSON.stringify(config, null, 2));

      await sync({ cwd: testDir });

      // Everything except agents should be synced (default to true)
      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'rules', 'aipm', 'local', 'test-plugin', 'test.mdc'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'skills', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'hooks', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(true);
      expect(await fileExists(join(testDir, '.cursor', 'agents', 'aipm', 'local', 'test-plugin'))).toBe(false);
    });

    test('syncs all types by default when no integrations config', async () => {
      await createPluginWithTypes('test-plugin');
      await marketplaceAdd({
        name: 'local',
        path: './marketplace',
        cwd: testDir,
      });
      await pluginEnable({
        pluginId: 'test-plugin@local',
        cwd: testDir,
      });

      // No integrations config - should default to all
      await sync({ cwd: testDir });

      // All types should be synced
      expect(await fileExists(join(testDir, '.cursor', 'commands', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'rules', 'aipm', 'local', 'test-plugin', 'test.mdc'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'agents', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'skills', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(
        true,
      );
      expect(await fileExists(join(testDir, '.cursor', 'hooks', 'aipm', 'local', 'test-plugin', 'test.md'))).toBe(true);
    });
  });
});
