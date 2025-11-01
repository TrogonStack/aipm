# CLI Commands Reference

Complete reference for all aipm commands.

---

## Global Options

Available for all commands:

| Option      | Short | Description                              |
| ----------- | ----- | ---------------------------------------- |
| `--help`    | `-h`  | Show help message                        |
| `--version` | `-v`  | Show version number                      |
| `--dry-run` | `-d`  | Show what would be done without doing it |

---

## Commands

### `init`

Initialize aipm configuration in current project.

**Usage**:

```bash
aipm init [options]
```

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--global` | `-g` | boolean | Initialize global config instead of project |
| `--force` | `-f` | boolean | Overwrite existing configuration |
| `--example` | | boolean | Use example template with sample data |
| `--dry-run` | `-d` | boolean | Show what would be created |

**Examples**:

```bash
# Initialize project config
aipm init

# Initialize with examples
aipm init --example

# Preview what would be created
aipm init --dry-run

# Initialize global config
aipm init --global
```

**Creates**:

- `.cursor/plugins.json` - Project configuration
- `.cursor/plugins.local.json.example` - Local config template
- Updates `.gitignore` to ignore `plugins.local.json`

**Exit codes**:

- `0` - Success
- `1` - Error (file exists, permission denied, etc.)

---

### `sync`

Sync all enabled plugins from marketplaces to `.cursor/marketplace/`.

**Usage**:

```bash
aipm sync [options]
```

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--dry-run` | `-d` | boolean | Show what would be synced |

**Examples**:

```bash
# Sync all enabled plugins
aipm sync

# Preview sync without making changes
aipm sync --dry-run
```

**Behavior**:

1. Loads configuration (three-way merge)
2. For each enabled plugin:
   - Resolves marketplace path (clones/pulls git repos)
   - Copies plugin files to `.cursor/marketplace/{marketplace}/{plugin}/`
3. Reports success/failures

**Exit codes**:

- `0` - All plugins synced successfully
- `1` - One or more plugins failed to sync

---

## Marketplace Commands

### `marketplace add`

Add a plugin marketplace.

**Usage**:

```bash
aipm marketplace add <name> <source> [options]
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Unique marketplace identifier |
| `source` | Yes | Marketplace source (see below) |

**Source types**:

- **GitHub shorthand**: `owner/repo` (expands to GitHub URL)
- **Git URL**: `https://github.com/user/repo.git`
- **Git SSH**: `git@github.com:user/repo.git`
- **Local path**: `./path/to/marketplace` or `/absolute/path`
- **Remote JSON**: `https://cdn.com/marketplace.json`

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--local` | `-l` | boolean | Save to plugins.local.json |
| `--dry-run` | `-d` | boolean | Show what would be added |

**Examples**:

```bash
# Add GitHub marketplace (shorthand)
aipm marketplace add team-plugins acme/plugins

# Add Git repository
aipm marketplace add tools https://github.com/tools/cursor-plugins.git

# Add local marketplace
aipm marketplace add local ./my-plugins

# Add remote marketplace.json
aipm marketplace add cdn https://cdn.example.com/marketplace.json

# Add to local config only (not committed)
aipm marketplace add private ./private-plugins --local
```

**Exit codes**:

- `0` - Marketplace added successfully
- `1` - Error (invalid source, already exists, etc.)

---

### `marketplace remove`

Remove a marketplace and uninstall its plugins.

**Usage**:

```bash
aipm marketplace remove <name> [options]
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Marketplace name to remove |

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--local` | `-l` | boolean | Remove from plugins.local.json |
| `--dry-run` | `-d` | boolean | Show what would be removed |

**Examples**:

```bash
# Remove marketplace
aipm marketplace remove team-plugins

# Preview removal
aipm marketplace remove team-plugins --dry-run
```

**Behavior**:

- Removes marketplace from configuration
- Disables all plugins from that marketplace
- Removes synced plugin files

**Exit codes**:

- `0` - Marketplace removed successfully
- `1` - Marketplace not found or error

---

### `marketplace update`

Update a marketplace from its source (pulls latest for git repos).

**Usage**:

```bash
aipm marketplace update <name> [options]
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Marketplace name to update |

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--dry-run` | `-d` | boolean | Show what would be updated |

**Examples**:

```bash
# Update marketplace
aipm marketplace update team-plugins

# Preview update
aipm marketplace update team-plugins --dry-run
```

**Behavior**:

- For git repos: Runs `git fetch && git reset --hard origin/{branch}`
- For URLs: Re-fetches marketplace.json
- For local: No-op (local directories are always current)

**Exit codes**:

- `0` - Marketplace updated successfully
- `1` - Error (network failure, git error, etc.)

---

## Plugin Commands

### `plugin search`

Search for available plugins across all marketplaces.

**Usage**:

```bash
aipm plugin search [query]
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `query` | No | Search term (searches name and description) |

**Examples**:

```bash
# List all available plugins
aipm plugin search

# Search for specific plugins
aipm plugin search react

# Search with multiple words
aipm plugin search "code review"
```

**Output**:

- Plugin name
- Marketplace
- Description
- Version

**Exit codes**:

- `0` - Search completed
- `1` - Error loading marketplaces

---

### `plugin install`

Install a plugin (enables and syncs in one step).

**Usage**:

```bash
aipm plugin install <pluginId> [options]
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `pluginId` | Yes | Plugin identifier: `name@marketplace` |

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--local` | `-l` | boolean | Save to plugins.local.json |
| `--force` | `-f` | boolean | Reinstall if already installed |
| `--dry-run` | `-d` | boolean | Show what would be installed |

**Examples**:

```bash
# Install plugin
aipm plugin install my-plugin@team-plugins

# Reinstall (force)
aipm plugin install my-plugin@team-plugins --force

# Install to local config
aipm plugin install my-plugin@local --local

# Preview installation
aipm plugin install my-plugin@team-plugins --dry-run
```

**Behavior**:

1. Validates plugin exists
2. Enables plugin in config
3. Syncs plugin files
4. Reports success

**Exit codes**:

- `0` - Plugin installed successfully
- `1` - Plugin not found or sync failed

---

### `plugin uninstall`

Uninstall a plugin.

**Usage**:

```bash
aipm plugin uninstall <pluginId> [options]
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `pluginId` | Yes | Plugin identifier: `name@marketplace` |

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--remove-files` | | boolean | Delete plugin files from filesystem |
| `--local` | `-l` | boolean | Remove from plugins.local.json |
| `--dry-run` | `-d` | boolean | Show what would be uninstalled |

**Examples**:

```bash
# Uninstall plugin (keeps files)
aipm plugin uninstall my-plugin@team-plugins

# Uninstall and delete files
aipm plugin uninstall my-plugin@team-plugins --remove-files

# Preview uninstall
aipm plugin uninstall my-plugin@team-plugins --dry-run
```

**Exit codes**:

- `0` - Plugin uninstalled successfully
- `1` - Plugin not found or error

---

### `plugin enable`

Enable a disabled plugin.

**Usage**:

```bash
aipm plugin enable <pluginId> [options]
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `pluginId` | Yes | Plugin identifier: `name@marketplace` |

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--local` | `-l` | boolean | Enable in plugins.local.json |
| `--dry-run` | `-d` | boolean | Show what would be enabled |

**Examples**:

```bash
# Enable plugin
aipm plugin enable my-plugin@team-plugins

# Preview
aipm plugin enable my-plugin@team-plugins --dry-run
```

**Exit codes**:

- `0` - Plugin enabled successfully
- `1` - Plugin not found or already enabled

---

### `plugin disable`

Disable an enabled plugin (keeps config and files).

**Usage**:

```bash
aipm plugin disable <pluginId> [options]
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `pluginId` | Yes | Plugin identifier: `name@marketplace` |

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--local` | `-l` | boolean | Disable in plugins.local.json |
| `--dry-run` | `-d` | boolean | Show what would be disabled |

**Examples**:

```bash
# Disable plugin
aipm plugin disable my-plugin@team-plugins

# Preview
aipm plugin disable my-plugin@team-plugins --dry-run
```

**Exit codes**:

- `0` - Plugin disabled successfully
- `1` - Plugin not found or already disabled

---

### `plugin update`

Update an installed plugin to latest version.

**Usage**:

```bash
aipm plugin update <pluginId> [options]
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `pluginId` | Yes | Plugin identifier: `name@marketplace` |

**Options**:
| Option | Short | Type | Description |
|--------|-------|------|-------------|
| `--dry-run` | `-d` | boolean | Show what would be updated |

**Examples**:

```bash
# Update plugin
aipm plugin update my-plugin@team-plugins

# Preview update
aipm plugin update my-plugin@team-plugins --dry-run
```

**Behavior**:

1. Updates marketplace (pulls latest)
2. Re-syncs plugin files
3. Reports changes

**Exit codes**:

- `0` - Plugin updated successfully
- `1` - Plugin not found or update failed

---

## Information Commands

### `list`

List all marketplaces and installed plugins.

**Usage**:

```bash
aipm list
```

**Output**:

- All configured marketplaces
- All installed plugins (enabled/disabled status)
- Plugin versions (if available)

**Example output**:

```
? Marketplaces:
  - team-plugins: git@github.com:acme/plugins.git
  - local: ./my-plugins

? Installed Plugins:
  - code-reviewer@team-plugins (enabled, v1.2.0)
  - test-gen@local (disabled, v1.0.0)
```

**Exit codes**:

- `0` - Success
- `1` - Error loading config

---

### `info`

Show detailed information about a specific plugin.

**Usage**:

```bash
aipm info <pluginId>
```

**Arguments**:
| Argument | Required | Description |
|----------|----------|-------------|
| `pluginId` | Yes | Plugin identifier: `name@marketplace` |

**Examples**:

```bash
# Show plugin info
aipm info my-plugin@team-plugins
```

**Output**:

- Plugin name, version, description
- Author information
- Marketplace source
- Installation status
- File locations
- Commands provided (if available)
- Agents provided (if available)

**Exit codes**:

- `0` - Success
- `1` - Plugin not found

---

## Exit Codes

All commands use these exit codes:

| Code | Meaning                               |
| ---- | ------------------------------------- |
| `0`  | Success                               |
| `1`  | Error (see error message for details) |

For detailed error information, see [Exit Codes Reference](./exit-codes.md).

---

## Environment Variables

See [Environment Variables Reference](./environment.md).

---

## Related

- [How-To: Debug Plugins](../how-to/debug-plugins.md)
- [Tutorial: Getting Started](../tutorials/getting-started.md)
- [Configuration Schema](./config-schema.md)
