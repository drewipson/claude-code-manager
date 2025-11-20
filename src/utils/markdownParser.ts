import * as fs from 'fs';

export interface MarkdownSection {
  title: string;
  level: number;
  lineNumber: number;
}

export async function parseMarkdownSections(filePath: string): Promise<MarkdownSection[]> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const sections: MarkdownSection[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,6})\s+(.+)$/);

      if (match) {
        const level = match[1].length;
        const title = match[2].trim();

        sections.push({
          title,
          level,
          lineNumber: i + 1, // 1-based line numbers
        });
      }
    }

    return sections;
  } catch (error) {
    console.error('Failed to parse markdown sections:', error);
    return [];
  }
}
