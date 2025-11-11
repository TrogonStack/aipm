import { z } from 'zod';
import { loadPluginsConfig } from '../config/loader';
import { resolveMarketplacePath } from '../helpers/git';
import { defaultIO } from '../helpers/io';
import { getAvailablePlugins, getMarketplaceType, loadMarketplaceManifest } from '../helpers/marketplace';

const PluginSearchOptionsSchema = z.object({
  query: z.string().optional(),
  cwd: z.string().optional(),
});

type PluginInfo = {
  name: string;
  marketplace: string;
  description?: string;
  version?: string;
  author?: string;
};

export async function pluginSearch(options: unknown): Promise<void> {
  const cmd = PluginSearchOptionsSchema.parse(options);

  const cwd = cmd.cwd || process.cwd();

  try {
    const { config } = await loadPluginsConfig(cwd);

    if (Object.keys(config.marketplaces).length === 0) {
      defaultIO.logInfo('No marketplaces configured. Add a marketplace first with: aipm marketplace add <name> <path>');
      return;
    }

    const allPlugins: PluginInfo[] = [];

    for (const [marketplaceName, marketplace] of Object.entries(config.marketplaces)) {
      try {
        const marketplacePath = await resolveMarketplacePath(marketplaceName, marketplace, cwd, { dryRun: false });

        if (!marketplacePath) {
          continue;
        }

        const manifest = await loadMarketplaceManifest(marketplacePath, getMarketplaceType(marketplaceName));
        const availablePlugins = await getAvailablePlugins(marketplacePath, manifest);

        for (const pluginName of availablePlugins) {
          const pluginEntry = manifest?.plugins.find((p) => p.name === pluginName);

          const pluginInfo: PluginInfo = {
            name: pluginName,
            marketplace: marketplaceName,
            description: pluginEntry?.description,
            version: pluginEntry?.version,
            author: pluginEntry?.author?.name,
          };

          if (cmd.query) {
            const query = cmd.query.toLowerCase();
            const matchesName = pluginName.toLowerCase().includes(query);
            const matchesDescription = pluginEntry?.description?.toLowerCase().includes(query);
            const matchesMarketplace = marketplaceName.toLowerCase().includes(query);

            if (matchesName || matchesDescription || matchesMarketplace) {
              allPlugins.push(pluginInfo);
            }
          } else {
            allPlugins.push(pluginInfo);
          }
        }
      } catch (_error) {}
    }

    if (allPlugins.length === 0) {
      if (cmd.query) {
        console.log(`\n🔍 No plugins found matching "${cmd.query}"\n`);
      } else {
        console.log('\n📦 No plugins available in configured marketplaces\n');
      }
      return;
    }

    if (cmd.query) {
      console.log(`\n🔍 Found ${allPlugins.length} plugin(s) matching "${cmd.query}":\n`);
    } else {
      console.log(`\n📦 Available plugins (${allPlugins.length}):\n`);
    }

    const groupedByMarketplace = allPlugins.reduce(
      (acc, plugin) => {
        const marketplace = acc[plugin.marketplace];
        if (!marketplace) {
          acc[plugin.marketplace] = [];
        }
        acc[plugin.marketplace]?.push(plugin);
        return acc;
      },
      {} as Record<string, PluginInfo[]>,
    );

    for (const [marketplaceName, plugins] of Object.entries(groupedByMarketplace)) {
      console.log(`📁 ${marketplaceName} (${plugins.length}):`);

      for (const plugin of plugins) {
        const pluginId = `${plugin.name}@${plugin.marketplace}`;
        const isInstalled = config.plugins[pluginId]?.enabled;
        const status = isInstalled ? '✓ installed' : '○ available';

        let line = `  ${status} ${plugin.name}`;

        if (plugin.version) {
          line += ` (v${plugin.version})`;
        }

        if (plugin.description) {
          line += ` - ${plugin.description}`;
        }

        if (plugin.author) {
          line += ` by ${plugin.author}`;
        }

        console.log(line);
      }

      console.log();
    }

    console.log('💡 Install a plugin with: aipm plugin install <name>@<marketplace>\n');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    defaultIO.logError(`Failed to search plugins: ${message}`);
    throw error;
  }
}
