# Installation Instructions

## Prerequisites

- Node.js >= 16
- Git installed and available in PATH

## Global Installation

Install directly from GitHub:

```bash
npm install -g github:mikehern/claudecode-git-checkpoints

Verify installation:
which vpoints    # macOS/Linux
where vpoints    # Windows

Usage

Run vpoints from any git repository:

cd /path/to/your/git/repo
vpoints

## Trial Mode

Experiment safely with vpoints using trial mode:

```bash
vpoints --trial
```

This will:
- Copy your current project (excluding `.git` and `node_modules`)
- Create a new directory with `-trial` suffix
- Initialize a fresh git repository
- Optionally launch vpoints in the trial directory

Perfect for testing vpoints features without affecting your original project. When you're satisfied with your experiments, return to your original directory and run `vpoints` normally.

**Example:**
```bash
cd /path/to/my-project
vpoints --trial
# Creates /path/to/my-project-trial with fresh git history
# Experiment safely, then return to original when ready
```

Update

To update to the latest version:

npm install -g github:mikehern/claudecode-git-checkpoints

Uninstall

npm uninstall -g vpoints
```
