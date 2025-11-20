import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ClaudeFile, ClaudeFileType, LocationScope } from '../core/types';
import {
  DEFAULT_GLOBAL_CLAUDE_PATH,
  CLAUDE_MD_PATTERNS,
  COMMANDS_DIR,
  SKILLS_DIR,
  AGENTS_DIR,
  MCP_DIR,
  MARKDOWN_EXTENSIONS,
  JSON_EXTENSIONS,
} from '../core/constants';

export class FileDiscoveryService {
  private globalClaudePath: string;

  constructor() {
    const config = vscode.workspace.getConfiguration('claudeCodeManager');
    this.globalClaudePath = config.get<string>('globalClaudePath') || DEFAULT_GLOBAL_CLAUDE_PATH;
  }

  getGlobalClaudePath(): string {
    return this.globalClaudePath;
  }

  getProjectClaudePath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }
    return path.join(workspaceFolder.uri.fsPath, '.claude');
  }

  async discoverAllFiles(): Promise<{
    memories: ClaudeFile[];
    commands: ClaudeFile[];
    skills: ClaudeFile[];
    subAgents: ClaudeFile[];
    mcpServers: ClaudeFile[];
  }> {
    const [memories, commands, skills, subAgents, mcpServers] = await Promise.all([
      this.discoverMemories(),
      this.discoverCommands(),
      this.discoverSkills(),
      this.discoverSubAgents(),
      this.discoverMcpServers(),
    ]);

    return { memories, commands, skills, subAgents, mcpServers };
  }

  async discoverMemories(): Promise<ClaudeFile[]> {
    // Memories ARE CLAUDE.md files - they store persistent context
    const files: ClaudeFile[] = [];

    // Global CLAUDE.md (User Memory)
    for (const pattern of CLAUDE_MD_PATTERNS) {
      const globalPath = path.join(this.globalClaudePath, pattern);
      if (await this.fileExists(globalPath)) {
        files.push(this.createClaudeFile(globalPath, 'memory', 'global', 'Global'));
        break;
      }
    }

    // Project root CLAUDE.md (Project Memory)
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      for (const pattern of CLAUDE_MD_PATTERNS) {
        const projectPath = path.join(workspaceFolder.uri.fsPath, pattern);
        if (await this.fileExists(projectPath)) {
          files.push(this.createClaudeFile(projectPath, 'memory', 'project', 'Project Root'));
          break;
        }
      }

      // Also check .claude/CLAUDE.md
      for (const pattern of CLAUDE_MD_PATTERNS) {
        const dotClaudePath = path.join(workspaceFolder.uri.fsPath, '.claude', pattern);
        if (await this.fileExists(dotClaudePath)) {
          files.push(this.createClaudeFile(dotClaudePath, 'memory', 'project', 'Project .claude'));
          break;
        }
      }

      // Nested CLAUDE.md files
      const nestedFiles = await this.findNestedClaudeFiles(workspaceFolder.uri.fsPath);
      files.push(...nestedFiles);
    }

    return files;
  }

  async discoverCommands(): Promise<ClaudeFile[]> {
    return this.discoverFilesAndDirsInDir(COMMANDS_DIR, 'command', MARKDOWN_EXTENSIONS);
  }

  async discoverSkills(): Promise<ClaudeFile[]> {
    return this.discoverFilesInDir(SKILLS_DIR, 'skill', MARKDOWN_EXTENSIONS);
  }

  async discoverSubAgents(): Promise<ClaudeFile[]> {
    return this.discoverFilesAndDirsInDir(AGENTS_DIR, 'subAgent', MARKDOWN_EXTENSIONS);
  }

  async discoverMcpServers(): Promise<ClaudeFile[]> {
    const files: ClaudeFile[] = [];

    // Check for MCP config files in global
    const globalMcpConfig = path.join(this.globalClaudePath, 'mcp_servers.json');
    if (await this.fileExists(globalMcpConfig)) {
      files.push(this.createClaudeFile(globalMcpConfig, 'mcp', 'global', 'Global'));
    }

    // Check for project MCP config
    const projectClaudePath = this.getProjectClaudePath();
    if (projectClaudePath) {
      const projectMcpConfig = path.join(projectClaudePath, 'mcp_servers.json');
      if (await this.fileExists(projectMcpConfig)) {
        files.push(this.createClaudeFile(projectMcpConfig, 'mcp', 'project', 'Project'));
      }
    }

    // Also check for MCP servers directory
    const mcpDirFiles = await this.discoverFilesInDir(MCP_DIR, 'mcp', [...MARKDOWN_EXTENSIONS, ...JSON_EXTENSIONS]);
    files.push(...mcpDirFiles);

    return files;
  }

  private async discoverFilesInDir(
    dirName: string,
    fileType: ClaudeFileType,
    extensions: string[]
  ): Promise<ClaudeFile[]> {
    const files: ClaudeFile[] = [];

    // Global directory
    const globalDir = path.join(this.globalClaudePath, dirName);
    if (await this.directoryExists(globalDir)) {
      const globalFiles = await this.getFilesInDirectory(globalDir, extensions);
      for (const filePath of globalFiles) {
        files.push(this.createClaudeFile(filePath, fileType, 'global', 'Global'));
      }
    }

    // Project directory
    const projectClaudePath = this.getProjectClaudePath();
    if (projectClaudePath) {
      const projectDir = path.join(projectClaudePath, dirName);
      if (await this.directoryExists(projectDir)) {
        const projectFiles = await this.getFilesInDirectory(projectDir, extensions);
        for (const filePath of projectFiles) {
          files.push(this.createClaudeFile(filePath, fileType, 'project', 'Project'));
        }
      }
    }

    return files;
  }

  private async discoverFilesAndDirsInDir(
    dirName: string,
    fileType: ClaudeFileType,
    extensions: string[]
  ): Promise<ClaudeFile[]> {
    const items: ClaudeFile[] = [];

    // Global directory
    const globalDir = path.join(this.globalClaudePath, dirName);
    if (await this.directoryExists(globalDir)) {
      const globalItems = await this.getFilesAndDirsInDirectory(globalDir, extensions);
      for (const item of globalItems) {
        items.push(this.createClaudeFile(item.path, fileType, 'global', 'Global', item.isDirectory));
      }
    }

    // Project directory
    const projectClaudePath = this.getProjectClaudePath();
    if (projectClaudePath) {
      const projectDir = path.join(projectClaudePath, dirName);
      if (await this.directoryExists(projectDir)) {
        const projectItems = await this.getFilesAndDirsInDirectory(projectDir, extensions);
        for (const item of projectItems) {
          items.push(this.createClaudeFile(item.path, fileType, 'project', 'Project', item.isDirectory));
        }
      }
    }

    return items;
  }

  private async findNestedClaudeFiles(rootPath: string): Promise<ClaudeFile[]> {
    const files: ClaudeFile[] = [];
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      return files;
    }

    // Use VS Code's findFiles for efficient searching
    for (const pattern of CLAUDE_MD_PATTERNS) {
      const uris = await vscode.workspace.findFiles(
        `**/${pattern}`,
        '**/node_modules/**',
        100 // Limit results
      );

      for (const uri of uris) {
        // Skip root CLAUDE.md (already handled)
        if (path.dirname(uri.fsPath) === rootPath) {
          continue;
        }

        const relativePath = path.relative(rootPath, path.dirname(uri.fsPath));
        files.push(this.createClaudeFile(uri.fsPath, 'memory', 'nested', relativePath));
      }
    }

    return files;
  }

  private createClaudeFile(
    filePath: string,
    type: ClaudeFileType,
    scope: LocationScope,
    scopeLabel: string,
    isDirectory?: boolean
  ): ClaudeFile {
    return {
      name: path.basename(filePath),
      path: filePath,
      scope,
      scopeLabel,
      type,
      isDirectory,
      parentType: isDirectory ? type : undefined,
    };
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async getFilesInDirectory(dirPath: string, extensions: string[]): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        } else if (entry.isDirectory()) {
          // Recursively discover files in subdirectories
          const subFiles = await this.getFilesInDirectory(fullPath, extensions);
          files.push(...subFiles);
        }
      }

      return files;
    } catch {
      return [];
    }
  }

  private async getFilesAndDirsInDirectory(
    dirPath: string,
    extensions: string[]
  ): Promise<Array<{ path: string; isDirectory: boolean }>> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const items: Array<{ path: string; isDirectory: boolean }> = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            items.push({ path: fullPath, isDirectory: false });
          }
        } else if (entry.isDirectory()) {
          // Add the directory itself
          items.push({ path: fullPath, isDirectory: true });

          // Recursively discover items in subdirectories
          const subItems = await this.getFilesAndDirsInDirectory(fullPath, extensions);
          items.push(...subItems);
        }
      }

      return items;
    } catch {
      return [];
    }
  }
}
