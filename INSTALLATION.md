# Installation Guide

## mise (Recommended)

[mise](https://mise.jdx.dev/) is a polyglot tool version manager. Install aipm from GitHub releases:

```bash
# Install using ubi backend
mise use -g ubi:TrogonStack/aipm

# Verify installation
aipm --version
```

**Note**: Requires mise >= 2024.1.0 with [ubi backend](https://mise.jdx.dev/dev-tools/backends/ubi.html) support.

### Install specific version

```bash
mise use -g ubi:TrogonStack/aipm@0.4.0
```

### Update

```bash
mise upgrade aipm
```

## Pre-built Binaries

Download pre-built executables from the [releases page](https://github.com/TrogonStack/aipm/releases).

### macOS

```bash
# Apple Silicon
curl -fsSL https://github.com/TrogonStack/aipm/releases/latest/download/aipm-darwin-arm64 -o aipm
chmod +x aipm
sudo mv aipm /usr/local/bin/

# Intel
curl -fsSL https://github.com/TrogonStack/aipm/releases/latest/download/aipm-darwin-x64 -o aipm
chmod +x aipm
sudo mv aipm /usr/local/bin/

# Verify installation
aipm --version
```

### Linux

```bash
# x64
curl -fsSL https://github.com/TrogonStack/aipm/releases/latest/download/aipm-linux-x64 -o aipm
chmod +x aipm
sudo mv aipm /usr/local/bin/

# ARM64
curl -fsSL https://github.com/TrogonStack/aipm/releases/latest/download/aipm-linux-arm64 -o aipm
chmod +x aipm
sudo mv aipm /usr/local/bin/

# Verify installation
aipm --version
```

### Windows

Download the latest `aipm.exe` from the [releases page](https://github.com/TrogonStack/aipm/releases).

1. Download `aipm-windows-x64.exe`
2. Rename to `aipm.exe`
3. Move to a directory in your PATH
4. Verify: `aipm --version`

## Build from Source

### Prerequisites

- [Bun](https://bun.sh) >= 1.2.0
- Git

### Steps

```bash
# Clone the repository
git clone https://github.com/TrogonStack/aipm.git
cd aipm

# Install dependencies
bun install

# Build executable for your platform
bun run build

# Install to system path (macOS/Linux)
sudo cp dist/aipm /usr/local/bin/

# Or create a symlink
sudo ln -s "$(pwd)/dist/aipm" /usr/local/bin/aipm

# Verify installation
aipm --version
```

## Development Installation

For contributing or local development:

```bash
# Clone and install
git clone https://github.com/TrogonStack/aipm.git
cd aipm
bun install

# Run directly without building
bun run src/cli.ts <command>

# Or use watch mode
bun run dev
```

## Verification

After installation, verify it works:

```bash
# Check version
aipm --version

# View help
aipm --help

# Initialize a project
cd your-project
aipm init
```

## Troubleshooting

### Command not found

**Issue**: `aipm: command not found`

**Solutions**:

1. Ensure the binary is in a directory in your PATH
2. Use full path: `/usr/local/bin/aipm`
3. Add custom directory to PATH:
   ```bash
   export PATH="$PATH:/path/to/aipm"
   ```

### Permission denied

**Issue**: `Permission denied` when running the binary

**Solution**:

```bash
chmod +x /path/to/aipm
```

### Binary won't run (macOS)

**Issue**: macOS blocks unsigned binary

**Solution**:

```bash
# Remove quarantine attribute
xattr -d com.apple.quarantine /path/to/aipm

# Or allow in System Settings > Security & Privacy
```

## Updating

### Pre-built Binary

Download the latest release and replace the old binary:

```bash
# Download new version (example for macOS Apple Silicon)
curl -fsSL https://github.com/TrogonStack/aipm/releases/latest/download/aipm-darwin-arm64 -o aipm
chmod +x aipm
sudo mv aipm /usr/local/bin/
```

### From Source

```bash
cd aipm
git pull
bun install
bun run build
sudo cp dist/aipm-*/bin/aipm /usr/local/bin/
```

## Uninstallation

```bash
# Remove the binary
sudo rm /usr/local/bin/aipm

# Clean up config (optional)
rm -rf ~/.cursor/marketplace
```

## Next Steps

After installation, see the [README.md](./README.md) for usage instructions.
