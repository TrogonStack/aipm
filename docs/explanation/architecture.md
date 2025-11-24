# Architecture Overview

aipm follows a **layered architecture** with clear separation of concerns.

## System Design

```mermaid
graph TD
    A[CLI Layer<br/>cli.ts] --> B[Commands Layer<br/>commands/]
    B --> C[Config Layer<br/>config/]
    B --> D[Helpers Layer<br/>helpers/]
    C --> E[External Systems<br/>Git, FS]
    D --> E
```

| Layer    | Responsibility                      |
| -------- | ----------------------------------- |
| CLI      | Parse arguments, route to commands  |
| Commands | Business logic for each command     |
| Config   | Load, merge, validate configuration |
| Helpers  | Shared utilities (git, fs, sync)    |

---

## Data Flow

### Plugin Installation

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Config
    participant Marketplace
    participant FS

    User->>CLI: aipm plugin install my-plugin@local
    CLI->>Config: Load config (three-way merge)
    CLI->>Marketplace: Resolve marketplace path
    Marketplace-->>CLI: Clone/pull if git, or use local path
    CLI->>FS: Copy files to .cursor/{type}/aipm/
    CLI->>Config: Save updated config
    CLI->>User: Success message
```

### Sync Flow

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Config
    participant FS

    User->>CLI: aipm sync
    CLI->>Config: Load enabled plugins
    loop Each enabled plugin
        CLI->>FS: Copy to .cursor/{type}/aipm/{marketplace}/{plugin}/
    end
    CLI->>User: Summary
```

---

## File Locations

```
~/.config/aipm/config.json          # Global config
~/.cache/aipm/{marketplace}/        # Git marketplace clones

.aipm/
├── config.json                     # Project config (committed)
└── config.local.json               # Local overrides (gitignored)

.cursor/
├── commands/aipm/{marketplace}/{plugin}/
├── rules/aipm/{marketplace}/{plugin}/
├── agents/aipm/{marketplace}/{plugin}/
├── skills/aipm/{marketplace}/{plugin}/
└── hooks/aipm/{marketplace}/{plugin}/
```

---

## Config Priority

```mermaid
graph TD
    A[Local: .aipm/config.local.json] -->|overrides| B[Project: .aipm/config.json]
    B -->|overrides| C[Global: ~/.config/aipm/config.json]
```

---

## Marketplace Resolution

```mermaid
graph LR
    subgraph Sources
        A[Local Directory]
        B[Git Repository]
        C[Remote URL]
    end

    A --> D[Use path directly]
    B --> E[Clone to ~/.cache/aipm/]
    C --> F[Fetch & cache marketplace.json]

    D --> G[Scan for plugins]
    E --> G
    F --> G
```

---

## Design Principles

1. **Explicit over implicit** - Config files are explicit, paths are absolute
2. **Composable** - Small functions, utilities work independently
3. **Type-safe** - TypeScript strict mode, Zod validation
4. **Testable** - Dependency injection, pure functions
5. **User-friendly** - `--dry-run`, helpful errors

---

## Extension Points

| Extension            | Steps                                                         |
| -------------------- | ------------------------------------------------------------- |
| New command          | Create `src/commands/my-command.ts`, register in `cli.ts`     |
| New marketplace type | Add to `MarketplaceSource`, update `resolveMarketplacePath()` |
| New sync strategy    | Implement in `sync-strategy.ts`, add config option            |
