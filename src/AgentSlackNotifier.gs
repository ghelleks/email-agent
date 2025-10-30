/**
 * Slack Notifier Agent - Self-Contained Implementation
 *
 * This agent implements Slack notifications for labeling decisions:
 * - Sends Slack notifications when certain labels are applied to emails
 * - Configurable via Script Properties with minimal setup required
 * - Supports selective notification by label type
 * - Graceful error handling (failures don't break email processing)
 *
 * Architecture:
 * - Uses onLabel hook to notify immediately when labels are applied
 * - Self-contained: manages own config without core Config.gs changes
 * - No idempotency needed - notifications are side effects
 *
 * Features:
 * - Minimal configuration (only 2 required properties)
 * - Selective notifications by label type
 * - Rich Slack message formatting with email details
 * - Full error handling and dry-run support
 */

// ============================================================================
// Configuration Management (Self-Contained)
// ============================================================================

/**
 * Get Slack Notifier agent configuration with sensible defaults
 * Manages own PropertiesService keys without core Config.gs changes
 *
 * @return {Object} Configuration object
 */
function getSlackNotifierConfig_() {
  const props = PropertiesService.getScriptProperties();
  
  // Parse SLACK_LABELS JSON array (default: all labels if not set)
  let slackLabels = null;
  const labelsStr = props.getProperty('SLACK_LABELS');
  if (labelsStr) {
    try {
      slackLabels = JSON.parse(labelsStr);
      if (!Array.isArray(slackLabels)) slackLabels = null;
    } catch (e) {
      // Invalid JSON - default to null (all labels)
      slackLabels = null;
    }
  }
  
  return {
    // Agent enablement
    SLACK_ENABLED: (props.getProperty('SLACK_ENABLED') || 'false').toLowerCase() === 'true',
    
    // Webhook configuration (required)
    SLACK_WEBHOOK_URL: props.getProperty('SLACK_WEBHOOK_URL'),
    
    // Label filtering (null = all labels, [] = disabled, ['label1'] = specific labels)
    SLACK_LABELS: slackLabels,
    
    // Optional customization
    SLACK_USERNAME: props.getProperty('SLACK_USERNAME') || 'Email Agent',
    SLACK_CHANNEL: props.getProperty('SLACK_CHANNEL') || null, // null = use webhook default
    SLACK_ICON_EMOJI: props.getProperty('SLACK_ICON_EMOJI') || ':email:',
    SLACK_DEBUG: (props.getProperty('SLACK_DEBUG') || 'false').toLowerCase() === 'true'
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if notification should be sent for this label
 * 
 * @param {string} label - Label name to check
 * @param {Object} config - Slack notifier configuration
 * @return {boolean} True if notification should be sent
 */
function shouldNotifyForLabel_(label, config) {
  // If SLACK_LABELS is null, notify for all labels
  if (config.SLACK_LABELS === null) {
    return true;
  }
  
  // If SLACK_LABELS is empty array, disable notifications
  if (Array.isArray(config.SLACK_LABELS) && config.SLACK_LABELS.length === 0) {
    return false;
  }
  
  // If SLACK_LABELS is array, check if label is in it
  if (Array.isArray(config.SLACK_LABELS)) {
    return config.SLACK_LABELS.indexOf(label) !== -1;
  }
  
  // Default to notify (shouldn't reach here, but safe fallback)
  return true;
}

/**
 * Get label color for Slack message attachment
 * 
 * @param {string} label - Label name
 * @return {string} Slack color code
 */
function getLabelColor_(label) {
  const colorMap = {
    'reply_needed': 'danger',    // Red
    'todo': 'warning',            // Yellow
    'review': 'good',             // Green
    'summarize': '#36a64f'        // Green (slightly different)
  };
  return colorMap[label] || 'good';
}

/**
 * Format email thread details for Slack message
 * 
 * @param {Object} ctx - Agent context with thread and decision info
 * @return {Object} Slack message payload
 */
function formatSlackMessage_(ctx) {
  const config = getSlackNotifierConfig_();
  const thread = ctx.thread;
  const label = ctx.label;
  const decision = ctx.decision || {};
  
  try {
    // Get email details
    const subject = thread.getFirstMessageSubject() || '(No Subject)';
    const firstMessage = thread.getMessages()[0];
    const from = firstMessage ? firstMessage.getFrom() : 'Unknown';
    const threadId = ctx.threadId;
    
    // Build Gmail link
    const gmailUrl = 'https://mail.google.com/mail/u/0/#inbox/' + threadId;
    
    // Build Slack message
    const message = {
      text: '📧 Email labeled: ' + label,
      username: config.SLACK_USERNAME,
      icon_emoji: config.SLACK_ICON_EMOJI,
      attachments: [{
        color: getLabelColor_(label),
        fields: [
          {
            title: 'Label',
            value: label,
            short: true
          },
          {
            title: 'Subject',
            value: subject.length > 100 ? subject.substring(0, 97) + '...' : subject,
            short: true
          },
          {
            title: 'From',
            value: from.length > 100 ? from.substring(0, 97) + '...' : from,
            short: true
          },
          {
            title: 'Link',
            value: '<' + gmailUrl + '|View in Gmail>',
            short: false
          }
        ]
      }]
    };
    
    // Add reason if available
    if (decision.reason) {
      message.attachments[0].footer = 'Reason: ' + decision.reason;
    }
    
    // Add channel if configured
    if (config.SLACK_CHANNEL) {
      message.channel = config.SLACK_CHANNEL;
    }
    
    return message;
    
  } catch (error) {
    // Fallback message if we can't get thread details
    return {
      text: '📧 Email labeled: ' + label,
      username: config.SLACK_USERNAME,
      icon_emoji: config.SLACK_ICON_EMOJI,
      attachments: [{
        color: getLabelColor_(label),
        fields: [
          {
            title: 'Label',
            value: label,
            short: true
          },
          {
            title: 'Thread ID',
            value: ctx.threadId,
            short: true
          }
        ],
        footer: 'Error retrieving email details: ' + error.toString()
      }]
    };
  }
}

/**
 * Send Slack notification via webhook
 * 
 * @param {string} webhookUrl - Slack webhook URL
 * @param {Object} payload - Slack message payload
 * @return {Object} Result object with success status
 */
function sendSlackNotification_(webhookUrl, payload) {
  try {
    if (!webhookUrl) {
      return {
        success: false,
        error: 'No webhook URL configured'
      };
    }
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    // Slack returns 200 on success
    if (responseCode === 200) {
      return {
        success: true,
        message: 'Notification sent successfully'
      };
    } else {
      return {
        success: false,
        error: 'HTTP ' + responseCode + ': ' + responseText.substring(0, 200)
      };
    }
    
  } catch (error) {
    return {
      success: false,
      error: 'Failed to send notification: ' + error.toString()
    };
  }
}

// ============================================================================
// Main Agent Logic - onLabel Hook
// ============================================================================

/**
 * Slack Notifier agent onLabel handler function
 * Integrates with existing agent framework and context system
 * ctx provides: label, decision, threadId, thread (GmailThread), cfg, dryRun, log(msg)
 * Returns { status: 'ok'|'skip'|'retry'|'error', info?: string }
 */
function slackNotifierOnLabel_(ctx) {
  try {
    const config = getSlackNotifierConfig_();
    
    // Check if agent is enabled
    if (!config.SLACK_ENABLED) {
      return { status: 'skip', info: 'slack notifier agent disabled' };
    }
    
    // Validate configuration
    if (!config.SLACK_WEBHOOK_URL) {
      ctx.log('Slack Notifier: No webhook URL configured');
      return { status: 'error', info: 'SLACK_WEBHOOK_URL not configured' };
    }
    
    // Check if we should notify for this label
    if (!shouldNotifyForLabel_(ctx.label, config)) {
      return { status: 'skip', info: 'label not in SLACK_LABELS filter' };
    }
    
    if (config.SLACK_DEBUG) {
      ctx.log('Slack Notifier agent running for thread ' + ctx.threadId + ' with label ' + ctx.label);
    }
    
    // Check for dry-run mode
    if (ctx.dryRun) {
      ctx.log('DRY RUN - Would send Slack notification for label: ' + ctx.label);
      return { status: 'ok', info: 'dry-run mode - notification would be sent' };
    }
    
    // Format Slack message
    const slackMessage = formatSlackMessage_(ctx);
    
    // Send notification
    const result = sendSlackNotification_(config.SLACK_WEBHOOK_URL, slackMessage);
    
    if (!result.success) {
      // Log error but don't throw - failures shouldn't break email processing
      ctx.log('Slack notification failed: ' + result.error);
      return { status: 'error', info: result.error };
    }
    
    if (config.SLACK_DEBUG) {
      ctx.log('Slack notification sent successfully');
    }
    
    return {
      status: 'ok',
      info: 'notification sent'
    };
    
  } catch (error) {
    // Catch all errors and log without throwing - email processing must continue
    ctx.log('Slack Notifier agent error: ' + error.toString());
    return { status: 'error', info: error.toString() };
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
   * Register Slack Notifier agent for all labels
   * Agent sends Slack notifications when configured labels are applied
   *
   * Uses onLabel hook pattern:
   * - Runs immediately when labels are applied during classification
   * - Configurable label filtering via SLACK_LABELS property
   */
  api.register(
    'reply_needed',              // Register for this label
    'SlackNotifier',            // Agent name
    {
      onLabel: slackNotifierOnLabel_  // Immediate per-email handler
    },
    {
      runWhen: 'afterLabel',    // Run after labeling (respects dry-run)
      enabled: true             // Enabled by default (can be disabled via config)
    }
  );
  
  // Register for other labels as well
  api.register(
    'review',
    'SlackNotifier',
    {
      onLabel: slackNotifierOnLabel_
    },
    {
      runWhen: 'afterLabel',
      enabled: true
    }
  );
  
  api.register(
    'todo',
    'SlackNotifier',
    {
      onLabel: slackNotifierOnLabel_
    },
    {
      runWhen: 'afterLabel',
      enabled: true
    }
  );
  
  api.register(
    'summarize',
    'SlackNotifier',
    {
      onLabel: slackNotifierOnLabel_
    },
    {
      runWhen: 'afterLabel',
      enabled: true
    }
  );
});

