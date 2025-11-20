import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { McpServer } from '../core/types';
import { DEFAULT_GLOBAL_CLAUDE_PATH } from '../core/constants';

export class McpService {
  private globalClaudePath: string;

  constructor() {
    const config = vscode.workspace.getConfiguration('claudeCodeManager');
    this.globalClaudePath = config.get<string>('globalClaudePath') || DEFAULT_GLOBAL_CLAUDE_PATH;
  }

  async discoverMcpServers(): Promise<McpServer[]> {
    const servers: McpServer[] = [];

    // Check user-level .mcp.json
    const userMcpPath = path.join(this.globalClaudePath, '.mcp.json');
    if (await this.fileExists(userMcpPath)) {
      const userServers = await this.parseMcpConfig(userMcpPath, 'User');
      servers.push(...userServers);
    }

    // Check project-level .mcp.json
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const projectMcpPath = path.join(workspaceFolder.uri.fsPath, '.mcp.json');
      if (await this.fileExists(projectMcpPath)) {
        const projectServers = await this.parseMcpConfig(projectMcpPath, 'Project');
        servers.push(...projectServers);
      }
    }

    // Check for managed MCP configuration (enterprise)
    const managedPaths = this.getManagedMcpPaths();
    for (const managedPath of managedPaths) {
      if (await this.fileExists(managedPath)) {
        const managedServers = await this.parseMcpConfig(managedPath, 'Managed');
        servers.push(...managedServers);
        break; // Only one managed config will exist
      }
    }

    return servers;
  }

  private async parseMcpConfig(
    configPath: string,
    location: 'User' | 'Project' | 'Managed'
  ): Promise<McpServer[]> {
    try {
      const content = await fs.promises.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        return [];
      }

      const servers: McpServer[] = [];
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        const server = serverConfig as any;

        servers.push({
          name,
          type: server.type || 'stdio',
          location,
          configPath,
          url: server.url,
          command: server.command,
          args: server.args,
        });
      }

      return servers;
    } catch (error) {
      console.error(`Failed to parse MCP config at ${configPath}:`, error);
      return [];
    }
  }

  private getManagedMcpPaths(): string[] {
    const platform = process.platform;

    switch (platform) {
      case 'darwin':
        return ['/Library/Application Support/ClaudeCode/managed-mcp.json'];
      case 'win32':
        return ['C:\\ProgramData\\ClaudeCode\\managed-mcp.json'];
      case 'linux':
        return ['/etc/claude-code/managed-mcp.json'];
      default:
        return [];
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.isFile();
    } catch {
      return false;
    }
  }
}
