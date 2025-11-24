# How to Debug Plugin Issues

**Goal**: Troubleshoot common plugin problems  
**Time**: 5-15 minutes  
**Difficulty**: Beginner to Intermediate

---

## Quick Diagnostics

Start with these commands to gather information:

```bash
# Check installed plugins
aipm list

# Check marketplaces
aipm marketplace list

# Check specific plugin
aipm info my-plugin@my-marketplace

# Re-sync everything
aipm sync
```

---

## Common Issues

### Plugin Not Found

**Symptom**: `Error: Plugin 'my-plugin' not found in marketplace`

**Solutions**:

1. **Check marketplace has the plugin**:

   ```bash
   aipm plugin search my-plugin
   ```

2. **Update marketplace**:

   ```bash
   aipm marketplace update my-marketplace
   ```

3. **Check marketplace.json**:

   ```bash
   # For git marketplaces, clone and inspect
   git clone {marketplace-url} /tmp/check-marketplace
   cat /tmp/check-marketplace/marketplace.json
   ```

4. **Verify plugin exists in source**:
   - For local: Check directory exists
   - For git: Check branch/tag
   - For URL: Check URL is accessible

---

### Plugin Installed But Not Working

**Symptom**: Plugin shows as installed but commands don't work

**Solutions**:

1. **Check if enabled**:

   ```bash
   aipm list
   # Should show "enabled" not "disabled"
   ```

2. **Enable if disabled**:

   ```bash
   aipm plugin enable my-plugin@my-marketplace
   ```

3. **Re-sync**:

   ```bash
   aipm sync
   ```

4. **Check plugin files**:

   ```bash
   # Files should exist in .cursor/{type}/aipm/
   ls -la .cursor/commands/aipm/my-marketplace/my-plugin/
   ls -la .cursor/rules/aipm/my-marketplace/my-plugin/
   ```

5. **Restart Claude Code** (if using with Claude Code)

---

### Git Clone Failures

**Symptom**: `Failed to clone git repository`

**Solutions**:

1. **Test git access**:

   ```bash
   git clone {repository-url} /tmp/test-clone
   ```

2. **Check SSH keys** (for SSH URLs):

   ```bash
   ssh -T git@github.com
   # Should see: "Hi username! You've successfully authenticated"
   ```

3. **Try HTTPS instead**:

   ```bash
   aipm marketplace remove my-marketplace
   aipm marketplace add my-marketplace https://github.com/user/repo.git
   ```

4. **Check branch exists**:
   ```bash
   git ls-remote {repository-url}
   ```

---

### Config File Errors

**Symptom**: `Failed to load config` or `Invalid JSON`

**Solutions**:

1. **Validate JSON**:

   ```bash
   cat .aipm/config.json | jq .
   # If error, fix the JSON syntax
   ```

2. **Backup and reinitialize**:

   ```bash
   mv .aipm/config.json .aipm/config.json.backup
   aipm init
   # Then manually merge your config back
   ```

3. **Check file permissions**:
   ```bash
   ls -la .aipm/config.json
   chmod 644 .aipm/config.json
   ```

---

### Marketplace Update Fails

**Symptom**: `Failed to update marketplace`

**Solutions**:

1. **Check disk space**:

   ```bash
   # Linux/macOS
   df -h ~/.cache/aipm/

   # Windows
   dir "%LOCALAPPDATA%\aipm\cache"
   ```

2. **Clear cache and retry**:

   ```bash
   # Linux/macOS
   rm -rf ~/.cache/aipm/my-marketplace

   # Windows
   rmdir /s /q "%LOCALAPPDATA%\aipm\cache\my-marketplace"

   aipm marketplace update my-marketplace
   ```

3. **Check git repository is accessible**:
   ```bash
   git ls-remote {repository-url}
   ```

---

### Permission Errors

**Symptom**: `Permission denied` or `EACCES`

**Solutions**:

1. **Check directory permissions**:

   ```bash
   ls -la .cursor/
   chmod 755 .cursor/
   ```

2. **Check file ownership**:

   ```bash
   ls -la .aipm/config.json
   # If owned by root, fix it:
   sudo chown $USER:$USER .aipm/config.json
   ```

3. **Don't use sudo**:

   ```bash
   # BAD - Don't do this
   sudo aipm install ...

   # GOOD - Do this
   aipm install ...
   ```

---

### Plugin Conflicts

**Symptom**: Two plugins provide same command

**Solutions**:

1. **Check which plugins are enabled**:

   ```bash
   aipm list
   ```

2. **Disable one**:

   ```bash
   aipm plugin disable conflicting-plugin@marketplace
   ```

3. **Check plugin documentation** for command list

---

## Advanced Debugging

### Verbose Mode

Run with `--dry-run` to see what would happen:

```bash
aipm plugin install my-plugin@marketplace --dry-run
aipm sync --dry-run
```

### Inspect Cache

```bash
# Check git cache
# Linux/macOS
ls -la ~/.cache/aipm/

# Check specific marketplace cache
ls -la ~/.cache/aipm/my-marketplace/

# Windows
dir "%LOCALAPPDATA%\aipm\cache"
dir "%LOCALAPPDATA%\aipm\cache\my-marketplace"
```

### Check Synced Files

```bash
# Project-level (plugin files are split by type)
ls -la .cursor/commands/aipm/
ls -la .cursor/rules/aipm/

# Check specific plugin files
find .cursor/*/aipm/ -name "*.md"
```

### Manual Validation

```bash
# Check marketplace.json is valid
# Linux/macOS
cat ~/.cache/aipm/my-marketplace/marketplace.json | jq .

# Windows (PowerShell)
Get-Content "$env:LOCALAPPDATA\aipm\cache\my-marketplace\marketplace.json" | ConvertFrom-Json
```

---

## Getting Help

If you're still stuck:

1. **Gather information**:

   ```bash
   aipm list > debug-output.txt
   aipm marketplace list >> debug-output.txt
   ```

2. **Check logs** (if available):

   ```bash
   # Project logs
   ls -la .cursor/

   # Global logs
   ls -la ~/.aipm/
   ```

3. **Create minimal reproduction**:

   ```bash
   # Start fresh in temp directory
   cd /tmp
   mkdir test-cursor
   cd test-cursor
   git init
   aipm init --example
   # Try to reproduce the issue
   ```

4. **Open issue** with:
   - Output from `aipm list`
   - Error message (full text)
   - Steps to reproduce
   - Operating system
   - aipm version

---

## Prevention

### Best Practices

1. **Use `--dry-run` first**:

   ```bash
   aipm sync --dry-run
   # Check output, then run for real
   aipm sync
   ```

2. **Backup configs**:

   ```bash
   cp .aipm/config.json .aipm/config.json.backup
   ```

3. **Version control configs**:

   ```bash
   git add .aipm/config.json
   git commit -m "chore: update plugin config"
   ```

4. **Keep marketplace updated**:

   ```bash
   aipm marketplace update my-marketplace
   ```

5. **Test in isolation**:
   ```bash
   # Test new plugins in a separate project first
   cd /tmp/test-project
   aipm init
   # Test the plugin here
   ```

---

## Related

- [Reference: CLI Commands](../reference/cli-commands.md)
