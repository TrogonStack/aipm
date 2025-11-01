import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { marketplaceAdd } from '../../src/commands/marketplace-add';
import { pluginEnable } from '../../src/commands/plugin-enable';
import { sync } from '../../src/commands/sync';
import { fileExists } from '../../src/helpers/fs';

describe('sync command with rules and .cursor.yaml', () => {
  let testDir: string;
  let marketplaceDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'cursor-sync-rules-test-'));
    marketplaceDir = join(testDir, 'marketplace');
    await mkdir(marketplaceDir);
    await init({ cwd: testDir });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('syncs .md rule to .mdc without cursor.yaml', async () => {
    const pluginDir = join(marketplaceDir, 'test-plugin');
    await mkdir(join(pluginDir, '.claude-plugin'), { recursive: true });
    await writeFile(
      join(pluginDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }),
    );

    await mkdir(join(pluginDir, 'rules'));
    await writeFile(
      join(pluginDir, 'rules', 'my-rule.md'),
      `---
alwaysApply: true
---

# My Rule

Rule content here.`,
    );

    await marketplaceAdd({
      name: 'local',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'test-plugin@local',
      cwd: testDir,
    });

    await sync({ cwd: testDir });

    const outputPath = join(testDir, '.cursor', 'rules', 'local', 'test-plugin', 'my-rule.mdc');

    expect(await fileExists(outputPath)).toBe(true);

    const content = await readFile(outputPath, 'utf-8');
    expect(content).toContain('alwaysApply: true');
    expect(content).toContain('# My Rule');
    expect(content).toContain('Rule content here.');
  });

  test('syncs .mdc rule to .mdc without cursor.yaml', async () => {
    const pluginDir = join(marketplaceDir, 'test-plugin');
    await mkdir(join(pluginDir, '.claude-plugin'), { recursive: true });
    await writeFile(
      join(pluginDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }),
    );

    await mkdir(join(pluginDir, 'rules'));
    await writeFile(
      join(pluginDir, 'rules', 'my-rule.mdc'),
      `---
setting: value
---

# My Rule Content`,
    );

    await marketplaceAdd({
      name: 'local',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'test-plugin@local',
      cwd: testDir,
    });

    await sync({ cwd: testDir });

    const outputPath = join(testDir, '.cursor', 'rules', 'local', 'test-plugin', 'my-rule.mdc');

    expect(await fileExists(outputPath)).toBe(true);

    const content = await readFile(outputPath, 'utf-8');
    expect(content).toContain('setting: value');
    expect(content).toContain('# My Rule Content');
  });

  test('applies .cursor.yaml frontmatter override', async () => {
    const pluginDir = join(marketplaceDir, 'test-plugin');
    await mkdir(join(pluginDir, '.claude-plugin'), { recursive: true });
    await writeFile(
      join(pluginDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }),
    );

    await mkdir(join(pluginDir, 'rules'));

    // Claude Code version with its frontmatter
    await writeFile(
      join(pluginDir, 'rules', 'my-rule.md'),
      `---
alwaysApply: true
claudeSetting: enabled
---

# My Rule

This is the rule content.`,
    );

    // Cursor-specific frontmatter override
    await writeFile(
      join(pluginDir, 'rules', 'my-rule.cursor.yaml'),
      `cursorSetting: custom
enabled: true
priority: high`,
    );

    await marketplaceAdd({
      name: 'local',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'test-plugin@local',
      cwd: testDir,
    });

    await sync({ cwd: testDir });

    const outputPath = join(testDir, '.cursor', 'rules', 'local', 'test-plugin', 'my-rule.mdc');

    expect(await fileExists(outputPath)).toBe(true);

    const content = await readFile(outputPath, 'utf-8');

    // Should have Cursor frontmatter
    expect(content).toContain('cursorSetting: custom');
    expect(content).toContain('enabled: true');
    expect(content).toContain('priority: high');

    // Should NOT have Claude Code frontmatter
    expect(content).not.toContain('alwaysApply');
    expect(content).not.toContain('claudeSetting');

    // Should have the content
    expect(content).toContain('# My Rule');
    expect(content).toContain('This is the rule content.');
  });

  test('handles multiple rules with mixed .cursor.yaml overrides', async () => {
    const pluginDir = join(marketplaceDir, 'test-plugin');
    await mkdir(join(pluginDir, '.claude-plugin'), { recursive: true });
    await writeFile(
      join(pluginDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }),
    );

    await mkdir(join(pluginDir, 'rules'));

    // Rule 1: with .cursor.yaml override
    await writeFile(
      join(pluginDir, 'rules', 'rule-with-override.md'),
      `---
alwaysApply: true
---

# Rule With Override`,
    );
    await writeFile(join(pluginDir, 'rules', 'rule-with-override.cursor.yaml'), `cursorMode: strict`);

    // Rule 2: without .cursor.yaml override
    await writeFile(
      join(pluginDir, 'rules', 'rule-without-override.md'),
      `---
alwaysApply: false
---

# Rule Without Override`,
    );

    await marketplaceAdd({
      name: 'local',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'test-plugin@local',
      cwd: testDir,
    });

    await sync({ cwd: testDir });

    // Check rule with override
    const overridePath = join(testDir, '.cursor', 'rules', 'local', 'test-plugin', 'rule-with-override.mdc');
    expect(await fileExists(overridePath)).toBe(true);
    const overrideContent = await readFile(overridePath, 'utf-8');
    expect(overrideContent).toContain('cursorMode: strict');
    expect(overrideContent).not.toContain('alwaysApply');
    expect(overrideContent).toContain('# Rule With Override');

    // Check rule without override
    const noOverridePath = join(testDir, '.cursor', 'rules', 'local', 'test-plugin', 'rule-without-override.mdc');
    expect(await fileExists(noOverridePath)).toBe(true);
    const noOverrideContent = await readFile(noOverridePath, 'utf-8');
    expect(noOverrideContent).toContain('alwaysApply: false');
    expect(noOverrideContent).toContain('# Rule Without Override');
  });

  test('does not copy .cursor.yaml files to output', async () => {
    const pluginDir = join(marketplaceDir, 'test-plugin');
    await mkdir(join(pluginDir, '.claude-plugin'), { recursive: true });
    await writeFile(
      join(pluginDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'test-plugin',
        version: '1.0.0',
      }),
    );

    await mkdir(join(pluginDir, 'rules'));
    await writeFile(join(pluginDir, 'rules', 'my-rule.md'), '# Rule');
    await writeFile(join(pluginDir, 'rules', 'my-rule.cursor.yaml'), 'setting: value');

    await marketplaceAdd({
      name: 'local',
      path: './marketplace',
      cwd: testDir,
    });

    await pluginEnable({
      pluginId: 'test-plugin@local',
      cwd: testDir,
    });

    await sync({ cwd: testDir });

    const cursorYamlPath = join(testDir, '.cursor', 'rules', 'local', 'test-plugin', 'my-rule.cursor.yaml');

    expect(await fileExists(cursorYamlPath)).toBe(false);
  });
});
