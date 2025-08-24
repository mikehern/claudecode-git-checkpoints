#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Text, Box, useInput, useApp } from "ink";
import chalk from "chalk";
import { execSync } from "child_process";
import sound from "play-sound";
import fs from "fs";
import path from "path";

const ConversationHistoryApp = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [animatingIndex, setAnimatingIndex] = useState(-1);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
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
        const data = fs.readFileSync(optionsPath, 'utf8');
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

  // Load conversation history
  useEffect(() => {
    try {
      const output = execSync("node current-project-clean-history.js", {
        encoding: "utf8",
        cwd: process.cwd(),
      });

      // Parse the conversations from the script output
      const lines = output.split("\n");
      const conversationLines = lines
        .filter((line) => line.startsWith("• **") && line.includes("** - "))
        .map((line) => {
          const match = line.match(/• \*\*(.*?)\*\* - (.+)/);
          return match
            ? {
                text: match[1],
                timestamp: match[2],
              }
            : null;
        })
        .filter(Boolean);

      setConversations(conversationLines);
    } catch (error) {
      console.error("Failed to load conversation history:", error.message);
      setConversations([
        { text: "Error loading conversations", timestamp: "Unknown" },
      ]);
    }
  }, []);

  // Handle keyboard input
  useInput((input, key) => {
    if (showOptions) {
      // Options page navigation
      if (key.escape) {
        setShowOptions(false);
        return;
      }
      
      if (key.leftArrow || key.rightArrow) {
        if (optionsSelectedIndex === 0) { // Audio option
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
        const newIndex = Math.min(conversations.length - 1, prev + 1);
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
      const conversation = conversations[animatingIndex];
      if (!conversation) return;

      const totalChars = conversation.text.length;
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
  }, [animatingIndex, conversations]);

  // Get visible conversations (sliding window)
  const visibleConversations = conversations.slice(
    windowStart,
    windowStart + 4
  );

  // Available options
  const availableOptions = [
    { key: 'audio', label: 'Audio', type: 'boolean' }
  ];

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
          React.createElement(
            Text,
            { color: "gray" },
            "Esc to exit"
          )
        )
      )
    );
  };

  // Render a single conversation item
  const renderConversation = (conversation, index, isSelected) => {
    const globalIndex = windowStart + index;
    const isAnimating = globalIndex === animatingIndex;
    const indicator = isSelected ? ">" : " ";

    // Truncate text to prevent wrapping issues (leave space for indicator, timestamp)
    const maxTextWidth = 80; // Adjust based on typical terminal width
    let truncatedText = conversation.text;
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
      completeLine = `${indicator} ${animatedText} - ${conversation.timestamp}`;
    } else {
      completeLine = `${indicator} ${truncatedText} - ${conversation.timestamp}`;
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

  if (showOptions) {
    return renderOptionsView();
  }

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
          "Conversation History"
        ),
        React.createElement(
          Text,
          { color: "gray" },
          "Use ↑↓ to navigate • Press 1 to animate • o for options • q/Esc to exit"
        ),
        React.createElement(Text, null, " "),

        visibleConversations.length === 0
          ? React.createElement(
              Text,
              { color: "yellow" },
              "Loading conversations..."
            )
          : visibleConversations.map((conversation, index) =>
              renderConversation(
                conversation,
                index,
                windowStart + index === selectedIndex
              )
            ),

        conversations.length > 4 &&
          React.createElement(
            Text,
            { color: "gray" },
            `Showing ${windowStart + 1}-${Math.min(
              windowStart + 4,
              conversations.length
            )} of ${conversations.length} conversations`
          )
      )
    )
  );
};

// Only render if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  render(React.createElement(ConversationHistoryApp));
}

export default ConversationHistoryApp;
