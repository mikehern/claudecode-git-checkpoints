#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Text, Box, useInput, useApp } from "ink";
import chalk from "chalk";
import { execSync } from "child_process";

const ConversationHistoryApp = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [animatingIndex, setAnimatingIndex] = useState(-1);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [windowStart, setWindowStart] = useState(0);
  const { exit } = useApp();

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
    if (input === "q" || key.escape) {
      exit();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => {
        const newIndex = Math.max(0, prev - 1);
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
        // Adjust window if selection goes below visible area
        if (newIndex >= windowStart + 4) {
          setWindowStart(newIndex - 3);
        }
        return newIndex;
      });
    }

    if (input === "1" && animatingIndex === -1) {
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
          "Use ↑↓ to navigate • Press 1 to animate • q/Esc to exit"
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
