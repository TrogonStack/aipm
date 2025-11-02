# aipm

**aipm (AI Plugin Manager) is a universal package manager that synchronizes plugins across AI coding assistants from multiple marketplaces.**

Install plugins once, use them everywhere. aipm enables teams to share curated plugin collections across Claude Code, Cursor, and other AI assistants. Sync from local directories, git repositories, or remote URLs—all through a single configuration file.

## Features

- **Multiple Sources** - Local directories, git repositories, remote URLs, GitHub shorthand
- **Complete Lifecycle** - Install, uninstall, enable, disable, search, and update
- **Flexible Config** - Three-way merge (global, project, local)
- **Production Ready** - 92%+ test coverage, type-safe, cross-platform

## Installation

Download the latest binary for your platform from [GitHub Releases](https://github.com/TrogonStack/aipm/releases):

```bash
# macOS (Apple Silicon)
curl -fsSL https://github.com/TrogonStack/aipm/releases/latest/download/aipm-darwin-arm64 -o aipm
chmod +x aipm
sudo mv aipm /usr/local/bin/

# macOS (Intel)
curl -fsSL https://github.com/TrogonStack/aipm/releases/latest/download/aipm-darwin-x64 -o aipm
chmod +x aipm
sudo mv aipm /usr/local/bin/

# Linux (x64)
curl -fsSL https://github.com/TrogonStack/aipm/releases/latest/download/aipm-linux-x64 -o aipm
chmod +x aipm
sudo mv aipm /usr/local/bin/

# Linux (ARM64)
curl -fsSL https://github.com/TrogonStack/aipm/releases/latest/download/aipm-linux-arm64 -o aipm
chmod +x aipm
sudo mv aipm /usr/local/bin/

# Windows (x64) - download manually from releases page
```

See [INSTALLATION.md](./INSTALLATION.md) for more installation options.

## Quick Start

```bash
# Initialize in your project
aipm init

# Add a marketplace
aipm marketplace add team https://github.com/your-org/plugins.git

# Search for plugins
aipm plugin search

# Install a plugin
aipm plugin install my-plugin@team

# Sync all enabled plugins
aipm sync
```

### Common Commands

```bash
# Marketplace management
aipm marketplace add <name> <source>
aipm marketplace list
aipm marketplace update <name>

# Plugin management
aipm plugin search [query]
aipm plugin install <plugin@marketplace>
aipm plugin enable <plugin@marketplace>
aipm plugin disable <plugin@marketplace>
aipm plugin uninstall <plugin@marketplace>

# Sync and info
aipm sync
aipm list
aipm info <plugin@marketplace>
```

## Documentation

For detailed guides and references, see the [documentation](./docs/):

- **[Getting Started Tutorial](./docs/tutorials/getting-started.md)** - Step-by-step guide
- **[Configuration Guide](./docs/how-to/configure-aipm.md)** - Marketplace sources, config options
- **[Create a Plugin](./docs/tutorials/first-plugin.md)** - Build your first plugin
- **[Create a Marketplace](./docs/how-to/create-marketplace.md)** - Set up a team marketplace
- **[CLI Commands Reference](./docs/reference/cli-commands.md)** - Complete command list
- **[Debug Plugins](./docs/how-to/debug-plugins.md)** - Troubleshooting guide

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with ❤️ by the Straw Hat Team**
