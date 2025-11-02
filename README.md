# aipm

**A plugin manager for AI coding assistants.**

Install plugins once, use them everywhere. Manage curated plugin collections across Claude Code, Cursor, and other AI assistants from multiple marketplace sources.

Inspired by [Claude Code's plugin marketplace system](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces), extended to work across multiple AI assistants.

## Quick Start

```bash
# Install (recommended: using mise)
mise use -g ubi:TrogonStack/aipm

# Or download pre-built binary for your platform
# See INSTALLATION.md for platform-specific download commands

# Use
aipm init
aipm marketplace add team https://github.com/your-org/plugins.git
aipm plugin install my-plugin@team
```

## Documentation

**See [docs/](./docs/) for complete documentation.**

The documentation follows the [Diátaxis framework](https://diataxis.fr/):

- **[Tutorials](./docs/tutorials/)** - Learn by doing
- **[How-To Guides](./docs/how-to/)** - Solve specific problems
- **[Explanation](./docs/explanation/)** - Understand concepts
- **[Reference](./docs/reference/)** - Look up details

**New to aipm?** Start with the [Getting Started Tutorial](./docs/tutorials/getting-started.md).

## Links

- **[Installation Guide](./INSTALLATION.md)** - Platform-specific installation
- **[Contributing Guide](./CONTRIBUTING.md)** - Development setup
- **[License](./LICENSE)** - MIT License
