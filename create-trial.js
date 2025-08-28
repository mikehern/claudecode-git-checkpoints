#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import readline from 'readline';

const createTrialCopy = () => {
  const cwd = process.cwd();
  const projectName = path.basename(cwd);
  const parentDir = path.dirname(cwd);
  const trialDir = path.join(parentDir, `${projectName}-trial`);

  console.log(`📁 Current directory: ${cwd}`);
  console.log(`🎯 Trial directory: ${trialDir}`);

  // Check if trial directory already exists
  if (fs.existsSync(trialDir)) {
    console.log(`⚠️  Trial directory already exists: ${trialDir}`);
    console.log('   Removing existing trial directory...');
    fs.rmSync(trialDir, { recursive: true, force: true });
  }

  try {
    // Copy the entire directory recursively
    console.log('📋 Copying files recursively...');
    fs.cpSync(cwd, trialDir, { 
      recursive: true,
      preserveTimestamps: true,
      filter: (src, dest) => {
        // Skip node_modules and other large directories that can be regenerated
        const relativePath = path.relative(cwd, src);
        if (relativePath.includes('node_modules') || 
            relativePath.includes('.git') ||
            relativePath.startsWith('.')) {
          return false;
        }
        return true;
      }
    });

    console.log('✅ Files copied successfully');

    // Check if git is already initialized in the trial directory
    const gitDir = path.join(trialDir, '.git');
    if (fs.existsSync(gitDir)) {
      console.log('🔍 Git repository already exists in trial directory');
    } else {
      console.log('🔧 Initializing git repository...');
      execSync('git init', { 
        cwd: trialDir,
        stdio: 'inherit'
      });
      console.log('✅ Git repository initialized');
    }

    console.log(`🎉 Trial copy created successfully at: ${trialDir}`);
    console.log(`💡 To start working: cd ${trialDir}`);

    // Prompt user to open Checkpoints in trial project
    promptToOpenCheckpoints(trialDir);

  } catch (error) {
    console.error('❌ Error creating trial copy:', error.message);
    process.exit(1);
  }
};

const promptToOpenCheckpoints = (trialDir) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\nOpen Checkpoints in the trial project? y(es)/n(o): ', (answer) => {
    const response = answer.toLowerCase().trim();
    
    if (response === 'y' || response === 'yes') {
      console.log('🚀 Opening Checkpoints in trial project...');
      rl.close();
      
      // Change to trial directory and run vpoints
      const vpointsProcess = spawn('vpoints', [], {
        cwd: trialDir,
        stdio: 'inherit'
      });
      
      vpointsProcess.on('close', (code) => {
        console.log(`\n👋 Checkpoints closed with exit code ${code}`);
        process.exit(0);
      });
      
      vpointsProcess.on('error', (error) => {
        console.error('❌ Error running vpoints:', error.message);
        console.log('💡 Make sure vpoints is installed globally: npm install -g vibepoints');
        process.exit(1);
      });
      
    } else if (response === 'n' || response === 'no') {
      console.log('👋 Trial project ready. Use: cd ' + trialDir);
      rl.close();
      process.exit(0);
    } else {
      console.log('❓ Please answer y(es) or n(o)');
      rl.close();
      promptToOpenCheckpoints(trialDir);
    }
  });
};

createTrialCopy();