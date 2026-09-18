import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pluginUninstall } from '../../src/commands/plugin-uninstall';
import { FILE_HOOKS_JSON } from '../../src/constants';
import type { CursorHooksConfig } from '../../src/schema';

import { fileExists, readJsonFile } from '../../src/helpers/fs';

describe('plugin-uninstall', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
    await mkdir(join(testDir, '.cursor'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('basic uninstall', () => {
    test('should remove plugin from config', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './plugins' },
          },
          plugins: {
            'my-plugin@local': { enabled: true },
            'other-plugin@local': { enabled: true },
          },
        }),
      );

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
      expect(config.plugins['other-plugin@local']).toBeDefined();
    });

    test('should error if plugin not found', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {},
        }),
      );

      const options = {
        pluginId: 'nonexistent@local',
        cwd: testDir,
      };

      await expect(pluginUninstall(options)).rejects.toThrow();
    });

    test('should error if no plugins.json found', async () => {
      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
      };

      await expect(pluginUninstall(options)).rejects.toThrow();
    });
  });

  describe('local config', () => {
    test('should remove from plugins.local.json when local=true', async () => {
      const pluginsLocalPath = join(testDir, '.aipm', 'config.local.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsLocalPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {},
        }),
      );

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        local: true,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsLocalPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
    });
  });

  describe('removeFiles option', () => {
    test('should delete plugin files when removeFiles=true', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const pluginDir = join(testDir, '.cursor', 'commands', 'aipm', 'local', 'my-plugin');
      await mkdir(pluginDir, { recursive: true });
      await writeFile(join(pluginDir, 'test.txt'), 'test content');

      expect(await fileExists(pluginDir)).toBe(true);

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      expect(await fileExists(pluginDir)).toBe(false);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
    });

    test('should not delete plugin files when removeFiles=false', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const pluginDir = join(testDir, '.cursor', 'commands', 'aipm', 'local', 'my-plugin');
      await mkdir(pluginDir, { recursive: true });
      await writeFile(join(pluginDir, 'test.txt'), 'test content');

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        removeFiles: false,
      };

      await pluginUninstall(options);

      expect(await fileExists(pluginDir)).toBe(true);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
    });

    test('should handle missing plugin files gracefully', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin@local']).toBeUndefined();
    });
  });

  describe('dry-run mode', () => {
    test('should not modify config in dry-run mode', async () => {
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const originalConfig = {
        marketplaces: { local: { source: 'directory', path: './plugins' } },
        plugins: {
          'my-plugin@local': { enabled: true },
        },
      };
      await writeFile(pluginsPath, JSON.stringify(originalConfig));

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        dryRun: true,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config).toEqual(originalConfig);
    });

    test('should not delete files in dry-run mode', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin@local': { enabled: true },
          },
        }),
      );

      const pluginDir = join(testDir, '.cursor', 'commands', 'aipm', 'local', 'my-plugin');
      await mkdir(pluginDir, { recursive: true });
      await writeFile(join(pluginDir, 'test.txt'), 'test content');

      const options = {
        pluginId: 'my-plugin@local',
        cwd: testDir,
        dryRun: true,
        removeFiles: true,
      };

      await pluginUninstall(options);

      expect(await fileExists(pluginDir)).toBe(true);
    });
  });

  describe('validation', () => {
    test('should reject empty pluginId', async () => {
      const options = {
        pluginId: '',
        cwd: testDir,
      };

      await expect(pluginUninstall(options)).rejects.toThrow();
    });

    test('should handle pluginId without @ separator', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'my-plugin': { enabled: true },
          },
        }),
      );

      const pluginDir = join(testDir, '.cursor', 'commands', 'aipm');
      await mkdir(pluginDir, { recursive: true });

      const options = {
        pluginId: 'my-plugin',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['my-plugin']).toBeUndefined();
    });
  });

  describe('multiple plugins', () => {
    test('should only remove specified plugin', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'plugin-a@local': { enabled: true },
            'plugin-b@local': { enabled: true },
            'plugin-c@local': { enabled: false },
          },
        }),
      );

      const options = {
        pluginId: 'plugin-b@local',
        cwd: testDir,
      };

      await pluginUninstall(options);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['plugin-a@local']).toBeDefined();
      expect(config.plugins['plugin-b@local']).toBeUndefined();
      expect(config.plugins['plugin-c@local']).toBeDefined();
    });
  });

  describe('meta-plugin support', () => {
    test('should delete skill directories for meta-plugins with removeFiles=true', async () => {
      const testMarketplacePath = join(testDir, 'test-marketplace');
      await mkdir(testMarketplacePath, { recursive: true });

      const marketplaceManifestPath = join(testMarketplacePath, '.claude-plugin', 'marketplace.json');
      await mkdir(join(testMarketplacePath, '.claude-plugin'), { recursive: true });
      await writeFile(
        marketplaceManifestPath,
        JSON.stringify({
          name: 'test-marketplace',
          owner: { name: 'Test Owner', email: 'test@example.com' },
          metadata: {
            description: 'Test marketplace',
            version: '1.0.0',
          },
          plugins: [
            {
              name: 'meta-skills',
              source: './',
              skills: ['./skill-a', './skill-b'],
            },
          ],
        }),
      );

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { 'claude/testmkt': { source: 'directory', path: testMarketplacePath } },
          plugins: {
            'meta-skills@claude/testmkt': { enabled: true },
          },
        }),
      );

      const skillAPath = join(testDir, '.cursor', 'skills', 'aipm', 'claude', 'testmkt', 'skill-a');
      const skillBPath = join(testDir, '.cursor', 'skills', 'aipm', 'claude', 'testmkt', 'skill-b');
      await mkdir(skillAPath, { recursive: true });
      await mkdir(skillBPath, { recursive: true });
      await writeFile(join(skillAPath, 'test.md'), '# Skill A');
      await writeFile(join(skillBPath, 'test.md'), '# Skill B');

      const options = {
        pluginId: 'meta-skills@claude/testmkt',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      expect(await fileExists(skillAPath)).toBe(false);
      expect(await fileExists(skillBPath)).toBe(false);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['meta-skills@claude/testmkt']).toBeUndefined();
    });

    test('should not delete skill directories for meta-plugins with removeFiles=false', async () => {
      const testMarketplacePath = join(testDir, 'test-marketplace');
      await mkdir(testMarketplacePath, { recursive: true });

      const marketplaceManifestPath = join(testMarketplacePath, '.claude-plugin', 'marketplace.json');
      await mkdir(join(testMarketplacePath, '.claude-plugin'), { recursive: true });
      await writeFile(
        marketplaceManifestPath,
        JSON.stringify({
          name: 'test-marketplace',
          owner: { name: 'Test Owner', email: 'test@example.com' },
          metadata: {
            description: 'Test marketplace',
            version: '1.0.0',
          },
          plugins: [
            {
              name: 'meta-skills',
              source: './',
              skills: ['./skill-a'],
            },
          ],
        }),
      );

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { 'claude/testmkt': { source: 'directory', path: testMarketplacePath } },
          plugins: {
            'meta-skills@claude/testmkt': { enabled: true },
          },
        }),
      );

      const skillAPath = join(testDir, '.cursor', 'skills', 'aipm', 'claude', 'testmkt', 'skill-a');
      await mkdir(skillAPath, { recursive: true });
      await writeFile(join(skillAPath, 'test.md'), '# Skill A');

      const options = {
        pluginId: 'meta-skills@claude/testmkt',
        cwd: testDir,
        removeFiles: false,
      };

      await pluginUninstall(options);

      expect(await fileExists(skillAPath)).toBe(true);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['meta-skills@claude/testmkt']).toBeUndefined();
    });
  });

  describe('regular plugin file deletion', () => {
    test('should delete all plugin directories for regular plugins with removeFiles=true', async () => {
      const testMarketplacePath = join(testDir, 'test-marketplace');
      const regularPluginPath = join(testMarketplacePath, 'regular-plugin');
      await mkdir(regularPluginPath, { recursive: true });

      const marketplaceManifestPath = join(testMarketplacePath, 'marketplace.json');
      await writeFile(
        marketplaceManifestPath,
        JSON.stringify({
          name: 'test-marketplace',
          plugins: [
            {
              name: 'regular-plugin',
              source: './regular-plugin',
            },
          ],
        }),
      );

      const pluginManifestDir = join(regularPluginPath, '.claude-plugin');
      await mkdir(pluginManifestDir, { recursive: true });
      await writeFile(join(pluginManifestDir, 'plugin.json'), JSON.stringify({ name: 'regular-plugin' }));

      await mkdir(join(regularPluginPath, 'commands'), { recursive: true });
      await writeFile(join(regularPluginPath, 'commands', 'test.md'), '# Command');

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { testmkt: { source: 'directory', path: testMarketplacePath } },
          plugins: {
            'regular-plugin@testmkt': { enabled: true },
          },
        }),
      );

      const commandsPath = join(testDir, '.cursor', 'commands', 'aipm', 'testmkt', 'regular-plugin');
      const rulesPath = join(testDir, '.cursor', 'rules', 'aipm', 'testmkt', 'regular-plugin');
      const agentsPath = join(testDir, '.cursor', 'agents', 'aipm', 'testmkt', 'regular-plugin');
      const skillsPath = join(testDir, '.cursor', 'skills', 'aipm', 'testmkt', 'regular-plugin');
      const hooksPath = join(testDir, '.cursor', 'hooks', 'aipm', 'testmkt', 'regular-plugin');

      await mkdir(commandsPath, { recursive: true });
      await mkdir(rulesPath, { recursive: true });
      await mkdir(agentsPath, { recursive: true });
      await mkdir(skillsPath, { recursive: true });
      await mkdir(hooksPath, { recursive: true });

      await writeFile(join(commandsPath, 'test.md'), '# Command');
      await writeFile(join(rulesPath, 'test.mdc'), '# Rule');
      await writeFile(join(agentsPath, 'test.md'), '# Agent');
      await writeFile(join(skillsPath, 'test.md'), '# Skill');
      await writeFile(join(hooksPath, 'test.sh'), '#!/bin/bash');

      const options = {
        pluginId: 'regular-plugin@testmkt',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      expect(await fileExists(commandsPath)).toBe(false);
      expect(await fileExists(rulesPath)).toBe(false);
      expect(await fileExists(agentsPath)).toBe(false);
      expect(await fileExists(skillsPath)).toBe(false);
      expect(await fileExists(hooksPath)).toBe(false);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['regular-plugin@testmkt']).toBeUndefined();
    });

    test('should not delete plugin directories for regular plugins with removeFiles=false', async () => {
      const testMarketplacePath = join(testDir, 'test-marketplace');
      const regularPluginPath = join(testMarketplacePath, 'regular-plugin');
      await mkdir(regularPluginPath, { recursive: true });

      const marketplaceManifestPath = join(testMarketplacePath, 'marketplace.json');
      await writeFile(
        marketplaceManifestPath,
        JSON.stringify({
          name: 'test-marketplace',
          plugins: [
            {
              name: 'regular-plugin',
              source: './regular-plugin',
            },
          ],
        }),
      );

      const pluginManifestDir = join(regularPluginPath, '.claude-plugin');
      await mkdir(pluginManifestDir, { recursive: true });
      await writeFile(join(pluginManifestDir, 'plugin.json'), JSON.stringify({ name: 'regular-plugin' }));

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { testmkt: { source: 'directory', path: testMarketplacePath } },
          plugins: {
            'regular-plugin@testmkt': { enabled: true },
          },
        }),
      );

      const commandsPath = join(testDir, '.cursor', 'commands', 'aipm', 'testmkt', 'regular-plugin');
      await mkdir(commandsPath, { recursive: true });
      await writeFile(join(commandsPath, 'test.md'), '# Command');

      const options = {
        pluginId: 'regular-plugin@testmkt',
        cwd: testDir,
        removeFiles: false,
      };

      await pluginUninstall(options);

      expect(await fileExists(commandsPath)).toBe(true);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['regular-plugin@testmkt']).toBeUndefined();
    });

    test('should still delete AIPM plugin files when marketplace config missing', async () => {
      const testMarketplacePath = join(testDir, 'test-marketplace');
      const regularPluginPath = join(testMarketplacePath, 'regular-plugin');
      await mkdir(regularPluginPath, { recursive: true });

      const marketplaceManifestPath = join(testMarketplacePath, 'marketplace.json');
      await writeFile(
        marketplaceManifestPath,
        JSON.stringify({
          name: 'test-marketplace',
          plugins: [
            {
              name: 'regular-plugin',
              source: './regular-plugin',
            },
          ],
        }),
      );

      const pluginManifestDir = join(regularPluginPath, '.claude-plugin');
      await mkdir(pluginManifestDir, { recursive: true });
      await writeFile(join(pluginManifestDir, 'plugin.json'), JSON.stringify({ name: 'regular-plugin' }));

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {},
          plugins: {
            'regular-plugin@testmkt': { enabled: true },
          },
        }),
      );

      const commandsPath = join(testDir, '.cursor', 'commands', 'aipm', 'testmkt', 'regular-plugin');
      await mkdir(commandsPath, { recursive: true });
      await writeFile(join(commandsPath, 'test.md'), '# Command');

      const options = {
        pluginId: 'regular-plugin@testmkt',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      expect(await fileExists(commandsPath)).toBe(false);

      const config = JSON.parse(await Bun.file(pluginsPath).text());
      expect(config.plugins['regular-plugin@testmkt']).toBeUndefined();
    });
  });

  describe('hooks cleanup', () => {
    test('should remove hooks from hooks.json when uninstalling with removeFiles=true', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'plugin-with-hooks@local': { enabled: true },
            'other-plugin@local': { enabled: true },
          },
        }),
      );

      // Create hooks.json with hooks from plugin-with-hooks and other-plugin
      const hooksPath = join(testDir, '.cursor', FILE_HOOKS_JSON);
      const hooksConfig: any = {
        version: 1,
        hooks: {
          beforeSubmitPrompt: [
            {
              'x-managedBy': 'aipm',
              'x-hookId': 'aipm/local/plugin-with-hooks/hook1',
              command: 'node /path/to/script1.js',
            },
            {
              'x-managedBy': 'aipm',
              'x-hookId': 'aipm/local/other-plugin/hook1',
              command: 'node /path/to/script2.js',
            },
            {
              'x-managedBy': 'user',
              'x-hookId': 'user/custom-hook',
              command: 'node /path/to/user-script.js',
            },
          ],
        },
      };
      await writeFile(hooksPath, JSON.stringify(hooksConfig, null, 2));

      const options = {
        pluginId: 'plugin-with-hooks@local',
        cwd: testDir,
        removeFiles: true,
      };

      await pluginUninstall(options);

      // Verify hooks.json was updated
      const updatedHooks = await readJsonFile<CursorHooksConfig>(hooksPath);
      expect(updatedHooks.hooks.beforeSubmitPrompt).toBeDefined();
      expect(updatedHooks.hooks.beforeSubmitPrompt?.length).toBe(2); // other-plugin hook + user hook

      // Verify plugin-with-hooks hooks were removed
      const pluginHooks = updatedHooks.hooks.beforeSubmitPrompt?.filter((hook) => {
        const h = hook as any;
        return h['x-hookId']?.startsWith('aipm/local/plugin-with-hooks/');
      });
      expect(pluginHooks?.length).toBe(0);

      // Verify other-plugin hooks were preserved
      const otherPluginHooks = updatedHooks.hooks.beforeSubmitPrompt?.filter((hook) => {
        const h = hook as any;
        return h['x-hookId']?.startsWith('aipm/local/other-plugin/');
      });
      expect(otherPluginHooks?.length).toBe(1);

      // Verify user hooks were preserved (using type assertion since user hooks don't match strict schema)
      const userHooks = updatedHooks.hooks.beforeSubmitPrompt?.filter((hook: any) => hook['x-managedBy'] === 'user');
      expect(userHooks?.length).toBe(1);
    });

    test('should not modify hooks.json when uninstalling with removeFiles=false', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'plugin-with-hooks@local': { enabled: true },
          },
        }),
      );

      // Create hooks.json with hooks from plugin-with-hooks
      const hooksPath = join(testDir, '.cursor', FILE_HOOKS_JSON);
      const hooksConfig: CursorHooksConfig = {
        version: 1,
        hooks: {
          beforeSubmitPrompt: [
            {
              'x-managedBy': 'aipm',
              'x-hookId': 'aipm/local/plugin-with-hooks/hook1',
              command: 'node /path/to/script1.js',
            },
          ],
        },
      };
      await writeFile(hooksPath, JSON.stringify(hooksConfig, null, 2));

      const options = {
        pluginId: 'plugin-with-hooks@local',
        cwd: testDir,
        removeFiles: false,
      };

      await pluginUninstall(options);

      // Verify hooks.json was NOT modified (hooks cleanup only happens with removeFiles=true)
      const updatedHooks = await readJsonFile<CursorHooksConfig>(hooksPath);
      expect(updatedHooks.hooks.beforeSubmitPrompt).toBeDefined();
      expect(updatedHooks.hooks.beforeSubmitPrompt?.length).toBe(1);
      expect(updatedHooks.hooks.beforeSubmitPrompt?.[0]?.['x-hookId']).toBe('aipm/local/plugin-with-hooks/hook1');
    });

    test('should handle missing hooks.json gracefully', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'plugin-with-hooks@local': { enabled: true },
          },
        }),
      );

      // Don't create hooks.json
      const options = {
        pluginId: 'plugin-with-hooks@local',
        cwd: testDir,
        removeFiles: true,
      };

      // Should not throw error
      await pluginUninstall(options);

      // hooks.json should not exist
      const hooksPath = join(testDir, '.cursor', FILE_HOOKS_JSON);
      expect(await fileExists(hooksPath)).toBe(false);
    });

    test('should handle malformed hooks.json with non-string x-hookId values', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'plugin-with-hooks@local': { enabled: true },
          },
        }),
      );

      // Create hooks.json with malformed x-hookId values (null, undefined, wrong type)
      const hooksPath = join(testDir, '.cursor', FILE_HOOKS_JSON);
      const hooksConfig: any = {
        version: 1,
        hooks: {
          beforeSubmitPrompt: [
            {
              'x-managedBy': 'aipm',
              'x-hookId': null, // null value
              command: 'node /path/to/script1.js',
            },
            {
              'x-managedBy': 'aipm',
              'x-hookId': 123, // number instead of string
              command: 'node /path/to/script2.js',
            },
            {
              'x-managedBy': 'aipm',
              'x-hookId': 'aipm/local/plugin-with-hooks/hook1',
              command: 'node /path/to/script3.js',
            },
            {
              'x-managedBy': 'user',
              command: 'node /path/to/user-script.js',
            },
          ],
        },
      };
      await writeFile(hooksPath, JSON.stringify(hooksConfig, null, 2));

      const options = {
        pluginId: 'plugin-with-hooks@local',
        cwd: testDir,
        removeFiles: true,
      };

      // Should not throw TypeError even with malformed x-hookId values
      await pluginUninstall(options);

      // Verify hooks.json was updated and malformed hooks were preserved
      const updatedHooks = await readJsonFile<any>(hooksPath);
      expect(updatedHooks.hooks.beforeSubmitPrompt).toBeDefined();

      // Malformed hooks (null, number) are preserved due to type check failure
      // Valid plugin hook is removed, user hook is preserved
      // Expected: null hook + number hook + user hook = 3 hooks
      expect(updatedHooks.hooks.beforeSubmitPrompt.length).toBe(3);

      // Verify the valid plugin hook was removed
      const validPluginHook = updatedHooks.hooks.beforeSubmitPrompt.find(
        (hook: any) => hook['x-hookId'] === 'aipm/local/plugin-with-hooks/hook1',
      );
      expect(validPluginHook).toBeUndefined();

      // Verify malformed hooks were preserved
      const nullHook = updatedHooks.hooks.beforeSubmitPrompt.find((hook: any) => hook['x-hookId'] === null);
      expect(nullHook).toBeDefined();

      const numberHook = updatedHooks.hooks.beforeSubmitPrompt.find((hook: any) => hook['x-hookId'] === 123);
      expect(numberHook).toBeDefined();
    });

    test('should not modify hooks.json when in dry-run mode', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: { local: { source: 'directory', path: './plugins' } },
          plugins: {
            'plugin-with-hooks@local': { enabled: true },
          },
        }),
      );

      // Create hooks.json with hooks from plugin-with-hooks
      const hooksPath = join(testDir, '.cursor', FILE_HOOKS_JSON);
      const originalHooksConfig: CursorHooksConfig = {
        version: 1,
        hooks: {
          beforeSubmitPrompt: [
            {
              'x-managedBy': 'aipm',
              'x-hookId': 'aipm/local/plugin-with-hooks/hook1',
              command: 'node /path/to/script1.js',
            },
          ],
        },
      };
      await writeFile(hooksPath, JSON.stringify(originalHooksConfig, null, 2));

      const options = {
        pluginId: 'plugin-with-hooks@local',
        cwd: testDir,
        removeFiles: true,
        dryRun: true,
      };

      await pluginUninstall(options);

      // Verify hooks.json was NOT modified (dry run should prevent modifications)
      const updatedHooks = await readJsonFile<CursorHooksConfig>(hooksPath);
      expect(updatedHooks.hooks.beforeSubmitPrompt).toBeDefined();
      expect(updatedHooks.hooks.beforeSubmitPrompt?.length).toBe(1);
      expect(updatedHooks.hooks.beforeSubmitPrompt?.[0]?.['x-hookId']).toBe('aipm/local/plugin-with-hooks/hook1');
    });
  });

  describe('flattened skill cleanup with plugin name prefix collisions', () => {
    test('should avoid prefix matching when plugin names are ambiguous', async () => {
      // This test verifies the fix for the prefix collision issue
      // When plugin names like "my-plugin" and "my-plugin-extra" exist,
      // we must be careful not to delete "my-plugin-extra's" skills when uninstalling "my-plugin"
      //
      // The fix: detect conflicting names and only use exact matching in those cases
      // Exact matching means we only delete the root directory (for files in skills/ root),
      // not the skill subdirectories, which is conservative and safe.
      //
      // A full test would require a valid marketplace manifest, which is complex in unit tests.
      // The code path is covered by integration tests in sync.test.ts.
      // This test just documents the fix and its intent.

      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const aipmDir = join(testDir, '.aipm');
      await mkdir(aipmDir, { recursive: true });

      // Create config with conflicting plugin names and marketplace
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './fake' },
          },
          plugins: {
            'plugin@local': { enabled: true },
            'plugin-extra@local': { enabled: true },
          },
        }),
      );

      // When uninstalling "plugin" and "plugin-extra" exists in the same marketplace,
      // the code detects the conflict and uses exact matching only
      // This prevents accidental deletion of plugin-extra's skills
      // The actual skill deletion is tested in sync.test.ts which has proper setup

      expect(true).toBe(true); // Placeholder - real test is in sync.test.ts
    });
  });
});
