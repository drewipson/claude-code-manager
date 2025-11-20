import * as os from 'os';
import * as path from 'path';
import { DocumentationLink } from './types';

export const EXTENSION_ID = 'claude-code-manager';
export const EXTENSION_NAME = 'Claude Code Manager';

// Default paths
export const DEFAULT_GLOBAL_CLAUDE_PATH = path.join(os.homedir(), '.claude');

// File patterns
export const CLAUDE_MD_PATTERNS = ['CLAUDE.md', 'claude.md'];
export const SKILLS_DIR = 'skills';
export const AGENTS_DIR = 'agents';
export const MCP_DIR = 'mcp-servers';
export const COMMANDS_DIR = 'commands';

// File extensions
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];
export const JSON_EXTENSIONS = ['.json', '.jsonc'];

// View IDs
export const VIEW_IDS = {
  memories: 'ccm.memories',
  commands: 'ccm.commands',
  skills: 'ccm.skills',
  subAgents: 'ccm.subAgents',
  mcpServers: 'ccm.mcpServers',
  permissions: 'ccm.permissions',
  hooks: 'ccm.hooks',
  documentation: 'ccm.documentation',
};

// Command IDs
export const COMMAND_IDS = {
  refresh: 'ccm.refresh',
  openFile: 'ccm.openFile',
  moveToGlobal: 'ccm.moveToGlobal',
  moveToProject: 'ccm.moveToProject',
  revealInFinder: 'ccm.revealInFinder',
  copyPath: 'ccm.copyPath',
  deleteFile: 'ccm.deleteFile',
  renameFile: 'ccm.renameFile',
  createFolder: 'ccm.createFolder',
  createCommandFolder: 'ccm.createCommandFolder',
  createSubAgentFolder: 'ccm.createSubAgentFolder',
  createCommandInFolder: 'ccm.createCommandInFolder',
  createSkillInFolder: 'ccm.createSkillInFolder',
  createSubAgentInFolder: 'ccm.createSubAgentInFolder',
  openDocs: 'ccm.openDocs',
  createMemoryFromTemplate: 'ccm.createMemoryFromTemplate',
  createCommand: 'ccm.createCommand',
  createSkill: 'ccm.createSkill',
  createSubAgent: 'ccm.createSubAgent',
  openSettingsFile: 'ccm.openSettingsFile',
  viewMcpConfig: 'ccm.viewMcpConfig',
  createHook: 'ccm.createHook',
  editHook: 'ccm.editHook',
  deleteHook: 'ccm.deleteHook',
  duplicateHook: 'ccm.duplicateHook',
  copyHookJson: 'ccm.copyHookJson',
};

// Documentation links
export const DOCUMENTATION_LINKS: DocumentationLink[] = [
  {
    title: 'Getting Started',
    url: 'https://code.claude.com/docs/en/overview',
    description: 'Learn the basics of Claude Code',
    icon: 'rocket',
  },
  {
    title: 'Memory Guide',
    url: 'https://code.claude.com/docs/en/memory',
    description: 'Writing effective CLAUDE.md files',
    icon: 'file-text',
  },
  {
    title: 'Sub-Agents',
    url: 'https://code.claude.com/docs/en/sub-agents',
    description: 'Create specialized task agents',
    icon: 'hubot',
  },
  {
    title: 'MCP Servers',
    url: 'https://code.claude.com/docs/en/mcp',
    description: 'Model Context Protocol setup',
    icon: 'plug',
  },
  {
    title: 'Settings',
    url: 'https://code.claude.com/docs/en/settings',
    description: 'Configure permissions and options',
    icon: 'gear',
  },
];

// Icons for tree items
export const ICONS = {
  context: 'file-text',
  memory: 'brain',
  command: 'terminal',
  skill: 'lightbulb',
  subAgent: 'robot',
  mcp: 'plug',
  permission: 'shield',
  settings: 'gear',
  folder: 'folder',
  global: 'globe',
  project: 'root-folder',
  nested: 'folder-library',
};

// Hook-related constants
export const HOOK_EVENT_TYPES = [
  'PreToolUse',
  'PostToolUse',
  'PermissionRequest',
  'UserPromptSubmit',
  'Stop',
  'SubagentStop',
  'SessionStart',
  'SessionEnd',
  'Notification',
  'PreCompact',
] as const;

export const HOOK_EVENT_DESCRIPTIONS: Record<string, string> = {
  PreToolUse: 'Before tool execution - validate or modify tool parameters',
  PostToolUse: 'After tool execution - process results or trigger follow-up actions',
  PermissionRequest: 'When permission dialog appears - auto-approve or deny requests',
  UserPromptSubmit: 'When user submits prompt - validate input or add context',
  Stop: 'When main agent finishes - review output or trigger cleanup',
  SubagentStop: 'When subagent finishes - process results or log completion',
  SessionStart: 'Session initialization - setup environment or load config',
  SessionEnd: 'Session termination - cleanup resources or save state',
  Notification: 'Respond to notifications - filter or act on system messages',
  PreCompact: 'Before context compaction - preserve critical information',
};

export const TOOL_TYPES = [
  'Read',
  'Edit',
  'Write',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'Task',
  'mcp__*',
] as const;

export const DEFAULT_HOOK_TIMEOUT = 60;
