# Reply Drafter Agent

The Reply Drafter is an intelligent agent that automatically creates draft replies for emails labeled `reply_needed`, leveraging AI to generate professional, context-aware responses based on the full email thread conversation.

## What It Does

The Reply Drafter agent:

- **Monitors** emails labeled as `reply_needed` by the core classification system
- **Checks idempotency** to ensure drafts aren't created multiple times
- **Fetches optional knowledge** from Google Drive for personalized drafting style
- **Retrieves full thread context** including all messages in the conversation
- **Generates professional drafts** using AI with full thread awareness
- **Creates Gmail draft replies** automatically attached to the original thread
- **Runs after labeling** as part of the agent post-processing pipeline
- **Respects dry-run mode** for safe testing before enabling

This agent operates automatically after the core email labeling system applies the `reply_needed` label, requiring no manual intervention once configured.

## Perfect For

- **Meeting requests**: Generate professional responses to calendar invitations
- **Questions**: Draft answers to technical or informational inquiries
- **Follow-ups**: Create contextual replies to ongoing conversations
- **Time-sensitive emails**: Quickly draft responses to urgent requests
- **Routine correspondence**: Handle standard reply patterns efficiently

## Quick Start

### Prerequisites

- Complete the [basic email labeling setup](../../README.md#setup-guide) first
- Reply Drafter is enabled by default (`REPLY_DRAFTER_ENABLED=true`)
- Core labeling system must be running to apply `reply_needed` labels

### Setup Steps

1. **Enable the agent** (already enabled by default):
   - The Reply Drafter is active as soon as emails receive the `reply_needed` label
   - No trigger installation required (runs as part of core email processing)
   - Works immediately with default professional drafting style

2. **Customize drafting style** (optional):
   - Create a Google Doc with your drafting instructions (tone, style, length)
   - Configure `REPLY_DRAFTER_INSTRUCTIONS_URL` with the document URL
   - See [Knowledge Customization](#knowledge-customization) section below

3. **Add contextual knowledge** (optional):
   - Create a Google Drive folder with example replies or reference material
   - Configure `REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL` with the folder URL
   - Set `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS` to limit documents fetched

4. **Test the agent**:
   - Enable debug mode: `REPLY_DRAFTER_DEBUG=true`
   - Run the core email labeling process
   - Check Gmail for draft replies on `reply_needed` emails
   - Review execution logs for detailed operation

## How It Works

### Workflow

1. **Core Labeling**: Email classification system applies `reply_needed` label
2. **Agent Activation**: Reply Drafter agent processes the labeled email
3. **Idempotency Check**: Verifies no draft already exists for the thread
4. **Knowledge Fetching**: Retrieves optional instructions and context from Google Drive
5. **Thread Retrieval**: Fetches full email conversation (all messages in thread)
6. **Prompt Building**: Constructs AI prompt with thread context and knowledge
7. **AI Generation**: Gemini AI generates professional draft reply
8. **Draft Creation**: Gmail draft attached as reply to the latest message
9. **Completion**: Agent marks email as processed and logs result

### Idempotent Operation

The Reply Drafter implements strict idempotency to prevent duplicate drafts:

- **Checks for existing drafts** before generating new ones
- **Skips processing** if a draft already exists for the thread
- **Safe to re-run** multiple times without creating duplicate drafts
- **Respects dry-run mode** for testing without actual draft creation

### Thread-Aware Drafting

Unlike simple reply generators, the Reply Drafter:

- **Analyzes full conversation history** to understand context
- **References previous messages** when generating replies
- **Maintains conversation continuity** across multi-message threads
- **Understands sender/recipient relationships** through thread analysis

## Configuration

Add these properties to Script Properties in the Apps Script editor:

### Basic Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `REPLY_DRAFTER_ENABLED` | `true` | Enable/disable the Reply Drafter agent |
| `REPLY_DRAFTER_DEBUG` | `false` | Enable detailed logging for the agent |
| `REPLY_DRAFTER_DRY_RUN` | `false` | Test mode (skips actual draft creation) |

### Knowledge Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `REPLY_DRAFTER_INSTRUCTIONS_URL` | None | Google Docs URL with drafting style/methodology |
| `REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL` | None | Google Drive folder URL with knowledge documents (ADR-015) |
| `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS` | `5` | Maximum documents to fetch from knowledge folder (ADR-015) |

### Configuration Examples

**Basic setup** (use default drafting style):
```
REPLY_DRAFTER_ENABLED = true
```

**Custom drafting style** (instructions only):
```
REPLY_DRAFTER_INSTRUCTIONS_URL = https://docs.google.com/document/d/YOUR_DOC_ID/edit
```

**Full knowledge customization** (instructions + examples):
```
REPLY_DRAFTER_INSTRUCTIONS_URL = https://docs.google.com/document/d/YOUR_DOC_ID/edit
REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/YOUR_FOLDER_ID
REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS = 3
```

**Debug mode for troubleshooting**:
```
REPLY_DRAFTER_DEBUG = true
```

**Dry-run testing** (analyze but don't create drafts):
```
REPLY_DRAFTER_DRY_RUN = true
```

## Knowledge Customization

The Reply Drafter supports customizable drafting behavior through Google Drive documents, enabling you to define your own writing style, tone, and formatting preferences without modifying code.

### Overview

The knowledge system uses two types of documents following [ADR-015](../../docs/adr/015-instructions-knowledge-naming.md) semantic naming:

- **INSTRUCTIONS**: How to draft replies (tone, style, length, methodology)
- **KNOWLEDGE**: Contextual reference material (examples, templates, patterns)

Both are optional. Without knowledge configuration, the Reply Drafter uses default professional business style.

### Configuration Properties

| Property | Type | Description |
|----------|------|-------------|
| `REPLY_DRAFTER_INSTRUCTIONS_URL` | Document URL or ID | Guidelines document (tone, style, methodology) |
| `REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL` | Folder URL or ID | Folder with knowledge documents and reference material (ADR-015) |
| `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS` | Number (default: 5) | Maximum documents to fetch from knowledge folder (ADR-015) |

### Setup Guide

#### Option 1: Instructions Only (Simple Customization)

Create a Google Doc with your drafting preferences:

**Example Instructions Document:**
```
Reply Drafting Style Guide

TONE & VOICE:
- Professional but warm and approachable
- Conversational rather than formal
- Use contractions (I'm, we'll, can't) to sound natural
- Avoid corporate jargon and buzzwords

LENGTH & STRUCTURE:
- Keep replies concise: 3-5 sentences for simple questions
- Use bullet points for multi-item responses
- Maximum 150 words unless complex topic requires more detail

OPENING LINES:
- Start with acknowledgment: "Thanks for reaching out about..."
- Show you read the email: "I see you're asking about..."
- Avoid generic openers like "Hope this email finds you well"

CLOSING STYLE:
- End with clear next step or call to action
- Use "Best regards" or "Thanks" as closing
- Include your name automatically via signature

SPECIAL INSTRUCTIONS:
- If request is unclear, draft asks clarifying questions
- For meeting requests, suggest 2-3 specific time slots
- For technical questions, provide concise explanation with links
```

**Configuration:**
```
REPLY_DRAFTER_INSTRUCTIONS_URL = https://docs.google.com/document/d/YOUR_DOC_ID/edit
```

#### Option 2: Instructions + Examples (Advanced Customization)

Create an instructions document plus a folder with example drafts:

**Example Knowledge Folder Contents:**

**File 1: Example Reply - Meeting Request.txt**
```
ORIGINAL EMAIL:
Subject: Meeting to discuss Q4 roadmap
From: Sarah Martinez
"Can we schedule time this week to review the Q4 product roadmap?
I have some concerns about the timeline."

GOOD DRAFT REPLY:
"Hi Sarah,

Absolutely, I'd like to discuss this as well. I have the following slots
available this week:

• Tuesday 2-3pm ET
• Wednesday 10-11am ET
• Thursday 3-4pm ET

Would any of these work for you? If not, feel free to suggest times
that fit your schedule better.

Looking forward to aligning on the Q4 plan.

Best,
[Your name]"
```

**File 2: Example Reply - Technical Question.txt**
```
ORIGINAL EMAIL:
Subject: API authentication failing
From: john@customer.com
"Our integration keeps getting 401 errors when calling your API.
We're using the API key from the dashboard but it's not working."

GOOD DRAFT REPLY:
"Hi John,

Sorry you're running into auth issues. The 401 error typically means
the API key format is incorrect. A few things to check:

• Ensure you're using the full key (starts with 'sk-live-')
• Include it in the Authorization header: 'Bearer YOUR_KEY'
• Verify the key hasn't been rotated in the dashboard

Here's the auth documentation with examples: [link]

If you're still stuck after checking these, send me the request headers
(redact the actual key) and I'll take a closer look.

Best,
[Your name]"
```

**File 3: Example Reply - Decline Request.txt**
```
ORIGINAL EMAIL:
Subject: Speaking at TechConf 2025
From: events@techconf.com
"We'd love to have you speak at TechConf 2025 in March. Can you do
a 45-minute keynote on AI trends?"

GOOD DRAFT REPLY (Polite Decline):
"Hi there,

Thanks so much for the invitation to speak at TechConf 2025. I'm
honored you thought of me.

Unfortunately, my schedule in March is already fully committed and
I won't be able to participate this year.

I'd definitely be interested in future events though, so please keep
me in mind for TechConf 2026 or other upcoming conferences.

Best of luck with the event!

Best,
[Your name]"
```

**Configuration:**
```
REPLY_DRAFTER_INSTRUCTIONS_URL = https://docs.google.com/document/d/YOUR_DOC_ID/edit
REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/YOUR_FOLDER_ID
REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS = 3
```

### Token Utilization & Limits

The knowledge system provides transparency about AI token usage:

- **Token estimation**: Automatically calculated (chars / 4 heuristic)
- **Model capacity**: Gemini 2.5 supports 1M input tokens (~750K words)
- **Soft warning**: Logged at 50% capacity (524K tokens)
- **Critical warning**: Logged at 90% capacity (943K tokens)

**Debug logging** (when `REPLY_DRAFTER_DEBUG=true`):
```json
{
  "replyDrafterKnowledgeUtilization": "1.8%",
  "estimatedTokens": 18874,
  "modelLimit": 1048576
}
```

### Customization Examples

**Casual tone for personal use:**
```
TONE: Super casual, like texting a friend
STYLE: Short, direct, friendly
CLOSINGS: Use "Cheers", "Talk soon", "Thanks!"
EMOJIS: Okay to use occasionally for warmth
```

**Executive communication style:**
```
TONE: Formal, executive-level professional
STYLE: Concise, strategic, action-oriented
LENGTH: Maximum 100 words unless complex analysis required
STRUCTURE: Lead with conclusion, then supporting points
CLOSINGS: Use "Regards" or "Best"
```

**Technical support style:**
```
TONE: Helpful, patient, educational
STYLE: Step-by-step explanations with examples
LINKS: Always include relevant documentation links
STRUCTURE: Acknowledge issue, provide solution, offer follow-up
```

**Sales/Business development style:**
```
TONE: Consultative, solutions-focused
STYLE: Value-oriented, customer needs first
STRUCTURE: Understand their need, propose solution, clear next step
CLOSINGS: Always include specific call-to-action
```

### Error Handling

The knowledge system uses **fail-fast** error handling:

**If knowledge not configured:**
- System proceeds with default professional business style
- No errors or warnings
- Drafts still generated successfully

**If knowledge configured but inaccessible:**
- Draft generation fails with actionable error
- Error includes property name and remediation steps
- No silent fallback to defaults

**Example error message:**
```
Failed to fetch knowledge document (ID: ABC123XYZ).
Document may not exist or you may lack permission.
Configuration property: REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL
To proceed without knowledge, remove this property.
```

**Note on configuration**: Reply Drafter manages its own configuration via `getReplyDrafterConfig_()` in `AgentReplyDrafter.gs` (ADR-014), not through core `Config.gs`. This follows the self-contained agent architecture pattern.

### Best Practices for Knowledge Documents

**Instructions Document:**
- Keep under 5,000 characters for quick token usage
- Be specific about tone, style, and structure
- Include do's and don'ts with examples
- Update as your communication style evolves
- Test changes with dry-run mode first

**Knowledge Folder:**
- Limit to 3-5 example documents (use `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS`)
- Use real examples from your best drafts
- Name files descriptively (e.g., "Example Reply - Meeting Request.txt")
- Cover diverse scenarios (meetings, questions, declines, etc.)
- Include both good and bad examples with annotations
- **Shortcuts supported**: You can use Google Drive shortcuts to documents in other folders

**Token Management:**
- Monitor debug logs for utilization percentage
- If warnings appear, reduce `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS` (ADR-015)
- Remove verbose examples or split into focused documents
- Disable warnings with `KNOWLEDGE_LOG_SIZE_WARNINGS=false` (not recommended)

### Troubleshooting Knowledge Integration

**Knowledge not being applied:**
- Verify document/folder URLs are correct in Script Properties
- Check document permissions (must have at least Viewer access)
- Enable `REPLY_DRAFTER_DEBUG=true` to see token utilization logs
- Test with simple draft to verify knowledge loading

**Token warnings appearing:**
- Reduce number of documents: lower `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS` (ADR-015)
- Simplify instructions document (remove verbose examples)
- Split large knowledge documents into smaller focused ones

**Configuration errors:**
- Double-check URLs are complete (include `/edit` for docs)
- Verify you have access to documents/folders
- Remove property entirely to proceed without knowledge

## Example Draft Output

The Reply Drafter generates drafts in this format (with default style):

### Simple Question Reply

**Original Email:**
```
Subject: API rate limits?
From: developer@startup.com

"What are the API rate limits for the free tier? Our app makes about
1000 calls per day."
```

**Generated Draft:**
```
Hi,

Thanks for asking about rate limits. The free tier supports up to
1,500 API calls per day, so your usage of ~1,000 calls should be
well within limits.

You can monitor your current usage in the dashboard under API Settings.
If you need higher limits in the future, our paid tiers start at 10,000
calls/day.

Let me know if you have any other questions!

Best regards
```

### Meeting Request Reply

**Original Email:**
```
Subject: Sync on project timeline
From: sarah@company.com

"Can we schedule a quick call this week to review the project timeline?
I want to make sure we're aligned on the Q4 deliverables."
```

**Generated Draft:**
```
Hi Sarah,

Absolutely, I'd like to review this as well. I have the following times
available this week:

• Tuesday 2-3pm
• Thursday 10-11am
• Friday 3-4pm

Do any of these work for you? If not, feel free to suggest alternative
times that fit your schedule better.

Looking forward to aligning on the Q4 plan.

Best regards
```

### Technical Support Reply

**Original Email:**
```
Subject: Error when deploying to production
From: ops@customer.com

"We're getting a 500 error when deploying to production. The staging
environment works fine. Any ideas what could be wrong?"
```

**Generated Draft:**
```
Hi,

Sorry to hear about the production deployment issue. Since staging works
fine, here are the most common causes:

1. Environment variables missing or incorrect in production
2. Database connection configuration differences
3. API keys or secrets not set in production environment
4. Different dependency versions between staging and production

Can you check your production environment variables first? Also, if you
can share the full error message and stack trace, I can help narrow down
the specific issue.

Happy to jump on a quick call if that would be helpful.

Best regards
```

## Architecture & Integration

### Self-Contained Agent Pattern

The Reply Drafter follows the [self-contained agent architecture](../../docs/adr/011-self-contained-agents.md):

- **Self-registration**: Automatically registers with `AGENT_MODULES.push()` pattern
- **Independent configuration**: Manages own Script Properties without modifying core Config.gs
- **No trigger management**: Runs as part of core email labeling pipeline (no separate trigger)
- **Idempotent execution**: Safe to re-run without side effects
- **Full error handling**: Comprehensive logging and graceful degradation

### Integration with Core System

**Agent Registration:**
```javascript
// From AgentReplyDrafter.gs
AGENT_MODULES.push(function(api) {
  api.register(
    'reply_needed',           // Label to trigger on
    'ReplyDrafter',           // Agent name
    processReplyNeeded_,      // Handler function
    {
      idempotentKey: function(ctx) { return 'replyDrafter:' + ctx.threadId; },
      runWhen: 'afterLabel',  // Run after labeling
      timeoutMs: 30000,       // Soft timeout guidance
      enabled: true           // Enabled by default
    }
  );
});
```

**Execution Context:**
```javascript
// Agent receives ctx object with:
{
  label: 'reply_needed',      // Triggering label
  decision: 'reply_needed',   // Classification decision
  threadId: '18f3c...',       // Gmail thread ID
  thread: GmailThread,        // Gmail thread object
  cfg: Config,                // Global configuration
  dryRun: false,              // Dry-run mode flag
  log: function(msg) {...}    // Logging function
}
```

### Prompt Engineering Pattern

The Reply Drafter follows [ADR-010: PromptBuilder and LLMService Separation](../../docs/adr/010-promptbuilder-llmservice-separation.md):

**Separation of Concerns:**
- **PromptBuilder.gs**: `buildReplyDraftPrompt_()` constructs AI prompts with knowledge injection
- **LLMService.gs**: `generateReplyDraft_()` handles API communication and authentication
- **AgentReplyDrafter.gs**: Orchestrates workflow and manages agent-specific logic

**Knowledge Integration:**
```javascript
// Knowledge fetched via KnowledgeService
const knowledge = fetchReplyKnowledge_({
  instructionsUrl: config.REPLY_DRAFTER_INSTRUCTIONS_URL,
  knowledgeFolderUrl: config.REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL,  // ADR-015
  maxDocs: config.REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS  // ADR-015
});

// Prompt built with conditional knowledge injection
const prompt = buildReplyDraftPrompt_(emailThread, knowledge);

// AI service called with pre-built prompt
const draftText = generateReplyDraft_(prompt, model, projectId, location, apiKey);
```

## Troubleshooting

### Reply Drafter not creating drafts

**Solution**: Verify `REPLY_DRAFTER_ENABLED=true` in Script Properties

**Solution**: Check that core email labeling is applying `reply_needed` labels

**Solution**: Enable `REPLY_DRAFTER_DEBUG=true` and check execution logs

**Solution**: Test with `REPLY_DRAFTER_DRY_RUN=true` to verify agent runs without draft creation

### Drafts not appearing in Gmail

**Solution**: Check Gmail Drafts folder - drafts are attached to original thread

**Solution**: Verify agent completed successfully in execution logs

**Solution**: Look for error messages in logs indicating draft creation failure

**Solution**: Ensure you have necessary Gmail permissions granted to the script

### Multiple drafts being created

**Solution**: This should not happen - idempotency check prevents duplicates

**Solution**: If occurring, check execution logs for errors during idempotency check

**Solution**: Verify only one instance of agent is registered (check `AGENT_MODULES`)

**Solution**: Report as bug - this indicates idempotency logic failure

### Draft quality issues

**Solution**: Customize drafting style with `REPLY_DRAFTER_INSTRUCTIONS_URL`

**Solution**: Provide example drafts in `REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL`

**Solution**: Review generated drafts and refine instructions document based on patterns

**Solution**: Enable `REPLY_DRAFTER_DEBUG=true` to see token utilization and prompt details

### Knowledge not being applied

**Solution**: Verify document/folder URLs are correct in Script Properties

**Solution**: Check document permissions (must have at least Viewer access)

**Solution**: Enable `REPLY_DRAFTER_DEBUG=true` to see knowledge loading logs

**Solution**: Test with simple configuration first (instructions only, then add knowledge folder)

### Agent timing out

**Solution**: Reduce `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS` to load fewer documents

**Solution**: Verify Google Drive documents are accessible (not causing API delays)

**Solution**: Check if `DAILY_GEMINI_BUDGET` is exceeded (see [Configuration Reference](../guides/configuration.md))

**Solution**: Review execution logs for specific timeout errors

### Budget exceeded errors

**Solution**: Reply Drafter respects global `DAILY_GEMINI_BUDGET` setting

**Solution**: Increase budget or reduce email volume processed per run

**Solution**: Use `MAX_EMAILS_PER_RUN` to limit emails processed in each execution

**Solution**: Monitor budget usage via execution logs

## Best Practices

### When to Use the Reply Drafter

- **High-volume correspondence**: Automate drafts for routine inquiries
- **Time-sensitive emails**: Generate quick draft responses to urgent requests
- **Complex threads**: Leverage full thread context for informed replies
- **Consistent communication**: Maintain uniform tone across all responses
- **Quick review workflow**: Draft first, review/edit before sending

### Workflow Recommendations

**Review and edit workflow**:
1. Core system labels emails as `reply_needed`
2. Reply Drafter generates draft replies automatically
3. Review drafts in Gmail Drafts folder
4. Edit as needed to personalize or add details
5. Send from Gmail with confidence

**Customization workflow**:
1. Start with default style, observe draft quality
2. Create instructions document with initial preferences
3. Add 2-3 example drafts to knowledge folder
4. Test with debug mode, refine instructions
5. Expand knowledge folder as patterns emerge

**Quality assurance workflow**:
1. Enable `REPLY_DRAFTER_DEBUG=true` periodically
2. Review generated drafts for quality and accuracy
3. Update instructions document based on patterns
4. Add examples of particularly good drafts to knowledge
5. Remove or refine examples that don't help

### Optimization Tips

- **Keep instructions focused**: Be specific about tone and structure, avoid verbose examples
- **Curate knowledge carefully**: Quality over quantity - 3-5 excellent examples better than 20 mediocre ones
- **Monitor token usage**: Use debug mode to ensure knowledge isn't approaching model limits
- **Test with dry-run**: Use `REPLY_DRAFTER_DRY_RUN=true` when testing configuration changes
- **Review regularly**: Periodically check draft quality and update instructions as needed

### Security and Privacy

- **Draft visibility**: Drafts are only visible to you, not sent automatically
- **Thread context**: Full email thread content sent to AI for context (Google's Gemini)
- **Knowledge documents**: Ensure sensitive information not included in instructions/knowledge
- **API usage**: Reply drafting counts against your `DAILY_GEMINI_BUDGET`
- **Access control**: Verify Google Drive permissions on instructions/knowledge documents

## Technical Details

### Implementation

The Reply Drafter follows the self-contained agent architecture:

- **Independent lifecycle**: Manages own configuration without core system changes
- **Generic service layer**: Uses shared Gmail operations (future: may use `GmailService.gs` functions)
- **Existing AI infrastructure**: Leverages `LLMService.gs` and `PromptBuilder.gs`
- **Full error handling**: Comprehensive error messages and dry-run support
- **Idempotent design**: Safe to re-run without duplicate drafts

### Source Code

Implementation: `src/AgentReplyDrafter.gs`

Supporting services:
- `src/PromptBuilder.gs`: `buildReplyDraftPrompt_()` function
- `src/LLMService.gs`: `generateReplyDraft_()` function
- `src/KnowledgeService.gs`: `fetchReplyKnowledge_()` function

### Architecture Decisions

- [ADR-004: Pluggable Agent Architecture](../../docs/adr/004-pluggable-agents.md) - Agent framework foundation
- [ADR-010: PromptBuilder and LLMService Separation](../../docs/adr/010-promptbuilder-llmservice-separation.md) - Prompt engineering patterns
- [ADR-011: Self-Contained Agent Architecture](../../docs/adr/011-self-contained-agents.md) - Independent agent lifecycle
- [ADR-015: INSTRUCTIONS vs KNOWLEDGE Naming Convention](../../docs/adr/015-instructions-knowledge-naming.md) - Configuration property naming

### Agent Context API

The agent receives a context object from the agent framework:

```javascript
function processReplyNeeded_(ctx) {
  // ctx.label: 'reply_needed'
  // ctx.decision: 'reply_needed'
  // ctx.threadId: Gmail thread ID string
  // ctx.thread: GmailThread object
  // ctx.cfg: Global configuration object
  // ctx.dryRun: Boolean dry-run flag
  // ctx.log(msg): Logging function

  // Return status object
  return {
    status: 'ok'|'skip'|'retry'|'error',
    info: 'optional status message'
  };
}
```

### Agent Response Contract

Agents must return a status object:

- **`{ status: 'ok', info: 'draft created with 256 characters' }`**: Success
- **`{ status: 'skip', info: 'draft already exists' }`**: Skipped (idempotency)
- **`{ status: 'error', info: 'knowledge fetch failed: ...' }`**: Error occurred
- **`{ status: 'retry', info: 'transient API error' }`**: Retry later (future)

## See Also

- [Back to README](../../README.md)
- [Email Summarizer Agent](./email-summarizer.md) - Complementary summarization agent
- [Configuration Reference](../guides/configuration.md) - All configuration options
- [Troubleshooting Guide](../guides/troubleshooting.md) - General troubleshooting
- [Development Guide](../guides/development.md) - For contributors
- [Knowledge System](../features/knowledge-system.md) - Deep dive on knowledge management
