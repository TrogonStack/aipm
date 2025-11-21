import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { getConfigPath, getConfigPaths } from '../config/loader';
import { DIR_AIPM, FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL, FILE_GITIGNORE } from '../constants';
import { saveAIPMConfig } from '../helpers/aipm-config';
import { backupFile, ensureDir, fileExists, writeJsonFile } from '../helpers/fs';
import { findGitRoot } from '../helpers/git';
import { defaultIO, type IO } from '../helpers/io';
import { getGlobalDir } from '../helpers/paths';
import type { InitOptions, PluginsConfig } from '../schema';

export async function init(options: InitOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();
  const paths = getConfigPaths(cwd);
  const io = options.io || defaultIO;

  try {
    if (options.global) {
      await initGlobal(options, io);
      return;
    }

    await initProject(paths, options, io);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    io.logError(`Failed to initialize: ${message}`);
    throw error;
  }
}

async function initProject(paths: ReturnType<typeof getConfigPaths>, options: InitOptions, io: IO): Promise<void> {
  const cwd = options.cwd || process.cwd();
  const aipmConfigExists = await fileExists(paths.aipmConfig);

  if (aipmConfigExists && !options.force) {
    io.logInfo('Already initialized. Use --force to overwrite.');
    return;
  }

  if (aipmConfigExists && options.force) {
    if (!options.skipConfirm && !options.dryRun) {
      const shouldContinue = await io.confirm(`⚠️  This will overwrite existing ${paths.aipmConfig}. Continue?`);
      if (!shouldContinue) {
        io.logInfo('Cancelled');
        return;
      }
    }
    if (!options.dryRun) {
      await backupFile(paths.aipmConfig);
      io.logSuccess(`Backed up existing config to ${paths.aipmConfig}.backup`);
    }
  }

  const exampleMarketplaces = {
    local: {
      source: 'directory' as const,
      path: './my-plugins',
    },
  };

  const examplePlugins = {
    'example-plugin@local': {
      enabled: true,
    },
  };

  if (!options.dryRun) {
    // Create .aipm/config.json
    const initialConfig: PluginsConfig = options.example
      ? { marketplaces: exampleMarketplaces, plugins: examplePlugins }
      : { marketplaces: {}, plugins: {} };

    await saveAIPMConfig(cwd, initialConfig);
    io.logSuccess(`Created ${getConfigPath(FILE_AIPM_CONFIG)}`);

    // Create example local config
    const examplePath = join(paths.aipm, 'config.local.json.example');
    await Bun.write(examplePath, JSON.stringify({ marketplaces: {}, plugins: {} }, null, 2));
    io.logSuccess(`Created ${getConfigPath(`${FILE_AIPM_CONFIG_LOCAL}.example`)}`);

    // Update .gitignore at git root (if in a git repo)
    const gitRoot = await findGitRoot(cwd);
    const gitignorePath = gitRoot ? join(gitRoot, FILE_GITIGNORE) : paths.gitignore;
    await updateGitignore(gitignorePath, cwd, gitRoot, io);

    io.logSuccess('✨ Initialized!');
    io.logInfo('');
    io.logInfo('Configuration files:');
    io.logInfo(`  ${getConfigPath(FILE_AIPM_CONFIG)}             (commit to git)`);
    io.logInfo(`  ${getConfigPath(FILE_AIPM_CONFIG_LOCAL)}       (local overrides, git-ignored)`);
    io.logInfo('');
    io.logInfo('Next steps:');
    io.logInfo('  aipm marketplace add <name> <url>');
    io.logInfo('  aipm plugin install <plugin>@<marketplace>');
  } else {
    io.logInfo('[DRY RUN] Would create:');
    io.logInfo(`  ${getConfigPath(FILE_AIPM_CONFIG)}`);
    io.logInfo(`  ${getConfigPath(`${FILE_AIPM_CONFIG_LOCAL}.example`)}`);
  }
}

function calculateLocalConfigPath(cwd: string, gitRoot: string | null): string {
  if (!gitRoot) {
    return getConfigPath(FILE_AIPM_CONFIG_LOCAL);
  }

  try {
    // Try to resolve real paths to handle symlinks (e.g., /tmp vs /private/tmp on macOS)
    const realGitRoot = realpathSync(gitRoot);
    const realCwd = realpathSync(cwd);
    return join(relative(realGitRoot, realCwd), DIR_AIPM, FILE_AIPM_CONFIG_LOCAL);
  } catch (error) {
    // Fall back to using paths as-is if realpathSync fails
    // (e.g., permission issues, broken symlinks, or unsupported filesystems)
    return join(relative(gitRoot, cwd), DIR_AIPM, FILE_AIPM_CONFIG_LOCAL);
  }
}

async function updateGitignore(gitignorePath: string, cwd: string, gitRoot: string | null, io: IO): Promise<void> {
  const localConfigPath = calculateLocalConfigPath(cwd, gitRoot);
  const entriesToAdd = ['# AIPM local configuration', localConfigPath];

  if (await fileExists(gitignorePath)) {
    const content = await Bun.file(gitignorePath).text();
    if (!content.includes(localConfigPath)) {
      await Bun.write(gitignorePath, content + '\n' + entriesToAdd.join('\n') + '\n');
      io.logSuccess('Updated .gitignore');
    }
  } else {
    io.logInfo(`No .gitignore found. Remember to add ${localConfigPath} to it`);
  }
}

async function initGlobal(options: InitOptions, io: IO): Promise<void> {
  const globalDir = getGlobalDir(options.globalDir);
  const configPath = join(globalDir, FILE_AIPM_CONFIG);

  const configExists = await fileExists(configPath);

  if (configExists && !options.force) {
    io.logInfo(`Config already exists at ${configPath}`);
    io.logInfo('Use --force to overwrite');
    return;
  }

  if (configExists && options.force) {
    if (!options.skipConfirm && !options.dryRun) {
      const shouldContinue = await io.confirm(`⚠️  This will overwrite existing ${configPath}. Continue?`);
      if (!shouldContinue) {
        io.logInfo('Cancelled');
        return;
      }
    }
    if (options.dryRun) {
      io.logInfo(`[DRY RUN] Would backup existing config to ${configPath}.backup`);
    } else {
      await backupFile(configPath);
      io.logSuccess(`Backed up existing config to ${configPath}.backup`);
    }
  }

  if (options.dryRun) {
    io.logInfo(`[DRY RUN] Would ensure global directory exists at ${globalDir}`);
  } else {
    await ensureDir(globalDir);
  }

  const globalConfig = {
    marketplaces: {},
    plugins: {},
  };

  const { GlobalMarketplaceConfigSchema } = await import('../schema');

  if (options.dryRun) {
    io.logInfo(`[DRY RUN] Would create global config at ${configPath}`);
  } else {
    await writeJsonFile(configPath, globalConfig, GlobalMarketplaceConfigSchema);
    io.logSuccess(`Created global config at ${configPath}`);
  }

  if (options.dryRun) {
    io.log('\n✨ [DRY RUN] Would initialize global AIPM successfully!');
  } else {
    io.log('\n✨ Global AIPM initialized successfully!');
  }
}
