# Developer Guide: Mail Screener — Gmail Labeler (Apps Script)

This guide explains how the current system works and how to configure, extend, and troubleshoot it. It covers the Apps Script code in `src/`, the configuration via Script Properties, and local workflows using `clasp`.

## Overview
- Core flow: triage Gmail threads and apply exactly one action label per thread.
- Labels: `reply_needed`, `review`, `todo`, `summarize` (created if missing).
- Rules: Optional Google Doc text (or a built-in default policy) is embedded in the prompt.
- LLM: Uses Gemini via Generative Language API (API key) by default; Vertex mode is supported if configured.
- Execution: Manual (`run()`), or scheduled via a time-based trigger (`installTrigger()`).

## Repository Layout
- `src/Main.gs`: entry points (`run`, triggers) and orchestration
- `src/Config.gs`: loads Script Properties and defaults
- `src/Categorizer.gs`: batching, model calls, response normalization
- `src/Organizer.gs`: applies labels to threads, summarizes outcomes
- `src/KnowledgeService.gs`: unified knowledge management from Google Drive
- `src/LLMService.gs`: model request/response glue (used by categorizer)
- `src/GmailService.gs`: helpers for querying and shaping Gmail data + generic service functions
- `src/PromptBuilder.gs`: constructs the model prompt from emails + policy
- `src/AgentSummarizer.gs`: self-contained Email Summarizer agent implementation
- `src/AgentTemplate.gs`: enhanced agent template with self-contained patterns
- `src/appsscript.json`: script metadata (runtime, time zone)

## Configuration (Script Properties)
Set in Apps Script → Project Settings → Script properties.

Required for API-key mode (default):
- `GEMINI_API_KEY`: Generative Language API key

Optional / Advanced:
- `RULE_DOC_URL`: Google Doc or Drive URL to the triage rules (preferred)
- `RULE_DOC_ID`: Doc ID (legacy alternative)
- `DEFAULT_FALLBACK_LABEL`: default `review`
- `MAX_EMAILS_PER_RUN`: default `20`
- `BATCH_SIZE`: default `10`
- `BODY_CHARS`: default `1200` (max characters of body excerpt per email)
- `DRY_RUN`: `true|false`, default `false`
- `DEBUG`: `true|false`, default `false`

Note: API quotas are managed through Google Cloud Console. Monitor usage at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

Vertex mode (optional):
- `GOOGLE_CLOUD_PROJECT` (or `PROJECT_ID`): required only if no API key is set
- `GOOGLE_CLOUD_LOCATION`: default `us-central1`

Global Knowledge (ADR-019, optional):
- `GLOBAL_KNOWLEDGE_FOLDER_URL`: Organization-wide context folder shared across all AI features
- `GLOBAL_KNOWLEDGE_MAX_DOCS`: default `5` (max documents from global knowledge folder)

Email Summarizer Agent (optional):
- `SUMMARIZER_ENABLED`: default `true`
- `SUMMARIZER_MAX_AGE_DAYS`: default `7` (days of emails to include)
- `SUMMARIZER_MAX_EMAILS_PER_SUMMARY`: default `50` (max emails per summary)
- `SUMMARIZER_DESTINATION_EMAIL`: default user's email (where to send summaries)
- `SUMMARIZER_ARCHIVE_ON_LABEL`: default `true` (archive emails immediately when 'summarize' label applied)
- `SUMMARIZER_DEBUG`: default `false` (verbose logging)
- `SUMMARIZER_DRY_RUN`: default `false` (test mode)

## Local Development with clasp
Prereqs: Node 18+, `@google/clasp` installed and logged in.

```bash
npm install -g @google/clasp
```

### Multi-Account Setup (Recommended)

#### Initial Setup
```bash
# Configure accounts
npm run setup:account

# Authenticate each account
clasp --user personal login
clasp --user work login

# Create project files
npm run switch:create-project-files

# Validate setup
npm run validate:accounts
```

#### Daily Development Workflow
```bash
# Deploy to specific account (includes push + web app + triggers)
npm run deploy:personal
npm run deploy:work

# Open specific account editor
npm run open:personal
npm run open:work

# Check account status
npm run switch:status
npm run status:all
```

### Legacy Single Account Workflow
For existing single-account setups or simple deployments:
```bash
clasp login --no-localhost
npm run create  # First time only
npm run push
npm run open
```

## Execution Flow
1. `run()` reads config via `getConfig_()`.
2. Ensures labels exist.
3. Loads knowledge from Drive via `fetchLabelingKnowledge_()` (optional).
4. Queries candidate threads and extracts minimal email data.
5. Sends batches to Gemini and parses a JSON result per email: `{ id, required_action, reason }`.
6. Normalizes `required_action` to a valid label or falls back.
7. Applies exactly one label per thread and logs a summary.

### Key Functions
- `run()` (in `Main.gs`): Orchestrates the entire run and logs a JSON summary.
- `installTrigger()` / `deleteExistingTriggers_()` (in `Main.gs`): Manage time-based triggers.
- `categorizeWithGemini_()` (in `Categorizer.gs`): Handles batching and response normalization.
- `categorizeBatch_()` (in `LLMService.gs`): Builds request, calls model endpoint, and parses responses.
- `fetchLabelingKnowledge_()` (in `KnowledgeService.gs`): Loads knowledge documents from Drive.
- `Organizer.apply_()` (in `Organizer.gs`): Applies labels and returns counts.

## Prompt & Rules
- The prompt includes: action label definitions, your rules text, and email snippets.
- Improve results by adding clear, concrete examples to your rules document.
- If your rules cannot be fetched, the default policy is used.

## Model Calls
- Default model: `gemini-1.5-flash`
- API key mode endpoint: `https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=...`
- Vertex mode endpoint: `https://<location>-aiplatform.googleapis.com/v1/projects/<project>/locations/<location>/publishers/google/models/<model>:generateContent`
- Debug logs include HTTP status and raw model output when `DEBUG=true`.

## Batching
- `BATCH_SIZE`: number of emails per model call.
- API quotas are managed natively by Google Cloud. Monitor at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

## Error Handling & Normalization
- Robust JSON extraction: takes the first JSON object in the model output.
- If parsing fails, items fall back with `required_action: null` and reason `fallback-on-error`.
- Only allowed labels are accepted; others are treated as invalid and skipped.

## Scheduling

### Trigger Installation
**Important**: Automated trigger installation via `clasp run` is unreliable due to permission issues. Manual installation is recommended:

1. Open Apps Script editor: `npm run open:personal` or `npm run open:work`
2. Select `installTrigger` from function dropdown
3. Click Run button and grant permissions
4. Verify in Triggers section

### Programmatic Trigger Management
For manual execution in Apps Script editor:
```javascript
installTrigger();           // Install hourly trigger
deleteExistingTriggers_();  // Remove all triggers
```

### Multi-Account Trigger Management
Install triggers separately for each account:
- Personal: `npm run open:personal` → run `installTrigger`
- Work: `npm run open:work` → run `installTrigger`

### Email Summarizer Trigger Management
Email Summarizer manages its own trigger lifecycle independently:

#### Manual Trigger Installation
```javascript
installSummarizerTrigger();     // Install daily trigger at 5 AM
listSummarizerTriggers();       // List current triggers
deleteSummarizerTriggers_();    // Remove all summarizer triggers
```

#### Scheduled Function Entry Point
```javascript
runEmailSummarizer();           // Main scheduled function (called by trigger)
```

The Email Summarizer trigger is separate from the main email processing trigger and can be installed/removed independently.

## Troubleshooting
- Nothing happens: check that `run()` was authorized (run once in editor).
- All items labeled `review`: add examples to your rules, increase `BODY_CHARS`.
- API errors: verify `GEMINI_API_KEY`, ensure Generative Language API is enabled.
- Vertex errors: ensure project is linked in Apps Script and use numeric project number if needed.
- View logs: set `DEBUG=true` and re-run.

## Knowledge Architecture (ADR-019)

The system uses a two-tier knowledge model to provide AI context efficiently and consistently:

### Knowledge Hierarchy

**1. Global Knowledge (Organization-Wide Context)**
- Configuration: `GLOBAL_KNOWLEDGE_FOLDER_URL` + `GLOBAL_KNOWLEDGE_MAX_DOCS`
- Applies to: ALL AI operations (categorization, summarization, reply drafting, future features)
- Fetched: Once per execution in `Main.gs`
- Contains: Team structure, projects, terminology, domain knowledge
- Injection order: FIRST (before feature-specific knowledge)
- Purpose: Eliminate duplication of organizational context

**2. Feature-Specific Knowledge (Task-Specific Instructions)**
- Configuration: Per-feature properties (e.g., `REPLY_DRAFTER_INSTRUCTIONS_URL`)
- Applies to: Individual AI features only
- Fetched: By each agent/feature as needed
- Contains: How to perform specific task (tone, style, examples)
- Injection order: SECOND (after global knowledge)
- Purpose: Customize behavior for specific AI operations

### Prompt Injection Order

All AI prompts follow this structure:
```
1. Base instructions (built-in system prompts)
2. GLOBAL KNOWLEDGE (organizational context - ADR-019)
3. Feature-specific knowledge (task instructions)
4. Task data (emails, threads, content to process)
```

### Example Configuration

**Global Knowledge Folder:**
```
Organization Context/
├── team-structure.gdoc      (engineering teams, reporting hierarchy)
├── project-phoenix.gdoc      (Q1 priority initiative context)
├── terminology.gdoc          (RFR = Ready for Review, P0 = critical)
└── domain-knowledge.gdoc     (company builds email AI tools)
```

**Feature-Specific Knowledge:**
```
LABEL_KNOWLEDGE_FOLDER_URL     (classification examples, edge cases)
REPLY_DRAFTER_INSTRUCTIONS_URL (tone: professional but warm)
REPLY_DRAFTER_KNOWLEDGE_FOLDER (example drafts, templates)
```

### When to Use Global vs. Feature-Specific Knowledge

**Use Global Knowledge For:**
- Organizational structure and teams
- Project context and priorities
- Company-specific terminology
- Domain/industry background
- Business processes common to all operations

**Use Feature-Specific Knowledge For:**
- How to classify emails (labeling methodology)
- Reply drafting tone and style
- Summary format preferences
- Task-specific examples and templates

### Implementation Pattern for Agents

**Fetch global knowledge in agent handlers:**
```javascript
function agentOnLabel_(ctx) {
  // 1. Fetch global knowledge (shared across all features)
  const cfg = getConfig_();
  const globalKnowledge = fetchGlobalKnowledge_({
    folderUrl: cfg.GLOBAL_KNOWLEDGE_FOLDER_URL,
    maxDocs: parseInt(cfg.GLOBAL_KNOWLEDGE_MAX_DOCS || '5')
  });

  // 2. Fetch agent-specific knowledge
  const agentKnowledge = fetchAgentKnowledge_({
    instructionsUrl: cfg.AGENT_INSTRUCTIONS_URL,
    knowledgeFolderUrl: cfg.AGENT_KNOWLEDGE_FOLDER_URL,
    maxDocs: parseInt(cfg.AGENT_KNOWLEDGE_MAX_DOCS || '5')
  });

  // 3. Build prompt with both (global injected first)
  const prompt = buildAgentPrompt_(ctx, agentKnowledge, globalKnowledge);

  // 4. Call AI service
  const result = callLLMService_(prompt);
}
```

### Token Budget Management

**Combined token utilization:**
- Global knowledge: Applies to ALL AI operations
- Feature knowledge: Applies to specific operation
- Total tokens: Global + Feature + Task data
- Warnings: Soft at 50% capacity, critical at 90%

**Best practices:**
- Keep global knowledge focused (10-20K tokens ideal)
- Use `GLOBAL_KNOWLEDGE_MAX_DOCS` to limit size
- Monitor utilization with `KNOWLEDGE_DEBUG=true`
- Reduce feature-specific knowledge if approaching limits

### Benefits of Global Knowledge Architecture

**Eliminates duplication:**
- Write organizational context once, use everywhere
- No need to duplicate in labeling, reply, and summary knowledge

**Consistency:**
- All AI operations share same understanding
- Update once, applies to all features

**Token efficiency:**
- Single fetch reduces Drive API quota usage
- Caching reduces repeat fetches (30-minute TTL)
- Reduces total token consumption vs. duplication

**Future-proof:**
- New AI features automatically inherit global knowledge
- No per-feature configuration for organizational context

## Extending the System
- Add rules examples to improve accuracy.
- Adjust label set by editing `ensureLabels_()` and normalization in `Categorizer.gs`.
- Modify `BATCH_SIZE` and `BODY_CHARS` to trade off cost vs. context.

## Writing Agents
Agents let you plug in post-label actions (e.g., create a draft for `reply_needed`, forward `todo` items elsewhere) without changing core triage code.

**IMPORTANT**: As of ADR-018, all agents must use the **dual-hook pattern** with `{ onLabel, postLabel }` registration. The old single-function registration is no longer supported.

### Self-Contained Agent Architecture with Dual Hooks

Self-contained agents manage their complete lifecycle independently, following ADR-011 and ADR-018 patterns:

#### Key Characteristics:
- **Configuration Management**: Agents define and handle their own configuration keys
- **Label Management**: Agents create and manage their own labels
- **Dual-Hook Pattern**: Agents implement onLabel (immediate) and/or postLabel (inbox scan) hooks
- **State Management**: Agents handle their own persistence and idempotency
- **Infrastructure Setup**: Agents ensure their required infrastructure exists
- **No Separate Triggers**: Most agents run via dual hooks in hourly trigger (ADR-018)

#### Agent Structure Template:
```javascript
// 1. Configuration Management (Self-Contained)
function getAgentConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    AGENT_ENABLED: (props.getProperty('AGENT_ENABLED') || 'true').toLowerCase() === 'true',
    AGENT_MAX_AGE_DAYS: parseInt(props.getProperty('AGENT_MAX_AGE_DAYS') || '7', 10),
    AGENT_DESTINATION: props.getProperty('AGENT_DESTINATION') || Session.getActiveUser().getEmail(),
    AGENT_DEBUG: (props.getProperty('AGENT_DEBUG') || 'false').toLowerCase() === 'true'
  };
}

// 2. Label Management (Self-Contained)
function ensureAgentLabels_() {
  const labelName = 'agent_processed';
  return GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
}

// 3. Dual-Hook Handlers (ADR-018)

// onLabel: Immediate per-email action (optional)
function agentOnLabel_(ctx) {
  try {
    const config = getAgentConfig_();
    if (!config.AGENT_ENABLED) {
      return { status: 'skip', info: 'agent disabled' };
    }

    // IMPORTANT: Fetch global knowledge if agent needs it (ADR-019)
    const cfg = getConfig_();
    const globalKnowledge = fetchGlobalKnowledge_({
      folderUrl: cfg.GLOBAL_KNOWLEDGE_FOLDER_URL,
      maxDocs: parseInt(cfg.GLOBAL_KNOWLEDGE_MAX_DOCS || '5')
    });

    // Fetch agent-specific knowledge
    const agentKnowledge = fetchAgentKnowledge_({...});

    // Pass both to prompt builder
    const prompt = buildAgentPrompt_(ctx, agentKnowledge, globalKnowledge);

    // Immediate action when email is labeled
    // Example: archive, forward, create draft, etc.
    return { status: 'ok', info: 'immediate action completed' };
  } catch (error) {
    return { status: 'error', info: error.toString() };
  }
}

// postLabel: Inbox-wide scan after labeling (optional)
function agentPostLabel_() {
  try {
    const config = getAgentConfig_();
    if (!config.AGENT_ENABLED) return;

    // IMPORTANT: Fetch global knowledge if agent needs it (ADR-019)
    const cfg = getConfig_();
    const globalKnowledge = fetchGlobalKnowledge_({
      folderUrl: cfg.GLOBAL_KNOWLEDGE_FOLDER_URL,
      maxDocs: parseInt(cfg.GLOBAL_KNOWLEDGE_MAX_DOCS || '5')
    });

    // Fetch agent-specific knowledge
    const agentKnowledge = fetchAgentKnowledge_({...});

    // Search inbox for all emails with target label
    const query = 'in:inbox label:target_label';
    const threads = GmailApp.search(query);

    // Process each thread
    threads.forEach(function(thread) {
      // Check idempotency before processing
      // Pass both global and agent knowledge to prompt builder
      const prompt = buildAgentPrompt_(thread, agentKnowledge, globalKnowledge);
      // Perform batch operations
    });

    Logger.log(`agentPostLabel: Processed ${threads.length} threads`);
  } catch (error) {
    Logger.log('agentPostLabel error: ' + error.toString());
  }
}

// 4. Scheduled Execution (Optional - for non-standard schedules only)
// NOTE: Most agents no longer need this - dual hooks run in hourly trigger
function runAgentScheduled() {
  // Only implement if you need separate schedule (e.g., daily instead of hourly)
  const config = getAgentConfig_();
  // Process emails, send notifications, etc.
}

// 5. Trigger Management (Optional - only if separate schedule needed)
function installAgentTrigger() {
  deleteAgentTriggers_();
  ScriptApp.newTrigger('runAgentScheduled')
    .timeBased()
    .everyDays(1)
    .atHour(5)
    .create();
}

function deleteAgentTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runAgentScheduled')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

// 6. Registration with Dual-Hook Pattern (REQUIRED)
if (typeof AGENT_MODULES === 'undefined') {
  AGENT_MODULES = [];
}

AGENT_MODULES.push(function(api) {
  api.register(
    'target_label',    // Label to trigger on
    'agentName',       // Unique agent name
    {
      onLabel: agentOnLabel_,     // Immediate per-email action (optional)
      postLabel: agentPostLabel_  // Inbox-wide scan (optional)
      // At least one hook must be provided
    },
    {
      runWhen: 'afterLabel',  // Run after labeling
      timeoutMs: 30000,       // Soft timeout guidance
      enabled: true           // Enabled by default
    }
  );
});
```

#### Generic Service Layer Integration

Self-contained agents should use generic service functions from `GmailService.gs` to avoid code duplication:

```javascript
// Find emails with specific label and age constraints
const emails = findEmailsByLabelWithAge_('target_label', 7, 50);

// Manage label transitions efficiently
const result = manageLabelTransition_(emailIds, ['old_label'], ['new_label']);

// Archive emails in batch
const archived = archiveEmailsByIds_(emailIds);

// Send formatted HTML emails
const sent = sendFormattedEmail_(destination, subject, htmlContent, sourceEmails);
```

### Hook Selection Guide

**When to implement onLabel:**
- Need immediate action when email is classified (forward, notify, create draft)
- Action should happen before user sees the labeled email
- Fast, per-email operations

**When to implement postLabel:**
- Need to catch manually-labeled emails
- Batch operations across all emails with label
- Cleanup or reconciliation tasks
- Retry failed operations

**When to implement both:**
- Need immediate action AND catch manual labels (recommended for action agents)
- Example: Reply Drafter creates drafts immediately + catches manual labels

**When to use separate scheduled trigger:**
- Need non-standard schedule (e.g., daily instead of hourly)
- Operations independent of email labeling cycle
- Example: Email Summarizer runs daily, not hourly

### Example: Email Summarizer Agent

The Email Summarizer (`src/AgentSummarizer.gs`) demonstrates the self-contained dual-hook pattern:

- **Independent Configuration**: Uses `SUMMARIZER_*` properties including `SUMMARIZER_ARCHIVE_ON_LABEL`
- **Label Management**: Creates and manages `summarized` label
- **onLabel Hook**: Archives emails immediately when `summarize` label is applied (configurable)
- **postLabel Hook**: Not implemented (set to null) - uses separate daily trigger instead
- **Scheduled Execution**: Runs daily via `runEmailSummarizer()` function (separate trigger for batch processing)
- **Trigger Management**: Self-manages triggers with `installSummarizerTrigger()`
- **Generic Services**: Uses `findEmailsByLabelWithAge_()`, `manageLabelTransition_()`, etc.
- **Dual-Hook Registration**: Registers with `AGENT_MODULES` pattern using `{ onLabel, postLabel: null }`

### Handler Contracts

#### onLabel Handler (Per-Email Actions)
The onLabel handler receives an `AgentContext` and returns an `AgentResult`.

**Context (`ctx`):**
- `label`: one of `reply_needed|review|todo|summarize`
- `decision`: `{ required_action, reason }` as decided by the model
- `threadId`: Gmail thread ID
- `thread`: `GmailThread` (already fetched)
- `cfg`: result of `getConfig_()` (includes `AGENTS_*` values)
- `dryRun`: boolean; mirrors `DRY_RUN`
- `log(msg)`: convenience logger that emits only when `DEBUG=true`

**Return (`AgentResult`):**
- `status`: `ok | skip | retry | error`
- `info?`: string for human-readable details
- `retryAfterMs?`: suggest a delay before retry (informational)

#### postLabel Handler (Inbox-Wide Scan)
The postLabel handler takes no parameters and returns nothing (void).

**Implementation:**
- Search inbox for emails with target label
- Implement own idempotency checks
- Process emails in batch
- Log results using `Logger.log()` or console.log()
- Handle errors internally (no return contract)

### Generic Service Functions

The generic service layer (ADR-012) provides reusable functions for common agent operations:

#### Email Finding and Filtering
```javascript
// Find emails by label with age and count constraints
function findEmailsByLabelWithAge_(labelName, maxAgeDays, maxCount)
// Returns: { success: boolean, emails: array, count: number, error?: string }
```

#### Label Management
```javascript
// Manage label transitions efficiently
function manageLabelTransition_(emailIds, removeLabels, addLabels)
// Returns: { success: boolean, processed: number, error?: string }
```

#### Email Operations
```javascript
// Archive emails in batch
function archiveEmailsByIds_(emailIds)
// Returns: { success: boolean, archived: number, error?: string }

// Send formatted HTML emails
function sendFormattedEmail_(to, subject, htmlContent, sourceEmails)
// Returns: { success: boolean, messageId?: string, error?: string }
```

These functions handle error cases, provide consistent logging, and optimize Gmail API usage patterns.

### Idempotency

**Important Change (ADR-017):** Framework-level idempotency tracking via UserProperties has been removed. Agents must implement their own application-level idempotency checks.

**onLabel Hook:**
- Check if work has already been done (e.g., draft exists, email forwarded)
- Return `{ status: 'skip', info: 'already processed' }` if idempotent

**postLabel Hook:**
- Check each thread before processing (e.g., look for processed label, draft exists)
- Skip already-processed threads to avoid duplicate work

**Example Idempotency Patterns:**
```javascript
// Check if draft exists
if (thread.getDrafts().length > 0) {
  return { status: 'skip', info: 'draft already exists' };
}

// Check for processed label
if (thread.getLabels().some(l => l.getName() === 'agent_processed')) {
  return { status: 'skip', info: 'already processed' };
}
```

### Dry-run behavior
- If `DRY_RUN=true`, onLabel hooks are skipped by default with `status: 'skip'`
- To force execution in dry-run (for testing), set `runWhen: 'always'` in the agent options
- Or set `AGENTS_DRY_RUN=false` in Script Properties to disable dry-run skipping for all agents
- postLabel hooks check agent-specific `AGENT_DRY_RUN` configuration

### Budgets and filters
- `AGENTS_BUDGET_PER_RUN` (default `50`): maximum agent executions per `run()`.
- `AGENTS_LABEL_MAP` (JSON): optional allowlist of agent names per label, e.g.:
  ```json
  { "todo": ["forwarder"], "reply_needed": ["draftReply"] }
  ```

### Observability
- `Organizer.apply_()` aggregates agent outcomes in the final summary: `{ agents: { ok, skip, retry, error } }`.
- Use `ctx.log('message')` to add per-agent debug logs gated by `DEBUG=true`.

## Code Pointers
- Configuration shape is defined in `getConfig_()`:
```text
/Users/gunnarhellekson/Code/email-agent/src/Config.gs
```
- Main orchestration:
```text
/Users/gunnarhellekson/Code/email-agent/src/Main.gs
```
- Label application:
```text
/Users/gunnarhellekson/Code/email-agent/src/Organizer.gs
```
- Model interaction & parsing:
```text
/Users/gunnarhellekson/Code/email-agent/src/LLMService.gs
/Users/gunnarhellekson/Code/email-agent/src/Categorizer.gs
```
- Knowledge management:
```text
/Users/gunnarhellekson/Code/email-agent/src/KnowledgeService.gs
```
- Generic service layer:
```text
/Users/gunnarhellekson/Code/email-agent/src/GmailService.gs
```
- Self-contained agent example:
```text
/Users/gunnarhellekson/Code/email-agent/src/AgentSummarizer.gs
```
- Agent template and patterns:
```text
/Users/gunnarhellekson/Code/email-agent/src/AgentTemplate.gs
```

## Security & Permissions
- Scopes required: Gmail modify, Drive read-only, external requests, script runtime, cloud-platform.
- The script uses Script Properties for configuration and agent state management.

## Versioning & Releases

### Multi-Account Deployment
```bash
# Deploy to specific account (complete deployment: code + web app + triggers)
npm run deploy:personal
npm run deploy:work

# Deploy to all accounts
npm run deploy:all              # Batch deployment with confirmation

# Account-specific operations
npm run logs:personal           # View execution logs
npm run status:personal         # Check account status
```

### Validation and Troubleshooting
```bash
npm run validate:accounts       # Validate multi-account configuration
npm run switch:status          # Show all account statuses
npm run auth:help              # Authentication guidance
```

### Legacy Single Account Commands
```bash
npm run version:stable         # Create timestamped version
npm run deploy:all             # Deploy complete system (if using legacy setup)
npm run deploy:webapp          # Deploy web app only (if using legacy setup)
```

## Notes
- Keep `DEBUG` off in regular runs to reduce log volume.
- Prefer API key mode unless your organization requires Vertex.
