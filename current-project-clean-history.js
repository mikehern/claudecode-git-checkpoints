#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

// Get current working directory
const currentDir = process.cwd();

// Construct Claude Code project path  
const claudeProjectPath = path.join(os.homedir(), '.claude', 'projects', `${currentDir.replace(/\//g, '-')}`);

function extractUserInputs(jsonlFilePath) {
    const userInputs = [];
    
    try {
        const content = fs.readFileSync(jsonlFilePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            try {
                const message = JSON.parse(line);
                
                // Filter for actual user input messages
                if (message.type === 'user' && 
                    message.message && 
                    message.message.content &&
                    !message.isMeta &&
                    !message.message.content.startsWith('Caveat:') &&
                    !message.message.content.includes('<command-name>') &&
                    !message.message.content.includes('<local-command-stdout>') &&
                    message.message.content !== '[Request interrupted by user for tool use]') {
                    
                    // Convert UTC timestamp to Pacific Time
                    const utcDate = new Date(message.timestamp);
                    const pacificDate = new Date(utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
                    
                    // Format as user-friendly string
                    const formattedDate = pacificDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });
                    
                    const formattedTime = pacificDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });
                    
                    userInputs.push({
                        content: message.message.content,
                        timestamp: `${formattedDate} at ${formattedTime}`,
                        rawTimestamp: utcDate
                    });
                }
            } catch (parseError) {
                // Skip invalid JSON lines
                continue;
            }
        }
    } catch (error) {
        console.error(`Error reading file ${jsonlFilePath}:`, error.message);
    }
    
    return userInputs;
}

function main() {
    console.log('# Claude Code User Input History');
    console.log(`**Project:** ${currentDir}`);
    console.log(`**Source:** ${claudeProjectPath}`);
    console.log('');
    
    if (!fs.existsSync(claudeProjectPath)) {
        console.log('No Claude Code conversation history found for this project.');
        return;
    }
    
    try {
        const files = fs.readdirSync(claudeProjectPath);
        const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
        
        if (jsonlFiles.length === 0) {
            console.log('No conversation files found in project directory.');
            return;
        }
        
        // Collect all user inputs from all conversation files
        const allUserInputs = [];
        
        for (const file of jsonlFiles) {
            const filePath = path.join(claudeProjectPath, file);
            const inputs = extractUserInputs(filePath);
            allUserInputs.push(...inputs);
        }
        
        // Sort by timestamp (oldest first)
        allUserInputs.sort((a, b) => a.rawTimestamp - b.rawTimestamp);
        
        if (allUserInputs.length === 0) {
            console.log('No actual user input messages found (filtered out system messages, commands, etc.).');
            return;
        }
        
        // Display results
        console.log(`## Found ${allUserInputs.length} User Input Messages\n`);
        
        for (const input of allUserInputs) {
            console.log(`• **${input.content}** - ${input.timestamp}`);
            console.log('');
        }
        
        console.log(`## Summary`);
        console.log(`- Total conversations: ${jsonlFiles.length}`);
        console.log(`- Total user inputs: ${allUserInputs.length}`);
        
        if (allUserInputs.length > 0) {
            console.log(`- Time span: ${allUserInputs[0].timestamp} to ${allUserInputs[allUserInputs.length - 1].timestamp}`);
        }
        
    } catch (error) {
        console.error('Error processing conversation files:', error.message);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { extractUserInputs };