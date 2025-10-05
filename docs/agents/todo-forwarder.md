# Todo Forwarder Agent

The Todo Forwarder is an intelligent agent that automatically forwards emails labeled `todo` to external task management systems, enabling seamless integration between Gmail and your preferred task tracking tools.

## What It Does

The Todo Forwarder agent:

- **Monitors** emails labeled as `todo` by the core classification system
- **Processes both new and existing emails** through dual-hook architecture (see below)
- **Checks idempotency** using `todo_forwarded` label to prevent duplicate forwarding
- **Retrieves full thread context** including all messages in the conversation
- **Formats emails as HTML** with clean presentation and metadata
- **Forwards to configured destination** (task management email, personal inbox, etc.)
- **Manages labels** optionally removing `todo` label and archiving after forward
- **Runs automatically** via the hourly email processing trigger (no separate trigger needed)
- **Respects dry-run mode** for safe testing before enabling

This agent operates automatically using the dual-hook pattern, requiring no manual intervention once configured.

## Perfect For

- **Task Management Integration**: Forward todos to Todoist, Asana, or other email-based task systems
- **Separate Todo Inbox**: Route action items to dedicated email account for focused processing
- **Team Workflows**: Forward todos to shared team email for task distribution
- **Automated Archiving**: Clean up Gmail inbox while preserving todos in external system
- **Context Preservation**: Ensure full email thread history accompanies task creation

## Quick Start

### Prerequisites

- Complete the [basic email labeling setup](../../README.md#setup-guide) first
- Todo Forwarder is enabled by default (`TODO_FORWARDER_ENABLED=true`)
- Core labeling system must be running to apply `todo` labels
- **Required**: Configure destination email address (`TODO_FORWARDER_EMAIL`)

### Setup Steps

1. **Install core email processing trigger** (required):
   - Open Apps Script editor: `npm run open:personal` (or `:work`)
   - Select `installTrigger` from the function dropdown
   - Click the Run button (▶️) to install the hourly trigger
   - Grant necessary permissions when prompted
   - Todo Forwarder runs automatically as part of this hourly cycle

2. **Configure destination email**:
   - In Apps Script editor, go to "Project Settings" → "Script properties"
   - Add property: `TODO_FORWARDER_EMAIL` = `mytasks@todoist.com` (or your destination)
   - This is the only required configuration - agent won't forward without it

3. **Customize behavior** (optional):
   - `TODO_FORWARDER_REMOVE_TODO_LABEL=true` — Remove `todo` label after forwarding (default: true)
   - `TODO_FORWARDER_ARCHIVE_AFTER_FORWARD=true` — Archive email after forwarding (default: false)
   - See [Configuration Options](#configuration-options) section below

4. **Test the agent**:
   - Enable debug mode: `TODO_FORWARDER_DEBUG=true`
   - Enable dry-run mode: `TODO_FORWARDER_DRY_RUN=true`
   - Run the core email labeling process (or wait for hourly trigger)
   - Check execution logs for "Todo Forwarder" messages
   - Disable dry-run once testing confirms behavior

5. **Verify forwarding**:
   - Check destination email account for forwarded todos
   - Verify HTML formatting displays correctly
   - Confirm Gmail link in forwarded email works
   - Check that `todo_forwarded` label is applied in Gmail

## How It Works

### Dual-Hook Architecture

The Todo Forwarder uses a **dual-hook pattern** to ensure comprehensive forwarding coverage within the hourly email processing cycle:

#### Hook 1: onLabel (Immediate Processing)
Runs during the core email classification pipeline:
- **Trigger**: Email is newly classified as `todo`
- **Timing**: Immediately after labeling completes during `Organizer.apply_()`
- **Coverage**: Only newly-classified emails
- **Use case**: Fast forwarding for incoming todos

#### Hook 2: postLabel (Inbox Scanning)
Runs after all classification/labeling is complete:
- **Trigger**: After `Organizer.apply_()` finishes all labeling
- **Timing**: Once per hourly email processing cycle
- **Coverage**: ALL emails with `todo` label in inbox (without `todo_forwarded`)
- **Use case**: Manually labeled emails, retries for failed forwards, emails labeled before agent was deployed

**Why both hooks?**
The onLabel hook only processes emails during active classification. It never sees:
- Emails you manually label with `todo`
- Emails that had `todo` before the agent was deployed
- Emails where forwarding previously failed

The postLabel hook fills this gap by scanning the inbox for ALL `todo` emails and forwarding any that don't have the `todo_forwarded` label yet. Both hooks run in the same hourly email processing cycle.

### Workflow (Both Hooks)

1. **Email Discovery**:
   - onLabel: Receives email context from classification pipeline
   - postLabel: Searches inbox for `in:inbox label:todo -label:todo_forwarded`

2. **Idempotency Check**:
   - Verifies email doesn't have `todo_forwarded` label
   - Skips processing if already forwarded
   - Prevents duplicate forwarding on manual re-labeling

3. **Thread Retrieval**:
   - Fetches complete Gmail thread by ID
   - Extracts all messages in conversation
   - Collects metadata (from, to, date, subject)

4. **HTML Formatting**:
   - Generates clean HTML email with responsive design
   - Includes thread summary and message count
   - Adds direct Gmail link to original thread
   - Formats each message with metadata and body

5. **Email Forwarding**:
   - Sends formatted HTML email to configured destination
   - Uses `GmailApp.sendEmail()` for delivery
   - Subject line prefixed with "[Todo]"
   - Plain text fallback for non-HTML clients

6. **Label Management**:
   - Adds `todo_forwarded` label to mark as processed
   - Optionally removes `todo` label (if `TODO_FORWARDER_REMOVE_TODO_LABEL=true`)
   - Optionally archives email (if `TODO_FORWARDER_ARCHIVE_AFTER_FORWARD=true`)

7. **Logging**:
   - Records forward success/failure
   - Logs skipped emails (already forwarded)
   - Provides summary statistics (processed/skipped/errors)

### Idempotency Strategy

The agent uses **label-based idempotency** to prevent duplicate forwarding:

**Primary Mechanism**:
- `todo_forwarded` label marks emails as processed
- Both hooks check for this label before forwarding
- Gmail search query excludes already-forwarded emails: `-label:todo_forwarded`

**Benefits**:
- Visual feedback in Gmail (you can see what's been forwarded)
- No hidden UserProperties state
- Simple recovery: remove label to retry forwarding
- Consistent with label-synchronized agent state pattern (ADR-017)

**Edge Cases Handled**:
- Manual re-labeling with `todo`: Skipped (already has `todo_forwarded`)
- Failed forward: No label applied, will retry on next postLabel run
- Label accidentally removed: Will re-forward on next postLabel run

## Configuration Options

All configuration is managed via Apps Script Script Properties in the Apps Script editor.

### Required Configuration

| Property | Description | Example |
|----------|-------------|---------|
| `TODO_FORWARDER_EMAIL` | Destination email address for forwarded todos | `mytasks@todoist.com` |

**Note**: Agent will not forward emails if this is not configured, even if enabled.

### Basic Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `TODO_FORWARDER_ENABLED` | `true` | Enable/disable the agent entirely |

### Label Management

| Property | Default | Description |
|----------|---------|-------------|
| `TODO_FORWARDER_REMOVE_TODO_LABEL` | `true` | Remove `todo` label after successful forward |
| `TODO_FORWARDER_ARCHIVE_AFTER_FORWARD` | `false` | Archive email after forwarding |

**Workflow scenarios**:
- **Clean Inbox**: `REMOVE_TODO_LABEL=true`, `ARCHIVE_AFTER_FORWARD=true` — Forward, clean up, archive
- **Task Tracking Only**: `REMOVE_TODO_LABEL=true`, `ARCHIVE_AFTER_FORWARD=false` — Forward, remove label, keep in inbox
- **Visual Reference**: `REMOVE_TODO_LABEL=false`, `ARCHIVE_AFTER_FORWARD=false` — Forward, keep all labels and inbox position

### Debugging Configuration

| Property | Default | Description |
|----------|---------|-------------|
| `TODO_FORWARDER_DEBUG` | `false` | Enable detailed logging |
| `TODO_FORWARDER_DRY_RUN` | `false` | Test mode (analyze but don't forward) |

**Debugging workflow**:
1. Enable `TODO_FORWARDER_DEBUG=true` for verbose logging
2. Enable `TODO_FORWARDER_DRY_RUN=true` to test without side effects
3. Run email processing and review execution logs
4. Verify intended behavior before disabling dry-run

## Configuration Examples

### Example 1: Basic Todoist Integration
```
TODO_FORWARDER_ENABLED = true
TODO_FORWARDER_EMAIL = mytasks@todoist.com
```
Forwards todos to Todoist, removes `todo` label, keeps emails in inbox.

### Example 2: Full Inbox Automation
```
TODO_FORWARDER_ENABLED = true
TODO_FORWARDER_EMAIL = tasks@asana.com
TODO_FORWARDER_REMOVE_TODO_LABEL = true
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD = true
```
Forwards todos to Asana, removes label, and archives emails for clean inbox.

### Example 3: Separate Todo Inbox
```
TODO_FORWARDER_ENABLED = true
TODO_FORWARDER_EMAIL = todos@myemaildomain.com
TODO_FORWARDER_REMOVE_TODO_LABEL = false
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD = false
```
Forwards todos to personal inbox, preserves all labels and Gmail location.

### Example 4: Testing Configuration
```
TODO_FORWARDER_ENABLED = true
TODO_FORWARDER_EMAIL = test@example.com
TODO_FORWARDER_DEBUG = true
TODO_FORWARDER_DRY_RUN = true
TODO_FORWARDER_REMOVE_TODO_LABEL = false
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD = false
```
Tests agent behavior without forwarding or modifying emails.

## Forwarded Email Format

Emails are forwarded with rich HTML formatting for easy reading:

### Subject Line
```
[Todo] Original Email Subject
```

### Email Body Structure

**Header Section**:
- Thread subject as H2 heading
- Message count summary
- Direct link to Gmail thread

**Message Section** (for each message in thread):
- Metadata box: From, To, Date, Subject
- Message body with preserved formatting
- Visual separation between messages

**Footer**:
- "Forwarded by Todo Forwarder Agent" attribution
- Link to view original in Gmail

### HTML Example
```html
<html>
<body style="max-width: 800px; margin: 0 auto;">
  <h2>Todo: Quarterly Planning Meeting</h2>
  <p>Thread contains 3 messages</p>
  <p><a href="https://mail.google.com/...">→ View in Gmail</a></p>

  <div style="background: #f5f5f5; padding: 15px; margin-bottom: 15px;">
    <div style="border-bottom: 1px solid #ddd; padding-bottom: 10px;">
      <strong>From:</strong> manager@example.com<br>
      <strong>Date:</strong> Oct 4, 2025, 10:30 AM<br>
    </div>
    <div style="white-space: pre-wrap;">
      Please prepare agenda items for quarterly planning...
    </div>
  </div>

  <footer>Forwarded by Todo Forwarder Agent | <a href="...">View Original</a></footer>
</body>
</html>
```

## Task Management System Integration

### Todoist
Forward emails to your Todoist inbox email (find in Settings → Integrations):
```
TODO_FORWARDER_EMAIL = yourproject+abc123@todoist.com
```

Todoist will:
- Create task from email subject
- Attach full email content to task
- Process `#project` and `@label` tags in subject

### Asana
Forward emails to your Asana project email (find in Project Settings):
```
TODO_FORWARDER_EMAIL = x@mail.asana.com
```

Asana will:
- Create task in specified project
- Attach email content as task description
- Support assignee and due date parsing

### Microsoft To Do
Forward emails to your To Do email (find in Settings):
```
TODO_FORWARDER_EMAIL = youremail@to-do.microsoft.com
```

Microsoft To Do will:
- Create task from subject line
- Include email body in notes
- Link to original email

### Things (Email to Things)
Forward emails using Email to Things service:
```
TODO_FORWARDER_EMAIL = your-things-email@things.email
```

Things will:
- Parse task details from subject
- Support project, tags, and dates
- Attach email content to task

### Custom Email Systems
Works with any email address that processes incoming mail:
```
TODO_FORWARDER_EMAIL = todos@yourdomain.com
```

## Troubleshooting

### Agent Not Forwarding Emails

**Check configuration**:
- Verify `TODO_FORWARDER_ENABLED=true`
- Confirm `TODO_FORWARDER_EMAIL` is set to valid email address
- Check core labeling trigger is installed (`installTrigger`)

**Check labels**:
- Verify emails have `todo` label applied
- Confirm emails don't already have `todo_forwarded` label
- Manually label test email with `todo` and wait for next hourly run

**Enable debugging**:
```
TODO_FORWARDER_DEBUG = true
TODO_FORWARDER_DRY_RUN = true
```
- Review execution logs for "Todo Forwarder" entries
- Check for error messages or skipped emails
- Verify agent is running in both onLabel and postLabel hooks

### Duplicate Forwarding

**Verify idempotency**:
- Check emails for `todo_forwarded` label
- If missing, labels may not be saving correctly
- Review execution logs for label application errors

**Check for manual re-labeling**:
- Removing and re-adding `todo` label should NOT forward again (idempotent)
- If forwarding duplicates, check for `todo_forwarded` label removal

**Verify configuration**:
- Ensure `TODO_FORWARDER_REMOVE_TODO_LABEL` setting matches your workflow
- If `true`, `todo` label will be removed but `todo_forwarded` stays

### Destination Not Receiving Emails

**Verify email address**:
- Check `TODO_FORWARDER_EMAIL` for typos
- Test with personal email first to confirm forwarding works
- Verify destination email address is active and accepting mail

**Check spam folder**:
- Forwarded emails may be filtered as spam
- Whitelist sender address (your Gmail account)
- Check destination email's spam/junk folder

**Verify quotas**:
- GmailApp quota: 100 emails/day (consumer), 1500/day (Workspace)
- Check execution logs for quota exceeded errors
- Monitor quota usage in Google Cloud Console

**Test with simple destination**:
```
TODO_FORWARDER_EMAIL = your.personal.email@gmail.com
```
- Verify forwarding works to known-good address
- Then switch to task management email

### HTML Formatting Issues

**Verify HTML support**:
- Most modern email clients support HTML
- If destination shows plain text, client may strip HTML
- Check plain text fallback message is included

**Check email size**:
- Very large threads may exceed email size limits (rare)
- Enable `TODO_FORWARDER_DEBUG=true` to see thread size
- Consider archiving large threads manually

**Test rendering**:
- Forward to personal Gmail to verify HTML rendering
- Adjust email client settings to "display HTML"
- Check for JavaScript/CSS stripping by email provider

### Performance Issues

**Reduce processing load**:
- Lower `MAX_EMAILS_PER_RUN` if timeouts occur
- Process fewer emails per execution
- Monitor execution time in Apps Script logs

**Check quota usage**:
- Each forward consumes send quota
- Inbox scanning adds search quota usage
- Review quota at Google Cloud Console

**Optimize postLabel scanning**:
- Ensure `todo_forwarded` labels are applied correctly
- Search query efficiency: `-label:todo_forwarded` filters at database level
- Large inboxes may benefit from periodic cleanup

## Advanced Usage

### Conditional Forwarding

The agent forwards ALL emails with `todo` label. For selective forwarding:

**Option 1: Manual labeling**
- Don't rely on automatic classification for todos
- Manually apply `todo` label only to emails you want forwarded
- Use custom rules to classify emails differently

**Option 2: Custom agent modification**
- Modify `processTodoForward_()` to check email content
- Add conditional logic for sender, subject, or body patterns
- Example: Only forward if subject contains "[ACTION]"

### Multiple Destinations

Current implementation supports one destination. For multiple:

**Option 1: Email forwarding rules**
- Configure destination email to forward to multiple addresses
- Example: Todoist inbox forwards copy to personal email

**Option 2: Create separate agents**
- Duplicate `AgentTodoForwarder.gs` with different name
- Use different label (e.g., `todo_team` vs `todo_personal`)
- Configure different destinations per agent

### Workflow Automation Examples

**Example: Complete Inbox Zero**
```
TODO_FORWARDER_EMAIL = tasks@asana.com
TODO_FORWARDER_REMOVE_TODO_LABEL = true
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD = true
```
All todos automatically forwarded, labeled, and archived.

**Example: Todo Reference Preservation**
```
TODO_FORWARDER_EMAIL = mytasks@todoist.com
TODO_FORWARDER_REMOVE_TODO_LABEL = false
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD = false
```
Todos forwarded but preserved in Gmail for reference.

**Example: Team Task Distribution**
```
TODO_FORWARDER_EMAIL = team-tasks@company.com
TODO_FORWARDER_REMOVE_TODO_LABEL = true
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD = false
```
Todos forwarded to team, label removed, email stays in inbox for visibility.

## Architecture Details

### Self-Contained Agent Pattern

The Todo Forwarder follows ADR-011 self-contained architecture:

**Configuration Management**:
- `getTodoForwarderConfig_()` — Independent config loading
- PropertiesService keys prefixed with `TODO_FORWARDER_`
- No modifications to core `Config.gs` required

**Label Management**:
- `ensureTodoForwarderLabels_()` — Creates `todo_forwarded` label
- Agent manages own label lifecycle
- No core system label changes needed

**Self-Registration**:
- Uses `AGENT_MODULES.push()` pattern
- No modifications to `Agents.gs` required
- Automatic discovery and registration

### Dual-Hook Implementation

Following ADR-018 dual-hook architecture:

**onLabel Hook** (`processTodoForward_`):
- Receives context: `{ label, decision, threadId, thread, cfg, dryRun, log }`
- Returns status: `{ status: 'ok'|'skip'|'error', info: 'message' }`
- Runs per-email during classification
- Fast path for newly-classified todos

**postLabel Hook** (`todoForwarderPostLabelScan_`):
- No parameters (inbox-wide operation)
- Searches Gmail independently
- Processes ALL unforwarded todos
- Provides comprehensive coverage

**Execution Context**:
- Both hooks run in single hourly trigger
- Shared configuration and quota management
- Unified logging and error handling

### Generic Service Layer Usage

Uses established patterns from ADR-012:

**Gmail Operations**:
- `GmailApp.search()` — Inbox scanning with label filters
- `GmailApp.getThreadById()` — Thread retrieval
- `GmailApp.sendEmail()` — HTML email forwarding
- Label management via `thread.addLabel()` / `removeLabel()`

**Future Generic Functions** (potential):
- `sendFormattedEmail_()` — Reusable HTML email sending
- `formatEmailThread_()` — Standardized thread formatting
- `trackAgentState_()` — Generic label-based state tracking

## Performance Characteristics

### Execution Time
- **onLabel**: ~2-3 seconds per email (thread retrieval + HTML formatting + send)
- **postLabel**: ~1-2 seconds base + (2-3 seconds × unforwarded count)
- **Typical overhead**: <10 seconds for <5 unforwarded emails per hourly run

### Gmail API Quota Usage
- **Search**: 1 query per hourly execution (`in:inbox label:todo -label:todo_forwarded`)
- **Read**: 1 thread retrieval per forwarded email
- **Send**: 1 email send per forwarded email (daily quota limits apply)
- **Labels**: 2-3 label operations per forwarded email

### Quota Limits
- **Consumer Gmail**: 100 emails/day send quota
- **Google Workspace**: 1500 emails/day send quota
- **Apps Script**: 6 minutes execution time per run
- **Drive API**: Not used by this agent

### Memory Usage
- **Thread data**: ~10-50KB per thread (varies with message count)
- **HTML formatting**: Similar to thread data size
- **Peak memory**: ~100KB per typical todo email

## See Also

- [Back to README](../../README.md)
- [Configuration Reference](../guides/configuration.md) - Todo Forwarder configuration options
- [Troubleshooting Guide](../guides/troubleshooting.md) - Common issues
- [ADR-020: Todo Forwarder Agent](../adr/020-todo-forwarder-agent.md) - Architecture decision record
- [ADR-018: Dual-Hook Agent Architecture](../adr/018-dual-hook-agent-architecture.md) - Dual-hook pattern
- [ADR-017: Remove UserProperties Idempotency](../adr/017-remove-userproperties-idempotency.md) - Label-based state
- [Reply Drafter Agent](reply-drafter.md) - Similar dual-hook agent
- [Email Summarizer Agent](email-summarizer.md) - Another self-contained agent
