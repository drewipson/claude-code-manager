<div align="center">
  <img src="resources/icons/claude-logo.png" alt="Claude Code Config Logo" width="120" height="120">

# Claude Code Config

**A VS Code extension for managing Claude Code configurations**

Visualize, organize, and control all your Claude Code settings from one interface.

[![VS Code](https://img.shields.io/badge/VS%20Code-1.85.0+-blue.svg)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## Why did I build this?

I love using Claude Code for my personal and professional projects when it works well. When CC goes off the rails with hallucinations or doing a task incorrectly, I would get frustrated. Antrhopic has provided lots of configurations for memories, slash commands, hooks, etc that fix these problems.

However, these configs can be scattered all over the place. I would forget where I told Claude how to draft a pull request -- was it a skill? a memory? a slash command? all three?

I built Claude Code Config because I use Claude Code extensively in my personal and professional projects and wanted quick insight into how Claude is set up for a given project.

## ✨ What does Claude Code Config do?

Claude Code Config changes how you work with [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) configurations in VS Code. Instead of manually navigating directories and editing scattered files, get a unified command center that puts everything at your fingertips.

**Perfect for developers who want to:**

- ⚙️ Manage Claude Code settings across your global, project, and local configurations.
- 🛠️ Quickly add agents, hooks, skills, commands with templates directly from Claude docs so you set them up right every time.
- ↔️ Move a skill, hook, agent from a local project config to your global set up with one click so your other projects benefit from that skill.
- 🔒 Quickly see what can and can't be executed by Claude Code Permissions

---

## 🎯 Key Features

### 📁 **Unified Configuration Management**

All your Claude Code configurations organized in one beautiful tree view:

- **Memories** (CLAUDE.md) - Your project context and persistent knowledge with drill down into specific markdown levels.
- **Commands** - Custom slash commands for your workflow
- **Skills** - Reusable AI capabilities and specialized behaviors
- **Sub-Agents** - Task-specific agents with custom prompts (color coding included)
- **Hooks** - Create, edit, delete with a GUI interface for quick adding
- **Permissions** - Fine-grained control over tool access

### ⚡ **Powerful Tools**

- **One-Click Creation** - Add new configs with templates via `+` buttons
- **Quickly Change Scopes** - Move files between Global and Project with right-click
- **Folder Organization** - Create logical groupings for commands and sub-agents
- **Live Sync** - Auto-refresh when files change
- **Color-Coded Agents** - Sub-agents display in their configured colors for easy identification
- **Quick Links** to offical Claude Code documentation for configs and setup.

### ↩️ **Hooks Management Interface**

Create and manage Claude Code hooks without touching JSON:

- **Visual Hook Builder** - Multi-step wizard for all hook types
- **Organized Hierarchy** - Browse by location → event → matcher → hook
- **Quick Actions** - Edit, delete, duplicate, or copy hooks with one click
- **Support for All Events** - PreToolUse, PostToolUse, SessionStart, and more
- **Both Types** - Command-based and LLM prompt-based hooks

---

## 🚀 Quick Start

### Installation

#### From VS Code Marketplace _(Coming Soon)_

Download "Claude Code Config" from the VS Code Marketplace

#### From VSIX

1. Download the latest `.vsix` from [Releases](../../releases)
2. Open VS Code Extensions view (`Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Click `...` menu → **Install from VSIX...**
4. Select the downloaded file

#### From Source

```bash
git clone https://github.com/your-username/claude-code-manager.git
cd claude-code-manager
npm install
npm run build
# Press F5 in VS Code to launch Extension Development Host
```

### First Steps

1. **Click the icon** - Look for the Claude Code Config icon in the Activity Bar (left sidebar)
2. **Explore your configs** - Expand sections to see your existing Claude Code files
3. **Create something new** - Click any `+` button to add memories, commands, skills, or sub-agents
4. **Organize with folders** - Right-click in Commands or Sub-Agents to create organizational folders
5. **Set up hooks** - Click `+` in Hooks view to add automation to your Claude Code workflow

---

## 📖 Documentation

### Configuration Files

Claude Code Config manages files in standard Claude Code locations:

```
~/.claude/                           # Global (all projects)
├── CLAUDE.md
├── commands/
│   ├── my-command.md
│   └── workflows/                   # Organized in folders
│       └── deploy.md
├── skills/
│   └── code-review.md
├── agents/
│   ├── researcher.md                # color: blue (in YAML frontmatter)
│   └── planner.md                   # color: purple
├── mcp_servers.json
└── settings.json                    # Hooks and permissions

.claude/                             # Project-specific
├── CLAUDE.md
├── commands/
├── agents/
└── settings.local.json              # Project hooks (gitignored)
```

### VS Code Settings

Configure Claude Code Config in VS Code settings:

| Setting                              | Description                        | Default     |
| ------------------------------------ | ---------------------------------- | ----------- |
| `claudeCodeManager.autoRefresh`      | Auto-refresh views on file changes | `true`      |
| `claudeCodeManager.globalClaudePath` | Custom global .claude directory    | `~/.claude` |

### Available Commands

Access via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

- **Refresh All Views** - Reload all configurations
- **Create Memory** - New CLAUDE.md file
- **Create Command** - New slash command
- **Create Skill** - New skill definition
- **Create Sub-Agent** - New sub-agent with template
- **Create Hook** - Launch hook creation wizard

---

## 🎨 Features in Detail

### Hooks Management

Create powerful automation for your Claude Code workflow:

**Supported Event Types:**

- `PreToolUse` / `PostToolUse` - Before/after tool execution
- `PermissionRequest` - When permissions are requested
- `UserPromptSubmit` - When you submit a prompt
- `SessionStart` / `SessionEnd` - Session lifecycle
- `Stop` / `SubagentStop` - When agents finish
- `Notification` - System notifications
- `PreCompact` - Before context compaction

**Example Use Cases:**

- Auto-format code after edits
- Run tests after file changes
- Validate prompts before submission
- Log all tool usage for auditing
- Block access to sensitive files

### Permissions Visualization

See all your permission rules organized by:

1. **Type** - Allow, Ask, or Deny
2. **Tool** - Read, Edit, Write, Bash, etc.
3. **Pattern** - Specific files or patterns

Click any rule to jump to the settings file for editing.

### Sub-Agent Colors

Configure agent colors in YAML frontmatter:

```yaml
---
name: my-agent
color: purple
---
```

The icon in the tree view will display in that color for easy identification!

---

## 🔧 Development

### Prerequisites

- Node.js 18+
- VS Code 1.85.0+

### Build Commands

```bash
npm install          # Install dependencies
npm run watch        # Development mode with auto-rebuild
npm run build        # Production build
npm run lint         # Run ESLint
npx vsce package     # Build .vsix package
```

### Project Structure

```
src/
├── extension.ts              # Main activation
├── core/
│   ├── types.ts             # TypeScript interfaces
│   └── constants.ts         # Shared constants
├── providers/
│   └── claudeTreeDataProvider.ts  # Tree view logic
├── services/
│   ├── fileDiscoveryService.ts    # Find configs
│   ├── fileOperationsService.ts   # CRUD operations
│   ├── hooksService.ts            # Hooks management
│   ├── permissionsService.ts      # Permissions parsing
│   └── mcpService.ts              # MCP server discovery
└── utils/
    ├── yamlParser.ts        # YAML frontmatter parsing
    └── markdownParser.ts    # Markdown section parsing
```

---

## 🤝 Contributing

Contributions are welcome! Here's how to help:

1. **Fork the repository**
2. **Create a feature branch** - `git checkout -b feature/amazing-feature`
3. **Make your changes** - Follow existing code style
4. **Test thoroughly** - Ensure nothing breaks
5. **Commit with conventional commits** - `feat:`, `fix:`, `docs:`, etc.
6. **Push and create a PR** - Describe your changes

### Areas for Contribution

- 📊 Usage analytics dashboard
- 🌐 Internationalization (i18n)
- 🎨 Additional themes/icons
- 📝 Documentation improvements
- 🐛 Bug fixes and optimizations

---

## 📄 License

MIT © 2024

---

## 🙏 Acknowledgments

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)** by Anthropic - The amazing AI coding assistant
- **VS Code Extension API** - Powerful extensibility platform

---

## 📞 Support

- **Issues** - [GitHub Issues](../../issues)
- **Discussions** - [GitHub Discussions](../../discussions)
- **Documentation** - [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code/overview)

---

<div align="center">

**Built with ❤️ for the Claude Code community**

If this extension helps your workflow, consider giving it a ⭐ on GitHub!

</div>
