import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { list } from '../../src/commands/list';
import { loadPluginsConfig } from '../../src/config/loader';
import { setupTestEnvironment } from '../helpers/test-support';

describe('Claude Code Auto-Discovery Integration', () => {
  let testHome: string;
  let testDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const setup = await setupTestEnvironment({ initProject: true });
    testHome = setup.testHome;
    testDir = setup.testDir!;
    cleanup = setup.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  test('automatically discovers Claude Code marketplaces when loading config', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      'anthropic-agent-skills': {
        source: 'directory',
        path: 'marketplaces/anthropic-agent-skills',
        enabled: true,
      },
      'claude-code-workflows': {
        source: 'directory',
        path: 'marketplaces/claude-code-workflows',
      },
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces, null, 2));

    await init({ cwd: testDir, skipConfirm: true });

    const { config } = await loadPluginsConfig(testDir);

    expect(config.marketplaces['claude:anthropic-agent-skills']?.source).toBe('directory');
    expect(config.marketplaces['claude:anthropic-agent-skills']?.path).toContain('anthropic-agent-skills');
    expect(config.marketplaces['claude:claude-code-workflows']).toBeDefined();
  });

  test('Claude Code marketplaces appear in aipm list command', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      'test-marketplace': {
        source: 'directory',
        path: 'marketplaces/test-marketplace',
      },
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces));

    await init({ cwd: testDir, skipConfirm: true });

    await list({ cwd: testDir });
  });

  test('allows installing plugins from auto-discovered Claude Code marketplaces', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const marketplaceDir = join(claudeDir, 'marketplaces', 'test-marketplace');
    await mkdir(join(marketplaceDir, 'test-plugin', '.claude-plugin'), { recursive: true });
    await writeFile(
      join(marketplaceDir, 'test-plugin', '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
        author: 'Test',
      }),
    );
    await mkdir(join(marketplaceDir, 'test-plugin', 'commands'), { recursive: true });
    await writeFile(
      join(marketplaceDir, 'test-plugin', 'commands', 'test.md'),
      '---\ndescription: Test\n---\n\n# Test',
    );

    const claudeMarketplaces = {
      'test-marketplace': {
        source: 'directory',
        path: marketplaceDir,
      },
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces));

    await init({ cwd: testDir, skipConfirm: true });

    const { config } = await loadPluginsConfig(testDir);

    expect(config.marketplaces['claude:test-marketplace']?.source).toBe('directory');
  });

  test('does not interfere with manually configured AIPM marketplaces', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      'claude-marketplace': {
        source: 'directory',
        path: 'marketplaces/claude-marketplace',
      },
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces));

    await init({ cwd: testDir, skipConfirm: true });

    const configPath = join(testDir, '.aipm', 'config.json');
    const aipmConfig = {
      marketplaces: {
        'my-marketplace': {
          source: 'directory',
          path: './my-plugins',
        },
      },
      plugins: {},
    };

    await writeFile(configPath, JSON.stringify(aipmConfig, null, 2));

    const { config } = await loadPluginsConfig(testDir);

    expect(config.marketplaces['my-marketplace']).toBeDefined();
    expect(config.marketplaces['claude:claude-marketplace']).toBeDefined();
  });

  test('handles missing Claude Code installation gracefully', async () => {
    await init({ cwd: testDir, skipConfirm: true });

    const { config } = await loadPluginsConfig(testDir);

    expect(config).not.toBeNull();
    const claudeMarketplaces = Object.keys(config.marketplaces || {}).filter((name) => name.startsWith('claude:'));
    expect(claudeMarketplaces).toHaveLength(0);
  });

  test('skips Claude Code marketplace when name collides with AIPM marketplace', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      'my-marketplace': {
        source: 'directory',
        path: 'marketplaces/claude-my-marketplace',
      },
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces));

    await init({ cwd: testDir, skipConfirm: true });

    const configPath = join(testDir, '.aipm', 'config.json');
    const aipmConfig = {
      marketplaces: {
        'claude:my-marketplace': {
          source: 'directory',
          path: './aipm-marketplace',
        },
      },
      plugins: {},
    };

    await writeFile(configPath, JSON.stringify(aipmConfig, null, 2));

    const { config } = await loadPluginsConfig(testDir);

    expect(config.marketplaces['claude:my-marketplace']?.path).toBe('./aipm-marketplace');
  });

  test('discovers git-based Claude Code marketplace', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      'git-marketplace': {
        source: 'git',
        url: 'https://github.com/org/marketplace.git',
        branch: 'main',
      },
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces));

    await init({ cwd: testDir, skipConfirm: true });

    const { config } = await loadPluginsConfig(testDir);

    expect(config.marketplaces['claude:git-marketplace']?.source).toBe('git');
    expect(config.marketplaces['claude:git-marketplace']?.url).toBe('https://github.com/org/marketplace.git');
    expect(config.marketplaces['claude:git-marketplace']?.branch).toBe('main');
  });
});
