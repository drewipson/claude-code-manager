import * as vscode from 'vscode';

export type LocationScope = 'global' | 'project' | 'nested';

export interface ClaudeFile {
  name: string;
  path: string;
  scope: LocationScope;
  scopeLabel: string;
  type: ClaudeFileType;
  isDirectory?: boolean;
  parentType?: ClaudeFileType; // For folders, indicates what type of files they contain
}

export type ClaudeFileType =
  | 'memory'       // CLAUDE.md files (memories)
  | 'command'      // Slash command files
  | 'skill'        // Skill files (SKILL.md)
  | 'subAgent'     // Sub-agent files
  | 'mcp'          // MCP server configs
  | 'permission'   // Permission files
  | 'settings';    // Settings files

export interface ClaudeTreeItem extends vscode.TreeItem {
  claudeFile?: ClaudeFile;
  children?: ClaudeTreeItem[];
}

export interface UsageSession {
  id: string;
  startTime: Date;
  endTime: Date;
  tokens: TokenBreakdown;
  cost: number;
  model: string;
}

export interface TokenBreakdown {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  total: number;
}

export interface UsageData {
  sessions: UsageSession[];
  totalTokens: TokenBreakdown;
  totalCost: number;
  byModel: Record<string, { tokens: number; cost: number }>;
  byDay: Record<string, { tokens: number; cost: number }>;
}

export interface DocumentationLink {
  title: string;
  url: string;
  description: string;
  icon: string;
}

export interface McpServer {
  name: string;
  type: 'http' | 'stdio' | 'sse';
  location: 'User' | 'Project' | 'Managed';
  configPath: string;
  url?: string;
  command?: string;
  args?: string[];
}

export interface PermissionRule {
  type: 'allow' | 'ask' | 'deny';
  tool: string;
  pattern: string;
  location: string; // Which settings file it's from
  configPath: string;
}

export type HookEventType =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PermissionRequest'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'SubagentStop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreCompact';

export interface Hook {
  type: 'command' | 'prompt';
  command?: string;
  prompt?: string;
  timeout?: number;
}

export interface HookMatcher {
  matcher?: string;
  hooks: Hook[];
}

export interface HookConfiguration {
  eventType: HookEventType;
  matchers: HookMatcher[];
  location: string; // Which settings file it's from
  configPath: string;
}
