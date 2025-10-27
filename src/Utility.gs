/**
 * Utility.gs - Shared Utility Functions for Email Agent
 *
 * This file consolidates common utility patterns used across the email-agent project
 * into reusable, well-tested functions following ADR-012 patterns.
 *
 * Sections:
 * 1. Text Processing Utilities
 * 2. Date/Time Utilities
 * 3. Trigger Management Utilities
 * 4. Error Handling Utilities
 * 5. Configuration & Gmail Utilities
 */

// ============================================================================
// Section 1: Text Processing Utilities
// ============================================================================

/**
 * Convert markdown text to HTML with configurable styling presets
 * Consolidates markdown conversion patterns from AgentSummarizer.gs and WebApp.html
 *
 * @param {string} markdownText - Markdown content to convert
 * @param {string} stylePreset - Style configuration: 'email', 'web', or 'plain'
 * @returns {{success: boolean, html?: string, error?: string}} Conversion result
 */
function convertMarkdownToHtml_(markdownText, stylePreset) {
  try {
    if (!markdownText) {
      return { success: true, html: '' };
    }

    if (typeof markdownText !== 'string') {
      return { success: false, error: 'Input must be a string' };
    }

    if (!stylePreset) {
      stylePreset = 'email';
    }

    // Security: Sanitize input to prevent XSS
    const sanitizeResult = sanitizeHtmlInput_(markdownText);
    if (!sanitizeResult.success) {
      return { success: false, error: 'Failed to sanitize input: ' + sanitizeResult.error };
    }

    const styleConfig = getMarkdownStyleConfig_(stylePreset);
    if (!styleConfig.success) {
      return { success: false, error: styleConfig.error };
    }

    const styles = styleConfig.styles;
    let html = sanitizeResult.text;

    // Convert headers (### Header -> <h3>Header</h3>)
    html = html.replace(/^### (.+)$/gm, `<h3 style="${styles.h3}">$1</h3>`);
    html = html.replace(/^## (.+)$/gm, `<h2 style="${styles.h2}">$1</h2>`);
    html = html.replace(/^# (.+)$/gm, `<h1 style="${styles.h1}">$1</h1>`);

    // Convert bold text (**text** -> <strong>text</strong>)
    html = html.replace(/\*\*([^*]+)\*\*/g, `<strong style="${styles.bold}">$1</strong>`);

    // Convert italic text (*text* -> <em>text</em>)
    html = html.replace(/\*([^*]+)\*/g, `<em style="${styles.italic}">$1</em>`);

    // Convert Sources sections to bulleted lists (email style only)
    if (stylePreset === 'email') {
      html = html.replace(/\*\*Sources:\*\*\s*(.+)/g, function(match, sourcesList) {
        const sources = sourcesList.split(/,\s*(?=\[)/);
        const listItems = sources.map(source => {
          const linkedSource = source.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="${styles.link}">$1</a>`);
          return `<li style="${styles.listItem}">${linkedSource.trim()}</li>`;
        }).join('');
        return `<strong style="${styles.bold}">Sources:</strong><ul style="${styles.list}">${listItems}</ul>`;
      });
    }

    // Convert remaining links ([text](url) -> <a href="url">text</a>)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="${styles.link}" ${stylePreset === 'web' ? 'target="_blank"' : ''}>$1</a>`);

    // Convert bullet lists (simple implementation)
    if (stylePreset === 'web') {
      html = html.replace(/^- (.+)$/gm, `<li style="${styles.listItem}">$1</li>`);
      html = html.replace(/(<li.*<\/li>)/s, `<ul style="${styles.list}">$1</ul>`);
    }

    // Convert line breaks to HTML
    if (stylePreset === 'web') {
      html = html.replace(/\n/g, '<br>');
    } else {
      html = html.replace(/\n\n/g, '</p><p style="margin: 1em 0;">');
      html = html.replace(/\n/g, '<br>');
    }

    // Wrap in paragraph tags if not already wrapped (email style)
    if (stylePreset === 'email' && !html.startsWith('<')) {
      html = '<p style="margin: 1em 0;">' + html + '</p>';
    }

    return { success: true, html: html };

  } catch (error) {
    return standardErrorHandler_(error, 'convertMarkdownToHtml_');
  }
}

/**
 * Get markdown style configuration for different presets
 *
 * @param {string} preset - Style preset: 'email', 'web', or 'plain'
 * @returns {{success: boolean, styles?: object, error?: string}} Style configuration
 */
function getMarkdownStyleConfig_(preset) {
  try {
    const configs = {
      email: {
        h1: 'color: #2c3e50; margin-top: 1.5em; margin-bottom: 0.5em; font-size: 22px;',
        h2: 'color: #2c3e50; margin-top: 1.5em; margin-bottom: 0.5em; font-size: 20px;',
        h3: 'color: #2c3e50; margin-top: 1.5em; margin-bottom: 0.5em; font-size: 18px;',
        bold: 'font-weight: bold;',
        italic: 'font-style: italic;',
        link: 'color: #3498db; text-decoration: none;',
        list: 'margin: 0.5em 0; padding-left: 1.5em;',
        listItem: 'margin: 0.3em 0;'
      },
      web: {
        h1: 'color: #007AFF; font-size: 20px; font-weight: 600; margin: 30px 0 20px 0;',
        h2: 'color: #007AFF; font-size: 18px; font-weight: 600; margin: 25px 0 15px 0;',
        h3: 'color: #007AFF; font-size: 16px; font-weight: 600; margin: 20px 0 10px 0; border-bottom: 2px solid #e9ecef; padding-bottom: 5px;',
        bold: 'color: #007AFF;',
        italic: 'font-style: italic;',
        link: 'color: #007AFF; text-decoration: none; border-bottom: 1px solid #007AFF;',
        list: 'margin: 10px 0; padding-left: 20px;',
        listItem: 'margin: 5px 0;'
      },
      plain: {
        h1: '',
        h2: '',
        h3: '',
        bold: 'font-weight: bold;',
        italic: 'font-style: italic;',
        link: 'color: blue; text-decoration: underline;',
        list: 'margin: 10px 0; padding-left: 20px;',
        listItem: 'margin: 2px 0;'
      }
    };

    if (!configs[preset]) {
      return { success: false, error: `Unknown style preset: ${preset}` };
    }

    return { success: true, styles: configs[preset] };

  } catch (error) {
    return standardErrorHandler_(error, 'getMarkdownStyleConfig_');
  }
}

/**
 * Clean URL by removing common trailing characters
 * Replaces pattern from GmailService.gs:165
 *
 * @param {string} url - URL to clean
 * @returns {{success: boolean, url?: string, error?: string}} Cleaned URL result
 */
function cleanUrl_(url) {
  try {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Invalid URL provided' };
    }

    // Remove common trailing characters
    const cleanedUrl = url.replace(/[.,;:!?)]$/, '');

    return { success: true, url: cleanedUrl };

  } catch (error) {
    return standardErrorHandler_(error, 'cleanUrl_');
  }
}

/**
 * Sanitize HTML input for security
 * Prevents XSS and other injection attacks
 *
 * @param {string} text - Text to sanitize
 * @returns {{success: boolean, text?: string, error?: string}} Sanitized text result
 */
function sanitizeHtmlInput_(text) {
  try {
    if (!text) {
      return { success: true, text: '' };
    }

    if (typeof text !== 'string') {
      return { success: false, error: 'Input must be a string' };
    }

    // Basic HTML entity encoding for security
    let sanitized = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    return { success: true, text: sanitized };

  } catch (error) {
    return standardErrorHandler_(error, 'sanitizeHtmlInput_');
  }
}

// ============================================================================
// Section 2: Date/Time Utilities
// ============================================================================

/**
 * Format email date to ISO string slice format
 * Standardizes the .toISOString().slice(0,10) pattern used 15+ times
 *
 * @param {Date} date - Date to format
 * @returns {{success: boolean, date?: string, error?: string}} Formatted date result
 */
function formatEmailDate_(date) {
  try {
    if (!date) {
      return { success: false, error: 'Date is required' };
    }

    if (!(date instanceof Date)) {
      return { success: false, error: 'Input must be a Date object' };
    }

    if (isNaN(date.getTime())) {
      return { success: false, error: 'Invalid date provided' };
    }

    const formattedDate = date.toISOString().slice(0, 10);
    return { success: true, date: formattedDate };

  } catch (error) {
    return standardErrorHandler_(error, 'formatEmailDate_');
  }
}

/**
 * Calculate age of a date in days
 * Used for age calculations in multiple agents
 *
 * @param {Date} date - Date to calculate age for
 * @returns {{success: boolean, days?: number, error?: string}} Age calculation result
 */
function calculateAgeDays_(date) {
  try {
    if (!date) {
      return { success: false, error: 'Date is required' };
    }

    if (!(date instanceof Date)) {
      return { success: false, error: 'Input must be a Date object' };
    }

    if (isNaN(date.getTime())) {
      return { success: false, error: 'Invalid date provided' };
    }

    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { success: true, days: diffDays };

  } catch (error) {
    return standardErrorHandler_(error, 'calculateAgeDays_');
  }
}

/**
 * Format timestamp with flexible formatting options
 *
 * @param {Date} date - Date to format
 * @param {string} format - Format type: 'iso', 'local', 'short', 'long'
 * @returns {{success: boolean, timestamp?: string, error?: string}} Formatted timestamp result
 */
function formatTimestamp_(date, format) {
  try {
    if (!date) {
      return { success: false, error: 'Date is required' };
    }

    if (!(date instanceof Date)) {
      return { success: false, error: 'Input must be a Date object' };
    }

    if (isNaN(date.getTime())) {
      return { success: false, error: 'Invalid date provided' };
    }

    format = format || 'iso';
    let timestamp;

    switch (format) {
      case 'iso':
        timestamp = date.toISOString();
        break;
      case 'local':
        timestamp = date.toLocaleDateString();
        break;
      case 'short':
        timestamp = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        break;
      case 'long':
        timestamp = date.toString();
        break;
      default:
        return { success: false, error: `Unknown format: ${format}` };
    }

    return { success: true, timestamp: timestamp };

  } catch (error) {
    return standardErrorHandler_(error, 'formatTimestamp_');
  }
}

// ============================================================================
// Section 3: Trigger Management Utilities
// ============================================================================

/**
 * Create a time-based trigger for a function with specified schedule
 * Generic trigger creation pattern
 *
 * @param {string} functionName - Name of function to trigger
 * @param {object} schedule - Schedule configuration:
 *   - {type: 'hours', interval: number} for hourly (1-24)
 *   - {type: 'minutes', interval: number} for minutes (1, 5, 10, 15, 30)
 *   - {type: 'daily', hour: number} for daily at specific hour (0-23)
 * @returns {{success: boolean, trigger?: object, error?: string}} Trigger creation result
 */
function createTimeTrigger_(functionName, schedule) {
  try {
    if (!functionName) {
      return { success: false, error: 'Function name is required' };
    }

    if (!schedule || !schedule.type) {
      return { success: false, error: 'Schedule must specify type' };
    }

    // Delete existing triggers for this function first
    const deleteResult = deleteTriggersByFunction_(functionName);
    if (!deleteResult.success) {
      return { success: false, error: `Failed to delete existing triggers: ${deleteResult.error}` };
    }

    let triggerBuilder = ScriptApp.newTrigger(functionName).timeBased();

    switch (schedule.type) {
      case 'hours':
        if (!schedule.interval) {
          return { success: false, error: 'Hours schedule must specify interval' };
        }
        if (schedule.interval < 1 || schedule.interval > 24) {
          return { success: false, error: 'Hour interval must be between 1 and 24' };
        }
        triggerBuilder = triggerBuilder.everyHours(schedule.interval);
        break;
      case 'minutes':
        if (!schedule.interval) {
          return { success: false, error: 'Minutes schedule must specify interval' };
        }
        if (![1, 5, 10, 15, 30].includes(schedule.interval)) {
          return { success: false, error: 'Minute interval must be 1, 5, 10, 15, or 30' };
        }
        triggerBuilder = triggerBuilder.everyMinutes(schedule.interval);
        break;
      case 'daily':
        if (schedule.hour === undefined || schedule.hour === null) {
          return { success: false, error: 'Daily schedule must specify hour (0-23)' };
        }
        if (schedule.hour < 0 || schedule.hour > 23) {
          return { success: false, error: 'Hour must be between 0 and 23' };
        }
        triggerBuilder = triggerBuilder.everyDays(1).atHour(schedule.hour);
        break;
      default:
        return { success: false, error: `Unknown schedule type: ${schedule.type}` };
    }

    const trigger = triggerBuilder.create();
    return { success: true, trigger: trigger };

  } catch (error) {
    return standardErrorHandler_(error, 'createTimeTrigger_');
  }
}

/**
 * Delete all triggers for a specific function
 * Cleanup patterns from Main.gs, AgentSummarizer.gs
 *
 * @param {string} functionName - Name of function whose triggers to delete
 * @returns {{success: boolean, deleted?: number, error?: string}} Deletion result
 */
function deleteTriggersByFunction_(functionName) {
  try {
    if (!functionName) {
      return { success: false, error: 'Function name is required' };
    }

    const triggers = ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === functionName);

    let deletedCount = 0;
    triggers.forEach(trigger => {
      try {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      } catch (deleteError) {
        console.log(`Warning: Failed to delete trigger for ${functionName}: ${deleteError.toString()}`);
      }
    });

    return { success: true, deleted: deletedCount };

  } catch (error) {
    return standardErrorHandler_(error, 'deleteTriggersByFunction_');
  }
}

/**
 * List all triggers for a specific function
 * Debug patterns for trigger management
 *
 * @param {string} functionName - Name of function whose triggers to list
 * @returns {{success: boolean, triggers?: Array, error?: string}} Trigger list result
 */
function listTriggersByFunction_(functionName) {
  try {
    if (!functionName) {
      return { success: false, error: 'Function name is required' };
    }

    const triggers = ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === functionName);

    const triggerInfo = triggers.map((trigger, index) => ({
      index: index + 1,
      source: trigger.getTriggerSource().toString(),
      eventType: trigger.getEventType().toString(),
      uniqueId: trigger.getUniqueId()
    }));

    return { success: true, triggers: triggerInfo };

  } catch (error) {
    return standardErrorHandler_(error, 'listTriggersByFunction_');
  }
}

// ============================================================================
// Section 4: Error Handling Utilities
// ============================================================================

/**
 * Standard error handler following ADR-012 patterns
 * Replaces 30+ error.toString() patterns throughout codebase
 *
 * @param {Error} error - Error object to handle
 * @param {string} context - Context/function name where error occurred
 * @returns {{success: boolean, error: string}} Standard error response
 */
function standardErrorHandler_(error, context) {
  const errorMessage = error ? error.toString() : 'Unknown error';
  const contextPrefix = context ? `${context}: ` : '';
  const fullError = `${contextPrefix}${errorMessage}`;

  Logger.log(fullError);

  return {
    success: false,
    error: fullError
  };
}

/**
 * Create standard error response format
 * Standard {success, error} format used throughout project
 *
 * @param {string} message - Error message
 * @param {Error|string} error - Optional error object or additional details
 * @returns {{success: boolean, error: string}} Standard error response
 */
function createErrorResponse_(message, error) {
  let errorText = message || 'An error occurred';

  if (error) {
    const errorDetail = typeof error === 'string' ? error : error.toString();
    errorText += `: ${errorDetail}`;
  }

  return {
    success: false,
    error: errorText
  };
}

/**
 * Enhanced logging with context information
 * Improved logging patterns for debugging
 *
 * @param {string} level - Log level: 'INFO', 'WARN', 'ERROR', 'DEBUG'
 * @param {string} message - Log message
 * @param {object} context - Optional context object to include
 * @returns {{success: boolean, logged?: boolean, error?: string}} Logging result
 */
function logWithContext_(level, message, context) {
  try {
    if (!level || !message) {
      return { success: false, error: 'Level and message are required' };
    }

    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;

    if (context && typeof context === 'object') {
      try {
        logMessage += ` | Context: ${JSON.stringify(context)}`;
      } catch (jsonError) {
        logMessage += ` | Context: [Unable to serialize context]`;
      }
    }

    console.log(logMessage);
    return { success: true, logged: true };

  } catch (error) {
    return standardErrorHandler_(error, 'logWithContext_');
  }
}

// ============================================================================
// Section 5: Configuration & Gmail Utilities
// ============================================================================

/**
 * Generic agent configuration getter
 * Follows getSummarizerConfig_() pattern for any agent
 *
 * @param {string} agentPrefix - Agent prefix (e.g., 'SUMMARIZER', 'TEMPLATE')
 * @param {object} defaults - Default configuration values
 * @returns {{success: boolean, config?: object, error?: string}} Configuration result
 */
function getAgentConfig_(agentPrefix, defaults) {
  try {
    if (!agentPrefix) {
      return { success: false, error: 'Agent prefix is required' };
    }

    if (!defaults || typeof defaults !== 'object') {
      return { success: false, error: 'Default configuration object is required' };
    }

    const props = PropertiesService.getScriptProperties();
    const config = {};

    // Build configuration from defaults with property overrides
    Object.keys(defaults).forEach(key => {
      const propertyKey = `${agentPrefix}_${key}`;
      const defaultValue = defaults[key];
      const propertyValue = props.getProperty(propertyKey);

      if (propertyValue !== null) {
        // Convert string property values to appropriate types
        if (typeof defaultValue === 'boolean') {
          config[key] = propertyValue.toLowerCase() === 'true';
        } else if (typeof defaultValue === 'number') {
          config[key] = parseInt(propertyValue, 10) || defaultValue;
        } else {
          config[key] = propertyValue;
        }
      } else {
        config[key] = defaultValue;
      }
    });

    return { success: true, config: config };

  } catch (error) {
    return standardErrorHandler_(error, 'getAgentConfig_');
  }
}

/**
 * Validate email address format
 * Email validation for agent configurations
 *
 * @param {string} email - Email address to validate
 * @returns {{success: boolean, valid?: boolean, error?: string}} Validation result
 */
function validateEmailFormat_(email) {
  try {
    if (!email) {
      return { success: true, valid: false };
    }

    if (typeof email !== 'string') {
      return { success: false, error: 'Email must be a string' };
    }

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email.trim());

    return { success: true, valid: isValid };

  } catch (error) {
    return standardErrorHandler_(error, 'validateEmailFormat_');
  }
}

/**
 * Create Gmail permalink URL for a thread
 * Gmail URL generation for email references
 *
 * @param {string} threadId - Gmail thread ID
 * @returns {{success: boolean, url?: string, error?: string}} Gmail URL result
 */
function createGmailUrl_(threadId) {
  try {
    if (!threadId) {
      return { success: false, error: 'Thread ID is required' };
    }

    if (typeof threadId !== 'string') {
      return { success: false, error: 'Thread ID must be a string' };
    }

    const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
    return { success: true, url: gmailUrl };

  } catch (error) {
    return standardErrorHandler_(error, 'createGmailUrl_');
  }
}