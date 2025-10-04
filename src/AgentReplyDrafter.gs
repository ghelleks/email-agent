/**
 * Reply Drafter Agent - Self-Contained Implementation
 *
 * This agent implements automated reply drafting for emails labeled "reply_needed":
 * - Checks for existing drafts to ensure idempotency
 * - Fetches optional knowledge from Google Drive via KnowledgeService
 * - Retrieves full email thread context
 * - Generates professional reply drafts using AI
 * - Creates Gmail draft replies automatically
 * - Runs after labeling (respects dry-run mode)
 *
 * Dual-Hook Architecture:
 * 1. onLabel: Runs during classification (immediate draft for newly-classified emails)
 * 2. postLabel: Runs after all labeling (scans inbox for manually-labeled emails)
 *
 * Features:
 * - Self-contained: manages own config without core Config.gs changes
 * - Idempotent: skips emails that already have drafts
 * - Knowledge-aware: optionally uses drafting instructions and context
 * - Thread-aware: processes full conversation history
 * - Dual-mode: immediate + inbox scanning without separate trigger
 * - Full error handling and dry-run support
 */

// ============================================================================
// Configuration Management (Self-Contained)
// ============================================================================

/**
 * Get Reply Drafter agent configuration with sensible defaults
 * Manages own PropertiesService keys without core Config.gs changes
 */
function getReplyDrafterConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    // Agent enablement
    REPLY_DRAFTER_ENABLED: (props.getProperty('REPLY_DRAFTER_ENABLED') || 'true').toLowerCase() === 'true',

    // Knowledge configuration
    REPLY_DRAFTER_INSTRUCTIONS_URL: props.getProperty('REPLY_DRAFTER_INSTRUCTIONS_URL'),
    REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL: props.getProperty('REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL'),
    REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS: parseInt(props.getProperty('REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS') || '5', 10),

    // Debugging and testing
    REPLY_DRAFTER_DEBUG: (props.getProperty('REPLY_DRAFTER_DEBUG') || 'false').toLowerCase() === 'true',
    REPLY_DRAFTER_DRY_RUN: (props.getProperty('REPLY_DRAFTER_DRY_RUN') || 'false').toLowerCase() === 'true'
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a draft already exists for the given thread
 * Returns true if draft exists, false otherwise
 *
 * @param {string} threadId - Gmail thread ID
 * @return {boolean} True if draft exists for this thread
 */
function draftExistsForThread_(threadId) {
  try {
    const drafts = GmailApp.getDrafts();

    for (let i = 0; i < drafts.length; i++) {
      const draftMessage = drafts[i].getMessage();
      const draftThreadId = draftMessage.getThread().getId();

      if (draftThreadId === threadId) {
        return true;
      }
    }

    return false;
  } catch (error) {
    Logger.log('Error checking for existing draft: ' + error.toString());
    // On error, assume no draft exists to avoid blocking draft creation
    return false;
  }
}

/**
 * Get email thread data including all messages
 * Returns structured thread object for AI processing
 *
 * @param {string} threadId - Gmail thread ID
 * @return {Object} Thread object with messages array
 */
function getEmailThread_(threadId) {
  try {
    const thread = GmailApp.getThreadById(threadId);

    if (!thread) {
      throw new Error('Thread not found: ' + threadId);
    }

    const messages = thread.getMessages();
    const threadData = {
      id: threadId,
      messageCount: messages.length,
      messages: []
    };

    // Extract message details
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      threadData.messages.push({
        from: msg.getFrom(),
        to: msg.getTo(),
        subject: msg.getSubject(),
        date: msg.getDate().toISOString(),
        body: msg.getPlainBody()
      });
    }

    return threadData;

  } catch (error) {
    throw new Error('Failed to retrieve email thread: ' + error.toString());
  }
}

/**
 * Create a draft reply for the given thread
 * Uses Gmail API to create draft as reply to latest message
 *
 * @param {string} threadId - Gmail thread ID
 * @param {string} draftText - Reply text to include in draft
 * @return {Object} Result object with success status
 */
function createDraftReply_(threadId, draftText) {
  try {
    const thread = GmailApp.getThreadById(threadId);

    if (!thread) {
      return {
        success: false,
        error: 'Thread not found: ' + threadId
      };
    }

    // Get the most recent message to reply to
    const messages = thread.getMessages();
    const latestMessage = messages[messages.length - 1];

    // Create draft as reply
    const draft = latestMessage.createDraftReply(draftText);

    return {
      success: true,
      draftId: draft.getId(),
      message: 'Draft created successfully'
    };

  } catch (error) {
    Logger.log('Error creating draft reply: ' + error.toString());
    return {
      success: false,
      error: 'Failed to create draft: ' + error.toString()
    };
  }
}

// ============================================================================
// Prompt Building (Agent-Owned - ADR-022)
// ============================================================================

/**
 * Format email thread for inclusion in prompt
 * @private
 * @param {Object} emailThread - Thread object with messages array
 * @returns {string} - Formatted email thread
 */
function formatEmailThread_(emailThread) {
  if (!emailThread || !emailThread.messages || emailThread.messages.length === 0) {
    return 'No email thread available.';
  }

  return emailThread.messages.map(function(msg, idx) {
    const parts = [];
    parts.push('--- Email ' + (idx + 1) + ' ---');
    parts.push('From: ' + (msg.from || 'Unknown'));
    parts.push('To: ' + (msg.to || 'Unknown'));
    parts.push('Date: ' + (msg.date || 'Unknown'));
    parts.push('Subject: ' + (msg.subject || '(No subject)'));
    parts.push('');
    parts.push(msg.body || '(No content)');
    return parts.join('\n');
  }).join('\n\n');
}

/**
 * Build reply draft prompt with optional knowledge injection
 * Agent-owned prompt builder (ADR-022: Agents own their prompts)
 * @param {Object} emailThread - Thread object with messages array
 * @param {Object} knowledge - Knowledge object from KnowledgeService (optional)
 * @param {Object} globalKnowledge - Global knowledge object from KnowledgeService (optional)
 * @returns {string} - Complete prompt for reply generation
 */
function buildReplyDraftPrompt_(emailThread, knowledge, globalKnowledge) {
  const parts = ['You are drafting a professional email reply.'];

  // GLOBAL KNOWLEDGE INJECTION (applies to ALL prompts)
  if (globalKnowledge && globalKnowledge.configured) {
    parts.push('');
    parts.push('=== GLOBAL KNOWLEDGE ===');
    parts.push(globalKnowledge.knowledge);

    // Token utilization logging (when REPLY_DRAFTER_DEBUG or DEBUG enabled)
    if (globalKnowledge.metadata && globalKnowledge.metadata.utilizationPercent) {
      const cfg = getConfig_();
      if (cfg.DEBUG || cfg.REPLY_DRAFTER_DEBUG) {
        Logger.log(JSON.stringify({
          globalKnowledgeUtilization: globalKnowledge.metadata.utilizationPercent,
          estimatedTokens: globalKnowledge.metadata.estimatedTokens,
          modelLimit: globalKnowledge.metadata.modelLimit
        }, null, 2));
      }
    }
  }

  // AGENT-SPECIFIC KNOWLEDGE INJECTION (reply drafting instructions)
  if (knowledge && knowledge.configured) {
    parts.push('');
    parts.push('=== YOUR DRAFTING INSTRUCTIONS ===');
    parts.push(knowledge.knowledge);

    // Add signature requirement
    parts.push('');
    parts.push('SIGNATURE REQUIREMENT:');
    parts.push('- Sign the email with your name if specified in the instructions above');
    parts.push('- If your name is not clear from the instructions, use "[Your name here]" as the signature');

    // Add source attribution if available
    if (knowledge.metadata && knowledge.metadata.sources && knowledge.metadata.sources.length > 0) {
      parts.push('');
      const sourceNames = knowledge.metadata.sources.map(function(s) { return s.name; });
      parts.push('Context sources: ' + sourceNames.join(', '));
    }

    // Token utilization logging (when REPLY_DRAFTER_DEBUG enabled)
    if (knowledge.metadata && knowledge.metadata.utilizationPercent) {
      const cfg = getConfig_();
      if (cfg.REPLY_DRAFTER_DEBUG) {
        console.log(JSON.stringify({
          replyDrafterKnowledgeUtilization: knowledge.metadata.utilizationPercent,
          estimatedTokens: knowledge.metadata.estimatedTokens,
          modelLimit: knowledge.metadata.modelLimit
        }, null, 2));
      }
    }
  } else {
    // Basic instructions when no knowledge configured
    parts.push('');
    parts.push('=== DRAFTING GUIDELINES ===');
    parts.push('- Match the tone and formality of the original email');
    parts.push('- Be concise and actionable');
    parts.push('- Address all questions and concerns raised');
    parts.push('- Use a professional but friendly tone');
    parts.push('- End with appropriate next steps or closing');
    parts.push('- Sign with the user\'s name from the knowledge/instructions, or use "[Your name here]" if not specified');
  }

  parts.push('');
  parts.push('=== EMAIL THREAD ===');
  parts.push(formatEmailThread_(emailThread));
  parts.push('');
  parts.push('=== REPLY INSTRUCTIONS ===');
  parts.push('Draft a professional reply that addresses all points raised in the most recent email.');
  parts.push('');
  parts.push('IMPORTANT FORMAT REQUIREMENTS:');
  parts.push('- Return ONLY the email body text (no subject line, no "Subject:", no headers)');
  parts.push('- Start directly with the greeting or body content');
  parts.push('- End with an appropriate signature');
  parts.push('- Sign the email with the user\'s name if provided in the drafting instructions');
  parts.push('- If the user\'s name is not clear from the instructions, use "[Your name here]" as the signature');
  parts.push('- Do NOT include any preamble, explanation, or meta-commentary');

  return parts.join('\n');
}

// ============================================================================
// Main Agent Logic
// ============================================================================

/**
 * Reply Drafter agent handler function
 * Integrates with existing agent framework and context system
 * ctx provides: label, decision, threadId, thread (GmailThread), cfg, dryRun, log(msg)
 * Returns { status: 'ok'|'skip'|'retry'|'error', info?: string }
 */
function processReplyNeeded_(ctx) {
  try {
    const config = getReplyDrafterConfig_();

    // Check if agent is enabled
    if (!config.REPLY_DRAFTER_ENABLED) {
      return { status: 'skip', info: 'reply drafter agent disabled' };
    }

    ctx.log('Reply Drafter agent running for thread ' + ctx.threadId);

    // Check for dry-run mode
    if (ctx.dryRun || config.REPLY_DRAFTER_DRY_RUN) {
      ctx.log('DRY RUN - Would check for existing draft and generate reply');
      return { status: 'ok', info: 'dry-run mode - draft would be created' };
    }

    // Check if draft already exists (idempotent)
    if (draftExistsForThread_(ctx.threadId)) {
      ctx.log('Draft already exists for this thread, skipping');
      return { status: 'skip', info: 'draft already exists' };
    }

    // Fetch knowledge via KnowledgeService
    let knowledge = null;
    try {
      if (config.REPLY_DRAFTER_DEBUG) {
        const hasInstructions = !!config.REPLY_DRAFTER_INSTRUCTIONS_URL;
        const hasFolder = !!config.REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL;
        ctx.log('Knowledge configuration: instructions=' + hasInstructions + ', folder=' + hasFolder);
      }

      knowledge = fetchReplyKnowledge_({
        instructionsUrl: config.REPLY_DRAFTER_INSTRUCTIONS_URL,
        knowledgeFolderUrl: config.REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL,
        maxDocs: config.REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS
      });

      if (config.REPLY_DRAFTER_DEBUG) {
        if (knowledge.configured) {
          ctx.log('✓ Loaded reply knowledge: ' + knowledge.metadata.docCount + ' documents, ' +
                  knowledge.metadata.estimatedTokens + ' tokens (' +
                  knowledge.metadata.utilizationPercent + ' utilization)');
        } else {
          ctx.log('ℹ No knowledge configured - using basic drafting instructions');
        }
      }
    } catch (knowledgeError) {
      // Knowledge fetch errors should propagate (fail-fast)
      ctx.log('✗ Knowledge fetch failed: ' + knowledgeError.toString());
      return { status: 'error', info: 'knowledge fetch failed: ' + knowledgeError.toString() };
    }

    // Get email thread data
    let emailThread;
    try {
      emailThread = getEmailThread_(ctx.threadId);

      if (config.REPLY_DRAFTER_DEBUG) {
        ctx.log('Retrieved thread with ' + emailThread.messageCount + ' messages');
      }
    } catch (threadError) {
      ctx.log('Failed to retrieve thread: ' + threadError.toString());
      return { status: 'error', info: 'thread retrieval failed: ' + threadError.toString() };
    }

    // Fetch global knowledge (shared across all AI operations)
    let globalKnowledge;
    try {
      globalKnowledge = fetchGlobalKnowledge_();

      if (config.REPLY_DRAFTER_DEBUG && globalKnowledge.configured) {
        ctx.log('✓ Loaded global knowledge: ' + globalKnowledge.metadata.docCount + ' documents (' +
                globalKnowledge.metadata.utilizationPercent + ' utilization)');
      }
    } catch (globalKnowledgeError) {
      ctx.log('✗ Global knowledge fetch failed: ' + globalKnowledgeError.toString());
      return { status: 'error', info: 'global knowledge fetch failed: ' + globalKnowledgeError.toString() };
    }

    // Build prompt via PromptBuilder
    let prompt;
    try {
      prompt = buildReplyDraftPrompt_(emailThread, knowledge, globalKnowledge);

      if (config.REPLY_DRAFTER_DEBUG) {
        ctx.log('Built prompt: ' + prompt.length + ' characters');
      }
    } catch (promptError) {
      ctx.log('Failed to build prompt: ' + promptError.toString());
      return { status: 'error', info: 'prompt build failed: ' + promptError.toString() };
    }

    // Generate draft via LLMService
    let draftText;
    try {
      const cfg = getConfig_();
      draftText = generateReplyDraft_(
        prompt,
        cfg.MODEL_PRIMARY,
        cfg.PROJECT_ID,
        cfg.LOCATION,
        cfg.GEMINI_API_KEY
      );

      if (config.REPLY_DRAFTER_DEBUG) {
        ctx.log('Generated draft: ' + draftText.length + ' characters');
      }
    } catch (aiError) {
      ctx.log('AI generation failed: ' + aiError.toString());
      return { status: 'error', info: 'AI generation failed: ' + aiError.toString() };
    }

    // Create Gmail draft
    const draftResult = createDraftReply_(ctx.threadId, draftText);

    if (!draftResult.success) {
      ctx.log('Draft creation failed: ' + draftResult.error);
      return { status: 'error', info: draftResult.error };
    }

    ctx.log('Draft created successfully');
    return {
      status: 'ok',
      info: 'draft created with ' + draftText.length + ' characters'
    };

  } catch (error) {
    ctx.log('Reply Drafter agent error: ' + error.toString());
    return { status: 'error', info: error.toString() };
  }
}

// ============================================================================
// postLabel Handler - Inbox-Wide Scanning
// ============================================================================

/**
 * Scan all existing emails with "reply_needed" label (postLabel hook)
 * Runs after all classification/labeling complete to handle:
 * - Manually labeled emails
 * - Emails labeled before agent was deployed
 * - Failed draft creations that need retry
 *
 * This complements the onLabel handler which runs during classification.
 * No parameters - scans inbox independently and uses idempotency to skip processed emails.
 */
function replyDrafterPostLabelScan_() {
  try {
    const config = getReplyDrafterConfig_();

    if (!config.REPLY_DRAFTER_ENABLED) {
      return;
    }

    if (config.REPLY_DRAFTER_DEBUG) {
      Logger.log('Reply Drafter postLabel: Starting inbox scan');
    }

    // Find all emails with "reply_needed" label in inbox
    const query = 'in:inbox label:reply_needed';
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
      if (config.REPLY_DRAFTER_DEBUG) {
        Logger.log('Reply Drafter postLabel: No emails found with reply_needed label');
      }
      return;
    }

    if (config.REPLY_DRAFTER_DEBUG) {
      Logger.log(`Reply Drafter postLabel: Found ${threads.length} emails with reply_needed label`);
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const threadId = thread.getId();

      try {
        // Check if draft already exists (idempotency)
        if (draftExistsForThread_(threadId)) {
          skipped++;
          if (config.REPLY_DRAFTER_DEBUG) {
            Logger.log(`Reply Drafter postLabel: Skipping thread ${threadId} (draft already exists)`);
          }
          continue;
        }

        // Get thread data
        const threadData = getEmailThread_(threadId);
        if (!threadData || !threadData.messages || threadData.messages.length === 0) {
          Logger.log(`Reply Drafter postLabel: Skipping thread ${threadId} (no messages)`);
          skipped++;
          continue;
        }

        // Fetch knowledge if configured
        if (config.REPLY_DRAFTER_DEBUG && i === 0) {
          // Log knowledge config once at start
          const hasInstructions = !!config.REPLY_DRAFTER_INSTRUCTIONS_URL;
          const hasFolder = !!config.REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL;
          Logger.log('Reply Drafter postLabel: Knowledge configuration: instructions=' + hasInstructions + ', folder=' + hasFolder);
        }

        const knowledge = fetchReplyKnowledge_({
          instructionsUrl: config.REPLY_DRAFTER_INSTRUCTIONS_URL,
          knowledgeFolderUrl: config.REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL,
          maxDocs: config.REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS
        });

        if (config.REPLY_DRAFTER_DEBUG && i === 0) {
          // Log knowledge load result once at start
          if (knowledge.configured) {
            Logger.log('Reply Drafter postLabel: ✓ Loaded ' + knowledge.metadata.docCount + ' documents (' +
                        knowledge.metadata.utilizationPercent + ' utilization)');
          } else {
            Logger.log('Reply Drafter postLabel: ℹ No knowledge configured - using basic drafting instructions');
          }
        }

        // Get AI configuration
        const cfg = getConfig_();

        // Fetch global knowledge (shared across all AI operations)
        const globalKnowledge = fetchGlobalKnowledge_();

        if (config.REPLY_DRAFTER_DEBUG && i === 0 && globalKnowledge.configured) {
          Logger.log('Reply Drafter postLabel: ✓ Loaded global knowledge: ' + globalKnowledge.metadata.docCount + ' documents (' +
                      globalKnowledge.metadata.utilizationPercent + ' utilization)');
        }

        // Build AI prompt
        const prompt = buildReplyDraftPrompt_(threadData, knowledge, globalKnowledge);
        const model = cfg.GEMINI_MODEL || 'gemini-2.0-flash-exp';
        const projectId = cfg.PROJECT_ID;
        const location = cfg.VERTEX_LOCATION || 'us-central1';
        const apiKey = cfg.GEMINI_API_KEY;

        // Generate reply draft
        let draftText;
        if (config.REPLY_DRAFTER_DRY_RUN) {
          Logger.log(`Reply Drafter postLabel: DRY RUN - Would generate draft for thread ${threadId}`);
          draftText = '[DRY RUN] Draft would be generated here';
        } else {
          draftText = generateReplyDraft_(prompt, model, projectId, location, apiKey);
        }

        // Create Gmail draft
        if (!config.REPLY_DRAFTER_DRY_RUN) {
          const draftResult = createDraftReply_(threadId, draftText);

          if (!draftResult.success) {
            Logger.log(`Reply Drafter postLabel: Failed to create draft for thread ${threadId} - ${draftResult.error}`);
            errors++;
            continue;
          }

          Logger.log(`Reply Drafter postLabel: Created draft for thread ${threadId}`);
        }

        processed++;

      } catch (error) {
        errors++;
        Logger.log(`Reply Drafter postLabel: Error processing thread ${threadId} - ${error.toString()}`);
      }
    }

    if (processed > 0 || errors > 0) {
      Logger.log(`Reply Drafter postLabel completed: processed ${processed}, skipped ${skipped}, errors ${errors} (total: ${threads.length})`);
    } else if (config.REPLY_DRAFTER_DEBUG) {
      Logger.log(`Reply Drafter postLabel: All ${threads.length} emails already have drafts`);
    }

  } catch (error) {
    Logger.log('Reply Drafter postLabel error: ' + error.toString());
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
   * Register Reply Drafter agent for "reply_needed" label
   * Agent generates draft replies for emails requiring responses
   *
   * Uses dual-hook pattern:
   * - onLabel: Immediate draft creation during classification
   * - postLabel: Inbox scan to catch manually-labeled emails
   */
  api.register(
    'reply_needed',           // Label to trigger on
    'ReplyDrafter',           // Agent name
    {
      onLabel: processReplyNeeded_,      // Immediate per-email handler
      postLabel: replyDrafterPostLabelScan_  // Inbox-wide scan handler
    },
    {
      runWhen: 'afterLabel',  // Run after labeling (respects dry-run)
      timeoutMs: 30000,       // Soft timeout guidance
      enabled: true           // Enabled by default
    }
  );
});
