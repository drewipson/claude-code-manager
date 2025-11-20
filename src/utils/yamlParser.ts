import * as fs from 'fs';

export interface YamlFrontmatter {
  description?: string;
  name?: string;
  [key: string]: any;
}

export async function parseYamlFrontmatter(filePath: string): Promise<YamlFrontmatter | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');

    // Check if file starts with YAML frontmatter (---)
    if (!content.startsWith('---')) {
      return null;
    }

    // Find the closing ---
    const lines = content.split('\n');
    let endIndex = -1;

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      return null;
    }

    // Extract YAML content
    const yamlContent = lines.slice(1, endIndex).join('\n');

    // Simple YAML parser (for basic key: value pairs)
    const frontmatter: YamlFrontmatter = {};
    const yamlLines = yamlContent.split('\n');

    for (const line of yamlLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }

      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }

      frontmatter[key] = value;
    }

    return frontmatter;
  } catch (error) {
    console.error('Failed to parse YAML frontmatter:', error);
    return null;
  }
}
