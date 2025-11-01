import { describe, expect, mock, test } from 'bun:test';
import {
  expandGitHubShorthand,
  getGitProtocolPreference,
  isGitHubShorthand,
  parseGitHubShorthand,
} from '../../src/helpers/github';

describe('GitHub utilities', () => {
  describe('parseGitHubShorthand', () => {
    test('parses valid GitHub shorthand', () => {
      expect(parseGitHubShorthand('owner/repo')).toEqual({
        owner: 'owner',
        repo: 'repo',
      });

      expect(parseGitHubShorthand('my-org/my-plugin')).toEqual({
        owner: 'my-org',
        repo: 'my-plugin',
      });

      expect(parseGitHubShorthand('user123/project-456')).toEqual({
        owner: 'user123',
        repo: 'project-456',
      });
    });

    test('accepts dots and underscores', () => {
      expect(parseGitHubShorthand('my.org/my.repo')).toEqual({
        owner: 'my.org',
        repo: 'my.repo',
      });

      expect(parseGitHubShorthand('my_org/my_repo')).toEqual({
        owner: 'my_org',
        repo: 'my_repo',
      });
    });

    test('returns null for invalid formats', () => {
      expect(parseGitHubShorthand('just-a-string')).toBeNull();
      expect(parseGitHubShorthand('too/many/slashes')).toBeNull();
      expect(parseGitHubShorthand('https://github.com/owner/repo')).toBeNull();
      expect(parseGitHubShorthand('git@github.com:owner/repo.git')).toBeNull();
      expect(parseGitHubShorthand('./local/path')).toBeNull();
      expect(parseGitHubShorthand('/absolute/path')).toBeNull();
    });

    test('returns null for empty or whitespace', () => {
      expect(parseGitHubShorthand('')).toBeNull();
      expect(parseGitHubShorthand(' ')).toBeNull();
      expect(parseGitHubShorthand('owner/')).toBeNull();
      expect(parseGitHubShorthand('/repo')).toBeNull();
    });
  });

  describe('isGitHubShorthand', () => {
    test('returns true for valid shorthand', () => {
      expect(isGitHubShorthand('owner/repo')).toBe(true);
      expect(isGitHubShorthand('my-org/my-plugin')).toBe(true);
      expect(isGitHubShorthand('user123/project-456')).toBe(true);
    });

    test('returns false for URLs', () => {
      expect(isGitHubShorthand('https://github.com/owner/repo')).toBe(false);
      expect(isGitHubShorthand('http://example.com/file.json')).toBe(false);
      expect(isGitHubShorthand('git@github.com:owner/repo.git')).toBe(false);
    });

    test('returns false for local paths', () => {
      expect(isGitHubShorthand('./local/path')).toBe(false);
      expect(isGitHubShorthand('../relative/path')).toBe(false);
      expect(isGitHubShorthand('/absolute/path')).toBe(false);
    });

    test('returns false for invalid formats', () => {
      expect(isGitHubShorthand('just-a-string')).toBe(false);
      expect(isGitHubShorthand('too/many/slashes')).toBe(false);
      expect(isGitHubShorthand('')).toBe(false);
    });
  });

  describe('getGitProtocolPreference', () => {
    test('defaults to https when no git config', async () => {
      const originalSpawn = Bun.spawnSync;
      Bun.spawnSync = mock(() => ({
        success: false,
        stdout: null,
      })) as any;

      try {
        const result = await getGitProtocolPreference();
        expect(result).toBe('https');
      } finally {
        Bun.spawnSync = originalSpawn;
      }
    });

    test('returns https when no preference configured', async () => {
      const originalSpawn = Bun.spawnSync;
      Bun.spawnSync = mock(() => ({
        success: true,
        stdout: Buffer.from(''),
      })) as any;

      try {
        const result = await getGitProtocolPreference();
        expect(result).toBe('https');
      } finally {
        Bun.spawnSync = originalSpawn;
      }
    });

    test('handles errors gracefully', async () => {
      const originalSpawn = Bun.spawnSync;
      Bun.spawnSync = mock(() => {
        throw new Error('Git not found');
      }) as any;

      try {
        const result = await getGitProtocolPreference();
        expect(result).toBe('https');
      } finally {
        Bun.spawnSync = originalSpawn;
      }
    });
  });

  describe('expandGitHubShorthand', () => {
    test('expands to HTTPS when protocol is https', async () => {
      const shorthand = { owner: 'myorg', repo: 'myrepo' };
      const result = await expandGitHubShorthand(shorthand, 'https');

      expect(result).toBe('https://github.com/myorg/myrepo.git');
    });

    test('expands to SSH when protocol is ssh', async () => {
      const shorthand = { owner: 'myorg', repo: 'myrepo' };
      const result = await expandGitHubShorthand(shorthand, 'ssh');

      expect(result).toBe('git@github.com:myorg/myrepo.git');
    });

    test('uses detected preference when not specified', async () => {
      const shorthand = { owner: 'myorg', repo: 'myrepo' };

      const originalSpawn = Bun.spawnSync;
      Bun.spawnSync = mock(() => ({
        success: false,
        stdout: null,
      })) as any;

      try {
        const result = await expandGitHubShorthand(shorthand);
        expect(result).toBe('https://github.com/myorg/myrepo.git');
      } finally {
        Bun.spawnSync = originalSpawn;
      }
    });

    test('handles org and repo names with special characters', async () => {
      const shorthand = { owner: 'my-org.name', repo: 'my-repo_name' };
      const result = await expandGitHubShorthand(shorthand, 'https');

      expect(result).toBe('https://github.com/my-org.name/my-repo_name.git');
    });
  });
});
