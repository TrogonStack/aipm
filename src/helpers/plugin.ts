import { join } from 'node:path';
import { DIR_CLAUDE_PLUGIN, FILE_PLUGIN_MANIFEST } from '../constants';
import { isNodeError, PluginManifestInvalidError, PluginManifestNotFoundError } from '../errors';
import type { PluginManifest } from '../schema';
import { PluginManifestSchema } from '../schema';
import { readJsonFile } from './fs';

export async function loadPluginManifest(pluginPath: string): Promise<PluginManifest> {
  const manifestPath = join(pluginPath, DIR_CLAUDE_PLUGIN, FILE_PLUGIN_MANIFEST);

  try {
    const manifest = await readJsonFile(manifestPath, PluginManifestSchema);
    return manifest;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new PluginManifestNotFoundError(pluginPath, { cause: error });
    }
    throw new PluginManifestInvalidError(pluginPath, { cause: error });
  }
}

export async function validatePluginStructure(pluginPath: string): Promise<void> {
  const manifest = await loadPluginManifest(pluginPath);

  if (!manifest.name) {
    throw new Error("Plugin manifest must include 'name' field");
  }

  if (!manifest.version) {
    throw new Error("Plugin manifest must include 'version' field");
  }

  if (!manifest.author) {
    throw new Error("Plugin manifest must include 'author' field");
  }
}
