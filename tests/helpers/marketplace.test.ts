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
      const result = await loadMarketplaceManifest(testDir);
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

      const result = await loadMarketplaceManifest(testDir);
      expect(result).toEqual(manifest);
    });

    test('returns null for invalid marketplace.json', async () => {
      await writeFile(join(testDir, 'marketplace.json'), JSON.stringify({ invalid: 'data' }));

      const result = await loadMarketplaceManifest(testDir);
      expect(result).toBeNull();
    });

    test('returns null for malformed JSON', async () => {
      await writeFile(join(testDir, 'marketplace.json'), '{invalid json}');

      const result = await loadMarketplaceManifest(testDir);
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
      await mkdir(join(testDir, 'plugin-a'));
      await mkdir(join(testDir, 'plugin-b'));
      await mkdir(join(testDir, '.hidden'));

      const plugins = await getAvailablePlugins(testDir, null);

      expect(plugins).toContain('plugin-a');
      expect(plugins).toContain('plugin-b');
      expect(plugins).not.toContain('.hidden');
    });

    test('excludes dot directories when scanning', async () => {
      await mkdir(join(testDir, 'visible-plugin'));
      await mkdir(join(testDir, '.git'));
      await mkdir(join(testDir, '.claude-plugin'));

      const plugins = await getAvailablePlugins(testDir, null);

      expect(plugins).toEqual(['visible-plugin']);
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
