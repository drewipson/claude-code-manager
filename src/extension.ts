import * as vscode from 'vscode';
import * as path from 'path';
import { FileDiscoveryService } from './services/fileDiscoveryService';
import { FileOperationsService } from './services/fileOperationsService';
import { McpService } from './services/mcpService';
import { PermissionsService } from './services/permissionsService';
import { HooksService } from './services/hooksService';
import {
  MemoriesTreeProvider,
  CommandsTreeProvider,
  SkillsTreeProvider,
  SubAgentsTreeProvider,
  McpServersTreeProvider,
  PermissionsTreeProvider,
  HooksTreeProvider,
  DocumentationTreeProvider,
  ClaudeTreeItem,
} from './providers/claudeTreeDataProvider';
import { COMMAND_IDS, VIEW_IDS } from './core/constants';

let fileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Code Manager is now active!');

  // Initialize services
  const fileDiscoveryService = new FileDiscoveryService();
  const fileOperationsService = new FileOperationsService(fileDiscoveryService);
  const mcpService = new McpService();
  const permissionsService = new PermissionsService();
  const hooksService = new HooksService();

  // Initialize tree providers
  const memoriesProvider = new MemoriesTreeProvider(fileDiscoveryService);
  const commandsProvider = new CommandsTreeProvider(fileDiscoveryService);
  const skillsProvider = new SkillsTreeProvider(fileDiscoveryService);
  const subAgentsProvider = new SubAgentsTreeProvider(fileDiscoveryService);
  const mcpServersProvider = new McpServersTreeProvider(mcpService);
  const permissionsProvider = new PermissionsTreeProvider(permissionsService);
  const hooksProvider = new HooksTreeProvider(hooksService);
  const documentationProvider = new DocumentationTreeProvider();

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(VIEW_IDS.memories, memoriesProvider),
    vscode.window.registerTreeDataProvider(VIEW_IDS.commands, commandsProvider),
    vscode.window.registerTreeDataProvider(VIEW_IDS.skills, skillsProvider),
    vscode.window.registerTreeDataProvider(VIEW_IDS.subAgents, subAgentsProvider),
    vscode.window.registerTreeDataProvider(VIEW_IDS.mcpServers, mcpServersProvider),
    vscode.window.registerTreeDataProvider(VIEW_IDS.permissions, permissionsProvider),
    vscode.window.registerTreeDataProvider(VIEW_IDS.hooks, hooksProvider),
    vscode.window.registerTreeDataProvider(VIEW_IDS.documentation, documentationProvider)
  );

  // Helper function to refresh all providers
  const refreshAll = () => {
    memoriesProvider.refresh();
    commandsProvider.refresh();
    skillsProvider.refresh();
    subAgentsProvider.refresh();
    mcpServersProvider.refresh();
    permissionsProvider.refresh();
    hooksProvider.refresh();
  };

  // Register commands
  context.subscriptions.push(
    // Refresh command
    vscode.commands.registerCommand(COMMAND_IDS.refresh, () => {
      refreshAll();
      vscode.window.showInformationMessage('Claude Code Manager refreshed.');
    }),

    // Open file command
    vscode.commands.registerCommand(COMMAND_IDS.openFile, async (filePath: string) => {
      if (filePath) {
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);
      }
    }),

    // Go to line command (for section navigation)
    vscode.commands.registerCommand('ccm.goToLine', async (filePath: string, lineNumber: number) => {
      if (filePath && lineNumber) {
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);

        // Go to the specific line (0-based index)
        const position = new vscode.Position(lineNumber - 1, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    }),

    // Move to global command
    vscode.commands.registerCommand(COMMAND_IDS.moveToGlobal, async (item: ClaudeTreeItem) => {
      if (item?.claudeFile) {
        const success = await fileOperationsService.moveToGlobal(item.claudeFile);
        if (success) {
          refreshAll();
        }
      }
    }),

    // Move to project command
    vscode.commands.registerCommand(COMMAND_IDS.moveToProject, async (item: ClaudeTreeItem) => {
      if (item?.claudeFile) {
        const success = await fileOperationsService.moveToProject(item.claudeFile);
        if (success) {
          refreshAll();
        }
      }
    }),

    // Reveal in Finder command
    vscode.commands.registerCommand(COMMAND_IDS.revealInFinder, async (item: ClaudeTreeItem) => {
      if (item?.claudeFile) {
        await fileOperationsService.revealInFinder(item.claudeFile.path);
      }
    }),

    // Copy path command
    vscode.commands.registerCommand(COMMAND_IDS.copyPath, async (item: ClaudeTreeItem) => {
      if (item?.claudeFile) {
        await fileOperationsService.copyPath(item.claudeFile.path);
      }
    }),

    // Delete file command
    vscode.commands.registerCommand(COMMAND_IDS.deleteFile, async (item: ClaudeTreeItem) => {
      if (item?.claudeFile) {
        const success = await fileOperationsService.deleteFile(item.claudeFile);
        if (success) {
          refreshAll();
        }
      }
    }),

    // Rename file command
    vscode.commands.registerCommand(COMMAND_IDS.renameFile, async (item: ClaudeTreeItem) => {
      if (item?.claudeFile) {
        const success = await fileOperationsService.renameFile(item.claudeFile);
        if (success) {
          refreshAll();
        }
      }
    }),

    // Create command folder
    vscode.commands.registerCommand(COMMAND_IDS.createCommandFolder, async () => {
      const scope = await vscode.window.showQuickPick(['Global', 'Project'], {
        placeHolder: 'Select scope for new command folder',
      });

      if (!scope) {
        return;
      }

      const folderPath = await fileOperationsService.createFolder(
        'command',
        scope.toLowerCase() as 'global' | 'project'
      );

      if (folderPath) {
        refreshAll();
      }
    }),

    // Create sub-agent folder
    vscode.commands.registerCommand(COMMAND_IDS.createSubAgentFolder, async () => {
      const scope = await vscode.window.showQuickPick(['Global', 'Project'], {
        placeHolder: 'Select scope for new sub-agent folder',
      });

      if (!scope) {
        return;
      }

      const folderPath = await fileOperationsService.createFolder(
        'subAgent',
        scope.toLowerCase() as 'global' | 'project'
      );

      if (folderPath) {
        refreshAll();
      }
    }),

    // Open docs command
    vscode.commands.registerCommand(COMMAND_IDS.openDocs, () => {
      vscode.env.openExternal(
        vscode.Uri.parse('https://docs.anthropic.com/en/docs/claude-code/overview')
      );
    }),

    // Create command command
    vscode.commands.registerCommand(COMMAND_IDS.createCommand, async () => {
      const scope = await vscode.window.showQuickPick(['Global', 'Project'], {
        placeHolder: 'Select scope for new command',
      });

      if (!scope) {
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter command name',
        placeHolder: 'my-command',
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Name cannot be empty';
          }
          if (!/^[\w-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, underscores, and hyphens';
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      const fileName = name.endsWith('.md') ? name : `${name}.md`;

      // Read template
      const templatePath = vscode.Uri.joinPath(
        context.extensionUri,
        'resources',
        'templates',
        'command.md.template'
      );

      try {
        const templateContent = await vscode.workspace.fs.readFile(templatePath);
        const template = Buffer.from(templateContent).toString('utf-8');

        const filePath = await fileOperationsService.createFile(
          'command',
          scope.toLowerCase() as 'global' | 'project',
          fileName,
          template
        );

        if (filePath) {
          const document = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(document);
          refreshAll();
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to create command: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

    // Create skill command
    vscode.commands.registerCommand(COMMAND_IDS.createSkill, async () => {
      const scope = await vscode.window.showQuickPick(['Global', 'Project'], {
        placeHolder: 'Select scope for new skill',
      });

      if (!scope) {
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter skill name',
        placeHolder: 'my-skill',
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Name cannot be empty';
          }
          if (!/^[\w-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, underscores, and hyphens';
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      const fileName = name.endsWith('.md') ? 'SKILL.md' : `SKILL.md`;

      // Read template
      const templatePath = vscode.Uri.joinPath(
        context.extensionUri,
        'resources',
        'templates',
        'SKILL.md.template'
      );

      try {
        const templateContent = await vscode.workspace.fs.readFile(templatePath);
        let template = Buffer.from(templateContent).toString('utf-8');

        // Replace skill name placeholder in template
        template = template.replace(/skill-name-lowercase-with-hyphens/g, name);
        template = template.replace(/Skill Name/g, name);

        const filePath = await fileOperationsService.createFile(
          'skill',
          scope.toLowerCase() as 'global' | 'project',
          path.join(name, fileName), // Create subdirectory for skill
          template
        );

        if (filePath) {
          const document = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(document);
          refreshAll();
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to create skill: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

    // Create sub-agent command
    vscode.commands.registerCommand(COMMAND_IDS.createSubAgent, async () => {
      const scope = await vscode.window.showQuickPick(['Global', 'Project'], {
        placeHolder: 'Select scope for new sub-agent',
      });

      if (!scope) {
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter sub-agent name',
        placeHolder: 'my-agent',
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Name cannot be empty';
          }
          if (!/^[\w-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, underscores, and hyphens';
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      const fileName = name.endsWith('.md') ? name : `${name}.md`;
      const template = `# ${name}\n\n## Role\nDescribe the role of this sub-agent.\n\n## Capabilities\n- Capability 1\n- Capability 2\n\n## Instructions\nProvide specific instructions for this sub-agent.\n`;

      const filePath = await fileOperationsService.createFile(
        'subAgent',
        scope.toLowerCase() as 'global' | 'project',
        fileName,
        template
      );

      if (filePath) {
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);
        refreshAll();
      }
    }),

    // Create command in folder
    vscode.commands.registerCommand(COMMAND_IDS.createCommandInFolder, async (item: ClaudeTreeItem) => {
      if (!item?.claudeFile?.isDirectory) {
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter command name',
        placeHolder: 'my-command',
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Name cannot be empty';
          }
          if (!/^[\w-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, underscores, and hyphens';
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      const fileName = name.endsWith('.md') ? name : `${name}.md`;

      const templatePath = vscode.Uri.joinPath(
        context.extensionUri,
        'resources',
        'templates',
        'command.md.template'
      );

      try {
        const templateContent = await vscode.workspace.fs.readFile(templatePath);
        const template = Buffer.from(templateContent).toString('utf-8');

        const filePath = await fileOperationsService.createFile(
          'command',
          item.claudeFile.scope as 'global' | 'project',
          fileName,
          template,
          path.basename(item.claudeFile.path)
        );

        if (filePath) {
          const document = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(document);
          refreshAll();
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to create command: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

    // Create skill in folder
    vscode.commands.registerCommand(COMMAND_IDS.createSkillInFolder, async (item: ClaudeTreeItem) => {
      if (!item?.claudeFile?.isDirectory) {
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter skill name',
        placeHolder: 'my-skill',
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Name cannot be empty';
          }
          if (!/^[\w-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, underscores, and hyphens';
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      const fileName = 'SKILL.md';

      const templatePath = vscode.Uri.joinPath(
        context.extensionUri,
        'resources',
        'templates',
        'SKILL.md.template'
      );

      try {
        const templateContent = await vscode.workspace.fs.readFile(templatePath);
        let template = Buffer.from(templateContent).toString('utf-8');

        template = template.replace(/skill-name-lowercase-with-hyphens/g, name);
        template = template.replace(/Skill Name/g, name);

        const parentFolder = path.basename(item.claudeFile.path);
        const skillPath = path.join(name, fileName);

        const filePath = await fileOperationsService.createFile(
          'skill',
          item.claudeFile.scope as 'global' | 'project',
          skillPath,
          template,
          parentFolder
        );

        if (filePath) {
          const document = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(document);
          refreshAll();
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to create skill: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

    // Create sub-agent in folder
    vscode.commands.registerCommand(COMMAND_IDS.createSubAgentInFolder, async (item: ClaudeTreeItem) => {
      if (!item?.claudeFile?.isDirectory) {
        return;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter sub-agent name',
        placeHolder: 'my-agent',
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Name cannot be empty';
          }
          if (!/^[\w-]+$/.test(value)) {
            return 'Name can only contain letters, numbers, underscores, and hyphens';
          }
          return null;
        },
      });

      if (!name) {
        return;
      }

      const fileName = name.endsWith('.md') ? name : `${name}.md`;
      const template = `# ${name}\n\n## Role\nDescribe the role of this sub-agent.\n\n## Capabilities\n- Capability 1\n- Capability 2\n\n## Instructions\nProvide specific instructions for this sub-agent.\n`;

      const filePath = await fileOperationsService.createFile(
        'subAgent',
        item.claudeFile.scope as 'global' | 'project',
        fileName,
        template,
        path.basename(item.claudeFile.path)
      );

      if (filePath) {
        const document = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(document);
        refreshAll();
      }
    }),

    // Create CLAUDE.md from template command
    vscode.commands.registerCommand(COMMAND_IDS.createMemoryFromTemplate, async () => {
      const location = await vscode.window.showQuickPick(
        [
          { label: 'Project Root', description: 'Create in current workspace root' },
          { label: 'Global', description: 'Create in ~/.claude/' },
        ],
        { placeHolder: 'Where do you want to create CLAUDE.md?' }
      );

      if (!location) {
        return;
      }

      let targetPath: string;

      if (location.label === 'Project Root') {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder open.');
          return;
        }
        targetPath = vscode.Uri.joinPath(workspaceFolder.uri, 'CLAUDE.md').fsPath;
      } else {
        targetPath = vscode.Uri.joinPath(
          vscode.Uri.file(fileDiscoveryService.getGlobalClaudePath()),
          'CLAUDE.md'
        ).fsPath;
      }

      // Check if file already exists
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
        const overwrite = await vscode.window.showWarningMessage(
          'CLAUDE.md already exists at this location. Overwrite?',
          'Overwrite',
          'Cancel'
        );
        if (overwrite !== 'Overwrite') {
          return;
        }
      } catch {
        // File doesn't exist, continue
      }

      // Read template
      const templatePath = vscode.Uri.joinPath(
        context.extensionUri,
        'resources',
        'templates',
        'CLAUDE.md.template'
      );

      try {
        const templateContent = await vscode.workspace.fs.readFile(templatePath);
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(targetPath),
          templateContent
        );

        const document = await vscode.workspace.openTextDocument(targetPath);
        await vscode.window.showTextDocument(document);
        refreshAll();

        vscode.window.showInformationMessage(
          `Created CLAUDE.md at ${location.label}. Customize it for your project!`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to create CLAUDE.md: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }),

    // Open settings file command
    vscode.commands.registerCommand(COMMAND_IDS.openSettingsFile, async (filePath: string) => {
      if (filePath) {
        try {
          const document = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(document);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open settings file: ${error}`);
        }
      }
    }),

    // View MCP config command
    vscode.commands.registerCommand(COMMAND_IDS.viewMcpConfig, async (filePath: string) => {
      if (filePath) {
        try {
          const document = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(document);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open MCP config: ${error}`);
        }
      }
    }),

    // Create hook command - multi-step wizard
    vscode.commands.registerCommand(COMMAND_IDS.createHook, async () => {
      try {
        // Import constants
        const { HOOK_EVENT_TYPES, HOOK_EVENT_DESCRIPTIONS, TOOL_TYPES, DEFAULT_HOOK_TIMEOUT } = await import('./core/constants');

        // Step 1: Select scope
        const scopeChoice = await vscode.window.showQuickPick(
          [
            { label: 'Global', description: 'User settings (~/.claude/settings.json)', value: 'global' as const },
            { label: 'Project', description: 'Project settings (.claude/settings.local.json)', value: 'local' as const },
          ],
          { placeHolder: 'Select scope for the hook' }
        );
        if (!scopeChoice) return;

        // Step 2: Select event type
        const eventType = await vscode.window.showQuickPick(
          HOOK_EVENT_TYPES.map(type => ({
            label: type,
            description: HOOK_EVENT_DESCRIPTIONS[type],
          })),
          { placeHolder: 'Select hook event type' }
        );
        if (!eventType) return;

        // Step 3: Enter matcher pattern
        const matcher = await vscode.window.showInputBox({
          prompt: 'Enter matcher pattern (e.g., *, Read, Edit|Write, mcp__.*) - leave empty for no matcher',
          value: '*',
          placeHolder: 'Tool matcher pattern (optional)',
        });
        if (matcher === undefined) return; // User cancelled

        // Step 4: Select hook type
        const hookTypeChoice = await vscode.window.showQuickPick(
          [
            { label: 'command', description: 'Execute a bash command' },
            { label: 'prompt', description: 'Use LLM evaluation (limited support)' },
          ],
          { placeHolder: 'Select hook type' }
        );
        if (!hookTypeChoice) return;

        // Step 5: Enter command or prompt
        const content = await vscode.window.showInputBox({
          prompt: hookTypeChoice.label === 'command'
            ? 'Enter bash command (use $CLAUDE_PROJECT_DIR for project path)'
            : 'Enter LLM prompt for evaluation',
          placeHolder: hookTypeChoice.label === 'command'
            ? 'cd "$CLAUDE_PROJECT_DIR" && npm run lint'
            : 'Review the output and suggest improvements',
          validateInput: (value) => {
            return value.trim() ? null : 'Content cannot be empty';
          },
        });
        if (!content) return;

        // Step 6: Enter timeout (optional)
        const timeoutStr = await vscode.window.showInputBox({
          prompt: 'Enter timeout in seconds (optional, default: 60)',
          value: '60',
          placeHolder: '60',
          validateInput: (value) => {
            if (!value.trim()) return null; // Allow empty for default
            const num = parseInt(value);
            return isNaN(num) || num <= 0 ? 'Must be a positive number' : null;
          },
        });

        const timeout = timeoutStr && timeoutStr.trim() ? parseInt(timeoutStr) : DEFAULT_HOOK_TIMEOUT;

        // Step 7: Preview and confirm
        const hook = {
          type: hookTypeChoice.label as 'command' | 'prompt',
          ...(hookTypeChoice.label === 'command' ? { command: content } : { prompt: content }),
          ...(timeout !== DEFAULT_HOOK_TIMEOUT ? { timeout } : {}),
        };

        const hookJson = JSON.stringify(hook, null, 2);
        const confirm = await vscode.window.showInformationMessage(
          `Add this hook?\n\nEvent: ${eventType.label}\nMatcher: ${matcher}\n\n${hookJson}`,
          { modal: true },
          'Yes',
          'No'
        );

        if (confirm !== 'Yes') return;

        // Add the hook
        const success = await hooksService.addHook(
          scopeChoice.value,
          eventType.label as any,
          matcher,
          hook
        );

        if (success) {
          vscode.window.showInformationMessage('Hook created successfully!');
          hooksProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create hook: ${error}`);
      }
    }),

    // Delete hook command
    vscode.commands.registerCommand(COMMAND_IDS.deleteHook, async (item: any) => {
      if (!item?.hookData) {
        vscode.window.showErrorMessage('Invalid hook item.');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to delete this hook?',
        { modal: true },
        'Yes',
        'No'
      );

      if (confirm !== 'Yes') return;

      try {
        const { configPath, eventType, matcherIndex, hookIndex } = item.hookData;
        const success = await hooksService.deleteHook(configPath, eventType, matcherIndex, hookIndex);

        if (success) {
          vscode.window.showInformationMessage('Hook deleted successfully!');
          hooksProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete hook: ${error}`);
      }
    }),

    // Edit hook command
    vscode.commands.registerCommand(COMMAND_IDS.editHook, async (item: any) => {
      if (!item?.hookData) {
        vscode.window.showErrorMessage('Invalid hook item.');
        return;
      }

      try {
        const { configPath, eventType, matcherIndex, hookIndex, hook } = item.hookData;
        const { DEFAULT_HOOK_TIMEOUT } = await import('./core/constants');

        // Edit command or prompt
        const currentContent = hook.command || hook.prompt || '';
        const newContent = await vscode.window.showInputBox({
          prompt: hook.type === 'command' ? 'Edit bash command' : 'Edit LLM prompt',
          value: currentContent,
          validateInput: (value) => {
            return value.trim() ? null : 'Content cannot be empty';
          },
        });

        if (!newContent) return;

        // Edit timeout
        const currentTimeout = hook.timeout || DEFAULT_HOOK_TIMEOUT;
        const timeoutStr = await vscode.window.showInputBox({
          prompt: 'Edit timeout in seconds',
          value: currentTimeout.toString(),
          validateInput: (value) => {
            const num = parseInt(value);
            return isNaN(num) || num <= 0 ? 'Must be a positive number' : null;
          },
        });

        if (!timeoutStr) return;

        const newTimeout = parseInt(timeoutStr);

        // Update the hook
        const updatedHook = {
          type: hook.type,
          ...(hook.type === 'command' ? { command: newContent } : { prompt: newContent }),
          ...(newTimeout !== DEFAULT_HOOK_TIMEOUT ? { timeout: newTimeout } : {}),
        };

        const success = await hooksService.updateHook(
          configPath,
          eventType,
          matcherIndex,
          hookIndex,
          updatedHook
        );

        if (success) {
          vscode.window.showInformationMessage('Hook updated successfully!');
          hooksProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to edit hook: ${error}`);
      }
    }),

    // Copy hook JSON command
    vscode.commands.registerCommand(COMMAND_IDS.copyHookJson, async (item: any) => {
      if (!item?.hookData) {
        vscode.window.showErrorMessage('Invalid hook item.');
        return;
      }

      try {
        const { hook } = item.hookData;
        const hookJson = JSON.stringify(hook, null, 2);
        await vscode.env.clipboard.writeText(hookJson);
        vscode.window.showInformationMessage('Hook JSON copied to clipboard!');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to copy hook JSON: ${error}`);
      }
    }),

    // Duplicate hook command
    vscode.commands.registerCommand(COMMAND_IDS.duplicateHook, async (item: any) => {
      if (!item?.hookData) {
        vscode.window.showErrorMessage('Invalid hook item.');
        return;
      }

      try {
        const { hook, eventType } = item.hookData;

        // Ask for destination scope
        const scopeChoice = await vscode.window.showQuickPick(
          [
            { label: 'Global', description: 'User settings (~/.claude/settings.json)', value: 'global' as const },
            { label: 'Project', description: 'Project settings (.claude/settings.local.json)', value: 'local' as const },
          ],
          { placeHolder: 'Select destination scope' }
        );
        if (!scopeChoice) return;

        // Ask for matcher
        const matcher = await vscode.window.showInputBox({
          prompt: 'Enter matcher pattern for duplicated hook (leave empty for no matcher)',
          value: '*',
          placeHolder: 'Tool matcher pattern (optional)',
        });
        if (matcher === undefined) return; // User cancelled

        // Duplicate the hook
        const success = await hooksService.addHook(
          scopeChoice.value,
          eventType,
          matcher,
          hook
        );

        if (success) {
          vscode.window.showInformationMessage('Hook duplicated successfully!');
          hooksProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to duplicate hook: ${error}`);
      }
    })
  );

  // Setup file watcher for auto-refresh
  const config = vscode.workspace.getConfiguration('claudeCodeManager');
  if (config.get<boolean>('autoRefresh', true)) {
    setupFileWatcher(context, refreshAll);
  }

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('claudeCodeManager.autoRefresh')) {
        const autoRefresh = vscode.workspace
          .getConfiguration('claudeCodeManager')
          .get<boolean>('autoRefresh', true);

        if (autoRefresh) {
          setupFileWatcher(context, refreshAll);
        } else if (fileWatcher) {
          fileWatcher.dispose();
          fileWatcher = undefined;
        }
      }
    })
  );

  // Set context for menu items
  vscode.commands.executeCommand('setContext', 'ccm.canMoveToGlobal', true);
  vscode.commands.executeCommand('setContext', 'ccm.canMoveToProject', true);
}

function setupFileWatcher(
  context: vscode.ExtensionContext,
  refreshCallback: () => void
) {
  // Dispose existing watcher if any
  if (fileWatcher) {
    fileWatcher.dispose();
  }

  // Watch for changes in .claude directories and CLAUDE.md files
  const patterns = [
    '**/.claude/**/*',
    '**/CLAUDE.md',
    '**/claude.md',
  ];

  // Create file watcher for all patterns
  fileWatcher = vscode.workspace.createFileSystemWatcher(
    '{' + patterns.join(',') + '}'
  );

  // Debounce refresh
  let refreshTimeout: NodeJS.Timeout | undefined;
  const debouncedRefresh = () => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    refreshTimeout = setTimeout(refreshCallback, 300);
  };

  fileWatcher.onDidCreate(debouncedRefresh);
  fileWatcher.onDidChange(debouncedRefresh);
  fileWatcher.onDidDelete(debouncedRefresh);

  context.subscriptions.push(fileWatcher);
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
}
