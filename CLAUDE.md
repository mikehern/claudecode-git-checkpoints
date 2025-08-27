# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "checkpoints" - a terminal-based React app built with Ink that provides a git commit checkpoint management interface for Claude Code workflows. The app allows users to create, undo, and revert git commits with an interactive CLI interface.

## Architecture

- **Main Component**: `GitCommitHistoryApp` in `conversation-history-app.js` - A React component rendered in the terminal using Ink
- **Git Integration**: Uses `simple-git` library for all git operations (commit history, staging, committing, undoing, reverting)
- **State Management**: React hooks for UI state (selected items, modals, animations, options)
- **Audio System**: `play-sound` integration with WAV files in `sounds/` directory
- **Persistent Options**: JSON file-based configuration stored in `options.json`

## Development Commands

```bash
# Start the app
npm start

# Development with auto-reload
npm run dev
```

## Key Features & Workflows

- **Checkpoint Creation**: Stages all changes and commits with the last Claude input as commit message
- **Interactive History**: Navigate through git commits with keyboard shortcuts
- **Undo/Revert**: Git reset and revert operations with confirmation dialogs
- **Sound Effects**: Audio feedback for actions (can be disabled in options)
- **Custom Commit Messages**: Support for custom labels and descriptions

## State Structure

The app manages complex UI state including:
- Commit list navigation (selectedIndex, windowStart for scrolling)
- Modal states (showOptions, showUndoConfirm, showRevertConfirm, etc.)
- Animation states (successAnimatingIndex, successAnimationProgress)
- Form inputs (customLabel, customDescription)
- Git status (hasUncommittedChanges)

## Keyboard Shortcuts

- Navigation: Arrow keys, Enter for selection
- Exit: `x`, `q`, or `esc` to quit
- Context-specific shortcuts handled in `useInput` hook

## File Structure

- Main app logic in single file: `conversation-history-app.js`
- Audio assets: `sounds/*.wav`
- Sample conversation files: `sample/*.jsonl`
- Configuration: `options.json`, `package.json`

## Git Integration Patterns

The app directly interfaces with git repositories and expects to be run in a git working directory. All git operations are async and include error handling.