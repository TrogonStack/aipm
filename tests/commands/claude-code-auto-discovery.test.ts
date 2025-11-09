import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { list } from '../../src/commands/list';
import { loadPluginsConfig } from '../../src/config/loader';
import { resetEnvCache } from '../../src/helpers/paths';

describe('Claude Code Auto-Discovery Integration', () => {
  let originalHome: string | undefined;
  let testHome: string;
  let testDir: string;

  beforeEach(async () => {
    originalHome = process.env.HOME;

    testHome = await mkdtemp(join(tmpdir(), 'test-home-'));
    process.env.HOME = testHome;
    resetEnvCache();

    testDir = await mkdtemp(join(tmpdir(), 'test-project-'));
  });

  afterEach(async () => {
    if (originalHome) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    resetEnvCache();

    await rm(testHome, { recursive: true, force: true });
    await rm(testDir, { recursive: true, force: true });
  });

  test('automatically discovers Claude Code marketplaces when loading config', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      marketplaces: [
        {
          name: 'anthropic-agent-skills',
          source: 'directory',
          path: 'marketplaces/anthropic-agent-skills',
          enabled: true,
        },
        {
          name: 'claude-code-workflows',
          source: 'directory',
          path: 'marketplaces/claude-code-workflows',
        },
      ],
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces, null, 2));

    await init({ cwd: testDir, skipConfirm: true });

    const config = await loadPluginsConfig(testDir);

    expect(config?.marketplaces['claude:anthropic-agent-skills']?.source).toBe('directory');
    expect(config?.marketplaces['claude:anthropic-agent-skills']?.path).toContain('anthropic-agent-skills');
    expect(config?.marketplaces['claude:claude-code-workflows']).toBeDefined();
  });

  test('Claude Code marketplaces appear in aipm list command', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      marketplaces: [
        {
          name: 'test-marketplace',
          source: 'directory',
          path: 'marketplaces/test-marketplace',
        },
      ],
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
      marketplaces: [
        {
          name: 'test-marketplace',
          source: 'directory',
          path: marketplaceDir,
        },
      ],
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces));

    await init({ cwd: testDir, skipConfirm: true });

    const config = await loadPluginsConfig(testDir);

    expect(config?.marketplaces['claude:test-marketplace']?.source).toBe('directory');
  });

  test('does not interfere with manually configured AIPM marketplaces', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      marketplaces: [
        {
          name: 'claude-marketplace',
          source: 'directory',
          path: 'marketplaces/claude-marketplace',
        },
      ],
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces));

    await init({ cwd: testDir, skipConfirm: true });

    const configPath = join(testDir, '.cursor', 'plugins.json');
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

    const config = await loadPluginsConfig(testDir);

    expect(config?.marketplaces['my-marketplace']).toBeDefined();
    expect(config?.marketplaces['claude:claude-marketplace']).toBeDefined();
  });

  test('handles missing Claude Code installation gracefully', async () => {
    await init({ cwd: testDir, skipConfirm: true });

    const config = await loadPluginsConfig(testDir);

    expect(config).not.toBeNull();
    const claudeMarketplaces = Object.keys(config?.marketplaces || {}).filter((name) => name.startsWith('claude:'));
    expect(claudeMarketplaces).toHaveLength(0);
  });

  test('skips Claude Code marketplace when name collides with AIPM marketplace', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      marketplaces: [
        {
          name: 'my-marketplace',
          source: 'directory',
          path: 'marketplaces/claude-my-marketplace',
        },
      ],
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces));

    await init({ cwd: testDir, skipConfirm: true });

    const configPath = join(testDir, '.cursor', 'plugins.json');
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

    const config = await loadPluginsConfig(testDir);

    expect(config?.marketplaces['claude:my-marketplace']?.path).toBe('./aipm-marketplace');
  });

  test('discovers git-based Claude Code marketplace', async () => {
    const claudeDir = join(testHome, '.claude', 'plugins');
    await mkdir(claudeDir, { recursive: true });

    const claudeMarketplaces = {
      marketplaces: [
        {
          name: 'git-marketplace',
          source: 'git',
          url: 'https://github.com/org/marketplace.git',
          branch: 'main',
        },
      ],
    };

    await writeFile(join(claudeDir, 'known_marketplaces.json'), JSON.stringify(claudeMarketplaces));

    await init({ cwd: testDir, skipConfirm: true });

    const config = await loadPluginsConfig(testDir);

    expect(config?.marketplaces['claude:git-marketplace']?.source).toBe('git');
    expect(config?.marketplaces['claude:git-marketplace']?.url).toBe('https://github.com/org/marketplace.git');
    expect(config?.marketplaces['claude:git-marketplace']?.branch).toBe('main');
  });
});
