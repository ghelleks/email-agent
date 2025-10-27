# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Architectural Constraints

- Always obey the decisions recorded in the Architecture Design Records directory (docs/adr). The user must approve any violations of these rules or decisions.
- This is a Google Apps Script project using the V8 runtime with clasp for local development
- All source code resides in the `src/` directory and uses `.gs` extensions for Google Apps Script files
- The system follows a pluggable agent architecture defined in ADR-004, with enhanced self-contained agent patterns (ADR-011)
- Generic service layer pattern (ADR-012) provides reusable functions for agent development

## Development Commands

### Account Setup and Management
```bash
# Initial Setup
npm run setup:account               # Interactive account configuration wizard
npm run switch:create-project-files  # Create project files for all accounts
npm run validate:accounts           # Validate account configuration
npm run auth:help                   # Show authentication guidance

# Status and Information
npm run switch:status               # Show all account statuses
```

### Deployment Operations (Streamlined)
```bash
# Core Deployment Commands (Push + Web App + Triggers)
npm run deploy:personal             # Complete deployment to personal account
npm run deploy:work                 # Complete deployment to work account
npm run deploy:all                  # Deploy to all configured accounts

# Monitoring and Logs
npm run logs:personal               # View execution logs from personal account
npm run logs:work                   # View execution logs from work account
npm run status:personal             # Check status of personal account
npm run status:work                 # Check status of work account

# Apps Script Editor Access
npm run open:personal               # Open Apps Script editor for personal account
npm run open:work                   # Open Apps Script editor for work account

# Web App URL Retrieval
npm run url:personal                # Get web app URL for personal account
npm run url:work                    # Get web app URL for work account
npm run url:all                     # Get web app URLs for all accounts
```

### Multi-Account Operations
```bash
# Batch Operations (All Accounts)
npm run status:all                  # Show status for all configured accounts
```

### Account Setup Process

#### First-Time Setup
1. **Account Configuration**: Run `npm run setup:account` to configure accounts
2. **Authentication**: Log into each account with `clasp --user [account] login`
3. **Project Files**: Run `npm run switch:create-project-files` to create clasp project files
4. **Validation**: Run `npm run validate:accounts` to verify setup
5. **Deploy**: Use `npm run deploy:[account]` for complete deployment

#### Account Configuration Format
The system uses `accounts.json` to manage multiple Google Apps Script deployments:
```json
{
  "defaultAccount": "work",
  "accounts": {
    "work": {
      "scriptId": "1Yyl2UjvQOBKxT1J6OXPzR0q5bpRBdLuE7MUgTuVdV7uUtdltIxQyQBK-",
      "description": "Red Hat",
      "webAppDeploymentId": "AKfycbx1L7phZrDzB699TRLDhSb5PCLbufYiGXcRU9ZPz2A"
    },
    "personal": {
      "scriptId": "1JvaGS8HDHIJoebhjY_2bQjUx0Tx2XVyHSJkaA5gV7_MEUWBixuRsHPno",
      "description": "Personal Gmail Account",
      "webAppDeploymentId": "AKfycbxH3nXXSOQ1teErs4nA8uojO2AI_qVLIeVY8HLHkkBv"
    }
  }
}
```

**Note**: The `webAppDeploymentId` field is automatically managed by the deployment script to maintain consistent web app URLs.

#### Authentication Requirements
Each account requires separate authentication:
```bash
clasp --user personal login    # Log into personal account
clasp --user work login        # Log into work account
```

#### Trigger Installation
**Important**: Automated trigger installation via `clasp run` is unreliable due to permission issues. Triggers must be installed manually:

1. Use `npm run open:personal` or `npm run open:work` to open Apps Script editor
2. Select trigger installation function from the dropdown:
   - `installTrigger` - Core email labeling trigger (hourly) - **Required**
   - `installSummarizerTrigger` - Email Summarizer trigger (daily) - Optional, only if using Email Summarizer
3. Click the Run button to install triggers
4. Grant necessary permissions when prompted

**Note**: The Reply Drafter no longer requires a separate trigger. It runs automatically as part of the hourly email processing via the dual-hook architecture (onLabel + postLabel).

The `deploy:[account]` commands attempt automated trigger installation but may fail on the `clasp run` portion.

#### Deployment Strategy Guide
- **Complete deployment**: Use `npm run deploy:[account]` for full system deployment (code + web app + triggers)
- **All accounts**: Use `npm run deploy:all` for batch deployment to all configured accounts
- **The deployment script uses --force flag** to prevent "skipping push" issues
- **Smart web app deployment**: Maintains consistent URLs by redeploying to existing deployments rather than creating new ones

## Architecture Overview

### Core Components
- **Main.gs**: Entry point that orchestrates the email processing pipeline + web app URL utilities
- **Organizer.gs**: Applies categorization results and manages Gmail labels
- **LLMService.gs**: Handles Gemini AI integration with dual authentication (API key or Vertex AI)
- **KnowledgeService.gs**: Unified knowledge management for fetching Google Drive documents and injecting into AI prompts
- **PromptBuilder.gs**: Core email classification prompt (`buildCategorizePrompt_()`) - agents build their own prompts (ADR-022)
- **Agents.gs**: Pluggable agent system for extensible email processing
- **GmailService.gs**: Gmail API operations, thread management, and generic service functions
- **Config.gs**: Configuration management using Apps Script Properties
- **WebAppController.gs**: Web app entry point and API orchestration for interactive dashboard
- **WebApp.html**: Mobile-optimized HTML interface for on-demand email summarization
- **AgentReplyDrafter.gs**: Self-contained Reply Drafter agent with own prompt building (`buildReplyDraftPrompt_()`)
- **AgentSummarizer.gs**: Self-contained Email Summarizer agent with own prompt building (`buildSummaryPrompt_()`)
- **AgentTodoForwarder.gs**: Self-contained Todo Forwarder agent for automated todo email forwarding
- **AgentTemplate.gs**: Enhanced agent template demonstrating self-contained patterns

### Data Flow
1. `findUnprocessed_()` identifies unlabeled email threads
2. `minimalize_()` extracts relevant content within character limits
3. `categorizeWithGemini_()` sends emails to AI for classification
4. `Organizer.apply_()` applies labels based on AI results
5. Native Google API quota management prevents overruns (monitor at Google Cloud Console)

### Configuration System
Configuration uses Apps Script Script Properties accessible via the Apps Script editor:

#### Core Email Processing
- `GEMINI_API_KEY`: Gemini API authentication (API key mode)
- `PROJECT_ID`: Google Cloud project for Vertex AI (Vertex mode)
- `DRY_RUN`: Test mode that analyzes without applying labels
- `DEBUG`: Enables verbose logging
- `MAX_EMAILS_PER_RUN`: Limits emails processed per execution (default: 20)
- `BATCH_SIZE`: Number of emails sent to AI in one request (default: 10)

#### Web App Configuration
- `WEBAPP_ENABLED`: Enable/disable web app functionality (default: true)
- `WEBAPP_MAX_EMAILS_PER_SUMMARY`: Maximum emails to process in web app per summary (default: 25)

#### Reply Drafter Agent Configuration
**Note**: Reply Drafter configuration is managed in `AgentReplyDrafter.gs` via `getReplyDrafterConfig_()` function (ADR-014), not in core `Config.gs`. The agent follows the self-contained architecture pattern.

The Reply Drafter uses the **dual-hook pattern** to ensure comprehensive draft coverage:
1. **onLabel Hook**: Runs during email classification (immediate draft creation for newly-classified emails)
2. **postLabel Hook**: Runs after labeling complete (catches manually-labeled `reply_needed` emails)

This dual-hook architecture ensures drafts are created for both newly-classified emails and manually-labeled emails, all within the hourly email processing cycle. **No separate trigger required.**

- `REPLY_DRAFTER_ENABLED`: Enable/disable Reply Drafter agent (default: true)
- `REPLY_DRAFTER_INSTRUCTIONS_URL`: Google Docs URL with drafting style/methodology (optional)
- `REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL`: Google Drive folder URL with contextual examples (optional, ADR-015)
- `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS`: Maximum documents to fetch from knowledge folder (default: 5, ADR-015)
- `REPLY_DRAFTER_DEBUG`: Enable detailed logging for the agent (default: false)
- `REPLY_DRAFTER_DRY_RUN`: Test mode for the agent (default: false)

#### Email Summarizer Agent Configuration

**Core Configuration:**
- `SUMMARIZER_ENABLED`: Enable/disable Email Summarizer agent (default: true)
- `SUMMARIZER_MAX_AGE_DAYS`: Maximum age of emails to include in summaries (default: 7)
- `SUMMARIZER_MAX_EMAILS_PER_SUMMARY`: Maximum emails to process per summary (default: 50)
- `SUMMARIZER_DESTINATION_EMAIL`: Email address to receive summaries (default: user's email)
- `SUMMARIZER_ARCHIVE_ON_LABEL`: Enable/disable immediate archiving when 'summarize' label is applied (default: true)
- `SUMMARIZER_DEBUG`: Enable detailed logging for the agent (default: false)
- `SUMMARIZER_DRY_RUN`: Test mode for the agent (default: false)

**Custom Label Support (Issue #46):**
- `SUMMARIZER_CUSTOM_LABELS`: Comma-separated list of additional labels to summarize (e.g., "Project1,Init2,Foo")
- `MARK_CUSTOM_LABELS_AS_READ`: Mark custom label emails as read after summarization (default: false)
- `CUSTOM_SUMMARIZER_ARCHIVE_ON_LABEL`: Archive custom label emails after summarization (default: false)

**Behavior Differences:**
- **Default 'summarize' label**: Removes label after processing, always archives, uses `SUMMARIZER_ARCHIVE_ON_LABEL`
- **Custom labels**: Preserves original label, adds 'summarized' label, respects `MARK_CUSTOM_LABELS_AS_READ` and `CUSTOM_SUMMARIZER_ARCHIVE_ON_LABEL`
- **Separate summaries**: Each custom label generates its own daily summary email with subject like "Email Summary [Project1] - YYYY-MM-DD"

**Example Configuration:**
```javascript
// In Apps Script Properties:
SUMMARIZER_CUSTOM_LABELS=Project1,Init2,Foo
MARK_CUSTOM_LABELS_AS_READ=true
CUSTOM_SUMMARIZER_ARCHIVE_ON_LABEL=false

// This generates 4 separate daily summary emails:
// 1. "Email Summary - YYYY-MM-DD" (default 'summarize' label)
// 2. "Email Summary [Project1] - YYYY-MM-DD"
// 3. "Email Summary [Init2] - YYYY-MM-DD"
// 4. "Email Summary [Foo] - YYYY-MM-DD"
```

#### Todo Forwarder Agent Configuration
**Note**: Todo Forwarder configuration is managed in `AgentTodoForwarder.gs` via `getTodoForwarderConfig_()` function, following the self-contained architecture pattern.

The Todo Forwarder uses the **dual-hook pattern** to ensure comprehensive forwarding coverage:
1. **onLabel Hook**: Runs during email classification (immediate forwarding for newly-classified emails)
2. **postLabel Hook**: Runs after labeling complete (catches manually-labeled `todo` emails)

This dual-hook architecture ensures todos are forwarded for both newly-classified emails and manually-labeled emails, all within the hourly email processing cycle. **No separate trigger required.**

- `TODO_FORWARDER_ENABLED`: Enable/disable Todo Forwarder agent (default: true)
- `TODO_FORWARDER_EMAIL`: Email address to forward todos to (required - agent disabled if not set)
- `TODO_FORWARDER_DEBUG`: Enable detailed logging for the agent (default: false)
- `TODO_FORWARDER_DRY_RUN`: Test mode for the agent (default: false)

**Archive-Based Idempotency:**
- Successfully forwarded emails are **automatically archived** (with `todo` label preserved)
- Failed forwards remain **in inbox** for automatic retry on next hourly run
- Only processes emails with `todo` label that are **IN THE INBOX**
- No additional labels needed - archive status indicates "already forwarded"

#### KnowledgeService Configuration
The KnowledgeService provides unified knowledge management for AI prompts by fetching Google Drive documents.

**Core Configuration:**
- `KNOWLEDGE_CACHE_DURATION_MINUTES`: Cache duration for fetched documents (default: 30)
- `KNOWLEDGE_DEBUG`: Enable detailed logging for document fetching (default: false)
- `KNOWLEDGE_LOG_SIZE_WARNINGS`: Enable soft warnings at 50% and 90% of model token capacity (default: true)

**Global Knowledge** (applies to ALL AI operations - ADR-019):
- `GLOBAL_KNOWLEDGE_FOLDER_URL`: Organization-wide context folder shared across all AI features (Google Drive folder URL or ID, optional)
- `GLOBAL_KNOWLEDGE_MAX_DOCS`: Maximum documents to fetch from global knowledge folder (default: 5)

**Email Labeling Knowledge:**
- `LABEL_KNOWLEDGE_DOC_URL`: Single document with core labeling rules (Google Docs URL or ID)
- `LABEL_KNOWLEDGE_FOLDER_URL`: Folder with additional context documents (Google Drive folder URL or ID)
- `LABEL_KNOWLEDGE_MAX_DOCS`: Maximum documents to fetch from folder (default: 5)

**Reply Drafting Knowledge** (managed by AgentReplyDrafter.gs):
- `REPLY_DRAFTER_INSTRUCTIONS_URL`: Document with drafting style/guidelines (Google Docs URL or ID)
- `REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL`: Folder with knowledge documents (Google Drive folder URL or ID, ADR-015)
- `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS`: Maximum documents from folder (default: 5, ADR-015)

**Legacy Configuration** (deprecated):
- `RULE_DOC_URL`: Old email labeling rules document (use `LABEL_KNOWLEDGE_DOC_URL` instead)
- `RULE_DOC_ID`: Old email labeling rules document (use `LABEL_KNOWLEDGE_DOC_URL` instead)

## Development Patterns

### Adding New Agent Modules
The system uses a **dual-hook agent architecture** where agents can implement two types of hooks:

#### Dual-Hook Pattern (REQUIRED - Breaking Change)
**All agents must now register using the dual-hook pattern:**

1. Create agent file (e.g., `AgentMyFeature.gs`) with self-contained architecture
2. Implement configuration management with agent-specific property keys
3. Handle label creation and management within the agent (if needed)
4. **Build agent-specific AI prompts** within the agent file (ADR-022)
5. Implement hook functions:
   - **onLabel**: Immediate per-email actions during classification (optional)
   - **postLabel**: Inbox-wide scan after all labeling complete (optional)
   - At least one hook MUST be provided
6. Use generic service functions from `GmailService.gs` for common operations
7. **Self-register with `AGENT_MODULES.push()` pattern** - no core system changes needed

**Dual-Hook Registration Pattern**:
```javascript
// At the end of your agent file (e.g., AgentReplyDrafter.gs)
if (typeof AGENT_MODULES === 'undefined') {
  AGENT_MODULES = [];
}

AGENT_MODULES.push(function(api) {
  api.register(
    'label_name',           // Label to trigger on
    'AgentName',            // Agent name for logging
    {
      onLabel: onLabelHandler_,     // Immediate per-email action (optional)
      postLabel: postLabelHandler_  // Inbox-wide scan (optional)
    },
    {
      runWhen: 'afterLabel', // Run after labeling (respects dry-run)
      timeoutMs: 30000,      // Soft timeout guidance
      enabled: true          // Enabled by default
    }
  );
});
```

**Hook Selection Guide**:
- **onLabel only**: Immediate actions on newly-classified emails (e.g., forward, notify)
- **postLabel only**: Periodic inbox scanning without immediate response (e.g., cleanup)
- **Both hooks**: Immediate action + catch manually-labeled emails (e.g., Reply Drafter)

**Hook Execution Timing**:
- **onLabel**: Runs during `Organizer.apply_()` for each email being labeled
- **postLabel**: Runs via `Agents.runPostLabelHandlers()` after all labeling complete

**Examples of Dual-Hook Agents**:
- **AgentReplyDrafter.gs**: onLabel (immediate draft) + postLabel (catch manual labels)
- **AgentSummarizer.gs**: onLabel (archive on label) + postLabel (null - uses scheduled trigger instead)
- **AgentTodoForwarder.gs**: onLabel (immediate forward) + postLabel (catch manual labels)

**IMPORTANT**: The old single-function registration pattern is NO LONGER SUPPORTED. All agents must migrate to dual-hook pattern.

#### Generic Service Layer (ADR-012)
Use these functions for common operations:
- `findEmailsByLabelWithAge_()`: Find emails with label and age constraints
- `manageLabelTransition_()`: Efficient label management
- `archiveEmailsByIds_()`: Batch email archiving
- `sendFormattedEmail_()`: Send formatted HTML emails

#### Agent-Owned Prompt Building (ADR-022)

Agents that use AI **must build their own prompts** within the agent file. This ensures complete self-containment and independent evolution.

**Standard Prompt Building Pattern:**
```javascript
// Agent-owned prompt builder (in agent file, e.g., AgentReplyDrafter.gs)
function buildAgentPrompt_(taskData, agentKnowledge, globalKnowledge) {
  const parts = ['Base agent instructions...'];

  // 1. GLOBAL KNOWLEDGE INJECTION (organizational context - applies to ALL AI)
  if (globalKnowledge && globalKnowledge.configured) {
    parts.push('');
    parts.push('=== GLOBAL KNOWLEDGE ===');
    parts.push(globalKnowledge.knowledge);
  }

  // 2. AGENT-SPECIFIC KNOWLEDGE INJECTION (how to perform this task)
  if (agentKnowledge && agentKnowledge.configured) {
    parts.push('');
    parts.push('=== AGENT INSTRUCTIONS ===');
    parts.push(agentKnowledge.knowledge);
  }

  // 3. TASK DATA INJECTION (emails, threads, content to process)
  parts.push('');
  parts.push('=== TASK DATA ===');
  parts.push(formatTaskData_(taskData));

  return parts.join('\n');
}
```

**Knowledge Injection Order (Always):**
1. Base instructions (built into prompt)
2. Global knowledge (organizational context from `GLOBAL_KNOWLEDGE_FOLDER_URL`)
3. Agent-specific knowledge (task instructions from agent config)
4. Task data (emails, threads, content)

**Agent Workflow with Prompt Building:**
```javascript
function agentOnLabel_(ctx) {
  // 1. Fetch global knowledge (shared across ALL AI operations)
  const cfg = getConfig_();
  const globalKnowledge = fetchGlobalKnowledge_({
    folderUrl: cfg.GLOBAL_KNOWLEDGE_FOLDER_URL,
    maxDocs: parseInt(cfg.GLOBAL_KNOWLEDGE_MAX_DOCS || '5')
  });

  // 2. Fetch agent-specific knowledge
  const agentConfig = getAgentConfig_();
  const agentKnowledge = fetchAgentKnowledge_({
    instructionsUrl: agentConfig.AGENT_INSTRUCTIONS_URL,
    knowledgeFolderUrl: agentConfig.AGENT_KNOWLEDGE_FOLDER_URL,
    maxDocs: agentConfig.AGENT_KNOWLEDGE_MAX_DOCS
  });

  // 3. Build prompt using agent-owned function
  const prompt = buildAgentPrompt_(taskData, agentKnowledge, globalKnowledge);

  // 4. Call LLM service with pre-built prompt
  const result = callLLMService_(prompt, model, ...);
}
```

**Why Agents Own Their Prompts:**
- **Complete self-containment**: Agent manages config + labels + prompts + logic
- **Independent evolution**: Change prompts without touching core system
- **Clear ownership**: Agent file is single source of truth
- **Simpler core**: `PromptBuilder.gs` only contains core classification prompt

**Core vs. Agent Prompts:**
- **Core (`PromptBuilder.gs`)**: `buildCategorizePrompt_()` for email classification
- **Reply Drafter**: `buildReplyDraftPrompt_()` in `AgentReplyDrafter.gs`
- **Email Summarizer**: `buildSummaryPrompt_()` in `AgentSummarizer.gs`
- **Your Agent**: `buildYourAgentPrompt_()` in `AgentYourFeature.gs`

### KnowledgeService: Unified Knowledge Management

The KnowledgeService provides centralized knowledge management for AI-powered features by fetching Google Drive documents and injecting them into prompts.

#### Key Features

**No Artificial Limits:**
- Trusts Gemini's 1M token capacity (~750K words)
- No hard character limits on knowledge documents
- Soft warnings at 50% and 90% of model capacity
- Token utilization transparency in all metadata responses

**Smart Caching:**
- Apps Script Cache Service with 30-minute TTL (configurable)
- Individual document caching reduces Drive API quota usage
- Automatic cache invalidation for fresh data
- Bypass cache with `skipCache` option when needed

**Fail-Fast Error Handling:**
- If knowledge not configured: gracefully proceed without it
- If knowledge configured but inaccessible: throw actionable error with remediation steps
- No silent fallbacks - explicit configuration means explicit intent

**Token Transparency:**
- Every response includes token estimates and utilization percentage
- Metadata shows model capacity and current usage
- Debug logging shows token counts and content previews

**Global Knowledge Architecture (ADR-019):**
- Organization-wide context shared across ALL AI operations
- Fetched once per execution, passed to all prompt builders
- Injected BEFORE feature-specific knowledge in prompts
- Eliminates duplication of organizational context
- Optional configuration (fully backward compatible)

#### Core Functions

**Single Document Fetching:**
```javascript
const knowledge = fetchDocument_(docIdOrUrl, {
  propertyName: 'LABEL_KNOWLEDGE_DOC_URL',  // For error messages
  skipCache: false                           // Optional: bypass cache
});

// Returns:
// {
//   configured: true,
//   knowledge: "document content...",
//   metadata: {
//     chars: 5432,
//     estimatedTokens: 1358,
//     source: { name: "My Rules", url: "https://..." }
//   }
// }
```

**Folder Fetching (Multiple Documents):**
```javascript
const knowledge = fetchFolder_(folderIdOrUrl, {
  propertyName: 'LABEL_KNOWLEDGE_FOLDER_URL',
  maxDocs: 5,                                 // Limit documents fetched
  skipCache: false
});

// Returns:
// {
//   configured: true,
//   knowledge: "=== Doc1 ===\ncontent...\n\n=== Doc2 ===\ncontent...",
//   metadata: {
//     docCount: 3,
//     totalChars: 12000,
//     estimatedTokens: 3000,
//     modelLimit: 1048576,
//     utilizationPercent: "0.3%",
//     sources: [
//       { name: "Doc1", chars: 4000, url: "https://..." },
//       { name: "Doc2", chars: 8000, url: "https://..." }
//     ]
//   }
// }
```

**High-Level Knowledge Fetchers:**
```javascript
// Global knowledge (applies to ALL AI operations - ADR-019)
const globalKnowledge = fetchGlobalKnowledge_({
  folderUrl: cfg.GLOBAL_KNOWLEDGE_FOLDER_URL,
  maxDocs: parseInt(cfg.GLOBAL_KNOWLEDGE_MAX_DOCS || '5')
});

// Email labeling knowledge (combines doc + folder)
const labelKnowledge = fetchLabelingKnowledge_({
  docUrl: cfg.LABEL_KNOWLEDGE_DOC_URL,
  folderUrl: cfg.LABEL_KNOWLEDGE_FOLDER_URL,
  maxDocs: parseInt(cfg.LABEL_KNOWLEDGE_MAX_DOCS || '5')
});

// Reply drafting knowledge (used by AgentReplyDrafter.gs)
const replyKnowledge = fetchReplyKnowledge_({
  instructionsUrl: cfg.REPLY_DRAFTER_INSTRUCTIONS_URL,
  knowledgeFolderUrl: cfg.REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL,  // ADR-015 naming
  maxDocs: parseInt(cfg.REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS || '5')  // ADR-015 naming
});
```

#### Usage Examples

**Example 0: Global Knowledge Configuration (ADR-019)**
```javascript
// In Apps Script Properties:
// GLOBAL_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/global123
// GLOBAL_KNOWLEDGE_MAX_DOCS = 10

const cfg = getConfig_();
const globalKnowledge = fetchGlobalKnowledge_({
  folderUrl: cfg.GLOBAL_KNOWLEDGE_FOLDER_URL,
  maxDocs: parseInt(cfg.GLOBAL_KNOWLEDGE_MAX_DOCS || '5')
});

if (globalKnowledge.configured) {
  // Global knowledge automatically injected into ALL AI prompts
  // Contains: team structure, projects, terminology, domain knowledge
  console.log(`Loaded ${globalKnowledge.metadata.docCount} global documents`);
  console.log(`Total: ${globalKnowledge.metadata.estimatedTokens} tokens`);

  // Pass to ALL prompt builders (categorization, summarization, reply drafting)
  const prompt = buildReplyDraftPrompt_(emailThread, replyKnowledge, globalKnowledge);
}

// Not configured: all AI operations proceed without global knowledge
```

**Example 1: Single Document Configuration**
```javascript
// In Apps Script Properties:
// LABEL_KNOWLEDGE_DOC_URL = https://docs.google.com/document/d/abc123/edit

const cfg = getConfig_();
const knowledge = fetchLabelingKnowledge_({
  docUrl: cfg.LABEL_KNOWLEDGE_DOC_URL,
  folderUrl: null
});

if (knowledge.configured) {
  // Use knowledge.knowledge in AI prompt
  console.log(`Loaded ${knowledge.metadata.estimatedTokens} tokens`);
  console.log(`Utilization: ${knowledge.metadata.utilizationPercent}`);
}
```

**Example 2: Folder Configuration**
```javascript
// In Apps Script Properties:
// LABEL_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/xyz789
// LABEL_KNOWLEDGE_MAX_DOCS = 10

const cfg = getConfig_();
const knowledge = fetchLabelingKnowledge_({
  docUrl: null,
  folderUrl: cfg.LABEL_KNOWLEDGE_FOLDER_URL,
  maxDocs: parseInt(cfg.LABEL_KNOWLEDGE_MAX_DOCS || '5')
});

if (knowledge.configured) {
  console.log(`Loaded ${knowledge.metadata.docCount} documents`);
  console.log(`Total: ${knowledge.metadata.estimatedTokens} tokens`);
  knowledge.metadata.sources.forEach(src => {
    console.log(`  - ${src.name}: ${src.chars} chars`);
  });
}
```

**Example 3: Combined Document + Folder**
```javascript
// In Apps Script Properties:
// LABEL_KNOWLEDGE_DOC_URL = https://docs.google.com/document/d/abc123/edit
// LABEL_KNOWLEDGE_FOLDER_URL = https://drive.google.com/drive/folders/xyz789
// LABEL_KNOWLEDGE_MAX_DOCS = 5

const cfg = getConfig_();
const knowledge = fetchLabelingKnowledge_({
  docUrl: cfg.LABEL_KNOWLEDGE_DOC_URL,
  folderUrl: cfg.LABEL_KNOWLEDGE_FOLDER_URL,
  maxDocs: parseInt(cfg.LABEL_KNOWLEDGE_MAX_DOCS || '5')
});

// Document content appears first, then folder contents
// Metadata aggregates both sources
```

**Example 4: Not Configured (Graceful Degradation)**
```javascript
// No LABEL_KNOWLEDGE_DOC_URL or LABEL_KNOWLEDGE_FOLDER_URL configured

const knowledge = fetchLabelingKnowledge_({
  docUrl: null,
  folderUrl: null
});

console.log(knowledge.configured);  // false
// AI proceeds without additional knowledge, uses only built-in instructions
```

**Example 5: Error Handling**
```javascript
try {
  const knowledge = fetchDocument_('invalid-doc-id', {
    propertyName: 'LABEL_KNOWLEDGE_DOC_URL'
  });
} catch (e) {
  // Error message includes:
  // - What failed (document ID)
  // - Why it failed (permissions, not found)
  // - Configuration property name
  // - Remediation steps ("remove this property to proceed without knowledge")
  console.error(e.message);
}
```

#### Token Warning System

The KnowledgeService automatically logs warnings when knowledge size approaches model limits:

**Soft Warning (50-90% capacity):**
```
⚠️  Knowledge size warning: ~524288 tokens (50.0% of model capacity).
Approaching model limit of 1048576 tokens.
```

**Critical Warning (>90% capacity):**
```
🚨 Knowledge size critical: ~943718 tokens (90.0% of model capacity).
Request may fail. Strongly recommend reducing knowledge documents
by lowering KNOWLEDGE_MAX_DOCS or removing some documents.
```

To disable warnings, set `KNOWLEDGE_LOG_SIZE_WARNINGS=false` in Script Properties.

### Classification Labels
The system uses exactly four core labels (ADR-003):
- `reply_needed`: Emails requiring personal response
- `review`: Informational emails to read
- `todo`: Action items and tasks
- `summarize`: Long emails that are processed by the Email Summarizer agent

#### Agent-Managed Labels
Self-contained agents may create and manage additional labels:
- `summarized`: Emails processed by the Email Summarizer agent (archived)
- Custom agent labels as needed (agents manage their own label lifecycle)

**Note**: The Todo Forwarder agent no longer creates additional labels - it uses archive status for idempotency tracking.

**Note**: The Reply Drafter agent does not create additional labels - it operates solely on emails labeled `reply_needed` by the core classification system.

### Error Handling
- All configuration errors should be descriptive and actionable
- Use `cfg.DEBUG` for detailed logging during development
- Quota management handled by Google Cloud Console (see monitoring section below)

### Google Drive Integration

The KnowledgeService provides unified knowledge management for AI prompts:
- Configure `LABEL_INSTRUCTIONS_DOC_URL` for single document with core labeling instructions
- Configure `LABEL_KNOWLEDGE_FOLDER_URL` for folder with multiple context documents
- Both document and folder can be used together (document appears first in combined knowledge)
- Supports both Google Docs URLs and document/folder IDs
- Smart caching reduces Drive API quota usage
- Token transparency shows utilization percentage
- Fail-fast errors with actionable remediation steps

## Key Architectural Decisions

Refer to `docs/adr/` for complete context:
- **ADR-001**: Google Apps Script chosen for serverless Gmail automation
- **ADR-002**: Gemini API integration with dual authentication modes
- **ADR-003**: Four-label classification system for simplicity
- **ADR-004**: Pluggable agent architecture for extensibility
- **ADR-005**: Batch processing with budget management (superseded by ADR-021 - native quota management)
- **ADR-006**: Support for both API key and Vertex AI authentication
- **ADR-007**: Google Drive document integration for classification rules
- **ADR-011**: Self-contained agent architecture for independent modules
- **ADR-012**: Generic service layer pattern for reusable agent operations
- **ADR-019**: Global knowledge folder for organization-wide context shared across all AI features
- **ADR-021**: Removed internal budget system - quota management via Google Cloud Console
- **ADR-022**: Agent-owned prompt building for complete self-containment

## Testing and Debugging

### Local Development
- Use `npm run deploy:[account]` after any code changes (includes push with --force flag)
- Enable `DEBUG=true` in Script Properties for verbose logging
- Use `DRY_RUN=true` to test classification without applying labels
- The deployment script automatically handles web app URL consistency

### Monitoring
- Check execution logs via `npm run logs:[account]` or Apps Script editor
- Monitor API quotas at Google Cloud Console: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
- Verify label application in Gmail after test runs

### Common Debugging Steps
1. Check Script Properties configuration in Apps Script editor
2. Verify Gemini API key or Google Cloud project permissions
3. Review execution logs for detailed error messages
4. Test with small `MAX_EMAILS_PER_RUN` values during development

### Running Functions Manually in Apps Script Editor

**IMPORTANT**: To run any function manually in the Apps Script editor, you must first **select the file containing that function** in the left sidebar. The function dropdown at the top only shows functions from the currently open file.

**Common Functions and Their Files:**
- `runEmailSummarizer` → Open **`AgentSummarizer.gs`**
- `installTrigger` → Open **`Main.gs`**
- `installSummarizerTrigger` → Open **`AgentSummarizer.gs`**
- `processEmail` → Open **`Main.gs`**
- `doGet` / `doPost` → Open **`WebAppController.gs`**

**Steps to Run a Function:**
1. Click on the appropriate `.gs` file in the left sidebar (Files section)
2. Select the function from the dropdown at the top of the editor
3. Click the Run button (▶️) to execute
4. View logs in the Execution log panel (bottom) or Executions view (clock icon in sidebar)

### Multi-Account Troubleshooting

**🔍 Problem**: `accounts.json not found` error
- **Solution**: Run `npm run setup:account` to create initial configuration
- **Solution**: Ensure you're running commands from the project root directory

**🔍 Problem**: `Invalid script ID` error
- **Solution**: Verify Script IDs in `accounts.json` are correct (57+ characters)
- **Solution**: Get Script ID from Apps Script editor URL: `script.google.com/.../{SCRIPT_ID}/edit`

**🔍 Problem**: `clasp login` required for specific account
- **Solution**: Each Google account needs separate authentication: `clasp --user [account] login`
- **Solution**: Use `clasp --user [account] login --no-localhost` if having browser issues

**🔍 Problem**: `.clasp.json.[account]` file not found
- **Solution**: Run `npm run switch:create-project-files` to create project files
- **Solution**: Ensure account name in `accounts.json` matches the file suffix

**🔍 Problem**: Trigger installation fails
- **Solution**: Install triggers manually in Apps Script editor
  - Core labeling: `installTrigger` function (required)
  - Email Summarizer: `installSummarizerTrigger` function (optional)
- **Solution**: Automated `clasp run` trigger installation is unreliable due to permissions
- **Note**: Reply Drafter no longer needs separate trigger (uses dual-hook pattern)

**🔍 Problem**: Reply Drafter not creating drafts
- **Solution**: Verify `REPLY_DRAFTER_ENABLED=true` in Script Properties
- **Solution**: Check that emails have `reply_needed` label applied by core classification
- **Solution**: Verify core email labeling trigger (`installTrigger`) is installed and running hourly
- **Solution**: Enable `REPLY_DRAFTER_DEBUG=true` for detailed logging
- **Solution**: Test with `REPLY_DRAFTER_DRY_RUN=true` to verify agent runs without draft creation
- **Solution**: Check execution logs for both onLabel and postLabel handler execution
- **Solution**: For manually labeled emails, postLabel hook will process them on next hourly run

**🔍 Problem**: Email Summarizer not working
- **Solution**: Verify `SUMMARIZER_ENABLED=true` in Script Properties
- **Solution**: Install summarizer trigger with `installSummarizerTrigger` function
- **Solution**: Check that emails with `summarize` label exist from past 7 days
- **Solution**: Enable `SUMMARIZER_DEBUG=true` for detailed logging

**🔍 Problem**: Custom label summaries not being generated (Issue #46)
- **Solution**: Verify `SUMMARIZER_CUSTOM_LABELS` is configured with comma-separated label names
- **Solution**: Check that custom labels exist in Gmail and are properly spelled in configuration
- **Solution**: Verify emails with custom labels exist and are within `SUMMARIZER_MAX_AGE_DAYS` (default: 7 days)
- **Solution**: Check execution logs for label-specific processing messages
- **Solution**: Enable `SUMMARIZER_DEBUG=true` to see which labels are being processed
- **Solution**: Custom labels preserve the original label - check if 'summarized' label was added

**🔍 Problem**: Custom label emails not being marked as read or archived
- **Solution**: Verify `MARK_CUSTOM_LABELS_AS_READ=true` if you want emails marked as read
- **Solution**: Verify `CUSTOM_SUMMARIZER_ARCHIVE_ON_LABEL=true` if you want emails archived
- **Solution**: **IMPORTANT**: Check if `SUMMARIZER_DRY_RUN=true` - dry run mode simulates actions without executing them
- **Solution**: Disable dry run mode (`SUMMARIZER_DRY_RUN=false`) to actually mark emails as read/archive them
- **Solution**: Note that default 'summarize' label behavior is different from custom labels
- **Solution**: Check execution logs for "markedRead" and "archived" counts in results
- **Solution**: With `SUMMARIZER_DEBUG=true`, look for messages like "marked X as read" or warnings about failures

**🔍 Problem**: Multi-account commands not working
- **Solution**: Ensure you have the latest `package.json` with multi-account scripts
- **Solution**: Validate setup with `npm run validate:accounts`

**🔍 Problem**: Authentication issues with specific account
- **Solution**: Check authentication status with `npm run switch:status`
- **Solution**: Re-authenticate problematic account: `clasp --user [account] login`

**🔍 Problem**: KnowledgeService failing to fetch documents
- **Solution**: Verify document/folder URL is correct format in Script Properties
- **Solution**: Check document/folder permissions (must have at least Viewer access)
- **Solution**: Enable `KNOWLEDGE_DEBUG=true` to see detailed fetch logs
- **Solution**: If configured but want to proceed without knowledge, remove the property
- **Solution**: Check execution logs for token warnings (may be hitting capacity limits)

**🔍 Problem**: Knowledge documents too large
- **Solution**: Monitor soft warnings at 50% capacity (informational)
- **Solution**: Critical warnings at 90% capacity mean action needed
- **Solution**: Reduce `LABEL_KNOWLEDGE_MAX_DOCS` or `REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS`
- **Solution**: Remove some documents from knowledge folder
- **Solution**: Split large documents into smaller focused documents
- **Solution**: Set `KNOWLEDGE_LOG_SIZE_WARNINGS=false` to disable warnings (not recommended)

**🔍 Problem**: Reply Drafter drafts have poor quality
- **Solution**: Customize with `REPLY_DRAFTER_INSTRUCTIONS_URL` to define tone and style
- **Solution**: Add example drafts to `REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL` for AI to learn from
- **Solution**: Enable `REPLY_DRAFTER_DEBUG=true` to see token utilization and knowledge loading
- **Solution**: Review generated drafts and refine instructions document based on patterns

**🔍 Problem**: Todo Forwarder not forwarding emails
- **Solution**: Verify `TODO_FORWARDER_ENABLED=true` in Script Properties
- **Solution**: Configure `TODO_FORWARDER_EMAIL` with destination email address (required)
- **Solution**: Check that emails have `todo` label applied by core classification
- **Solution**: Verify core email labeling trigger (`installTrigger`) is installed and running hourly
- **Solution**: Enable `TODO_FORWARDER_DEBUG=true` for detailed logging
- **Solution**: Test with `TODO_FORWARDER_DRY_RUN=true` to verify agent runs without forwarding
- **Solution**: Check execution logs for both onLabel and postLabel handler execution
- **Solution**: For manually labeled emails, postLabel hook will process them on next hourly run

**🔍 Problem**: Todo Forwarder forwarding duplicate emails
- **Solution**: Check if emails are archived after forwarding (archived emails won't be forwarded again)
- **Solution**: Verify archive operation succeeded (check execution logs)
- **Solution**: Review execution logs for idempotency checks
- **Solution**: Emails in inbox with `todo` label will be forwarded - move to archive to prevent retry

**🔍 Problem**: Todo Forwarder destination not receiving emails
- **Solution**: Verify `TODO_FORWARDER_EMAIL` is correct email address format
- **Solution**: Check spam folder of destination email account
- **Solution**: Test with personal email address first to verify forwarding works
- **Solution**: Review GmailApp quota limits (100 emails/day for consumer accounts)
- **Solution**: Check execution logs for "Forward failed" error messages

**🔍 Problem**: API quota exceeded
- **Solution**: Monitor quota usage at Google Cloud Console: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
- **Solution**: Request quota increase through Google Cloud Console if needed
- **Solution**: Reduce `MAX_EMAILS_PER_RUN` to process fewer emails per execution
- **Solution**: Consider upgrading to a paid API tier for higher quotas