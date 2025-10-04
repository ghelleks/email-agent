/**
 * WebAppController.gs - Web app entry point and API orchestration
 *
 * Provides the web app interface and coordinates between the UI and existing services.
 * Follows the service extension pattern by orchestrating calls to GmailService and LLMService.
 */

/**
 * Required function for Google Apps Script web app deployment
 * Serves the main HTML interface with security controls
 */
function doGet(e) {
  // Security: Validate that this is being accessed by the authorized user
  const userEmail = Session.getActiveUser().getEmail();
  if (!userEmail) {
    return HtmlService.createHtmlOutput('<h1>Access Denied</h1><p>Authentication required.</p>')
      .setTitle('Access Denied')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
  }

  // Security: Log access for audit trail
  console.log(`Web app accessed by: ${userEmail} at ${new Date().toISOString()}`);

  return HtmlService.createHtmlOutputFromFile('WebApp')
    .setTitle('Email Agent Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT); // Prevent embedding in frames
}

/**
 * Main orchestration function called from frontend
 * Phase 2: Gmail Integration - discovers emails and prepares data for summarization
 */
function summarizeEmails() {
  try {
    // Security: Verify user authentication
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail) {
      return {
        success: false,
        error: 'Authentication required. Please refresh and sign in.'
      };
    }

    const cfg = getConfig_();

    if (!cfg.WEBAPP_ENABLED) {
      return {
        success: false,
        error: 'Web app functionality is disabled in configuration'
      };
    }

    // Step 1: Find emails with summarize label using GmailService
    const emailDiscovery = findEmailsWithSummarizeLabel_();
    if (!emailDiscovery.success) {
      return emailDiscovery;
    }

    const { emails, count } = emailDiscovery;

    if (count === 0) {
      return {
        success: true,
        summary: '**No emails found** with "summarize" label. To test the web app:\n\n1. Apply the **summarize** label to some emails in Gmail\n2. Return here and click "Get Summary" again',
        emailCount: 0,
        emailLinks: [],
        webLinks: [],
        totalFound: 0,
        processedCount: 0,
        message: 'No emails found with "summarize" label'
      };
    }

    // Respect max email limit from configuration
    const maxEmails = cfg.WEBAPP_MAX_EMAILS_PER_SUMMARY;
    const emailsToProcess = emails.slice(0, maxEmails);

    if (emails.length > maxEmails) {
      Logger.log(`WebApp: Processing ${maxEmails} of ${emails.length} emails due to WEBAPP_MAX_EMAILS_PER_SUMMARY limit`);
    }

    // Step 2: Generate permalinks for email references
    const emailLinks = generateEmailPermalinks_(emailsToProcess);

    // Step 3: Extract web links from email content
    const webLinks = extractWebLinksFromEmails_(emailsToProcess);

    // Step 4: Store email IDs for archiving (to ensure count consistency)
    const emailIds = emailsToProcess.map(email => email.id);
    PropertiesService.getScriptProperties().setProperty('WEBAPP_PENDING_ARCHIVE_IDS', JSON.stringify(emailIds));

    // Step 5: Build summary prompt (WebApp doesn't use agent-specific knowledge but may use global knowledge)
    const globalKnowledge = fetchGlobalKnowledge_();

    const summaryConfig = {
      style: 'economist',
      includeWebLinks: webLinks,
      emailLinks: emailLinks
    };
    const prompt = buildSummaryPrompt_(emailsToProcess, null, summaryConfig, globalKnowledge);

    // Phase 3: Generate consolidated AI summary using LLMService
    const summaryResult = generateConsolidatedSummary_(prompt, summaryConfig);

    if (!summaryResult.success) {
      return summaryResult;
    }

    let summaryText = summaryResult.summary;

    // The AI now includes both source references and web links inline within themes
    // No additional processing needed here

    return {
      success: true,
      summary: summaryText,
      emailCount: emailsToProcess.length,
      emailLinks: emailLinks,
      webLinks: webLinks,
      totalFound: emails.length,
      processedCount: emailsToProcess.length
    };

  } catch (error) {
    Logger.log('WebApp summarizeEmails error: ' + error.toString());
    return {
      success: false,
      error: 'Failed to process emails: ' + error.toString()
    };
  }
}

/**
 * Archives the emails that were previously summarized
 * Phase 2: Gmail Integration - uses stored email IDs for exact archiving
 */
function archiveProcessedEmails() {
  try {
    // Security: Verify user authentication
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail) {
      return {
        success: false,
        error: 'Authentication required. Please refresh and sign in.'
      };
    }

    const cfg = getConfig_();

    if (!cfg.WEBAPP_ENABLED) {
      return {
        success: false,
        error: 'Web app functionality is disabled in configuration'
      };
    }

    // Retrieve stored email IDs from previous summarize operation
    const storedIds = PropertiesService.getScriptProperties().getProperty('WEBAPP_PENDING_ARCHIVE_IDS');
    if (!storedIds) {
      return {
        success: false,
        error: 'No pending emails to archive. Please generate a summary first.'
      };
    }

    // Security: Validate JSON data
    let emailIds;
    try {
      emailIds = JSON.parse(storedIds);
    } catch (parseError) {
      console.log(`JSON parse error for user ${userEmail}: ${parseError.toString()}`);
      // Clear corrupted data
      PropertiesService.getScriptProperties().deleteProperty('WEBAPP_PENDING_ARCHIVE_IDS');
      return {
        success: false,
        error: 'Invalid archive data detected. Please generate a new summary.'
      };
    }

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return {
        success: false,
        error: 'No email IDs found for archiving'
      };
    }

    // Security: Validate email ID format (basic sanity check)
    const invalidIds = emailIds.filter(id => typeof id !== 'string' || id.length < 10);
    if (invalidIds.length > 0) {
      console.log(`Invalid email IDs detected for user ${userEmail}: ${invalidIds.length} invalid IDs`);
      return {
        success: false,
        error: 'Invalid email IDs detected. Please generate a new summary.'
      };
    }

    // Archive emails using GmailService
    const archiveResult = bulkArchiveEmails_(emailIds);

    if (archiveResult.success) {
      // Clear stored email IDs after successful archiving
      PropertiesService.getScriptProperties().deleteProperty('WEBAPP_PENDING_ARCHIVE_IDS');
    }

    return archiveResult;

  } catch (error) {
    Logger.log('WebApp archiveProcessedEmails error: ' + error.toString());
    return {
      success: false,
      error: 'Failed to archive emails: ' + error.toString()
    };
  }
}

/**
 * Get current status including email count without processing
 * Phase 2: Gmail Integration - provides real email counts
 */
function getEmailStatus() {
  try {
    // Security: Verify user authentication
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail) {
      return {
        success: false,
        error: 'Authentication required. Please refresh and sign in.'
      };
    }

    const cfg = getConfig_();

    if (!cfg.WEBAPP_ENABLED) {
      return {
        success: false,
        error: 'Web app functionality is disabled'
      };
    }

    // Get count of emails with summarize label
    const discovery = findEmailsWithSummarizeLabel_();
    if (!discovery.success) {
      return discovery;
    }

    // Check if there are pending emails to archive with safe parsing
    let pendingArchiveCount = 0;
    const storedIds = PropertiesService.getScriptProperties().getProperty('WEBAPP_PENDING_ARCHIVE_IDS');
    if (storedIds) {
      try {
        const parsedIds = JSON.parse(storedIds);
        pendingArchiveCount = Array.isArray(parsedIds) ? parsedIds.length : 0;
      } catch (parseError) {
        console.log(`JSON parse error in getEmailStatus for user ${userEmail}: ${parseError.toString()}`);
        // Clear corrupted data
        PropertiesService.getScriptProperties().deleteProperty('WEBAPP_PENDING_ARCHIVE_IDS');
        pendingArchiveCount = 0;
      }
    }

    return {
      success: true,
      emailCount: discovery.count,
      pendingArchiveCount: pendingArchiveCount,
      maxEmailsPerSummary: cfg.WEBAPP_MAX_EMAILS_PER_SUMMARY
    };

  } catch (error) {
    Logger.log('WebApp getEmailStatus error: ' + error.toString());
    return {
      success: false,
      error: 'Failed to get email status: ' + error.toString()
    };
  }
}

/**
 * Convert markdown to HTML using shared utility
 * Called from frontend for consistent server-side markdown processing
 */
function convertMarkdownForWebApp(markdownText) {
  try {
    // Security: Verify user authentication
    const userEmail = Session.getActiveUser().getEmail();
    if (!userEmail) {
      return {
        success: false,
        error: 'Authentication required. Please refresh and sign in.'
      };
    }

    if (!markdownText || typeof markdownText !== 'string') {
      return {
        success: false,
        error: 'Invalid markdown text provided'
      };
    }

    // Use shared utility with web styling
    const result = convertMarkdownToHtml_(markdownText, 'web');

    return result;

  } catch (error) {
    Logger.log('WebApp convertMarkdownForWebApp error: ' + error.toString());
    return {
      success: false,
      error: 'Failed to convert markdown: ' + error.toString()
    };
  }
}