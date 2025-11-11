import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  fetchRemoteMarketplaceManifest,
  getAvailablePlugins,
  getPluginSourcePath,
  isPluginInManifest,
  loadMarketplaceManifest,
} from '../../src/helpers/marketplace';

describe('marketplace utilities', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'aipm-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('fetchRemoteMarketplaceManifest', () => {
    test('fetches and validates remote marketplace.json', async () => {
      const mockManifest = {
        name: 'remote-marketplace',
        owner: { name: 'Remote Team' },
        plugins: [{ name: 'plugin', source: './plugin' }],
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockManifest),
        } as Response),
      ) as any;

      try {
        const result = await fetchRemoteMarketplaceManifest('https://example.com/marketplace.json');
        expect(result).toEqual(mockManifest);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('throws error on HTTP failure', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as Response),
      ) as any;

      try {
        await expect(fetchRemoteMarketplaceManifest('https://example.com/missing.json')).rejects.toThrow(
          'Failed to fetch marketplace.json',
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('throws error on invalid manifest structure', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ invalid: 'data' }),
        } as Response),
      ) as any;

      try {
        await expect(fetchRemoteMarketplaceManifest('https://example.com/invalid.json')).rejects.toThrow();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('loadMarketplaceManifest', () => {
    test("returns null when marketplace.json doesn't exist", async () => {
      const result = await loadMarketplaceManifest(testDir, 'aipm');
      expect(result).toBeNull();
    });

    test('loads valid marketplace.json', async () => {
      const manifest = {
        name: 'test-marketplace',
        owner: {
          name: 'Test Owner',
          email: 'test@example.com',
        },
        metadata: {
          description: 'A test marketplace',
          version: '1.0.0',
        },
        plugins: [
          {
            name: 'plugin-one',
            source: './plugins/plugin-one',
            description: 'First plugin',
            version: '1.0.0',
          },
          {
            name: 'plugin-two',
            source: './plugins/plugin-two',
          },
        ],
      };

      await writeFile(join(testDir, 'marketplace.json'), JSON.stringify(manifest));

      const result = await loadMarketplaceManifest(testDir, 'aipm');
      expect(result).toEqual(manifest);
    });

    test('returns null for invalid marketplace.json', async () => {
      await writeFile(join(testDir, 'marketplace.json'), JSON.stringify({ invalid: 'data' }));

      const result = await loadMarketplaceManifest(testDir, 'aipm');
      expect(result).toBeNull();
    });

    test('returns null for malformed JSON', async () => {
      await writeFile(join(testDir, 'marketplace.json'), '{invalid json}');

      const result = await loadMarketplaceManifest(testDir, 'aipm');
      expect(result).toBeNull();
    });
  });

  describe('getAvailablePlugins', () => {
    test('uses marketplace.json when available', async () => {
      const manifest = {
        name: 'test',
        owner: { name: 'Test' },
        plugins: [
          { name: 'plugin-a', source: './plugins/a' },
          { name: 'plugin-b', source: './plugins/b' },
        ],
      };

      await mkdir(join(testDir, 'plugin-c'));
      await mkdir(join(testDir, 'plugin-d'));

      const plugins = await getAvailablePlugins(testDir, manifest);

      expect(plugins).toEqual(['plugin-a', 'plugin-b']);
      expect(plugins).not.toContain('plugin-c');
      expect(plugins).not.toContain('plugin-d');
    });

    test('falls back to directory scanning when no manifest', async () => {
      await mkdir(join(testDir, 'plugin-a', '.claude-plugin'), { recursive: true });
      await mkdir(join(testDir, 'plugin-b', '.claude-plugin'), { recursive: true });
      await mkdir(join(testDir, '.hidden'));

      const plugins = await getAvailablePlugins(testDir, null);

      expect(plugins).toContain('plugin-a');
      expect(plugins).toContain('plugin-b');
      expect(plugins).not.toContain('.hidden');
    });

    test('excludes dot directories when scanning', async () => {
      await mkdir(join(testDir, 'visible-plugin', '.claude-plugin'), { recursive: true });
      await mkdir(join(testDir, '.git'));
      await mkdir(join(testDir, '.claude-plugin'));

      const plugins = await getAvailablePlugins(testDir, null);

      expect(plugins).toEqual(['visible-plugin']);
    });

    test('handles deep nesting beyond 3 levels', async () => {
      // Create a structure 6 levels deep
      await mkdir(join(testDir, 'level1/level2/level3/level4/level5/deep-plugin/.claude-plugin'), {
        recursive: true,
      });

      const plugins = await getAvailablePlugins(testDir, null);

      expect(plugins).toContain('level1/level2/level3/level4/level5/deep-plugin');
    });

    test('finds plugins at multiple nesting levels', async () => {
      await mkdir(join(testDir, 'top-level/.claude-plugin'), { recursive: true });
      await mkdir(join(testDir, 'one/nested/.claude-plugin'), { recursive: true });
      await mkdir(join(testDir, 'one/two/three/very-nested/.claude-plugin'), { recursive: true });

      const plugins = await getAvailablePlugins(testDir, null);

      expect(plugins).toContain('top-level');
      expect(plugins).toContain('one/nested');
      expect(plugins).toContain('one/two/three/very-nested');
      expect(plugins).toHaveLength(3);
    });

    test('handles symlink loops without hanging', async () => {
      await mkdir(join(testDir, 'loop-a'), { recursive: true });
      await mkdir(join(testDir, 'loop-b'), { recursive: true });

      // Create circular symlinks (may fail on some systems, that's ok)
      try {
        const { symlink } = await import('node:fs/promises');
        await symlink(join(testDir, 'loop-b'), join(testDir, 'loop-a/link-to-b'), 'dir');
        await symlink(join(testDir, 'loop-a'), join(testDir, 'loop-b/link-to-a'), 'dir');
      } catch {
        // Symlinks might fail on some systems (Windows), skip this part
      }

      // Add a real plugin in the same directory
      await mkdir(join(testDir, 'real-plugin/.claude-plugin'), { recursive: true });

      const plugins = await getAvailablePlugins(testDir, null);

      // Should find the real plugin and not hang
      expect(plugins).toContain('real-plugin');
    });

    test('does not escape marketplace directory via symlink', async () => {
      // Create a plugin inside the marketplace
      await mkdir(join(testDir, 'valid-plugin/.claude-plugin'), { recursive: true });

      // Try to create a symlink pointing outside (to /tmp or /etc)
      try {
        const { symlink } = await import('node:fs/promises');
        await symlink('/tmp', join(testDir, 'escape-link'), 'dir');
      } catch {
        // May fail on some systems, that's ok
      }

      const plugins = await getAvailablePlugins(testDir, null);

      // Should only find the valid plugin, not traverse outside
      expect(plugins).toEqual(['valid-plugin']);
    });

    test('rejects symlinked plugin with marker outside marketplace', async () => {
      // Create a directory outside the marketplace with a .claude-plugin marker
      const outsideDir = await mkdtemp(join(tmpdir(), 'aipm-outside-'));

      try {
        await mkdir(join(outsideDir, 'evil-plugin/.claude-plugin'), { recursive: true });

        // Create a symlink inside the marketplace pointing to the outside plugin
        try {
          const { symlink } = await import('node:fs/promises');
          await symlink(join(outsideDir, 'evil-plugin'), join(testDir, 'evil-link'), 'dir');
        } catch {
          // May fail on some systems (Windows), skip this test
          return;
        }

        // Add a valid plugin for comparison
        await mkdir(join(testDir, 'valid-plugin/.claude-plugin'), { recursive: true });

        const plugins = await getAvailablePlugins(testDir, null);

        // Should only find the valid plugin, not the symlinked evil plugin
        expect(plugins).toContain('valid-plugin');
        expect(plugins).not.toContain('evil-link');
        expect(plugins).not.toContain('evil-plugin');
        expect(plugins).toHaveLength(1);
      } finally {
        await rm(outsideDir, { recursive: true, force: true });
      }
    });

    test('handles mixed valid plugins and organizational folders', async () => {
      // Organizational folders without .claude-plugin
      await mkdir(join(testDir, 'available-plugins'), { recursive: true });
      await mkdir(join(testDir, 'available-scripts'), { recursive: true });

      // Real plugins nested inside
      await mkdir(join(testDir, 'available-plugins/plugin-one/.claude-plugin'), { recursive: true });
      await mkdir(join(testDir, 'available-plugins/plugin-two/.claude-plugin'), { recursive: true });
      await mkdir(join(testDir, 'available-scripts/script-one/.claude-plugin'), { recursive: true });

      const plugins = await getAvailablePlugins(testDir, null);

      expect(plugins).toContain('available-plugins/plugin-one');
      expect(plugins).toContain('available-plugins/plugin-two');
      expect(plugins).toContain('available-scripts/script-one');
      expect(plugins).not.toContain('available-plugins');
      expect(plugins).not.toContain('available-scripts');
      expect(plugins).toHaveLength(3);
    });

    test('returns correct paths for getPluginSourcePath integration', async () => {
      // Create a nested plugin structure
      await mkdir(join(testDir, 'available-plugins/nested-plugin/.claude-plugin'), { recursive: true });

      // Discover plugins
      const plugins = await getAvailablePlugins(testDir, null);

      // Verify the plugin is found with correct relative path
      expect(plugins).toContain('available-plugins/nested-plugin');
      expect(plugins.length).toBeGreaterThan(0);

      // Verify getPluginSourcePath constructs the correct full path
      const fullPath = getPluginSourcePath(testDir, plugins[0]!, null);
      expect(fullPath).toBe(join(testDir, 'available-plugins/nested-plugin'));
    });
  });

  describe('getPluginSourcePath', () => {
    test('uses manifest source when available', async () => {
      const manifest = {
        name: 'test',
        owner: { name: 'Test' },
        plugins: [{ name: 'my-plugin', source: './custom/path/to/plugin' }],
      };

      const path = getPluginSourcePath(testDir, 'my-plugin', manifest);

      expect(path).toBe(join(testDir, 'custom/path/to/plugin'));
    });

    test('falls back to plugin name when manifest has no match', async () => {
      const manifest = {
        name: 'test',
        owner: { name: 'Test' },
        plugins: [{ name: 'other-plugin', source: './other' }],
      };

      const path = getPluginSourcePath(testDir, 'my-plugin', manifest);

      expect(path).toBe(join(testDir, 'my-plugin'));
    });

    test('uses plugin name directly when no manifest', async () => {
      const path = getPluginSourcePath(testDir, 'my-plugin', null);

      expect(path).toBe(join(testDir, 'my-plugin'));
    });

    test('handles relative paths in manifest correctly', async () => {
      const manifest = {
        name: 'test',
        owner: { name: 'Test' },
        plugins: [{ name: 'plugin', source: '../elsewhere/plugin' }],
      };

      const path = getPluginSourcePath(testDir, 'plugin', manifest);

      expect(path).toBe(join(testDir, '../elsewhere/plugin'));
    });

    test('handles nested plugin paths correctly when no manifest', async () => {
      // When getAvailablePlugins returns a nested path like 'available-plugins/my-plugin'
      // getPluginSourcePath should construct the correct full path
      const pluginRelativePath = join('available-plugins', 'my-plugin');
      const path = getPluginSourcePath(testDir, pluginRelativePath, null);

      expect(path).toBe(join(testDir, 'available-plugins', 'my-plugin'));
    });
  });

  describe('isPluginInManifest', () => {
    test('returns true when manifest is null (no curation)', () => {
      const result = isPluginInManifest('any-plugin', null);
      expect(result).toBe(true);
    });

    test('returns true when plugin is in manifest', () => {
      const manifest = {
        name: 'test',
        owner: { name: 'Test' },
        plugins: [
          { name: 'plugin-a', source: './a' },
          { name: 'plugin-b', source: './b' },
        ],
      };

      expect(isPluginInManifest('plugin-a', manifest)).toBe(true);
      expect(isPluginInManifest('plugin-b', manifest)).toBe(true);
    });

    test('returns false when plugin is not in manifest', () => {
      const manifest = {
        name: 'test',
        owner: { name: 'Test' },
        plugins: [{ name: 'plugin-a', source: './a' }],
      };

      expect(isPluginInManifest('plugin-b', manifest)).toBe(false);
      expect(isPluginInManifest('nonexistent', manifest)).toBe(false);
    });

    test('returns false for empty manifest plugins array', () => {
      const manifest = {
        name: 'test',
        owner: { name: 'Test' },
        plugins: [],
      };

      expect(isPluginInManifest('any-plugin', manifest)).toBe(false);
    });
  });
});
