# Installation Instructions

## Global Installation

To install `vibepoints` globally so you can run `vpoints` from any directory:

```bash
# Install globally from this directory
npm install -g .

# Or if you want to install from npm registry (once published)
npm install -g vibepoints
```

## Usage

After installation, you can run `vpoints` from any git repository:

```bash
cd /path/to/your/git/repo
vpoints
```

## Features After Global Installation

1. **Universal Access**: Run `vpoints` from any directory that contains a git repository
2. **Global Options**: Your audio and prefix settings are preserved across all projects in `~/.config/vibepoints/options.json`
3. **Directory-Specific Claude History**: The app automatically detects which Claude Code conversation history to use based on your current directory
4. **Git Repository Validation**: The app will only run in directories that are git repositories

## Directory Structure

After installation, your config will be stored in:
- **macOS/Linux**: `~/.config/vibepoints/options.json`
- **Sound files**: Bundled with the global installation

## Uninstalling

```bash
npm uninstall -g vibepoints
```

This will remove the global `vpoints` command but preserve your config file.