# Email Summarizer Agent

The Email Summarizer is an intelligent agent that automatically processes emails labeled with `summarize` and delivers concise, well-formatted summaries directly to your inbox.

## What It Does

The Email Summarizer agent:

- **Archives immediately** when you apply the `summarize` label (configurable, enabled by default)
- **Retrieves** emails with the `summarize` label from the past 7 days
- **Generates** Economist-style summaries using AI
- **Delivers** formatted HTML summaries via email with hyperlinks and source references
- **Relabels** processed emails as `summarized` and archives them (if not already archived)
- **Runs** on configurable daily triggers (default: 5 AM)

This agent operates independently and requires no manual intervention once configured. By default, emails are archived immediately when you apply the `summarize` label, keeping your inbox clean while the scheduled summarization process finds them via the label.

## Perfect For

- **Newsletters**: Get concise summaries of long newsletters
- **Email threads**: Digest multi-message conversations
- **Batch processing**: Summarize multiple related emails at once
- **Daily digests**: Receive summaries on a schedule

## Quick Start

### Prerequisites

- Complete the [basic email labeling setup](../../README.md#setup-guide) first
- Email Summarizer is enabled by default (`SUMMARIZER_ENABLED=true`)

### Setup Steps

1. **Install the summarizer trigger**:
   - In the Apps Script editor, select `installSummarizerTrigger` from the function dropdown
   - Click the "Run" button (▶️) to install the daily trigger
   - The Email Summarizer will run daily at 5 AM

2. **Start using it**:
   - Apply the `summarize` label to emails in Gmail
   - Emails are archived immediately (configurable)
   - Wait for the next daily run (or test manually by running `runSummarizerAgent` in the editor)
   - Receive summary emails in your inbox

## How It Works

### Workflow

1. **Label Application**: You apply the `summarize` label to one or more emails
2. **Immediate Archive** (optional): Email is archived immediately to keep inbox clean
3. **Scheduled Retrieval**: Daily trigger finds all emails with `summarize` label from past 7 days
4. **AI Summarization**: Gemini AI generates consolidated summary in Economist style
5. **Email Delivery**: Formatted HTML summary sent to your inbox with:
   - Executive summary of key points
   - Source email permalinks
   - Extracted web links from emails
6. **Cleanup**: Processed emails relabeled as `summarized` and archived

### Archive-on-Label Behavior

**Default behavior** (`SUMMARIZER_ARCHIVE_ON_LABEL=true`):
- Emails are archived **immediately** when you apply the `summarize` label
- Keeps your inbox clean while processing happens in the background
- Summarization trigger still finds emails via the `summarize` label

**Alternative behavior** (`SUMMARIZER_ARCHIVE_ON_LABEL=false`):
- Emails remain in inbox when labeled with `summarize`
- Only archived after summarization completes
- Good if you want visual confirmation emails are pending summary

## Configuration

Add these properties to Script Properties in the Apps Script editor:

### Basic Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `SUMMARIZER_ENABLED` | `true` | Enable/disable the Email Summarizer agent |
| `SUMMARIZER_DESTINATION_EMAIL` | Your email | Email address to receive summaries |

### Advanced Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `SUMMARIZER_MAX_AGE_DAYS` | `7` | Maximum age of emails to include in summaries |
| `SUMMARIZER_MAX_EMAILS_PER_SUMMARY` | `50` | Maximum emails to process per summary |
| `SUMMARIZER_ARCHIVE_ON_LABEL` | `true` | Archive emails immediately when `summarize` label is applied |
| `SUMMARIZER_DEBUG` | `false` | Enable detailed logging for the agent |
| `SUMMARIZER_DRY_RUN` | `false` | Test mode (generates summary but doesn't send email) |

### Configuration Examples

**Basic setup** (just receive summaries at different email):
```
SUMMARIZER_DESTINATION_EMAIL = work@example.com
```

**Keep emails in inbox until summarized**:
```
SUMMARIZER_ARCHIVE_ON_LABEL = false
```

**Process more emails, look back further**:
```
SUMMARIZER_MAX_AGE_DAYS = 14
SUMMARIZER_MAX_EMAILS_PER_SUMMARY = 100
```

**Debug mode for troubleshooting**:
```
SUMMARIZER_DEBUG = true
```

## Knowledge Customization

The Email Summarizer supports customizable summarization behavior through Google Drive documents, enabling you to define your own summarization style, tone, and formatting preferences without modifying code.

### Overview

The knowledge system uses two types of documents following [ADR-015](../../docs/adr/015-instructions-vs-knowledge-naming.md) semantic naming:

- **INSTRUCTIONS**: How to summarize (tone, length, formatting, focus areas)
- **KNOWLEDGE**: Contextual reference material (examples, terminology, patterns)

Both are optional. Without knowledge configuration, the Email Summarizer uses default "Economist's World in Brief" style.

### Configuration Properties

| Property | Type | Description |
|----------|------|-------------|
| `SUMMARIZER_INSTRUCTIONS_DOC_URL` | Document URL or ID | Guidelines document (tone, style, formatting) |
| `SUMMARIZER_KNOWLEDGE_FOLDER_URL` | Folder URL or ID | Folder with example summaries and context |
| `SUMMARIZER_KNOWLEDGE_MAX_DOCS` | Number (default: 5) | Maximum documents to fetch from knowledge folder |

### Setup Guide

#### Option 1: Instructions Only (Simple Customization)

Create a Google Doc with your summarization preferences:

**Example Instructions Document:**
```
Email Summarization Style Guide

TONE & LENGTH:
- Use casual, friendly tone (not formal business style)
- Keep summaries very brief (2-3 sentences max per theme)
- Maximum total length: 200 words

FOCUS AREAS:
- Emphasize action items and decisions over informational content
- Highlight deadlines and time-sensitive information
- Downplay routine updates and FYIs

FORMATTING:
- Use bullet points instead of paragraphs
- Highlight person names in CAPS
- Include emoji for visual scanning (📧 ✅ ⚠️)
```

**Configuration:**
```
SUMMARIZER_INSTRUCTIONS_DOC_URL = https://docs.google.com/document/d/YOUR_DOC_ID/edit
```

#### Option 2: Instructions + Examples (Advanced Customization)

Create an instructions document plus a folder with example summaries:

**Example Knowledge Folder Contents:**

**File 1: Example Summary - Project Updates.txt**
```
Good summary style for project emails:

**PROJECT: Website Redesign** 🎨
SARAH MARTINEZ announced launch delayed to Q3. Design team addressing API integration issues.
**Action:** JOHN needs to review revised timeline by Friday.
```

**File 2: Example Summary - Newsletters.txt**
```
Good summary style for newsletters:

**TECH NEWS DIGEST** 📰
Three AI model releases this week. Most notable: improved reasoning capabilities.
Read full: [link]
```

**Configuration:**
```
SUMMARIZER_INSTRUCTIONS_DOC_URL = https://docs.google.com/document/d/YOUR_DOC_ID/edit
SUMMARIZER_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/YOUR_FOLDER_ID
SUMMARIZER_KNOWLEDGE_MAX_DOCS = 3
```

### Token Utilization & Limits

The knowledge system provides transparency about AI token usage:

- **Token estimation**: Automatically calculated (chars / 4 heuristic)
- **Model capacity**: Gemini 2.5 supports 1M input tokens (~750K words)
- **Soft warning**: Logged at 50% capacity (524K tokens)
- **Critical warning**: Logged at 90% capacity (943K tokens)

**Debug logging** (when `SUMMARIZER_DEBUG=true`):
```json
{
  "summarizerKnowledgeUtilization": "2.5%",
  "estimatedTokens": 26214,
  "modelLimit": 1048576
}
```

### Customization Examples

**Casual tone for personal use:**
```
Tone: Super casual, like texting a friend
Length: 1-2 sentences per email, max 150 words total
Formatting: Use lots of emoji, bullet points only
```

**Executive briefing style:**
```
Tone: Formal, executive summary style
Length: 3-5 sentences per major theme, max 400 words
Focus: Strategic insights, decisions, financial impacts
Formatting: Numbered themes, bold for key terms
```

**Action-focused summaries:**
```
Tone: Directive, task-oriented
Focus: ONLY include emails requiring action
Formatting: Checkbox format (☐), deadlines in bold
Filter: Ignore FYIs and informational emails
```

### Error Handling

The knowledge system uses **fail-fast** error handling:

**If knowledge not configured:**
- ✅ System proceeds with default Economist style
- ✅ No errors or warnings

**If knowledge configured but inaccessible:**
- ❌ Summarization fails with actionable error
- ✅ Error includes property name and remediation steps
- ✅ No silent fallback to defaults

**Example error message:**
```
Failed to fetch knowledge document (ID: ABC123XYZ).
Document may not exist or you may lack permission.
Configuration property: SUMMARIZER_INSTRUCTIONS_DOC_URL
To proceed without knowledge, remove this property.
```

### Best Practices for Knowledge Documents

**Instructions Document:**
- Keep under 5,000 characters for quick token usage
- Be specific about tone, length, and formatting
- Include examples of good and bad practices
- Update as your preferences evolve

**Knowledge Folder:**
- Limit to 3-5 example documents (use `SUMMARIZER_KNOWLEDGE_MAX_DOCS`)
- Use real examples from your best summaries
- Name files descriptively (e.g., "Example - Newsletter Style.txt")
- Keep each example focused and concise
- **Shortcuts supported**: You can use Google Drive shortcuts to documents in other folders

**Token Management:**
- Monitor debug logs for utilization percentage
- If warnings appear, reduce `SUMMARIZER_KNOWLEDGE_MAX_DOCS`
- Remove verbose examples or split into focused documents
- Disable warnings with `KNOWLEDGE_LOG_SIZE_WARNINGS=false` (not recommended)

### Troubleshooting Knowledge Integration

**Knowledge not being applied:**
- Verify document/folder URLs are correct in Script Properties
- Check document permissions (must have at least Viewer access)
- Enable `SUMMARIZER_DEBUG=true` to see token utilization logs
- Run test: `testSummarizerKnowledgeIntegration()` in Apps Script editor

**Token warnings appearing:**
- Reduce number of documents: lower `SUMMARIZER_KNOWLEDGE_MAX_DOCS`
- Simplify instructions document (remove verbose examples)
- Split large knowledge documents into smaller focused ones

**Configuration errors:**
- Double-check URLs are complete (include `/edit` for docs)
- Verify you have access to documents/folders
- Remove property entirely to proceed without knowledge

## Example Summary Output

The Email Summarizer generates summaries in this format:

```
📧 Email Summary - October 2, 2025

Executive Summary
=================
You received 5 emails requiring summary:

• Newsletter: Tech Digest - New AI developments announced
• Project Update: Q4 roadmap changes and timeline adjustments
• Meeting Notes: Client kickoff meeting summary with action items

Key Details
===========

1. Tech Digest Newsletter (Oct 2, 2025)
   New AI model releases from major providers...
   [View email in Gmail]

2. Project Update from Sarah (Oct 1, 2025)
   Q4 roadmap has been updated with new priorities...
   [View email in Gmail]

Web Links Referenced
===================
• https://example.com/tech-news
• https://example.com/project-roadmap

---
Processed 5 emails. All emails have been archived and labeled as 'summarized'.
```

## Labels

The Email Summarizer creates and manages these labels:

- **`summarize`**: Apply this label to emails you want summarized (this is also used by core email labeling)
- **`summarized`**: Automatically applied to processed emails (created by the agent)

## Troubleshooting

### Email Summarizer not running automatically

**Solution**: Install the summarizer trigger by running `installSummarizerTrigger` in Apps Script editor

**Solution**: Check the "Triggers" section to verify the daily trigger exists

**Solution**: Verify `SUMMARIZER_ENABLED=true` in Script Properties

### No summary emails being received

**Solution**: Check that you have emails with the `summarize` label from the past 7 days

**Solution**: Verify `SUMMARIZER_DESTINATION_EMAIL` is set to your correct email address

**Solution**: Check Gmail spam folder for summary emails

**Solution**: Run `runSummarizerAgent` manually in Apps Script editor to test immediately

### Email Summarizer times out or fails

**Solution**: Reduce `SUMMARIZER_MAX_EMAILS_PER_SUMMARY` to a smaller number (try `25`)

**Solution**: Check that `DAILY_GEMINI_BUDGET` hasn't been exceeded (see [Configuration Reference](../guides/configuration.md))

**Solution**: Enable `SUMMARIZER_DEBUG=true` and check execution logs

### Emails not being archived

**Solution**: Verify `SUMMARIZER_ARCHIVE_ON_LABEL=true` in Script Properties

**Solution**: Check that emails have the `summarize` label applied correctly

**Solution**: Ensure trigger is installed and running (check Triggers section)

### Duplicate summaries or processing issues

**Solution**: Check execution logs for errors during summarization

**Solution**: Verify only one summarizer trigger exists (remove duplicates)

**Solution**: Use dry run mode (`SUMMARIZER_DRY_RUN=true`) to test without sending emails

## Best Practices

### When to Use the Email Summarizer

- **Long newsletters**: Apply `summarize` to lengthy newsletters for quick digests
- **Email threads**: Summarize long conversation threads before archiving
- **Batch processing**: Label multiple emails and get one consolidated summary
- **Regular reviews**: Label emails throughout the day, get summary the next morning

### Optimization Tips

- **Keep summaries focused**: Don't label too many unrelated emails at once
- **Use max age wisely**: Default 7 days works well; extend if you label emails irregularly
- **Archive on label**: Keep this enabled (default) for cleaner inbox management
- **Monitor logs**: Enable debug mode occasionally to verify agent is working correctly

### Workflow Recommendations

**Daily workflow**:
1. Apply `summarize` label to newsletters and long emails as they arrive
2. Emails archive immediately (inbox stays clean)
3. Receive consolidated summary email at 5 AM next day
4. Review summary, click links to access original emails if needed

**Weekly workflow**:
1. Once a week, review emails marked as important
2. Apply `summarize` to those needing deeper review
3. Receive batch summary
4. Use summary to prioritize which emails to read in full

## Prompt Building (ADR-022)

The Email Summarizer **owns its prompt building function** (`buildSummaryPrompt_()`) within `AgentSummarizer.gs`, ensuring complete self-containment and independent evolution.

**Why Agent-Owned Prompts:**
- **Complete self-containment**: Agent manages config + labels + prompts + logic
- **Independent evolution**: Change prompts without touching core system files
- **Clear ownership**: `AgentSummarizer.gs` is single source of truth
- **Consistent with ADR-022**: All agents own their prompt building

**Prompt Structure:**

The Email Summarizer follows the standard prompt building pattern with knowledge injection:

1. **Base instructions**: Built-in summarization guidelines (Economist "World in Brief" style)
2. **Global knowledge**: Organization-wide context (team structure, projects, terminology)
3. **Summarizer-specific knowledge**: Summary style, tone, formatting from Google Drive
4. **Email data**: Batch of emails to summarize with metadata

**Knowledge Injection Order:**

```javascript
function buildSummaryPrompt_(emails, summarizerKnowledge, globalKnowledge) {
  const parts = ['You are summarizing emails in Economist style.'];

  // 1. GLOBAL KNOWLEDGE (organizational context - ADR-019)
  if (globalKnowledge && globalKnowledge.configured) {
    parts.push('');
    parts.push('=== GLOBAL KNOWLEDGE ===');
    parts.push(globalKnowledge.knowledge);
  }

  // 2. SUMMARIZER-SPECIFIC KNOWLEDGE (style preferences - ADR-015)
  if (summarizerKnowledge && summarizerKnowledge.configured) {
    parts.push('');
    parts.push('=== YOUR SUMMARIZATION INSTRUCTIONS ===');
    parts.push(summarizerKnowledge.knowledge);
  } else {
    // Fallback to default Economist style
    parts.push('');
    parts.push('=== DEFAULT STYLE ===');
    parts.push('Use Economist "World in Brief" style: concise, factual, contextual.');
  }

  // 3. EMAIL DATA (emails to summarize)
  parts.push('');
  parts.push('=== EMAILS TO SUMMARIZE ===');
  emails.forEach(email => {
    parts.push(formatEmailForSummary_(email));
  });

  return parts.join('\n');
}
```

**Integration with Agent Workflow:**

```javascript
function runEmailSummarizer() {
  // 1. Fetch global knowledge (shared across ALL AI operations)
  const cfg = getConfig_();
  const globalKnowledge = fetchGlobalKnowledge_({
    folderUrl: cfg.GLOBAL_KNOWLEDGE_FOLDER_URL,
    maxDocs: parseInt(cfg.GLOBAL_KNOWLEDGE_MAX_DOCS || '5')
  });

  // 2. Fetch summarizer-specific knowledge
  const config = getSummarizerConfig_();
  const summarizerKnowledge = fetchSummarizerKnowledge_({
    instructionsUrl: config.SUMMARIZER_INSTRUCTIONS_DOC_URL,
    knowledgeFolderUrl: config.SUMMARIZER_KNOWLEDGE_FOLDER_URL,
    maxDocs: config.SUMMARIZER_KNOWLEDGE_MAX_DOCS
  });

  // 3. Build prompt using agent-owned function
  const prompt = buildSummaryPrompt_(emails, summarizerKnowledge, globalKnowledge);

  // 4. Call LLM service with pre-built prompt
  const summaryText = generateSummary_(prompt, model, projectId, location, apiKey);

  // 5. Format and send summary email
  sendFormattedEmail_(destination, subject, htmlContent, emails);
}
```

**Token Utilization Transparency:**

When `SUMMARIZER_DEBUG=true`, the prompt builder logs token usage:

```json
{
  "globalKnowledgeUtilization": "1.2%",
  "estimatedTokens": 12582,
  "modelLimit": 1048576
}
```

```json
{
  "summarizerKnowledgeUtilization": "2.5%",
  "estimatedTokens": 26214
}
```

**Key Features:**

- **Graceful degradation**: Falls back to default Economist style when knowledge not configured
- **Format enforcement**: Ensures summaries have executive summary + key details + web links
- **Batch processing**: Handles multiple emails in single AI request
- **Hyperlink preservation**: Maintains source email links and web URLs from content

## Integration with Web App

The Email Summarizer agent works independently but complements the [Web App Dashboard](../features/web-app.md):

- **Email Summarizer**: Scheduled daily summaries, automatic processing
- **Web App**: On-demand summaries when you need them right now

You can use both together:
- Use Email Summarizer for daily digest of accumulated emails
- Use Web App for immediate summarization when you need quick answers

## Technical Details

### Implementation

The Email Summarizer follows the [self-contained agent architecture](../../docs/adr/011-self-contained-agents.md):

- **Independent lifecycle**: Manages own configuration, labels, and triggers
- **Generic service layer**: Uses shared Gmail operations from `GmailService.gs`
- **Existing AI infrastructure**: Leverages `LLMService.gs` and `PromptBuilder.gs`
- **Full error handling**: Comprehensive error messages and dry-run support

### Source Code

Implementation: `src/AgentSummarizer.gs`

Agent-owned functions:
- `buildSummaryPrompt_()` - AI prompt construction with knowledge injection (ADR-022)
- `getSummarizerConfig_()` - Configuration management
- `summarizerOnLabel_()` - onLabel handler (archives on label)
- `runEmailSummarizer()` - Scheduled summarization function

Supporting services:
- `src/LLMService.gs`: `generateSummary_()` function for AI communication
- `src/KnowledgeService.gs`: `fetchSummarizerKnowledge_()` and `fetchGlobalKnowledge_()` functions

### Architecture Decisions

- [ADR-011: Self-Contained Agent Architecture](../../docs/adr/011-self-contained-agents.md) - Independent agent lifecycle
- [ADR-012: Generic Service Layer Pattern](../../docs/adr/012-generic-service-layer.md) - Reusable Gmail operations
- [ADR-015: INSTRUCTIONS vs KNOWLEDGE Naming Convention](../../docs/adr/015-instructions-vs-knowledge-naming.md) - Configuration property naming
- [ADR-018: Dual-Hook Agent Architecture](../../docs/adr/018-dual-hook-agent-architecture.md) - onLabel for immediate archive
- [ADR-019: Global Knowledge Folder Architecture](../../docs/adr/019-global-knowledge-folder.md) - Organization-wide context shared across all AI operations
- [ADR-022: Agent-Owned Prompt Building](../../docs/adr/022-agent-owned-prompts.md) - Agent owns `buildSummaryPrompt_()` for complete self-containment

## See Also

- [Back to README](../../README.md)
- [Web App Dashboard](../features/web-app.md) - On-demand summarization
- [Configuration Reference](../guides/configuration.md) - All configuration options
- [Troubleshooting Guide](../guides/troubleshooting.md) - General troubleshooting
- [Development Guide](../guides/development.md) - For contributors
