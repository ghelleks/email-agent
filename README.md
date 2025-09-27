# Gmail Labeler — Automated Email Triage with AI

An intelligent Google Apps Script that automatically organizes your Gmail inbox by analyzing emails with Google's Gemini AI and applying helpful labels. Perfect for busy professionals who want to stay on top of their email without manual sorting.

## What This Does

This system automatically reads your incoming Gmail and sorts it into four actionable categories:

- **`reply_needed`** — Emails requiring your personal response (questions, meeting requests, urgent items)
- **`review`** — Emails to read but no immediate response needed (updates, newsletters, FYI messages)
- **`todo`** — Emails representing tasks or action items (assignments, deadlines, follow-ups)
- **`summarize`** — Long emails or threads that could benefit from AI summarization

**Example**: A meeting invitation gets labeled `reply_needed`, while a weekly newsletter gets labeled `review`.

## Prerequisites

Before you start, make sure you have:

- **A Google account** with Gmail access (the account you want to organize)
- **Node.js 18 or higher** (we'll install this using Homebrew below)
- **Basic command line familiarity** (don't worry, we'll guide you through each step)
- **5-10 minutes** for initial setup

**No prior Google Apps Script experience required!** This guide assumes you're starting from scratch.

### Install Node.js using Homebrew

If you don't have Node.js installed, we'll use Homebrew (the best package manager for Mac):

1. **Install Homebrew** (if you don't have it):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Node.js**:
   ```bash
   brew install node
   ```

3. **Verify installation**:
   ```bash
   node --version
   npm --version
   ```

**Why use Homebrew?** It makes installing and updating development tools much easier than downloading individual installers. Homebrew manages dependencies and keeps everything organized.

## What is Google Apps Script?

Google Apps Script is Google's cloud-based JavaScript platform that lets you automate Google services like Gmail, Drive, and Sheets. Think of it as a way to create custom mini-programs that run in Google's cloud and can access your Google services automatically.

**Why use Apps Script for this project?**
- **No server needed**: Your script runs in Google's cloud, not on your computer
- **Built-in Gmail access**: No complex authentication setup required
- **Free to run**: Google provides generous free quotas for personal use
- **Automatic scheduling**: Can run on its own without your computer being on

## Setup Guide

### Step 1: Install Required Tools

First, install Google's command-line tool for managing Apps Script projects:

```bash
npm install -g @google/clasp
```

**Why this step is necessary**: `clasp` (Command Line Apps Script Projects) lets you work with Apps Script code locally on your computer and upload it to Google's servers.

Next, log in to your Google account:

```bash
clasp login --no-localhost
```

**Why this step is necessary**: This connects `clasp` to your Google account so it can create and manage Apps Script projects for you.

### Step 2: Get a Gemini API Key (One-time Setup)

The system uses Google's Gemini AI to analyze your emails. You need an API key to access it:

#### 2a. Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top (next to "Google Cloud")
3. Click "New Project" (or select an existing one if you prefer)
4. Enter a project name like "Gmail Labeler" → Click "Create"
5. Wait for the project to be created (usually 10-30 seconds)

**Why this step is necessary**: Google Cloud projects organize your API usage and billing. Even though this is free, Google requires a project container.

#### 2b. Enable the Generative Language API

1. In the Google Cloud Console, use the search bar at the top
2. Type "Generative Language API" and click on it
3. Click the blue "Enable" button
4. Wait for it to enable (usually a few seconds)

**Why this step is necessary**: This gives your project permission to use Google's Gemini AI models.

#### 2c. Create an API Key

1. In the left sidebar, click "APIs & Services" → "Credentials"
2. Click the blue "Create credentials" button → "API key"
3. Copy the API key that appears (it looks like: `AIzaSyC-abc123def456...`)
4. **Important**: Store this key securely — you'll need it in the next step

**Optional but recommended**: Click "Restrict key" to improve security, then select "Generative Language API" under "API restrictions".

### Step 3: Set Up the Apps Script Project

#### 3a. Download and Create the Project

1. Download or clone this repository to your computer
2. Open your terminal/command prompt and navigate to the project folder:
   ```bash
   cd /path/to/your/download/email-agent
   ```
3. Create the Apps Script project:
   ```bash
   npm run create
   ```

**Why this step is necessary**: This creates a new Apps Script project in your Google account and links it to the code on your computer.

#### 3b. Upload the Code

Upload your code to Google's servers:

```bash
npm run push
```

**Why this step is necessary**: This copies your local code files to the Apps Script project in Google's cloud where they can run.

#### 3c. Open and Configure the Project

Open the Apps Script editor in your browser:

```bash
npm run open
```

This will open the Google Apps Script editor. You'll see your code files listed on the left.

### Step 4: Configure Your Settings

In the Apps Script editor, configure your project:

1. **Click "Project Settings" in the left sidebar**
2. **Scroll down to "Script properties"**
3. **Click "Add script property" and add these settings**:

   | Property Name | Value | Purpose |
   |---------------|-------|---------|
   | `GEMINI_API_KEY` | Your API key from Step 2 | Connects to Gemini AI |
   | `DRY_RUN` | `true` | Test mode (optional, recommended for first run) |
   | `DEBUG` | `true` | Verbose logging (optional, helpful for troubleshooting) |

**Why this step is necessary**: Script Properties are like settings that tell your script how to behave. They're stored securely in Google's cloud.

### Step 5: Test Your Setup

#### 5a. Authorize the Script

1. In the Apps Script editor, click on "Code.gs" in the file list
2. Make sure "run" is selected in the function dropdown at the top
3. Click the "Run" button (▶️)
4. **You'll see authorization prompts** — click "Review permissions"
5. Choose your Google account
6. Click "Advanced" → "Go to Gmail Labeler (unsafe)" → "Allow"

**Why this step is necessary**: Google needs your permission to let the script access your Gmail. This is a one-time authorization.

**What you're authorizing**: The script to read your email, create labels, and modify labels on your emails.

#### 5b. Check the Results

1. Look at the "Execution log" at the bottom of the Apps Script editor
2. You should see messages like "No candidates" or "Processing X threads"
3. Check your Gmail — you should see new labels created: `reply_needed`, `review`, `todo`, `summarize`

If you set `DRY_RUN=true`, the script will analyze emails but won't apply labels yet (recommended for testing).

## Optional: Schedule Automatic Processing

To have the script run automatically every hour, you can install a trigger using either method:

### Method 1: Command Line (Recommended)
```bash
npm run trigger:install
```

### Method 2: Apps Script Editor
1. In the Apps Script editor, select "installTrigger" from the function dropdown
2. Click the "Run" button (▶️)
3. Check the "Triggers" section in the left sidebar to confirm it was created

### Managing Triggers

To remove all triggers (useful when updating):
```bash
npm run trigger:delete
```

**Why this is optional**: You can run the script manually anytime, but scheduling makes it truly automatic.

**Pro tip**: Use `npm run deploy:full` when making major updates—it automatically reinstalls triggers to ensure they use your latest deployment.

## Understanding Your Results

After running the script:

- **`reply_needed`**: Check these emails first — they need your response
- **`review`**: Read when you have time — informational content
- **`todo`**: Action items and tasks to add to your task list
- **`summarize`**: Long emails you might want to summarize later

Each email gets exactly one label to keep things simple and clear.

## Customization (Advanced)

You can customize how emails are categorized by creating a rules document:

1. Create a new Google Doc with your classification rules
2. Get the document's URL (share link)
3. Add `RULE_DOC_URL` to your Script Properties with this URL

The system includes sensible defaults, so this is completely optional.

## Useful Commands

Once set up, these commands help you manage your project:

### Development Commands
```bash
npm run push          # Upload code changes to Apps Script
npm run open          # Open Apps Script editor in browser
npm run logs          # Watch live execution logs
npm run status        # Check sync status between local and remote
```

### Deployment Commands
```bash
npm run deploy        # Create stable version and deploy
npm run deploy:full   # Deploy and reinstall triggers (recommended for major updates)
npm run version:stable # Create timestamped stable version
```

### Trigger Management
```bash
npm run trigger:install  # Install hourly processing trigger
npm run trigger:delete   # Remove all existing triggers
```

## Troubleshooting

### Common Issues and Solutions

**🔍 Problem**: Everything gets labeled as `review`
- **Solution**: Your emails might not have enough context. Try increasing `BODY_CHARS` to `2000` in Script Properties
- **Solution**: Create a custom rules document with clearer examples

**🔍 Problem**: "API key invalid" errors
- **Solution**: Double-check your API key in Script Properties
- **Solution**: Verify "Generative Language API" is enabled in Google Cloud Console
- **Solution**: If in a work organization, check with your IT admin about API restrictions

**🔍 Problem**: "Authorization required" messages
- **Solution**: Re-run the authorization process from Step 5a
- **Solution**: Check that you've granted all necessary permissions

**🔍 Problem**: Script times out or runs slowly
- **Solution**: Reduce `BATCH_SIZE` to `5` in Script Properties
- **Solution**: Reduce `MAX_EMAILS_PER_RUN` to `10` in Script Properties

**🔍 Problem**: No emails being processed
- **Solution**: Check that you have recent emails without existing labels
- **Solution**: Set `DEBUG=true` and check the execution logs

### Getting Help

1. **Check the execution logs**: In Apps Script editor, look at the bottom panel after running
2. **Enable debug mode**: Set `DEBUG=true` in Script Properties for detailed logging
3. **Try dry run mode**: Set `DRY_RUN=true` to test without making changes

## Security Notes

- **Your API key**: Keep it private — don't share it or commit it to code repositories
- **Permissions**: The script only accesses your Gmail to read emails and manage labels
- **Data**: Email content is sent to Google's Gemini AI for analysis but isn't stored permanently
- **Revoke access**: You can remove permissions anytime in your [Google Account settings](https://myaccount.google.com/permissions)

## Configuration Reference

All settings are optional and have sensible defaults:

| Setting | Default | Description |
|---------|---------|-------------|
| `DEFAULT_FALLBACK_LABEL` | `review` | Label to use when AI is uncertain |
| `MAX_EMAILS_PER_RUN` | `20` | Maximum emails to process each run |
| `BATCH_SIZE` | `10` | How many emails to send to AI at once |
| `BODY_CHARS` | `1200` | How much of each email to analyze |
| `DAILY_GEMINI_BUDGET` | `50` | Maximum AI API calls per day |
| `DRY_RUN` | `false` | Test mode (analyze but don't apply labels) |
| `DEBUG` | `false` | Verbose logging for troubleshooting |

## Updating and Deploying the Script

### Development Updates

For simple code changes during development:

```bash
npm run push
```

This uploads any code changes to your Apps Script project.

### Production Deployments

For significant updates (like model changes or new features), use the proper deployment workflow:

#### Quick Deployment
```bash
npm run deploy
```

This command:
1. Creates a timestamped stable version (e.g., `stable-20241127-143052`)
2. Deploys that version as a new deployment
3. Provides a stable rollback point if needed

#### Full Deployment with Trigger Reset
```bash
npm run deploy:full
```

This command:
1. Runs the complete deployment process
2. Reinstalls the hourly trigger to ensure it uses the new deployment
3. **Use this when**: Updating AI models, changing trigger behavior, or major functionality changes

**Why use deployment commands?** They create stable versions with timestamps, making it easy to track changes and rollback if something goes wrong. This is especially important when updating AI models or core functionality.

### Manual Version Control

You can also create versions manually:

```bash
npm run version:stable    # Creates a timestamped stable version
npm run version          # Creates a version with custom description
```

### Understanding Deployments vs Versions

- **Versions**: Snapshots of your code with descriptions (like git tags)
- **Deployments**: Published versions that can be shared or accessed via URL
- **Development**: Your working code that runs when you click "Run" in the editor

**Best Practice**: Use `npm run deploy:full` when updating your AI model or making significant changes to ensure everything works correctly together.

### When to Use Each Command

| Scenario | Command | Why |
|----------|---------|-----|
| Quick bug fix or minor tweak | `npm run push` | Fast, works for development |
| New feature or configuration change | `npm run deploy` | Creates stable version for rollback |
| AI model update or trigger changes | `npm run deploy:full` | Ensures triggers use new deployment |
| Testing new changes | `npm run push` + manual testing | Safe development workflow |

### Example: Updating AI Model

When you update your AI model (like switching to a newer Gemini version):

1. Make your code changes locally
2. Test with `npm run push` and manual execution
3. Once satisfied, deploy with `npm run deploy:full`
4. Verify the trigger is working with the new model

This ensures your scheduled runs use the updated model and any trigger-related changes take effect.

## Uninstalling

To completely remove the system:

1. **Remove automatic triggers**: Run `npm run trigger:delete` or use the Apps Script UI
2. **Clear settings**: Delete Script Properties in the Apps Script editor
3. **Remove labels**: Manually delete the Gmail labels if desired
4. **Revoke permissions**: Visit [Google Account permissions](https://myaccount.google.com/permissions) and remove access

---

## Glossary

- **Apps Script**: Google's cloud platform for automating Google services
- **API Key**: A secret code that identifies your project to Google's services
- **clasp**: Google's command-line tool for Apps Script development
- **Dry run**: Testing mode that analyzes emails but doesn't make changes
- **Script Properties**: Settings stored securely in your Apps Script project
- **Trigger**: A schedule that runs your script automatically