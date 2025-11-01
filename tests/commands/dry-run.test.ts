import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { fileExists } from '../../src/helpers/fs';

describe('dry-run mode', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-dryrun-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('project init', () => {
    test('dry-run does not create any files', async () => {
      await init({ cwd: testDir, dryRun: true });

      const cursorDir = join(testDir, '.cursor');
      const pluginsFile = join(cursorDir, 'plugins.json');
      const exampleFile = join(cursorDir, 'plugins.local.json.example');

      expect(await fileExists(cursorDir)).toBe(false);
      expect(await fileExists(pluginsFile)).toBe(false);
      expect(await fileExists(exampleFile)).toBe(false);
    });

    test('dry-run with example template does not create files', async () => {
      await init({ cwd: testDir, dryRun: true, example: true });

      const cursorDir = join(testDir, '.cursor');
      const pluginsFile = join(cursorDir, 'plugins.json');

      expect(await fileExists(cursorDir)).toBe(false);
      expect(await fileExists(pluginsFile)).toBe(false);
    });

    test('dry-run with force does not overwrite existing files', async () => {
      await init({ cwd: testDir });

      const pluginsFile = join(testDir, '.cursor', 'plugins.json');
      const originalContent = await Bun.file(pluginsFile).json();

      await init({
        cwd: testDir,
        dryRun: true,
        force: true,
        skipConfirm: true,
      });

      const currentContent = await Bun.file(pluginsFile).json();
      expect(currentContent).toEqual(originalContent);

      const backupFile = `${pluginsFile}.backup`;
      expect(await fileExists(backupFile)).toBe(false);
    });

    test('dry-run does not modify gitignore', async () => {
      const gitignorePath = join(testDir, '.gitignore');
      await Bun.write(gitignorePath, 'node_modules/\n');

      await init({ cwd: testDir, dryRun: true });

      const content = await Bun.file(gitignorePath).text();
      expect(content).toBe('node_modules/\n');
      expect(content.includes('.cursor/plugins.local.json')).toBe(false);
    });
  });

  describe('global init', () => {
    test('dry-run does not create global directory', async () => {
      const tempGlobalDir = await mkdtemp(join(tmpdir(), 'cursor-global-dryrun-'));

      try {
        await rm(tempGlobalDir, { recursive: true });

        await init({
          global: true,
          globalDir: tempGlobalDir,
          dryRun: true,
          skipConfirm: true,
        });

        expect(await fileExists(tempGlobalDir)).toBe(false);
      } finally {
        await rm(tempGlobalDir, { recursive: true, force: true });
      }
    });

    test('dry-run does not create global config file', async () => {
      const tempGlobalDir = await mkdtemp(join(tmpdir(), 'cursor-global-dryrun-'));

      try {
        await init({
          global: true,
          globalDir: tempGlobalDir,
          dryRun: true,
          skipConfirm: true,
        });

        const configPath = join(tempGlobalDir, 'config.json');
        expect(await fileExists(configPath)).toBe(false);
      } finally {
        await rm(tempGlobalDir, { recursive: true, force: true });
      }
    });

    test('dry-run with force does not backup global config', async () => {
      const tempGlobalDir = await mkdtemp(join(tmpdir(), 'cursor-global-dryrun-'));

      try {
        await init({
          global: true,
          globalDir: tempGlobalDir,
          force: true,
          skipConfirm: true,
        });

        const configPath = join(tempGlobalDir, 'config.json');
        expect(await fileExists(configPath)).toBe(true);

        await init({
          global: true,
          globalDir: tempGlobalDir,
          dryRun: true,
          force: true,
          skipConfirm: true,
        });

        const backupPath = `${configPath}.backup`;
        expect(await fileExists(backupPath)).toBe(false);
      } finally {
        await rm(tempGlobalDir, { recursive: true, force: true });
      }
    });
  });
});
