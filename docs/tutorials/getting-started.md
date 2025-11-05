# Getting Started with aipm

A hands-on tutorial to get you started with aipm in 15 minutes. Works with both **Cursor** and **Claude Code**!

## Prerequisites

- `aipm` installed ([Installation Guide](../../INSTALLATION.md))
- A project directory (we'll create one for testing)
- Either Cursor or Claude Code (aipm auto-detects which one you're using)

## Part 1: Verify Installation

First, verify aipm is installed and working:

```bash
# Check version
aipm --version

# View available commands
aipm --help
```

Expected output: Version number (e.g., `0.1.0`)

> **Note for Claude Code users**: AIPM is a Cursor plugin manager. It can discover and install plugins from Claude Code's marketplaces, but always installs them to Cursor's `.cursor/` directory. See the "Working with Claude Code's Official Marketplaces" section below.

## Part 2: Create Your First Plugin

Let's create a test project and add a simple plugin:

```bash
# Create a test project
mkdir -p ~/aipm-tutorial
cd ~/aipm-tutorial

# Initialize git (required)
git init

# Initialize aipm
aipm init

# Verify config was created
cat .cursor/plugins.json
```

Now create a simple plugin:

```bash
# Create the plugin directory structure
mkdir -p my-plugins/hello-world/.claude-plugin

# Create plugin manifest
cat > my-plugins/hello-world/.claude-plugin/plugin.json << 'EOF'
{
  "name": "hello-world",
  "version": "1.0.0",
  "description": "A simple greeting plugin",
  "author": "Your Name"
}
EOF

# Create plugin commands directory
mkdir -p my-plugins/hello-world/commands

# Create a sample command
cat > my-plugins/hello-world/commands/greet.md << 'EOF'
---
description: Say hello
---

# Greet Command

This command provides a friendly greeting!

## Usage

Type `/greet` to receive a personalized hello message.
EOF
```

## Part 3: Configure Your Marketplace

Add your local plugin directory as a marketplace:

```bash
# Add the local plugin directory as a marketplace
aipm marketplace add my-marketplace ./my-plugins

# Verify the marketplace was added
cat .cursor/plugins.json
```

Your config should now include the marketplace reference.

## Part 4: Enable and Sync Plugins

Enable your plugin and sync it:

```bash
# Enable the hello-world plugin
aipm plugin enable hello-world@my-marketplace

# Sync plugins to .cursor/marketplace/
aipm sync

# List all plugins
aipm list

# Get detailed plugin info
aipm info hello-world@my-marketplace
```

## Part 5: Verify the Installation

Check that the plugin files were synced correctly:

```bash
# List synced plugin files
ls -la .cursor/marketplace/my-marketplace/hello-world/

# View the command file
cat .cursor/marketplace/my-marketplace/hello-world/commands/greet.md
```

You should see your plugin's command file in the marketplace directory!

## Part 6: Managing Plugins

Now try other plugin management commands:

```bash
# Disable a plugin
aipm plugin disable hello-world@my-marketplace

# Re-enable it
aipm plugin enable hello-world@my-marketplace

# Install a plugin (enable + sync in one step)
aipm plugin install hello-world@my-marketplace --force

# Uninstall a plugin
aipm plugin uninstall hello-world@my-marketplace
```

## Expected Output

When you run `aipm list`, you should see:

```
📦 Marketplaces:
  • my-marketplace
    Source: directory
    Path: ./my-plugins

🔌 Plugins:
  ✓ hello-world@my-marketplace
```

## Working with Claude Code's Official Marketplaces

If you have Claude Code installed with official Anthropic marketplaces, **AIPM automatically discovers them**:

```bash
# No configuration needed - Claude Code marketplaces are auto-discovered!
aipm list
# Shows: claude:anthropic-agent-skills (auto-discovered from Claude Code)

# Install Claude Code plugins to Cursor
aipm plugin install algorithmic-art@claude:anthropic-agent-skills
aipm plugin install document-skills/docx@claude:anthropic-agent-skills  # nested plugin!

# Sync to .cursor/ directory (for Cursor to use)
aipm sync

# View all available plugins from both AIPM and Claude Code
aipm plugin search
```

**How it works**:

- AIPM reads `~/.claude/plugins/known_marketplaces.json` to discover Claude Code's marketplaces
- Plugins are installed to `.cursor/` (AIPM never modifies `.claude/`)
- You get the best of both worlds: Claude Code's marketplaces work in Cursor!

**Nested Plugin Structure**: Claude Code's marketplaces use nested directories (like `document-skills/docx/`). AIPM automatically discovers all plugins regardless of nesting depth.

## Next Steps

Congratulations! You've successfully:

- ✅ Created your first plugin
- ✅ Configured a local marketplace
- ✅ Synced and verified plugin installation

### What to try next:

1. **Add more plugins** - Create additional plugins in `my-plugins/`
2. **Use Git marketplaces** - Pull plugins from GitHub repositories
3. **Share with your team** - Set up a team marketplace with `aipm marketplace add`
4. **Explore commands** - See [CLI Reference](../reference/cli-commands.md) for all available commands

## Troubleshooting

### Command not found

If you get `aipm: command not found`, ensure aipm is properly installed:

```bash
# Check installation
which aipm

# Reinstall if needed
npm install -g @trogonstack/aipm
```

### Plugin not syncing

If plugins don't appear after sync:

1. Check the plugin manifest exists: `my-plugins/plugin-name/.claude-plugin/plugin.json`
2. Verify the marketplace path is correct in `.cursor/plugins.json`
3. Run `aipm sync` again

### Git initialization required

aipm requires a git repository to be initialized:

```bash
git init
```

## Cleanup

To remove the tutorial project:

```bash
# Go back to home
cd ~

# Remove the tutorial directory
rm -rf aipm-tutorial
```
