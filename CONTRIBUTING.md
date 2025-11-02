# Contributing to aipm

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) >= 1.2.0
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/TrogonStack/aipm.git
cd aipm

# Install dependencies
bun install
```

## Development Workflow

### Running the CLI in Development

```bash
# Watch mode (recompiles on changes)
bun run dev

# Direct execution
bun run src/cli.ts <command>
```

### Testing

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Coverage report
bun run test:coverage
```

### Code Quality

```bash
# Format code
bun run format

# Check formatting
bun run format:check

# Type check
bun run typecheck

# Run all CI checks locally
bun run ci
```

### Building

Build standalone executables:

```bash
# Build for your current platform (for local testing)
bun run build

# Build for all platforms (used by CI/release)
bun run build:all
```

This creates standalone executables in `dist/` - self-contained binaries that include the Bun runtime and all dependencies (~61MB per platform).

#### Testing Your Local Build

To test your local build, install it to your system:

```bash
# Install your local build (macOS ARM64 example)
sudo cp dist/aipm-darwin-arm64 /usr/local/bin/aipm

# Or create a symlink to avoid copying
sudo ln -s "$(pwd)/dist/aipm-darwin-arm64" /usr/local/bin/aipm

# Verify it works
aipm --version
```

Use the appropriate binary for your platform:
- macOS ARM64: `dist/aipm-darwin-arm64`
- macOS Intel: `dist/aipm-darwin-x64`
- Linux x64: `dist/aipm-linux-x64`
- Linux ARM64: `dist/aipm-linux-arm64`
- Windows x64: `dist/aipm-windows-x64.exe`

## Project Structure

```
aipm/
??? src/
?   ??? commands/      # CLI command implementations
?   ??? config/        # Configuration loading and validation
?   ??? utils/         # Utility functions
??? tests/             # Test files (mirrors src/ structure)
??? .github/
    ??? workflows/     # CI/CD workflows
```

## Pull Request Process

1. **Fork and Clone**: Fork the repository and clone your fork
2. **Create a Branch**: Use descriptive branch names (`feature/add-x`, `fix/issue-y`)
3. **Make Changes**:
   - Follow existing code style
   - Add tests for new features
   - Update documentation as needed
4. **Test**: Run `bun run ci` to ensure all checks pass
5. **Commit**: Use clear, descriptive commit messages
6. **Push and PR**: Push to your fork and create a pull request

### PR Title Format

PR titles must follow Conventional Commits format (enforced by CI):

```
<type>(<optional scope>): <subject>
```

**Allowed types:**

- `feat`: New feature → triggers MINOR version bump
- `fix`: Bug fix → triggers PATCH version bump
- `refactor`: Code refactoring → appears in changelog, no version bump
- `chore`: Build process or auxiliary tool changes → hidden from changelog
- `revert`: Revert a previous change → appears in changelog, no version bump

**Manual version control:**

To trigger a version bump for non-`feat`/`fix` changes, add to PR body:

```
Release-As: patch
Release-As: minor
Release-As: major
```

## Adding New Commands

1. Create command file in `src/commands/`
2. Implement command function with proper error handling
3. Add tests in `tests/commands/`
4. Register command in CLI router (`src/cli.ts`)
5. Update README.md with usage examples

## Testing Guidelines

- Write tests for all new features
- Maintain >90% code coverage
- Use descriptive test names
- Test error cases and edge cases
- Use test fixtures for complex data

## Code Style

The project enforces consistent code style through:

- **Formatting**: Prettier with shared config (@straw-hat/prettier-config)
- **Type safety**: TypeScript strict mode with additional checks
- **Quality checks**: Automated via `bun run ci` before commits

## Release Process

Releases are fully automated via [release-please](https://github.com/googleapis/release-please):

1. Merge PRs to `main` with proper conventional commit types
2. Release-please automatically creates/updates a release PR
3. Merge the release PR to trigger:
   - Version bump in `package.json`
   - `CHANGELOG.md` update
   - Git tag creation
   - GitHub release with binaries for all platforms
   - Build provenance attestations
   - SBOM generation

No manual version management needed!

## Getting Help

- Open an issue for bugs or feature requests
- Join discussions for questions
- Review existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
