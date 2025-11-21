# Architecture Overview

This document explains how aipm is designed and how its components work together.

---

## System Design

aipm follows a **layered architecture** with clear separation of concerns:

```
???????????????????????????????????????????
?           CLI Layer (cli.ts)            ?  ? User interaction
???????????????????????????????????????????
?      Commands Layer (commands/)         ?  ? Business logic
???????????????????????????????????????????
?       Config Layer (config/)            ?  ? Configuration management
???????????????????????????????????????????
?       Utils Layer (utils/)              ?  ? Shared utilities
???????????????????????????????????????????
?     External Systems (Git, FS)          ?  ? Infrastructure
???????????????????????????????????????????
```

---

## Core Components

### 1. CLI Layer

**Responsibility**: Parse arguments and route to commands

**Key file**: `src/cli.ts`

**What it does**:

- Parses command-line arguments using Node's `parseArgs`
- Routes to appropriate command handler
- Handles `--help`, `--version`, global flags
- Catches and displays errors

**Example flow**:

```
$ aipm plugin install my-plugin@local
    ?
cli.ts parses args ? { command: "plugin", subcommand: "install", pluginId: "my-plugin@local" }
    ?
Calls: pluginInstall({ pluginId: "my-plugin@local", ... })
```

---

### 2. Commands Layer

**Responsibility**: Implement business logic for each command

**Location**: `src/commands/`

**Key commands**:

- `init.ts` - Initialize project configuration
- `sync.ts` - Sync plugins from marketplaces
- `marketplace-*.ts` - Marketplace management
- `plugin-*.ts` - Plugin management

**Common pattern**:

```typescript
export async function commandName(options: Options) {
  // 1. Validate options (using Zod)
  const validated = OptionsSchema.parse(options);

  // 2. Load config
  const config = await loadPluginsConfig();

  // 3. Perform operation
  // ... business logic ...

  // 4. Save config (if needed)
  await writeConfig(config);

  // 5. Provide feedback
  console.log('? Success!');
}
```

---

### 3. Config Layer

**Responsibility**: Load, merge, and validate configuration

**Location**: `src/config/`

**Key files**:

- `loader.ts` - Three-way config merge
- `schema.ts` - TypeScript types
- `validation.ts` - Zod schemas

**Three-way merge**:

```typescript
// Priority: local > project > global
const config = mergeConfigs(
  globalConfig, // ~/.aipm/config.json
  projectConfig, // .aipm/config.json
  localConfig, // .aipm/config.local.json (gitignored)
);
```

See [Configuration System](./config-system.md) for details.

---

### 4. Utils Layer

**Responsibility**: Shared utilities and helpers

**Location**: `src/utils/`

**Key modules**:

- `git.ts` - Git operations (clone, pull, cache)
- `fs.ts` - File system operations
- `marketplace.ts` - Marketplace resolution
- `plugin.ts` - Plugin operations
- `sync-strategy.ts` - Sync algorithm
- `paths.ts` - Path resolution
- `github.ts` - GitHub URL handling
- `io.ts` - User input/output

---

## Data Flow

### Installing a Plugin

```
User: aipm plugin install my-plugin@local
  ?
1. CLI parses command
  ?
2. pluginInstall() called
  ?
3. Load config (three-way merge)
  ?
4. Parse pluginId ? { name: "my-plugin", marketplace: "local" }
  ?
5. Check if plugin exists in marketplace
  ?
6. Enable plugin in config
  ?
7. Sync plugin files (via syncCommand)
  ?
8. Resolve marketplace path (git clone/pull if needed)
  ?
9. Copy plugin files to .cursor/marketplace/
  ?
10. Save config
  ?
11. Show success message
```

### Syncing Plugins

```
User: aipm sync
  ?
1. Load config
  ?
2. For each enabled plugin:
   a. Resolve marketplace path
      - Git: Clone to ~/.aipm/cache/ (or pull if exists)
      - Local: Use directory directly
      - URL: Fetch marketplace.json
   b. Find plugin source in marketplace
   c. Copy plugin files to .cursor/marketplace/{marketplace}/{plugin}/
  ?
3. Show summary
```

---

## Configuration Management

### File Locations

```
User's machine:
└ ~/.aipm/
    ├── config.json                    # Global config
    └── cache/
        └── {marketplace}/             # Git marketplace clones

Project:
└ .aipm/
    ├── config.json                    # Project config (committed)
    └── config.local.json              # Local overrides (gitignored)

└ .cursor/                              # Synced plugin content
    └── marketplace/
        └── {marketplace}/
            └── {plugin}/              # Plugin files
```

### Config Priority

```
Local (.aipm/config.local.json)
  ? overrides
Project (.aipm/config.json)
  ? overrides
Global (~/.aipm/config.json)
```

See [Configuration System](./config-system.md) for details.

---

## Marketplace Resolution

Different marketplace types are resolved differently:

### Local Directory

```
marketplace: { source: "directory", path: "./my-plugins" }
  ?
Resolve to absolute path
  ?
Scan directory for plugins
```

### Git Repository

```
marketplace: { source: "git", url: "https://github.com/user/plugins.git" }
  ?
Clone to ~/.aipm/cache/{marketplace-name}/
  (or pull if already exists)
  ?
Read marketplace.json from clone
  ?
Scan for plugins
```

### Remote URL

```
marketplace: { source: "url", url: "https://cdn.com/marketplace.json" }
  ?
Fetch marketplace.json
  ?
Cache to ~/.aipm/cache/{marketplace-name}/
  ?
Parse plugin list
```

See [Marketplace Types](./marketplace-types.md) for details.

---

## Plugin Sync Strategy

aipm uses a **copy-based sync strategy**:

1. **Resolve source**: Find where the plugin lives (marketplace path)
2. **Copy files**: Copy entire plugin directory to `.cursor/marketplace/`
3. **Preserve structure**: Maintain plugin directory structure

**Why copy instead of symlink?**

- Cross-platform compatibility (Windows support)
- No broken links if source moves
- Isolated per-project (different projects can have different versions)

See [Git Cache Strategy](./git-cache.md) for git-specific details.

---

## Error Handling

aipm uses a **fail-fast** approach:

```typescript
// Validate early
const options = OptionsSchema.parse(input); // Throws if invalid

// Check preconditions
if (!configExists) {
  throw new Error("Run 'aipm init' first");
}

// Atomic operations where possible
// Either complete fully or rollback
```

**Error bubbling**:

```
Utils layer throws
  ?
Commands layer catches, adds context
  ?
CLI layer catches, formats for user
  ?
process.exit(1)
```

---

## Testing Strategy

aipm uses **test doubles** for external dependencies:

```typescript
// Mock file system
const mockFS = {
  readFile: async () => 'mock content',
  writeFile: async () => {},
};

// Mock IO
const mockIO = new MockIO();
mockIO.confirmResponses = [true]; // Auto-confirm prompts

// Test commands in isolation
await command({ io: mockIO, fs: mockFS });
```

See [Testing Guide](../../TESTING.md) for details.

---

## Design Principles

### 1. **Explicit over implicit**

- Config files are explicit (not hidden magic)
- All paths are absolute when resolved
- Clear error messages

### 2. **Composable**

- Small, focused functions
- Utilities can be used independently
- Commands build on utils

### 3. **Type-safe**

- TypeScript strict mode
- Zod runtime validation
- Catch errors at boundaries

### 4. **Testable**

- Dependency injection (IO, FS)
- Pure functions where possible
- Integration tests for workflows

### 5. **User-friendly**

- `--dry-run` for safety
- Helpful error messages
- Progress feedback

---

## Extension Points

aipm is designed to be extended:

### Adding New Commands

1. Create `src/commands/my-command.ts`
2. Define options schema in `src/config/validation.ts`
3. Register in `src/cli.ts`
4. Add tests in `tests/commands/my-command.test.ts`

### Adding New Marketplace Types

1. Add type to `MarketplaceSource` in `src/config/schema.ts`
2. Update `resolveMarketplacePath()` in `src/utils/git.ts`
3. Add validation in `src/config/validation.ts`
4. Add tests

### Adding New Sync Strategies

1. Implement strategy in `src/utils/sync-strategy.ts`
2. Add configuration option
3. Update `syncCommand()` to use new strategy

---

## Performance Considerations

### Git Operations

- **Shallow clones**: Uses `--depth 1` for faster clones
- **Caching**: Git repos cached in `~/.aipm/cache/`
- **Lazy updates**: Only pulls when `marketplace update` called

### File Operations

- **Batch copies**: Uses efficient file copying
- **Concurrent ops**: Multiple plugins synced in parallel (future)
- **Skip unchanged**: Only copies if source changed (future)

### Configuration

- **Lazy loading**: Config only loaded when needed
- **Minimal parsing**: Uses streaming JSON where possible
- **No watchers**: Explicit sync, no file watching overhead

---

## Security Considerations

### Git Clones

- **Force reset**: Always reset to remote state (prevent tampering)
- **Clean untracked**: Remove untracked files on update
- **No auto-exec**: Never execute code from plugins during sync

### File Paths

- **Path traversal protection**: Validate all paths
- **Absolute paths**: Resolve to absolute to prevent confusion
- **No hidden writes**: All file operations logged

### Configuration

- **Local overrides**: Secrets go in `.aipm/config.local.json` (gitignored)
- **Validation**: All configs validated with Zod schemas
- **No eval**: No dynamic code execution

See [Security Policy](../../SECURITY.md) for more.

---

## Future Architecture

Potential improvements:

### Plugin API

- Plugins could define TypeScript APIs
- Version compatibility checking
- Dependency resolution between plugins

### Remote Registry

- Central plugin registry (like npm)
- Publishing workflow
- Automatic updates

### Performance

- Parallel sync operations
- Incremental updates (only changed files)
- Content-addressable storage (like git)

---

## Related

- [Configuration System](./config-system.md) - Config details
- [Git Cache Strategy](./git-cache.md) - Git operations
- [Plugin Lifecycle](./plugin-lifecycle.md) - Plugin states
- [Design Decisions](./design-decisions.md) - Why we made these choices
