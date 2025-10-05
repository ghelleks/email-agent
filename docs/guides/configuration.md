# Configuration Reference

Complete reference for all Script Properties configuration options. Configure these in the Apps Script editor under "Project Settings" → "Script properties".

## Quick Reference

### Essential Configuration

| Property | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | None | Gemini API authentication key |

### Commonly Used

| Property | Required | Default | Description |
|----------|----------|---------|-------------|
| `DRY_RUN` | No | `false` | Test mode (analyze but don't apply labels) |
| `DEBUG` | No | `false` | Verbose logging for troubleshooting |
| `MAX_EMAILS_PER_RUN` | No | `20` | Maximum emails to process each run |

## Core Email Processing

These settings control the main email labeling functionality.

### Authentication

| Property | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes* | None | Gemini API key for AI authentication |
| `PROJECT_ID` | Yes* | None | Google Cloud project ID for Vertex AI authentication |

**Note**: Either `GEMINI_API_KEY` OR `PROJECT_ID` is required, not both. API key is simpler for most users.

### Processing Limits

| Property | Default | Description |
|----------|---------|-------------|
| `MAX_EMAILS_PER_RUN` | `20` | Maximum emails to process in one execution |
| `BATCH_SIZE` | `10` | Number of emails sent to AI in one request |
| `BODY_CHARS` | `1200` | Characters of email body to analyze |

**When to adjust**:
- Increase `MAX_EMAILS_PER_RUN` if you get many emails daily
- Decrease `BATCH_SIZE` if experiencing timeouts
- Increase `BODY_CHARS` if classification seems inaccurate

**Quota Management**: API quotas are managed natively through Google Cloud Console. Monitor usage at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

### Behavior Settings

| Property | Default | Description |
|----------|---------|-------------|
| `DEFAULT_FALLBACK_LABEL` | `review` | Label to use when AI is uncertain |
| `DRY_RUN` | `false` | Test mode (analyze but don't apply labels) |
| `DEBUG` | `false` | Enable verbose logging |

**Configuration examples**:

**Standard production use**:
```
GEMINI_API_KEY = AIzaSyC-abc123...
MAX_EMAILS_PER_RUN = 20
BATCH_SIZE = 10
```

**High volume inbox**:
```
GEMINI_API_KEY = AIzaSyC-abc123...
MAX_EMAILS_PER_RUN = 50
BATCH_SIZE = 20
```
Note: Monitor API quotas through Google Cloud Console and request increases if needed.

**Testing/debugging**:
```
GEMINI_API_KEY = AIzaSyC-abc123...
DRY_RUN = true
DEBUG = true
MAX_EMAILS_PER_RUN = 5
```

## Web App Configuration

Settings for the [Interactive Web App Dashboard](../features/web-app.md).

| Property | Default | Description |
|----------|---------|-------------|
| `WEBAPP_ENABLED` | `true` | Enable/disable web app functionality |
| `WEBAPP_MAX_EMAILS_PER_SUMMARY` | `50` | Maximum emails to process in web app per summary |

**Configuration examples**:

**Disable web app** (only use automated labeling):
```
WEBAPP_ENABLED = false
```

**Optimize for mobile** (prevent timeouts):
```
WEBAPP_ENABLED = true
WEBAPP_MAX_EMAILS_PER_SUMMARY = 25
```

**High-performance use** (fast connection):
```
WEBAPP_ENABLED = true
WEBAPP_MAX_EMAILS_PER_SUMMARY = 100
```

## Email Summarizer Agent Configuration

Settings for the [Email Summarizer Agent](../agents/email-summarizer.md).

### Basic Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `SUMMARIZER_ENABLED` | `true` | Enable/disable the Email Summarizer agent |
| `SUMMARIZER_DESTINATION_EMAIL` | Your email | Email address to receive summaries |

### Processing Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `SUMMARIZER_MAX_AGE_DAYS` | `7` | Maximum age of emails to include in summaries |
| `SUMMARIZER_MAX_EMAILS_PER_SUMMARY` | `50` | Maximum emails to process per summary |
| `SUMMARIZER_ARCHIVE_ON_LABEL` | `true` | Archive emails immediately when `summarize` label is applied |

### Debugging Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `SUMMARIZER_DEBUG` | `false` | Enable detailed logging for the agent |
| `SUMMARIZER_DRY_RUN` | `false` | Test mode (generate summary but don't send email) |

**Configuration examples**:

**Basic setup** (receive summaries at different email):
```
SUMMARIZER_ENABLED = true
SUMMARIZER_DESTINATION_EMAIL = work@example.com
```

**Keep emails in inbox until summarized**:
```
SUMMARIZER_ENABLED = true
SUMMARIZER_ARCHIVE_ON_LABEL = false
```

**Process more emails, look back further**:
```
SUMMARIZER_ENABLED = true
SUMMARIZER_MAX_AGE_DAYS = 14
SUMMARIZER_MAX_EMAILS_PER_SUMMARY = 100
```

**Debug mode**:
```
SUMMARIZER_ENABLED = true
SUMMARIZER_DEBUG = true
SUMMARIZER_DRY_RUN = true
```

## Reply Drafter Agent Configuration

Settings for the [Reply Drafter Agent](../agents/reply-drafter.md).

**Note**: Reply Drafter configuration is managed in `AgentReplyDrafter.gs` via `getReplyDrafterConfig_()` function (ADR-014), not in core `Config.gs`. This follows the self-contained agent architecture pattern.

**Execution Modes**: The Reply Drafter operates in two modes:
1. **Agent Handler**: Runs during email classification (immediate draft creation for newly-classified emails)
2. **Scheduled Batch**: Runs every 30 minutes to process ALL `reply_needed` emails (manually labeled, retries, historical emails)

Install the scheduled batch trigger with `installReplyDrafterTrigger` function in Apps Script editor for comprehensive coverage.

### Basic Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `REPLY_DRAFTER_ENABLED` | `true` | Enable/disable the Reply Drafter agent (both execution modes) |

### Knowledge Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `REPLY_DRAFTER_INSTRUCTIONS_URL` | None | Google Docs URL with drafting style/methodology |
| `REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL` | None | Google Drive folder URL with knowledge documents (ADR-015) |
| `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS` | `5` | Maximum documents to fetch from knowledge folder (ADR-015) |

### Debugging Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `REPLY_DRAFTER_DEBUG` | `false` | Enable detailed logging for the agent |
| `REPLY_DRAFTER_DRY_RUN` | `false` | Test mode (analyze but don't create drafts) |

**Configuration examples**:

**Basic setup** (use default drafting style):
```
REPLY_DRAFTER_ENABLED = true
```
**Note**: Also install the scheduled batch trigger (`installReplyDrafterTrigger`) for comprehensive coverage of manually labeled emails.

**Custom drafting style** (instructions only):
```
REPLY_DRAFTER_ENABLED = true
REPLY_DRAFTER_INSTRUCTIONS_URL = https://docs.google.com/document/d/abc123/edit
```

**Full knowledge customization** (instructions + examples):
```
REPLY_DRAFTER_ENABLED = true
REPLY_DRAFTER_INSTRUCTIONS_URL = https://docs.google.com/document/d/abc123/edit
REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/xyz789
REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS = 3
```

**Debug mode**:
```
REPLY_DRAFTER_ENABLED = true
REPLY_DRAFTER_DEBUG = true
REPLY_DRAFTER_DRY_RUN = true
```

## Todo Forwarder Agent Configuration

Settings for the [Todo Forwarder Agent](../agents/todo-forwarder.md).

**Note**: Todo Forwarder configuration is managed in `AgentTodoForwarder.gs` via `getTodoForwarderConfig_()` function, following the self-contained agent architecture pattern.

**Execution Mode**: The Todo Forwarder uses the **dual-hook pattern** to ensure comprehensive forwarding coverage:
1. **onLabel Hook**: Runs during email classification (immediate forwarding for newly-classified emails)
2. **postLabel Hook**: Runs after labeling complete (catches manually-labeled `todo` emails)

Both hooks run within the hourly email processing cycle. **No separate trigger required.**

### Basic Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `TODO_FORWARDER_ENABLED` | `true` | Enable/disable the Todo Forwarder agent (both hooks) |
| `TODO_FORWARDER_EMAIL` | None | Email address to forward todos to (required - agent disabled if not set) |

**Archive Behavior**: Successfully forwarded emails are automatically archived (with `todo` label preserved). This behavior is fixed for reliability and cannot be configured.

### Debugging Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `TODO_FORWARDER_DEBUG` | `false` | Enable detailed logging for the agent |
| `TODO_FORWARDER_DRY_RUN` | `false` | Test mode (analyze but don't forward emails) |

**Configuration examples**:

**Basic setup** (forward to task management system):
```
TODO_FORWARDER_ENABLED = true
TODO_FORWARDER_EMAIL = mytasks@todoist.com
```
Successfully forwarded emails are automatically archived (with `todo` label preserved).

**Asana integration**:
```
TODO_FORWARDER_ENABLED = true
TODO_FORWARDER_EMAIL = tasks@asana.com
```
Successfully forwarded emails are automatically archived (with `todo` label preserved).

**Personal inbox integration**:
```
TODO_FORWARDER_ENABLED = true
TODO_FORWARDER_EMAIL = todo@myapp.com
```
Successfully forwarded emails are automatically archived (with `todo` label preserved).

**Debug mode**:
```
TODO_FORWARDER_ENABLED = true
TODO_FORWARDER_EMAIL = test@example.com
TODO_FORWARDER_DEBUG = true
TODO_FORWARDER_DRY_RUN = true
```

## Knowledge System Configuration

Settings for the [Knowledge System](../features/knowledge-system.md) (advanced).

### Email Labeling Knowledge

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `LABEL_INSTRUCTIONS_DOC_URL` | URL/ID | None | Single document with classification methodology |
| `LABEL_KNOWLEDGE_FOLDER_URL` | URL/ID | None | Folder with example emails and patterns |
| `LABEL_KNOWLEDGE_MAX_DOCS` | Number | `5` | Maximum documents to fetch from folder |

### System Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `KNOWLEDGE_CACHE_DURATION_MINUTES` | `30` | Cache duration for fetched documents |
| `KNOWLEDGE_DEBUG` | `false` | Enable detailed logging for document fetching |
| `KNOWLEDGE_LOG_SIZE_WARNINGS` | `true` | Warn when approaching token limits |

### Legacy Configuration (Deprecated)

| Property | Replacement | Status |
|----------|-------------|--------|
| `RULE_DOC_URL` | `LABEL_INSTRUCTIONS_DOC_URL` | Deprecated |
| `RULE_DOC_ID` | `LABEL_INSTRUCTIONS_DOC_URL` | Deprecated |

**Configuration examples**:

**Single instructions document**:
```
LABEL_INSTRUCTIONS_DOC_URL = https://docs.google.com/document/d/abc123/edit
```

**Folder of examples**:
```
LABEL_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/xyz789
LABEL_KNOWLEDGE_MAX_DOCS = 10
```

**Both instructions and knowledge** (recommended):
```
LABEL_INSTRUCTIONS_DOC_URL = https://docs.google.com/document/d/abc123/edit
LABEL_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/xyz789
LABEL_KNOWLEDGE_MAX_DOCS = 5
```

**Debug mode**:
```
KNOWLEDGE_DEBUG = true
KNOWLEDGE_LOG_SIZE_WARNINGS = true
```

## Configuration Scenarios

### Scenario 1: Basic Email Labeling Only

**Goal**: Simple automated email labeling with defaults.

```
GEMINI_API_KEY = AIzaSyC-abc123...
```

That's it! All other settings have sensible defaults.

### Scenario 2: Email Labeling + Web App

**Goal**: Automated labeling plus on-demand web summaries.

```
GEMINI_API_KEY = AIzaSyC-abc123...
WEBAPP_ENABLED = true
```

### Scenario 3: Complete Setup with Email Summarizer

**Goal**: Full automation with daily email summaries.

```
# Core
GEMINI_API_KEY = AIzaSyC-abc123...

# Email Summarizer
SUMMARIZER_ENABLED = true
SUMMARIZER_DESTINATION_EMAIL = you@example.com
SUMMARIZER_ARCHIVE_ON_LABEL = true

# Web App
WEBAPP_ENABLED = true
```

### Scenario 4: High Volume Inbox

**Goal**: Process many emails efficiently.

```
# Core
GEMINI_API_KEY = AIzaSyC-abc123...
MAX_EMAILS_PER_RUN = 50
BATCH_SIZE = 20

# Email Summarizer
SUMMARIZER_ENABLED = true
SUMMARIZER_MAX_EMAILS_PER_SUMMARY = 100
SUMMARIZER_MAX_AGE_DAYS = 14
```

**Note**: Monitor API quotas at Google Cloud Console and request increases if needed.

### Scenario 5: Custom Classification with Knowledge System

**Goal**: Customize AI behavior with your own rules and examples.

```
# Core
GEMINI_API_KEY = AIzaSyC-abc123...

# Knowledge System
LABEL_INSTRUCTIONS_DOC_URL = https://docs.google.com/document/d/abc123/edit
LABEL_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/xyz789
LABEL_KNOWLEDGE_MAX_DOCS = 10
KNOWLEDGE_DEBUG = true
```

### Scenario 6: Testing and Development

**Goal**: Safe testing environment without affecting production Gmail.

```
# Core
GEMINI_API_KEY = AIzaSyC-abc123...
DRY_RUN = true
DEBUG = true
MAX_EMAILS_PER_RUN = 5

# Email Summarizer
SUMMARIZER_ENABLED = true
SUMMARIZER_DRY_RUN = true
SUMMARIZER_DEBUG = true
```

## Multi-Account Configuration

When using [Multi-Account Deployment](../features/multi-account.md), each account has independent Script Properties.

### Same Configuration Across Accounts

For most settings, use the same values across all accounts:

```
# Same API key (simpler)
GEMINI_API_KEY = AIzaSyC-abc123...

# Same processing limits
MAX_EMAILS_PER_RUN = 20
BATCH_SIZE = 10
```

### Different Configuration Per Account

Customize certain settings per account:

**Personal Account**:
```
SUMMARIZER_DESTINATION_EMAIL = personal@gmail.com
SUMMARIZER_MAX_AGE_DAYS = 7
MAX_EMAILS_PER_RUN = 20
```

**Work Account**:
```
SUMMARIZER_DESTINATION_EMAIL = work@company.com
SUMMARIZER_MAX_AGE_DAYS = 3
MAX_EMAILS_PER_RUN = 50
```

### API Key Strategy

**Option 1: Shared API Key** (simpler)
```
# Same in all accounts
GEMINI_API_KEY = AIzaSyC-abc123...
```

**Option 2: Separate API Keys** (better quota isolation)
```
# Personal account
GEMINI_API_KEY = AIzaSyC-personal123...

# Work account
GEMINI_API_KEY = AIzaSyC-work456...
```

## How to Set Script Properties

### Via Apps Script Editor UI

1. **Open Apps Script editor**:
   ```bash
   npm run open:personal  # or open:work for specific account
   ```

2. **Navigate to Project Settings**:
   - Click "Project Settings" in left sidebar

3. **Add Script Properties**:
   - Scroll to "Script properties" section
   - Click "Add script property"
   - Enter property name and value
   - Click "Save script properties"

### Via Apps Script Code (Advanced)

For bulk configuration or migration:

```javascript
function setScriptProperties() {
  const props = PropertiesService.getScriptProperties();

  props.setProperties({
    'GEMINI_API_KEY': 'AIzaSyC-abc123...',
    'MAX_EMAILS_PER_RUN': '20',
    'DRY_RUN': 'false',
    'DEBUG': 'false'
  });

  Logger.log('Properties set successfully');
}
```

Run this function once in Apps Script editor, then delete it.

## Configuration Best Practices

### Security

- **Never commit API keys** to version control
- **Use Script Properties**, not hardcoded values
- **Rotate API keys** periodically
- **Use separate keys** for work vs personal if handling sensitive data

### Performance

- **Start conservative**: Use default values initially
- **Monitor execution logs**: Check for timeouts or quota issues
- **Adjust gradually**: Increase limits based on actual needs
- **Balance batch size and timeout risk**: Larger batches = fewer API calls but higher timeout risk

### Testing

- **Use DRY_RUN** for all initial testing
- **Enable DEBUG** when troubleshooting
- **Test with small limits**: Use `MAX_EMAILS_PER_RUN = 5` for testing
- **Verify web app** before enabling summarizer

### Maintenance

- **Review settings quarterly**: Ensure they still match your needs
- **Monitor budget usage**: Check `DAILY_GEMINI_BUDGET` isn't being exceeded
- **Update documentation**: Note any custom settings in a separate doc
- **Clean up test properties**: Remove `DRY_RUN` and `DEBUG` after testing

## Troubleshooting Configuration

### Configuration not taking effect

**Solution**: Redeploy after changing Script Properties:
```bash
npm run deploy:personal
```

**Solution**: Verify property name is spelled correctly (case-sensitive)

**Solution**: Check that value is in expected format (boolean as `true`/`false` string)

### Boolean values not working

**Solution**: Use lowercase strings:
- Correct: `true` or `false`
- Incorrect: `True`, `TRUE`, `1`, `0`

### Numeric values not working

**Solution**: Use string representations of numbers:
- Correct: `"20"` or just `20`
- The system will parse strings to integers

### API key errors

**Solution**: Verify API key is complete (no truncation)

**Solution**: Check for leading/trailing whitespace

**Solution**: Ensure API key is enabled in Google Cloud Console

**Solution**: Verify "Generative Language API" is enabled

### Knowledge system not loading

**Solution**: Use full URLs, not just IDs

**Solution**: Verify document/folder permissions

**Solution**: Enable `KNOWLEDGE_DEBUG=true` to see fetch details

## Default Values Summary

Quick reference table of all default values:

| Property | Default | Property | Default |
|----------|---------|----------|---------|
| `MAX_EMAILS_PER_RUN` | `20` | `SUMMARIZER_MAX_AGE_DAYS` | `7` |
| `BATCH_SIZE` | `10` | `SUMMARIZER_MAX_EMAILS_PER_SUMMARY` | `50` |
| `BODY_CHARS` | `1200` | `SUMMARIZER_ARCHIVE_ON_LABEL` | `true` |
| `DEFAULT_FALLBACK_LABEL` | `review` | `SUMMARIZER_ENABLED` | `true` |
| `DRY_RUN` | `false` | `SUMMARIZER_DEBUG` | `false` |
| `DEBUG` | `false` | `SUMMARIZER_DRY_RUN` | `false` |
| `WEBAPP_ENABLED` | `true` | `WEBAPP_MAX_EMAILS_PER_SUMMARY` | `50` |
| `REPLY_DRAFTER_ENABLED` | `true` | `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS` | `5` |
| `REPLY_DRAFTER_DEBUG` | `false` | `REPLY_DRAFTER_DRY_RUN` | `false` |
| `TODO_FORWARDER_ENABLED` | `true` | `TODO_FORWARDER_EMAIL` | None |
| `TODO_FORWARDER_DEBUG` | `false` | `TODO_FORWARDER_DRY_RUN` | `false` |
| `KNOWLEDGE_CACHE_DURATION_MINUTES` | `30` | `LABEL_KNOWLEDGE_MAX_DOCS` | `5` |
| `KNOWLEDGE_DEBUG` | `false` | `KNOWLEDGE_LOG_SIZE_WARNINGS` | `true` |

## See Also

- [Back to README](../../README.md)
- [Troubleshooting Guide](troubleshooting.md) - Common configuration issues
- [Knowledge System](../features/knowledge-system.md) - Advanced knowledge configuration
- [Reply Drafter Agent](../agents/reply-drafter.md) - Reply Drafter-specific configuration
- [Email Summarizer Agent](../agents/email-summarizer.md) - Summarizer-specific configuration
- [Todo Forwarder Agent](../agents/todo-forwarder.md) - Todo Forwarder-specific configuration
- [Web App Dashboard](../features/web-app.md) - Web app configuration
- [Multi-Account Deployment](../features/multi-account.md) - Per-account configuration
