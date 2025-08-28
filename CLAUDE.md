# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VPoints is a terminal-based React application built with Ink that provides git checkpoint management for Claude Code workflows. It allows users to create, undo, and revert git commits with an interactive CLI interface, designed specifically to enhance development workflows with AI assistants.

## Architecture

- **Main Component**: Single-file React Ink application in `vpoints.js` 
- **Git Integration**: Uses `simple-git` library for all git operations (commit history, staging, committing, undoing, reverting)
- **State Management**: Complex React hooks-based state for UI interactions, animations, and modal flows
- **Audio System**: `play-sound` integration with WAV files in `sounds/` directory for user feedback
- **Configuration**: JSON-based persistent options system with global and project-local settings
- **Claude CLI Integration**: External process spawning for AI-powered commit message generation

## Development Commands

```bash
# Start the app
npm start

# Development with auto-reload (watches for file changes)
npm run dev

# Syntax check only (for testing without running the full app)
node -c vpoints.js

# Global installation as 'vpoints' command
npm install -g .
```

## Key Features & Complex State Management

The application manages sophisticated UI state across multiple concurrent features:

- **Checkpoint Creation**: Stages all changes and commits with Claude input as commit message
- **Interactive History**: Scrollable commit list with keyboard navigation and windowing
- **Undo/Revert Operations**: Git reset and revert with confirmation modals
- **Claude Decide**: AI-powered commit message generation with loading states, error handling, and suggestion selection
- **Auto-checkpoint**: File watching with cooldown timers and automatic commit creation
- **Checkpoint Analysis**: AI-powered analysis of commit changes and impact
- **Custom Commit Messages**: Form inputs for labels and descriptions
- **Sound Effects**: Configurable audio feedback system
- **Trial Mode**: Safe experimentation via `create-trial.js` utility

## State Architecture

The app uses a complex state system with multiple concurrent UI flows:

```javascript
// Navigation & Display State
- selectedIndex, windowStart (commit list scrolling)
- successAnimatingIndex, successAnimationProgress (visual feedback)

// Modal State Management  
- showOptions, showUndoConfirm, showRevertConfirm
- showCreateCheckpoint, showCheckpointDetails, showClaudeDecide
- showCustomLabel, showCustomDescription, showCheckpointAnalysis

// Git Status State
- commits[], currentBranch, hasUncommittedChanges
- currentFileChanges{added, modified, removed}

// Auto-checkpoint State
- lastProcessedInput, autoCommitFlashActive, isAutoCommitting
- lastAutoCommitTime, autoCommitCooldownActive

// Claude Integration State  
- claudeDecideState{loading, suggestions, error}
- claudeSuggestions[], loadingAnimationText, spinnerFrameIndex
- analysisState, analysisResult, analysisError
```

## File Structure

- **`vpoints.js`**: Main application (800+ lines, single-file architecture)
- **`create-trial.js`**: Trial mode utility for safe experimentation
- **`sounds/`**: Audio feedback files (checkpoint.wav, exit.wav, menu-move.wav, next.wav, revert.wav)
- **`package.json`**: ES modules configuration, dependencies, and npm scripts

## Git Integration Patterns

- Expects to be run in a git working directory
- All git operations are async with comprehensive error handling
- Uses `simple-git` for: status, commit, reset, revert, log operations
- File change detection and monitoring built-in
- Validates git repository status on startup

## Claude CLI Integration

External process integration for AI features:

- Requires `claude` CLI tool installed and configured
- Uses temporary files for prompt handling to avoid shell escaping issues
- Implements timeout and error handling for external Claude CLI calls
- Multiple prompt styles: "Vibecoder" (creative, user-intent focused) and "Prototyper" (conventional commits)
- Concurrent API calls with partial failure handling

## Dependencies

Key dependencies and their architectural role:

- **ink + react**: Terminal-based React UI framework for complex state-driven interfaces
- **simple-git**: Async git operations library
- **play-sound**: Cross-platform audio feedback system  
- **chalk**: Terminal text styling and colors
- **ink-link**: Clickable terminal links

## Testing and Validation

- Use `node -c vpoints.js` for syntax validation without execution
- App includes startup validation for git repository status
- All git operations include comprehensive error handling and user feedback
- File change detection and status monitoring built-in
- Trial mode (`create-trial.js`) provides safe testing environment

## Development Notes

- Single-file architecture with 800+ lines of React hooks-based state management
- No external test framework - relies on syntax checking and runtime validation
- Extensive use of `useEffect` hooks for managing concurrent async operations
- Complex modal flow management with multiple overlapping UI states
- Audio feedback system can be disabled via options
- Global installation pattern using npm link or direct GitHub installation