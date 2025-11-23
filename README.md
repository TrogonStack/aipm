# aipm

**A Cursor plugin manager with Claude Code marketplace federation.**

Manage Cursor plugins from multiple sources including AIPM marketplaces and **auto-discovered Claude Code marketplaces**. Install plugins to Cursor from Claude Code's ecosystem without manual configuration.

**Simple model**: AIPM stores configuration in `.aipm/` directory, syncs plugins to `.cursor/`, and can read from Claude Code's `.claude/` marketplaces for plugin discovery.

Inspired by [Claude Code's plugin marketplace system](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces), extended with marketplace federation and nested plugin structure support.

## Quick Start

```bash
# Install (recommended: using mise)
mise use -g ubi:TrogonStack/aipm

# Or download pre-built binary for your platform
# See docs/how-to/installation.md for platform-specific download commands

# Initialize (creates .aipm/ directory structure)
aipm init

# Add a marketplace
aipm marketplace add team https://github.com/your-org/plugins.git

# Install plugins (works with nested structures)
aipm plugin install my-plugin@team
aipm plugin install document-skills/docx@anthropic  # nested plugin support
```

## Directory Structure

AIPM uses a clean separation between configuration and synced content:

```
~/.aipm/cache/              # Shared git marketplace cache

project/
├── .aipm/
│   ├── config.json        # Team config (commit to git)
│   └── config.local.json  # Personal overrides (git-ignored)
└── .cursor/               # Synced plugin files
    ├── commands/
    ├── rules/
    └── agents/
```

**Clean separation:** AIPM configuration lives in `.aipm/`, synced content lives in `.cursor/`

### Claude Code Marketplace Federation

If you have Claude Code installed, **AIPM automatically discovers its marketplaces**:

```bash
# AIPM scans ~/.claude/plugins/known_marketplaces.json automatically
aipm list

📦 Marketplaces:
  • claude:anthropic-agent-skills (🤖 Claude Code auto-discovered)
  • claude:claude-code-workflows (🤖 Claude Code auto-discovered)

# Install Claude Code plugins to Cursor
aipm plugin install algorithmic-art@claude:anthropic-agent-skills
aipm plugin install document-skills/docx@claude:anthropic-agent-skills
aipm sync  # Installs to .cursor/ for Cursor to use
```

**Federation Model**: AIPM reads from Claude Code's marketplaces but installs everything to `.cursor/` (for Cursor). This gives you access to Claude Code's plugin ecosystem in Cursor without manual configuration.

## Documentation

**See [docs/](./docs/) for complete documentation.**

The documentation follows the [Diátaxis framework](https://diataxis.fr/):

- **[Tutorials](./docs/tutorials/)** - Learn by doing
- **[How-To Guides](./docs/how-to/)** - Solve specific problems
- **[Explanation](./docs/explanation/)** - Understand concepts
- **[Reference](./docs/reference/)** - Look up details

**New to aipm?** Start with the [Getting Started Tutorial](./docs/tutorials/getting-started.md).

## Links

- **[Installation Guide](./docs/how-to/installation.md)** - Platform-specific installation
- **[Contributing Guide](./CONTRIBUTING.md)** - Development setup
- **[License](./LICENSE)** - MIT License
