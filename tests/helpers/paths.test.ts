import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import * as os from 'node:os';
import { join } from 'node:path';
import { getGlobalCacheDir, getGlobalDir, resetEnvCache } from '../../src/helpers/paths';
import { mockEnv, mockPlatform } from './test-support';

// Global cleanup to prevent test pollution
afterEach(() => {
  mock.restore();
  resetEnvCache();
});

describe('getGlobalDir', () => {
  test('returns override value when provided', () => {
    const override = '/mnt/data/aipm';
    expect(getGlobalDir(override)).toBe(override);
  });

  test('uses XDG_CONFIG_HOME when set', () => {
    const platformMock = mockPlatform('linux');
    const xdgMock = mockEnv('XDG_CONFIG_HOME', '/custom/config');
    resetEnvCache();
    try {
      expect(getGlobalDir()).toBe(join('/custom/config', 'aipm'));
    } finally {
      platformMock.mockRestore();
      xdgMock.mockRestore();
      resetEnvCache();
    }
  });

  test('override takes precedence over XDG_CONFIG_HOME', () => {
    const platformMock = mockPlatform('linux');
    const xdgMock = mockEnv('XDG_CONFIG_HOME', '/xdg/config');
    resetEnvCache();
    try {
      const override = '/override/marketplace';
      expect(getGlobalDir(override)).toBe(override);
    } finally {
      platformMock.mockRestore();
      xdgMock.mockRestore();
      resetEnvCache();
    }
  });

  test('defaults to ~/.config/aipm when XDG_CONFIG_HOME not set', () => {
    const platformMock = mockPlatform('linux');
    const xdgMock = mockEnv('XDG_CONFIG_HOME', undefined);
    const homedirSpy = spyOn(os, 'homedir').mockReturnValue('/home/testuser');
    resetEnvCache();
    try {
      const globalDir = getGlobalDir();
      // Should default to ~/.config/aipm on Unix/Mac
      expect(globalDir).toBe(join('/home/testuser', '.config', 'aipm'));
    } finally {
      platformMock.mockRestore();
      xdgMock.mockRestore();
      homedirSpy.mockRestore();
      resetEnvCache();
    }
  });

  test('calls os.homedir() for default path', () => {
    const platformMock = mockPlatform('linux');
    const homedirSpy = spyOn(os, 'homedir').mockReturnValue('/mock/home');
    const xdgMock = mockEnv('XDG_CONFIG_HOME', undefined);
    resetEnvCache();
    try {
      const globalDir = getGlobalDir();
      expect(globalDir).toBe(join('/mock/home', '.config', 'aipm'));
      expect(homedirSpy).toHaveBeenCalled();
    } finally {
      platformMock.mockRestore();
      homedirSpy.mockRestore();
      xdgMock.mockRestore();
      resetEnvCache();
    }
  });

  test('does not call os.homedir() when override is provided', () => {
    const homedirSpy = spyOn(os, 'homedir').mockReturnValue('/should-not-be-called');
    try {
      const override = '/tmp/override-marketplace';
      expect(getGlobalDir(override)).toBe(override);
      expect(homedirSpy).not.toHaveBeenCalled();
    } finally {
      homedirSpy.mockRestore();
    }
  });

  test('on Windows uses APPDATA when set', () => {
    const platformMock = mockPlatform('win32');
    const appdataMock = mockEnv('APPDATA', 'C:\\Users\\TestUser\\AppData\\Roaming');
    resetEnvCache();
    try {
      const globalDir = getGlobalDir();
      // Path separators depend on current OS, not mocked platform
      expect(globalDir).toContain('AppData');
      expect(globalDir).toContain('Roaming');
      expect(globalDir).toMatch(/aipm$/);
    } finally {
      platformMock.mockRestore();
      appdataMock.mockRestore();
      resetEnvCache();
    }
  });

  test('on Windows without APPDATA falls back to homeDir/aipm', () => {
    const platformMock = mockPlatform('win32');
    const appdataMock = mockEnv('APPDATA', undefined);
    const homedirSpy = spyOn(os, 'homedir').mockReturnValue('C:\\Users\\TestUser');
    resetEnvCache();
    try {
      const globalDir = getGlobalDir();
      // Path separators depend on current OS, not mocked platform
      expect(globalDir).toContain('TestUser');
      expect(globalDir).toMatch(/aipm$/);
      expect(globalDir).not.toContain('.config');
    } finally {
      platformMock.mockRestore();
      appdataMock.mockRestore();
      homedirSpy.mockRestore();
      resetEnvCache();
    }
  });
});

describe('getGlobalCacheDir', () => {
  test('returns override value with cache subdir when provided', () => {
    const override = '/mnt/data/aipm';
    const cacheDir = getGlobalCacheDir(override);
    expect(cacheDir).toBe(join('/mnt/data/aipm', 'cache'));
  });

  test('uses XDG_CACHE_HOME when set', () => {
    const platformMock = mockPlatform('linux');
    const xdgMock = mockEnv('XDG_CACHE_HOME', '/custom/cache');
    resetEnvCache();
    try {
      const cacheDir = getGlobalCacheDir();
      expect(cacheDir).toBe(join('/custom/cache', 'aipm'));
    } finally {
      platformMock.mockRestore();
      xdgMock.mockRestore();
      resetEnvCache();
    }
  });

  test('override takes precedence over XDG_CACHE_HOME', () => {
    const platformMock = mockPlatform('linux');
    const xdgMock = mockEnv('XDG_CACHE_HOME', '/xdg/cache');
    resetEnvCache();
    try {
      const override = '/override/aipm';
      const cacheDir = getGlobalCacheDir(override);
      expect(cacheDir).toBe(join('/override/aipm', 'cache'));
    } finally {
      platformMock.mockRestore();
      xdgMock.mockRestore();
      resetEnvCache();
    }
  });

  test('defaults to ~/.cache/aipm when XDG_CACHE_HOME not set', () => {
    const platformMock = mockPlatform('linux');
    const xdgMock = mockEnv('XDG_CACHE_HOME', undefined);
    const homedirSpy = spyOn(os, 'homedir').mockReturnValue('/home/testuser');
    resetEnvCache();
    try {
      const cacheDir = getGlobalCacheDir();
      expect(cacheDir).toBe(join('/home/testuser', '.cache', 'aipm'));
    } finally {
      platformMock.mockRestore();
      xdgMock.mockRestore();
      homedirSpy.mockRestore();
      resetEnvCache();
    }
  });

  test('on Windows uses LOCALAPPDATA when set', () => {
    const platformMock = mockPlatform('win32');
    const localappdataMock = mockEnv('LOCALAPPDATA', 'C:\\Users\\TestUser\\AppData\\Local');
    resetEnvCache();
    try {
      const cacheDir = getGlobalCacheDir();
      // Path separators depend on current OS, not mocked platform
      expect(cacheDir).toContain('AppData');
      expect(cacheDir).toContain('Local');
      expect(cacheDir).toContain('aipm');
      expect(cacheDir).toMatch(/cache$/);
    } finally {
      platformMock.mockRestore();
      localappdataMock.mockRestore();
      resetEnvCache();
    }
  });

  test('on Windows without LOCALAPPDATA falls back to homeDir/aipm/cache', () => {
    const platformMock = mockPlatform('win32');
    const localappdataMock = mockEnv('LOCALAPPDATA', undefined);
    const homedirSpy = spyOn(os, 'homedir').mockReturnValue('C:\\Users\\TestUser');
    resetEnvCache();
    try {
      const cacheDir = getGlobalCacheDir();
      // Path separators depend on current OS, not mocked platform
      expect(cacheDir).toContain('TestUser');
      expect(cacheDir).toContain('aipm');
      expect(cacheDir).toMatch(/cache$/);
      expect(cacheDir).not.toContain('.cache');
    } finally {
      platformMock.mockRestore();
      localappdataMock.mockRestore();
      homedirSpy.mockRestore();
      resetEnvCache();
    }
  });
});
