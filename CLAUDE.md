# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "checkpoints" - a terminal-based React app built with Ink that provides a git commit checkpoint management interface for Claude Code workflows. The app allows users to create, undo, and revert git commits with an interactive CLI interface.

## Architecture

- **Main Component**: `GitCommitHistoryApp` in `vpoints.js` - A React component rendered in the terminal using Ink
- **Git Integration**: Uses `simple-git` library for all git operations (commit history, staging, committing, undoing, reverting)
- **State Management**: React hooks for UI state (selected items, modals, animations, options)
- **Audio System**: `play-sound` integration with WAV files in `sounds/` directory
- **Persistent Options**: JSON file-based configuration stored in `options.json`

## Development Commands

```bash
# Start the app
npm start

# Development with auto-reload (watches for file changes)
npm run dev

# Syntax check only (for testing without running the full app)
node -c vpoints.js

# Global installation as 'vpoints' command
npm install -g github:mikehern/claudecode-git-checkpoints
```

## Key Features & Workflows

- **Checkpoint Creation**: Stages all changes and commits with the last Claude input as commit message
- **Interactive History**: Navigate through git commits with keyboard shortcuts
- **Undo/Revert**: Git reset and revert operations with confirmation dialogs
- **Claude Decide**: AI-powered commit message generation using Claude CLI with two styles:
  - **Vibecoder**: Creative, user-intent focused messages that connect user requests to implementation
  - **Prototyper**: Technical, conventional commit format based purely on code changes
- **Auto-checkpoint**: Automatic commit creation based on file changes with cooldown periods
- **Sound Effects**: Audio feedback for actions (can be disabled in options)
- **Custom Commit Messages**: Support for custom labels and descriptions

## State Structure

The app manages complex UI state including:

- Commit list navigation (selectedIndex, windowStart for scrolling)
- Modal states (showOptions, showUndoConfirm, showRevertConfirm, showClaudeDecide, etc.)
- Animation states (successAnimatingIndex, successAnimationProgress, autoCommitFlash)
- Form inputs (customLabel, customDescription)
- Git status (hasUncommittedChanges, currentFileChanges)
- Auto-checkpoint state (cooldown timers, flash animations, processing flags)
- Claude Decide state (loading animations, suggestions, error handling)

## Keyboard Shortcuts

- Navigation: Arrow keys, Enter for selection
- Exit: `x`, `q`, or `esc` to quit
- Context-specific shortcuts handled in `useInput` hook

## File Structure

- **Main app logic**: `vpoints.js` - Single-file React Ink application
- **Helper utilities**: `current-project-clean-history.js` - Extracts user inputs from Claude Code conversation logs
- **Audio assets**: `sounds/*.wav` - Sound effects (checkpoint.wav, exit.wav, menu-move.wav, next.wav, revert.wav)
- **Sample conversation files**: `sample/*.jsonl` - Example Claude Code conversation logs
- **Configuration**:
  - `options.json` - User preferences (audio, customPrefix, autoCheckpoint)
  - `~/.config/checkpoints/options.json` - Global user options
  - `package.json` - Dependencies and npm scripts

## Git Integration Patterns

The app directly interfaces with git repositories and expects to be run in a git working directory. All git operations are async and include error handling.

## Dependencies

Key dependencies and their purposes:

- **ink** + **react**: Terminal-based React UI framework
- **simple-git**: Git operations (status, commit, reset, revert, log)
- **play-sound**: Audio feedback system
- **chalk**: Terminal text styling and colors
- **ink-link**: Clickable links in terminal output

## Claude CLI Integration

The app integrates with Claude CLI for AI-powered commit message generation:

- Requires `claude` CLI tool installed and configured
- Uses temporary files for prompt handling to avoid shell escaping issues
- Implements timeout and error handling for external Claude CLI calls
- Three distinct prompt styles for different commit message approaches

## Testing and Validation

- Use `node -c vpoints.js` for syntax checking without execution
- App validates git repository status on startup
- All git operations include comprehensive error handling
- File change detection and status monitoring built-in
