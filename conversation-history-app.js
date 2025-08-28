#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Text, Box, useInput, useApp } from "ink";
import chalk from "chalk";
import simpleGit from "simple-git";
import sound from "play-sound";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GitCommitHistoryApp = () => {
  const [commits, setCommits] = useState([]);
  const [currentBranch, setCurrentBranch] = useState("");
  const [lastClaudeInput, setLastClaudeInput] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isGitRepository, setIsGitRepository] = useState(null); // null = checking, true = valid, false = invalid
  const [windowStart, setWindowStart] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [selectedRevertCommit, setSelectedRevertCommit] = useState(null);
  const [showCreateCheckpoint, setShowCreateCheckpoint] = useState(false);
  const [createCheckpointSelectedIndex, setCreateCheckpointSelectedIndex] =
    useState(0);
  const [createCheckpointError, setCreateCheckpointError] = useState(null);
  const [showCheckpointDetails, setShowCheckpointDetails] = useState(false);
  const [selectedCommitDetails, setSelectedCommitDetails] = useState(null);
  const [commitFileChanges, setCommitFileChanges] = useState({
    added: [],
    modified: [],
    removed: [],
  });
  const [showCustomLabel, setShowCustomLabel] = useState(false);
  const [showCustomDescription, setShowCustomDescription] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [successAnimatingIndex, setSuccessAnimatingIndex] = useState(-1);
  const [successAnimationProgress, setSuccessAnimationProgress] = useState(0);
  const [successAnimationPhase, setSuccessAnimationPhase] = useState(1); // 1 = turning green, 2 = turning back to default
  const [options, setOptions] = useState({
    audio: true,
    customPrefix: true,
    autoCheckpoint: false,
  });
  const [optionsSelectedIndex, setOptionsSelectedIndex] = useState(0);
  const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);
  const [fileChangesCount, setFileChangesCount] = useState(0);
  const [currentFileChanges, setCurrentFileChanges] = useState({
    added: [],
    modified: [],
    removed: [],
  });

  // Auto-checkpoint feature state
  const [lastProcessedInput, setLastProcessedInput] = useState(null);
  const [autoCommitFlashActive, setAutoCommitFlashActive] = useState(false);
  const [autoCommitFlashTimer, setAutoCommitFlashTimer] = useState(null);
  const [isAutoCommitting, setIsAutoCommitting] = useState(false);
  const [lastAutoCommitTime, setLastAutoCommitTime] = useState(0);
  const [autoCommitCooldownActive, setAutoCommitCooldownActive] =
    useState(false);
  const [autoCommitCooldownTimer, setAutoCommitCooldownTimer] = useState(null);

  // Claude Decide feature state
  const [showClaudeDecide, setShowClaudeDecide] = useState(false);
  const [claudeDecideState, setClaudeDecideState] = useState("loading"); // 'loading' | 'suggestions' | 'error'
  const [claudeSuggestions, setClaudeSuggestions] = useState([]);
  const [claudeDecideError, setClaudeDecideError] = useState(null);
  const [partialError, setPartialError] = useState(null); // For when only one call fails
  const [loadingAnimationText, setLoadingAnimationText] = useState(
    "Reticulating Claude splines..."
  );
  const [loadingAnimationProgress, setLoadingAnimationProgress] = useState(0);
  const [loadingAnimationPhase, setLoadingAnimationPhase] = useState(1); // 1 = orange->white, 2 = white->orange
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0); // For suggestions navigation
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);

  const { exit } = useApp();

  const optionsPath = path.join(
    os.homedir(),
    ".config",
    "checkpoints",
    "options.json"
  );

  // Initialize sound player
  const player = sound();

  // Load options from file
  const loadOptions = () => {
    try {
      if (fs.existsSync(optionsPath)) {
        const data = fs.readFileSync(optionsPath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      // Use defaults on error
    }
    return { audio: true, customPrefix: true, autoCheckpoint: false };
  };

  // Save options to file
  const saveOptions = (newOptions) => {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(optionsPath);
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(optionsPath, JSON.stringify(newOptions, null, 2));
    } catch (error) {
      // Silently fail if can't save
    }
  };

  // Load options on mount
  useEffect(() => {
    setOptions(loadOptions());
  }, []);

  // Play menu move sound
  const playMenuSound = () => {
    if (!options.audio) return;
    try {
      player.play(path.join(__dirname, "sounds/menu-move.wav"));
    } catch (error) {
      // Silently fail if sound can't be played
    }
  };

  // Play animation sound
  const playAnimationSound = () => {
    if (!options.audio) return;
    try {
      player.play(path.join(__dirname, "sounds/next.wav"));
    } catch (error) {
      // Silently fail if sound can't be played
    }
  };

  // Play revert sound
  const playRevertSound = () => {
    if (!options.audio) return;
    try {
      player.play(path.join(__dirname, "sounds/revert.wav"));
    } catch (error) {
      // Silently fail if sound can't be played
    }
  };

  // Play next sound (for cancel actions)
  const playNextSound = () => {
    if (!options.audio) return;
    try {
      player.play(path.join(__dirname, "sounds/next.wav"));
    } catch (error) {
      // Silently fail if sound can't be played
    }
  };

  // Play exit sound
  const playExitSound = () => {
    if (!options.audio) return;
    try {
      player.play(path.join(__dirname, "sounds/exit.wav"));
    } catch (error) {
      // Silently fail if sound can't be played
    }
  };

  // Play checkpoint sound
  const playCheckpointSound = () => {
    if (!options.audio) return;
    try {
      player.play(path.join(__dirname, "sounds/checkpoint.wav"));
    } catch (error) {
      // Silently fail if sound can't be played
    }
  };

  // Load commit history
  const loadCommits = async () => {
    try {
      const git = simpleGit(process.cwd());
      const log = await git.log();

      const commitList = log.all.map((commit) => {
        const date = new Date(commit.date);
        const formattedDate = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const formattedTime = date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        return {
          text: commit.message || "No commit message", // Subject line only for main page
          fullText: commit.body
            ? `${commit.message}\n\n${commit.body}`
            : commit.message || "No commit message", // Full message for details
          timestamp: `${formattedDate} at ${formattedTime}`,
          hash: commit.hash,
        };
      });

      setCommits(commitList);

      // Keep "Create checkpoint" selected (index 0) and reset window
      setSelectedIndex(0);
      setWindowStart(0);
    } catch (error) {
      // Check if this is an empty repository (no commits yet)
      if (
        error.message.includes("does not have any commits yet") ||
        error.message.includes("bad default revision 'HEAD'") ||
        error.message.includes("your current branch") ||
        error.message.includes("initial commit")
      ) {
        // Empty repository - this is normal, not an error
        setCommits([]);
      } else {
        // Actual git error
        console.error("Failed to load commit history:", error.message);
        setCommits([]);
      }

      // Keep "Create checkpoint" selected (index 0) and reset window
      setSelectedIndex(0);
      setWindowStart(0);
    }
  };

  // Create checkpoint with last user input
  const createCheckpointWithLastInput = async () => {
    try {
      setCreateCheckpointError(null);
      const git = simpleGit(process.cwd());

      // Get the commit message from the actual displayed text (without the "1 " prefix)
      const commitMessage =
        lastClaudeInput && lastClaudeInput.text
          ? lastClaudeInput.text
          : "No recent input found";

      // Stage all changes
      await git.add(".");

      // Commit with the message
      await git.commit(commitMessage);

      // Refresh the commit list and return to main page
      loadCommits();
      setShowCreateCheckpoint(false);

      // Start success animation for the newly created commit (index 1 because "Create checkpoint" is at 0)
      setSuccessAnimatingIndex(1);
      setSuccessAnimationProgress(0);

      // Play checkpoint success sound
      playCheckpointSound();
    } catch (error) {
      console.error("Failed to create checkpoint:", error.message);
      setCreateCheckpointError(`Error: ${error.message}`);
    }
  };

  // Get file changes for a specific commit
  const getCommitFileChanges = async (commitHash) => {
    try {
      const git = simpleGit(process.cwd());

      // Get the diff with file status
      const diffSummary = await git.diffSummary([`${commitHash}^`, commitHash]);

      const changes = {
        added: [],
        modified: [],
        removed: [],
      };

      diffSummary.files.forEach((file) => {
        if (file.insertions > 0 && file.deletions === 0) {
          changes.added.push(file.file);
        } else if (file.insertions === 0 && file.deletions > 0) {
          changes.removed.push(file.file);
        } else if (file.insertions > 0 && file.deletions > 0) {
          changes.modified.push(file.file);
        }
      });

      return changes;
    } catch (error) {
      console.error("Failed to get commit changes:", error.message);
      return { added: [], modified: [], removed: [] };
    }
  };

  // Get current uncommitted file changes
  const getCurrentFileChanges = async () => {
    try {
      const git = simpleGit(process.cwd());
      const status = await git.status();

      const changes = {
        added: [],
        modified: [],
        removed: [],
      };

      status.files.forEach((file) => {
        if (file.index === "A" || file.working_dir === "A") {
          changes.added.push(file.path);
        } else if (file.index === "D" || file.working_dir === "D") {
          changes.removed.push(file.path);
        } else if (file.index === "M" || file.working_dir === "M") {
          changes.modified.push(file.path);
        }
      });

      return changes;
    } catch (error) {
      console.error("Failed to get current changes:", error.message);
      return { added: [], modified: [], removed: [] };
    }
  };

  // Get git diff for Claude Decide context
  const getGitDiff = async () => {
    try {
      const git = simpleGit(process.cwd());
      const status = await git.status();

      if (status.staged.length > 0) {
        // Get staged changes (what will be committed)
        return await git.diff(["--staged"]);
      } else {
        // Get all unstaged changes
        return await git.diff();
      }
    } catch (error) {
      console.error("Failed to get git diff:", error);
      return "";
    }
  };

  // Gather context for Claude Decide
  const gatherClaudeContext = async () => {
    try {
      // 1. Get git diff of current changes
      const diff = await getGitDiff();

      // 2. Current file changes (already have this)
      const fileChanges = await getCurrentFileChanges();

      // 3. Last Claude input (already have this)
      const lastInput = lastClaudeInput?.text || "";

      // 4. Recent commit context for patterns
      const recentCommits = commits.slice(0, 3).map((c) => c.text);

      return {
        diff,
        fileChanges,
        lastInput,
        recentCommits,
      };
    } catch (error) {
      console.error("Context gathering failed:", error);
      throw new Error("Failed to analyze project changes");
    }
  };

  // Create custom checkpoint with label and description
  const createCustomCheckpoint = async (label, description) => {
    try {
      setCreateCheckpointError(null);
      const git = simpleGit(process.cwd());

      // Apply prefix if enabled
      const finalLabel = options.customPrefix ? `Vibe: ${label}` : label;

      // Format commit message: label + empty line + description
      const commitMessage = description.trim()
        ? `${finalLabel}\n\n${description}`
        : finalLabel;

      // Stage all changes
      await git.add(".");

      // Commit with the formatted message
      await git.commit(commitMessage);

      // Refresh the commit list and return to main page
      loadCommits();
      setShowCustomLabel(false);
      setShowCustomDescription(false);
      setCustomLabel("");
      setCustomDescription("");

      // Start success animation for the newly created commit
      setSuccessAnimatingIndex(1);
      setSuccessAnimationProgress(0);

      // Play checkpoint success sound
      playCheckpointSound();
    } catch (error) {
      console.error("Failed to create custom checkpoint:", error.message);
      setCreateCheckpointError(`Error: ${error.message}`);
    }
  };

  // Generate vibecoder suggestion using Claude CLI (includes user intent)
  const generateVibecoderSuggestion = async (context) => {
    const prompt = `
<task>
Generate a natural, conversational commit message that connects the user's request to what was implemented.
</task>

<context>
<user_intent>
${context.lastInput || "No recent user message found"}
</user_intent>

<file_changes>
Added files: ${context.fileChanges.added.join(", ") || "none"}
Modified files: ${context.fileChanges.modified.join(", ") || "none"}  
Removed files: ${context.fileChanges.removed.join(", ") || "none"}
</file_changes>

<code_diff>
${context.diff ? context.diff.slice(0, 1000) : "No diff available"}
${context.diff && context.diff.length > 1000 ? "\\n[...truncated...]" : ""}
</code_diff>

<recent_commits>
Recent commit history for context:
${
  context.recentCommits.length > 0
    ? context.recentCommits.map((c) => `• ${c}`).join("\\n")
    : "• No recent commits"
}
</recent_commits>
</context>

<instructions>
Based on the user's intent and the actual code changes, create a commit message using natural, conversational language that connects the user's request to what was implemented.

Example: "Added user authentication to protect dashboard access"

The message should:
- Be natural and conversational
- Connect user intent to implementation
- Be concise but descriptive
- Avoid technical jargon
- Mirror the language style from the user intent

</instructions>

<output_format>
Return only the single line commit message. No explanations, no analysis, no additional text.
</output_format>
`;

    try {
      // Write prompt to temporary file to avoid shell escaping issues
      const tempFile = `/tmp/claude-vibecoder-${Date.now()}.txt`;
      fs.writeFileSync(tempFile, prompt);

      // Use claude CLI with -p flag and text output (async)
      const { stdout: result } = await execAsync(
        `cat "${tempFile}" | claude -p --max-turns 1`,
        {
          encoding: "utf8",
          timeout: 30000, // 30 second timeout
          cwd: process.cwd(), // Run in current directory
        }
      );

      // Clean up temp file
      fs.unlinkSync(tempFile);

      // Parse the response - for vibecoder, we expect plain text
      const debugFile = "/tmp/claude-decide-debug.log";
      fs.appendFileSync(debugFile, `Vibecoder raw response:\n${result}\n\n`, {
        flag: "a",
      });

      // Extract message from response (remove any markdown formatting if present)
      let message = result.trim();

      // Remove markdown code blocks if present
      const codeBlockMatch = message.match(/```[\s\S]*?\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        message = codeBlockMatch[1].trim();
      }

      // Remove any quotes if the entire message is quoted
      if (message.startsWith('"') && message.endsWith('"')) {
        message = message.slice(1, -1);
      }

      fs.appendFileSync(debugFile, `Extracted vibecoder: ${message}\n`);

      return message || "Generated vibecoder suggestion";
    } catch (error) {
      console.error("Vibecoder Claude CLI call failed:", error);
      throw new Error(`Vibecoder generation failed: ${error.message}`);
    }
  };

  // Generate prototyper suggestion using Claude CLI (excludes user intent)
  const generatePrototyperSuggestion = async (context) => {
    const prompt = `
<task>
Generate a conventional commit message in technical format based purely on code changes.
</task>

<context>
<file_changes>
Added files: ${context.fileChanges.added.join(", ") || "none"}
Modified files: ${context.fileChanges.modified.join(", ") || "none"}  
Removed files: ${context.fileChanges.removed.join(", ") || "none"}
</file_changes>

<code_diff>
${context.diff ? context.diff.slice(0, 1000) : "No diff available"}
${context.diff && context.diff.length > 1000 ? "\\n[...truncated...]" : ""}
</code_diff>

<recent_commits>
Recent commit history for context:
${
  context.recentCommits.length > 0
    ? context.recentCommits.map((c) => `• ${c}`).join("\\n")
    : "• No recent commits"
}
</recent_commits>
</context>

<instructions>
Based ONLY on the code changes and file modifications, create a conventional commit message with technical precision.

Use the format: {type}: {brief technical description}

Types: feat|fix|docs|refactor|test|chore|style
- feat: new feature
- fix: bug fix
- docs: documentation changes
- refactor: code refactoring
- test: adding/modifying tests
- chore: maintenance tasks
- style: formatting/style changes

Example: "feat: implement JWT-based authentication middleware"

The message should:
- Be technically precise
- Focus on WHAT was changed, not WHY
- Use conventional commit format
- Be concise and specific

CRITICAL: Return ONLY the commit message. Do not include any explanation, analysis, or commentary. Just the single line commit message.
</instructions>

<output_format>
Return only the single line commit message. No explanations, no analysis, no additional text.
</output_format>
`;

    try {
      // Write prompt to temporary file to avoid shell escaping issues
      const tempFile = `/tmp/claude-prototyper-${Date.now()}.txt`;
      fs.writeFileSync(tempFile, prompt);

      // Use claude CLI with -p flag and text output (async)
      const { stdout: result } = await execAsync(
        `cat "${tempFile}" | claude -p --max-turns 1`,
        {
          encoding: "utf8",
          timeout: 30000, // 30 second timeout
          cwd: process.cwd(), // Run in current directory
        }
      );

      // Clean up temp file
      fs.unlinkSync(tempFile);

      // Parse the response - for prototyper, we expect plain text
      const debugFile = "/tmp/claude-decide-debug.log";
      fs.appendFileSync(debugFile, `Prototyper raw response:\n${result}\n\n`, {
        flag: "a",
      });

      // Extract message from response (remove any markdown formatting if present)
      let message = result.trim();

      // Remove markdown code blocks if present
      const codeBlockMatch = message.match(/```[\s\S]*?\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        message = codeBlockMatch[1].trim();
      }

      // Remove any quotes if the entire message is quoted
      if (message.startsWith('"') && message.endsWith('"')) {
        message = message.slice(1, -1);
      }

      fs.appendFileSync(debugFile, `Extracted prototyper: ${message}\n`);

      return message || "Generated prototyper suggestion";
    } catch (error) {
      console.error("Prototyper Claude CLI call failed:", error);
      throw new Error(`Prototyper generation failed: ${error.message}`);
    }
  };

  // Generate commit message suggestions using Claude CLI
  const generateCommitSuggestions = async (context) => {
    const prompt = `
<task>
Generate two distinct commit message suggestions for the changes about to be committed.
</task>

<context>
<user_intent>
${context.lastInput || "No recent user message found"}
</user_intent>

<file_changes>
Added files: ${context.fileChanges.added.join(", ") || "none"}
Modified files: ${context.fileChanges.modified.join(", ") || "none"}  
Removed files: ${context.fileChanges.removed.join(", ") || "none"}
</file_changes>

<code_diff>
${context.diff ? context.diff.slice(0, 1000) : "No diff available"}
${context.diff && context.diff.length > 1000 ? "\\n[...truncated...]" : ""}
</code_diff>

<recent_commits>
Recent commit history for context:
${
  context.recentCommits.length > 0
    ? context.recentCommits.map((c) => `• ${c}`).join("\\n")
    : "• No recent commits"
}
</recent_commits>
</context>

<instructions>
Based on the user's intent and the actual code changes, create two commit messages:

<vibecoder_style>
Natural, conversational language that connects the user's request to what was implemented.
Example: "Added user authentication to protect dashboard access"
</vibecoder_style>

<prototyper_style>  
Conventional commits format with technical precision.
Use: feat|fix|docs|refactor|test|chore|style: brief technical description
Example: "feat: implement JWT-based authentication middleware"
</prototyper_style>
</instructions>

<output_format>
Return valid JSON only:
{
  "vibecoder": "your natural language message",
  "prototyper": "your conventional commit message"
}
</output_format>
`;

    try {
      // Write prompt to temporary file to avoid shell escaping issues
      const tempFile = `/tmp/claude-prompt-${Date.now()}.txt`;
      fs.writeFileSync(tempFile, prompt);

      // Use claude CLI with -p flag and JSON output (async)
      const { stdout: result } = await execAsync(
        `cat "${tempFile}" | claude -p --output-format json --max-turns 1`,
        {
          encoding: "utf8",
          timeout: 30000, // 30 second timeout
          cwd: process.cwd(), // Run in current directory
        }
      );

      // Clean up temp file
      fs.unlinkSync(tempFile);

      // Parse the JSON response
      const debugFile = "/tmp/claude-decide-debug.log";
      fs.writeFileSync(debugFile, `Raw Claude CLI response:\n${result}\n\n`, {
        flag: "w",
      });

      const response = JSON.parse(result.trim());
      fs.appendFileSync(
        debugFile,
        `Parsed response:\n${JSON.stringify(response, null, 2)}\n\n`
      );

      // Extract the actual result content from Claude CLI response
      let suggestions;
      if (response.result) {
        // Parse the JSON from the markdown code block
        const jsonMatch = response.result.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[1]);
        }
      }

      // Extract suggestions with fallback handling
      const vibecoder =
        suggestions?.vibecoder || "Generated vibecoder suggestion";
      const prototyper =
        suggestions?.prototyper || "Generated prototyper suggestion";

      fs.appendFileSync(debugFile, `Extracted vibecoder: ${vibecoder}\n`);
      fs.appendFileSync(debugFile, `Extracted prototyper: ${prototyper}\n`);

      return [
        { type: "vibecoder", message: vibecoder },
        { type: "prototyper", message: prototyper },
      ];
    } catch (error) {
      console.error("Claude CLI call failed:", error);

      // Better error messages based on CLI errors
      if (error.message.includes("command not found")) {
        throw new Error(
          "Claude Code CLI not installed. Install with: npm install -g @anthropic-ai/claude-code"
        );
      } else if (error.message.includes("ANTHROPIC_API_KEY")) {
        throw new Error("Claude Code not authenticated. Run: claude auth");
      } else if (error.message.includes("timeout")) {
        throw new Error("Claude API request timed out");
      } else {
        throw new Error(`Claude CLI error: ${error.message}`);
      }
    }
  };

  // Handle Claude Decide flow with dual parallel calls
  const handleClaudeDecideFlow = async () => {
    try {
      // Gather context
      const context = await gatherClaudeContext();
      const contextNoUser = { ...context, lastInput: "" }; // Remove user intent for prototyper

      // Make both calls in parallel using Promise.allSettled for better error handling
      const [vibecoderResult, prototyperResult] = await Promise.allSettled([
        generateVibecoderSuggestion(context),
        generatePrototyperSuggestion(contextNoUser),
      ]);

      const suggestions = [];
      let partialErrorMessage = null;

      // Process vibecoder result
      if (vibecoderResult.status === "fulfilled") {
        suggestions.push({ type: "vibecoder", message: vibecoderResult.value });
      } else {
        partialErrorMessage = "Vibecoder generation failed";
        console.error("Vibecoder failed:", vibecoderResult.reason);
      }

      // Process prototyper result
      if (prototyperResult.status === "fulfilled") {
        suggestions.push({
          type: "prototyper",
          message: prototyperResult.value,
        });
      } else {
        const prototyperError = "Prototyper generation failed";
        partialErrorMessage = partialErrorMessage
          ? "Both suggestion types failed"
          : prototyperError;
        console.error("Prototyper failed:", prototyperResult.reason);
      }

      // If no suggestions succeeded, throw error for complete failure handling
      if (suggestions.length === 0) {
        throw new Error("Both suggestion types failed");
      }

      // Show suggestions with optional partial error indicator
      setClaudeSuggestions(suggestions);
      setPartialError(partialErrorMessage);
      setClaudeDecideState("suggestions");
    } catch (error) {
      // Complete failure - CLI-specific error handling
      if (
        error.message.includes("not installed") ||
        error.message.includes("command not found")
      ) {
        setClaudeDecideError(
          "Claude Code CLI not found. Please install Claude Code first."
        );
      } else if (
        error.message.includes("not authenticated") ||
        error.message.includes("ANTHROPIC_API_KEY")
      ) {
        setClaudeDecideError(
          'Claude Code not authenticated. Run "claude auth" first.'
        );
      } else if (error.message.includes("timeout")) {
        setClaudeDecideError("Request timed out. Please try again.");
      } else {
        setClaudeDecideError(`Error: ${error.message}`);
      }
      setPartialError(null); // Clear any partial errors
      setClaudeDecideState("error");
    }
  };

  // Create Claude Decide checkpoint
  const createClaudeDecideCheckpoint = async (message) => {
    try {
      setClaudeDecideError(null);
      setPartialError(null);
      const git = simpleGit(process.cwd());

      // Stage all changes
      await git.add(".");

      // Commit with the selected Claude message
      await git.commit(message);

      // Clean up Claude Decide state
      setShowClaudeDecide(false);
      setClaudeDecideState("loading"); // Reset for next time
      setClaudeSuggestions([]);
      setClaudeDecideError(null);
      setPartialError(null); // Clear partial errors
      setSelectedSuggestionIndex(0);

      // Refresh the commit list and return to main page
      loadCommits();

      // Start success animation for the newly created commit (index 1 because "Create checkpoint" is at 0)
      setSuccessAnimatingIndex(1);
      setSuccessAnimationProgress(0);

      // Play checkpoint success sound
      playCheckpointSound();
    } catch (error) {
      console.error(
        "Failed to create Claude decide checkpoint:",
        error.message
      );

      // Stay in Claude Decide flow for error handling
      setClaudeDecideError(`Failed to create checkpoint: ${error.message}`);
      setClaudeDecideState("error");
    }
  };

  // Auto-checkpoint functionality
  const startCooldownPeriod = () => {
    // Clear any existing cooldown timer
    if (autoCommitCooldownTimer) {
      clearTimeout(autoCommitCooldownTimer);
    }

    // Start cooldown period (2.4 seconds)
    setAutoCommitCooldownActive(true);

    const timer = setTimeout(() => {
      setAutoCommitCooldownActive(false);
      setAutoCommitCooldownTimer(null);
    }, 2400); // 2.4 seconds

    setAutoCommitCooldownTimer(timer);
  };

  const triggerAutoCommitFlash = () => {
    // Clear any existing flash timer
    if (autoCommitFlashTimer) {
      clearTimeout(autoCommitFlashTimer);
    }

    // Start orange flash (600ms)
    setAutoCommitFlashActive(true);

    const timer = setTimeout(() => {
      setAutoCommitFlashActive(false);
      setAutoCommitFlashTimer(null);

      // After flash ends, start cooldown period
      startCooldownPeriod();
    }, 600);

    setAutoCommitFlashTimer(timer);
  };

  const handleAutoCheckpoint = async (inputText) => {
    if (
      showCreateCheckpoint ||
      showClaudeDecide ||
      showCustomLabel ||
      showCustomDescription
    ) {
      return; // Don't interfere with manual flows
    }

    setIsAutoCommitting(true);
    try {
      const git = simpleGit(process.cwd());

      // Validate git state
      const status = await git.status();
      if (status.conflicted.length > 0) return;

      const branch = await git.branch();
      if (branch.detached) return;

      // Check for file changes
      const fileChanges = await getCurrentFileChanges();
      const hasChanges =
        fileChanges.added.length > 0 ||
        fileChanges.modified.length > 0 ||
        fileChanges.removed.length > 0;

      await git.add(".");

      // Format commit message
      const prefix = hasChanges ? "[*]" : "[ ]";
      const maxLength = 72 - prefix.length - 1;
      const truncatedText =
        inputText.length > maxLength
          ? inputText.slice(0, maxLength - 3) + "..."
          : inputText;
      const commitMessage = `${prefix} ${truncatedText}`;

      // Commit with appropriate flags
      if (hasChanges) {
        await git.commit(commitMessage);
      } else {
        await git.commit(commitMessage, ["--allow-empty"]);
      }

      // UI feedback
      triggerAutoCommitFlash();
      loadCommits();

      if (options.audio) {
        playCheckpointSound();
      }
    } catch (error) {
      console.error("Auto-checkpoint failed:", error);
    } finally {
      setIsAutoCommitting(false);
    }
  };

  // Undo last commit (git reset --hard HEAD~1)
  const undoLastCommit = async () => {
    try {
      const git = simpleGit(process.cwd());

      // Safety check: ensure we have commits to undo
      const log = await git.log({ maxCount: 1 });
      if (log.all.length === 0) {
        console.warn("No commits to undo");
        return;
      }

      await git.reset(["--hard", "HEAD~1"]);
      loadCommits(); // Refresh the commit list
    } catch (error) {
      console.error("Failed to undo commit:", error.message);
    }
  };

  // Revert to specific commit (git reset --hard <hash>)
  const revertToCommit = async (commitHash) => {
    try {
      const git = simpleGit(process.cwd());

      // Safety check: ensure the commit hash exists
      if (!commitHash) {
        console.warn("No commit hash provided for revert");
        return;
      }

      await git.reset(["--hard", commitHash]);
      loadCommits(); // Refresh the commit list
    } catch (error) {
      console.error("Failed to revert to commit:", error.message);
    }
  };

  // Load last Claude Code conversation input
  const loadLastClaudeInput = () => {
    try {
      const currentDir = process.cwd();
      const claudeProjectPath = path.join(
        os.homedir(),
        ".claude",
        "projects",
        `${currentDir.replace(/\//g, "-")}`
      );

      if (!fs.existsSync(claudeProjectPath)) {
        setLastClaudeInput({
          text: "You haven't used Claude Code from this directory yet",
          timestamp: "",
        });
        return;
      }

      const files = fs.readdirSync(claudeProjectPath);
      const jsonlFiles = files.filter((file) => file.endsWith(".jsonl"));

      if (jsonlFiles.length === 0) {
        setLastClaudeInput({
          text: "No conversation files found",
          timestamp: "",
        });
        return;
      }

      // Collect all user inputs from all conversation files
      const allUserInputs = [];

      for (const file of jsonlFiles) {
        const filePath = path.join(claudeProjectPath, file);
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const lines = content.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const message = JSON.parse(line);

              // Filter for actual user input messages (same logic as original script)
              if (
                message.type === "user" &&
                message.message &&
                message.message.content &&
                !message.isMeta &&
                !message.message.content.startsWith("Caveat:") &&
                !message.message.content.includes("<command-name>") &&
                !message.message.content.includes("<local-command-stdout>") &&
                !message.message.content.trim().startsWith("<task>") &&
                !message.message.content.includes(
                  "Generate two distinct commit message suggestions"
                ) &&
                message.message.content !==
                  "[Request interrupted by user for tool use]"
              ) {
                const utcDate = new Date(message.timestamp);
                const formattedDate = utcDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const formattedTime = utcDate.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });

                allUserInputs.push({
                  text: message.message.content,
                  timestamp: `${formattedDate} at ${formattedTime}`,
                  rawTimestamp: utcDate,
                });
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              continue;
            }
          }
        } catch (fileError) {
          console.warn(`Failed to read file ${filePath}:`, fileError.message);
          continue;
        }
      }

      // Sort by timestamp and get the last input
      allUserInputs.sort((a, b) => a.rawTimestamp - b.rawTimestamp);

      if (allUserInputs.length > 0) {
        const lastInput = allUserInputs[allUserInputs.length - 1];
        setLastClaudeInput({
          text: lastInput.text,
          timestamp: lastInput.timestamp,
        });
      } else {
        setLastClaudeInput({ text: "No user inputs found", timestamp: "" });
      }
    } catch (error) {
      console.error("Failed to load Claude Code history:", error.message);
      setLastClaudeInput({
        text: "Error loading Claude history",
        timestamp: "",
      });
    }
  };

  // Check for uncommitted changes
  const checkUncommittedChanges = async () => {
    try {
      const git = simpleGit(process.cwd());
      const status = await git.status();

      // Check if there are any uncommitted changes
      const hasChanges =
        status.files.length > 0 ||
        status.staged.length > 0 ||
        status.modified.length > 0 ||
        status.deleted.length > 0 ||
        status.created.length > 0 ||
        status.renamed.length > 0;

      setHasUncommittedChanges(hasChanges);
      setFileChangesCount(status.files.length);
    } catch (error) {
      // If git status fails, assume no changes
      setHasUncommittedChanges(false);
      setFileChangesCount(0);
    }
  };

  // Get current git branch name
  const getCurrentBranch = async () => {
    try {
      const git = simpleGit(process.cwd());
      const branchInfo = await git.branch();
      setCurrentBranch(branchInfo.current);
    } catch (error) {
      // If branch check fails, clear branch name
      setCurrentBranch("");
    }
  };

  // Check if current directory is a git repository
  const checkGitRepository = async () => {
    try {
      const git = simpleGit(process.cwd());
      await git.status();
      setIsGitRepository(true);
    } catch (error) {
      setIsGitRepository(false);
    }
  };

  useEffect(() => {
    // First check if we're in a git repository
    checkGitRepository();
  }, []);

  useEffect(() => {
    // Only proceed if we're in a git repository
    if (isGitRepository === true) {
      // Initial load
      loadCommits();
      loadLastClaudeInput();
      checkUncommittedChanges();
      getCurrentBranch();
    } else if (isGitRepository === false) {
      // Exit early if not in a git repository
      return;
    }

    // Only set up watchers if we're in a git repository
    if (isGitRepository !== true) return;

    // Watch for Git changes
    const gitLogPath = path.join(process.cwd(), ".git", "logs", "HEAD");
    let gitWatcher = null;

    try {
      if (fs.existsSync(gitLogPath)) {
        gitWatcher = fs.watch(gitLogPath, (eventType) => {
          if (eventType === "change") {
            loadCommits();
            checkUncommittedChanges();
            getCurrentBranch();
          }
        });
      } else {
        console.warn("Git log file not found - auto-refresh disabled");
      }
    } catch (error) {
      console.warn("Failed to setup Git file watching:", error.message);
    }

    // Watch for Claude Code conversation changes
    const currentDir = process.cwd();
    const claudeProjectPath = path.join(
      os.homedir(),
      ".claude",
      "projects",
      `${currentDir.replace(/\//g, "-")}`
    );
    let claudeWatcher = null;

    try {
      if (fs.existsSync(claudeProjectPath)) {
        claudeWatcher = fs.watch(claudeProjectPath, (eventType, filename) => {
          if (
            eventType === "change" &&
            filename &&
            filename.endsWith(".jsonl")
          ) {
            loadLastClaudeInput();
          }
        });
      } else {
        console.warn(
          "Claude Code project directory not found - Claude history auto-refresh disabled"
        );
      }
    } catch (error) {
      console.warn("Failed to setup Claude Code file watching:", error.message);
    }

    // Set up periodic check for uncommitted changes
    const statusInterval = setInterval(checkUncommittedChanges, 2000);

    // Cleanup watchers and interval on unmount
    return () => {
      if (gitWatcher) {
        gitWatcher.close();
      }
      if (claudeWatcher) {
        claudeWatcher.close();
      }
      clearInterval(statusInterval);
    };
  }, [isGitRepository]);

  // Auto-checkpoint trigger effect
  useEffect(() => {
    if (!options.autoCheckpoint || !lastClaudeInput?.text || isAutoCommitting)
      return;

    const now = Date.now();
    const MIN_INTERVAL = 3000; // 3 seconds rate limit

    if (now - lastAutoCommitTime < MIN_INTERVAL) return;

    if (lastProcessedInput !== lastClaudeInput.text) {
      const timer = setTimeout(() => {
        handleAutoCheckpoint(lastClaudeInput.text);
        setLastProcessedInput(lastClaudeInput.text);
        setLastAutoCommitTime(now);
      }, 1500); // Debounce for file system stability

      return () => clearTimeout(timer);
    }
  }, [
    lastClaudeInput?.text,
    options.autoCheckpoint,
    lastProcessedInput,
    lastAutoCommitTime,
    isAutoCommitting,
  ]);

  // Initialize lastProcessedInput on startup to prevent auto-committing existing messages
  useEffect(() => {
    if (lastClaudeInput?.text && lastProcessedInput === null) {
      setLastProcessedInput(lastClaudeInput.text); // Initialize without committing
    }
  }, [lastClaudeInput?.text, lastProcessedInput]);

  // Cleanup auto-commit timers on unmount
  useEffect(() => {
    return () => {
      if (autoCommitFlashTimer) {
        clearTimeout(autoCommitFlashTimer);
      }
    };
  }, [autoCommitFlashTimer]);

  useEffect(() => {
    return () => {
      if (autoCommitCooldownTimer) {
        clearTimeout(autoCommitCooldownTimer);
      }
    };
  }, [autoCommitCooldownTimer]);

  // Handle keyboard input
  useInput((input, key) => {
    if (showClaudeDecide && claudeDecideState === "loading") {
      // Loading state - only allow escape
      if (key.escape) {
        playNextSound();
        setShowClaudeDecide(false);
        setShowCreateCheckpoint(true);
        return;
      }
      return; // Block all other input during loading
    }

    if (showClaudeDecide && claudeDecideState === "suggestions") {
      // Suggestions screen navigation
      if (key.escape) {
        playNextSound();
        setShowClaudeDecide(false);
        setShowCreateCheckpoint(true);
        return;
      }

      if (key.upArrow) {
        setSelectedSuggestionIndex((prev) => {
          const newIndex = Math.max(0, prev - 1);
          if (newIndex !== prev) playMenuSound();
          return newIndex;
        });
        return;
      }

      if (key.downArrow) {
        setSelectedSuggestionIndex((prev) => {
          const newIndex = Math.min(claudeSuggestions.length - 1, prev + 1);
          if (newIndex !== prev) playMenuSound();
          return newIndex;
        });
        return;
      }

      if (key.return) {
        const selectedMessage =
          claudeSuggestions[selectedSuggestionIndex].message;
        playAnimationSound();

        // Create commit with selected message using Claude Decide flow
        createClaudeDecideCheckpoint(selectedMessage);
        return;
      }

      // Number key selection (1-2) - handle dynamic suggestion count
      if (input === "1" && claudeSuggestions.length >= 1) {
        setSelectedSuggestionIndex(0);
        const selectedMessage = claudeSuggestions[0].message;
        playAnimationSound();
        createClaudeDecideCheckpoint(selectedMessage);
        return;
      }

      if (input === "2" && claudeSuggestions.length >= 2) {
        setSelectedSuggestionIndex(1);
        const selectedMessage = claudeSuggestions[1].message;
        playAnimationSound();
        createClaudeDecideCheckpoint(selectedMessage);
        return;
      }

      return;
    }

    if (showClaudeDecide && claudeDecideState === "error") {
      const isCommitError = claudeDecideError?.includes(
        "Failed to create checkpoint"
      );

      if (input === "r") {
        if (isCommitError) {
          // Retry the commit with the same message
          const lastSelectedMessage =
            claudeSuggestions[selectedSuggestionIndex]?.message;
          if (lastSelectedMessage) {
            setClaudeDecideError(null);
            setPartialError(null);
            createClaudeDecideCheckpoint(lastSelectedMessage);
          }
        } else {
          // Retry the Claude analysis flow
          setClaudeDecideState("loading");
          setClaudeDecideError(null);
          setPartialError(null);
          handleClaudeDecideFlow();
        }
        return;
      }

      if (input === "b" && isCommitError) {
        // Go back to suggestions screen
        setClaudeDecideError(null);
        setPartialError(null);
        setClaudeDecideState("suggestions");
        return;
      }

      if (input === "c") {
        // Fallback to custom input
        setShowClaudeDecide(false);
        setClaudeDecideState("loading"); // Reset state
        setClaudeSuggestions([]);
        setClaudeDecideError(null);
        setPartialError(null);
        setSelectedSuggestionIndex(0);
        setShowCustomLabel(true);
        return;
      }

      if (key.escape) {
        // Back to create checkpoint menu
        setShowClaudeDecide(false);
        setClaudeDecideState("loading"); // Reset state
        setClaudeSuggestions([]);
        setClaudeDecideError(null);
        setPartialError(null);
        setSelectedSuggestionIndex(0);
        setShowCreateCheckpoint(true);
        return;
      }

      return;
    }

    if (showCustomLabel) {
      // Custom label input page
      if (key.escape) {
        playNextSound();
        setShowCustomLabel(false);
        setShowCreateCheckpoint(true);
        setCustomLabel("");

        // Load current file changes
        getCurrentFileChanges().then((changes) => {
          setCurrentFileChanges(changes);
        });
        return;
      }

      if (key.return) {
        if (customLabel.trim()) {
          playAnimationSound();
          setShowCustomLabel(false);
          setShowCustomDescription(true);
        }
        return;
      }

      // Handle text input
      if (key.backspace || key.delete) {
        setCustomLabel((prev) => prev.slice(0, -1));
      } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
        setCustomLabel((prev) => prev + input);
      }

      return;
    }

    if (showCustomDescription) {
      // Custom description input page
      if (key.escape) {
        playNextSound();
        setShowCustomDescription(false);
        setShowCustomLabel(true); // Go back to label screen
        return;
      }

      if (key.ctrl && input === "d") {
        playAnimationSound();
        createCustomCheckpoint(customLabel, customDescription);
        return;
      }

      // Handle text input including multiline
      if (key.backspace || key.delete) {
        setCustomDescription((prev) => prev.slice(0, -1));
      } else if (key.return) {
        setCustomDescription((prev) => prev + "\n");
      } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
        setCustomDescription((prev) => prev + input);
      }

      return;
    }

    if (showCheckpointDetails) {
      // Checkpoint details page navigation
      if (key.escape) {
        playNextSound();
        setShowCheckpointDetails(false);
        setSelectedCommitDetails(null);
        setCommitFileChanges({ added: [], modified: [], removed: [] });
        return;
      }

      return;
    }

    if (showCreateCheckpoint) {
      // Create checkpoint page navigation
      if (key.escape) {
        playNextSound();
        setShowCreateCheckpoint(false);
        setCreateCheckpointError(null);
        return;
      }

      if (key.upArrow) {
        setCreateCheckpointSelectedIndex((prev) => {
          const newIndex = Math.max(0, prev - 1);
          if (newIndex !== prev) {
            playMenuSound();
          }
          return newIndex;
        });
      }

      if (key.downArrow) {
        setCreateCheckpointSelectedIndex((prev) => {
          const newIndex = Math.min(2, prev + 1); // 3 options (0, 1, 2)
          if (newIndex !== prev) {
            playMenuSound();
          }
          return newIndex;
        });
      }

      if (key.return) {
        playAnimationSound();
        // Execute based on currently selected option
        if (createCheckpointSelectedIndex === 0) {
          // Execute Option 1 git operations directly
          setCreateCheckpointError(null);
          createCheckpointWithLastInput();
        } else if (createCheckpointSelectedIndex === 1) {
          // Navigate to custom label page
          setShowCreateCheckpoint(false);
          setShowCustomLabel(true);
          setCustomLabel("");
          setCustomDescription("");
        } else if (createCheckpointSelectedIndex === 2) {
          // Navigate to Claude decide loading
          setShowCreateCheckpoint(false);
          setShowClaudeDecide(true);
          setClaudeDecideState("loading");
          setClaudeDecideError(null);
          setPartialError(null);

          // Start the context gathering and CLI call
          handleClaudeDecideFlow();
        }
      }

      // Number key selection and execution
      if (input === "1") {
        setCreateCheckpointSelectedIndex(0);
        playAnimationSound();
        // Execute Option 1 git operations directly
        setCreateCheckpointError(null);
        createCheckpointWithLastInput();
      } else if (input === "2") {
        setCreateCheckpointSelectedIndex(1);
        playAnimationSound();
        // Navigate to custom label page
        setShowCreateCheckpoint(false);
        setShowCustomLabel(true);
        setCustomLabel("");
        setCustomDescription("");
      } else if (input === "3") {
        setCreateCheckpointSelectedIndex(2);
        playAnimationSound();
        // Navigate to Claude decide loading
        setShowCreateCheckpoint(false);
        setShowClaudeDecide(true);
        setClaudeDecideState("loading");
        setClaudeDecideError(null);
        setPartialError(null);

        // Start the context gathering and CLI call
        handleClaudeDecideFlow();
      }

      return;
    }

    if (showRevertConfirm) {
      // Revert confirmation page
      if (key.escape) {
        playNextSound();
        setShowRevertConfirm(false);
        setSelectedRevertCommit(null);
        return;
      }

      if (input === "y") {
        playRevertSound();
        setShowRevertConfirm(false);
        if (selectedRevertCommit) {
          revertToCommit(selectedRevertCommit.hash);
        }
        setSelectedRevertCommit(null);
        return;
      }

      return;
    }

    if (showUndoConfirm) {
      // Undo confirmation page
      if (key.escape) {
        playNextSound();
        setShowUndoConfirm(false);
        return;
      }

      if (input === "y") {
        playRevertSound();
        setShowUndoConfirm(false);
        undoLastCommit();
        return;
      }

      return;
    }

    if (showOptions) {
      // Options page navigation
      if (key.escape) {
        setShowOptions(false);
        return;
      }

      if (key.upArrow) {
        setOptionsSelectedIndex((prev) => {
          const newIndex = Math.max(0, prev - 1);
          if (newIndex !== prev) {
            playMenuSound();
          }
          return newIndex;
        });
      }

      if (key.downArrow) {
        setOptionsSelectedIndex((prev) => {
          const newIndex = Math.min(availableOptions.length - 1, prev + 1);
          if (newIndex !== prev) {
            playMenuSound();
          }
          return newIndex;
        });
      }

      if (key.leftArrow || key.rightArrow) {
        const selectedOption = availableOptions[optionsSelectedIndex];
        if (selectedOption) {
          playMenuSound();
          const newOptions = {
            ...options,
            [selectedOption.key]: !options[selectedOption.key],
          };
          setOptions(newOptions);
          saveOptions(newOptions);
        }
      }

      return;
    }

    // Handle git initialization when not in a git repository
    if (isGitRepository === false && input === "y") {
      // Initialize git repository
      const initializeGitRepository = async () => {
        try {
          const git = simpleGit(process.cwd());
          await git.init();
          // Re-check git repository status
          setIsGitRepository(true);
          // Load branch info for the new repo
          getCurrentBranch();
          playAnimationSound();
        } catch (error) {
          console.error("Failed to initialize git repository:", error.message);
          // Stay in the error state
        }
      };
      initializeGitRepository();
      return;
    }

    // Main page navigation
    if (input === "x") {
      playExitSound();
      // Add small delay to let exit sound play before exiting
      setTimeout(() => {
        exit();
      }, 200);
      return;
    }

    if (input === "o") {
      playAnimationSound();
      setShowOptions(true);
      return;
    }

    if (input === "u") {
      if (!hasCommits) {
        // No commits to undo, do nothing (could add sound feedback here)
        return;
      }
      playAnimationSound();
      setShowUndoConfirm(true);
      return;
    }

    if (input === "1") {
      playAnimationSound();
      setShowCreateCheckpoint(true);
      setCreateCheckpointSelectedIndex(0);

      // Load current file changes
      getCurrentFileChanges().then((changes) => {
        setCurrentFileChanges(changes);
      });
      return;
    }

    if (input === "d") {
      if (!hasCommits) {
        // No commits to view details for, do nothing
        return;
      }
      // Only show details if a real commit is selected (not "Create checkpoint")
      if (selectedIndex > 0) {
        const commitIndex = selectedIndex - 1; // Adjust for "Create checkpoint" offset
        const commit = commits[commitIndex];
        if (commit) {
          playAnimationSound();
          setSelectedCommitDetails(commit);
          setShowCheckpointDetails(true);

          // Load file changes for this commit
          getCommitFileChanges(commit.hash).then((changes) => {
            setCommitFileChanges(changes);
          });
        }
      }
      return;
    }

    if (input === "r") {
      if (!hasCommits) {
        // No commits to revert to, do nothing
        return;
      }
      // Only show revert confirm if a real commit is selected (not "Create checkpoint")
      if (selectedIndex > 0) {
        const commitIndex = selectedIndex - 1; // Adjust for "Create checkpoint" offset
        const commit = commits[commitIndex];
        if (commit) {
          playAnimationSound();
          setSelectedRevertCommit(commit);
          setShowRevertConfirm(true);
        }
      }
      return;
    }

    if (key.return) {
      if (selectedIndex === 0) {
        // Selected "Create checkpoint"
        playAnimationSound();
        setShowCreateCheckpoint(true);
        setCreateCheckpointSelectedIndex(0);

        // Load current file changes
        getCurrentFileChanges().then((changes) => {
          setCurrentFileChanges(changes);
        });
        return;
      }
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => {
        const newIndex = Math.max(0, prev - 1);
        // Only play sound if selection actually changed
        if (newIndex !== prev) {
          playMenuSound();
        }
        // Adjust window if selection goes above visible area
        if (newIndex < windowStart) {
          setWindowStart(newIndex);
        }
        return newIndex;
      });
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => {
        const totalItems = commits.length + 1; // +1 for "Create checkpoint"
        const newIndex = Math.min(totalItems - 1, prev + 1);
        // Only play sound if selection actually changed
        if (newIndex !== prev) {
          playMenuSound();
        }
        // Adjust window if selection goes below visible area
        if (newIndex >= windowStart + 3) {
          setWindowStart(newIndex - 2);
        }
        return newIndex;
      });
    }
  });

  // Success animation effect for newly created commit on main page (two phases)
  useEffect(() => {
    if (successAnimatingIndex !== -1) {
      const commitIndex = successAnimatingIndex - 1; // Adjust for "Create checkpoint" offset
      const commit = commits[commitIndex];
      if (!commit) return;

      const totalChars = commit.text.length;
      const interval = setInterval(() => {
        setSuccessAnimationProgress((prev) => {
          const next = prev + 1;
          if (next >= totalChars) {
            clearInterval(interval);

            if (successAnimationPhase === 1) {
              // Phase 1 complete (all green), start phase 2 (back to default)
              setTimeout(() => {
                setSuccessAnimationPhase(2);
                setSuccessAnimationProgress(0);
              }, 50); // Brief pause when fully green
            } else {
              // Phase 2 complete, reset everything
              setTimeout(() => {
                setSuccessAnimatingIndex(-1);
                setSuccessAnimationProgress(0);
                setSuccessAnimationPhase(1);
              }, 500); // Brief pause at end
            }
            return totalChars;
          }
          return next;
        });
      }, 20); // 20ms per character

      return () => clearInterval(interval);
    }
  }, [successAnimatingIndex, successAnimationPhase, commits]);

  // Spinner animation effect for Claude Decide
  useEffect(() => {
    if (showClaudeDecide && claudeDecideState === "loading") {
      const interval = setInterval(() => {
        setSpinnerFrameIndex((prev) => (prev + 1) % 5); // 10 frames in bouncingBall
      }, 125); // 80ms interval as per cli-spinners

      return () => clearInterval(interval);
    }
  }, [showClaudeDecide, claudeDecideState]);

  // State detection for empty repository
  const hasCommits = commits.length > 0;
  const isEmptyRepository = isGitRepository === true && !hasCommits;

  // Create display items ("Create checkpoint" + commits)
  const displayItems = [
    { type: "create", text: "1 Create checkpoint", timestamp: "" },
    ...commits.map((commit) => ({ type: "commit", ...commit })),
  ];

  // Get visible items (sliding window) - reduced to 3 to accommodate two-line commits
  const visibleItems = displayItems.slice(windowStart, windowStart + 3);

  // Available options
  const availableOptions = [
    { key: "audio", label: "Audio", type: "boolean" },
    {
      key: "customPrefix",
      label: "Prefix custom messages with 'Vibe'",
      type: "boolean",
    },
    {
      key: "autoCheckpoint",
      label: "Auto-checkpoint Mode",
      type: "boolean",
    },
  ];

  // Create checkpoint options
  const getCreateCheckpointOptions = () => {
    const lastInputText =
      lastClaudeInput && lastClaudeInput.text
        ? lastClaudeInput.text.length > 60
          ? lastClaudeInput.text.slice(0, 60) + "..."
          : lastClaudeInput.text
        : "No recent input found";

    return [
      `1 "${lastInputText}"`,
      "2 I'll customize it",
      "3 Let Claude decide",
    ];
  };

  // Render revert confirmation view
  const renderRevertConfirmView = () => {
    if (!selectedRevertCommit) return null;

    // Calculate which commits will be lost (all commits before the selected one in the list)
    const revertCommitIndex = commits.findIndex(
      (commit) => commit.hash === selectedRevertCommit.hash
    );
    const commitsToLose = commits.slice(0, revertCommitIndex);

    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "Are you sure you want to revert to this checkpoint?"
          ),
          React.createElement(Text, null, " "),
          React.createElement(Text, null, " "),

          React.createElement(Text, null, "You are about to revert to:"),
          React.createElement(
            Text,
            { color: "yellow" },
            `> ${selectedRevertCommit.text} - ${selectedRevertCommit.timestamp}`
          ),
          React.createElement(Text, null, " "),

          commitsToLose.length > 0 &&
            React.createElement(
              Text,
              null,
              "This will permanently remove the following checkpoints:"
            ),
          ...commitsToLose.map((commit, index) =>
            React.createElement(
              Text,
              { key: index, color: "red" },
              `• ${commit.text} - ${commit.timestamp}`
            )
          ),
          commitsToLose.length > 0 && React.createElement(Text, null, " "),

          React.createElement(
            Text,
            null,
            commitsToLose.length > 0
              ? `WARNING: This will permanently delete ${
                  commitsToLose.length
                } checkpoint${
                  commitsToLose.length > 1 ? "s" : ""
                } AND all other`
              : "This will permanently revert to this checkpoint AND all other"
          ),
          React.createElement(
            Text,
            null,
            "changes that happened after this point."
          ),
          React.createElement(Text, null, " "),
          React.createElement(Text, null, " "),

          React.createElement(
            Text,
            { color: "green" },
            "Press 'y' to confirm revert"
          ),
          React.createElement(Text, { color: "gray" }, "Press 'Esc' to cancel")
        )
      )
    );
  };

  // Render undo confirmation view
  const renderUndoConfirmView = () => {
    const currentCommit = commits.length > 0 ? commits[0] : null;

    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "Are you sure you want to undo the last checkpoint?"
          ),
          React.createElement(Text, null, " "),
          React.createElement(Text, null, " "),

          React.createElement(Text, null, "You are about to undo:"),
          currentCommit &&
            React.createElement(
              Text,
              { color: "yellow" },
              `> ${currentCommit.text} - ${currentCommit.timestamp}`
            ),
          React.createElement(Text, null, " "),

          React.createElement(
            Text,
            null,
            "This will permanently undo the last checkpoint AND all other changes made after it"
          ),
          React.createElement(Text, null, "that happened after it."),
          React.createElement(Text, null, " "),
          React.createElement(Text, null, " "),

          React.createElement(
            Text,
            { color: "green" },
            "Press 'y' to confirm undo"
          ),
          React.createElement(Text, { color: "gray" }, "Press 'Esc' to cancel")
        )
      )
    );
  };

  // Render Create checkpoint view
  const renderCreateCheckpointView = () => {
    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      // File changes section (above the box)
      ...currentFileChanges.added.map((file, index) =>
        React.createElement(
          Text,
          {
            key: `added-${index}`,
            color: "green",
          },
          `+ ${file}`
        )
      ),
      ...currentFileChanges.modified.map((file, index) =>
        React.createElement(
          Text,
          {
            key: `modified-${index}`,
            color: "yellow",
            inverse: true,
          },
          `~ ${file}`
        )
      ),
      ...currentFileChanges.removed.map((file, index) =>
        React.createElement(
          Text,
          {
            key: `removed-${index}`,
            color: "red",
            inverse: true,
          },
          `- ${file}`
        )
      ),

      // Add spacing if there are file changes
      (currentFileChanges.added.length > 0 ||
        currentFileChanges.modified.length > 0 ||
        currentFileChanges.removed.length > 0) &&
        React.createElement(Text, null, " "),

      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "What would you like to name your Checkpoint?"
          ),
          React.createElement(Text, null, " "),

          getCreateCheckpointOptions().map((option, index) => {
            const isSelected = index === createCheckpointSelectedIndex;
            const indicator = isSelected ? ">" : " ";

            return React.createElement(
              Box,
              { key: index, width: "100%" },
              React.createElement(
                Text,
                { color: isSelected ? "yellow" : "white" },
                `${indicator} ${option}`
              )
            );
          }),

          React.createElement(Text, null, " "),
          React.createElement(
            Text,
            { color: "gray" },
            "Press 1-3 to select • Enter to confirm • Esc to go back"
          ),

          // Error display
          createCheckpointError && React.createElement(Text, null, " "),
          createCheckpointError &&
            React.createElement(Text, { color: "red" }, createCheckpointError)
        )
      )
    );
  };

  // Render checkpoint details view
  const renderCheckpointDetailsView = () => {
    if (!selectedCommitDetails) return null;

    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "Checkpoint Details"
          ),
          React.createElement(Text, null, " "),

          // Split full commit message on actual newlines and render each line
          ...selectedCommitDetails.fullText.split("\n").map((line, index) =>
            React.createElement(
              Text,
              {
                key: `commit-line-${index}`,
                wrap: "wrap",
              },
              line || " " // Empty string becomes space to preserve blank lines
            )
          ),
          React.createElement(Text, null, " "),
          React.createElement(
            Text,
            { color: "gray" },
            selectedCommitDetails.timestamp
          ),
          React.createElement(Text, null, " "),

          // File changes section
          (commitFileChanges.added.length > 0 ||
            commitFileChanges.modified.length > 0 ||
            commitFileChanges.removed.length > 0) &&
            React.createElement(Text, { bold: true }, ""),

          // Added files
          ...commitFileChanges.added.map((file, index) =>
            React.createElement(
              Text,
              {
                key: `added-${index}`,
                color: "green",
                inverse: true,
              },
              `+ ${file}`
            )
          ),

          // Modified files
          ...commitFileChanges.modified.map((file, index) =>
            React.createElement(
              Text,
              {
                key: `modified-${index}`,
                color: "yellow",
                inverse: true,
              },
              `~ ${file}`
            )
          ),

          // Removed files
          ...commitFileChanges.removed.map((file, index) =>
            React.createElement(
              Text,
              {
                key: `removed-${index}`,
                color: "red",
                inverse: true,
              },
              `- ${file}`
            )
          ),

          (commitFileChanges.added.length > 0 ||
            commitFileChanges.modified.length > 0 ||
            commitFileChanges.removed.length > 0) &&
            React.createElement(Text, null, " "),
          React.createElement(Text, { color: "gray" }, "Press 'Esc' to go back")
        )
      )
    );
  };

  // Render custom label input view
  const renderCustomLabelView = () => {
    const charactersRemaining = Math.max(0, 72 - customLabel.length);

    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "Name your checkpoint"
          ),
          React.createElement(Text, null, " "),
          React.createElement(Text, null, " "),

          React.createElement(Text, null, `Label: ${customLabel}`),
          React.createElement(
            Text,
            { color: "gray" },
            charactersRemaining.toString()
          ),
          React.createElement(Text, null, " "),
          React.createElement(Text, null, " "),
          React.createElement(
            Text,
            { color: "gray" },
            "ESC to go back, ENTER to confirm"
          )
        )
      )
    );
  };

  // Render custom description input view
  const renderCustomDescriptionView = () => {
    const labelDisplay = `Label: ${customLabel}`;

    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "Add a description (optional)"
          ),
          React.createElement(Text, null, " "),
          React.createElement(Text, null, " "),

          React.createElement(Text, null, labelDisplay),
          React.createElement(Text, null, "Description:"),
          React.createElement(
            Box,
            { borderStyle: "single", padding: 1, minHeight: 3 },
            React.createElement(
              Text,
              { wrap: "wrap" },
              customDescription || " "
            )
          ),
          React.createElement(Text, null, " "),
          React.createElement(
            Text,
            { color: "gray" },
            "ESC to go back, Ctrl+D to confirm"
          )
        )
      )
    );
  };

  // Render options view
  const renderOptionsView = () => {
    const isAutoCheckpointSelected = optionsSelectedIndex === 2; // autoCheckpoint is at index 2

    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "Options"
          ),
          React.createElement(Text, null, " "),

          availableOptions.map((option, index) => {
            const isSelected = index === optionsSelectedIndex;
            const value = options[option.key];
            const displayValue = value ? "Yes" : "No";
            const indicator = isSelected ? ">" : " ";

            return React.createElement(
              Box,
              { key: option.key, width: "100%" },
              React.createElement(
                Box,
                { width: 50 },
                React.createElement(
                  Text,
                  { color: isSelected ? "yellow" : "white" },
                  `${indicator} ${option.label}`
                )
              ),
              React.createElement(
                Text,
                { color: isSelected ? "yellow" : "white" },
                displayValue
              )
            );
          }),

          React.createElement(Text, null, " "),

          // Auto-checkpoint warning text (only show when auto-checkpoint option is selected)
          isAutoCheckpointSelected &&
            React.createElement(
              Text,
              { bold: true, color: "red" },
              "WARNING: This is an experimental feature. We recommend you backup your code before enabling this."
            ),
          isAutoCheckpointSelected && React.createElement(Text, null, " "),
          isAutoCheckpointSelected &&
            React.createElement(
              Text,
              null,
              "Any new messages sent to Claude Code *automatically trigger* a checkpoint, even if there are no code changes."
            ),
          isAutoCheckpointSelected && React.createElement(Text, null, " "),
          isAutoCheckpointSelected &&
            React.createElement(
              Text,
              null,
              "Auto-checkpoints created containing changed code will include a `[*]` in front."
            ),
          isAutoCheckpointSelected && React.createElement(Text, null, " "),
          isAutoCheckpointSelected &&
            React.createElement(
              Text,
              null,
              "Any messages sent within 3 seconds of one another will *not* trigger a checkpoint."
            ),
          isAutoCheckpointSelected && React.createElement(Text, null, " "),
          isAutoCheckpointSelected &&
            React.createElement(
              Text,
              null,
              "We do not recommend using this mode if you already have a regular checkpoint or traditional git workflow."
            ),
          isAutoCheckpointSelected && React.createElement(Text, null, " "),
          isAutoCheckpointSelected &&
            React.createElement(
              Text,
              { bold: true },
              "This is a great mode to use:"
            ),
          isAutoCheckpointSelected &&
            React.createElement(
              Text,
              null,
              "- If you're coming from Cursor or another IDE with checkpoints"
            ),
          isAutoCheckpointSelected &&
            React.createElement(
              Text,
              null,
              "- Rapidly prototyping and don't want to lose flow"
            ),
          isAutoCheckpointSelected && React.createElement(Text, null, " "),

          React.createElement(Text, { color: "gray" }, "Esc to exit")
        )
      )
    );
  };

  // Render loading animation for Claude Decide
  const renderLoadingText = () => {
    // Simply return the entire loading text in orange color (no animation)
    return chalk.hex("#FFA500")(loadingAnimationText);
  };

  const renderSpinner = () => {
    // bouncingBall spinner from cli-spinners
    const spinnerFrames = ["∙∙∙", "●∙∙", "∙●∙", "∙∙●", "∙∙∙"];

    return chalk.hex("#FFA500")(spinnerFrames[spinnerFrameIndex]);
  };

  // Unified render function for Claude Decide (handles both loading and suggestions)
  const renderClaudeDecideView = () => {
    const isLoading = claudeDecideState === "loading";

    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "Claude's Suggestions"
          ),
          React.createElement(Text, null, " "),

          // Conditionally render loading spinner/text or suggestions
          ...(isLoading
            ? [
                React.createElement(
                  Text,
                  { key: "loading-with-spinner" },
                  `${renderSpinner()} ${renderLoadingText()}`
                ),
              ]
            : [
                ...claudeSuggestions.map((suggestion, index) => {
                  const isSelected = index === selectedSuggestionIndex;
                  const indicator = isSelected ? ">" : " ";
                  const label =
                    suggestion.type === "vibecoder"
                      ? "Vibecoder"
                      : "Prototyper";

                  return React.createElement(
                    Box,
                    { key: index, flexDirection: "row", width: "100%" },
                    // Left column - indicator and label
                    React.createElement(
                      Box,
                      { width: 18, flexShrink: 0 },
                      React.createElement(
                        Text,
                        { color: isSelected ? "yellow" : "white" },
                        `${indicator} ${index + 1} ${label}:`
                      )
                    ),
                    // Right column - message text
                    React.createElement(
                      Box,
                      { flexGrow: 1 },
                      React.createElement(
                        Text,
                        {
                          color: isSelected ? "yellow" : "white",
                          wrap: "wrap",
                        },
                        `"${suggestion.message}"`
                      )
                    )
                  );
                }),

                React.createElement(Text, { key: "spacer" }, " "),

                // Show partial error if present
                partialError &&
                  React.createElement(
                    Text,
                    { key: "partial-error", color: "yellow" },
                    `⚠ ${partialError}`
                  ),
                partialError &&
                  React.createElement(Text, { key: "spacer-2" }, " "),

                React.createElement(
                  Text,
                  { key: "help", color: "gray" },
                  claudeSuggestions.length === 1
                    ? "Press 1 to select • Enter to confirm • Esc to go back"
                    : "Press 1-2 to select • Enter to confirm • Esc to go back"
                ),
              ])
        )
      )
    );
  };

  // Render Claude Decide suggestions view
  const renderClaudeDecideSuggestionsView = () => {
    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "Claude's Suggestions"
          ),
          React.createElement(Text, null, " "),

          ...claudeSuggestions.map((suggestion, index) => {
            const isSelected = index === selectedSuggestionIndex;
            const indicator = isSelected ? ">" : " ";
            const label =
              suggestion.type === "vibecoder" ? "Vibecoder" : "Prototyper";

            return React.createElement(
              Text,
              {
                key: index,
                color: isSelected ? "yellow" : "white",
                wrap: "wrap",
              },
              `${indicator} ${index + 1} ${label}: ${suggestion.message}`
            );
          }),

          React.createElement(Text, null, " "),
          React.createElement(
            Text,
            { color: "gray" },
            "Press 1-2 to select • Enter to confirm • Esc to go back"
          )
        )
      )
    );
  };

  // Render Claude Decide error view
  const renderClaudeDecideErrorView = () => {
    const isCommitError = claudeDecideError?.includes(
      "Failed to create checkpoint"
    );

    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "red" },
            isCommitError
              ? "Checkpoint Creation Failed"
              : "Claude Decide Failed"
          ),
          React.createElement(Text, null, " "),
          React.createElement(Text, null, claudeDecideError),
          React.createElement(Text, null, " "),
          React.createElement(Text, { color: "yellow" }, "Options:"),

          // Different options based on error type
          ...(isCommitError
            ? [
                React.createElement(
                  Text,
                  null,
                  "• Press 'r' to retry creating checkpoint"
                ),
                React.createElement(
                  Text,
                  null,
                  "• Press 'b' to go back to suggestions"
                ),
                React.createElement(
                  Text,
                  null,
                  "• Press 'c' to write custom message instead"
                ),
              ]
            : [
                React.createElement(
                  Text,
                  null,
                  "• Press 'r' to retry Claude analysis"
                ),
                React.createElement(
                  Text,
                  null,
                  "• Press 'c' to write custom message instead"
                ),
              ]),

          React.createElement(
            Text,
            { color: "gray" },
            "• Press 'Esc' to go back"
          )
        )
      )
    );
  };

  // Render a single display item (create checkpoint or commit)
  const renderDisplayItem = (item, index, isSelected) => {
    const globalIndex = windowStart + index;
    const indicator = isSelected ? ">" : " ";

    if (item.type === "create") {
      return React.createElement(
        Box,
        { key: "create-checkpoint", width: "100%", flexDirection: "column", marginBottom: 1 },
        React.createElement(
          Text,
          {
            color:
              isSelected && hasUncommittedChanges
                ? "red"
                : isSelected
                ? "yellow"
                : hasUncommittedChanges
                ? "redBright"
                : "white",
            inverse: isSelected && hasUncommittedChanges,
            wrap: "truncate",
          },
          `${indicator} ${item.text}`
        ),
        React.createElement(
          Text,
          {
            color: "gray",
            wrap: "truncate",
          },
          "    Now"
        )
      );
    }

    // Handle regular commit - now using two lines
    const commitIndex = globalIndex - 1; // Adjust for "Create checkpoint" offset
    const isSuccessAnimating = globalIndex === successAnimatingIndex;

    // Truncate text to prevent wrapping issues
    const maxTextWidth = 80; // Adjust based on typical terminal width
    let truncatedText = item.text;
    if (truncatedText.length > maxTextWidth) {
      truncatedText = truncatedText.slice(0, maxTextWidth - 3) + "...";
    }

    // Build the commit message line
    let commitMessageLine;

    if (isSuccessAnimating) {
      // Apply two-phase success animation
      const animatedText = truncatedText
        .split("")
        .map((char, charIndex) => {
          if (successAnimationPhase === 1) {
            // Phase 1: Default → Green (left to right)
            if (charIndex < successAnimationProgress) {
              return chalk.green(char); // green
            } else {
              return char; // default color
            }
          } else {
            // Phase 2: Green → Default (left to right)
            if (charIndex < successAnimationProgress) {
              return char; // back to default color
            } else {
              return chalk.green(char); // still green
            }
          }
        })
        .join("");
      commitMessageLine = `${indicator} ${animatedText}`;
    } else {
      commitMessageLine = `${indicator} ${truncatedText}`;
    }

    return React.createElement(
      Box,
      { key: globalIndex, width: "100%", flexDirection: "column", marginBottom: 1 },
      React.createElement(
        Text,
        {
          color: isSelected ? "yellow" : "white",
          wrap: "truncate",
        },
        commitMessageLine
      ),
      React.createElement(
        Text,
        {
          color: "gray",
          wrap: "truncate",
        },
        `    ${item.timestamp}`
      )
    );
  };

  // Render main view
  const renderMainView = () => {
    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      // "Where You and Claude Left Off" section with orange border
      React.createElement(
        Box,
        {
          borderStyle: "round",
          borderColor: "#ffe4b2ff",
          borderDimColor: true,
          padding: 1,
          marginBottom: 1,
        },
        React.createElement(
          Box,
          { flexDirection: "column" },
          // Header with same formatting as "Checkpoint History"
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "You and Claude"
          ),
          React.createElement(Text, null, " "),

          // Content with timestamp and message
          React.createElement(
            Box,
            { flexDirection: "row" },
            // Left column - timestamp and arrow
            React.createElement(
              Box,
              { width: 12, flexShrink: 0 },
              React.createElement(
                Text,
                { color: "gray" },
                lastClaudeInput && lastClaudeInput.timestamp
                  ? `${lastClaudeInput.timestamp.split(" at ")[1]} ►`
                  : ""
              )
            ),
            // Right column - message text
            React.createElement(
              Box,
              { flexGrow: 1 },
              React.createElement(
                Text,
                { color: "gray", wrap: "wrap" },
                lastClaudeInput && lastClaudeInput.text
                  ? lastClaudeInput.text
                  : "No recent Claude Code input found"
              )
            )
          )
        )
      ),
      React.createElement(
        Box,
        {
          borderStyle: autoCommitFlashActive ? "bold" : "round", // Bold during flash
          borderColor: autoCommitFlashActive
            ? "#FFA500" // Orange flash takes priority
            : autoCommitCooldownActive
            ? "gray" // Gray during cooldown
            : hasUncommittedChanges
            ? "redBright"
            : "green",
          borderDimColor: autoCommitCooldownActive, // Dim during cooldown
          padding: 1,
        },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "blueBright" },
            "Checkpoint History"
          ),
          React.createElement(Text, null, " "),

          visibleItems.length === 0 ||
            (visibleItems.length === 1 && visibleItems[0].type === "create")
            ? [
                renderDisplayItem(
                  { type: "create", text: "1 Create checkpoint" },
                  0,
                  selectedIndex === 0
                ),
                React.createElement(
                  Text,
                  {
                    color: isEmptyRepository ? "gray" : "yellow",
                    key: "status",
                  },
                  isEmptyRepository
                    ? "No commits yet - create your first checkpoint!"
                    : "Loading commits..."
                ),
              ]
            : visibleItems.map((item, index) =>
                renderDisplayItem(
                  item,
                  index,
                  windowStart + index === selectedIndex
                )
              ),

          React.createElement(Text, null, " "),

          React.createElement(
            Text,
            { color: "gray" },
            hasCommits
              ? "Use ↑↓ to navigate • 1 to create • d for details • r to revert to this checkpoint • u to undo last checkpoint • o for options • x to exit"
              : "1 to create your first checkpoint • o for options • x to exit"
          )
        )
      ),

      // Blank line
      React.createElement(Text, null, " "),

      // Status line: branch name, commit count, file changes
      React.createElement(
        Text,
        null,
        currentBranch &&
          React.createElement(Text, { color: "blue" }, `${currentBranch} `),
        `${commits.length} `,
        React.createElement(Text, { color: "blue" }, "✓"),
        options.autoCheckpoint &&
          React.createElement(
            Text,
            { color: "gray" },
            " [ ] auto-checkpoint mode"
          ),
        fileChangesCount > 0 &&
          React.createElement(
            Text,
            { color: "gray" },
            ` ${fileChangesCount} file${
              fileChangesCount === 1 ? "" : "s"
            } changed`
          )
      )
    );
  };

  // Show loading or error state if git repository check is in progress or failed
  if (isGitRepository === null) {
    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(Text, null, "Checking git repository...")
    );
  }

  if (isGitRepository === false) {
    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", padding: 1 },
        React.createElement(
          Box,
          { flexDirection: "column" },
          React.createElement(
            Text,
            { bold: true, color: "red" },
            "Not a Git Repository"
          ),
          React.createElement(Text, null, " "),
          React.createElement(
            Text,
            null,
            "Checkpoints can only run in directories that are git repositories."
          ),
          React.createElement(Text, null, " "),
          React.createElement(Text, null, "Our project directory is:"),
          React.createElement(Text, { color: "yellow" }, process.cwd()),
          React.createElement(Text, null, " "),
          React.createElement(
            Text,
            null,
            "Do you want to create a git repository here?"
          ),
          React.createElement(Text, null, " "),
          React.createElement(
            Text,
            null,
            "When you run Claude Code, it should be run from this same directory. Make sure it only includes the subdirectories and files you want to change during coding sessions"
          ),
          React.createElement(Text, null, " "),
          React.createElement(Text, { color: "green" }, "Press 'y' to confirm"),
          React.createElement(Text, { color: "gray" }, "Press 'x' to exit")
        )
      )
    );
  }

  if (showClaudeDecide) {
    if (
      claudeDecideState === "loading" ||
      claudeDecideState === "suggestions"
    ) {
      return renderClaudeDecideView(); // Unified function handles both states
    } else if (claudeDecideState === "error") {
      return renderClaudeDecideErrorView();
    }
  }

  if (showCustomLabel) {
    return renderCustomLabelView();
  }

  if (showCustomDescription) {
    return renderCustomDescriptionView();
  }

  if (showCheckpointDetails) {
    return renderCheckpointDetailsView();
  }

  if (showCreateCheckpoint) {
    return renderCreateCheckpointView();
  }

  if (showRevertConfirm) {
    return renderRevertConfirmView();
  }

  if (showUndoConfirm) {
    return renderUndoConfirmView();
  }

  if (showOptions) {
    return renderOptionsView();
  }

  return renderMainView();
};

// Only render if this file is run directly (handle both direct execution and npm global symlinks)
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith("vpoints") ||
  process.argv[1].includes("conversation-history-app.js");

if (isMainModule) {
  render(React.createElement(GitCommitHistoryApp));
}

export default GitCommitHistoryApp;
