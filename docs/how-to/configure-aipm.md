# How to Configure aipm

**Goal**: Understand and configure aipm for your project
**Time**: 15 minutes
**Difficulty**: Beginner to Intermediate

---

## Configuration Files

aipm uses a three-way configuration merge system:

1. **Global** (`~/.cursor/plugins.json`) - System-wide settings
2. **Project** (`.cursor/plugins.json`) - Project-specific settings (committed to git)
3. **Local** (`.cursor/plugins.local.json`) - Personal overrides (git-ignored)

### Initialize Configuration

```bash
aipm init
```

This creates:

- `.cursor/plugins.json` - Main config file
- `.cursor/plugins.local.json.example` - Example local config

---

## Marketplace Sources

### Directory Source

For local plugin directories:

```json
{
  "marketplaces": {
    "local": {
      "source": "directory",
      "path": "./path/to/marketplace"
    }
  }
}
```

**Usage:**

```bash
aipm marketplace add local ./path/to/marketplace
```

### Git Source

For git repositories (GitHub, GitLab, Bitbucket):

```json
{
  "marketplaces": {
    "team-plugins": {
      "source": "git",
      "url": "https://github.com/user/repo.git",
      "branch": "main"
    }
  }
}
```

The `branch` field is optional and defaults to the repository's default branch.

**Usage:**

```bash
# GitHub shorthand
aipm marketplace add team cursor-community/plugins

# Full URL
aipm marketplace add team https://github.com/user/plugins.git

# Local git repository
aipm marketplace add local-git /path/to/local/repo
```

#### GitHub Protocol Preference

When using GitHub shorthand (`owner/repo`), the tool automatically determines whether to use HTTPS or SSH:

**Default:** HTTPS (`https://github.com/owner/repo.git`)

**SSH Detection:** The tool checks your git config for SSH preferences:

```bash
# To always use SSH for GitHub
git config --global url."ssh://git@github.com/".insteadOf "https://github.com/"
```

After this configuration, `owner/repo` will expand to `git@github.com:owner/repo.git`

**Manual Override:** You can always use full URLs to specify the exact protocol:

```bash
# Explicit HTTPS
aipm marketplace add team https://github.com/org/repo.git

# Explicit SSH
aipm marketplace add team git@github.com:org/repo.git
```

### URL Source (Remote marketplace.json)

For CDN-hosted marketplaces:

```json
{
  "marketplaces": {
    "cdn": {
      "source": "url",
      "url": "https://cdn.example.com/marketplace.json"
    }
  }
}
```

This fetches the marketplace.json from a remote URL and caches it locally.

**Usage:**

```bash
aipm marketplace add cdn https://cdn.example.com/marketplace.json
```

### Auto-Detection

The `marketplace add` command automatically detects the source type:

- **GitHub shorthand**: `owner/repo` format (e.g., `my-org/my-plugins`)
- **marketplace.json URL**: URLs ending with `.json`
- **Git repository**: URLs containing `.git`, `github.com`, `gitlab.com`, or `bitbucket.org`
- **Directory**: Everything else (local paths)

---

## Marketplace Manifest (Optional)

Marketplaces can include a `marketplace.json` file to provide metadata and curate which plugins are available. If present, the marketplace will only expose plugins listed in this file.

```json
{
  "name": "company-tools",
  "owner": {
    "name": "DevTools Team",
    "email": "team@example.com"
  },
  "metadata": {
    "description": "Internal development tools",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "code-reviewer",
      "source": "./plugins/code-reviewer",
      "description": "Automated code review assistant",
      "version": "2.1.0",
      "author": {
        "name": "DevTools Team"
      }
    },
    {
      "name": "test-generator",
      "source": "./tools/testing/test-gen",
      "description": "Generate test cases",
      "version": "1.5.3"
    }
  ]
}
```

**Benefits of marketplace.json:**

- **Curated plugins**: Only expose specific plugins, not all directories
- **Custom paths**: Map plugin names to any directory structure (e.g., monorepos)
- **Rich metadata**: Include descriptions, versions, authors
- **Remote hosting**: Serve just the marketplace.json from a CDN

**Backward compatibility**: If no marketplace.json is present, the marketplace will scan all subdirectories as plugins.

---

## Plugin Configuration

Configure individual plugins in `.cursor/plugins.json`:

```json
{
  "plugins": {
    "my-plugin@local": {
      "enabled": true,
      "scope": "project",
      "version": "1.0.0"
    }
  }
}
```

### Configuration Fields

- **enabled** (required): `true` or `false`
- **scope** (optional): `"project"` or `"global"`
- **version** (optional): Plugin version constraint

All fields except `enabled` are optional.

---

## Configuration Merging

aipm merges configurations in this order (later overrides earlier):

1. Global config (`~/.cursor/plugins.json`)
2. Project config (`.cursor/plugins.json`)
3. Local config (`.cursor/plugins.local.json`)

### Example Use Cases

**Team shared config** (`.cursor/plugins.json`):

```json
{
  "marketplaces": {
    "team": {
      "source": "git",
      "url": "https://github.com/company/plugins.git"
    }
  },
  "plugins": {
    "linter@team": { "enabled": true },
    "formatter@team": { "enabled": true }
  }
}
```

**Personal overrides** (`.cursor/plugins.local.json`):

```json
{
  "plugins": {
    "experimental-feature@team": { "enabled": true }
  }
}
```

---

## Git Marketplace Caching

For git marketplaces, `aipm sync`:

1. Clones the repository to `~/.cursor/marketplace/cache/<marketplace-name>/` on first sync
2. Pulls updates on subsequent syncs
3. Force-resets the cache to ensure a clean state from the remote repository
4. Copies enabled plugins to `.cursor/marketplace/<marketplace>/<plugin>/`

**Note:** The cache is always force-reset during sync to ensure a clean state from the remote repository.

---

## Complete Configuration Example

```json
{
  "marketplaces": {
    "local": {
      "source": "directory",
      "path": "./marketplaces/local"
    },
    "team-plugins": {
      "source": "git",
      "url": "https://github.com/team/cursor-plugins.git",
      "branch": "main"
    },
    "community": {
      "source": "git",
      "url": "git@github.com:cursor-community/plugins.git"
    },
    "cdn": {
      "source": "url",
      "url": "https://cdn.example.com/marketplace.json"
    }
  },
  "plugins": {
    "my-plugin@local": {
      "enabled": true,
      "scope": "project"
    },
    "team-tool@team-plugins": {
      "enabled": true,
      "version": "1.2.0"
    },
    "community-plugin@community": {
      "enabled": false
    }
  }
}
```

---

## Troubleshooting

### Configuration not loading

Check file locations:

```bash
# Project config
cat .cursor/plugins.json

# Global config
cat ~/.cursor/plugins.json

# Local config
cat .cursor/plugins.local.json
```

### Marketplace path issues

Use absolute paths or paths relative to project root:

```json
{
  "path": "./marketplaces/local" // ✓ Relative to project
}
```

### Git authentication

For private repositories, use SSH or configure git credentials:

```bash
# Test repository access
git clone <repository-url>
```

---

## Related

- [Tutorial: Getting Started](../tutorials/getting-started.md)
- [How-to: Create a Marketplace](./create-marketplace.md)
- [Reference: CLI Commands](../reference/cli-commands.md)
