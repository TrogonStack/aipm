import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileExists } from '../../src/helpers/fs';
import { clearMarketplaceCache, resolveMarketplacePath } from '../../src/helpers/git';
import { getGlobalDir } from '../../src/helpers/paths';
import type { MarketplaceSource } from '../../src/schema';

describe('git utilities', () => {
  const testCwd = join(import.meta.dir, '../fixtures/git-test');
  const globalDir = getGlobalDir();
  const cacheDir = join(globalDir, 'cache');

  beforeEach(async () => {
    await rm(testCwd, { recursive: true, force: true });
    await mkdir(testCwd, { recursive: true });
    await rm(cacheDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(testCwd, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true });
  });

  describe('resolveMarketplacePath', () => {
    test('resolves directory source to relative path', async () => {
      const marketplace: MarketplaceSource = {
        source: 'directory',
        path: 'marketplaces/demo',
      };

      const result = await resolveMarketplacePath('demo', marketplace, testCwd);
      expect(result).toBe(join(testCwd, 'marketplaces/demo'));
    });

    test('returns null for directory source without path', async () => {
      const marketplace: MarketplaceSource = {
        source: 'directory',
      };

      const result = await resolveMarketplacePath('demo', marketplace, testCwd);
      expect(result).toBeNull();
    });

    test('returns null for git source without url', async () => {
      const marketplace: MarketplaceSource = {
        source: 'git',
      };

      const result = await resolveMarketplacePath('demo', marketplace, testCwd);
      expect(result).toBeNull();
    });

    test('returns cache path for git source in dry-run mode', async () => {
      const marketplace: MarketplaceSource = {
        source: 'git',
        url: 'https://github.com/test/repo.git',
      };

      const result = await resolveMarketplacePath('demo', marketplace, testCwd, {
        dryRun: true,
      });

      expect(result).toBe(join(cacheDir, 'demo'));
      expect(await fileExists(join(cacheDir, 'demo'))).toBe(false);
    });

    test('throws error for invalid source type', async () => {
      const marketplace = {
        source: 'invalid' as any,
      } as MarketplaceSource;

      await expect(resolveMarketplacePath('demo', marketplace, testCwd)).rejects.toThrow(
        'Unknown marketplace source type: invalid',
      );
    });

    test("clones git repo if cache doesn't exist", async () => {
      const testRepo = join(testCwd, 'test-repo');
      await mkdir(testRepo, { recursive: true });
      await writeFile(join(testRepo, 'test.txt'), 'test content');

      const gitInit = Bun.spawnSync(['git', 'init'], { cwd: testRepo });
      expect(gitInit.success).toBe(true);

      const gitConfig1 = Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], { cwd: testRepo });
      expect(gitConfig1.success).toBe(true);

      const gitConfig2 = Bun.spawnSync(['git', 'config', 'user.name', 'Test User'], { cwd: testRepo });
      expect(gitConfig2.success).toBe(true);

      const gitAdd = Bun.spawnSync(['git', 'add', '.'], { cwd: testRepo });
      expect(gitAdd.success).toBe(true);

      const gitCommit = Bun.spawnSync(['git', 'commit', '-m', 'Initial commit'], { cwd: testRepo });
      expect(gitCommit.success).toBe(true);

      const marketplace: MarketplaceSource = {
        source: 'git',
        url: testRepo,
      };

      const result = await resolveMarketplacePath('test', marketplace, testCwd);

      expect(result).toBe(join(cacheDir, 'test'));
      expect(await fileExists(join(cacheDir, 'test'))).toBe(true);
      expect(await fileExists(join(cacheDir, 'test', 'test.txt'))).toBe(true);

      const content = await Bun.file(join(cacheDir, 'test', 'test.txt')).text();
      expect(content).toBe('test content');
    });

    test('pulls updates if git repo cache exists', async () => {
      const testRepo = join(testCwd, 'test-repo');
      await mkdir(testRepo, { recursive: true });
      await writeFile(join(testRepo, 'initial.txt'), 'initial');

      Bun.spawnSync(['git', 'init'], { cwd: testRepo });
      Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], {
        cwd: testRepo,
      });
      Bun.spawnSync(['git', 'config', 'user.name', 'Test User'], {
        cwd: testRepo,
      });
      Bun.spawnSync(['git', 'add', '.'], { cwd: testRepo });
      Bun.spawnSync(['git', 'commit', '-m', 'Initial'], { cwd: testRepo });

      const marketplace: MarketplaceSource = {
        source: 'git',
        url: testRepo,
      };

      await resolveMarketplacePath('test', marketplace, testCwd);
      expect(await fileExists(join(cacheDir, 'test', 'initial.txt'))).toBe(true);

      await writeFile(join(testRepo, 'update.txt'), 'updated');
      Bun.spawnSync(['git', 'add', '.'], { cwd: testRepo });
      Bun.spawnSync(['git', 'commit', '-m', 'Update'], { cwd: testRepo });

      await resolveMarketplacePath('test', marketplace, testCwd);
      expect(await fileExists(join(cacheDir, 'test', 'update.txt'))).toBe(true);
    });

    test('discards local changes and untracked files on pull', async () => {
      const testRepo = join(testCwd, 'test-repo');
      await mkdir(testRepo, { recursive: true });
      await writeFile(join(testRepo, 'tracked.txt'), 'original');

      Bun.spawnSync(['git', 'init'], { cwd: testRepo });
      Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], {
        cwd: testRepo,
      });
      Bun.spawnSync(['git', 'config', 'user.name', 'Test User'], {
        cwd: testRepo,
      });
      Bun.spawnSync(['git', 'add', '.'], { cwd: testRepo });
      Bun.spawnSync(['git', 'commit', '-m', 'Initial'], { cwd: testRepo });

      const marketplace: MarketplaceSource = {
        source: 'git',
        url: testRepo,
      };

      await resolveMarketplacePath('test', marketplace, testCwd);

      await writeFile(join(cacheDir, 'test', 'tracked.txt'), 'modified');
      await writeFile(join(cacheDir, 'test', 'untracked.txt'), 'untracked');

      expect(await Bun.file(join(cacheDir, 'test', 'tracked.txt')).text()).toBe('modified');
      expect(await fileExists(join(cacheDir, 'test', 'untracked.txt'))).toBe(true);

      await writeFile(join(testRepo, 'new.txt'), 'new file');
      Bun.spawnSync(['git', 'add', '.'], { cwd: testRepo });
      Bun.spawnSync(['git', 'commit', '-m', 'Add new file'], { cwd: testRepo });

      await resolveMarketplacePath('test', marketplace, testCwd);

      expect(await Bun.file(join(cacheDir, 'test', 'tracked.txt')).text()).toBe('original');
      expect(await fileExists(join(cacheDir, 'test', 'untracked.txt'))).toBe(false);
      expect(await fileExists(join(cacheDir, 'test', 'new.txt'))).toBe(true);
    });

    test('supports branch parameter for git clone', async () => {
      const testRepo = join(testCwd, 'test-repo');
      await mkdir(testRepo, { recursive: true });
      await writeFile(join(testRepo, 'main.txt'), 'main branch');

      Bun.spawnSync(['git', 'init'], { cwd: testRepo });
      Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], {
        cwd: testRepo,
      });
      Bun.spawnSync(['git', 'config', 'user.name', 'Test User'], {
        cwd: testRepo,
      });
      Bun.spawnSync(['git', 'add', '.'], { cwd: testRepo });
      Bun.spawnSync(['git', 'commit', '-m', 'Main'], { cwd: testRepo });

      Bun.spawnSync(['git', 'checkout', '-b', 'feature'], { cwd: testRepo });
      await writeFile(join(testRepo, 'feature.txt'), 'feature branch');
      Bun.spawnSync(['git', 'add', '.'], { cwd: testRepo });
      Bun.spawnSync(['git', 'commit', '-m', 'Feature'], { cwd: testRepo });

      const marketplace: MarketplaceSource = {
        source: 'git',
        url: testRepo,
        branch: 'feature',
      };

      const result = await resolveMarketplacePath('test', marketplace, testCwd);

      expect(result).toBe(join(cacheDir, 'test'));
      expect(await fileExists(join(cacheDir, 'test', 'feature.txt'))).toBe(true);
      expect(await fileExists(join(cacheDir, 'test', 'main.txt'))).toBe(true);
    });
  });

  describe('clearMarketplaceCache', () => {
    test('clears specific marketplace cache', async () => {
      await mkdir(join(cacheDir, 'demo'), { recursive: true });
      await writeFile(join(cacheDir, 'demo', 'test.txt'), 'test');
      await mkdir(join(cacheDir, 'other'), { recursive: true });
      await writeFile(join(cacheDir, 'other', 'test.txt'), 'test');

      await clearMarketplaceCache('demo');

      expect(await fileExists(join(cacheDir, 'demo'))).toBe(false);
      expect(await fileExists(join(cacheDir, 'other'))).toBe(true);
    });

    test('clears all cache when no marketplace specified', async () => {
      await mkdir(join(cacheDir, 'demo'), { recursive: true });
      await writeFile(join(cacheDir, 'demo', 'test.txt'), 'test');
      await mkdir(join(cacheDir, 'other'), { recursive: true });
      await writeFile(join(cacheDir, 'other', 'test.txt'), 'test');

      await clearMarketplaceCache();

      expect(await fileExists(cacheDir)).toBe(false);
    });

    test("does nothing if marketplace cache doesn't exist", async () => {
      await clearMarketplaceCache('nonexistent');
      expect(await fileExists(join(cacheDir, 'nonexistent'))).toBe(false);
    });

    test("does nothing if cache directory doesn't exist", async () => {
      await clearMarketplaceCache();
      expect(await fileExists(cacheDir)).toBe(false);
    });
  });
});
