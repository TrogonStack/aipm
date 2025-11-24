import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  convertClaudeMarketplaceToAIPM,
  getClaudeCodeMarketplacePath,
  getClaudeCodePluginsDir,
  isClaudeCodeInstalled,
  readClaudeCodeConfig,
  readClaudeCodeInstalledPlugins,
  readClaudeCodeMarketplaces,
} from '../../src/helpers/claude-code-config';
import { setupTestEnvironment, type TestSetup } from './test-support';

describe('Claude Code Config Reader', () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupTestEnvironment();
  });

  afterEach(async () => {
    await setup.cleanup();
  });

  describe('getClaudeCodePluginsDir', () => {
    test('returns correct path', () => {
      const dir = getClaudeCodePluginsDir();
      expect(dir).toBe(join(setup.testHome, '.claude', 'plugins'));
    });
  });

  describe('isClaudeCodeInstalled', () => {
    test('returns false when .claude/plugins does not exist', async () => {
      const installed = await isClaudeCodeInstalled();
      expect(installed).toBe(false);
    });

    test('returns true when .claude/plugins exists', async () => {
      await mkdir(join(setup.testHome, '.claude', 'plugins'), { recursive: true });

      const installed = await isClaudeCodeInstalled();
      expect(installed).toBe(true);
    });
  });

  describe('readClaudeCodeMarketplaces', () => {
    test('returns empty object when file does not exist', async () => {
      const marketplaces = await readClaudeCodeMarketplaces();
      expect(marketplaces).toEqual({});
    });

    test('returns empty object when file is invalid JSON', async () => {
      const claudeDir = join(setup.testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });
      await writeFile(join(claudeDir, 'known_marketplaces.json'), 'invalid json');

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(marketplaces).toEqual({});
    });

    test('returns empty object when schema validation fails', async () => {
      const claudeDir = join(setup.testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      // Invalid structure - not an object with marketplace entries
      const invalidConfig = {
        invalid: 'not a valid marketplace entry',
      };

      await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(invalidConfig));

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(marketplaces).toEqual({});
    });

    test('parses known_marketplaces.json correctly', async () => {
      const claudeDir = join(setup.testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      const config = {
        'anthropic-agent-skills': {
          source: 'directory',
          path: 'marketplaces/anthropic-agent-skills',
          enabled: true,
        },
        'my-git-marketplace': {
          source: 'git',
          url: 'https://github.com/user/marketplace.git',
          branch: 'main',
        },
      };

      await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(config));

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(Object.keys(marketplaces)).toHaveLength(2);
      expect(marketplaces['anthropic-agent-skills']).toBeDefined();
      expect(marketplaces['anthropic-agent-skills']?.source).toBe('directory');
      expect(marketplaces['my-git-marketplace']).toBeDefined();
      expect(marketplaces['my-git-marketplace']?.source).toBe('git');
    });

    test('parses url source marketplace correctly', async () => {
      const claudeDir = join(setup.testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      const config = {
        'remote-marketplace': {
          source: 'url',
          url: 'https://example.com/marketplace.json',
        },
      };

      await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(config));

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(Object.keys(marketplaces)).toHaveLength(1);
      expect(marketplaces['remote-marketplace']).toBeDefined();
      expect(marketplaces['remote-marketplace']?.source).toBe('url');
      expect(marketplaces['remote-marketplace']?.url).toBe('https://example.com/marketplace.json');
    });

    test('parses object format with github source correctly', async () => {
      const claudeDir = join(setup.testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      const config = {
        'anthropic-agent-skills': {
          source: {
            source: 'github',
            repo: 'anthropics/skills',
          },
          installLocation: '/Users/test/.claude/plugins/marketplaces/anthropic-agent-skills',
          lastUpdated: '2025-11-09T23:35:54.478Z',
        },
      };

      await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(config));

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(Object.keys(marketplaces)).toHaveLength(1);
      expect(marketplaces['anthropic-agent-skills']).toBeDefined();
      expect(marketplaces['anthropic-agent-skills']?.installLocation).toBe(
        '/Users/test/.claude/plugins/marketplaces/anthropic-agent-skills',
      );
    });

    test('parses object format with directory source correctly', async () => {
      const claudeDir = join(setup.testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      const config = {
        'local-marketplace': {
          source: 'directory',
          path: '/path/to/marketplace',
          enabled: true,
        },
      };

      await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(config));

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(Object.keys(marketplaces)).toHaveLength(1);
      expect(marketplaces['local-marketplace']).toBeDefined();
      expect(marketplaces['local-marketplace']?.source).toBe('directory');
      expect(marketplaces['local-marketplace']?.path).toBe('/path/to/marketplace');
      expect(marketplaces['local-marketplace']?.enabled).toBe(true);
    });
  });

  describe('readClaudeCodeInstalledPlugins', () => {
    test('returns empty array when file does not exist', async () => {
      const plugins = await readClaudeCodeInstalledPlugins();
      expect(plugins).toEqual([]);
    });

    test('parses installed_plugins.json correctly', async () => {
      const claudeDir = join(setup.testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      const config = {
        plugins: [
          {
            name: 'algorithmic-art',
            marketplace: 'anthropic-agent-skills',
            version: '1.0.0',
            enabled: true,
          },
          {
            name: 'document-skills/docx',
            marketplace: 'anthropic-agent-skills',
            enabled: false,
          },
        ],
      };

      await writeFile(join(claudeDir, 'installed_plugins.json'), JSON.stringify(config));

      const plugins = await readClaudeCodeInstalledPlugins();
      expect(plugins).toHaveLength(2);
      expect(plugins[0]?.name).toBe('algorithmic-art');
      expect(plugins[0]?.marketplace).toBe('anthropic-agent-skills');
      expect(plugins[1]?.name).toBe('document-skills/docx');
    });
  });

  describe('readClaudeCodeConfig', () => {
    test('returns null when file does not exist', async () => {
      const config = await readClaudeCodeConfig();
      expect(config).toBeNull();
    });

    test('parses config.json correctly', async () => {
      const claudeDir = join(setup.testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      const configData = {
        version: '1.0.0',
        autoUpdate: true,
        customField: 'value',
      };

      await writeFile(join(claudeDir, 'config.json'), JSON.stringify(configData));

      const config = await readClaudeCodeConfig();
      expect(config).not.toBeNull();
      expect(config?.version).toBe('1.0.0');
      expect(config?.autoUpdate).toBe(true);
    });
  });

  describe('getClaudeCodeMarketplacePath', () => {
    test('returns full path for directory marketplace with relative path', () => {
      const marketplaceName = 'anthropic-agent-skills';
      const marketplaceConfig = {
        source: 'directory' as const,
        path: 'marketplaces/anthropic-agent-skills',
      };

      const path = getClaudeCodeMarketplacePath(marketplaceName, marketplaceConfig);
      expect(path).toBe(
        join(setup.testHome, '.claude', 'plugins', 'marketplaces', 'marketplaces/anthropic-agent-skills'),
      );
    });

    test('returns absolute path for directory marketplace with absolute path', () => {
      const marketplaceName = 'my-marketplace';
      const marketplaceConfig = {
        source: 'directory' as const,
        path: '/absolute/path/to/marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplaceName, marketplaceConfig);
      expect(path).toBe('/absolute/path/to/marketplace');
    });

    test('returns absolute path for Windows-style absolute path', () => {
      const marketplaceName = 'windows-marketplace';
      const marketplaceConfig = {
        source: 'directory' as const,
        path: 'C:\\Users\\test\\marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplaceName, marketplaceConfig);
      expect(path).toBe('C:\\Users\\test\\marketplace');
    });

    test('returns absolute path for D: drive Windows path', () => {
      const marketplaceName = 'windows-d-drive';
      const marketplaceConfig = {
        source: 'directory' as const,
        path: 'D:\\Projects\\marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplaceName, marketplaceConfig);
      expect(path).toBe('D:\\Projects\\marketplace');
    });

    test('returns absolute path for Windows forward-slash style path', () => {
      const marketplaceName = 'windows-forward-slash';
      const marketplaceConfig = {
        source: 'directory' as const,
        path: 'C:/Users/test/marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplaceName, marketplaceConfig);
      expect(path).toBe('C:/Users/test/marketplace');
    });

    test('returns absolute path for UNC network path', () => {
      const marketplaceName = 'unc-path';
      const marketplaceConfig = {
        source: 'directory' as const,
        path: '\\\\server\\share\\marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplaceName, marketplaceConfig);
      expect(path).toBe('\\\\server\\share\\marketplace');
    });

    test('returns cached path for git marketplace', () => {
      const marketplaceName = 'git-marketplace';
      const marketplaceConfig = {
        source: 'git' as const,
        url: 'https://github.com/user/marketplace.git',
      };

      const path = getClaudeCodeMarketplacePath(marketplaceName, marketplaceConfig);
      expect(path).toBe(join(setup.testHome, '.claude', 'plugins', 'marketplaces', 'git-marketplace'));
    });

    test('returns cached path for url marketplace', () => {
      const marketplaceName = 'url-marketplace';
      const marketplaceConfig = {
        source: 'url' as const,
        url: 'https://example.com/marketplace.json',
      };

      const path = getClaudeCodeMarketplacePath(marketplaceName, marketplaceConfig);
      expect(path).toBe(join(setup.testHome, '.claude', 'plugins', 'marketplaces', 'url-marketplace'));
    });
  });

  describe('convertClaudeMarketplaceToAIPM', () => {
    test('converts directory marketplace correctly', () => {
      const marketplaceName = 'test-marketplace';
      const marketplaceConfig = {
        source: 'directory' as const,
        path: 'marketplaces/test-marketplace',
      };

      const aipmMarketplace = convertClaudeMarketplaceToAIPM(marketplaceName, marketplaceConfig);

      expect(aipmMarketplace.source).toBe('directory');
      expect(aipmMarketplace.path).toContain('test-marketplace');
    });

    test('converts git marketplace correctly', () => {
      const marketplaceName = 'git-marketplace';
      const marketplaceConfig = {
        source: 'git' as const,
        url: 'https://github.com/user/marketplace.git',
        branch: 'main',
      };

      const aipmMarketplace = convertClaudeMarketplaceToAIPM(marketplaceName, marketplaceConfig);

      expect(aipmMarketplace.source).toBe('git');
      expect(aipmMarketplace.url).toBe('https://github.com/user/marketplace.git');
      expect(aipmMarketplace.branch).toBe('main');
    });
  });
});
