# Tutorial: Creating Your First Plugin

**Time to complete**: 15 minutes  
**Prerequisites**: aipm installed, basic command-line knowledge

In this tutorial, you'll create a simple "Hello World" plugin that adds a custom command to aipm. By the end, you'll understand plugin structure and how to test plugins locally.

---

## What You'll Build

A plugin that adds a `/hello` command which greets users. Simple but complete!

**Learning objectives**:

- Understand plugin directory structure
- Create a plugin manifest
- Add a custom command
- Test plugins locally
- Share plugins with others

---

## Step 1: Create the Plugin Structure

Create a new directory for your plugin:

```bash
mkdir -p ~/cursor-plugins/hello-world
cd ~/cursor-plugins/hello-world
```

Every plugin needs a `.claude-plugin/` directory with metadata:

```bash
mkdir -p .claude-plugin
```

---

## Step 2: Create the Plugin Manifest

Create `.claude-plugin/plugin.json`:

```bash
cat > .claude-plugin/plugin.json << 'EOF'
{
  "name": "hello-world",
  "description": "A simple greeting plugin to learn the basics",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  }
}
EOF
```

**What this does**:

- `name`: Unique identifier for your plugin
- `description`: What your plugin does
- `version`: Semantic version (major.minor.patch)
- `author`: Who created it

---

## Step 3: Add a Custom Command

Create a `commands/` directory:

```bash
mkdir commands
```

Create `commands/hello.md`:

```bash
cat > commands/hello.md << 'EOF'
---
description: Greet the user with a friendly message
---

# Hello Command

This command demonstrates a simple plugin command that greets the user.

## Usage

Simply type `/hello` and optionally provide a name:

```

/hello
/hello Alice

```

## Implementation

When invoked, this command will:
1. Check if a name was provided
2. Generate a personalized greeting
3. Display the greeting to the user

## Example

```

User: /hello World
Assistant: Hello, World! Welcome to aipm plugins!

```

If no name provided:
```

User: /hello
Assistant: Hello! Welcome to aipm plugins!

```
EOF
```

**What this does**:

- Creates a `/hello` command
- The frontmatter describes the command
- The body explains how it works
- Claude Code reads this and knows how to invoke it

---

## Step 4: Add a README

Good practice: document your plugin!

````bash
cat > README.md << 'EOF'
# Hello World Plugin

A simple greeting plugin for learning aipm plugin development.

## Commands

- `/hello [name]` - Greets the user

## Installation

```bash
aipm marketplace add local ~/cursor-plugins
aipm plugin install hello-world@local
````

## Usage

After installation, use the `/hello` command in Claude Code:

```
/hello
/hello Alice
```

## Development

This plugin is intentionally simple for learning purposes. See the code in `commands/hello.md` to understand how commands work.
EOF

````

---

## Step 5: Create a Local Marketplace

To use your plugin, create a marketplace that points to it:

```bash
cd ~/cursor-plugins
cat > marketplace.json << 'EOF'
{
  "name": "my-plugins",
  "description": "My personal plugin marketplace",
  "plugins": [
    {
      "name": "hello-world",
      "source": "./hello-world",
      "description": "A simple greeting plugin",
      "version": "1.0.0"
    }
  ]
}
EOF
````

---

## Step 6: Test Your Plugin

Now let's install and test it!

```bash
# Add your local marketplace
aipm marketplace add local ~/cursor-plugins

# Install your plugin
aipm plugin install hello-world@local

# Verify it's installed
aipm list
```

You should see:

```
? Marketplaces:
  - local: ~/cursor-plugins

? Installed Plugins:
  - hello-world@local (enabled)
```

---

## Step 7: Use Your Plugin

Open Claude Code and try your new command:

```
/hello
```

Expected response:

```
Hello! Welcome to aipm plugins!
```

Try with a name:

```
/hello Alice
```

Expected response:

```
Hello, Alice! Welcome to aipm plugins!
```

---

## What You Learned

? **Plugin structure**: Every plugin needs `.claude-plugin/plugin.json`  
? **Commands**: Markdown files in `commands/` add slash commands  
? **Marketplaces**: JSON files that list available plugins  
? **Local testing**: Use local marketplaces for development  
? **Installation**: `marketplace add` + `plugin install`

---

## Next Steps

Now that you understand the basics, try:

1. **Add more commands**: Create `commands/goodbye.md`
2. **Add metadata**: Use frontmatter for better descriptions
3. **Create an agent**: Add `agents/helper.md`
4. **Share it**: Push to GitHub and share the marketplace

Continue to:

- [Team Marketplace Tutorial](./team-marketplace.md) - Share with your team
- [How to Create a Marketplace](../how-to/create-marketplace.md) - Advanced marketplace setup

---

## Troubleshooting

### Plugin not showing up?

```bash
# Check if marketplace is added
aipm marketplace list

# Re-sync
aipm sync
```

### Command not recognized?

Restart Claude Code to reload plugins.

### Want to iterate?

```bash
# Uninstall
aipm plugin uninstall hello-world@local

# Make changes to your plugin

# Reinstall
aipm plugin install hello-world@local
```

---

## Full Directory Structure

After completing this tutorial, you should have:

```
~/cursor-plugins/
??? marketplace.json          # Marketplace manifest
??? hello-world/             # Your plugin
    ??? .claude-plugin/
    ?   ??? plugin.json      # Plugin metadata
    ??? commands/
    ?   ??? hello.md         # Custom command
    ??? README.md            # Documentation
```

---

**Congratulations!** ?? You've created your first aipm plugin!
