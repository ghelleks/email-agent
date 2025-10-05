/**
 * Todo Forwarder Agent - Self-Contained Implementation
 *
 * This agent implements automated forwarding for emails labeled "todo":
 * - Forwards todo emails to a configured email address
 * - Archives successfully forwarded emails (keeps todo label)
 * - Leaves failed forwards in inbox for retry
 * - Supports both immediate forwarding (onLabel) and inbox scanning (postLabel)
 *
 * Dual-Hook Architecture:
 * 1. onLabel: Runs during classification (immediate forward for newly-classified emails)
 * 2. postLabel: Runs after all labeling (scans inbox for manually-labeled emails)
 *
 * Idempotency Strategy:
 * - Only processes emails with "todo" label that are IN THE INBOX
 * - Successfully forwarded emails are archived (with todo label preserved)
 * - Failed forwards remain in inbox for automatic retry on next run
 * - Archive status indicates "already forwarded" - simple and reliable
 *
 * Features:
 * - Self-contained: manages own config without core Config.gs changes
 * - Idempotent: archive-based tracking prevents duplicates
 * - Thread-aware: forwards complete email threads with context
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if email has already been forwarded
 * Returns true if email is archived (indicating successful forward)
 *
 * Archive-based idempotency strategy:
 * - Successfully forwarded emails are archived with 'todo' label
 * - Only inbox emails with 'todo' label are processed
 * - Simple, reliable, and requires no additional labels
 *
 * @param {GmailThread} thread - Gmail thread object
 * @return {boolean} True if email has been forwarded (is archived)
 */
function isEmailForwarded_(thread) {
  try {
    // If thread is not in inbox, it's been archived (and thus forwarded)
    return !thread.isInInbox();
  } catch (error) {
    Logger.log('Error checking forwarded status: ' + error.toString());
    return false;
  }
}

/**
 * Get email thread data for forwarding
 * Returns formatted email content with full thread context
 *
 * @param {string} threadId - Gmail thread ID
 * @return {Object} Thread data object
 */
function getEmailThreadForForwarding_(threadId) {
  try {
    const thread = GmailApp.getThreadById(threadId);

    if (!thread) {
      throw new Error('Thread not found: ' + threadId);
    }

    const messages = thread.getMessages();
    const threadData = {
      id: threadId,
      subject: thread.getFirstMessageSubject() || '(No Subject)',
      messageCount: messages.length,
      messages: []
    };

    // Extract all messages in the thread
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      threadData.messages.push({
        from: msg.getFrom(),
        to: msg.getTo(),
        subject: msg.getSubject(),
        date: msg.getDate().toISOString(),
        body: msg.getPlainBody() || msg.getBody() || ''
      });
    }

    return threadData;

  } catch (error) {
    throw new Error('Failed to retrieve email thread: ' + error.toString());
  }
}

/**
 * Format email thread as HTML for forwarding
 * Creates readable HTML representation of the entire thread
 *
 * @param {Object} threadData - Thread data from getEmailThreadForForwarding_
 * @return {string} HTML formatted email content
 */
function formatEmailThreadAsHtml_(threadData) {
  const parts = [];

  parts.push('<html><body style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">');
  parts.push('<h2 style="color: #333; border-bottom: 2px solid #4285f4; padding-bottom: 10px;">');
  parts.push('Todo: ' + threadData.subject);
  parts.push('</h2>');

  parts.push('<p style="color: #666; font-size: 14px; margin-bottom: 20px;">');
  parts.push('This email thread contains ' + threadData.messageCount + ' message(s).');
  parts.push('</p>');

  // Add Gmail link
  const gmailUrl = 'https://mail.google.com/mail/u/0/#inbox/' + threadData.id;
  parts.push('<p style="margin-bottom: 20px;">');
  parts.push('<a href="' + gmailUrl + '" style="color: #4285f4; text-decoration: none; font-weight: bold;">');
  parts.push('→ View in Gmail');
  parts.push('</a>');
  parts.push('</p>');

  // Add each message in the thread
  for (let i = 0; i < threadData.messages.length; i++) {
    const msg = threadData.messages[i];

    parts.push('<div style="background: #f5f5f5; padding: 15px; margin-bottom: 15px; border-radius: 5px;">');
    parts.push('<div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #ddd;">');
    parts.push('<strong>From:</strong> ' + msg.from + '<br>');
    parts.push('<strong>To:</strong> ' + msg.to + '<br>');
    parts.push('<strong>Date:</strong> ' + new Date(msg.date).toLocaleString() + '<br>');
    if (msg.subject) {
      parts.push('<strong>Subject:</strong> ' + msg.subject);
    }
    parts.push('</div>');

    // Clean and format body
    const body = msg.body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    parts.push('<div style="white-space: pre-wrap; word-wrap: break-word;">');
    parts.push(body);
    parts.push('</div>');
    parts.push('</div>');
  }

  // Add footer
  parts.push('<hr style="margin-top: 30px; border: none; border-top: 1px solid #ccc;">');
  parts.push('<p style="color: #999; font-size: 12px; margin-top: 15px;">');
  parts.push('Forwarded by Todo Forwarder Agent | <a href="' + gmailUrl + '">View Original</a>');
  parts.push('</p>');

  parts.push('</body></html>');

  return parts.join('\n');
}

/**
 * Forward email thread to configured address
 * Uses GmailApp to send formatted email
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

    // Get thread data
    const threadData = getEmailThreadForForwarding_(threadId);

    // Format as HTML
    const htmlContent = formatEmailThreadAsHtml_(threadData);

    // Forward email
    const subject = '[Todo] ' + threadData.subject;
    GmailApp.sendEmail(
      toEmail,
      subject,
      'This email requires HTML support to display properly.',
      {
        htmlBody: htmlContent
      }
    );

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
      ctx.log('DRY RUN - Would forward email to ' + config.TODO_FORWARDER_EMAIL + ' and archive');
      return { status: 'ok', info: 'dry-run mode - email would be forwarded and archived' };
    }

    // Check if already forwarded (idempotent via archive status)
    if (isEmailForwarded_(ctx.thread)) {
      ctx.log('Email already forwarded (archived), skipping');
      return { status: 'skip', info: 'already forwarded (archived)' };
    }

    // Forward the email
    const forwardResult = forwardEmailThread_(ctx.threadId, config.TODO_FORWARDER_EMAIL);

    if (!forwardResult.success) {
      // Leave in inbox with 'todo' label for retry on next run
      ctx.log('Forward failed: ' + forwardResult.error + ' - email left in inbox for retry');
      return { status: 'error', info: forwardResult.error };
    }

    // Archive on successful forward (keeps 'todo' label, marks as processed)
    ctx.thread.moveToArchive();

    if (config.TODO_FORWARDER_DEBUG) {
      ctx.log('Email forwarded and archived successfully');
    }

    ctx.log('Email forwarded successfully to ' + config.TODO_FORWARDER_EMAIL);
    return {
      status: 'ok',
      info: 'email forwarded and archived'
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
 * Archive-based idempotency:
 * - Only processes emails IN THE INBOX with 'todo' label
 * - Successfully forwarded emails are archived (automatic deduplication)
 * - Failed forwards remain in inbox for automatic retry
 *
 * This complements the onLabel handler which runs during classification.
 * No parameters - scans inbox independently and uses archive status for idempotency.
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

    // Find all emails with "todo" label that are IN THE INBOX (not archived)
    // Archive status indicates already forwarded - simple and reliable
    const query = 'in:inbox label:todo';
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
        // Double-check still in inbox (idempotency via archive status)
        if (isEmailForwarded_(thread)) {
          skipped++;
          if (config.TODO_FORWARDER_DEBUG) {
            Logger.log(`Todo Forwarder postLabel: Skipping thread ${threadId} (already forwarded/archived)`);
          }
          continue;
        }

        // Forward email
        if (config.TODO_FORWARDER_DRY_RUN) {
          Logger.log(`Todo Forwarder postLabel: DRY RUN - Would forward and archive thread ${threadId}`);
        } else {
          const forwardResult = forwardEmailThread_(threadId, config.TODO_FORWARDER_EMAIL);

          if (!forwardResult.success) {
            // Leave in inbox with 'todo' label for retry on next run
            Logger.log(`Todo Forwarder postLabel: Failed to forward thread ${threadId} - ${forwardResult.error} - left in inbox for retry`);
            errors++;
            continue;
          }

          // Archive on successful forward (keeps 'todo' label, marks as processed)
          thread.moveToArchive();

          Logger.log(`Todo Forwarder postLabel: Forwarded and archived thread ${threadId} to ${config.TODO_FORWARDER_EMAIL}`);
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
