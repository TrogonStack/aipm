import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { sync } from '../../src/commands/sync';
import { fileExists } from '../../src/helpers/fs';
import { getGlobalDir } from '../../src/helpers/paths';

describe('sync command with git sources', () => {
  let testDir: string;
  let gitRepoDir: string;
  const globalDir = getGlobalDir();
  const cacheDir = join(globalDir, 'cache');

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-sync-git-test-'));
    gitRepoDir = join(testDir, 'git-repo');
    await rm(cacheDir, { recursive: true, force: true });
    await init({ cwd: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await rm(cacheDir, { recursive: true, force: true });
  });

  async function createGitRepo(plugins: string[]) {
    await mkdir(gitRepoDir, { recursive: true });

    for (const pluginName of plugins) {
      const pluginPath = join(gitRepoDir, pluginName);
      await mkdir(pluginPath, { recursive: true });
      await mkdir(join(pluginPath, '.claude-plugin'));
      await writeFile(
        join(pluginPath, '.claude-plugin', 'plugin.json'),
        JSON.stringify({
          name: pluginName,
          version: '1.0.0',
          description: `Test plugin ${pluginName}`,
        }),
      );
      await mkdir(join(pluginPath, 'commands'));
      await writeFile(join(pluginPath, 'commands', 'test.md'), `# ${pluginName} Command`);
    }

    Bun.spawnSync(['git', 'init'], { cwd: gitRepoDir });
    Bun.spawnSync(['git', 'config', 'user.email', 'test@test.com'], {
      cwd: gitRepoDir,
    });
    Bun.spawnSync(['git', 'config', 'user.name', 'Test User'], {
      cwd: gitRepoDir,
    });
    Bun.spawnSync(['git', 'add', '.'], { cwd: gitRepoDir });
    Bun.spawnSync(['git', 'commit', '-m', 'Initial commit'], {
      cwd: gitRepoDir,
    });
  }

  test('syncs plugin from git marketplace', async () => {
    await createGitRepo(['git-plugin']);

    const configPath = join(testDir, '.cursor', 'plugins.json');
    const config = JSON.parse(await Bun.file(configPath).text());

    config.marketplaces.git = {
      source: 'git',
      url: gitRepoDir,
    };
    config.plugins['git-plugin@git'] = {
      enabled: true,
    };

    await writeFile(configPath, JSON.stringify(config, null, 2));

    await sync({ cwd: testDir });

    const commandsPath = join(testDir, '.cursor', 'commands', 'git', 'git-plugin', 'test.md');
    expect(await fileExists(commandsPath)).toBe(true);
  });

  test('syncs multiple plugins from git marketplace', async () => {
    await createGitRepo(['plugin-a', 'plugin-b', 'plugin-c']);

    const configPath = join(testDir, '.cursor', 'plugins.json');
    const config = JSON.parse(await Bun.file(configPath).text());

    config.marketplaces.git = {
      source: 'git',
      url: gitRepoDir,
    };
    config.plugins['plugin-a@git'] = { enabled: true };
    config.plugins['plugin-b@git'] = { enabled: true };
    config.plugins['plugin-c@git'] = { enabled: false };

    await writeFile(configPath, JSON.stringify(config, null, 2));

    await sync({ cwd: testDir });

    expect(await fileExists(join(testDir, '.cursor', 'commands', 'git', 'plugin-a', 'test.md'))).toBe(true);
    expect(await fileExists(join(testDir, '.cursor', 'commands', 'git', 'plugin-b', 'test.md'))).toBe(true);
    expect(await fileExists(join(testDir, '.cursor', 'commands', 'git', 'plugin-c', 'test.md'))).toBe(false);
  });

  test('pulls updates from git marketplace on subsequent syncs', async () => {
    await createGitRepo(['update-plugin']);

    const configPath = join(testDir, '.cursor', 'plugins.json');
    const config = JSON.parse(await Bun.file(configPath).text());

    config.marketplaces.git = {
      source: 'git',
      url: gitRepoDir,
    };
    config.plugins['update-plugin@git'] = { enabled: true };

    await writeFile(configPath, JSON.stringify(config, null, 2));

    await sync({ cwd: testDir });

    const commandsPath = join(testDir, '.cursor', 'commands', 'git', 'update-plugin', 'test.md');
    expect(await fileExists(commandsPath)).toBe(true);

    await writeFile(join(gitRepoDir, 'update-plugin', 'commands', 'new-file.md'), '# New');
    Bun.spawnSync(['git', 'add', '.'], { cwd: gitRepoDir });
    Bun.spawnSync(['git', 'commit', '-m', 'Add new file'], {
      cwd: gitRepoDir,
    });

    await sync({ cwd: testDir });

    const newFilePath = join(testDir, '.cursor', 'commands', 'git', 'update-plugin', 'new-file.md');
    expect(await fileExists(newFilePath)).toBe(true);
  });

  test('supports branch parameter for git marketplace', async () => {
    await createGitRepo(['branch-plugin']);

    Bun.spawnSync(['git', 'checkout', '-b', 'feature'], { cwd: gitRepoDir });
    await writeFile(join(gitRepoDir, 'branch-plugin', 'commands', 'feature.md'), '# Feature');
    Bun.spawnSync(['git', 'add', '.'], { cwd: gitRepoDir });
    Bun.spawnSync(['git', 'commit', '-m', 'Feature branch'], {
      cwd: gitRepoDir,
    });

    const configPath = join(testDir, '.cursor', 'plugins.json');
    const config = JSON.parse(await Bun.file(configPath).text());

    config.marketplaces.git = {
      source: 'git',
      url: gitRepoDir,
      branch: 'feature',
    };
    config.plugins['branch-plugin@git'] = { enabled: true };

    await writeFile(configPath, JSON.stringify(config, null, 2));

    await sync({ cwd: testDir });

    const featurePath = join(testDir, '.cursor', 'commands', 'git', 'branch-plugin', 'feature.md');
    expect(await fileExists(featurePath)).toBe(true);
  });

  test('syncs from both directory and git marketplaces', async () => {
    await createGitRepo(['git-plugin']);

    const localMarketplace = join(testDir, 'local-marketplace');
    await mkdir(join(localMarketplace, 'local-plugin'), { recursive: true });
    await mkdir(join(localMarketplace, 'local-plugin', '.claude-plugin'));
    await writeFile(
      join(localMarketplace, 'local-plugin', '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'local-plugin',
        version: '1.0.0',
        description: 'Local plugin',
      }),
    );
    await mkdir(join(localMarketplace, 'local-plugin', 'commands'));
    await writeFile(join(localMarketplace, 'local-plugin', 'commands', 'local-test.md'), '# Local Test Command');

    const configPath = join(testDir, '.cursor', 'plugins.json');
    const config = JSON.parse(await Bun.file(configPath).text());

    config.marketplaces.git = {
      source: 'git',
      url: gitRepoDir,
    };
    config.marketplaces.local = {
      source: 'directory',
      path: './local-marketplace',
    };
    config.plugins['git-plugin@git'] = { enabled: true };
    config.plugins['local-plugin@local'] = { enabled: true };

    await writeFile(configPath, JSON.stringify(config, null, 2));

    await sync({ cwd: testDir });

    expect(await fileExists(join(testDir, '.cursor', 'commands', 'git', 'git-plugin', 'test.md'))).toBe(true);
    expect(await fileExists(join(testDir, '.cursor', 'commands', 'local', 'local-plugin', 'local-test.md'))).toBe(true);
  });

  test('handles git marketplace without url gracefully', async () => {
    const configPath = join(testDir, '.cursor', 'plugins.json');
    const config = JSON.parse(await Bun.file(configPath).text());

    config.marketplaces.broken = {
      source: 'git',
    };
    config.plugins['plugin@broken'] = { enabled: true };

    await writeFile(configPath, JSON.stringify(config, null, 2));

    await sync({ cwd: testDir });

    expect(await fileExists(join(testDir, '.cursor', 'commands', 'broken'))).toBe(false);
  });

  test("dry-run mode doesn't clone git repos", async () => {
    await createGitRepo(['dry-plugin']);

    const configPath = join(testDir, '.cursor', 'plugins.json');
    const config = JSON.parse(await Bun.file(configPath).text());

    config.marketplaces.git = {
      source: 'git',
      url: gitRepoDir,
    };
    config.plugins['dry-plugin@git'] = { enabled: true };

    await writeFile(configPath, JSON.stringify(config, null, 2));

    await sync({ cwd: testDir, dryRun: true });

    expect(await fileExists(join(cacheDir, 'git'))).toBe(false);
    expect(await fileExists(join(testDir, '.cursor', 'commands', 'git', 'dry-plugin'))).toBe(false);
  });
});
