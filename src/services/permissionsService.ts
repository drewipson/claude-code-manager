import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PermissionRule } from '../core/types';
import { DEFAULT_GLOBAL_CLAUDE_PATH } from '../core/constants';

export class PermissionsService {
  private globalClaudePath: string;

  constructor() {
    const config = vscode.workspace.getConfiguration('claudeCodeManager');
    this.globalClaudePath = config.get<string>('globalClaudePath') || DEFAULT_GLOBAL_CLAUDE_PATH;
  }

  async discoverPermissions(): Promise<PermissionRule[]> {
    const rules: PermissionRule[] = [];

    // Check user settings
    const userSettingsPath = path.join(this.globalClaudePath, 'settings.json');
    if (await this.fileExists(userSettingsPath)) {
      const userRules = await this.parsePermissions(userSettingsPath, 'User (~/.claude)');
      rules.push(...userRules);
    }

    // Check project settings
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const projectSettingsPath = path.join(workspaceFolder.uri.fsPath, '.claude', 'settings.json');
      if (await this.fileExists(projectSettingsPath)) {
        const projectRules = await this.parsePermissions(projectSettingsPath, 'Project (.claude)');
        rules.push(...projectRules);
      }

      // Check local overrides
      const localSettingsPath = path.join(
        workspaceFolder.uri.fsPath,
        '.claude',
        'settings.local.json'
      );
      if (await this.fileExists(localSettingsPath)) {
        const localRules = await this.parsePermissions(localSettingsPath, 'Local (.claude)');
        rules.push(...localRules);
      }
    }

    // Check for managed settings (enterprise)
    const managedPaths = this.getManagedSettingsPaths();
    for (const managedPath of managedPaths) {
      if (await this.fileExists(managedPath)) {
        const managedRules = await this.parsePermissions(managedPath, 'Managed (Enterprise)');
        rules.push(...managedRules);
        break; // Only one managed config will exist
      }
    }

    return rules;
  }

  private async parsePermissions(
    configPath: string,
    location: string
  ): Promise<PermissionRule[]> {
    try {
      const content = await fs.promises.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      if (!config.permissions || typeof config.permissions !== 'object') {
        return [];
      }

      const rules: PermissionRule[] = [];
      const permissions = config.permissions;

      // Parse allow rules
      if (Array.isArray(permissions.allow)) {
        for (const pattern of permissions.allow) {
          const parsed = this.parsePermissionPattern(pattern);
          if (parsed) {
            rules.push({
              type: 'allow',
              tool: parsed.tool,
              pattern: parsed.pattern,
              location,
              configPath,
            });
          }
        }
      }

      // Parse ask rules
      if (Array.isArray(permissions.ask)) {
        for (const pattern of permissions.ask) {
          const parsed = this.parsePermissionPattern(pattern);
          if (parsed) {
            rules.push({
              type: 'ask',
              tool: parsed.tool,
              pattern: parsed.pattern,
              location,
              configPath,
            });
          }
        }
      }

      // Parse deny rules
      if (Array.isArray(permissions.deny)) {
        for (const pattern of permissions.deny) {
          const parsed = this.parsePermissionPattern(pattern);
          if (parsed) {
            rules.push({
              type: 'deny',
              tool: parsed.tool,
              pattern: parsed.pattern,
              location,
              configPath,
            });
          }
        }
      }

      return rules;
    } catch (error) {
      console.error(`Failed to parse permissions at ${configPath}:`, error);
      return [];
    }
  }

  private parsePermissionPattern(
    pattern: string
  ): { tool: string; pattern: string } | null {
    // Pattern format: "Tool(pattern)" or "Tool:pattern"
    const match = pattern.match(/^(\w+)[\(:](.*?)[\)]?$/);
    if (match) {
      return {
        tool: match[1],
        pattern: match[2] || '*',
      };
    }

    // If no pattern, treat entire string as tool name
    return {
      tool: pattern,
      pattern: '*',
    };
  }

  private getManagedSettingsPaths(): string[] {
    const platform = process.platform;

    switch (platform) {
      case 'darwin':
        return ['/Library/Application Support/ClaudeCode/managed-settings.json'];
      case 'win32':
        return ['C:\\ProgramData\\ClaudeCode\\managed-settings.json'];
      case 'linux':
        return ['/etc/claude-code/managed-settings.json'];
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
