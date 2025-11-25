import { z } from 'zod';
import { getConfigPath, loadPluginsConfig } from '../config/loader';
import { FILE_AIPM_CONFIG, FILE_AIPM_CONFIG_LOCAL } from '../constants';
import { getErrorMessage } from '../errors';
import { defaultIO } from '../helpers/io';

const ListOptionsSchema = z.object({
  cwd: z.string().optional(),
});

type ListOptions = z.infer<typeof ListOptionsSchema>;

export async function list(options: ListOptions = {}): Promise<void> {
  const cmd = ListOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { config, sources } = await loadPluginsConfig(cwd);

    if (!sources.project) {
      defaultIO.logError(`No ${getConfigPath(FILE_AIPM_CONFIG)} found. Run 'aipm init' first.`);
      defaultIO.logInfo(`(${getConfigPath(FILE_AIPM_CONFIG_LOCAL)} is optional for local overrides)`);
      return;
    }

    const marketplaceCount = Object.keys(config.marketplaces).length;
    const pluginCount = Object.keys(config.plugins).length;

    if (marketplaceCount === 0 && pluginCount === 0) {
      defaultIO.logInfo('No marketplaces or plugins configured.');
      return;
    }

    if (marketplaceCount > 0) {
      console.log('\n📦 Marketplaces:');
      for (const [name, marketplace] of Object.entries(config.marketplaces)) {
        const isClaudeMarketplace = name.startsWith('claude/');
        const sourceLabel = isClaudeMarketplace ? '🤖 Claude Code (auto-discovered)' : marketplace.source;

        console.log(`  • ${name}`);
        console.log(`    Source: ${sourceLabel}`);

        if (marketplace.source === 'directory' && marketplace.path) {
          console.log(`    Path: ${marketplace.path}`);
        } else if (marketplace.source === 'git' && marketplace.url) {
          console.log(`    URL: ${marketplace.url}`);
          if (marketplace.branch) {
            console.log(`    Branch: ${marketplace.branch}`);
          }
        } else if (marketplace.source === 'url' && marketplace.url) {
          console.log(`    URL: ${marketplace.url}`);
        }
      }
    }

    if (pluginCount > 0) {
      console.log('\n🔌 Plugins:');
      for (const [id, plugin] of Object.entries(config.plugins)) {
        const status = plugin.enabled ? '✓' : '✗';
        const scope = plugin.scope ? ` (${plugin.scope})` : '';
        const version = plugin.version ? ` v${plugin.version}` : '';
        console.log(`  ${status} ${id}${version}${scope}`);
      }
    }

    console.log('');
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    defaultIO.logError(`Failed to list: ${message}`);
    throw error;
  }
}
