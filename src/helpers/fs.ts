import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { z } from 'zod';
import { isFileNotFoundError, isNodeError } from '../errors';

export class JsonFileError extends Error {
  constructor(
    public readonly filePath: string,
    options?: ErrorOptions,
  ) {
    super('JSON validation failed', options);
    this.name = 'JsonFileError';
  }
}

export async function ensureDir(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch (error: unknown) {
    if (isNodeError(error) && error.code !== 'EEXIST') {
      throw error;
    }
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function writeJsonFile(path: string, data: any, schema?: z.ZodSchema, dryRun?: boolean): Promise<void> {
  if (schema) {
    const parseResult = schema.safeParse(data);
    if (!parseResult.success) {
      throw new JsonFileError(path, { cause: parseResult.error });
    }
  }

  if (dryRun) {
    return;
  }

  await ensureDir(dirname(path));
  await Bun.write(path, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readJsonFile<T>(path: string, schema?: z.ZodSchema<T>): Promise<T> {
  const file = Bun.file(path);
  const rawData = await file.json();

  if (schema) {
    const parseResult = schema.safeParse(rawData);
    if (!parseResult.success) {
      throw new JsonFileError(path, { cause: parseResult.error });
    }
    return parseResult.data;
  }

  return rawData as T;
}

export async function backupFile(path: string, dryRun?: boolean): Promise<void> {
  if (dryRun) {
    return;
  }

  const backupPath = `${path}.backup`;
  try {
    await copyFile(path, backupPath);
  } catch (error: unknown) {
    // Ignore if file doesn't exist - nothing to backup
    if (!isFileNotFoundError(error)) {
      throw error;
    }
  }
}

export async function addToGitignore(gitignorePath: string, pattern: string, dryRun?: boolean): Promise<void> {
  let content = '';

  try {
    const file = Bun.file(gitignorePath);
    content = await file.text();
  } catch {
    content = '';
  }

  if (!content.includes(pattern)) {
    if (dryRun) {
      return;
    }

    const newContent = content.trim() ? `${content.trim()}\n${pattern}\n` : `${pattern}\n`;
    await Bun.write(gitignorePath, newContent);
  }
}
