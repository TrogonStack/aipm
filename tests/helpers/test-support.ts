import { spyOn } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { resetEnvCache } from '../../src/helpers/paths';

type MockRestore = { mockRestore: () => void };

/**
 * Mock environment variable for testing
 *
 * Directly modifies process.env and returns a mock-compatible object
 * for cleanup. Bun's spyOn doesn't support accessor properties on process.env.
 */
export function mockEnv(key: string, value: string | undefined): MockRestore {
  const originalValue = process.env[key];

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }

  return {
    mockRestore: () => {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    },
  };
}

/**
 * Mock process.platform for testing
 *
 * Uses spyOn to temporarily override process.platform and returns
 * a spy that can be used to restore the original value.
 */
export function mockPlatform(value: NodeJS.Platform) {
  // @ts-expect-error - process.platform is typed as a readonly string, but spyOn can handle it
  return spyOn(process, 'platform').mockReturnValue(value);
}

export type TestSetup = {
  testHome: string;
  testDir?: string;
  cleanup: () => Promise<void>;
  homedirSpy: ReturnType<typeof spyOn>;
};

/**
 * Sets up an isolated test environment with a temporary HOME directory.
 * Uses spyOn to mock os.homedir() for test isolation.
 *
 * @param options.initProject - If true, creates a test project directory and initializes it
 * @returns Test setup with testHome, optional testDir, homedirSpy, and cleanup function
 */
export async function setupTestEnvironment(options: { initProject?: boolean } = {}): Promise<TestSetup> {
  // Create temp directory for test home
  const testHome = await mkdtemp(join(tmpdir(), 'test-home-'));

  // Spy on os.homedir() to return test home
  const homedirSpy = spyOn(os, 'homedir').mockReturnValue(testHome);

  // Clear XDG variables to ensure tests use mocked homedir for path resolution
  const xdgConfigMock = mockEnv('XDG_CONFIG_HOME', undefined);
  const xdgCacheMock = mockEnv('XDG_CACHE_HOME', undefined);

  resetEnvCache();

  let testDir: string | undefined;

  if (options.initProject) {
    testDir = await mkdtemp(join(tmpdir(), 'test-project-'));
    await init({ cwd: testDir });
  }

  const cleanup = async () => {
    homedirSpy.mockRestore();
    xdgConfigMock.mockRestore();
    xdgCacheMock.mockRestore();
    resetEnvCache();

    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
    await rm(testHome, { recursive: true, force: true });
  };

  return {
    testHome,
    testDir,
    homedirSpy,
    cleanup,
  };
}
