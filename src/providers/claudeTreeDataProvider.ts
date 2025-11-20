import * as vscode from 'vscode';
import * as path from 'path';
import { ClaudeFile, ClaudeFileType, McpServer, PermissionRule, HookConfiguration } from '../core/types';
import { FileDiscoveryService } from '../services/fileDiscoveryService';
import { McpService } from '../services/mcpService';
import { PermissionsService } from '../services/permissionsService';
import { HooksService } from '../services/hooksService';
import { DOCUMENTATION_LINKS } from '../core/constants';
import { parseMarkdownSections, MarkdownSection } from '../utils/markdownParser';
import { parseYamlFrontmatter } from '../utils/yamlParser';

export interface SectionInfo {
  filePath: string;
  lineNumber: number;
}

export class ClaudeTreeItem extends vscode.TreeItem {
  public sectionInfo?: SectionInfo;
  public children?: ClaudeTreeItem[];
  public folderPath?: string;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly claudeFile?: ClaudeFile,
    public readonly itemType?: 'file' | 'docLink' | 'action' | 'section' | 'folder'
  ) {
    super(label, collapsibleState);

    if (claudeFile && itemType === 'file') {
      this.description = `[${claudeFile.scopeLabel}]`;

      // Check if this is a SKILL.md file (inside a skill folder)
      const isSkillFile = claudeFile.type === 'skill' &&
                          path.basename(claudeFile.path).toUpperCase() === 'SKILL.MD';

      // Use different context value for SKILL.md files to restrict operations
      this.contextValue = isSkillFile ? 'skillFile' : 'claudeFile';
      this.iconPath = this.getIconForType(claudeFile.type);

      // Make it clickable to open file
      this.command = {
        command: 'ccm.openFile',
        title: 'Open File',
        arguments: [claudeFile.path],
      };

      // Set basic tooltip - will be enhanced by getTreeItem if YAML exists
      this.tooltip = `${claudeFile.path}\n\nScope: ${claudeFile.scopeLabel}`;
    }
  }

  static async enhanceTooltipWithYaml(item: ClaudeTreeItem): Promise<void> {
    if (!item.claudeFile || item.itemType !== 'file') {
      return;
    }

    const ext = path.extname(item.claudeFile.path).toLowerCase();
    if (!['.md', '.markdown'].includes(ext)) {
      return;
    }

    try {
      const frontmatter = await parseYamlFrontmatter(item.claudeFile.path);
      if (frontmatter?.description) {
        // Use MarkdownString for better formatting and long text support
        const tooltip = new vscode.MarkdownString();
        tooltip.supportHtml = false;
        tooltip.isTrusted = true;

        // Add description with word wrapping
        tooltip.appendMarkdown(`**Description:**\n\n${frontmatter.description}\n\n`);
        tooltip.appendMarkdown(`---\n\n`);
        tooltip.appendMarkdown(`**Path:** \`${item.claudeFile.path}\`\n\n`);
        tooltip.appendMarkdown(`**Scope:** ${item.claudeFile.scopeLabel}`);

        item.tooltip = tooltip;
      }
    } catch (error) {
      // Keep basic tooltip on error
    }
  }

  private getIconForType(type: ClaudeFileType): vscode.ThemeIcon {
    const iconMap: Record<ClaudeFileType, string> = {
      memory: 'book',
      command: 'terminal',
      skill: 'lightbulb',
      subAgent: 'hubot',
      mcp: 'plug',
      permission: 'shield',
      settings: 'gear',
    };
    return new vscode.ThemeIcon(iconMap[type] || 'file');
  }

  static createSectionItem(
    section: MarkdownSection,
    filePath: string
  ): ClaudeTreeItem {
    const item = new ClaudeTreeItem(
      section.title,
      vscode.TreeItemCollapsibleState.None,
      undefined,
      'section'
    );

    // Indent based on heading level
    const indent = '  '.repeat(section.level - 1);
    item.label = `${indent}${section.title}`;

    // Set icon based on heading level
    const iconName = section.level === 1 ? 'symbol-class' :
                     section.level === 2 ? 'symbol-method' : 'symbol-field';
    item.iconPath = new vscode.ThemeIcon(iconName);

    item.tooltip = `Line ${section.lineNumber}`;
    item.description = `H${section.level}`;

    // Store section info for navigation
    item.sectionInfo = {
      filePath,
      lineNumber: section.lineNumber,
    };

    // Command to navigate to line
    item.command = {
      command: 'ccm.goToLine',
      title: 'Go to Section',
      arguments: [filePath, section.lineNumber],
    };

    return item;
  }

  static buildTreeFromFiles(files: ClaudeFile[], baseDir: string): ClaudeTreeItem[] {
    const tree: Map<string, ClaudeTreeItem> = new Map();
    const rootItems: ClaudeTreeItem[] = [];

    for (const file of files) {
      // Handle directories differently from files
      if (file.isDirectory) {
        const relativePath = path.relative(baseDir, file.path);

        if (!relativePath || relativePath === '.') {
          continue; // Skip the base directory itself
        }

        const parts = relativePath.split(path.sep);
        let currentPath = '';
        let parentItem: ClaudeTreeItem | null = null;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          currentPath = currentPath ? path.join(currentPath, part) : part;

          if (!tree.has(currentPath)) {
            const isLastPart = i === parts.length - 1;
            const folderClaudeFile: ClaudeFile = isLastPart ? file : {
              name: part,
              path: path.join(baseDir, currentPath),
              scope: file.scope,
              scopeLabel: file.scopeLabel,
              type: file.type,
              isDirectory: true,
              parentType: file.type,
            };

            const folderItem = new ClaudeTreeItem(
              part,
              vscode.TreeItemCollapsibleState.Expanded,
              folderClaudeFile,
              'folder'
            );
            folderItem.folderPath = currentPath;
            folderItem.iconPath = new vscode.ThemeIcon('folder');
            folderItem.contextValue = 'claudeFolder';
            folderItem.children = [];
            tree.set(currentPath, folderItem);

            if (parentItem) {
              parentItem.children!.push(folderItem);
            } else {
              rootItems.push(folderItem);
            }
          }

          parentItem = tree.get(currentPath)!;
        }

        continue;
      }

      // Handle files
      const relativePath = path.relative(baseDir, path.dirname(file.path));

      if (!relativePath || relativePath === '.') {
        // File is directly in the base directory
        const fileItem = new ClaudeTreeItem(
          path.basename(file.name, path.extname(file.name)),
          vscode.TreeItemCollapsibleState.Collapsed,
          file,
          'file'
        );
        rootItems.push(fileItem);
      } else {
        // File is in a subdirectory - build folder structure
        const parts = relativePath.split(path.sep);
        let currentPath = '';
        let parentItem: ClaudeTreeItem | null = null;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          currentPath = currentPath ? path.join(currentPath, part) : part;

          if (!tree.has(currentPath)) {
            // Create a ClaudeFile representation for the folder
            const folderClaudeFile: ClaudeFile = {
              name: part,
              path: path.join(baseDir, currentPath),
              scope: file.scope,
              scopeLabel: file.scopeLabel,
              type: file.type,
              isDirectory: true,
              parentType: file.type,
            };

            const folderItem = new ClaudeTreeItem(
              part,
              vscode.TreeItemCollapsibleState.Expanded,
              folderClaudeFile,
              'folder'
            );
            folderItem.folderPath = currentPath;
            folderItem.iconPath = new vscode.ThemeIcon('folder');
            folderItem.contextValue = 'claudeFolder';
            folderItem.children = [];
            tree.set(currentPath, folderItem);

            if (parentItem) {
              parentItem.children!.push(folderItem);
            } else {
              rootItems.push(folderItem);
            }
          }

          parentItem = tree.get(currentPath)!;
        }

        // Add the file to the deepest folder
        const fileItem = new ClaudeTreeItem(
          path.basename(file.name, path.extname(file.name)),
          vscode.TreeItemCollapsibleState.Collapsed,
          file,
          'file'
        );

        if (parentItem) {
          parentItem.children!.push(fileItem);
        }
      }
    }

    return rootItems;
  }
}

export class MemoriesTreeProvider implements vscode.TreeDataProvider<ClaudeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ClaudeTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ClaudeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ClaudeTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private fileDiscoveryService: FileDiscoveryService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: ClaudeTreeItem): Promise<vscode.TreeItem> {
    await ClaudeTreeItem.enhanceTooltipWithYaml(element);
    return element;
  }

  async getChildren(element?: ClaudeTreeItem): Promise<ClaudeTreeItem[]> {
    // If element is a file (not a folder), return its sections
    if (element && element.claudeFile && element.itemType === 'file') {
      const sections = await parseMarkdownSections(element.claudeFile.path);
      return sections.map((section) =>
        ClaudeTreeItem.createSectionItem(section, element.claudeFile!.path)
      );
    }

    // Root level - return files
    if (!element) {
      const files = await this.fileDiscoveryService.discoverMemories();
      if (files.length === 0) {
        const emptyItem = new ClaudeTreeItem(
          'No CLAUDE.md files found',
          vscode.TreeItemCollapsibleState.None
        );
        emptyItem.description = 'Create CLAUDE.md in project root';
        return [emptyItem];
      }
      return files.map(
        (file) =>
          new ClaudeTreeItem(
            file.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            file,
            'file'
          )
      );
    }

    return [];
  }
}

export class CommandsTreeProvider implements vscode.TreeDataProvider<ClaudeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ClaudeTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ClaudeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ClaudeTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private fileDiscoveryService: FileDiscoveryService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: ClaudeTreeItem): Promise<vscode.TreeItem> {
    await ClaudeTreeItem.enhanceTooltipWithYaml(element);
    return element;
  }

  async getChildren(element?: ClaudeTreeItem): Promise<ClaudeTreeItem[]> {
    // If element is a folder, return its children
    if (element && element.itemType === 'folder' && element.children) {
      return element.children;
    }

    // If element is a file (not a folder), return its sections
    if (element && element.claudeFile && element.itemType === 'file') {
      const sections = await parseMarkdownSections(element.claudeFile.path);
      return sections.map((section) =>
        ClaudeTreeItem.createSectionItem(section, element.claudeFile!.path)
      );
    }

    // Root level - return tree structure
    if (!element) {
      const files = await this.fileDiscoveryService.discoverCommands();
      if (files.length === 0) {
        const emptyItem = new ClaudeTreeItem(
          'No commands found',
          vscode.TreeItemCollapsibleState.None
        );
        emptyItem.description = 'Click + to create';
        return [emptyItem];
      }

      // Group files by global/project
      const globalFiles = files.filter((f) => f.scope === 'global');
      const projectFiles = files.filter((f) => f.scope === 'project');

      const items: ClaudeTreeItem[] = [];

      if (globalFiles.length > 0) {
        const globalDir = this.fileDiscoveryService.getGlobalClaudePath() + '/commands';
        const globalTree = ClaudeTreeItem.buildTreeFromFiles(globalFiles, globalDir);
        items.push(...globalTree);
      }

      if (projectFiles.length > 0) {
        const projectDir = this.fileDiscoveryService.getProjectClaudePath() + '/commands';
        const projectTree = ClaudeTreeItem.buildTreeFromFiles(projectFiles, projectDir);
        items.push(...projectTree);
      }

      return items;
    }

    return [];
  }
}

export class SkillsTreeProvider implements vscode.TreeDataProvider<ClaudeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ClaudeTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ClaudeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ClaudeTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private fileDiscoveryService: FileDiscoveryService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: ClaudeTreeItem): Promise<vscode.TreeItem> {
    await ClaudeTreeItem.enhanceTooltipWithYaml(element);
    return element;
  }

  async getChildren(element?: ClaudeTreeItem): Promise<ClaudeTreeItem[]> {
    // If element is a folder, return its children
    if (element && element.itemType === 'folder' && element.children) {
      return element.children;
    }

    // If element is a file (not a folder), return its sections
    if (element && element.claudeFile && element.itemType === 'file') {
      const sections = await parseMarkdownSections(element.claudeFile.path);
      return sections.map((section) =>
        ClaudeTreeItem.createSectionItem(section, element.claudeFile!.path)
      );
    }

    // Root level - return tree structure
    if (!element) {
      const files = await this.fileDiscoveryService.discoverSkills();
      if (files.length === 0) {
        const emptyItem = new ClaudeTreeItem(
          'No skills found',
          vscode.TreeItemCollapsibleState.None
        );
        emptyItem.description = 'Click + to create';
        return [emptyItem];
      }

      // Group files by global/project
      const globalFiles = files.filter((f) => f.scope === 'global');
      const projectFiles = files.filter((f) => f.scope === 'project');

      const items: ClaudeTreeItem[] = [];

      if (globalFiles.length > 0) {
        const globalDir = this.fileDiscoveryService.getGlobalClaudePath() + '/skills';
        const globalTree = ClaudeTreeItem.buildTreeFromFiles(globalFiles, globalDir);
        items.push(...globalTree);
      }

      if (projectFiles.length > 0) {
        const projectDir = this.fileDiscoveryService.getProjectClaudePath() + '/skills';
        const projectTree = ClaudeTreeItem.buildTreeFromFiles(projectFiles, projectDir);
        items.push(...projectTree);
      }

      return items;
    }

    return [];
  }
}

export class SubAgentsTreeProvider implements vscode.TreeDataProvider<ClaudeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ClaudeTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ClaudeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ClaudeTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private fileDiscoveryService: FileDiscoveryService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: ClaudeTreeItem): Promise<vscode.TreeItem> {
    await ClaudeTreeItem.enhanceTooltipWithYaml(element);
    return element;
  }

  async getChildren(element?: ClaudeTreeItem): Promise<ClaudeTreeItem[]> {
    // If element is a folder, return its children
    if (element && element.itemType === 'folder' && element.children) {
      return element.children;
    }

    // If element is a file (not a folder), return its sections
    if (element && element.claudeFile && element.itemType === 'file') {
      const sections = await parseMarkdownSections(element.claudeFile.path);
      return sections.map((section) =>
        ClaudeTreeItem.createSectionItem(section, element.claudeFile!.path)
      );
    }

    // Root level - return tree structure
    if (!element) {
      const files = await this.fileDiscoveryService.discoverSubAgents();
      if (files.length === 0) {
        const emptyItem = new ClaudeTreeItem(
          'No sub-agents found',
          vscode.TreeItemCollapsibleState.None
        );
        emptyItem.description = 'Click + to create';
        return [emptyItem];
      }

      // Group files by global/project
      const globalFiles = files.filter((f) => f.scope === 'global');
      const projectFiles = files.filter((f) => f.scope === 'project');

      const items: ClaudeTreeItem[] = [];

      if (globalFiles.length > 0) {
        const globalDir = this.fileDiscoveryService.getGlobalClaudePath() + '/agents';
        const globalTree = ClaudeTreeItem.buildTreeFromFiles(globalFiles, globalDir);
        items.push(...globalTree);
      }

      if (projectFiles.length > 0) {
        const projectDir = this.fileDiscoveryService.getProjectClaudePath() + '/agents';
        const projectTree = ClaudeTreeItem.buildTreeFromFiles(projectFiles, projectDir);
        items.push(...projectTree);
      }

      return items;
    }

    return [];
  }
}

export class McpServersTreeProvider implements vscode.TreeDataProvider<ClaudeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ClaudeTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ClaudeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ClaudeTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private mcpService: McpService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: ClaudeTreeItem): Promise<vscode.TreeItem> {
    await ClaudeTreeItem.enhanceTooltipWithYaml(element);
    return element;
  }

  async getChildren(element?: ClaudeTreeItem): Promise<ClaudeTreeItem[]> {
    if (element) {
      return [];
    }

    const servers = await this.mcpService.discoverMcpServers();
    if (servers.length === 0) {
      const emptyItem = new ClaudeTreeItem(
        'No MCP servers configured',
        vscode.TreeItemCollapsibleState.None
      );
      emptyItem.description = 'See documentation';
      return [emptyItem];
    }

    return servers.map((server) => {
      const item = new ClaudeTreeItem(
        server.name,
        vscode.TreeItemCollapsibleState.None
      );

      // Display type and location in description
      item.description = `[${server.location}] ${server.type}`;

      // Create tooltip with detailed info
      let tooltip = `Name: ${server.name}\n`;
      tooltip += `Type: ${server.type}\n`;
      tooltip += `Location: ${server.location}\n`;
      tooltip += `Config: ${server.configPath}\n`;
      if (server.url) {
        tooltip += `URL: ${server.url}\n`;
      }
      if (server.command) {
        tooltip += `Command: ${server.command}\n`;
      }
      item.tooltip = tooltip;

      // Set icon based on type
      const iconMap: Record<string, string> = {
        http: 'cloud',
        stdio: 'terminal',
        sse: 'broadcast',
      };
      item.iconPath = new vscode.ThemeIcon(iconMap[server.type] || 'plug');

      // Context value for menu items
      item.contextValue = 'mcpServer';

      // Command to view config
      item.command = {
        command: 'ccm.viewMcpConfig',
        title: 'View MCP Configuration',
        arguments: [server.configPath],
      };

      return item;
    });
  }
}

export class PermissionsTreeProvider implements vscode.TreeDataProvider<ClaudeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ClaudeTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ClaudeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ClaudeTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private permissionsService: PermissionsService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: ClaudeTreeItem): Promise<vscode.TreeItem> {
    await ClaudeTreeItem.enhanceTooltipWithYaml(element);
    return element;
  }

  async getChildren(element?: ClaudeTreeItem): Promise<ClaudeTreeItem[]> {
    // If element has children (permission type headers or tool groups), return them
    if (element && element.children) {
      return element.children;
    }

    // Root level - return permission type groups
    if (!element) {
      const rules = await this.permissionsService.discoverPermissions();
      if (rules.length === 0) {
        const emptyItem = new ClaudeTreeItem(
          'No permissions configured',
          vscode.TreeItemCollapsibleState.None
        );
        emptyItem.description = 'See documentation';
        return [emptyItem];
      }

      // Group rules by type
      const allowRules = rules.filter((r) => r.type === 'allow');
      const askRules = rules.filter((r) => r.type === 'ask');
      const denyRules = rules.filter((r) => r.type === 'deny');

      const items: ClaudeTreeItem[] = [];

      // Add Allow section with tool grouping
      if (allowRules.length > 0) {
        const allowHeader = new ClaudeTreeItem(
          `Allow (${allowRules.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        allowHeader.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
        allowHeader.children = this.groupRulesByTool(allowRules);
        items.push(allowHeader);
      }

      // Add Ask section with tool grouping
      if (askRules.length > 0) {
        const askHeader = new ClaudeTreeItem(
          `Ask (${askRules.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        askHeader.iconPath = new vscode.ThemeIcon('question', new vscode.ThemeColor('testing.iconQueued'));
        askHeader.children = this.groupRulesByTool(askRules);
        items.push(askHeader);
      }

      // Add Deny section with tool grouping
      if (denyRules.length > 0) {
        const denyHeader = new ClaudeTreeItem(
          `Deny (${denyRules.length})`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        denyHeader.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
        denyHeader.children = this.groupRulesByTool(denyRules);
        items.push(denyHeader);
      }

      return items;
    }

    return [];
  }

  private groupRulesByTool(rules: PermissionRule[]): ClaudeTreeItem[] {
    // Group rules by tool type
    const toolGroups = new Map<string, PermissionRule[]>();

    for (const rule of rules) {
      if (!toolGroups.has(rule.tool)) {
        toolGroups.set(rule.tool, []);
      }
      toolGroups.get(rule.tool)!.push(rule);
    }

    // Create tool group items
    const toolItems: ClaudeTreeItem[] = [];

    for (const [tool, toolRules] of toolGroups.entries()) {
      const toolItem = new ClaudeTreeItem(
        `${tool} (${toolRules.length})`,
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        'folder'
      );

      // Set icon based on tool type
      const toolIcons: Record<string, string> = {
        Read: 'file',
        Edit: 'edit',
        Write: 'new-file',
        Bash: 'terminal',
        WebFetch: 'globe',
        Task: 'play',
        Grep: 'search',
        Glob: 'files',
      };
      toolItem.iconPath = new vscode.ThemeIcon(toolIcons[tool] || 'circle-outline');

      // Add children (individual permission rules)
      toolItem.children = toolRules.map(rule => this.createPermissionItem(rule));

      toolItems.push(toolItem);
    }

    // Sort tool groups alphabetically
    return toolItems.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
  }

  private createPermissionItem(rule: PermissionRule): ClaudeTreeItem {
    // Just show the pattern since tool is shown in the parent group
    const label = rule.pattern;
    const item = new ClaudeTreeItem(label, vscode.TreeItemCollapsibleState.None);

    item.description = rule.location;
    item.tooltip = `Tool: ${rule.tool}\nPattern: ${rule.pattern}\nLocation: ${rule.location}\nConfig: ${rule.configPath}`;

    // Use a simple icon for individual permission rules
    item.iconPath = new vscode.ThemeIcon('circle-outline');

    // Context value for menu items
    item.contextValue = 'permissionRule';

    // Command to open settings file
    item.command = {
      command: 'ccm.openSettingsFile',
      title: 'Open Settings File',
      arguments: [rule.configPath],
    };

    return item;
  }
}

export class HooksTreeProvider implements vscode.TreeDataProvider<ClaudeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ClaudeTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ClaudeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ClaudeTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private hooksService: HooksService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: ClaudeTreeItem): Promise<vscode.TreeItem> {
    await ClaudeTreeItem.enhanceTooltipWithYaml(element);
    return element;
  }

  async getChildren(element?: ClaudeTreeItem): Promise<ClaudeTreeItem[]> {
    // If element has children, return them
    if (element && element.children) {
      return element.children;
    }

    // Root level - return location groups
    if (!element) {
      const hookConfigs = await this.hooksService.discoverHooks();
      if (hookConfigs.length === 0) {
        const emptyItem = new ClaudeTreeItem(
          'No hooks configured',
          vscode.TreeItemCollapsibleState.None
        );
        emptyItem.description = 'See documentation';
        return [emptyItem];
      }

      // Group hooks by location
      const groupedByLocation: Map<string, HookConfiguration[]> = new Map();
      for (const config of hookConfigs) {
        if (!groupedByLocation.has(config.location)) {
          groupedByLocation.set(config.location, []);
        }
        groupedByLocation.get(config.location)!.push(config);
      }

      const items: ClaudeTreeItem[] = [];

      // Create items for each location
      for (const [location, configs] of groupedByLocation) {
        const locationHeader = new ClaudeTreeItem(
          `${location} [${this.countHooks(configs)} hooks]`,
          vscode.TreeItemCollapsibleState.Expanded
        );
        locationHeader.iconPath = new vscode.ThemeIcon(
          location.includes('User') ? 'home' : location.includes('Project') ? 'root-folder' : 'file'
        );

        // Group by event type within this location
        const groupedByEvent: Map<string, HookConfiguration[]> = new Map();
        for (const config of configs) {
          if (!groupedByEvent.has(config.eventType)) {
            groupedByEvent.set(config.eventType, []);
          }
          groupedByEvent.get(config.eventType)!.push(config);
        }

        // Create event type children
        locationHeader.children = [];
        for (const [eventType, eventConfigs] of groupedByEvent) {
          const eventHeader = new ClaudeTreeItem(
            `${eventType} [${this.countHooks(eventConfigs)} hooks]`,
            vscode.TreeItemCollapsibleState.Expanded
          );
          eventHeader.iconPath = new vscode.ThemeIcon(this.getEventIcon(eventType));

          // Group by matcher within this event type
          eventHeader.children = [];
          for (const config of eventConfigs) {
            for (const matcher of config.matchers) {
              const matcherLabel = matcher.matcher || '*';
              const matcherItem = new ClaudeTreeItem(
                `Matcher: "${matcherLabel}" [${matcher.hooks.length} hooks]`,
                vscode.TreeItemCollapsibleState.Expanded
              );
              matcherItem.iconPath = new vscode.ThemeIcon('filter');

              // Create individual hook items
              matcherItem.children = matcher.hooks.map((hook, hookIndex) =>
                this.createHookItem(hook, hookIndex, config, matcher, eventConfigs.indexOf(config))
              );

              eventHeader.children.push(matcherItem);
            }
          }

          locationHeader.children.push(eventHeader);
        }

        items.push(locationHeader);
      }

      return items;
    }

    return [];
  }

  private countHooks(configs: HookConfiguration[]): number {
    let count = 0;
    for (const config of configs) {
      for (const matcher of config.matchers) {
        count += matcher.hooks.length;
      }
    }
    return count;
  }

  private getEventIcon(eventType: string): string {
    const iconMap: Record<string, string> = {
      PreToolUse: 'debug-start',
      PostToolUse: 'debug-stop',
      PermissionRequest: 'shield',
      UserPromptSubmit: 'comment-discussion',
      Stop: 'stop-circle',
      SubagentStop: 'debug-pause',
      SessionStart: 'play-circle',
      SessionEnd: 'close',
      Notification: 'bell',
      PreCompact: 'archive',
    };
    return iconMap[eventType] || 'debug-breakpoint-conditional';
  }

  private createHookItem(
    hook: any,
    hookIndex: number,
    config: HookConfiguration,
    matcher: HookMatcher,
    matcherIndex: number
  ): ClaudeTreeItem {
    const hookType = hook.type === 'command' ? 'Command' : 'Prompt';

    // Create a preview of the command/prompt
    let preview = '';
    if (hook.command) {
      preview = hook.command.length > 50
        ? hook.command.substring(0, 50) + '...'
        : hook.command;
    } else if (hook.prompt) {
      preview = hook.prompt.length > 50
        ? hook.prompt.substring(0, 50) + '...'
        : hook.prompt;
    }

    const label = `${hookType}: ${preview}`;
    const item = new ClaudeTreeItem(label, vscode.TreeItemCollapsibleState.None);

    // Show timeout in description if set
    if (hook.timeout) {
      item.description = `${hook.timeout}s timeout`;
    }

    // Create detailed tooltip
    let tooltip = `Type: ${hook.type}\n`;
    tooltip += `Event: ${config.eventType}\n`;
    tooltip += `Matcher: ${matcher.matcher || '*'}\n`;
    if (hook.command) {
      tooltip += `Command: ${hook.command}\n`;
    }
    if (hook.prompt) {
      tooltip += `Prompt: ${hook.prompt}\n`;
    }
    if (hook.timeout) {
      tooltip += `Timeout: ${hook.timeout}s\n`;
    }
    tooltip += `Location: ${config.location}\n`;
    tooltip += `Config: ${config.configPath}`;
    item.tooltip = tooltip;

    // Set icon based on hook type
    item.iconPath = new vscode.ThemeIcon(
      hook.type === 'command' ? 'terminal' : 'comment'
    );

    // Store metadata for commands
    (item as any).hookData = {
      configPath: config.configPath,
      eventType: config.eventType,
      matcherIndex,
      hookIndex,
      hook,
    };

    // Context value for menu items
    item.contextValue = 'hook';

    // Command to open settings file
    item.command = {
      command: 'ccm.openSettingsFile',
      title: 'Open Settings File',
      arguments: [config.configPath],
    };

    return item;
  }
}

export class DocumentationTreeProvider implements vscode.TreeDataProvider<ClaudeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ClaudeTreeItem | undefined | null | void> =
    new vscode.EventEmitter<ClaudeTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ClaudeTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getTreeItem(element: ClaudeTreeItem): Promise<vscode.TreeItem> {
    await ClaudeTreeItem.enhanceTooltipWithYaml(element);
    return element;
  }

  async getChildren(element?: ClaudeTreeItem): Promise<ClaudeTreeItem[]> {
    if (element) {
      return [];
    }

    return DOCUMENTATION_LINKS.map((link) => {
      const item = new ClaudeTreeItem(link.title, vscode.TreeItemCollapsibleState.None);
      item.tooltip = link.description;
      item.description = link.description;
      item.iconPath = new vscode.ThemeIcon(link.icon);
      item.command = {
        command: 'vscode.open',
        title: 'Open Documentation',
        arguments: [vscode.Uri.parse(link.url)],
      };
      return item;
    });
  }
}
