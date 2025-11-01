import { join } from 'node:path';
import { getConfigPaths } from '../config/loader';
import { addToGitignore, backupFile, ensureDir, fileExists, writeJsonFile } from '../helpers/fs';
import { defaultIO, type IO } from '../helpers/io';
import { getGlobalDir } from '../helpers/paths';
import type { InitOptions } from '../schema';

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
  if (options.dryRun) {
    io.logInfo('[DRY RUN] Would ensure .cursor directory exists');
  } else {
    await ensureDir(paths.cursor);
  }

  const pluginsExists = await fileExists(paths.plugins);

  if (pluginsExists && !options.force) {
    io.logInfo('Config already exists at .cursor/plugins.json');
    io.logInfo('Use --force to overwrite');
    return;
  }

  if (pluginsExists && options.force) {
    if (!options.skipConfirm && !options.dryRun) {
      const shouldContinue = await io.confirm('⚠️  This will overwrite existing .cursor/plugins.json. Continue?');
      if (!shouldContinue) {
        io.logInfo('Cancelled');
        return;
      }
    }
    if (options.dryRun) {
      io.logInfo('[DRY RUN] Would backup existing config to .cursor/plugins.json.backup');
    } else {
      await backupFile(paths.plugins);
      io.logSuccess('Backed up existing config to .cursor/plugins.json.backup');
    }
  }

  const defaultConfig = {
    marketplaces: {},
    plugins: {},
  };

  const exampleConfig = {
    marketplaces: {
      local: {
        source: 'directory',
        path: './my-plugins',
      },
    },
    plugins: {
      'example-plugin@local': {
        enabled: true,
      },
    },
  };

  const config = options.example ? exampleConfig : defaultConfig;

  if (options.dryRun) {
    io.logInfo('[DRY RUN] Would create .cursor/plugins.json');
  } else {
    await writeJsonFile(paths.plugins, config);
    io.logSuccess('Created .cursor/plugins.json');
  }

  if (options.dryRun) {
    io.logInfo('[DRY RUN] Would create .cursor/plugins.local.json.example');
  } else {
    await writeJsonFile(paths.pluginsExample, defaultConfig);
    io.logSuccess('Created .cursor/plugins.local.json.example');
  }

  if (await fileExists(paths.gitignore)) {
    if (options.dryRun) {
      io.logInfo('[DRY RUN] Would add .cursor/plugins.local.json to .gitignore');
    } else {
      await addToGitignore(paths.gitignore, '.cursor/plugins.local.json');
      io.logSuccess('Added .cursor/plugins.local.json to .gitignore');
    }
  } else {
    io.logInfo('No .gitignore found. Remember to ignore .cursor/plugins.local.json');
  }

  if (options.dryRun) {
    io.log('\n✨ [DRY RUN] Would initialize cursor marketplace successfully!');
  } else {
    io.log('\n✨ Cursor marketplace initialized successfully!');
  }
  io.log('\nNext steps:');
  io.log('  1. Edit .cursor/plugins.json to add marketplaces');
  io.log("  2. Run 'aipm sync' to install plugins");
}

async function initGlobal(options: InitOptions, io: IO): Promise<void> {
  const globalDir = getGlobalDir(options.globalDir);
  const configPath = join(globalDir, 'config.json');

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
    io.log('\n✨ [DRY RUN] Would initialize global cursor marketplace successfully!');
  } else {
    io.log('\n✨ Global cursor marketplace initialized successfully!');
  }
}
