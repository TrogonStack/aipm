import { z } from 'zod';
import { getConfigPaths, loadPluginsConfig } from '../config/loader';
import { fileExists, writeJsonFile } from '../helpers/fs';
import { expandGitHubShorthand, isGitHubShorthand, parseGitHubShorthand } from '../helpers/github';
import { defaultIO } from '../helpers/io';
import { PluginsConfigSchema } from '../schema';

const MarketplaceAddOptionsSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  cwd: z.string().optional(),
  local: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export async function marketplaceAdd(options: unknown): Promise<void> {
  const cmd = MarketplaceAddOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();
  const paths = getConfigPaths(cwd);

  try {
    const targetPath = cmd.local ? paths.pluginsLocal : paths.plugins;
    const configName = cmd.local ? '.cursor/plugins.local.json' : '.cursor/plugins.json';

    if (!(await fileExists(paths.plugins))) {
      defaultIO.logError("No plugins.json found. Run 'aipm init' first.");
      return;
    }

    const config = await loadPluginsConfig(cwd);
    if (!config) {
      defaultIO.logError('Failed to load config');
      return;
    }

    if (config.marketplaces[cmd.name]) {
      defaultIO.logError(`Marketplace '${cmd.name}' already exists`);
      return;
    }

    const isHttpUrl = cmd.path.startsWith('http://') || cmd.path.startsWith('https://');

    const isGitHubShort = !isHttpUrl && isGitHubShorthand(cmd.path);

    const isGitUrl =
      (isHttpUrl || !isGitHubShort) &&
      (cmd.path.endsWith('.git') ||
        cmd.path.includes('github.com') ||
        cmd.path.includes('gitlab.com') ||
        cmd.path.includes('bitbucket.org') ||
        cmd.path.startsWith('git@'));

    const isMarketplaceJsonUrl = isHttpUrl && cmd.path.endsWith('.json');

    let marketplace:
      | { source: 'url'; url: string }
      | { source: 'git'; url: string }
      | { source: 'directory'; path: string };

    if (isMarketplaceJsonUrl) {
      marketplace = { source: 'url' as const, url: cmd.path };
    } else if (isGitHubShort) {
      const shorthand = parseGitHubShorthand(cmd.path);
      if (!shorthand) {
        defaultIO.logError('Invalid GitHub shorthand format');
        return;
      }
      const expandedUrl = await expandGitHubShorthand(shorthand);
      marketplace = { source: 'git' as const, url: expandedUrl };
    } else if (isGitUrl) {
      marketplace = { source: 'git' as const, url: cmd.path };
    } else {
      marketplace = {
        source: 'directory' as const,
        path: cmd.path,
      };
    }

    const updatedConfig = {
      ...config,
      marketplaces: {
        ...config.marketplaces,
        [cmd.name]: marketplace,
      },
    };

    if (cmd.dryRun) {
      defaultIO.logInfo(`[DRY RUN] Would add marketplace '${cmd.name}' to ${configName}`);
      defaultIO.logInfo(`[DRY RUN] Source: ${marketplace.source}`);
      if (marketplace.source === 'directory' && marketplace.path) {
        defaultIO.logInfo(`[DRY RUN] Path: ${marketplace.path}`);
      } else if ((marketplace.source === 'git' || marketplace.source === 'url') && marketplace.url) {
        defaultIO.logInfo(`[DRY RUN] URL: ${marketplace.url}`);
      }
    } else {
      await writeJsonFile(targetPath, updatedConfig, PluginsConfigSchema, cmd.dryRun);
      defaultIO.logSuccess(`Added marketplace '${cmd.name}' to ${configName}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to add marketplace: ${message}`);
    throw error;
  }
}
