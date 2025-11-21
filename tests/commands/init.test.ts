import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { fileExists } from '../../src/helpers/fs';
import { MockIO } from '../../src/helpers/io';

describe('aipm init', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('creates .aipm/config.json with default structure', async () => {
    await init({ cwd: testDir });

    const pluginsPath = join(testDir, '.aipm', 'config.json');
    expect(await fileExists(pluginsPath)).toBe(true);

    const file = Bun.file(pluginsPath);
    const config = await file.json();

    expect(config).toHaveProperty('marketplaces');
    expect(config).toHaveProperty('plugins');
    expect(config.marketplaces).toEqual({});
    expect(config.plugins).toEqual({});
  });

  test('creates .aipm/config.local.json.example', async () => {
    await init({ cwd: testDir });

    const examplePath = join(testDir, '.aipm', 'config.local.json.example');
    expect(await fileExists(examplePath)).toBe(true);

    const file = Bun.file(examplePath);
    const config = await file.json();

    expect(config).toHaveProperty('plugins');
  });

  test('creates .aipm directory if it does not exist', async () => {
    await init({ cwd: testDir });

    const aipmDir = join(testDir, '.aipm');
    expect(await fileExists(aipmDir)).toBe(true);
  });
  test('does not overwrite existing config without --force', async () => {
    await init({ cwd: testDir });

    const pluginsPath = join(testDir, '.aipm', 'config.json');
    const originalContent = await Bun.file(pluginsPath).text();

    await init({ cwd: testDir });

    const newContent = await Bun.file(pluginsPath).text();
    expect(newContent).toBe(originalContent);
  });

  test('includes examples with --example flag', async () => {
    await init({ cwd: testDir, example: true });

    const pluginsPath = join(testDir, '.aipm', 'config.json');
    const file = Bun.file(pluginsPath);
    const config = await file.json();

    expect(Object.keys(config.marketplaces).length).toBeGreaterThan(0);
    expect(Object.keys(config.plugins).length).toBeGreaterThan(0);
  });

  test('adds plugins.local.json to .gitignore if it exists', async () => {
    const gitignorePath = join(testDir, '.gitignore');
    await Bun.write(gitignorePath, 'node_modules/\n');

    await init({ cwd: testDir });

    const content = await Bun.file(gitignorePath).text();
    expect(content).toContain('.aipm/config.local.json');
  });

  test('does not create .gitignore if it does not exist', async () => {
    const gitignorePath = join(testDir, '.gitignore');

    await init({ cwd: testDir });

    const exists = await fileExists(gitignorePath);
    expect(exists).toBe(false);
  });

  test('adds relative path to .gitignore when initialized in subdirectory', async () => {
    // Initialize git repo
    await Bun.spawn(['git', 'init'], { cwd: testDir, stdout: 'ignore', stderr: 'ignore' }).exited;
    await Bun.spawn(['git', 'config', 'user.email', 'test@test.com'], {
      cwd: testDir,
      stdout: 'ignore',
      stderr: 'ignore',
    }).exited;
    await Bun.spawn(['git', 'config', 'user.name', 'Test'], {
      cwd: testDir,
      stdout: 'ignore',
      stderr: 'ignore',
    }).exited;

    // Create .gitignore at root
    const gitignorePath = join(testDir, '.gitignore');
    await Bun.write(gitignorePath, 'node_modules/\n');

    // Create subdirectory
    const subdir = join(testDir, 'packages', 'app');
    await Bun.spawn(['mkdir', '-p', subdir], { stdout: 'ignore' }).exited;

    // Initialize aipm in subdirectory
    await init({ cwd: subdir });

    // Check that .gitignore at root has relative path
    const content = await Bun.file(gitignorePath).text();
    expect(content).toContain('packages/app/.aipm/config.local.json');
    // Should not have the entry without the subdirectory prefix
    expect(content.split('\n').filter((line) => line === '.aipm/config.local.json')).toHaveLength(0);
  });

  test('creates global config with --global flag', async () => {
    const tempGlobalDir = await mkdtemp(join(tmpdir(), 'cursor-global-'));

    try {
      await init({
        global: true,
        globalDir: tempGlobalDir,
        force: true,
        skipConfirm: true,
      });

      const configPath = join(tempGlobalDir, 'config.json');

      expect(await fileExists(configPath)).toBe(true);

      const file = Bun.file(configPath);
      const config = await file.json();

      expect(config).toHaveProperty('marketplaces');
      expect(config).toHaveProperty('plugins');
    } finally {
      await rm(tempGlobalDir, { recursive: true, force: true });
    }
  });

  test('creates backup when using --force on existing config', async () => {
    await init({ cwd: testDir });

    const pluginsPath = join(testDir, '.aipm', 'config.json');
    const backupPath = `${pluginsPath}.backup`;

    await init({ cwd: testDir, force: true, skipConfirm: true });

    expect(await fileExists(backupPath)).toBe(true);
  });

  test('prompts for confirmation when --force without --skip-confirm', async () => {
    const io = new MockIO();
    io.confirmResponses = [true];

    await init({ cwd: testDir, io });
    await init({ cwd: testDir, force: true, io });

    const confirmLog = io.logs.find((log) => log.type === 'confirm');
    expect(confirmLog).toBeDefined();
    expect(confirmLog?.message).toContain('overwrite');
  });

  test('cancels when user declines confirmation', async () => {
    const io = new MockIO();
    io.confirmResponses = [false];

    await init({ cwd: testDir, io });

    const pluginsPath = join(testDir, '.aipm', 'config.json');
    const originalContent = await Bun.file(pluginsPath).text();

    await init({ cwd: testDir, force: true, io });

    const newContent = await Bun.file(pluginsPath).text();
    expect(newContent).toBe(originalContent);

    const cancelLog = io.logs.find((log) => log.message === 'Cancelled');
    expect(cancelLog).toBeDefined();
  });

  test('global init prompts for confirmation when --force without --skip-confirm', async () => {
    const io = new MockIO();
    const tempGlobalDir = await mkdtemp(join(tmpdir(), 'cursor-global-'));

    try {
      io.confirmResponses = [true];

      await init({
        global: true,
        globalDir: tempGlobalDir,
        io,
      });

      await init({
        global: true,
        globalDir: tempGlobalDir,
        force: true,
        io,
      });

      const confirmLog = io.logs.find((log) => log.type === 'confirm');
      expect(confirmLog).toBeDefined();
      expect(confirmLog?.message).toContain('overwrite');
    } finally {
      await rm(tempGlobalDir, { recursive: true, force: true });
    }
  });

  test('global init cancels when user declines confirmation', async () => {
    const io = new MockIO();
    const tempGlobalDir = await mkdtemp(join(tmpdir(), 'cursor-global-'));

    try {
      io.confirmResponses = [false];

      await init({
        global: true,
        globalDir: tempGlobalDir,
        skipConfirm: true,
        io,
      });

      const configPath = join(tempGlobalDir, 'config.json');
      const originalContent = await Bun.file(configPath).text();

      await init({
        global: true,
        globalDir: tempGlobalDir,
        force: true,
        io,
      });

      const newContent = await Bun.file(configPath).text();
      expect(newContent).toBe(originalContent);

      const cancelLog = io.logs.find((log) => log.message === 'Cancelled');
      expect(cancelLog).toBeDefined();
    } finally {
      await rm(tempGlobalDir, { recursive: true, force: true });
    }
  });

  test('handles errors during project initialization', async () => {
    const io = new MockIO();
    const invalidPath = '/non/existent/path/that/cannot/be/created';

    await expect(init({ cwd: invalidPath, io })).rejects.toThrow();

    const errorLog = io.logs.find((log) => log.type === 'error');
    expect(errorLog).toBeDefined();
    expect(errorLog?.message).toContain('Failed to initialize');
  });

  test('shows info message when global config exists without force', async () => {
    const io = new MockIO();
    const tempGlobalDir = await mkdtemp(join(tmpdir(), 'cursor-global-'));

    try {
      await init({
        global: true,
        globalDir: tempGlobalDir,
        skipConfirm: true,
        io,
      });

      io.reset();

      await init({
        global: true,
        globalDir: tempGlobalDir,
        io,
      });

      const infoLogs = io.logs.filter((log) => log.type === 'info');
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(infoLogs.some((log) => log.message.includes('already exists'))).toBe(true);
      expect(infoLogs.some((log) => log.message.includes('--force'))).toBe(true);
    } finally {
      await rm(tempGlobalDir, { recursive: true, force: true });
    }
  });
});
