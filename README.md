# Claude Code Manager - VS Code Extension

A VS Code extension that helps you manage Claude Code configurations and visualize usage metrics right in VS Code.

## Features

### Configuration Management

- **Organized TreeView** - See all your Claude configurations grouped by type:
  - Claude Context (CLAUDE.md files)
  - Memories
  - Skills
  - Sub-Agents
  - MCP Servers
- **Location Badges** - Instantly see where each config lives: `[Global]`, `[Project]`, or nested paths
- **Click to Open** - Single-click any file to open in VS Code's native editor
- **Move Between Scopes** - Right-click to move configs between Global and Project scopes

### Usage Analytics Dashboard

- Beautiful charts showing token usage and costs
- Model breakdown (Sonnet, Opus, Haiku)
- Daily usage trends
- Export to JSON or CSV

### Documentation Quick Links

- Direct links to official Claude Code documentation
- Context-aware help for each configuration type

## Installation

### From Source (Development)

1. Clone this repository:

   ```bash
   git clone https://github.com/your-username/claude-code-manager.git
   cd claude-code-manager
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Open in VS Code and press `F5` to launch the Extension Development Host

### From VSIX

1. Download the `.vsix` file from releases
2. In VS Code, go to Extensions view
3. Click `...` menu → `Install from VSIX...`
4. Select the downloaded file

## Usage

### Viewing Configurations

1. Click the Claude Code Manager icon in the Activity Bar (left sidebar)
2. Expand each section to see your configurations:
   - **Claude Context** - Your CLAUDE.md files
   - **Memories** - Persistent knowledge for Claude
   - **Skills** - Specialized capabilities
   - **Sub-Agents** - Task-specific agents
   - **MCP Servers** - Model Context Protocol configurations

### Creating New Configurations

1. Hover over a section (Memories, Skills, or Sub-Agents)
2. Click the `+` button that appears
3. Select scope (Global or Project)
4. Enter a name
5. The file opens in VS Code for editing

### Moving Configurations Between Scopes

1. Right-click any configuration file
2. Select "Move to Global" or "Move to Project"
3. The file is moved and the view refreshes

### Viewing Usage Analytics

1. Click "Open Usage Dashboard" in the Usage Analytics section
2. View your token usage, costs, and trends
3. Export data as JSON or CSV

## Configuration

Open VS Code settings and search for "Claude Code Manager":

| Setting                              | Description                             | Default       |
| ------------------------------------ | --------------------------------------- | ------------- |
| `claudeCodeManager.ccusagePath`      | Path to CCUSAGE executable              | Auto-detected |
| `claudeCodeManager.autoRefresh`      | Auto-refresh views on file changes      | `true`        |
| `claudeCodeManager.globalClaudePath` | Custom path to global .claude directory | `~/.claude`   |

## Requirements

- VS Code 1.85.0 or higher
- [CCUSAGE](https://github.com/ryoppippi/ccusage) (optional, for usage analytics)

## File Structure

The extension manages files in these locations:

```
~/.claude/                    # Global configurations
├── CLAUDE.md
├── memories/
│   └── *.md
├── skills/
│   └── *.md
├── sub-agents/
│   └── *.md
└── mcp_servers.json

{workspace}/                  # Project configurations
├── CLAUDE.md
├── .claude/
│   ├── memories/
│   ├── skills/
│   └── sub-agents/
└── **/CLAUDE.md              # Nested configs
```

## Commands

| Command              | Description                |
| -------------------- | -------------------------- |
| `ccm.refresh`        | Refresh all views          |
| `ccm.openDashboard`  | Open Usage Dashboard       |
| `ccm.createMemory`   | Create a new memory        |
| `ccm.createSkill`    | Create a new skill         |
| `ccm.createSubAgent` | Create a new sub-agent     |
| `ccm.moveToGlobal`   | Move file to global scope  |
| `ccm.moveToProject`  | Move file to project scope |

## Development

```bash
# Install dependencies
npm install

# Build for development
npm run watch

# Build for production
npm run build

# Run linting
npm run lint
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- [CCUSAGE](https://github.com/ryoppippi/ccusage) for usage analytics
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) by Anthropic
