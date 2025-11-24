export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

export function isFileNotFoundError(error: unknown): error is NodeJS.ErrnoException {
  return isNodeError(error) && error.code === 'ENOENT';
}

export class PluginManifestNotFoundError extends Error {
  constructor(
    public readonly pluginPath: string,
    options?: ErrorOptions,
  ) {
    super(`Plugin manifest not found: ${pluginPath}/.claude-plugin/plugin.json is required`, options);
    this.name = 'PluginManifestNotFoundError';
  }
}

export class PluginManifestInvalidError extends Error {
  constructor(
    public readonly pluginPath: string,
    options?: ErrorOptions,
  ) {
    super('Invalid plugin.json', options);
    this.name = 'PluginManifestInvalidError';
  }
}

export class PluginNotFoundError extends Error {
  constructor(
    public readonly pluginName: string,
    public readonly marketplaceName: string,
    options?: ErrorOptions,
  ) {
    super(`Plugin '${pluginName}' not found in marketplace '${marketplaceName}'`, options);
    this.name = 'PluginNotFoundError';
  }
}

export class DirectoryNotFoundError extends Error {
  constructor(
    public readonly path: string,
    options?: ErrorOptions,
  ) {
    super(`Directory not found: ${path}`, options);
    this.name = 'DirectoryNotFoundError';
  }
}
