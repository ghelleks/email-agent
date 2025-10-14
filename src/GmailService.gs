function findUnprocessed_(max) {
  const q = 'in:inbox -label:reply_needed -label:review -label:todo -label:summarize';
  return GmailApp.search(q, 0, max);
}

function minimalize_(threads, bodyChars) {
  return threads.map(function(t) {
    const msg = t.getMessages().pop();
    const subj = msg.getSubject() || '';
    const from = msg.getFrom() || '';
    const date = msg.getDate();
    const days = Math.floor((Date.now() - date.getTime()) / (1000*60*60*24));
    const body = (msg.getPlainBody() || msg.getBody() || '').slice(0, bodyChars);
    return {
      id: msg.getId(),
      threadId: t.getId(),
      subject: subj,
      from: from,
      date: date.toISOString().slice(0,10),
      ageDays: days,
      plainBody: body
    };
  });
}

/**
 * Phase 2: Gmail Integration - Web App Service Extensions
 * Added for Interactive Web App Agent
 */

/**
 * Find emails with 'summarize' label in inbox only and return data for processing
 * Returns: { success: boolean, emails: array, count: number, error?: string }
 */
function findEmailsWithSummarizeLabel_() {
  try {
    const label = GmailApp.getUserLabelByName('summarize');
    if (!label) {
      return {
        success: false,
        error: 'Label "summarize" not found. Please create it first.'
      };
    }

    // Use Gmail search to find emails with summarize label that are in inbox only
    const query = 'in:inbox label:summarize';
    const threads = GmailApp.search(query);
    const emails = [];

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const messages = thread.getMessages();
      const latestMessage = messages[messages.length - 1];

      emails.push({
        id: latestMessage.getId(),
        threadId: thread.getId(),
        subject: thread.getFirstMessageSubject() || '(No Subject)',
        from: latestMessage.getFrom() || '(Unknown Sender)',
        date: latestMessage.getDate().toISOString(),
        body: latestMessage.getPlainBody() || latestMessage.getBody() || '',
        thread: thread  // Keep reference for operations
      });
    }

    return {
      success: true,
      emails: emails,
      count: emails.length
    };

  } catch (error) {
    Logger.log('GmailService.findEmailsWithSummarizeLabel_ error: ' + error.toString());
    return {
      success: false,
      error: 'Failed to find emails: ' + error.toString()
    };
  }
}

/**
 * Archive multiple emails by ID while keeping the summarize label
 * Returns: { success: boolean, archivedCount: number, message?: string, error?: string }
 */
function bulkArchiveEmails_(emailIds) {
  try {
    if (!emailIds || emailIds.length === 0) {
      return {
        success: false,
        error: 'No email IDs provided for archiving'
      };
    }

    let archivedCount = 0;
    const errors = [];

    for (let i = 0; i < emailIds.length; i++) {
      try {
        const message = GmailApp.getMessageById(emailIds[i]);
        const thread = message.getThread();

        // Archive the thread (keeping all labels including 'summarize')
        thread.moveToArchive();
        archivedCount++;

      } catch (messageError) {
        errors.push('Failed to archive email ID ' + emailIds[i] + ': ' + messageError.toString());
        Logger.log('BulkArchive error for ID ' + emailIds[i] + ': ' + messageError.toString());
      }
    }

    if (errors.length > 0 && archivedCount === 0) {
      return {
        success: false,
        error: 'Failed to archive any emails. Errors: ' + errors.join('; ')
      };
    }

    const message = archivedCount === emailIds.length
      ? `Successfully archived ${archivedCount} email threads`
      : `Archived ${archivedCount} of ${emailIds.length} emails. Some errors occurred.`;

    return {
      success: true,
      archivedCount: archivedCount,
      message: message,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    Logger.log('GmailService.bulkArchiveEmails_ error: ' + error.toString());
    return {
      success: false,
      error: 'Failed to archive emails: ' + error.toString()
    };
  }
}

/**
 * Generate Gmail permalinks for email references
 * Returns: array of { subject: string, url: string }
 */
function generateEmailPermalinks_(emails) {
  return emails.map(function(email) {
    return {
      subject: email.subject,
      url: 'https://mail.google.com/mail/u/0/#inbox/' + email.threadId
    };
  });
}

/**
 * Extract web links (URLs) from email content
 * Returns: array of unique URLs found in email bodies
 */
function extractWebLinksFromEmails_(emails) {
  const urlRegex = /https?:\/\/[^\s<>"]+/gi;
  const uniqueUrls = new Set();

  emails.forEach(function(email) {
    const matches = email.body.match(urlRegex);
    if (matches) {
      matches.forEach(function(url) {
        // Clean up common trailing characters
        const cleanUrl = url.replace(/[.,;:!?)]$/, '');
        uniqueUrls.add(cleanUrl);
      });
    }
  });

  return Array.from(uniqueUrls);
}

/**
 * Phase 4: Generic Service Layer - Agent Support Functions
 * Added for Self-Contained Agent Architecture (ADR-011, ADR-012)
 */

/**
 * Find emails by label within specified age limit
 * Generic function for agents to find emails with flexible criteria
 * Returns: { success: boolean, emails: array, count: number, error?: string }
 */
function findEmailsByLabelWithAge_(labelName, maxAgeDays, maxCount) {
  try {
    if (!labelName) {
      return {
        success: false,
        error: 'Label name is required'
      };
    }

    const label = GmailApp.getUserLabelByName(labelName);
    if (!label) {
      return {
        success: false,
        error: `Label "${labelName}" not found`
      };
    }

    // Calculate age cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    // Search for emails with the label
    const query = `label:${labelName}`;
    const threads = GmailApp.search(query, 0, maxCount || 100);
    const emails = [];

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const messages = thread.getMessages();
      const latestMessage = messages[messages.length - 1];

      // Check if email is within age limit
      if (latestMessage.getDate() >= cutoffDate) {
        emails.push({
          id: latestMessage.getId(),
          threadId: thread.getId(),
          subject: thread.getFirstMessageSubject() || '(No Subject)',
          from: latestMessage.getFrom() || '(Unknown Sender)',
          date: latestMessage.getDate().toISOString(),
          body: latestMessage.getPlainBody() || latestMessage.getBody() || '',
          thread: thread
        });
      }
    }

    return {
      success: true,
      emails: emails,
      count: emails.length
    };

  } catch (error) {
    Logger.log(`findEmailsByLabelWithAge_ error: ${error.toString()}`);
    return {
      success: false,
      error: `Failed to find emails: ${error.toString()}`
    };
  }
}

/**
 * Manage label transitions for emails (remove old labels, add new labels)
 * Generic function for agents to handle label lifecycle
 * Returns: { success: boolean, processed: number, errors?: array, message?: string }
 */
function manageLabelTransition_(emailIds, removeLabels, addLabels) {
  try {
    if (!emailIds || emailIds.length === 0) {
      return {
        success: false,
        error: 'No email IDs provided'
      };
    }

    let processed = 0;
    const errors = [];

    // Get label objects for operations
    const labelsToRemove = removeLabels ? removeLabels.map(name =>
      GmailApp.getUserLabelByName(name)).filter(label => label !== null) : [];

    const labelsToAdd = addLabels ? addLabels.map(name =>
      GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name)) : [];

    for (let i = 0; i < emailIds.length; i++) {
      try {
        const message = GmailApp.getMessageById(emailIds[i]);
        const thread = message.getThread();

        // Remove specified labels
        labelsToRemove.forEach(label => {
          if (label) thread.removeLabel(label);
        });

        // Add specified labels
        labelsToAdd.forEach(label => {
          if (label) thread.addLabel(label);
        });

        processed++;

      } catch (messageError) {
        errors.push(`Failed to process email ID ${emailIds[i]}: ${messageError.toString()}`);
        Logger.log(`manageLabelTransition_ error for ID ${emailIds[i]}: ${messageError.toString()}`);
      }
    }

    if (errors.length > 0 && processed === 0) {
      return {
        success: false,
        error: `Failed to process any emails. Errors: ${errors.join('; ')}`
      };
    }

    const message = processed === emailIds.length
      ? `Successfully processed ${processed} email threads`
      : `Processed ${processed} of ${emailIds.length} emails. Some errors occurred.`;

    return {
      success: true,
      processed: processed,
      message: message,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    Logger.log(`manageLabelTransition_ error: ${error.toString()}`);
    return {
      success: false,
      error: `Failed to manage label transition: ${error.toString()}`
    };
  }
}

/**
 * Archive emails by their IDs
 * Generic function for agents to archive processed emails
 * Returns: { success: boolean, archived: number, errors?: array, message?: string }
 */
function archiveEmailsByIds_(emailIds) {
  try {
    if (!emailIds || emailIds.length === 0) {
      return {
        success: false,
        error: 'No email IDs provided for archiving'
      };
    }

    let archived = 0;
    const errors = [];

    for (let i = 0; i < emailIds.length; i++) {
      try {
        const message = GmailApp.getMessageById(emailIds[i]);
        const thread = message.getThread();
        thread.moveToArchive();
        archived++;

      } catch (messageError) {
        errors.push(`Failed to archive email ID ${emailIds[i]}: ${messageError.toString()}`);
        Logger.log(`archiveEmailsByIds_ error for ID ${emailIds[i]}: ${messageError.toString()}`);
      }
    }

    if (errors.length > 0 && archived === 0) {
      return {
        success: false,
        error: `Failed to archive any emails. Errors: ${errors.join('; ')}`
      };
    }

    const message = archived === emailIds.length
      ? `Successfully archived ${archived} email threads`
      : `Archived ${archived} of ${emailIds.length} emails. Some errors occurred.`;

    return {
      success: true,
      archived: archived,
      message: message,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    Logger.log(`archiveEmailsByIds_ error: ${error.toString()}`);
    return {
      success: false,
      error: `Failed to archive emails: ${error.toString()}`
    };
  }
}

/**
 * Mark emails as read by their IDs
 * Generic function for agents to mark processed emails as read
 * Returns: { success: boolean, marked: number, errors?: array, message?: string }
 */
function markEmailsAsRead_(emailIds) {
  try {
    if (!emailIds || emailIds.length === 0) {
      return {
        success: false,
        error: 'No email IDs provided for marking as read'
      };
    }

    let marked = 0;
    const errors = [];

    for (let i = 0; i < emailIds.length; i++) {
      try {
        const message = GmailApp.getMessageById(emailIds[i]);
        const thread = message.getThread();
        thread.markRead();
        marked++;

      } catch (messageError) {
        errors.push(`Failed to mark email ID ${emailIds[i]} as read: ${messageError.toString()}`);
        Logger.log(`markEmailsAsRead_ error for ID ${emailIds[i]}: ${messageError.toString()}`);
      }
    }

    if (errors.length > 0 && marked === 0) {
      return {
        success: false,
        error: `Failed to mark any emails as read. Errors: ${errors.join('; ')}`
      };
    }

    const message = marked === emailIds.length
      ? `Successfully marked ${marked} email threads as read`
      : `Marked ${marked} of ${emailIds.length} emails as read. Some errors occurred.`;

    return {
      success: true,
      marked: marked,
      message: message,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    Logger.log(`markEmailsAsRead_ error: ${error.toString()}`);
    return {
      success: false,
      error: `Failed to mark emails as read: ${error.toString()}`
    };
  }
}

/**
 * Send formatted HTML email with source references
 * Generic function for agents to send notifications and summaries
 * Returns: { success: boolean, messageId?: string, error?: string }
 */
function sendFormattedEmail_(to, subject, htmlContent, sourceEmails) {
  try {
    if (!to || !subject || !htmlContent) {
      return {
        success: false,
        error: 'Missing required parameters: to, subject, and htmlContent'
      };
    }

    // Build footer with source email references if provided
    let emailFooter = '';
    if (sourceEmails && sourceEmails.length > 0) {
      emailFooter = '<hr style="margin-top: 2em; border: none; border-top: 1px solid #ccc;">';
      emailFooter += '<p style="font-size: 12px; color: #666; margin-top: 1em;">';
      emailFooter += `<strong>Source Emails (${sourceEmails.length}):</strong><br>`;

      sourceEmails.forEach(function(email, index) {
        const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${email.threadId || email.id}`;
        emailFooter += `${index + 1}. <a href="${gmailUrl}">${email.subject}</a><br>`;
      });

      emailFooter += '</p>';
    }

    // Combine content with footer
    const fullHtmlContent = htmlContent + emailFooter;

    // Send the email
    GmailApp.sendEmail(
      to,
      subject,
      '', // Plain text fallback (empty for HTML-only)
      {
        htmlBody: fullHtmlContent
      }
    );

    Logger.log(`sendFormattedEmail_ sent to ${to}: ${subject}`);

    return {
      success: true,
      message: `Email sent successfully to ${to}`
    };

  } catch (error) {
    Logger.log(`sendFormattedEmail_ error: ${error.toString()}`);
    return {
      success: false,
      error: `Failed to send email: ${error.toString()}`
    };
  }
}
