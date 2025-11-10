import { rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { join } from 'node:path';
import { DIR_CACHE } from '../constants';
import type { MarketplaceSource } from '../schema';
import { ensureDir, fileExists } from './fs';
import { fetchRemoteMarketplaceManifest } from './marketplace';
import { getGlobalDir } from './paths';

export async function resolveMarketplacePath(
  marketplaceName: string,
  marketplace: MarketplaceSource,
  cwd: string,
  options: { dryRun?: boolean } = {},
): Promise<string | null> {
  switch (marketplace.source) {
    case 'directory': {
      if (!marketplace.path) {
        return null;
      }
      // If path is absolute, use it directly; otherwise join with cwd
      if (path.isAbsolute(marketplace.path) || path.win32.isAbsolute(marketplace.path)) {
        return marketplace.path;
      }
      const resolvedPath = join(cwd, marketplace.path);
      return resolvedPath;
    }

    case 'git': {
      if (!marketplace.url) {
        return null;
      }

      const globalDir = getGlobalDir();
      const cacheDir = join(globalDir, DIR_CACHE, marketplaceName);

      if (options.dryRun) {
        return cacheDir;
      }

      const exists = await fileExists(cacheDir);

      if (exists) {
        await gitPull(cacheDir, marketplace.url, marketplace.branch);
      } else {
        await gitClone(marketplace.url, cacheDir, marketplace.branch);
      }

      return cacheDir;
    }

    case 'url': {
      if (!marketplace.url) {
        return null;
      }

      const globalDir = getGlobalDir();
      const cacheDir = join(globalDir, 'cache', marketplaceName);

      if (options.dryRun) {
        return cacheDir;
      }

      const manifest = await fetchRemoteMarketplaceManifest(marketplace.url);

      await ensureDir(cacheDir);

      await writeFile(join(cacheDir, 'marketplace.json'), JSON.stringify(manifest, null, 2));

      return cacheDir;
    }

    default: {
      const exhaustiveCheck: never = marketplace.source;
      throw new Error(`Unknown marketplace source type: ${exhaustiveCheck}`);
    }
  }
}

async function gitClone(url: string, targetDir: string, branch?: string): Promise<void> {
  await ensureDir(targetDir);

  const args = ['clone'];

  if (branch) {
    args.push('--branch', branch);
  }

  args.push('--depth', '1', url, targetDir);

  const result = Bun.spawnSync(['git', ...args]);

  if (!result.success) {
    throw new Error(`Failed to clone git repository: ${result.stderr?.toString() || 'Unknown error'}`);
  }
}

async function gitPull(repoDir: string, url: string, branch?: string): Promise<void> {
  const fetchResult = Bun.spawnSync(['git', 'fetch', 'origin'], {
    cwd: repoDir,
  });

  if (!fetchResult.success) {
    await rm(repoDir, { recursive: true, force: true });
    await gitClone(url, repoDir, branch);
    return;
  }

  const branchToUse = branch || 'HEAD';

  const resetResult = Bun.spawnSync(['git', 'reset', '--hard', `origin/${branchToUse}`], {
    cwd: repoDir,
  });

  if (!resetResult.success) {
    throw new Error(`Failed to update git repository: ${resetResult.stderr?.toString() || 'Unknown error'}`);
  }

  const cleanResult = Bun.spawnSync(['git', 'clean', '-fd'], {
    cwd: repoDir,
  });

  if (!cleanResult.success) {
    throw new Error(`Failed to clean git repository: ${cleanResult.stderr?.toString() || 'Unknown error'}`);
  }
}

export async function clearMarketplaceCache(marketplaceName?: string): Promise<void> {
  const globalDir = getGlobalDir();
  const cacheDir = join(globalDir, 'cache');

  if (marketplaceName) {
    const marketplaceCacheDir = join(cacheDir, marketplaceName);
    if (await fileExists(marketplaceCacheDir)) {
      await rm(marketplaceCacheDir, { recursive: true, force: true });
    }
  } else {
    if (await fileExists(cacheDir)) {
      await rm(cacheDir, { recursive: true, force: true });
    }
  }
}
