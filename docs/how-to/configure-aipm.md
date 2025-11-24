# How to Configure aipm

This guide shows you how to configure aipm for common scenarios.

> **Prerequisites**: You should have completed the [Getting Started tutorial](../tutorials/getting-started.md) and understand basic aipm concepts.

---

## Initialize a project

Create configuration files for a new project:

```bash
aipm init
```

This creates `.aipm/config.json` for team settings and `.aipm/config.local.json.example` as a template for personal overrides.

---

## Disable syncing to Cursor

To stop syncing plugins to `.cursor/` directory:

1. Open `.aipm/config.json` or `.aipm/config.local.json`
2. Add the `integrations` section:

```json
{
  "integrations": {
    "cursor": {
      "enabled": false
    }
  }
}
```

3. Run `aipm sync`

---

## Sync only specific plugin types

To sync only rules and commands (exclude agents, skills, hooks):

1. Edit your config file:

```json
{
  "integrations": {
    "cursor": {
      "include": {
        "rules": true,
        "commands": true,
        "agents": false,
        "skills": false,
        "hooks": false
      }
    }
  }
}
```

2. Run `aipm sync`

**Tip**: Types default to `true` if not specified. Only set the ones you want to disable.

---

## Override project settings locally

To customize settings for yourself without affecting the team:

1. Create `.aipm/config.local.json` in your project
2. Add only the settings you want to override:

```json
{
  "integrations": {
    "cursor": {
      "include": {
        "agents": false
      }
    }
  }
}
```

3. Add `.aipm/config.local.json` to `.gitignore` (done automatically by `aipm init`)

Your local config merges with the project config, overriding only what you specify.

---

## Add a local marketplace

To use plugins from a local directory:

```bash
aipm marketplace add local ./path/to/marketplace
```

---

## Add a GitHub marketplace

For public repositories:

```bash
aipm marketplace add team owner/repo
```

For private repositories using SSH:

```bash
aipm marketplace add team git@github.com:owner/repo.git
```

---

## Add a marketplace from a specific branch

```bash
aipm marketplace add team https://github.com/owner/repo.git
# Then edit .aipm/config.json and add:
```

```json
{
  "marketplaces": {
    "team": {
      "source": "git",
      "url": "https://github.com/owner/repo.git",
      "branch": "develop"
    }
  }
}
```

---

## Use SSH by default for GitHub

To make aipm use SSH for all GitHub repositories:

1. Configure git to prefer SSH:

```bash
git config --global url."ssh://git@github.com/".insteadOf "https://github.com/"
```

2. Now shorthand will use SSH:

```bash
aipm marketplace add team owner/repo
# Uses: git@github.com:owner/repo.git
```

---

## Enable a plugin

```bash
aipm plugin install my-plugin@marketplace-name
```

Or manually edit `.aipm/config.json`:

```json
{
  "plugins": {
    "my-plugin@marketplace-name": {
      "enabled": true
    }
  }
}
```

Then run `aipm sync`.

---

## Disable a plugin temporarily

```bash
aipm plugin disable my-plugin@marketplace-name
```

Or set `enabled: false` in your config.

---

## Share global settings across projects

To use the same marketplaces in all your projects:

1. Create global config:

   **Linux/macOS:** `~/.config/aipm/config.json`  
   **Windows:** `%APPDATA%\aipm\config.json`

```json
{
  "marketplaces": {
    "team": {
      "source": "git",
      "url": "https://github.com/company/plugins.git"
    }
  }
}
```

2. All projects will now have access to these marketplaces without adding them individually.

---

## Fix: Private repository authentication fails

If `aipm sync` fails with authentication errors:

1. **For HTTPS**: Configure git credentials:

```bash
git config --global credential.helper store
git clone https://github.com/owner/repo.git  # Enter credentials once
```

2. **For SSH**: Set up SSH keys:

```bash
ssh-keygen -t ed25519 -C "your@email.com"
# Add ~/.ssh/id_ed25519.pub to GitHub
ssh -T git@github.com  # Test connection
```

3. Use SSH URLs in your config:

```bash
aipm marketplace add team git@github.com:owner/repo.git
```

---

## See also

- [Tutorial: Getting Started](../tutorials/getting-started.md) - Learn aipm basics
- [How-to: Create a Marketplace](./create-marketplace.md) - Build your own plugin marketplace
