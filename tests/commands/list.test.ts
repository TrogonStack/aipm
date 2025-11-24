import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { list } from '../../src/commands/list';
import { marketplaceAdd } from '../../src/commands/marketplace-add';
import { writeJsonFile } from '../../src/helpers/fs';
import { setupTestEnvironment } from '../helpers/test-support';

describe('list command', () => {
  let testDir: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const setup = await setupTestEnvironment({ initProject: true });
    testDir = setup.testDir!;
    cleanup = setup.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('basic functionality', () => {
    test('shows message when no marketplaces or plugins configured', async () => {
      const consoleLog = mock(() => {});
      const originalLog = console.log;
      console.log = consoleLog;

      try {
        await list({ cwd: testDir });
        const output = consoleLog.mock.calls.map((call: any) => call[0]).join('\n');
        expect(output).not.toContain('📦 Marketplaces:');
        expect(output).not.toContain('🔌 Plugins:');
      } finally {
        console.log = originalLog;
      }
    });

    test('lists configured marketplaces', async () => {
      await marketplaceAdd({
        name: 'local-plugins',
        path: './my-plugins',
        cwd: testDir,
      });

      const consoleLog = mock(() => {});
      const originalLog = console.log;
      console.log = consoleLog;

      try {
        await list({ cwd: testDir });

        const output = consoleLog.mock.calls.map((call: any) => call[0]).join('\n');
        expect(output).toContain('📦 Marketplaces:');
        expect(output).toContain('local-plugins');
        expect(output).toContain('Source: directory');
        expect(output).toContain('Path: ./my-plugins');
      } finally {
        console.log = originalLog;
      }
    });

    test('lists multiple marketplaces', async () => {
      await marketplaceAdd({
        name: 'first',
        path: './first',
        cwd: testDir,
      });

      await marketplaceAdd({
        name: 'second',
        path: './second',
        cwd: testDir,
      });

      const consoleLog = mock(() => {});
      const originalLog = console.log;
      console.log = consoleLog;

      try {
        await list({ cwd: testDir });

        const output = consoleLog.mock.calls.map((call: any) => call[0]).join('\n');
        expect(output).toContain('first');
        expect(output).toContain('second');
      } finally {
        console.log = originalLog;
      }
    });

    test('lists configured plugins', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'test-plugin@marketplace': {
          enabled: true,
          scope: 'project',
          version: '1.0.0',
        },
      };
      await writeJsonFile(pluginsPath, config);

      const consoleLog = mock(() => {});
      const originalLog = console.log;
      console.log = consoleLog;

      try {
        await list({ cwd: testDir });

        const output = consoleLog.mock.calls.map((call: any) => call[0]).join('\n');
        expect(output).toContain('🔌 Plugins:');
        expect(output).toContain('test-plugin@marketplace');
        expect(output).toContain('v1.0.0');
        expect(output).toContain('(project)');
        expect(output).toContain('✓');
      } finally {
        console.log = originalLog;
      }
    });

    test('shows disabled plugins', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.plugins = {
        'disabled-plugin@marketplace': {
          enabled: false,
        },
      };
      await writeJsonFile(pluginsPath, config);

      const consoleLog = mock(() => {});
      const originalLog = console.log;
      console.log = consoleLog;

      try {
        await list({ cwd: testDir });

        const output = consoleLog.mock.calls.map((call: any) => call[0]).join('\n');
        expect(output).toContain('disabled-plugin@marketplace');
        expect(output).toContain('✗');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('different marketplace sources', () => {
    test('displays git marketplace source', async () => {
      const pluginsPath = join(testDir, '.aipm', 'config.json');
      const config = await Bun.file(pluginsPath).json();
      config.marketplaces = {
        'git-marketplace': {
          source: 'git',
          url: 'https://example.com/repo.git',
        },
      };
      await writeJsonFile(pluginsPath, config);

      const consoleLog = mock(() => {});
      const originalLog = console.log;
      console.log = consoleLog;

      try {
        await list({ cwd: testDir });

        const output = consoleLog.mock.calls.map((call: any) => call[0]).join('\n');
        expect(output).toContain('git-marketplace');
        expect(output).toContain('Source: git');
        expect(output).toContain('URL: https://example.com/repo.git');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('validation', () => {
    test('fails when plugins.json does not exist', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'cursor-empty-'));

      try {
        await list({ cwd: emptyDir });
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    test('validates options with Zod', async () => {
      try {
        await list({ cwd: 123 } as any);
        throw new Error('Should have thrown validation error');
      } catch (error: unknown) {
        expect(error && typeof error === 'object' && 'name' in error && error.name).toBe('ZodError');
      }
    });
  });
});
