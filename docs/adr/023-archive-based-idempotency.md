# ADR-023: Archive-Based Idempotency for Todo Forwarder Agent

**Status**: Accepted
**Date**: 2025-10-04
**Deciders**: Project team

## Context

The Todo Forwarder agent (ADR-020) was originally implemented with label-based idempotency tracking using a `todo_forwarded` label to prevent duplicate forwarding of emails. This approach required:

**Original Implementation Characteristics:**
- Created and managed a `todo_forwarded` label via `ensureTodoForwarderLabels_()` function
- Configuration properties `TODO_FORWARDER_REMOVE_TODO_LABEL` and `TODO_FORWARDER_ARCHIVE_AFTER_FORWARD` to control post-forward behavior
- Complex query logic combining multiple label conditions: `in:inbox label:todo -label:todo_forwarded`
- Two-phase label management (add forwarded label, optionally remove todo label, optionally archive)
- Manual label cleanup required if user wanted to re-forward

**Architectural Context:**

Following ADR-017's removal of UserProperties-based idempotency, the framework shifted to label-synchronized state management where Gmail labels represent the source of truth for system state. The Todo Forwarder's use of a tracking label (`todo_forwarded`) created similar state complexity:

- **State Visibility**: Users saw two labels (`todo` and `todo_forwarded`) when only one represented intent
- **Manual Recovery**: Removing `todo_forwarded` label required manual action to re-forward
- **Configuration Complexity**: Two separate properties to control label and archive behavior
- **Implementation Overhead**: Label creation, application, and optional removal logic

**Observation from Production:**

Email archiving is a natural, built-in Gmail operation that:
- Cannot be accidentally undone (requires explicit "Move to Inbox" action)
- Provides clear visual indicator in Gmail (inbox vs. archive)
- Is naturally idempotent (archive operation can be called multiple times safely)
- Represents "processed/completed" state in user mental models
- Requires no additional labels or configuration

**Requirements:**
1. **Prevent Duplicate Forwarding**: Ensure emails are forwarded only once
2. **Automatic Retry**: Failed forwards should retry on next execution
3. **Simple Configuration**: Minimize configuration properties
4. **Clear State**: Users should easily see forwarding status
5. **Natural Idempotency**: Use built-in Gmail features rather than custom labels

## Decision

We will **replace label-based idempotency (`todo_forwarded` label) with archive-based idempotency** where successfully forwarded emails are automatically archived with the `todo` label preserved. Archive status serves as the definitive indicator that an email has been forwarded.

### Core Implementation Changes

**Archive-Based Idempotency Strategy:**
- Successfully forwarded emails are **always archived** (non-configurable)
- The `todo` label is **preserved** after archiving (maintains todo categorization)
- Archive status indicates "already forwarded" - simple and unambiguous
- Failed forwards remain in inbox with `todo` label for automatic retry

**Simplified Query Pattern:**
```javascript
// NEW: Simple query - only inbox emails are candidates
const query = 'in:inbox label:todo';

// OLD: Complex query with multiple label conditions
const query = 'in:inbox label:todo -label:todo_forwarded';
```

**Idempotency Check Simplification:**
```javascript
// NEW: Archive status check (built-in Gmail property)
function isEmailForwarded_(thread) {
  return !thread.isInInbox();
}

// OLD: Label-based check (required custom label management)
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

**Removed Components:**
1. `ensureTodoForwarderLabels_()` function - no longer creates `todo_forwarded` label
2. `TODO_FORWARDER_REMOVE_TODO_LABEL` configuration property - todo label always preserved
3. `TODO_FORWARDER_ARCHIVE_AFTER_FORWARD` configuration property - archive always performed
4. Label application logic for `todo_forwarded` tracking label
5. Optional label removal logic for `todo` label

**Retained Components:**
- `TODO_FORWARDER_ENABLED` - enable/disable agent
- `TODO_FORWARDER_EMAIL` - destination email address
- `TODO_FORWARDER_DEBUG` - detailed logging
- `TODO_FORWARDER_DRY_RUN` - testing mode
- All email formatting and forwarding logic unchanged
- Dual-hook pattern (onLabel + postLabel) unchanged

### Implementation Details

**Forward Success Path:**
```javascript
// Forward the email
const forwardResult = forwardEmailThread_(ctx.threadId, config.TODO_FORWARDER_EMAIL);

if (!forwardResult.success) {
  // Leave in inbox with 'todo' label for retry on next run
  ctx.log('Forward failed - email left in inbox for retry');
  return { status: 'error', info: forwardResult.error };
}

// Archive on successful forward (keeps 'todo' label, marks as processed)
ctx.thread.moveToArchive();
```

**Automatic Retry Mechanism:**
- Email forward fails → remains in inbox with `todo` label
- Next hourly execution → postLabel scan finds email in inbox
- Forward attempted again → success → archived
- Natural retry without additional tracking or configuration

**User Re-Forward Workflow:**
- User moves archived email back to inbox (Gmail "Move to Inbox" action)
- Email now matches `in:inbox label:todo` query
- Next hourly execution → email is re-forwarded
- Email is archived again after successful forward

### Configuration Simplification

**Before (6 configuration properties):**
```javascript
TODO_FORWARDER_ENABLED=true
TODO_FORWARDER_EMAIL=tasks@example.com
TODO_FORWARDER_REMOVE_TODO_LABEL=true|false    // REMOVED
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD=true|false // REMOVED
TODO_FORWARDER_DEBUG=true|false
TODO_FORWARDER_DRY_RUN=true|false
```

**After (4 configuration properties):**
```javascript
TODO_FORWARDER_ENABLED=true
TODO_FORWARDER_EMAIL=tasks@example.com
TODO_FORWARDER_DEBUG=true|false
TODO_FORWARDER_DRY_RUN=true|false
```

## Alternatives Considered

### Alternative 1: Keep Label-Based Tracking with Optional Archive
**Description**: Maintain `todo_forwarded` label for idempotency but make archiving optional via configuration.

**Pros**:
- Flexibility for users who don't want emails archived
- Clear forwarded status visible via label
- Explicit tracking separate from archive state

**Cons**:
- Two configuration properties still required
- Additional label clutters Gmail UI
- Query complexity remains (`-label:todo_forwarded`)
- Label management overhead persists
- No clear benefit over archive-based approach for users who want archiving
- Users who don't want archiving likely don't want forwarding either

**Why not chosen**: Adds complexity without meaningful benefit. Users who want todos forwarded typically want them archived (workflow completion). Edge case of "forward but keep in inbox" doesn't justify configuration overhead.

### Alternative 2: Time-Based Idempotency with UserProperties
**Description**: Track forwarded emails with timestamp in UserProperties (e.g., don't re-forward for 7 days).

**Pros**:
- Invisible to users (no additional labels)
- Allows time-based re-forwarding
- Configurable retry windows

**Cons**:
- Violates ADR-017 (removal of UserProperties idempotency)
- Hidden state divergence from visible Gmail labels
- Arbitrary time windows don't respect user intent
- UserProperties quota consumption
- Complex state management and cleanup
- No recovery path for stuck state

**Why not chosen**: Contradicts architectural direction established in ADR-017. Introduces hidden state that diverges from user-visible Gmail state. Time-based retry is arbitrary and doesn't align with user intent signals.

### Alternative 3: Manual Re-Forward Only (No Automatic Retry)
**Description**: Forward once per email, require manual label reapplication for retry (no automatic retry on failure).

**Pros**:
- Simplest implementation
- No retry logic needed
- Failed forwards don't clutter execution logs

**Cons**:
- Poor user experience for transient failures (network issues, temporary quota limits)
- Requires manual intervention for recoverable errors
- Email gets "stuck" in failed state invisibly
- No automatic recovery mechanism

**Why not chosen**: Sacrifices reliability for simplicity. Transient network failures or temporary quota limits would leave emails unforwarded with no automatic recovery. Archive-based approach provides automatic retry without additional complexity.

### Alternative 4: Hybrid Label + Archive Approach
**Description**: Use both `todo_forwarded` label AND archiving, providing maximum user visibility.

**Pros**:
- Clear forwarded status via label
- Archive status provides secondary confirmation
- Easy to query forwarded emails (`label:todo_forwarded`)
- Maximum state visibility

**Cons**:
- Label is redundant with archive status
- Increases implementation complexity (manage both label and archive)
- More Gmail API operations (label + archive vs. archive only)
- Two sources of truth for same state (label + archive)
- Violates simplicity goals

**Why not chosen**: Archive status alone provides sufficient idempotency tracking. Adding label creates redundant state without meaningful benefit. Simplicity and reduced API overhead outweigh marginal gains in visibility.

### Alternative 5: Archive-Based Idempotency (CHOSEN)
**Description**: Use archive status as sole idempotency indicator. Successfully forwarded emails are archived with `todo` label preserved.

**Pros**:
- **Simplest Implementation**: Single archive operation, no label management
- **Natural Gmail Semantics**: Archive represents "processed/done" in user mental models
- **Built-in Idempotency**: Archive operation is naturally idempotent
- **Automatic Retry**: Failed forwards stay in inbox, retry on next run
- **Reduced Configuration**: Eliminates 2 configuration properties
- **Fewer API Operations**: Archive only (no label creation, application, removal)
- **Clear User Intent**: Moving to inbox = "process again"
- **No Additional Labels**: Only `todo` label visible to users
- **Self-Cleaning**: Archived emails naturally filtered from inbox queries

**Cons**:
- **Breaking Change**: Existing `todo_forwarded` labels ignored after migration
- **Archive Requirement**: Users cannot forward without archiving
- **Edge Case**: Un-archiving email will cause re-forward (acceptable - explicit user action)
- **Migration Needed**: Existing deployments must handle deprecated properties

**Why chosen**: Provides optimal balance of simplicity, reliability, and user experience. Archive-based idempotency aligns with Gmail's built-in semantics and user mental models. Automatic retry for failed forwards improves reliability without additional complexity. Configuration simplification reduces setup burden.

## Consequences

### Positive

**Simplicity and Maintainability:**
- **Simpler Implementation**: Removed ~50 lines of label management code
- **Fewer Configuration Properties**: 4 properties instead of 6 (33% reduction)
- **Reduced Complexity**: Single archive operation vs. multi-step label management
- **Clearer Code**: Archive intent is self-documenting

**User Experience:**
- **Cleaner Gmail UI**: Only `todo` label visible (no tracking labels)
- **Natural Semantics**: Archive = "processed" matches user mental models
- **Clear State Visibility**: Inbox vs. archive shows forwarding status at a glance
- **Intentional Re-Forward**: Moving to inbox explicitly signals "process again"
- **Less Configuration**: Fewer properties to understand and set

**Reliability:**
- **Automatic Retry**: Failed forwards remain in inbox for automatic retry
- **Built-in Idempotency**: Archive operation is naturally idempotent
- **No State Divergence**: Archive status cannot conflict with labels
- **Fail-Safe**: Errors leave email in visible state (inbox) rather than hidden

**Performance:**
- **Fewer API Calls**: Archive only (no label creation, application, removal)
- **Simpler Queries**: `in:inbox label:todo` vs. `in:inbox label:todo -label:todo_forwarded`
- **Faster Execution**: One operation instead of 2-3 label operations

**Architectural Alignment:**
- **Consistent with ADR-017**: Uses Gmail state (archive) rather than custom tracking
- **Label Synchronization**: Archive status is built-in Gmail property
- **Transparent State**: All state visible through Gmail UI

### Negative

**Migration Requirements:**
- **Breaking Change**: Existing `todo_forwarded` labels will be ignored
- **Configuration Cleanup**: Users must remove deprecated properties from Script Properties
- **Manual Migration**: Existing forwarded emails with `todo_forwarded` label should be archived manually
- **Documentation Updates**: All references to removed properties must be updated

**Workflow Constraints:**
- **Forced Archiving**: Users cannot forward without archiving (not configurable)
- **Un-Archive Re-Forward**: Moving email to inbox will cause re-forward (acceptable edge case)
- **Todo Label Preserved**: Users who wanted todo label removed must do so manually

**Edge Cases:**
- **Accidental Un-Archive**: User un-archives email → re-forwarded on next run (explicit user action, acceptable)
- **External Archive**: If email archived by other means before forward → skipped as "already forwarded" (rare, acceptable)
- **Bulk Operations**: Bulk move to inbox → all emails re-forwarded (explicit action, acceptable)

### Neutral

**Behavioral Changes:**
- **Default Behavior**: All successful forwards now archive (was optional, now required)
- **Label Retention**: Todo label always preserved (was optional removal, now required)
- **Query Simplification**: Inbox check replaces label check (implementation detail)

**Implementation Notes:**
- **Gmail API Operations**: Reduced from 2-3 operations to 1 operation per forward
- **Execution Time**: Slightly faster due to fewer operations
- **Error Handling**: Unchanged - errors still logged and returned

## Implementation Notes

### Code Changes Summary

**Removed Functions:**
```javascript
// REMOVED: No longer needed - no custom labels created
function ensureTodoForwarderLabels_() {
  // ... label creation logic removed
}
```

**Updated Configuration:**
```javascript
function getTodoForwarderConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    TODO_FORWARDER_ENABLED: (props.getProperty('TODO_FORWARDER_ENABLED') || 'true').toLowerCase() === 'true',
    TODO_FORWARDER_EMAIL: props.getProperty('TODO_FORWARDER_EMAIL'),
    // REMOVED: TODO_FORWARDER_REMOVE_TODO_LABEL
    // REMOVED: TODO_FORWARDER_ARCHIVE_AFTER_FORWARD
    TODO_FORWARDER_DEBUG: (props.getProperty('TODO_FORWARDER_DEBUG') || 'false').toLowerCase() === 'true',
    TODO_FORWARDER_DRY_RUN: (props.getProperty('TODO_FORWARDER_DRY_RUN') || 'false').toLowerCase() === 'true'
  };
}
```

**Updated Idempotency Check:**
```javascript
// NEW: Archive-based check
function isEmailForwarded_(thread) {
  try {
    // If thread is not in inbox, it's been archived (and thus forwarded)
    return !thread.isInInbox();
  } catch (error) {
    Logger.log('Error checking forwarded status: ' + error.toString());
    return false;
  }
}

// OLD: Label-based check (REMOVED)
// function isEmailForwarded_(thread) {
//   const labels = thread.getLabels();
//   for (let i = 0; i < labels.length; i++) {
//     if (labels[i].getName() === 'todo_forwarded') {
//       return true;
//     }
//   }
//   return false;
// }
```

**Updated Forward Logic:**
```javascript
// Forward the email
const forwardResult = forwardEmailThread_(ctx.threadId, config.TODO_FORWARDER_EMAIL);

if (!forwardResult.success) {
  // Leave in inbox with 'todo' label for retry on next run
  ctx.log('Forward failed: ' + forwardResult.error + ' - email left in inbox for retry');
  return { status: 'error', info: forwardResult.error };
}

// Archive on successful forward (keeps 'todo' label, marks as processed)
ctx.thread.moveToArchive();
// REMOVED: Optional todo label removal
// REMOVED: Optional archive based on config
// REMOVED: Apply todo_forwarded label
```

**Updated postLabel Query:**
```javascript
// NEW: Simple query - inbox emails only
const query = 'in:inbox label:todo';

// OLD: Complex query with label exclusion (REMOVED)
// const query = 'in:inbox label:todo -label:todo_forwarded';
```

### Migration Guide

**Step 1: Remove Deprecated Configuration Properties**

In Apps Script editor → Project Settings → Script Properties:
```
REMOVE: TODO_FORWARDER_REMOVE_TODO_LABEL
REMOVE: TODO_FORWARDER_ARCHIVE_AFTER_FORWARD
```

**Step 2: Clean Up Existing Forwarded Emails (Optional)**

If you have emails with the old `todo_forwarded` label:
```javascript
// Optional cleanup function - run once after migration
function migrateTodoForwarderLabels_() {
  const threads = GmailApp.search('label:todo_forwarded');
  let archived = 0;

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];
    if (thread.isInInbox()) {
      thread.moveToArchive();
      archived++;
    }
  }

  Logger.log(`Migration complete: Archived ${archived} emails previously marked todo_forwarded`);

  // Optional: Remove todo_forwarded label entirely from Gmail
  const label = GmailApp.getUserLabelByName('todo_forwarded');
  if (label) {
    label.deleteLabel();
    Logger.log('Removed todo_forwarded label from Gmail');
  }
}
```

**Step 3: Deploy Updated Code**

Deploy the updated `AgentTodoForwarder.gs` file:
```bash
npm run deploy:personal  # or deploy:work, deploy:all
```

**Step 4: Verify Behavior**

1. Label an email with `todo` (or let classification apply it)
2. Verify email is forwarded to configured address
3. Verify email is archived automatically
4. Verify `todo` label is preserved on archived email
5. Test retry: Move archived email to inbox → verify re-forward on next run

**Step 5: Monitor First Few Executions**

Check execution logs for:
- Successful forwards and archives
- Failed forwards remaining in inbox
- No errors related to missing labels or properties

### Dry-Run Testing

Test the new behavior before production:
```javascript
// In Script Properties:
TODO_FORWARDER_DRY_RUN=true
TODO_FORWARDER_DEBUG=true

// Check logs to verify:
// "DRY RUN - Would forward email to [email] and archive"
```

### Error Handling Changes

**Forward Failure Behavior:**
```javascript
// Forward fails → email stays in inbox with todo label
// Next execution → automatic retry (found by in:inbox label:todo query)
// Success → archived and removed from inbox queries
// No manual intervention needed for transient failures
```

**Archive Failure Behavior:**
```javascript
// Archive is naturally idempotent
// Multiple archive calls are safe (no-op if already archived)
// Archive errors are rare (usually permission issues)
```

### User Workflows

**Normal Workflow (Automatic Forwarding):**
1. Email classified as `todo` → labeled automatically
2. onLabel hook forwards immediately → archives on success
3. Email disappears from inbox (archived with `todo` label)
4. User can view in "All Mail" or `label:todo` to see archived todos

**Manual Forward Workflow:**
1. User manually applies `todo` label to email
2. postLabel scan on next hourly execution finds email
3. Email forwarded → archived on success
4. Email disappears from inbox

**Re-Forward Workflow:**
1. User moves archived todo email back to inbox (Gmail "Move to Inbox")
2. Next hourly execution finds `in:inbox label:todo`
3. Email re-forwarded → archived again
4. Explicit user action, expected behavior

**Failed Forward Retry Workflow:**
1. Forward fails (network issue, quota, etc.)
2. Email remains in inbox with `todo` label
3. Next hourly execution retries automatically
4. Success → archived | Failure → remains in inbox for next retry
5. No manual intervention required

### Performance Characteristics

**API Operations (Before):**
- Search: `in:inbox label:todo -label:todo_forwarded` (1 query)
- Get labels: Check for `todo_forwarded` (1 API call per email)
- Add label: Apply `todo_forwarded` (1 API call per email)
- Remove label: Optionally remove `todo` (0-1 API call per email)
- Archive: Optionally archive (0-1 API call per email)
- **Total**: 3-5 operations per forwarded email

**API Operations (After):**
- Search: `in:inbox label:todo` (1 query)
- Check inbox status: `thread.isInInbox()` (no additional API call - cached property)
- Archive: Always archive (1 API call per email)
- **Total**: 1-2 operations per forwarded email

**Performance Improvement**: 40-60% reduction in Gmail API operations per forwarded email.

### Security and Privacy Considerations

**No Changes**: Archive-based approach has identical security profile to label-based approach:
- Same email forwarding mechanism (GmailApp.sendEmail)
- Same access to email content and threads
- Same destination email configuration
- Archive operation is local Gmail operation (no external data exposure)

**Improved Privacy**: Fewer labels means less metadata leakage in Gmail UI.

### Testing Strategy

**Unit Tests:**
- `isEmailForwarded_()` returns true for archived threads
- `isEmailForwarded_()` returns false for inbox threads
- Configuration loading works without removed properties

**Integration Tests:**
1. **Successful Forward**: Label email → verify forward → verify archive → verify todo label preserved
2. **Failed Forward**: Simulate forward error → verify email stays in inbox → verify retry on next run
3. **Re-Forward**: Archive email → move to inbox → verify re-forward → verify re-archive
4. **Idempotency**: Call forward twice in same execution → verify single forward and archive
5. **Dry-Run**: Enable dry-run → verify no actual forward or archive

**Regression Tests:**
- Verify onLabel hook still runs during classification
- Verify postLabel hook still scans inbox after labeling
- Verify error handling preserves inbox status on failure
- Verify dry-run mode works correctly

### Rollback Procedure

If issues arise after migration:

**Option 1: Revert to Previous Version**
```bash
# Revert Git repository to previous commit
git checkout [commit-before-adr-023]
npm run deploy:[account]

# Re-add configuration properties:
TODO_FORWARDER_REMOVE_TODO_LABEL=false
TODO_FORWARDER_ARCHIVE_AFTER_FORWARD=true
```

**Option 2: Disable Agent Temporarily**
```javascript
// In Script Properties:
TODO_FORWARDER_ENABLED=false

// Agent will skip all processing
// Fix issues, then re-enable
```

## References

- **ADR-003**: Label-Based Email Classification (four-label system foundation)
- **ADR-004**: Pluggable Agents Architecture (agent framework)
- **ADR-011**: Self-Contained Agent Architecture (independent agent modules)
- **ADR-017**: Remove UserProperties-Based Agent Idempotency (label-synchronized state management)
- **ADR-018**: Dual-Hook Agent Architecture (onLabel + postLabel execution model)
- **ADR-020**: Todo Forwarder Agent Implementation (original implementation with label-based idempotency)
- **Gmail API Documentation**: Thread.moveToArchive() and Thread.isInInbox() methods
- **Google Apps Script Best Practices**: Minimizing API calls and quota usage
