import { parseArgs } from 'node:util';
import { ZodError } from 'zod';
import packageJson from '../package.json';
import {
  DirectoryNotFoundError,
  PluginManifestInvalidError,
  PluginManifestNotFoundError,
  PluginNotFoundError,
} from './errors';
import { formatZodError } from './helpers/validation';

const VERSION = packageJson.version;

function printHelp() {
  console.log(`
aipm v${VERSION} - AI Plugin Manager for Claude Code, Cursor, and more

USAGE:
  aipm <command> [options]

COMMANDS:
  init [options]                          Initialize configuration
  sync [options]                          Install enabled plugins from marketplaces
  marketplace add <name> <path> [options] Add a marketplace
  marketplace remove <name> [options]     Remove a marketplace
  marketplace update <name> [options]     Update a marketplace from source
  plugin search [query] [options]         Search/browse available plugins
  plugin install <pluginId> [options]     Install a plugin (enable + sync)
  plugin update <pluginId> [options]      Update an installed plugin
  plugin enable <pluginId> [options]      Enable a plugin
  plugin disable <pluginId> [options]     Disable a plugin
  plugin uninstall <pluginId> [options]   Uninstall a plugin
  info <pluginId>                         Show detailed plugin information
  list                                    List marketplaces and plugins

OPTIONS:
  -h, --help        Show this help message
  -v, --version     Show version
  -d, --dry-run     Show what would be done without doing it
  -l, --local       Use plugins.local.json instead of plugins.json
  -g, --global      Use global config
  -f, --force       Overwrite existing files
  --example         Use example template (init only)
  --remove-files    Delete plugin files from filesystem (uninstall only)

EXAMPLES:
  aipm init
  aipm init --example --dry-run
  aipm marketplace add local-plugins ./my-plugins
  aipm plugin enable my-plugin@local-plugins
  aipm info my-plugin@local-plugins
  aipm sync
  aipm sync --dry-run
  aipm list
`);
}

function printVersion() {
  console.log(VERSION);
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      global: {
        type: 'boolean',
        short: 'g',
      },
      force: {
        type: 'boolean',
        short: 'f',
      },
      example: {
        type: 'boolean',
      },
      local: {
        type: 'boolean',
        short: 'l',
      },
      'dry-run': {
        type: 'boolean',
        short: 'd',
      },
      'remove-files': {
        type: 'boolean',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
      version: {
        type: 'boolean',
        short: 'v',
      },
    },
    allowPositionals: true,
  });

  const command = positionals[0];
  const subcommand = positionals[1];

  if (values.version) {
    printVersion();
    process.exit(0);
  }

  if (values.help || !command) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case 'init': {
        const { init } = await import('./commands/init');
        await init({
          global: values.global,
          force: values.force,
          example: values.example,
          dryRun: values['dry-run'],
        });
        break;
      }

      case 'marketplace':
        switch (subcommand) {
          case 'add': {
            const { marketplaceAdd } = await import('./commands/marketplace-add');
            await marketplaceAdd({
              name: positionals[2],
              path: positionals[3],
              local: values.local,
              dryRun: values['dry-run'],
            });
            break;
          }

          case 'remove': {
            const { marketplaceRemove } = await import('./commands/marketplace-remove');
            await marketplaceRemove({
              name: positionals[2],
              local: values.local,
              dryRun: values['dry-run'],
            });
            break;
          }

          case 'update': {
            const { marketplaceUpdate } = await import('./commands/marketplace-update');
            await marketplaceUpdate({
              name: positionals[2],
              dryRun: values['dry-run'],
            });
            break;
          }

          default:
            console.error(`Error: Unknown marketplace subcommand: ${subcommand || '(none)'}`);
            console.error('Available: add, remove, update');
            process.exit(1);
        }
        break;

      case 'plugin':
        switch (subcommand) {
          case 'enable': {
            const { pluginEnable } = await import('./commands/plugin-enable');
            await pluginEnable({
              pluginId: positionals[2],
              local: values.local,
              dryRun: values['dry-run'],
            });
            break;
          }

          case 'disable': {
            const { pluginDisable } = await import('./commands/plugin-disable');
            await pluginDisable({
              pluginId: positionals[2],
              local: values.local,
              dryRun: values['dry-run'],
            });
            break;
          }

          case 'install': {
            const { pluginInstall } = await import('./commands/plugin-install');
            await pluginInstall({
              pluginId: positionals[2],
              local: values.local,
              dryRun: values['dry-run'],
              force: values.force,
            });
            break;
          }

          case 'uninstall': {
            const { pluginUninstall } = await import('./commands/plugin-uninstall');
            await pluginUninstall({
              pluginId: positionals[2],
              local: values.local,
              dryRun: values['dry-run'],
              removeFiles: values['remove-files'],
            });
            break;
          }

          case 'search': {
            const { pluginSearch } = await import('./commands/plugin-search');
            await pluginSearch({
              query: positionals[2],
            });
            break;
          }

          case 'update': {
            const { pluginUpdate } = await import('./commands/plugin-update');
            await pluginUpdate({
              pluginId: positionals[2],
              dryRun: values['dry-run'],
            });
            break;
          }

          default:
            console.error(`Error: Unknown plugin subcommand: ${subcommand || '(none)'}`);
            console.error('Available: search, install, update, enable, disable, uninstall');
            process.exit(1);
        }
        break;

      case 'sync': {
        const { sync } = await import('./commands/sync');
        await sync({
          dryRun: values['dry-run'],
        });
        break;
      }

      case 'list': {
        const { list } = await import('./commands/list');
        await list();
        break;
      }

      case 'info': {
        const { info } = await import('./commands/info');
        await info({ pluginId: positionals[1] });
        break;
      }

      default:
        console.error(`Error: Unknown command: ${command}`);
        console.error("Run 'aipm --help' for usage");
        process.exit(1);
    }
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      console.error('Validation error:');
      console.error(formatZodError(error));
    } else if (
      error instanceof PluginNotFoundError ||
      error instanceof PluginManifestNotFoundError ||
      error instanceof PluginManifestInvalidError ||
      error instanceof DirectoryNotFoundError
    ) {
      console.error(`Error: ${error.message}`);
      if (error.cause) {
        console.error(`Cause: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`);
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
    }
    process.exit(1);
  }
}

main();
