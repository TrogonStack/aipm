import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { marketplaceAdd } from '../../src/commands/marketplace-add';
import { loadPluginsConfig } from '../../src/config/loader';

describe('marketplace add with GitHub shorthand', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-github-add-test-'));
    await init({ cwd: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('expands GitHub shorthand to git URL', async () => {
    await marketplaceAdd({
      name: 'community',
      path: 'cursor-community/plugins',
      cwd: testDir,
    });

    const config = await loadPluginsConfig(testDir);
    const marketplace = config?.marketplaces.community;

    expect(marketplace).toBeDefined();
    expect(marketplace?.source).toBe('git');
    expect(marketplace?.url).toMatch(
      /^(https:\/\/github\.com\/cursor-community\/plugins\.git|git@github\.com:cursor-community\/plugins\.git)$/,
    );
  });

  test('expands shorthand with hyphens and numbers', async () => {
    await marketplaceAdd({
      name: 'team',
      path: 'my-org-123/my-plugins-456',
      cwd: testDir,
    });

    const config = await loadPluginsConfig(testDir);
    const marketplace = config?.marketplaces.team;

    expect(marketplace).toBeDefined();
    expect(marketplace?.source).toBe('git');
    expect(marketplace?.url).toMatch(
      /^(https:\/\/github\.com\/my-org-123\/my-plugins-456\.git|git@github\.com:my-org-123\/my-plugins-456\.git)$/,
    );
  });

  test('expands shorthand with dots and underscores', async () => {
    await marketplaceAdd({
      name: 'special',
      path: 'my.org/my_repo',
      cwd: testDir,
    });

    const config = await loadPluginsConfig(testDir);
    const marketplace = config?.marketplaces.special;

    expect(marketplace).toBeDefined();
    expect(marketplace?.source).toBe('git');
    expect(marketplace?.url).toMatch(
      /^(https:\/\/github\.com\/my\.org\/my_repo\.git|git@github\.com:my\.org\/my_repo\.git)$/,
    );
  });

  test('does not expand full GitHub URLs', async () => {
    await marketplaceAdd({
      name: 'full-url',
      path: 'https://github.com/owner/repo.git',
      cwd: testDir,
    });

    const config = await loadPluginsConfig(testDir);
    const marketplace = config?.marketplaces['full-url'];

    expect(marketplace).toBeDefined();
    expect(marketplace?.source).toBe('git');
    expect(marketplace?.url).toBe('https://github.com/owner/repo.git');
  });

  test('does not expand SSH URLs', async () => {
    await marketplaceAdd({
      name: 'ssh-url',
      path: 'git@github.com:owner/repo.git',
      cwd: testDir,
    });

    const config = await loadPluginsConfig(testDir);
    const marketplace = config?.marketplaces['ssh-url'];

    expect(marketplace).toBeDefined();
    expect(marketplace?.source).toBe('git');
    expect(marketplace?.url).toBe('git@github.com:owner/repo.git');
  });

  test('does not expand local paths', async () => {
    await marketplaceAdd({
      name: 'local',
      path: './my-plugins',
      cwd: testDir,
    });

    const config = await loadPluginsConfig(testDir);
    const marketplace = config?.marketplaces.local;

    expect(marketplace).toBeDefined();
    expect(marketplace?.source).toBe('directory');
    expect(marketplace?.path).toBe('./my-plugins');
  });

  test('does not expand invalid shorthand', async () => {
    await marketplaceAdd({
      name: 'invalid',
      path: 'just-a-name',
      cwd: testDir,
    });

    const config = await loadPluginsConfig(testDir);
    const marketplace = config?.marketplaces.invalid;

    expect(marketplace).toBeDefined();
    expect(marketplace?.source).toBe('directory');
    expect(marketplace?.path).toBe('just-a-name');
  });

  test('handles dry-run mode with shorthand', async () => {
    await marketplaceAdd({
      name: 'dry',
      path: 'owner/repo',
      cwd: testDir,
      dryRun: true,
    });

    const config = await loadPluginsConfig(testDir);
    const marketplace = config?.marketplaces.dry;

    expect(marketplace).toBeUndefined();
  });
});
