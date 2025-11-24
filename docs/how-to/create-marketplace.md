# How to Create a Private Marketplace

**Goal**: Set up a private plugin marketplace for your team  
**Time**: 10 minutes  
**Difficulty**: Intermediate

---

## Prerequisites

- Git repository (GitHub, GitLab, or Bitbucket)
- Plugins ready to distribute
- Team members with repository access

---

## Steps

### 1. Create Marketplace Repository

```bash
mkdir my-team-plugins
cd my-team-plugins
git init
```

### 2. Create Marketplace Manifest

Create `marketplace.json`:

```json
{
  "name": "acme-engineering",
  "owner": {
    "name": "ACME Engineering Team",
    "email": "eng@acme.com"
  },
  "metadata": {
    "description": "Internal development tools and workflows",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "code-reviewer",
      "source": "./plugins/code-reviewer",
      "description": "Automated code review assistant",
      "version": "1.0.0",
      "author": {
        "name": "DevTools Team"
      }
    }
  ]
}
```

### 3. Add Your Plugins

```bash
mkdir -p plugins/code-reviewer/.claude-plugin
```

Create plugin manifest and content (see [Creating Your First Plugin](../tutorials/first-plugin.md)).

### 4. Push to Git

```bash
git add .
git commit -m "chore: initial marketplace setup"
git push origin main
```

### 5. Share with Team

Team members can add your marketplace:

```bash
# Using GitHub shorthand
aipm marketplace add acme-eng acme/team-plugins

# Using full URL
aipm marketplace add acme-eng https://github.com/acme/team-plugins.git
```

---

## Private Repository Access

### Option 1: SSH Keys (Recommended)

Ensure team members have SSH keys configured:

```bash
# Test access
git clone git@github.com:acme/team-plugins.git

# Add marketplace using SSH
aipm marketplace add acme-eng git@github.com:acme/team-plugins.git
```

### Option 2: Personal Access Tokens

Use HTTPS with tokens:

```bash
# Create token at: https://github.com/settings/tokens
# Add marketplace
aipm marketplace add acme-eng https://<TOKEN>@github.com/acme/team-plugins.git
```

---

## Best Practices

### 1. Version Your Plugins

```json
{
  "plugins": [
    {
      "name": "my-plugin",
      "version": "1.2.3", // Use semantic versioning
      "source": "./plugins/my-plugin"
    }
  ]
}
```

### 2. Add README

Create `README.md`:

```markdown
# ACME Engineering Plugins

Internal plugins for ACME Engineering team.

## Installation

\`\`\`bash
aipm marketplace add acme-eng acme/team-plugins
aipm plugin install code-reviewer@acme-eng
\`\`\`

## Available Plugins

- **code-reviewer**: Automated code review
- **test-generator**: Generate test cases
```

### 3. Use Git Tags for Releases

```bash
git tag v1.0.0
git push origin v1.0.0
```

Team can pin to specific versions:

```bash
aipm marketplace add acme-eng acme/team-plugins --branch v1.0.0
```

### 4. Organize by Category

```
plugins/
??? code-quality/
?   ??? reviewer/
?   ??? linter/
??? testing/
?   ??? test-gen/
??? workflows/
    ??? deployment/
```

---

## Updating Marketplace

### Add New Plugin

1. Add plugin to `plugins/` directory
2. Update `marketplace.json`
3. Commit and push

```bash
git add .
git commit -m "feat: add test-generator plugin"
git push
```

Team members update:

```bash
aipm marketplace update acme-eng
aipm sync
```

### Update Existing Plugin

1. Make changes to plugin
2. Bump version in `marketplace.json`
3. Commit and push

Team members get updates:

```bash
aipm plugin update code-reviewer@acme-eng
```

---

## Advanced: Monorepo Structure

For large teams:

```
my-team-plugins/
??? marketplace.json          # Root manifest
??? plugins/
?   ??? backend/
?   ?   ??? marketplace.json  # Backend plugins
?   ??? frontend/
?   ?   ??? marketplace.json  # Frontend plugins
?   ??? devops/
?       ??? marketplace.json  # DevOps plugins
??? README.md
```

---

## Troubleshooting

### "Repository not found"

Check access:

```bash
git clone {repository-url}
```

### "Permission denied"

Configure SSH or use access token.

### Changes not appearing

Team members must update:

```bash
aipm marketplace update acme-eng
```
