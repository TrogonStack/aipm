import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function createTestPlugin(
  baseDir: string,
  pluginName: string,
  options?: {
    version?: string;
    author?: string | { name: string; email?: string };
    description?: string;
    homepage?: string;
    repository?: string;
    commands?: string[];
  },
): Promise<string> {
  const pluginDir = join(baseDir, pluginName);
  const claudePluginDir = join(pluginDir, '.claude-plugin');
  await mkdir(claudePluginDir, { recursive: true });

  const manifest = {
    name: pluginName,
    version: options?.version || '1.0.0',
    author: options?.author || 'Test Author',
    ...(options?.description && { description: options.description }),
    ...(options?.homepage && { homepage: options.homepage }),
    ...(options?.repository && { repository: options.repository }),
  };

  await writeFile(join(claudePluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2));

  if (options?.commands && options.commands.length > 0) {
    const commandsDir = join(pluginDir, 'commands');
    await mkdir(commandsDir, { recursive: true });

    for (const command of options.commands) {
      await writeFile(join(commandsDir, `${command}.md`), `# ${command} command`);
    }
  }

  return pluginDir;
}
