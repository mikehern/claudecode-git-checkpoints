#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Text, Box, useInput, useApp } from "ink";
import chalk from "chalk";
import simpleGit from "simple-git";
import sound from "play-sound";
import fs from "fs";
import path from "path";
import os from "os";

const GitCommitHistoryApp = () => {
  const [commits, setCommits] = useState([]);
  const [lastClaudeInput, setLastClaudeInput] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [animatingIndex, setAnimatingIndex] = useState(-1);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [showClaudeInput, setShowClaudeInput] = useState(false);
  const [options, setOptions] = useState({ audio: true });
  const [optionsSelectedIndex, setOptionsSelectedIndex] = useState(0);
  const { exit } = useApp();

  const optionsPath = path.join(process.cwd(), "options.json");

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
    return { audio: true };
  };

  // Save options to file
  const saveOptions = (newOptions) => {
    try {
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
      player.play("sounds/menu-move.wav");
    } catch (error) {
      // Silently fail if sound can't be played
    }
  };

  // Play animation sound
  const playAnimationSound = () => {
    if (!options.audio) return;
    try {
      player.play("sounds/next.wav");
    } catch (error) {
      // Silently fail if sound can't be played
    }
  };

  // Play revert sound
  const playRevertSound = () => {
    if (!options.audio) return;
    try {
      player.play("sounds/revert.wav");
    } catch (error) {
      // Silently fail if sound can't be played
    }
  };

  // Play next sound (for cancel actions)
  const playNextSound = () => {
    if (!options.audio) return;
    try {
      player.play("sounds/next.wav");
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
          text: commit.message || "No commit message",
          timestamp: `${formattedDate} at ${formattedTime}`,
        };
      });

      setCommits(commitList);

      // Reset selection to latest commit (index 0) and reset window
      setSelectedIndex(0);
      setWindowStart(0);
    } catch (error) {
      console.error("Failed to load commit history:", error.message);
      setCommits([{ text: "Error loading commits", timestamp: "Unknown" }]);
    }
  };

  // Undo last commit (git reset --hard HEAD~1)
  const undoLastCommit = async () => {
    try {
      const git = simpleGit(process.cwd());
      await git.reset(["--hard", "HEAD~1"]);
      loadCommits(); // Refresh the commit list
    } catch (error) {
      console.error("Failed to undo commit:", error.message);
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
          text: "No Claude Code history found",
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

  useEffect(() => {
    // Initial load
    loadCommits();
    loadLastClaudeInput();

    // Watch for Git changes
    const gitLogPath = path.join(process.cwd(), ".git", "logs", "HEAD");
    let gitWatcher = null;

    try {
      if (fs.existsSync(gitLogPath)) {
        gitWatcher = fs.watch(gitLogPath, (eventType) => {
          if (eventType === "change") {
            loadCommits();
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

    // Cleanup watchers on unmount
    return () => {
      if (gitWatcher) {
        gitWatcher.close();
      }
      if (claudeWatcher) {
        claudeWatcher.close();
      }
    };
  }, []);

  // Handle keyboard input
  useInput((input, key) => {
    if (showClaudeInput) {
      // Claude input page navigation
      if (key.escape) {
        playNextSound();
        setShowClaudeInput(false);
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

      if (key.leftArrow || key.rightArrow) {
        if (optionsSelectedIndex === 0) {
          // Audio option
          const newOptions = { ...options, audio: !options.audio };
          setOptions(newOptions);
          saveOptions(newOptions);
        }
      }

      return;
    }

    // Main page navigation
    if (input === "q" || key.escape) {
      exit();
      return;
    }

    if (input === "o") {
      setShowOptions(true);
      return;
    }

    if (input === "u") {
      setShowUndoConfirm(true);
      return;
    }

    if (input === "v") {
      setShowClaudeInput(true);
      return;
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
        const newIndex = Math.min(commits.length - 1, prev + 1);
        // Only play sound if selection actually changed
        if (newIndex !== prev) {
          playMenuSound();
        }
        // Adjust window if selection goes below visible area
        if (newIndex >= windowStart + 4) {
          setWindowStart(newIndex - 3);
        }
        return newIndex;
      });
    }

    if (input === "1" && animatingIndex === -1) {
      playAnimationSound();
      setAnimatingIndex(selectedIndex);
      setAnimationProgress(0);
    }
  });

  // Animation effect
  useEffect(() => {
    if (animatingIndex !== -1) {
      const commit = commits[animatingIndex];
      if (!commit) return;

      const totalChars = commit.text.length;
      const interval = setInterval(() => {
        setAnimationProgress((prev) => {
          const next = prev + 1;
          if (next >= totalChars) {
            clearInterval(interval);
            // Reset animation after a delay
            setTimeout(() => {
              setAnimatingIndex(-1);
              setAnimationProgress(0);
            }, 500);
            return totalChars;
          }
          return next;
        });
      }, 5); // 50ms per character

      return () => clearInterval(interval);
    }
  }, [animatingIndex, commits]);

  // Get visible commits (sliding window)
  const visibleCommits = commits.slice(windowStart, windowStart + 4);

  // Available options
  const availableOptions = [{ key: "audio", label: "Audio", type: "boolean" }];

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
            { bold: true, color: "magenta" },
            "Are you sure you want to undo the last vibepoint?"
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
            "This will permanently undo the last checkpoint AND all other changes"
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

  // Render Claude input view
  const renderClaudeInputView = () => {
    return React.createElement(
      Box,
      { flexDirection: "column", padding: 1 },
      React.createElement(
        Box,
        { borderStyle: "single", height: 4 },
        React.createElement(
          Box,
          { flexDirection: "column", padding: 0 },
          React.createElement(
            Text,
            { bold: true, color: "cyan" },
            "Last Claude Code Input:"
          ),
          lastClaudeInput
            ? React.createElement(
                Text,
                { color: "red" },
                `> ${
                  lastClaudeInput.text.length > 68
                    ? lastClaudeInput.text.slice(0, 65) + "..."
                    : lastClaudeInput.text
                }`
              )
            : React.createElement(Text, { color: "gray" }, "> Loading..."),
          lastClaudeInput && lastClaudeInput.timestamp
            ? React.createElement(
                Text,
                { color: "gray" },
                `  ${lastClaudeInput.timestamp}`
              )
            : React.createElement(Text, null, " "),
          React.createElement(Text, null, " ")
        )
      ),
      React.createElement(Text, null, " "),
      React.createElement(
        Text,
        { color: "gray" },
        "Press 'Esc' to go back"
      )
    );
  };

  // Render options view
  const renderOptionsView = () => {
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
            { bold: true, color: "magenta" },
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
                Text,
                { color: isSelected ? "yellow" : "white" },
                `${indicator} ${option.label}                    ${displayValue}`
              )
            );
          }),

          React.createElement(Text, null, " "),
          React.createElement(Text, { color: "gray" }, "Esc to exit")
        )
      )
    );
  };

  // Render a single commit item
  const renderCommit = (commit, index, isSelected) => {
    const globalIndex = windowStart + index;
    const isAnimating = globalIndex === animatingIndex;
    const indicator = isSelected ? ">" : " ";

    // Truncate text to prevent wrapping issues (leave space for indicator, timestamp)
    const maxTextWidth = 80; // Adjust based on typical terminal width
    let truncatedText = commit.text;
    if (truncatedText.length > maxTextWidth) {
      truncatedText = truncatedText.slice(0, maxTextWidth - 3) + "...";
    }

    // Build the complete line as a single string to avoid layout issues
    let completeLine;

    if (isAnimating) {
      // Apply blue to teal animation only to the main text
      const animatedText = truncatedText
        .split("")
        .map((char, charIndex) => {
          if (charIndex < animationProgress) {
            return chalk.cyan(char); // teal
          } else {
            return chalk.blue(char); // blue
          }
        })
        .join("");
      completeLine = `${indicator} ${animatedText} - ${commit.timestamp}`;
    } else {
      completeLine = `${indicator} ${truncatedText} - ${commit.timestamp}`;
    }

    return React.createElement(
      Box,
      { key: globalIndex, width: "100%" },
      React.createElement(
        Text,
        {
          color: isSelected ? "yellow" : "white",
          wrap: "truncate",
        },
        completeLine
      )
    );
  };

  // Render main view  
  const renderMainView = () => {
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
            { bold: true, color: "magenta" },
            "Git Commit History"
          ),
          React.createElement(
            Text,
            { color: "gray" },
            "Use ↑↓ to navigate • Press 1 to animate • u to undo • v for input • o for options • q/Esc to exit"
          ),
          React.createElement(Text, null, " "),

          visibleCommits.length === 0
            ? React.createElement(Text, { color: "yellow" }, "Loading commits...")
            : visibleCommits.map((commit, index) =>
                renderCommit(commit, index, windowStart + index === selectedIndex)
              ),

          React.createElement(Text, null, " "),

          commits.length > 4 &&
            React.createElement(
              Text,
              { color: "gray" },
              `Showing ${windowStart + 1}-${Math.min(
                windowStart + 4,
                commits.length
              )} of ${commits.length} commits`
            )
        )
      ),
      
      // Footer with 72-character preview of last Claude input
      lastClaudeInput && lastClaudeInput.text &&
        React.createElement(
          Text,
          { color: "gray" },
          lastClaudeInput.text.length > 72
            ? lastClaudeInput.text.slice(0, 72)
            : lastClaudeInput.text
        )
    );
  };

  if (showClaudeInput) {
    return renderClaudeInputView();
  }

  if (showUndoConfirm) {
    return renderUndoConfirmView();
  }

  if (showOptions) {
    return renderOptionsView();
  }

  return renderMainView();
};

// Only render if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  render(React.createElement(GitCommitHistoryApp));
}

export default GitCommitHistoryApp;
