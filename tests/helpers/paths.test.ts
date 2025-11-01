import { describe, expect, test } from 'bun:test';
import { getGlobalDir } from '../../src/helpers/paths';

describe('getGlobalDir', () => {
  test('returns override value when provided', () => {
    const override = '/mnt/data/aipm';
    expect(getGlobalDir(override)).toBe(override);
  });

  test('returns env AIPM_GLOBAL_DIR when set', () => {
    const originalEnv = process.env.AIPM_GLOBAL_DIR;

    try {
      process.env.AIPM_GLOBAL_DIR = '/custom/marketplace';
      expect(getGlobalDir()).toBe('/custom/marketplace');
    } finally {
      if (originalEnv) {
        process.env.AIPM_GLOBAL_DIR = originalEnv;
      } else {
        delete process.env.AIPM_GLOBAL_DIR;
      }
    }
  });

  test('override takes precedence over env variable', () => {
    const originalEnv = process.env.AIPM_GLOBAL_DIR;

    try {
      process.env.AIPM_GLOBAL_DIR = '/env/marketplace';
      const override = '/override/marketplace';

      expect(getGlobalDir(override)).toBe(override);
    } finally {
      if (originalEnv) {
        process.env.AIPM_GLOBAL_DIR = originalEnv;
      } else {
        delete process.env.AIPM_GLOBAL_DIR;
      }
    }
  });

  test('returns default ~/.cursor/marketplace when no override or env', () => {
    const originalEnv = process.env.AIPM_GLOBAL_DIR;

    try {
      delete process.env.AIPM_GLOBAL_DIR;

      const globalDir = getGlobalDir();
      expect(globalDir).toContain('.cursor');
      expect(globalDir).toContain('marketplace');
      expect(globalDir).toMatch(/\.cursor\/marketplace$/);
    } finally {
      if (originalEnv) {
        process.env.AIPM_GLOBAL_DIR = originalEnv;
      }
    }
  });

  test('throws error when HOME not set and no override or env', () => {
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;
    const originalEnv = process.env.AIPM_GLOBAL_DIR;

    try {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      delete process.env.AIPM_GLOBAL_DIR;

      expect(() => getGlobalDir()).toThrow('Could not determine home directory');
    } finally {
      if (originalHome) process.env.HOME = originalHome;
      if (originalUserProfile) process.env.USERPROFILE = originalUserProfile;
      if (originalEnv) process.env.AIPM_GLOBAL_DIR = originalEnv;
    }
  });

  test('does not throw when override is provided even if HOME not set', () => {
    const originalHome = process.env.HOME;
    const originalUserProfile = process.env.USERPROFILE;
    const originalEnv = process.env.AIPM_GLOBAL_DIR;

    try {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
      delete process.env.AIPM_GLOBAL_DIR;

      const override = '/tmp/override-marketplace';
      expect(getGlobalDir(override)).toBe(override);
    } finally {
      if (originalHome) process.env.HOME = originalHome;
      if (originalUserProfile) process.env.USERPROFILE = originalUserProfile;
      if (originalEnv) process.env.AIPM_GLOBAL_DIR = originalEnv;
    }
  });

  test('env variable allows custom drive location', () => {
    const originalEnv = process.env.AIPM_GLOBAL_DIR;

    try {
      process.env.AIPM_GLOBAL_DIR = 'D:\\cursor-data\\marketplace';
      expect(getGlobalDir()).toBe('D:\\cursor-data\\marketplace');
    } finally {
      if (originalEnv) {
        process.env.AIPM_GLOBAL_DIR = originalEnv;
      } else {
        delete process.env.AIPM_GLOBAL_DIR;
      }
    }
  });
});
