import { readFile } from 'node:fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export type FrontmatterData = Record<string, unknown>;

export type FrontmatterResult = {
  frontmatter: FrontmatterData | null;
  content: string;
};

/**
 * Parse frontmatter from a markdown file
 */
export function parseFrontmatter(fileContent: string): FrontmatterResult {
  // Match frontmatter with content between --- markers
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = fileContent.match(frontmatterRegex);

  // Also match empty frontmatter (---\n---\n)
  if (!match) {
    const emptyFrontmatterRegex = /^---\r?\n---\r?\n([\s\S]*)$/;
    const emptyMatch = fileContent.match(emptyFrontmatterRegex);
    if (emptyMatch?.[1]) {
      return {
        frontmatter: null,
        content: emptyMatch[1].trim(),
      };
    }
  }

  if (!match) {
    return {
      frontmatter: null,
      content: fileContent,
    };
  }

  const [, frontmatterText, content] = match;

  if (!frontmatterText || !content) {
    return {
      frontmatter: null,
      content: fileContent,
    };
  }

  // Empty frontmatter
  if (!frontmatterText.trim()) {
    return {
      frontmatter: null,
      content: content.trim(),
    };
  }

  try {
    const frontmatter = parseYaml(frontmatterText);
    return {
      frontmatter: frontmatter || null,
      content: content.trim(),
    };
  } catch (_error) {
    return {
      frontmatter: null,
      content: fileContent,
    };
  }
}

/**
 * Serialize frontmatter and content back to markdown
 */
export function serializeFrontmatter(frontmatter: FrontmatterData | null, content: string): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return content;
  }

  const frontmatterText = stringifyYaml(frontmatter).trim();
  return `---\n${frontmatterText}\n---\n\n${content}`;
}

/**
 * Read a .cursor.yaml file and parse it
 */
export async function readCursorMetadata(cursorYamlPath: string): Promise<FrontmatterData | null> {
  try {
    const content = await readFile(cursorYamlPath, 'utf-8');
    const metadata = parseYaml(content);
    return metadata || null;
  } catch (_error) {
    return null;
  }
}

/**
 * Apply Cursor frontmatter override to a markdown file
 */
export async function applyCursorFrontmatter(sourceContent: string, cursorYamlPath: string): Promise<string> {
  const { content } = parseFrontmatter(sourceContent);
  const cursorFrontmatter = await readCursorMetadata(cursorYamlPath);

  if (!cursorFrontmatter) {
    return sourceContent;
  }

  return serializeFrontmatter(cursorFrontmatter, content);
}
