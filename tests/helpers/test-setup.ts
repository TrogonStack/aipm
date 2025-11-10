import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { init } from '../../src/commands/init';
import { resetEnvCache } from '../../src/helpers/paths';

export type TestSetup = {
  testHome: string;
  testDir?: string;
  cleanup: () => Promise<void>;
};

/**
 * Sets up an isolated test environment with a temporary HOME directory.
 * Never touches the real HOME or USERPROFILE.
 *
 * @param options.initProject - If true, creates a test project directory and initializes it
 * @returns Test setup with testHome, optional testDir, and cleanup function
 */
export async function setupTestEnvironment(options: { initProject?: boolean } = {}): Promise<TestSetup> {
  // Always use a temp directory for HOME in tests - never touch the real HOME
  const testHome = await mkdtemp(join(tmpdir(), 'test-home-'));
  process.env.HOME = testHome;
  resetEnvCache();

  let testDir: string | undefined;

  if (options.initProject) {
    testDir = await mkdtemp(join(tmpdir(), 'test-project-'));
    await init({ cwd: testDir });
  }

  const cleanup = async () => {
    // Tests are isolated - don't restore HOME to avoid affecting real environment
    resetEnvCache();

    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
    await rm(testHome, { recursive: true, force: true });
  };

  return {
    testHome,
    testDir,
    cleanup,
  };
}
