# ADR-020: Todo Forwarder Agent Implementation

**Status**: Accepted
**Date**: 2025-10-03
**Deciders**: Project team

## Context

The email-agent system uses a four-label classification system (ADR-003) to categorize incoming emails: `reply_needed`, `review`, `todo`, and `summarize`. While the Reply Drafter agent (ADR-018) and Email Summarizer agent provide automation for their respective labels, the `todo` label had no automated processing capability.

**User Workflow Challenges:**
- Todo emails remain in Gmail inbox requiring manual monitoring
- No integration with external task management systems
- Users must manually check Gmail for todo items
- Todo emails mixed with other inbox content reduce visibility
- No automated forwarding to task tracking systems (e.g., Todoist, task management email addresses)

**Architectural Context:**
The system's pluggable agent architecture (ADR-004) with self-contained patterns (ADR-011) and dual-hook execution model (ADR-018) provides the foundation for extending email processing functionality without modifying core system files.

**Requirements:**
1. **Automated Forwarding**: Forward todo emails to configured destination address
2. **Idempotency**: Prevent duplicate forwarding of same email
3. **Full Thread Context**: Include complete email thread in forwarded message
4. **Dual Execution Modes**: Support both auto-classified and manually-labeled emails
5. **Self-Contained Implementation**: No core system modifications required
6. **Configurable Behavior**: Support various post-forward actions (label removal, archiving)

## Decision

We implemented the **Todo Forwarder Agent** as a self-contained agent module following the dual-hook architecture pattern established in ADR-018. The agent automatically forwards emails labeled "todo" to a configured destination address while maintaining idempotency through label-based tracking.

### Core Implementation Characteristics

**Self-Contained Architecture (ADR-011):**
- Independent configuration management via PropertiesService
- Self-managed label creation (`todo_forwarded`)
- No modifications to core Config.gs or Main.gs
- Complete lifecycle management within single file

**Dual-Hook Pattern (ADR-018):**
- **onLabel Hook**: Immediate forwarding during email classification
- **postLabel Hook**: Inbox-wide scanning for manually-labeled emails
- Both hooks run within hourly trigger cycle (no separate trigger needed)
- Unified execution context with shared configuration and budget

**Idempotency Strategy:**
- Label-based tracking using `todo_forwarded` label (no UserProperties)
- Application-level checks prevent duplicate forwarding
- Both hooks respect forwarded state for consistent behavior
- Gmail label search optimization: `-label:todo_forwarded` query filter

**Email Forwarding Features:**
- HTML-formatted email with complete thread context
- All messages in thread included with metadata (from, to, date, subject)
- Direct Gmail link for original thread access
- Clean HTML presentation with responsive styling
- Plain text fallback for non-HTML email clients

**Configurable Post-Forward Actions:**
- Optional `todo` label removal after successful forward
- Optional email archiving after forward
- Flexible configuration supports various workflow preferences

### Configuration Properties

Agent manages these PropertiesService keys independently:

```javascript
// Core Configuration
TODO_FORWARDER_ENABLED: true | false           // Enable/disable agent
TODO_FORWARDER_EMAIL: email@example.com        // Destination email address

// Label Management
TODO_FORWARDER_REMOVE_TODO_LABEL: true | false      // Remove todo label after forward
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD: true | false  // Archive email after forward

// Debugging
TODO_FORWARDER_DEBUG: true | false             // Detailed logging
TODO_FORWARDER_DRY_RUN: true | false          // Test mode (no forwarding)
```

### Agent Registration

```javascript
AGENT_MODULES.push(function(api) {
  api.register(
    'todo',                    // Label to trigger on
    'TodoForwarder',           // Agent name
    {
      onLabel: processTodoForward_,           // Immediate per-email handler
      postLabel: todoForwarderPostLabelScan_  // Inbox-wide scan handler
    },
    {
      runWhen: 'afterLabel',   // Run after labeling (respects dry-run)
      timeoutMs: 30000,        // Soft timeout guidance
      enabled: true            // Enabled by default
    }
  );
});
```

## Alternatives Considered

### Alternative 1: Single-Hook onLabel Implementation
**Description**: Implement only the onLabel hook for immediate forwarding during classification.

**Pros**:
- Simpler implementation with single execution path
- Lower complexity for debugging and maintenance
- Reduced execution overhead (no inbox scanning)

**Cons**:
- Manually-labeled emails require separate scheduled trigger
- Increases trigger proliferation (contradicts ADR-018 goals)
- No coverage for emails labeled before agent deployment
- Inconsistent with Reply Drafter dual-hook pattern

**Why not chosen**: Violates ADR-018's goal of eliminating separate agent triggers and creates inconsistent agent behavior patterns.

### Alternative 2: Gmail Forwarding Filters
**Description**: Use native Gmail filters to forward todo-labeled emails automatically.

**Pros**:
- No custom code required
- Built-in Gmail functionality
- Zero execution quota consumption
- Immediate forwarding on label application

**Cons**:
- No idempotency tracking (duplicate forwards on re-labeling)
- Cannot format email with thread context and metadata
- No conditional post-forward actions (label removal, archiving)
- No dry-run testing capability
- Difficult to disable/reconfigure without manual filter editing
- No integration with agent framework and logging

**Why not chosen**: Lacks flexibility, idempotency, and integration with existing agent architecture.

### Alternative 3: Third-Party Integration (Zapier/IFTTT)
**Description**: Use external automation platforms to detect Gmail labels and forward emails.

**Pros**:
- Rich integration ecosystem with task management systems
- Advanced workflow capabilities (conditional logic, multi-step flows)
- No Apps Script quota consumption
- Professional monitoring and error handling

**Cons**:
- External service dependency and costs
- Requires OAuth authentication and security review
- Contradicts serverless Apps Script architecture (ADR-001)
- Introduces third-party privacy/security concerns
- Gmail API polling latency (15-minute minimum)
- Complex setup and maintenance burden

**Why not chosen**: Violates architectural principle of self-contained Apps Script deployment and adds external dependencies.

### Alternative 4: UserProperties-Based Idempotency
**Description**: Track forwarded emails using UserProperties keys instead of labels.

**Pros**:
- Invisible to users (no additional Gmail labels)
- Familiar pattern from older agent implementations
- Efficient lookup without Gmail API calls

**Cons**:
- Violates ADR-017 (removal of UserProperties idempotency)
- No visual indicator of forwarded state in Gmail
- Divergence between visible state (labels) and internal state (UserProperties)
- UserProperties quota constraints (500KB limit)
- No recovery path if state becomes corrupted

**Why not chosen**: Contradicts architectural shift to label-synchronized state management (ADR-017) and reduces user visibility into agent actions.

### Alternative 5: Separate Scheduled Trigger (Pre-ADR-018 Pattern)
**Description**: Implement agent with independent scheduled trigger separate from main classification workflow.

**Pros**:
- Complete execution independence
- Flexible scheduling (e.g., every 15 minutes for lower latency)
- Simpler registration pattern (no dual hooks)

**Cons**:
- Trigger proliferation (each agent needs separate trigger)
- Separate execution contexts complicate debugging
- Quota fragmentation across multiple triggers
- Installation complexity (manual trigger setup per agent)
- Contradicts ADR-018 architectural direction

**Why not chosen**: This is the exact pattern ADR-018 was designed to eliminate. Reverting to it would undermine recent architectural improvements.

## Consequences

### Positive

**User Experience:**
- **Automated Todo Processing**: Emails automatically forwarded to task management systems without manual intervention
- **Visual Feedback**: `todo_forwarded` label provides clear indication of forwarding status
- **Full Context**: Forwarded emails include complete thread history for informed task creation
- **Flexible Workflows**: Optional label removal and archiving support various user preferences
- **Immediate Action**: Auto-classified todos forwarded immediately during classification

**Architectural Benefits:**
- **Zero Trigger Proliferation**: Runs in existing hourly trigger via dual-hook pattern
- **Self-Contained Module**: No core system modifications required (ADR-011 compliance)
- **Consistent Patterns**: Follows established dual-hook architecture from Reply Drafter
- **Reusable Components**: Demonstrates HTML email formatting patterns for future agents
- **Generic Service Integration**: Uses established GmailApp patterns for label management

**Operational Advantages:**
- **Idempotent by Design**: Label-based tracking prevents duplicate forwarding
- **Dry-Run Testing**: Configuration-based testing without side effects
- **Debug Visibility**: Detailed logging for troubleshooting with DEBUG flag
- **Configuration Flexibility**: Multiple PropertiesService options for workflow customization
- **Error Resilience**: Graceful error handling with detailed error messages

### Negative

**Execution Overhead:**
- **postLabel Scanning**: Inbox-wide Gmail search on every hourly execution
- **HTML Formatting**: Additional processing time for multi-message threads
- **Label Operations**: Extra Gmail API calls for label application/removal

**Gmail API Quota Impact:**
- **Search Queries**: One search query per hourly execution (`in:inbox label:todo -label:todo_forwarded`)
- **Thread Retrieval**: One API call per unforwarded todo email
- **Send Operations**: One GmailApp.sendEmail call per forward
- **Label Operations**: 2-3 label operations per forwarded email (add forwarded, optionally remove todo)

**Configuration Complexity:**
- **Multiple Properties**: 6 configuration keys to understand and configure
- **Destination Setup**: Requires external email address configuration
- **Testing Overhead**: Dry-run testing needed before production use

**Feature Limitations:**
- **No Selective Forwarding**: All todo emails forwarded (no content-based filtering)
- **Single Destination**: Only one forwarding address supported
- **HTML Dependency**: Plain text fallback less rich than HTML version
- **No Retry Logic**: Failed forwards require manual re-labeling or next hourly execution

### Neutral

**Maintenance Considerations:**
- **Label Management**: Creates permanent `todo_forwarded` label in Gmail
- **Email Volume**: Forwarding throughput limited by GmailApp quota (100 recipients/day for consumer accounts)
- **Thread Size**: Large threads may exceed email size limits (rare edge case)

**Integration Patterns:**
- **Task Management Systems**: Works with any email-based task creation system
- **Workflow Customization**: Post-forward actions support various user workflows
- **Migration Path**: Easy to disable via `TODO_FORWARDER_ENABLED=false`

## Implementation Notes

### File Structure

**Location**: `/src/AgentTodoForwarder.gs`

**Components**:
1. Configuration Management: `getTodoForwarderConfig_()`
2. Label Management: `ensureTodoForwarderLabels_()`
3. Helper Functions: Thread retrieval, HTML formatting, forwarding logic
4. onLabel Handler: `processTodoForward_(ctx)`
5. postLabel Handler: `todoForwarderPostLabelScan_()`
6. Agent Registration: Dual-hook registration at file end

### Execution Flow

**onLabel Hook (Immediate Forwarding)**:
```
Email Classification
  └─> Apply "todo" label
       └─> Organizer.apply_() calls onLabel hooks
            └─> processTodoForward_(ctx)
                 ├─> Check if enabled
                 ├─> Check if already forwarded (idempotent skip)
                 ├─> Forward email thread
                 ├─> Add "todo_forwarded" label
                 ├─> Optionally remove "todo" label
                 └─> Optionally archive email
```

**postLabel Hook (Inbox Scanning)**:
```
After All Labeling Complete
  └─> Agents.runPostLabelHandlers()
       └─> todoForwarderPostLabelScan_()
            ├─> Search: in:inbox label:todo -label:todo_forwarded
            ├─> For each unforwarded thread:
            │    ├─> Double-check not forwarded (idempotency)
            │    ├─> Forward email thread
            │    ├─> Add "todo_forwarded" label
            │    ├─> Optionally remove "todo" label
            │    └─> Optionally archive email
            └─> Log summary: processed/skipped/errors
```

### Idempotency Implementation

**Primary Check (Label-Based)**:
```javascript
function isEmailForwarded_(thread) {
  const labels = thread.getLabels();
  for (let i = 0; i < labels.length; i++) {
    if (labels[i].getName() === 'todo_forwarded') {
      return true;
    }
  }
  return false;
}
```

**Search Query Optimization**:
```javascript
// Excludes already-forwarded emails at search level
const query = 'in:inbox label:todo -label:todo_forwarded';
const threads = GmailApp.search(query);
```

**Double-Check Pattern**:
Both hooks verify forwarded status before processing to handle race conditions where label may be applied between search and processing.

### HTML Email Formatting

**Template Structure**:
```html
<html>
  <body style="max-width: 800px; margin: 0 auto;">
    <h2>Todo: [Subject]</h2>
    <p>Thread contains N messages</p>
    <p><a href="[Gmail URL]">View in Gmail</a></p>

    <!-- For each message in thread -->
    <div style="background: #f5f5f5; padding: 15px;">
      <div>From: | To: | Date: | Subject:</div>
      <div>[Message Body]</div>
    </div>

    <footer>Forwarded by Todo Forwarder Agent</footer>
  </body>
</html>
```

**Security Considerations**:
- HTML entity escaping for email content (`&`, `<`, `>`)
- Gmail URL construction with validated thread ID
- No execution of embedded scripts (plain HTML only)

### Configuration Examples

**Basic Setup (Minimal Configuration)**:
```
TODO_FORWARDER_ENABLED=true
TODO_FORWARDER_EMAIL=mytasks@todoist.com
```

**Full Workflow Automation**:
```
TODO_FORWARDER_ENABLED=true
TODO_FORWARDER_EMAIL=tasks@asana.com
TODO_FORWARDER_REMOVE_TODO_LABEL=true
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD=true
```

**Testing Configuration**:
```
TODO_FORWARDER_ENABLED=true
TODO_FORWARDER_EMAIL=test@example.com
TODO_FORWARDER_DEBUG=true
TODO_FORWARDER_DRY_RUN=true
TODO_FORWARDER_REMOVE_TODO_LABEL=false
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD=false
```

### Error Handling

**Configuration Errors**:
- Missing `TODO_FORWARDER_EMAIL`: Returns `{ status: 'error', info: 'not configured' }`
- Invalid email address: Gmail will reject and throw error (caught and logged)

**Runtime Errors**:
- Thread not found: Caught, logged, returns error status
- Send failure: Caught, logged, email remains unforwarded for retry
- Label operation failure: Caught, logged, may result in duplicate forward on retry

**Dry-Run Behavior**:
- Both `ctx.dryRun` (global) and `TODO_FORWARDER_DRY_RUN` (agent-specific) respected
- Logs intended actions without executing side effects
- Returns `{ status: 'ok', info: 'dry-run mode' }`

### Testing Strategy

**Unit Testing**:
- Configuration parsing and defaults
- HTML formatting with various thread sizes
- Idempotency check logic
- Error handling for missing configuration

**Integration Testing**:
1. Enable agent with test destination email
2. Classify email as "todo" (auto-classification)
3. Verify email forwarded immediately (onLabel)
4. Verify `todo_forwarded` label applied
5. Manually label another email as "todo"
6. Wait for next hourly execution
7. Verify manual label forwarded (postLabel)
8. Test label removal and re-application (idempotency)

**Production Validation**:
- Monitor execution logs for forward success rates
- Verify destination email receives formatted messages
- Check Gmail quota consumption (sendEmail daily limit)
- Validate HTML rendering in destination email client

### Performance Characteristics

**Execution Time**:
- onLabel processing: ~2-3 seconds per email (thread retrieval + formatting + send)
- postLabel scanning: ~1-2 seconds + (2-3 seconds × unforwarded count)
- Typical overhead: <10 seconds for <5 unforwarded emails

**Gmail API Quota**:
- Search: 1 query per execution (hourly)
- Read: 1 thread retrieval per forwarded email
- Send: 1 email per forwarded email (subject to daily quota: 100/day consumer, 1500/day workspace)
- Labels: 2-3 operations per forwarded email

**Memory Usage**:
- Thread data: ~10-50KB per thread (varies with message count and size)
- HTML formatting: Similar to thread data size
- Peak memory: ~100KB for typical todo emails

### Migration and Deployment

**Initial Deployment**:
1. Deploy updated codebase with `AgentTodoForwarder.gs`
2. Configure `TODO_FORWARDER_EMAIL` in Script Properties
3. Set optional behavior flags as desired
4. Test with `TODO_FORWARDER_DRY_RUN=true`
5. Monitor first few executions for errors
6. Set `TODO_FORWARDER_DRY_RUN=false` for production

**Existing Todo Emails**:
- First `postLabel` execution will process all existing `todo` labeled emails
- May result in batch of forwards on first run
- Monitor Gmail quota if large backlog exists
- Consider manual cleanup of old todo emails before enabling

**Rollback Procedure**:
1. Set `TODO_FORWARDER_ENABLED=false`
2. Agent will skip all processing but remain registered
3. Remove configuration properties if disabling permanently
4. `todo_forwarded` labels remain in Gmail (manual cleanup optional)

### Future Enhancement Considerations

**Potential Improvements**:
- Content-based filtering (forward only emails matching criteria)
- Multiple destination addresses based on todo categorization
- Custom HTML templates via configuration
- Integration with specific task management APIs (beyond email forwarding)
- Attachment handling (currently forwards links, not files)
- Summary batching (collect todos and forward in digest format)

**Not Planned (Out of Scope)**:
- Real-time forwarding (Apps Script has no real-time triggers)
- Bidirectional sync (task completion → Gmail label updates)
- Task management system-specific formatting
- AI-powered task extraction and formatting

## References

- ADR-001: Google Apps Script Platform Choice (architectural foundation)
- ADR-003: Label-Based Email Classification System (four-label system)
- ADR-004: Pluggable Agents Architecture (extensibility framework)
- ADR-011: Self-Contained Agent Architecture (independent module pattern)
- ADR-012: Generic Service Layer Pattern (reusable Gmail operations)
- ADR-017: Remove UserProperties-Based Agent Idempotency (label-based state)
- ADR-018: Dual-Hook Agent Architecture (onLabel + postLabel execution model)
- AgentReplyDrafter.gs: Reference implementation of dual-hook pattern
- AgentTemplate.gs: Template demonstrating agent development patterns
- Google Apps Script GmailApp documentation (email sending and formatting)
