# Gmail Labeler — AI-Powered Email Organization

Automatically organize your Gmail inbox with AI-powered email labeling. Your emails are categorized into actionable labels like `reply_needed`, `review`, `todo`, and `summarize` — all running in Google's cloud with no servers to manage.

## What This Does

This system automatically analyzes your incoming Gmail and sorts it into four actionable categories:

- **`reply_needed`** — Emails requiring your personal response (questions, meeting requests, urgent items) — automatically creates draft replies with AI
- **`review`** — Informational emails to read (updates, newsletters, FYI messages)
- **`todo`** — Action items and tasks (assignments, deadlines, follow-ups)
- **`summarize`** — Long emails that benefit from AI summarization

**Example**: A meeting invitation gets labeled `reply_needed`, while a weekly newsletter gets labeled `review`.

## Quick Start

**Time required**: 5-10 minutes
**Experience needed**: None — we'll guide you through every step

### Prerequisites

- **Google account** with Gmail access
- **Node.js 18+** (install via [Homebrew](https://brew.sh/): `brew install node`)
- **5-10 minutes** for setup

### Step 1: Install Google Apps Script CLI

```bash
npm install -g @google/clasp
clasp login --no-localhost
```

This connects the command-line tool to your Google account.

**Important**: After logging in, you must enable the Apps Script API:
1. Visit https://script.google.com/home/usersettings
2. Turn on "Google Apps Script API"
3. Wait a few minutes for the change to propagate

### Step 2: Get a Gemini API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Gmail Labeler")
3. Enable "Generative Language API" (search for it)
4. Go to "APIs & Services" → "Credentials"
5. Click "Create credentials" → "API key"
6. Copy the API key (looks like `AIzaSyC-abc123...`)

### Step 3: Create and Deploy the Project

```bash
# Clone this repository
git clone https://github.com/yourusername/email-agent.git
cd email-agent

# Create the Apps Script project (with source files in src/ directory)
clasp create --title "Gmail Labeler" --type standalone --rootDir ./src

# Upload code to Google's cloud
clasp push

# Open the Apps Script editor
clasp open-script
```

### Step 4: Configure Settings

In the Apps Script editor that just opened:

1. Click **"Project Settings"** in the left sidebar
2. Scroll down to **"Script properties"**
3. Click **"Add script property"** and add:

| Property Name | Value |
|---------------|-------|
| `GEMINI_API_KEY` | Your API key from Step 2 |
| `DRY_RUN` | `true` *(optional: test mode)* |
| `DEBUG` | `true` *(optional: verbose logging)* |

### Step 5: Test It

1. In the Apps Script editor, click **`Main.gs`** in the Files list on the left
2. Select **`run`** from the function dropdown at the top
3. Click the **"Run"** button (▶️)
4. **Authorize the script** when prompted:
   - Click "Review permissions"
   - Choose your Google account
   - Click "Advanced" → "Go to Gmail Labeler (unsafe)"
   - Click "Allow"
5. Check the **"Execution log"** at the bottom for results
6. Check your **Gmail** — you should see new labels applied to emails

**Testing tip**: Set `DRY_RUN=true` to analyze emails without actually applying labels.

## Congratulations!

You now have AI-powered email labeling! Your Gmail will automatically organize emails into helpful categories.

**What's next?** You can run the script manually anytime by clicking "Run" in the Apps Script editor, or set up automatic scheduling (see below).

---

## Optional: Automatic Scheduling

Make it run every hour automatically:

1. In the Apps Script editor, select **`installTrigger`** from the function dropdown
2. Click **"Run"** button (▶️)
3. Grant permissions when prompted
4. Verify in the **"Triggers"** section (left sidebar)

Your emails will now be labeled automatically every hour without your computer needing to be on.

---

## Advanced Features (Optional)

The core email labeling is complete! These advanced features are optional add-ons:

### Reply Drafter Agent

**What it adds**: Automatic draft replies for emails labeled `reply_needed`

Perfect for generating professional, context-aware draft responses to questions, meeting requests, and routine correspondence. AI analyzes the full email thread and creates drafts you can review and send.

**How it works**:
- Immediate draft creation for newly-classified emails (agent handler)
- Every 30 minutes, processes ALL `reply_needed` emails in inbox (scheduled batch)
- Comprehensive coverage for manually labeled emails, retries, and historical emails

**Quick configuration example**:
```
REPLY_DRAFTER_ENABLED = true
REPLY_DRAFTER_INSTRUCTIONS_URL = https://docs.google.com/document/d/YOUR_DOC_ID/edit
```
**Setup**: Install scheduled batch trigger with `installReplyDrafterTrigger` function in Apps Script editor.

[Reply Drafter Documentation →](docs/agents/reply-drafter.md)

### Email Summarizer Agent

**What it adds**: Daily automated summaries of emails labeled with `summarize`

Perfect for processing newsletters, long email threads, or multiple related emails into digestible summaries delivered to your inbox.

[Email Summarizer Documentation →](docs/agents/email-summarizer.md)

### Todo Forwarder Agent

**What it adds**: Automatic forwarding of emails labeled `todo` to external task management systems

Perfect for integrating Gmail with task management tools like Todoist, Asana, or any email-based task creation system. Automatically forwards todo emails with full thread context and archives them on success. Failed forwards remain in inbox for automatic retry.

**How it works**:
- Immediate forwarding for newly-classified emails (onLabel hook)
- Inbox-wide scanning for manually-labeled emails (postLabel hook)
- Both hooks run in the hourly email processing cycle (no separate trigger needed)
- Archive-based idempotency: only processes emails IN THE INBOX

**Quick configuration example**:
```
TODO_FORWARDER_ENABLED = true
TODO_FORWARDER_EMAIL = mytasks@todoist.com
```

Successfully forwarded emails are automatically archived (with `todo` label preserved).

[Todo Forwarder Documentation →](docs/agents/todo-forwarder.md)

### Interactive Web App Dashboard

**What it adds**: Mobile-optimized web interface for on-demand email summarization

Perfect for processing emails on-the-go from your phone, getting quick summaries when you need them right now.

[Web App Documentation →](docs/features/web-app.md)

### Multi-Account Deployment

**What it adds**: Manage multiple Gmail accounts (personal, work, etc.) from one codebase

Deploy and maintain email automation across all your accounts with streamlined commands.

[Multi-Account Documentation →](docs/features/multi-account.md)

### Knowledge System

**What it adds**: Customize AI behavior with your own classification rules and examples

Teach the AI about your specific email patterns, priorities, and preferences using Google Drive documents.

**NEW: Global Knowledge Folder** — Share organizational context (team structure, projects, terminology) across ALL AI operations with a single configuration. Eliminates duplication and ensures consistency.

[Knowledge System Documentation →](docs/features/knowledge-system.md)

---

## Documentation

### Guides

- [Configuration Reference](docs/guides/configuration.md) — All configuration options
- [Troubleshooting Guide](docs/guides/troubleshooting.md) — Common issues and solutions
- [Development Guide](docs/guides/development.md) — For contributors

### Advanced Features

- [Reply Drafter Agent](docs/agents/reply-drafter.md) — Automatic draft replies with AI
- [Email Summarizer Agent](docs/agents/email-summarizer.md) — Daily email summaries
- [Todo Forwarder Agent](docs/agents/todo-forwarder.md) — Automatic todo email forwarding
- [Web App Dashboard](docs/features/web-app.md) — On-demand summarization interface
- [Multi-Account Deployment](docs/features/multi-account.md) — Manage multiple accounts
- [Knowledge System](docs/features/knowledge-system.md) — Customize AI classification

### Architecture

- [Architecture Decision Records](docs/adr/) — Design decisions and rationale

---

## Common Commands

Once set up, these commands help you manage your project:

### Deployment

```bash
npm run deploy:personal    # Deploy to personal account (code + web app + triggers)
npm run deploy:work        # Deploy to work account
npm run deploy:all         # Deploy to all configured accounts
```

### Monitoring

```bash
npm run logs:personal      # View execution logs
npm run open:personal      # Open Apps Script editor
npm run status:personal    # Check account status
```

### Account Management

```bash
npm run setup:account      # Configure multi-account setup
npm run switch:status      # Check all account statuses
```

See [Multi-Account Documentation](docs/features/multi-account.md) for complete command reference.

---

## Quick Troubleshooting

### Everything gets labeled as `review`

**Solution**: Increase analyzed email content:
```
BODY_CHARS = 2000
```

Or customize with the [Knowledge System](docs/features/knowledge-system.md).

### "API key invalid" errors

**Solution**:
1. Double-check your API key in Script Properties
2. Verify "Generative Language API" is enabled in Google Cloud Console
3. Check with IT admin if using work account (API restrictions)

### "Authorization required" messages

**Solution**: Re-run the authorization process:
1. In Apps Script editor, click "Run" button
2. Click "Review permissions" and allow access

### Script times out or runs slowly

**Solution**: Reduce processing limits:
```
MAX_EMAILS_PER_RUN = 10
BATCH_SIZE = 5
```

### No emails being processed

**Solution**:
1. Enable debug mode: `DEBUG = true`
2. Check execution logs for details
3. Verify you have recent emails without existing labels

**For more help**: See the [Troubleshooting Guide](docs/guides/troubleshooting.md)

---

## Configuration Options

All settings are optional and have sensible defaults. Configure via Script Properties in the Apps Script editor.

### Essential

| Setting | Default | Description |
|---------|---------|-------------|
| `GEMINI_API_KEY` | *Required* | Your Gemini API key |

### Commonly Used

| Setting | Default | Description |
|---------|---------|-------------|
| `DRY_RUN` | `false` | Test mode (analyze but don't apply labels) |
| `DEBUG` | `false` | Verbose logging for troubleshooting |
| `MAX_EMAILS_PER_RUN` | `20` | Maximum emails to process each run |

**For complete configuration reference**: See [Configuration Guide](docs/guides/configuration.md)

---

## Security and Privacy

- **Your API key**: Keep it private — never commit to code repositories
- **Permissions**: Script only accesses Gmail to read emails and manage labels
- **Data**: Email content sent to Google's Gemini AI for analysis (not stored permanently)
- **Revoke access**: Remove permissions anytime in [Google Account settings](https://myaccount.google.com/permissions)

---

## How It Works

### Architecture

The system runs entirely in Google's cloud using **Google Apps Script**:

1. **Scheduled trigger** runs hourly (or manually)
2. **Finds unlabeled emails** in your Gmail inbox
3. **Sends email content** to Gemini AI for classification
4. **Applies appropriate labels** based on AI analysis
5. **Native quota management** via Google Cloud Console and Apps Script limits

### Why Google Apps Script?

- **No server needed**: Runs in Google's cloud, not on your computer
- **Built-in Gmail access**: No complex authentication setup
- **Free to run**: Generous free quotas for personal use
- **Automatic scheduling**: Runs on its own without your computer being on

### Key Design Decisions

- [Four-label classification system](docs/adr/003-label-based-classification.md) for simplicity
- [Pluggable agent architecture](docs/adr/004-pluggable-agents.md) for extensibility
- [Batch processing with budget management](docs/adr/005-batch-processing-budget.md)
- [Dual authentication modes](docs/adr/006-dual-authentication.md) (API key or Vertex AI)

**Full architecture documentation**: [Architecture Decision Records](docs/adr/)

---

## Contributing

Contributions welcome! See the [Development Guide](docs/guides/development.md) for:

- Development setup instructions
- Project structure overview
- How to add new features
- Testing guidelines
- Pull request process

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/email-agent/issues)
- **Documentation**: [Complete documentation](docs/)
- **Troubleshooting**: [Troubleshooting Guide](docs/guides/troubleshooting.md)

---

**Ready to get started?** Jump to [Quick Start](#quick-start) above!
