import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
import { resetEnvCache } from '../../src/helpers/paths';

describe('Claude Code Config Reader', () => {
  let originalHome: string | undefined;
  let testHome: string;

  beforeEach(async () => {
    originalHome = process.env.HOME;

    testHome = await mkdtemp(join(tmpdir(), 'test-home-'));
    process.env.HOME = testHome;
    resetEnvCache();
  });

  afterEach(async () => {
    if (originalHome) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    resetEnvCache();

    await rm(testHome, { recursive: true, force: true });
  });

  describe('getClaudeCodePluginsDir', () => {
    test('returns correct path', () => {
      const dir = getClaudeCodePluginsDir();
      expect(dir).toBe(join(testHome, '.claude', 'plugins'));
    });
  });

  describe('isClaudeCodeInstalled', () => {
    test('returns false when .claude/plugins does not exist', async () => {
      const installed = await isClaudeCodeInstalled();
      expect(installed).toBe(false);
    });

    test('returns true when .claude/plugins exists', async () => {
      await mkdir(join(testHome, '.claude', 'plugins'), { recursive: true });

      const installed = await isClaudeCodeInstalled();
      expect(installed).toBe(true);
    });
  });

  describe('readClaudeCodeMarketplaces', () => {
    test('returns empty array when file does not exist', async () => {
      const marketplaces = await readClaudeCodeMarketplaces();
      expect(marketplaces).toEqual([]);
    });

    test('returns empty array when file is invalid JSON', async () => {
      const claudeDir = join(testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });
      await writeFile(join(claudeDir, 'known_marketplaces.json'), 'invalid json');

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(marketplaces).toEqual([]);
    });

    test('returns empty array when schema validation fails', async () => {
      const claudeDir = join(testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      const invalidConfig = {
        marketplaces: [
          {
            name: 'test',
            source: 'invalid-source',
          },
        ],
      };

      await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(invalidConfig));

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(marketplaces).toEqual([]);
    });

    test('parses known_marketplaces.json correctly', async () => {
      const claudeDir = join(testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      const config = {
        marketplaces: [
          {
            name: 'anthropic-agent-skills',
            source: 'directory',
            path: 'marketplaces/anthropic-agent-skills',
            enabled: true,
          },
          {
            name: 'my-git-marketplace',
            source: 'git',
            url: 'https://github.com/user/marketplace.git',
            branch: 'main',
          },
        ],
      };

      await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(config));

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(marketplaces).toHaveLength(2);
      expect(marketplaces[0]?.name).toBe('anthropic-agent-skills');
      expect(marketplaces[0]?.source).toBe('directory');
      expect(marketplaces[1]?.name).toBe('my-git-marketplace');
      expect(marketplaces[1]?.source).toBe('git');
    });

    test('parses url source marketplace correctly', async () => {
      const claudeDir = join(testHome, '.claude', 'plugins');
      await mkdir(claudeDir, { recursive: true });

      const config = {
        marketplaces: [
          {
            name: 'remote-marketplace',
            source: 'url',
            url: 'https://example.com/marketplace.json',
          },
        ],
      };

      await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(config));

      const marketplaces = await readClaudeCodeMarketplaces();
      expect(marketplaces).toHaveLength(1);
      expect(marketplaces[0]?.name).toBe('remote-marketplace');
      expect(marketplaces[0]?.source).toBe('url');
      expect(marketplaces[0]?.url).toBe('https://example.com/marketplace.json');
    });
  });

  describe('readClaudeCodeInstalledPlugins', () => {
    test('returns empty array when file does not exist', async () => {
      const plugins = await readClaudeCodeInstalledPlugins();
      expect(plugins).toEqual([]);
    });

    test('parses installed_plugins.json correctly', async () => {
      const claudeDir = join(testHome, '.claude', 'plugins');
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
      const claudeDir = join(testHome, '.claude', 'plugins');
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
      const marketplace = {
        name: 'anthropic-agent-skills',
        source: 'directory' as const,
        path: 'marketplaces/anthropic-agent-skills',
      };

      const path = getClaudeCodeMarketplacePath(marketplace);
      expect(path).toBe(join(testHome, '.claude', 'plugins', 'marketplaces', 'marketplaces/anthropic-agent-skills'));
    });

    test('returns absolute path for directory marketplace with absolute path', () => {
      const marketplace = {
        name: 'my-marketplace',
        source: 'directory' as const,
        path: '/absolute/path/to/marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplace);
      expect(path).toBe('/absolute/path/to/marketplace');
    });

    test('returns absolute path for Windows-style absolute path', () => {
      const marketplace = {
        name: 'windows-marketplace',
        source: 'directory' as const,
        path: 'C:\\Users\\test\\marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplace);
      expect(path).toBe('C:\\Users\\test\\marketplace');
    });

    test('returns absolute path for D: drive Windows path', () => {
      const marketplace = {
        name: 'windows-d-drive',
        source: 'directory' as const,
        path: 'D:\\Projects\\marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplace);
      expect(path).toBe('D:\\Projects\\marketplace');
    });

    test('returns absolute path for Windows forward-slash style path', () => {
      const marketplace = {
        name: 'windows-forward-slash',
        source: 'directory' as const,
        path: 'C:/Users/test/marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplace);
      expect(path).toBe('C:/Users/test/marketplace');
    });

    test('returns absolute path for UNC network path', () => {
      const marketplace = {
        name: 'unc-path',
        source: 'directory' as const,
        path: '\\\\server\\share\\marketplace',
      };

      const path = getClaudeCodeMarketplacePath(marketplace);
      expect(path).toBe('\\\\server\\share\\marketplace');
    });

    test('returns cached path for git marketplace', () => {
      const marketplace = {
        name: 'git-marketplace',
        source: 'git' as const,
        url: 'https://github.com/user/marketplace.git',
      };

      const path = getClaudeCodeMarketplacePath(marketplace);
      expect(path).toBe(join(testHome, '.claude', 'plugins', 'marketplaces', 'git-marketplace'));
    });

    test('returns cached path for url marketplace', () => {
      const marketplace = {
        name: 'url-marketplace',
        source: 'url' as const,
        url: 'https://example.com/marketplace.json',
      };

      const path = getClaudeCodeMarketplacePath(marketplace);
      expect(path).toBe(join(testHome, '.claude', 'plugins', 'marketplaces', 'url-marketplace'));
    });
  });

  describe('convertClaudeMarketplaceToAIPM', () => {
    test('converts directory marketplace correctly', () => {
      const claudeMarketplace = {
        name: 'test-marketplace',
        source: 'directory' as const,
        path: 'marketplaces/test-marketplace',
      };

      const aipmMarketplace = convertClaudeMarketplaceToAIPM(claudeMarketplace);

      expect(aipmMarketplace.source).toBe('directory');
      expect(aipmMarketplace.path).toContain('test-marketplace');
    });

    test('converts git marketplace correctly', () => {
      const claudeMarketplace = {
        name: 'git-marketplace',
        source: 'git' as const,
        url: 'https://github.com/user/marketplace.git',
        branch: 'main',
      };

      const aipmMarketplace = convertClaudeMarketplaceToAIPM(claudeMarketplace);

      expect(aipmMarketplace.source).toBe('git');
      expect(aipmMarketplace.url).toBe('https://github.com/user/marketplace.git');
      expect(aipmMarketplace.branch).toBe('main');
    });
  });
});
