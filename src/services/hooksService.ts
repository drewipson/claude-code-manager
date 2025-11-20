import * as fs from 'fs';
import * as path from 'path';
import { HookConfiguration, HookEventType, HookMatcher, Hook } from '../core/types';
import { DEFAULT_GLOBAL_CLAUDE_PATH } from '../core/constants';
import * as vscode from 'vscode';

export class HooksService {
  private globalClaudePath: string;

  constructor() {
    const config = vscode.workspace.getConfiguration('claudeCodeManager');
    this.globalClaudePath = config.get<string>('globalClaudePath') || DEFAULT_GLOBAL_CLAUDE_PATH;
  }

  async discoverHooks(): Promise<HookConfiguration[]> {
    const hooks: HookConfiguration[] = [];

    // Check global settings (~/.claude/settings.json)
    const globalSettingsPath = path.join(this.globalClaudePath, 'settings.json');
    if (await this.fileExists(globalSettingsPath)) {
      const globalHooks = await this.parseHooks(globalSettingsPath, 'Global (~/.claude)');
      hooks.push(...globalHooks);
    }

    // Check project local settings (.claude/settings.local.json)
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const localSettingsPath = path.join(
        workspaceFolder.uri.fsPath,
        '.claude',
        'settings.local.json'
      );
      if (await this.fileExists(localSettingsPath)) {
        const localHooks = await this.parseHooks(localSettingsPath, 'Project (.claude/settings.local.json)');
        hooks.push(...localHooks);
      }
    }

    return hooks;
  }

  private async parseHooks(
    configPath: string,
    location: string
  ): Promise<HookConfiguration[]> {
    try {
      const content = await fs.promises.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      if (!config.hooks || typeof config.hooks !== 'object') {
        return [];
      }

      const configurations: HookConfiguration[] = [];

      // Iterate through each event type
      for (const [eventType, matchersArray] of Object.entries(config.hooks)) {
        if (!Array.isArray(matchersArray)) {
          continue;
        }

        const matchers: HookMatcher[] = [];

        for (const matcherObj of matchersArray) {
          if (typeof matcherObj !== 'object' || !matcherObj.hooks || !Array.isArray(matcherObj.hooks)) {
            continue;
          }

          matchers.push({
            matcher: matcherObj.matcher,
            hooks: matcherObj.hooks,
          });
        }

        if (matchers.length > 0) {
          configurations.push({
            eventType: eventType as HookEventType,
            matchers,
            location,
            configPath,
          });
        }
      }

      return configurations;
    } catch (error) {
      console.error(`Failed to parse hooks at ${configPath}:`, error);
      return [];
    }
  }

  async addHook(
    scope: 'global' | 'local',
    eventType: HookEventType,
    matcher: string,
    hook: Hook
  ): Promise<boolean> {
    try {
      const settingsPath = this.getSettingsPath(scope);
      if (!settingsPath) {
        vscode.window.showErrorMessage('Cannot determine settings path for the selected scope.');
        return false;
      }

      // Ensure directory exists
      const dir = path.dirname(settingsPath);
      if (!(await this.directoryExists(dir))) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      // Read existing settings or create empty object
      let settings: any = {};
      if (await this.fileExists(settingsPath)) {
        const content = await fs.promises.readFile(settingsPath, 'utf-8');
        settings = JSON.parse(content);
      }

      // Initialize hooks structure if needed
      if (!settings.hooks) {
        settings.hooks = {};
      }
      if (!settings.hooks[eventType]) {
        settings.hooks[eventType] = [];
      }

      // Find or create matcher entry
      let matcherEntry = settings.hooks[eventType].find((m: any) => m.matcher === matcher);
      if (!matcherEntry) {
        matcherEntry = { matcher, hooks: [] };
        settings.hooks[eventType].push(matcherEntry);
      }

      // Add hook
      matcherEntry.hooks.push(hook);

      // Write back to file with formatting
      await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

      return true;
    } catch (error) {
      console.error('Failed to add hook:', error);
      vscode.window.showErrorMessage(`Failed to add hook: ${error}`);
      return false;
    }
  }

  async updateHook(
    configPath: string,
    eventType: HookEventType,
    matcherIndex: number,
    hookIndex: number,
    updatedHook: Hook
  ): Promise<boolean> {
    try {
      if (!(await this.fileExists(configPath))) {
        vscode.window.showErrorMessage('Settings file not found.');
        return false;
      }

      const content = await fs.promises.readFile(configPath, 'utf-8');
      const settings = JSON.parse(content);

      if (
        !settings.hooks ||
        !settings.hooks[eventType] ||
        !settings.hooks[eventType][matcherIndex] ||
        !settings.hooks[eventType][matcherIndex].hooks[hookIndex]
      ) {
        vscode.window.showErrorMessage('Hook not found in settings.');
        return false;
      }

      // Update the hook
      settings.hooks[eventType][matcherIndex].hooks[hookIndex] = updatedHook;

      // Write back to file
      await fs.promises.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8');

      return true;
    } catch (error) {
      console.error('Failed to update hook:', error);
      vscode.window.showErrorMessage(`Failed to update hook: ${error}`);
      return false;
    }
  }

  async deleteHook(
    configPath: string,
    eventType: HookEventType,
    matcherIndex: number,
    hookIndex: number
  ): Promise<boolean> {
    try {
      if (!(await this.fileExists(configPath))) {
        vscode.window.showErrorMessage('Settings file not found.');
        return false;
      }

      const content = await fs.promises.readFile(configPath, 'utf-8');
      const settings = JSON.parse(content);

      if (
        !settings.hooks ||
        !settings.hooks[eventType] ||
        !settings.hooks[eventType][matcherIndex] ||
        !settings.hooks[eventType][matcherIndex].hooks[hookIndex]
      ) {
        vscode.window.showErrorMessage('Hook not found in settings.');
        return false;
      }

      // Remove the hook
      settings.hooks[eventType][matcherIndex].hooks.splice(hookIndex, 1);

      // Clean up empty structures
      if (settings.hooks[eventType][matcherIndex].hooks.length === 0) {
        settings.hooks[eventType].splice(matcherIndex, 1);
      }
      if (settings.hooks[eventType].length === 0) {
        delete settings.hooks[eventType];
      }
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }

      // Write back to file
      await fs.promises.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf-8');

      return true;
    } catch (error) {
      console.error('Failed to delete hook:', error);
      vscode.window.showErrorMessage(`Failed to delete hook: ${error}`);
      return false;
    }
  }

  private getSettingsPath(scope: 'global' | 'local'): string | null {
    if (scope === 'global') {
      return path.join(this.globalClaudePath, 'settings.json');
    }

    // local scope
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return null;
    }

    return path.join(workspaceFolder.uri.fsPath, '.claude', 'settings.local.json');
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
}
