import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { marketplaceUpdate } from '../../src/commands/marketplace-update';

describe('marketplace-update', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
    await mkdir(join(testDir, '.cursor'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('basic update', () => {
    test('should skip update for directory marketplace', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {},
        }),
      );

      const options = {
        name: 'local',
        cwd: testDir,
      };

      await marketplaceUpdate(options);
    });

    test('should error if marketplace not found', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {},
          plugins: {},
        }),
      );

      const options = {
        name: 'nonexistent',
        cwd: testDir,
      };

      await expect(marketplaceUpdate(options)).rejects.toThrow("Marketplace 'nonexistent' not found");
    });

    test('should error if no plugins.json found', async () => {
      const options = {
        name: 'local',
        cwd: testDir,
      };

      await expect(marketplaceUpdate(options)).rejects.toThrow('No plugins.json found');
    });
  });

  describe('dry-run mode', () => {
    test('should not update in dry-run mode', async () => {
      const pluginsPath = join(testDir, '.cursor', 'plugins.json');
      await writeFile(
        pluginsPath,
        JSON.stringify({
          marketplaces: {
            local: { source: 'directory', path: './marketplace' },
          },
          plugins: {},
        }),
      );

      const options = {
        name: 'local',
        cwd: testDir,
        dryRun: true,
      };

      await marketplaceUpdate(options);
    });
  });

  describe('validation', () => {
    test('should reject empty name', async () => {
      const options = {
        name: '',
        cwd: testDir,
      };

      await expect(marketplaceUpdate(options)).rejects.toThrow();
    });
  });
});
