/**
 * Email Summarizer Agent - Self-Contained Implementation
 *
 * This agent implements the requirements from GitHub Issue #10:
 * - Retrieves all emails labeled "summarize"
 * - Archives emails immediately when labeled (configurable)
 * - Generates summaries in "The Economist's World in Brief" style
 * - Delivers summaries via email with hyperlinks and source references
 * - Re-labels processed emails as "summarized" and archives them
 * - Runs on scheduled triggers (daily at 5am by default)
 *
 * Features:
 * - Self-contained: manages own config, labels, and triggers
 * - Uses generic service layer for Gmail operations
 * - Leverages existing AI infrastructure (LLMService, PromptBuilder)
 * - Configurable age limits, destination email, and archive behavior
 * - Full error handling and dry-run support
 */

// ============================================================================
// Configuration Management (Self-Contained)
// ============================================================================

/**
 * Get Email Summarizer agent configuration with sensible defaults
 * Manages own PropertiesService keys without core Config.gs changes
 */
function getSummarizerConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    // Agent enablement
    SUMMARIZER_ENABLED: (props.getProperty('SUMMARIZER_ENABLED') || 'true').toLowerCase() === 'true',

    // Email processing limits
    SUMMARIZER_MAX_AGE_DAYS: parseInt(props.getProperty('SUMMARIZER_MAX_AGE_DAYS') || '7', 10),
    SUMMARIZER_MAX_EMAILS_PER_SUMMARY: parseInt(props.getProperty('SUMMARIZER_MAX_EMAILS_PER_SUMMARY') || '50', 10),

    // Delivery configuration
    SUMMARIZER_DESTINATION_EMAIL: props.getProperty('SUMMARIZER_DESTINATION_EMAIL') || Session.getActiveUser().getEmail(),

    // Archive behavior
    SUMMARIZER_ARCHIVE_ON_LABEL: (props.getProperty('SUMMARIZER_ARCHIVE_ON_LABEL') || 'true').toLowerCase() === 'true',

    // Knowledge configuration (ADR-015 semantic naming)
    // INSTRUCTIONS: How to summarize (tone, length, focus areas)
    // KNOWLEDGE: Contextual reference material (examples, patterns, terminology)
    SUMMARIZER_INSTRUCTIONS_DOC_URL: props.getProperty('SUMMARIZER_INSTRUCTIONS_DOC_URL'),
    SUMMARIZER_KNOWLEDGE_FOLDER_URL: props.getProperty('SUMMARIZER_KNOWLEDGE_FOLDER_URL'),
    SUMMARIZER_KNOWLEDGE_MAX_DOCS: parseInt(props.getProperty('SUMMARIZER_KNOWLEDGE_MAX_DOCS') || '5', 10),

    // Debugging and testing
    SUMMARIZER_DEBUG: (props.getProperty('SUMMARIZER_DEBUG') || 'false').toLowerCase() === 'true',
    SUMMARIZER_DRY_RUN: (props.getProperty('SUMMARIZER_DRY_RUN') || 'false').toLowerCase() === 'true'
  };
}

// ============================================================================
// Label Management (Self-Contained)
// ============================================================================

/**
 * Ensure "summarized" label exists for processed emails
 * Creates label if it doesn't exist, returns label object
 */
function ensureSummarizedLabel_() {
  const labelName = 'summarized';
  return GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
}

// ============================================================================
// Email Processing Logic
// ============================================================================

/**
 * Find emails for summarization using generic service layer
 * Returns structured email data compatible with existing AI services
 */
function findEmailsForSummary_() {
  const config = getSummarizerConfig_();

  // Use generic service function for email finding
  return findEmailsByLabelWithAge_(
    'summarize',
    config.SUMMARIZER_MAX_AGE_DAYS,
    config.SUMMARIZER_MAX_EMAILS_PER_SUMMARY
  );
}

/**
 * Process emails through AI summarization pipeline
 * Uses existing LLMService and PromptBuilder infrastructure
 */
function generateSummaryFromEmails_(emails) {
  try {
    const config = getSummarizerConfig_();

    if (!emails || emails.length === 0) {
      return {
        success: false,
        error: 'No emails provided for summarization'
      };
    }

    // Fetch summarization knowledge (new: KnowledgeService integration)
    if (config.SUMMARIZER_DEBUG) {
      const hasInstructions = !!config.SUMMARIZER_INSTRUCTIONS_DOC_URL;
      const hasFolder = !!config.SUMMARIZER_KNOWLEDGE_FOLDER_URL;
      Logger.log('AgentSummarizer: Knowledge configuration: instructions=' + hasInstructions + ', folder=' + hasFolder);
    }

    const knowledge = fetchSummarizerKnowledge_({
      instructionsUrl: config.SUMMARIZER_INSTRUCTIONS_DOC_URL,
      knowledgeFolderUrl: config.SUMMARIZER_KNOWLEDGE_FOLDER_URL,
      maxDocs: config.SUMMARIZER_KNOWLEDGE_MAX_DOCS
    });

    if (config.SUMMARIZER_DEBUG) {
      if (knowledge.configured) {
        Logger.log('AgentSummarizer: ✓ Loaded ' + knowledge.metadata.docCount + ' documents, ' +
                   knowledge.metadata.estimatedTokens + ' tokens (' +
                   knowledge.metadata.utilizationPercent + ' utilization)');
      } else {
        Logger.log('AgentSummarizer: ℹ No knowledge configured - using basic summarization instructions');
      }
    }

    // Extract web links from emails for inclusion in summary
    const webLinks = extractWebLinksFromEmails_(emails);

    // Generate email permalink references for the AI
    const emailLinks = generateEmailPermalinks_(emails);

    // Fetch global knowledge (shared across all AI operations)
    const globalKnowledge = fetchGlobalKnowledge_();

    if (config.SUMMARIZER_DEBUG) {
      if (globalKnowledge.configured) {
        Logger.log('AgentSummarizer: ✓ Loaded global knowledge: ' + globalKnowledge.metadata.docCount + ' documents (' +
                   globalKnowledge.metadata.utilizationPercent + ' utilization)');
      }
    }

    // Build configuration for summary generation
    const summaryConfig = {
      emailLinks: emailLinks,
      includeWebLinks: webLinks
    };

    // Build prompt with knowledge injection (new: prompt built by agent, not LLMService)
    const prompt = buildSummaryPrompt_(emails, knowledge, summaryConfig, globalKnowledge);

    // Use existing LLMService function for AI summarization
    const result = generateConsolidatedSummary_(prompt, summaryConfig);

    if (config.SUMMARIZER_DEBUG) {
      Logger.log(`AgentSummarizer: Generated summary for ${emails.length} emails, length: ${result.summary ? result.summary.length : 0} chars`);
    }

    return result;

  } catch (error) {
    Logger.log(`AgentSummarizer generateSummaryFromEmails_ error: ${error.toString()}`);
    return {
      success: false,
      error: `Summary generation failed: ${error.toString()}`
    };
  }
}

// ============================================================================
// Prompt Building (Agent-Owned - ADR-022)
// ============================================================================

/**
 * Build consolidated summary prompt for multiple emails
 * Agent-owned prompt builder (ADR-022: Agents own their prompts)
 * @param {Array} emailContents - Array of email objects with subject, from, date, body
 * @param {Object} knowledge - Knowledge object from KnowledgeService (optional)
 * @param {Object} config - Configuration object with emailLinks, includeWebLinks
 * @param {Object} globalKnowledge - Global knowledge object from KnowledgeService (optional)
 * @returns {string} - Formatted prompt for AI summarization
 */
function buildSummaryPrompt_(emailContents, knowledge, config, globalKnowledge) {
  // Build email reference mapping with subjects and Gmail URLs for the AI
  let emailReferenceMap = 'EMAIL REFERENCE MAP:\n';
  for (let i = 0; i < emailContents.length; i++) {
    const email = emailContents[i];
    // Find the corresponding Gmail URL from the emailLinks config
    const correspondingLink = config.emailLinks ? config.emailLinks.find(link => link.subject === email.subject) : null;
    const gmailUrl = correspondingLink ? correspondingLink.url : `https://mail.google.com/mail/u/0/#inbox/${email.id}`;
    emailReferenceMap += `Email ${i + 1}: Subject="${email.subject}" URL=${gmailUrl}\n`;
  }

  // Combine all email content for single AI request
  let combinedContent = `EMAILS TO SUMMARIZE (${emailContents.length} total):\n\n`;

  for (let i = 0; i < emailContents.length; i++) {
    const email = emailContents[i];
    combinedContent += `--- EMAIL ${i + 1} ---\n`;
    combinedContent += `From: ${email.from}\n`;
    combinedContent += `Subject: ${email.subject}\n`;
    combinedContent += `Date: ${email.date}\n`;
    combinedContent += `Content: ${email.body.substring(0, 1200)}\n\n`;
  }

  // Build web links section if provided - these will be included inline by the AI
  let webLinksSection = '';
  if (config.includeWebLinks && config.includeWebLinks.length > 0) {
    webLinksSection = '\n\nWEB LINKS FOUND IN EMAILS (include these inline in relevant themes):\n' + config.includeWebLinks.join('\n');
  }

  // Build the main prompt
  const promptParts = [
    `Please create a consolidated summary of these ${emailContents.length} emails in the style of "The Economist's World in Brief" - concise, direct, and informative.`
  ];

  // GLOBAL KNOWLEDGE INJECTION (applies to ALL prompts)
  if (globalKnowledge && globalKnowledge.configured) {
    promptParts.push('');
    promptParts.push('=== GLOBAL KNOWLEDGE ===');
    promptParts.push(globalKnowledge.knowledge);

    // Token utilization logging (when SUMMARIZER_DEBUG or DEBUG enabled)
    if (globalKnowledge.metadata && globalKnowledge.metadata.utilizationPercent) {
      const cfg = getConfig_();
      const summarizerCfg = getSummarizerConfig_();
      if (cfg.DEBUG || summarizerCfg.SUMMARIZER_DEBUG) {
        Logger.log(JSON.stringify({
          globalKnowledgeUtilization: globalKnowledge.metadata.utilizationPercent,
          estimatedTokens: globalKnowledge.metadata.estimatedTokens,
          modelLimit: globalKnowledge.metadata.modelLimit
        }, null, 2));
      }
    }
  }

  // AGENT-SPECIFIC KNOWLEDGE INJECTION (summarization guidelines)
  if (knowledge && knowledge.configured) {
    promptParts.push('');
    promptParts.push('=== SUMMARIZATION GUIDELINES ===');
    promptParts.push(knowledge.knowledge);

    // Token utilization logging (when SUMMARIZER_DEBUG enabled)
    if (knowledge.metadata && knowledge.metadata.utilizationPercent) {
      const summarizerCfg = getSummarizerConfig_();
      if (summarizerCfg.SUMMARIZER_DEBUG) {
        console.log(JSON.stringify({
          summarizerKnowledgeUtilization: knowledge.metadata.utilizationPercent,
          estimatedTokens: knowledge.metadata.estimatedTokens,
          modelLimit: knowledge.metadata.modelLimit
        }, null, 2));
      }
    }
  }

  promptParts.push('');
  promptParts.push('REQUIREMENTS:');
  promptParts.push('1. Create ONE unified summary covering all emails');
  promptParts.push('2. Use **bold formatting** for important terms, people, places, and proper nouns');
  promptParts.push('3. Use *italic formatting* for emphasis and context');
  promptParts.push('4. Group related topics together intelligently with clear theme headlines');
  promptParts.push('5. Keep the tone professional, authoritative, and concise');
  promptParts.push('6. Include important web URLs as inline markdown links: [link text](URL)');
  promptParts.push('7. Focus on key insights, decisions, and actionable information');
  promptParts.push('8. Maximum length: 400 words');
  promptParts.push('9. Structure each theme with a clear headline followed by content');
  promptParts.push('10. Include context that helps understand the significance of information');
  promptParts.push('');
  promptParts.push('MARKDOWN FORMATTING REQUIREMENTS:');
  promptParts.push('- Start each major theme with a clear headline (use ### format)');
  promptParts.push('- Group related emails under the same theme when appropriate');
  promptParts.push('- Include web URLs as proper markdown links: [descriptive text](URL) within sentences');
  promptParts.push('- At the end of each theme section, create Gmail links for source emails using this format:');
  promptParts.push('  **Sources:** [Email Subject 1](gmail_url_1), [Email Subject 2](gmail_url_2)');
  promptParts.push('- Use the exact subject lines and Gmail URLs from the EMAIL REFERENCE MAP provided below');
  promptParts.push("- If emails don't naturally group, create logical themes like \"Business Updates\", \"Project Status\", \"Action Items\", etc.");
  promptParts.push('- Use standard markdown formatting throughout (bold, italic, links, headers)');
  promptParts.push('');
  promptParts.push('STYLE NOTES:');
  promptParts.push('- Write like a seasoned journalist summarizing global events');
  promptParts.push('- Be direct and factual, avoid unnecessary adjectives');
  promptParts.push('- Use present tense where appropriate');
  promptParts.push('- Prioritize information by importance and urgency');
  promptParts.push('- Each theme should be self-contained with its relevant source attribution');
  promptParts.push('');
  promptParts.push(emailReferenceMap);
  promptParts.push('');
  promptParts.push(combinedContent + webLinksSection);
  promptParts.push('');
  promptParts.push('Please provide only the summary text using proper markdown formatting (bold, italic, links, headers). Do not include introductory phrases like "Here is a summary" - start directly with the content.');

  return promptParts.join('\n');
}

// Note: Markdown conversion now handled by shared utility in Utility.gs
// This eliminates 44 lines of duplicate code and standardizes markdown processing

/**
 * Send summary email to configured destination
 * Uses generic service layer for email delivery
 */
function deliverSummaryEmail_(summaryText, sourceEmails) {
  try {
    const config = getSummarizerConfig_();

    if (!summaryText) {
      return {
        success: false,
        error: 'No summary text provided'
      };
    }

    const dateResult = formatEmailDate_(new Date());
    const currentDate = dateResult && dateResult.success ? dateResult.date : new Date().toISOString().slice(0, 10);
    // Fix emoji encoding issue by using plain text
    const subject = `Email Summary - ${currentDate}`;

    // Convert markdown to HTML using shared utility with email styling
    const conversionResult = convertMarkdownToHtml_(summaryText, 'email');
    if (!conversionResult.success) {
      return {
        success: false,
        error: 'Failed to convert markdown to HTML: ' + conversionResult.error
      };
    }
    const htmlSummary = conversionResult.html;

    // Build HTML content with proper styling
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #e74c3c; padding-bottom: 10px; margin-bottom: 1.5em;">
          Email Summary - ${currentDate}
        </h2>
        <div style="line-height: 1.6; color: #444;">
          ${htmlSummary}
        </div>
        <p style="margin-top: 2em; font-size: 12px; color: #666;">
          This summary was generated automatically from ${sourceEmails.length} email(s)
          with the "summarize" label from the past ${config.SUMMARIZER_MAX_AGE_DAYS} days.
        </p>
      </div>
    `;

    // Use generic service function for email sending
    return sendFormattedEmail_(
      config.SUMMARIZER_DESTINATION_EMAIL,
      subject,
      htmlContent,
      sourceEmails
    );

  } catch (error) {
    Logger.log(`AgentSummarizer deliverSummaryEmail_ error: ${error.toString()}`);
    return {
      success: false,
      error: `Email delivery failed: ${error.toString()}`
    };
  }
}

/**
 * Process emails after summarization (relabel and archive)
 * Uses generic service layer for label management
 */
function processEmailsAfterSummary_(emails) {
  try {
    const config = getSummarizerConfig_();

    if (!emails || emails.length === 0) {
      return { success: true, processed: 0 };
    }

    // Ensure the "summarized" label exists
    ensureSummarizedLabel_();

    // Extract email IDs for batch operations
    const emailIds = emails.map(email => email.id);

    if (config.SUMMARIZER_DRY_RUN) {
      Logger.log(`AgentSummarizer: DRY RUN - Would process ${emailIds.length} emails (relabel and archive)`);
      return {
        success: true,
        processed: emailIds.length,
        dryRun: true
      };
    }

    // Use generic service function for label transition
    const labelResult = manageLabelTransition_(
      emailIds,
      ['summarize'],      // Remove "summarize" label
      ['summarized']      // Add "summarized" label
    );

    if (!labelResult.success) {
      return labelResult;
    }

    // Use generic service function for archiving
    const archiveResult = archiveEmailsByIds_(emailIds);

    if (config.SUMMARIZER_DEBUG) {
      Logger.log(`AgentSummarizer: Processed ${labelResult.processed} emails, archived ${archiveResult.archived} emails`);
    }

    return {
      success: true,
      processed: labelResult.processed,
      archived: archiveResult.archived,
      message: `Processed ${labelResult.processed} emails and archived ${archiveResult.archived} threads`
    };

  } catch (error) {
    Logger.log(`AgentSummarizer processEmailsAfterSummary_ error: ${error.toString()}`);
    return {
      success: false,
      error: `Post-processing failed: ${error.toString()}`
    };
  }
}

// ============================================================================
// Main Agent Logic
// ============================================================================

/**
 * Email Summarizer agent handler function
 * Integrates with existing agent framework and context system
 * ctx provides: label, decision, threadId, thread (GmailThread), cfg, dryRun, log(msg)
 * Returns { status: 'ok'|'skip'|'retry'|'error', info?: string }
 */
function summarizerAgentHandler(ctx) {
  try {
    const config = getSummarizerConfig_();

    if (!config.SUMMARIZER_ENABLED) {
      return { status: 'skip', info: 'summarizer agent disabled' };
    }

    ctx.log('Email Summarizer agent running for thread ' + ctx.threadId);

    // Check if we should archive on label
    if (config.SUMMARIZER_ARCHIVE_ON_LABEL) {
      if (ctx.dryRun || config.SUMMARIZER_DRY_RUN) {
        ctx.log('DRY RUN - Would archive email immediately after labeling');
        return { status: 'ok', info: 'dry-run mode - email would be archived and queued for summarization' };
      }

      // Archive the email thread immediately
      try {
        ctx.thread.moveToArchive();
        ctx.log('Email archived immediately after "summarize" label applied');
        return { status: 'ok', info: 'email archived and queued for summarization' };
      } catch (archiveError) {
        ctx.log('Failed to archive email: ' + archiveError.toString());
        return { status: 'error', info: 'failed to archive: ' + archiveError.toString() };
      }
    } else {
      // Archive disabled - just queue for summarization
      if (ctx.dryRun || config.SUMMARIZER_DRY_RUN) {
        return { status: 'ok', info: 'dry-run mode - email queued for summarization' };
      }

      ctx.log('Email queued for next scheduled summarization run (archive-on-label disabled)');
      return { status: 'ok', info: 'email queued for summarization' };
    }

  } catch (error) {
    ctx.log('Email Summarizer agent error: ' + error.toString());
    return { status: 'error', info: error.toString() };
  }
}

// ============================================================================
// Scheduled Execution Logic
// ============================================================================

/**
 * Main scheduled summarization workflow
 * Runs independently of individual email processing
 */
function runEmailSummarizer() {
  try {
    const config = getSummarizerConfig_();

    if (!config.SUMMARIZER_ENABLED) {
      console.log('Email Summarizer is disabled');
      return { success: false, reason: 'disabled' };
    }

    console.log('Email Summarizer: Starting scheduled run');

    // Step 1: Find emails for summarization
    const emailResult = findEmailsForSummary_();
    if (!emailResult.success) {
      console.log('Email Summarizer: Error finding emails - ' + emailResult.error);
      return { success: false, error: emailResult.error };
    }

    if (emailResult.count === 0) {
      console.log('Email Summarizer: No emails found for summarization');
      return { success: true, reason: 'no_emails', processed: 0 };
    }

    console.log(`Email Summarizer: Found ${emailResult.count} emails for summarization`);

    // Step 2: Generate AI summary
    const summaryResult = generateSummaryFromEmails_(emailResult.emails);
    if (!summaryResult.success) {
      console.log('Email Summarizer: Error generating summary - ' + summaryResult.error);
      return { success: false, error: summaryResult.error };
    }

    // Step 3: Deliver summary email
    const deliveryResult = deliverSummaryEmail_(summaryResult.summary, emailResult.emails);
    if (!deliveryResult.success) {
      console.log('Email Summarizer: Error delivering summary - ' + deliveryResult.error);
      return { success: false, error: deliveryResult.error };
    }

    console.log('Email Summarizer: Summary email delivered successfully');

    // Step 4: Process emails (relabel and archive)
    const processResult = processEmailsAfterSummary_(emailResult.emails);
    if (!processResult.success) {
      console.log('Email Summarizer: Error processing emails - ' + processResult.error);
      return { success: false, error: processResult.error };
    }

    const finalMessage = `Email Summarizer completed: processed ${emailResult.count} emails, delivered summary to ${config.SUMMARIZER_DESTINATION_EMAIL}`;
    console.log(finalMessage);

    return {
      success: true,
      processed: emailResult.count,
      delivered: true,
      archived: processResult.archived || 0,
      message: finalMessage
    };

  } catch (error) {
    const errorMsg = 'Email Summarizer scheduled run error: ' + error.toString();
    console.log(errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ============================================================================
// Trigger Management (Self-Contained)
// ============================================================================

/**
 * Install daily trigger for Email Summarizer
 * Agents manage their own trigger lifecycle
 */
function installSummarizerTrigger() {
  // Use shared utility for trigger management
  const result = createTimeTrigger_('runEmailSummarizer', { type: 'daily', hour: 5 });
  if (result.success) {
    console.log('Email Summarizer trigger installed successfully (daily at 5 AM)');
  }
  return result;
}

/**
 * Remove all Email Summarizer triggers
 */
function deleteSummarizerTriggers_() {
  // Use shared utility for trigger cleanup
  return deleteTriggersByFunction_('runEmailSummarizer');
}

/**
 * List Email Summarizer triggers for debugging
 */
function listSummarizerTriggers() {
  // Use shared utility for trigger listing
  return listTriggersByFunction_('runEmailSummarizer');
}

// ============================================================================
// Agent Registration
// ============================================================================

if (typeof AGENT_MODULES === 'undefined') {
  AGENT_MODULES = [];
}

AGENT_MODULES.push(function(api) {
  /**
   * Register Email Summarizer agent for "summarize" label
   * Agent acknowledges emails via onLabel (immediate archive if enabled)
   * Separate daily trigger handles actual summarization (runEmailSummarizer)
   *
   * Uses dual-hook pattern:
   * - onLabel: Immediate archive when label applied (if enabled)
   * - postLabel: null (uses separate daily trigger instead)
   */
  api.register(
    'summarize',           // Label to trigger on
    'emailSummarizer',     // Agent name
    {
      onLabel: summarizerAgentHandler,  // Immediate archive behavior
      postLabel: null                    // Uses separate daily trigger
    },
    {
      runWhen: 'afterLabel',  // Run after labeling (respects dry-run)
      timeoutMs: 30000,       // Soft timeout guidance
      enabled: true           // Enabled by default
    }
  );
});