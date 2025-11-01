import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { marketplaceAdd } from '../../src/commands/marketplace-add';
import { pluginEnable } from '../../src/commands/plugin-enable';
import { sync } from '../../src/commands/sync';
import { fileExists } from '../../src/helpers/fs';

describe('sync command with marketplace.json', () => {
  let testDir: string;
  let marketplaceDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-sync-manifest-test-'));
    marketplaceDir = join(testDir, 'marketplace');
    await mkdir(marketplaceDir);
    await init({ cwd: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  async function createMockPlugin(path: string, name: string) {
    const pluginPath = join(marketplaceDir, path);
    await mkdir(pluginPath, { recursive: true });
    await mkdir(join(pluginPath, '.claude-plugin'));
    await writeFile(
      join(pluginPath, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name,
        version: '1.0.0',
        description: `Test plugin ${name}`,
      }),
    );
    await mkdir(join(pluginPath, 'commands'));
    await writeFile(join(pluginPath, 'commands', 'test.md'), '# Test Command');
  }

  test('syncs plugin using marketplace.json source mapping', async () => {
    await createMockPlugin('custom/path/my-plugin', 'my-plugin');

    const manifest = {
      name: 'curated',
      owner: {
        name: 'Test Team',
        email: 'team@example.com',
      },
      metadata: {
        description: 'Curated plugins',
        version: '1.0.0',
      },
      plugins: [
        {
          name: 'my-plugin',
          source: './custom/path/my-plugin',
          description: 'Plugin with custom path',
          version: '1.0.0',
        },
      ],
    };

    await writeFile(join(marketplaceDir, 'marketplace.json'), JSON.stringify(manifest, null, 2));

    await marketplaceAdd({
      name: 'curated',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'my-plugin@curated',
      cwd: testDir,
    });

    await sync({ cwd: testDir });

    const commandsPath = join(testDir, '.cursor', 'commands', 'curated', 'my-plugin', 'test.md');
    expect(await fileExists(commandsPath)).toBe(true);
  });

  test('falls back to directory scanning when no marketplace.json', async () => {
    await createMockPlugin('my-plugin', 'my-plugin');

    await marketplaceAdd({
      name: 'unstructured',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'my-plugin@unstructured',
      cwd: testDir,
    });

    await sync({ cwd: testDir });

    const commandsPath = join(testDir, '.cursor', 'commands', 'unstructured', 'my-plugin', 'test.md');
    expect(await fileExists(commandsPath)).toBe(true);
  });

  test('syncs only plugins listed in marketplace.json', async () => {
    await createMockPlugin('included-plugin', 'included-plugin');
    await createMockPlugin('excluded-plugin', 'excluded-plugin');

    const manifest = {
      name: 'selective',
      owner: { name: 'Test' },
      plugins: [
        {
          name: 'included-plugin',
          source: './included-plugin',
        },
      ],
    };

    await writeFile(join(marketplaceDir, 'marketplace.json'), JSON.stringify(manifest));

    await marketplaceAdd({
      name: 'selective',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'included-plugin@selective',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'excluded-plugin@selective',
      cwd: testDir,
    });

    await sync({ cwd: testDir });

    expect(await fileExists(join(testDir, '.cursor', 'commands', 'selective', 'included-plugin', 'test.md'))).toBe(
      true,
    );

    expect(await fileExists(join(testDir, '.cursor', 'commands', 'selective', 'excluded-plugin', 'test.md'))).toBe(
      false,
    );
  });

  test('handles nested plugin paths in marketplace.json', async () => {
    await createMockPlugin('packages/tools/analyzer', 'analyzer');

    const manifest = {
      name: 'monorepo',
      owner: { name: 'Test' },
      plugins: [
        {
          name: 'analyzer',
          source: './packages/tools/analyzer',
        },
      ],
    };

    await writeFile(join(marketplaceDir, 'marketplace.json'), JSON.stringify(manifest));

    await marketplaceAdd({
      name: 'monorepo',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'analyzer@monorepo',
      cwd: testDir,
    });

    await sync({ cwd: testDir });

    expect(await fileExists(join(testDir, '.cursor', 'commands', 'monorepo', 'analyzer', 'test.md'))).toBe(true);
  });

  test('syncs multiple plugins with different paths', async () => {
    await createMockPlugin('core/plugin-a', 'plugin-a');
    await createMockPlugin('contrib/plugin-b', 'plugin-b');

    const manifest = {
      name: 'mixed',
      owner: { name: 'Test' },
      plugins: [
        { name: 'plugin-a', source: './core/plugin-a' },
        { name: 'plugin-b', source: './contrib/plugin-b' },
      ],
    };

    await writeFile(join(marketplaceDir, 'marketplace.json'), JSON.stringify(manifest));

    await marketplaceAdd({
      name: 'mixed',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({ pluginId: 'plugin-a@mixed', cwd: testDir });
    await pluginEnable({ pluginId: 'plugin-b@mixed', cwd: testDir });

    await sync({ cwd: testDir });

    expect(await fileExists(join(testDir, '.cursor', 'commands', 'mixed', 'plugin-a', 'test.md'))).toBe(true);
    expect(await fileExists(join(testDir, '.cursor', 'commands', 'mixed', 'plugin-b', 'test.md'))).toBe(true);
  });
});
