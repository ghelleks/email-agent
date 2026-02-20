/**
 * Todo Forwarder Agent - Self-Contained Implementation
 *
 * This agent implements automated forwarding for emails labeled "todo":
 * - Forwards todo emails to a configured email address using native Gmail forwarding
 * - Preserves original email formatting, attachments, and thread structure
 * - Applies "todo-forwarded" label after successful forward (keeps email in inbox)
 * - Leaves failed forwards in inbox for retry
 * - Supports both immediate forwarding (onLabel) and inbox scanning (postLabel)
 *
 * Dual-Hook Architecture:
 * 1. onLabel: Runs during classification (immediate forward for newly-classified emails)
 * 2. postLabel: Runs after all labeling (scans inbox for manually-labeled emails)
 *
 * Idempotency Strategy:
 * - Only processes emails with "todo" label that are IN THE INBOX without "todo-forwarded" label
 * - Successfully forwarded emails receive "todo-forwarded" label and remain in inbox
 * - Failed forwards remain in inbox without "todo-forwarded" label for automatic retry on next run
 * - Label-based idempotency allows user to manually archive todo emails after acting on them
 *
 * Features:
 * - Self-contained: manages own config without core Config.gs changes
 * - Idempotent: label-based tracking prevents duplicates
 * - Native forwarding: uses Gmail's built-in forward() method to preserve email structure
 * - Dual-mode: immediate + inbox scanning without separate trigger
 * - Full error handling and dry-run support
 * - Automatic retry for failed forwards
 */

// ============================================================================
// Configuration Management (Self-Contained)
// ============================================================================

/**
 * Get Todo Forwarder agent configuration with sensible defaults
 * Manages own PropertiesService keys without core Config.gs changes
 */
function getTodoForwarderConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    // Agent enablement
    TODO_FORWARDER_ENABLED: (props.getProperty('TODO_FORWARDER_ENABLED') || 'true').toLowerCase() === 'true',

    // Forwarding configuration
    TODO_FORWARDER_EMAIL: props.getProperty('TODO_FORWARDER_EMAIL'),

    // Debugging and testing
    TODO_FORWARDER_DEBUG: (props.getProperty('TODO_FORWARDER_DEBUG') || 'false').toLowerCase() === 'true',
    TODO_FORWARDER_DRY_RUN: (props.getProperty('TODO_FORWARDER_DRY_RUN') || 'false').toLowerCase() === 'true'
  };
}

/**
 * Ensure "todo-forwarded" label exists for tracking forwarded emails
 * Creates label if it doesn't exist, returns label object
 */
function ensureTodoForwardedLabel_() {
  const labelName = 'todo-forwarded';
  return GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if email has already been forwarded
 * Returns true if thread has the "todo-forwarded" label
 *
 * Label-based idempotency strategy:
 * - Successfully forwarded emails receive "todo-forwarded" label and stay in inbox
 * - Only inbox emails with "todo" but without "todo-forwarded" are processed
 * - Allows user to manually archive todo emails after acting on them
 *
 * @param {GmailThread} thread - Gmail thread object
 * @return {boolean} True if email has been forwarded (has todo-forwarded label)
 */
function isEmailForwarded_(thread) {
  try {
    const forwardedLabel = GmailApp.getUserLabelByName('todo-forwarded');
    if (!forwardedLabel) {
      return false;
    }
    const threadLabels = thread.getLabels();
    for (let i = 0; i < threadLabels.length; i++) {
      if (threadLabels[i].getName() === 'todo-forwarded') {
        return true;
      }
    }
    return false;
  } catch (error) {
    Logger.log('Error checking forwarded status: ' + error.toString());
    return false;
  }
}

/**
 * Forward email thread to configured address using native Gmail forwarding
 * Forwards the email as-is, preserving original formatting and attachments
 *
 * @param {string} threadId - Gmail thread ID
 * @param {string} toEmail - Destination email address
 * @return {Object} Result object with success status
 */
function forwardEmailThread_(threadId, toEmail) {
  try {
    if (!toEmail) {
      return {
        success: false,
        error: 'No destination email configured (TODO_FORWARDER_EMAIL)'
      };
    }

    // Get thread
    const thread = GmailApp.getThreadById(threadId);
    if (!thread) {
      return {
        success: false,
        error: 'Thread not found: ' + threadId
      };
    }

    // Get all messages in the thread
    const messages = thread.getMessages();
    if (messages.length === 0) {
      return {
        success: false,
        error: 'Thread has no messages: ' + threadId
      };
    }

    // Forward the latest message in the thread (contains full thread context)
    // Gmail's native forward preserves the original email structure, attachments, and formatting
    const latestMessage = messages[messages.length - 1];
    latestMessage.forward(toEmail);

    return {
      success: true,
      message: 'Email forwarded to ' + toEmail
    };

  } catch (error) {
    Logger.log('Error forwarding email: ' + error.toString());
    return {
      success: false,
      error: 'Failed to forward email: ' + error.toString()
    };
  }
}

// ============================================================================
// Main Agent Logic - onLabel Hook
// ============================================================================

/**
 * Todo Forwarder agent onLabel handler function
 * Integrates with existing agent framework and context system
 * ctx provides: label, decision, threadId, thread (GmailThread), cfg, dryRun, log(msg)
 * Returns { status: 'ok'|'skip'|'retry'|'error', info?: string }
 */
function processTodoForward_(ctx) {
  try {
    const config = getTodoForwarderConfig_();

    // Check if agent is enabled
    if (!config.TODO_FORWARDER_ENABLED) {
      return { status: 'skip', info: 'todo forwarder agent disabled' };
    }

    // Validate configuration
    if (!config.TODO_FORWARDER_EMAIL) {
      ctx.log('Todo Forwarder: No destination email configured');
      return { status: 'error', info: 'TODO_FORWARDER_EMAIL not configured' };
    }

    ctx.log('Todo Forwarder agent running for thread ' + ctx.threadId);

    // Check for dry-run mode
    if (ctx.dryRun || config.TODO_FORWARDER_DRY_RUN) {
      ctx.log('DRY RUN - Would forward email to ' + config.TODO_FORWARDER_EMAIL + ' and apply todo-forwarded label');
      return { status: 'ok', info: 'dry-run mode - email would be forwarded and labeled todo-forwarded' };
    }

    // Check if already forwarded (idempotent via todo-forwarded label)
    if (isEmailForwarded_(ctx.thread)) {
      ctx.log('Email already forwarded (has todo-forwarded label), skipping');
      return { status: 'skip', info: 'already forwarded (todo-forwarded label present)' };
    }

    // Forward the email
    const forwardResult = forwardEmailThread_(ctx.threadId, config.TODO_FORWARDER_EMAIL);

    if (!forwardResult.success) {
      // Leave in inbox with 'todo' label for retry on next run
      ctx.log('Forward failed: ' + forwardResult.error + ' - email left in inbox for retry');
      return { status: 'error', info: forwardResult.error };
    }

    // Apply "todo-forwarded" label (idempotency — stays in inbox for manual archiving)
    const forwardedLabel = ensureTodoForwardedLabel_();
    ctx.thread.addLabel(forwardedLabel);

    if (config.TODO_FORWARDER_DEBUG) {
      ctx.log('Email forwarded and labeled todo-forwarded (stays in inbox)');
    }

    ctx.log('Email forwarded successfully to ' + config.TODO_FORWARDER_EMAIL);
    return {
      status: 'ok',
      info: 'email forwarded, labeled todo-forwarded, kept in inbox'
    };

  } catch (error) {
    ctx.log('Todo Forwarder agent error: ' + error.toString());
    return { status: 'error', info: error.toString() };
  }
}

// ============================================================================
// postLabel Handler - Inbox-Wide Scanning
// ============================================================================

/**
 * Scan all existing emails with "todo" label (postLabel hook)
 * Runs after all classification/labeling complete to handle:
 * - Manually labeled emails
 * - Emails labeled before agent was deployed
 * - Failed forwards that need retry
 *
 * Label-based idempotency:
 * - Only processes emails IN THE INBOX with 'todo' label and without 'todo-forwarded' label
 * - Successfully forwarded emails receive 'todo-forwarded' label (stays in inbox)
 * - Failed forwards remain in inbox without 'todo-forwarded' label for automatic retry
 *
 * This complements the onLabel handler which runs during classification.
 * No parameters - scans inbox independently and uses label status for idempotency.
 */
function todoForwarderPostLabelScan_() {
  try {
    const config = getTodoForwarderConfig_();

    if (!config.TODO_FORWARDER_ENABLED) {
      return;
    }

    // Validate configuration
    if (!config.TODO_FORWARDER_EMAIL) {
      Logger.log('Todo Forwarder postLabel: No destination email configured');
      return;
    }

    if (config.TODO_FORWARDER_DEBUG) {
      Logger.log('Todo Forwarder postLabel: Starting inbox scan');
    }

    // Find all emails with "todo" label that are IN THE INBOX and without "todo-forwarded" label
    // Label status indicates already forwarded - allows manual archiving by user
    const query = 'in:inbox label:todo -label:todo-forwarded';
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
      if (config.TODO_FORWARDER_DEBUG) {
        Logger.log('Todo Forwarder postLabel: No unforwarded emails found with todo label');
      }
      return;
    }

    if (config.TODO_FORWARDER_DEBUG) {
      Logger.log(`Todo Forwarder postLabel: Found ${threads.length} unforwarded emails with todo label`);
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const threadId = thread.getId();

      try {
        // Double-check still unforwarded (idempotency via todo-forwarded label)
        if (isEmailForwarded_(thread)) {
          skipped++;
          if (config.TODO_FORWARDER_DEBUG) {
            Logger.log(`Todo Forwarder postLabel: Skipping thread ${threadId} (already has todo-forwarded label)`);
          }
          continue;
        }

        // Forward email
        if (config.TODO_FORWARDER_DRY_RUN) {
          Logger.log(`Todo Forwarder postLabel: DRY RUN - Would forward and label todo-forwarded thread ${threadId}`);
        } else {
          const forwardResult = forwardEmailThread_(threadId, config.TODO_FORWARDER_EMAIL);

          if (!forwardResult.success) {
            // Leave in inbox with 'todo' label for retry on next run
            Logger.log(`Todo Forwarder postLabel: Failed to forward thread ${threadId} - ${forwardResult.error} - left in inbox for retry`);
            errors++;
            continue;
          }

          // Apply "todo-forwarded" label (idempotency — stays in inbox for manual archiving)
          const forwardedLabel = ensureTodoForwardedLabel_();
          thread.addLabel(forwardedLabel);

          Logger.log(`Todo Forwarder postLabel: Forwarded thread ${threadId} to ${config.TODO_FORWARDER_EMAIL} (labeled todo-forwarded, kept in inbox)`);
        }

        processed++;

      } catch (error) {
        errors++;
        Logger.log(`Todo Forwarder postLabel: Error processing thread ${threadId} - ${error.toString()}`);
      }
    }

    if (processed > 0 || errors > 0) {
      Logger.log(`Todo Forwarder postLabel completed: processed ${processed}, skipped ${skipped}, errors ${errors} (total: ${threads.length})`);
    } else if (config.TODO_FORWARDER_DEBUG) {
      Logger.log(`Todo Forwarder postLabel: All ${threads.length} emails already forwarded`);
    }

  } catch (error) {
    Logger.log('Todo Forwarder postLabel error: ' + error.toString());
  }
}

// ============================================================================
// Agent Registration
// ============================================================================

if (typeof AGENT_MODULES === 'undefined') {
  AGENT_MODULES = [];
}

AGENT_MODULES.push(function(api) {
  /**
   * Register Todo Forwarder agent for "todo" label
   * Agent forwards todo emails to configured address
   *
   * Uses dual-hook pattern:
   * - onLabel: Immediate forwarding during classification
   * - postLabel: Inbox scan to catch manually-labeled emails
   */
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
