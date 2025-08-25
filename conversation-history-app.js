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
  const [showCreateVibepoint, setShowCreateVibepoint] = useState(false);
  const [createVibepointSelectedIndex, setCreateVibepointSelectedIndex] =
    useState(0);
  const [createVibepointError, setCreateVibepointError] = useState(null);
  const [showVibepointDetails, setShowVibepointDetails] = useState(false);
  const [selectedCommitDetails, setSelectedCommitDetails] = useState(null);
  const [commitFileChanges, setCommitFileChanges] = useState({
    added: [],
    modified: [],
    removed: [],
  });
  const [successAnimatingIndex, setSuccessAnimatingIndex] = useState(-1);
  const [successAnimationProgress, setSuccessAnimationProgress] = useState(0);
  const [successAnimationPhase, setSuccessAnimationPhase] = useState(1); // 1 = turning green, 2 = turning back to default
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
          hash: commit.hash,
        };
      });

      setCommits(commitList);

      // Keep "Create vibepoint" selected (index 0) and reset window
      setSelectedIndex(0);
      setWindowStart(0);
    } catch (error) {
      console.error("Failed to load commit history:", error.message);
      setCommits([{ text: "Error loading commits", timestamp: "Unknown" }]);
    }
  };

  // Create vibepoint with last user input
  const createVibepointWithLastInput = async () => {
    try {
      setCreateVibepointError(null);
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
      setShowCreateVibepoint(false);

      // Start success animation for the newly created commit (index 1 because "Create vibepoint" is at 0)
      setSuccessAnimatingIndex(1);
      setSuccessAnimationProgress(0);
    } catch (error) {
      console.error("Failed to create vibepoint:", error.message);
      setCreateVibepointError(`Error: ${error.message}`);
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
    if (showVibepointDetails) {
      // Vibepoint details page navigation
      if (key.escape) {
        playNextSound();
        setShowVibepointDetails(false);
        setSelectedCommitDetails(null);
        setCommitFileChanges({ added: [], modified: [], removed: [] });
        return;
      }

      return;
    }

    if (showCreateVibepoint) {
      // Create vibepoint page navigation
      if (key.escape) {
        playNextSound();
        setShowCreateVibepoint(false);
        setCreateVibepointError(null);
        return;
      }

      if (key.upArrow) {
        setCreateVibepointSelectedIndex((prev) => {
          const newIndex = Math.max(0, prev - 1);
          if (newIndex !== prev) {
            playMenuSound();
          }
          return newIndex;
        });
      }

      if (key.downArrow) {
        setCreateVibepointSelectedIndex((prev) => {
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
        if (createVibepointSelectedIndex === 0) {
          // Execute Option 1 git operations directly
          setCreateVibepointError(null);
          createVibepointWithLastInput();
        } else if (createVibepointSelectedIndex === 1) {
          // TODO: Navigate to customize page
        } else if (createVibepointSelectedIndex === 2) {
          // TODO: Navigate to Claude decide page
        }
      }

      // Number key selection and execution
      if (input === "1") {
        setCreateVibepointSelectedIndex(0);
        playAnimationSound();
        // Execute Option 1 git operations directly
        setCreateVibepointError(null);
        createVibepointWithLastInput();
      } else if (input === "2") {
        setCreateVibepointSelectedIndex(1);
        playAnimationSound();
        // TODO: Navigate to customize page
      } else if (input === "3") {
        setCreateVibepointSelectedIndex(2);
        playAnimationSound();
        // TODO: Navigate to Claude decide page
      }

      return;
    }

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

    if (input === "c") {
      setShowCreateVibepoint(true);
      setCreateVibepointSelectedIndex(0);
      return;
    }

    if (input === "d") {
      // Only show details if a real commit is selected (not "Create vibepoint")
      if (selectedIndex > 0) {
        const commitIndex = selectedIndex - 1; // Adjust for "Create vibepoint" offset
        const commit = commits[commitIndex];
        if (commit) {
          playAnimationSound();
          setSelectedCommitDetails(commit);
          setShowVibepointDetails(true);

          // Load file changes for this commit
          getCommitFileChanges(commit.hash).then((changes) => {
            setCommitFileChanges(changes);
          });
        }
      }
      return;
    }

    if (key.return) {
      if (selectedIndex === 0) {
        // Selected "Create vibepoint"
        playAnimationSound();
        setShowCreateVibepoint(true);
        setCreateVibepointSelectedIndex(0);
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
        const totalItems = commits.length + 1; // +1 for "Create vibepoint"
        const newIndex = Math.min(totalItems - 1, prev + 1);
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
      if (selectedIndex > 0) {
        // Don't animate "Create vibepoint"
        playAnimationSound();
        setAnimatingIndex(selectedIndex - 1); // Adjust for "Create vibepoint" offset
        setAnimationProgress(0);
      }
    }
  });

  // Animation effect for main page commits
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
      }, 5); // 5ms per character

      return () => clearInterval(interval);
    }
  }, [animatingIndex, commits]);

  // Success animation effect for newly created commit on main page (two phases)
  useEffect(() => {
    if (successAnimatingIndex !== -1) {
      const commitIndex = successAnimatingIndex - 1; // Adjust for "Create vibepoint" offset
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

  // Create display items ("Create vibepoint" + commits)
  const displayItems = [
    { type: "create", text: "Create vibepoint", timestamp: "" },
    ...commits.map((commit) => ({ type: "commit", ...commit })),
  ];

  // Get visible items (sliding window)
  const visibleItems = displayItems.slice(windowStart, windowStart + 4);

  // Available options
  const availableOptions = [{ key: "audio", label: "Audio", type: "boolean" }];

  // Create vibepoint options
  const getCreateVibepointOptions = () => {
    const lastInputText =
      lastClaudeInput && lastClaudeInput.text
        ? lastClaudeInput.text.length > 60
          ? lastClaudeInput.text.slice(0, 60) + "..."
          : lastClaudeInput.text
        : "No recent input found";

    return [`1 ${lastInputText}`, "2 I'll customize it", "3 Let Claude decide"];
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

  // Render Create vibepoint view
  const renderCreateVibepointView = () => {
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
            "What would you like to name your Vibepoint?"
          ),
          React.createElement(Text, null, " "),

          getCreateVibepointOptions().map((option, index) => {
            const isSelected = index === createVibepointSelectedIndex;
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
          createVibepointError && React.createElement(Text, null, " "),
          createVibepointError &&
            React.createElement(Text, { color: "red" }, createVibepointError)
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
      React.createElement(Text, { color: "gray" }, "Press 'Esc' to go back")
    );
  };

  // Render vibepoint details view
  const renderVibepointDetailsView = () => {
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
            "Vibepoint Details"
          ),
          React.createElement(Text, null, " "),

          React.createElement(
            Text,
            { wrap: "wrap" },
            selectedCommitDetails.text
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

  // Render a single display item (create vibepoint or commit)
  const renderDisplayItem = (item, index, isSelected) => {
    const globalIndex = windowStart + index;
    const indicator = isSelected ? ">" : " ";

    if (item.type === "create") {
      return React.createElement(
        Box,
        { key: "create-vibepoint", width: "100%" },
        React.createElement(
          Text,
          {
            color: isSelected ? "yellow" : "white",
            wrap: "truncate",
          },
          `${indicator} ${item.text}`
        )
      );
    }

    // Handle regular commit
    const commitIndex = globalIndex - 1; // Adjust for "Create vibepoint" offset
    const isAnimating = commitIndex === animatingIndex;
    const isSuccessAnimating = globalIndex === successAnimatingIndex;

    // Truncate text to prevent wrapping issues (leave space for indicator, timestamp)
    const maxTextWidth = 80; // Adjust based on typical terminal width
    let truncatedText = item.text;
    if (truncatedText.length > maxTextWidth) {
      truncatedText = truncatedText.slice(0, maxTextWidth - 3) + "...";
    }

    // Build the complete line as a single string to avoid layout issues
    let completeLine;

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
      completeLine = `${indicator} ${animatedText} - ${item.timestamp}`;
    } else if (isAnimating) {
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
      completeLine = `${indicator} ${animatedText} - ${item.timestamp}`;
    } else {
      completeLine = `${indicator} ${truncatedText} - ${item.timestamp}`;
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
            { bold: true, color: "blueBright" },
            "Git Commit History"
          ),
          React.createElement(
            Text,
            { color: "gray" },
            "Use ↑↓ to navigate • Press Enter to select • Press 1 to animate • u to undo • v for input • o for options • q/Esc to exit"
          ),
          React.createElement(Text, null, " "),

          visibleItems.length === 0 ||
            (visibleItems.length === 1 && visibleItems[0].type === "create")
            ? [
                renderDisplayItem(
                  { type: "create", text: "Create vibepoint" },
                  0,
                  selectedIndex === 0
                ),
                React.createElement(
                  Text,
                  { color: "yellow", key: "loading" },
                  "Loading commits..."
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

          displayItems.length > 4 &&
            React.createElement(
              Text,
              { color: "gray" },
              `Showing ${windowStart + 1}-${Math.min(
                windowStart + 4,
                displayItems.length
              )} of ${displayItems.length} items (${commits.length} commits)`
            )
        )
      ),

      // Footer with 72-character preview of last Claude input
      lastClaudeInput &&
        lastClaudeInput.text &&
        React.createElement(
          Text,
          { color: "gray" },
          lastClaudeInput.text.length > 72
            ? lastClaudeInput.text.slice(0, 72)
            : lastClaudeInput.text
        ),

      // Blank line
      React.createElement(Text, null, " "),

      // Commit count with blue check mark
      React.createElement(
        Text,
        null,
        `${commits.length} `,
        React.createElement(Text, { color: "blue" }, "✓")
      )
    );
  };

  if (showVibepointDetails) {
    return renderVibepointDetailsView();
  }

  if (showCreateVibepoint) {
    return renderCreateVibepointView();
  }

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
