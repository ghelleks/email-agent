/**
 * AgentTemplate demonstrates the dual-hook agent architecture pattern.
 *
 * This template shows how to create agents using the dual-hook system:
 * - Configuration management (self-managed properties)
 * - Label management (creates own labels)
 * - onLabel hook (immediate per-email actions)
 * - postLabel hook (inbox-wide scanning)
 * - Service integration (uses generic service layer)
 *
 * See ADR-011: Self-Contained Agent Architecture for detailed guidance.
 * See ADR-018: Dual-Hook Agent Architecture for hook patterns.
 */

/**
 * TEMPLATE: Dual-Hook Agent Pattern
 *
 * Copy this template and customize for your agent:
 * 1. Update configuration function with your agent's settings
 * 2. Implement onLabel hook for immediate per-email actions (optional)
 * 3. Implement postLabel hook for inbox-wide scanning (optional)
 * 4. At least one hook (onLabel or postLabel) must be provided
 * 5. Register your agent with dual-hook object
 *
 * Hook Selection Guide:
 * - onLabel only: Immediate actions on newly-classified emails
 * - postLabel only: Periodic inbox scanning (no immediate response)
 * - Both hooks: Immediate action + catch manually-labeled emails
 */
// ============================================================================
// TEMPLATE: Configuration Management (Self-Contained Pattern)
// ============================================================================

/**
 * Get agent-specific configuration with defaults
 * Agents manage their own PropertiesService keys without core Config.gs changes
 */
function getTemplateAgentConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    // Basic agent settings
    TEMPLATE_ENABLED: (props.getProperty('TEMPLATE_AGENT_ENABLED') || 'true').toLowerCase() === 'true',
    TEMPLATE_MAX_ITEMS: parseInt(props.getProperty('TEMPLATE_MAX_ITEMS') || '10', 10),
    TEMPLATE_DESTINATION: props.getProperty('TEMPLATE_DESTINATION') || Session.getActiveUser().getEmail(),

    // Knowledge configuration (for AI-powered agents - ADR-015 semantic naming)
    // INSTRUCTIONS: How to perform the task (methodology, criteria, guidelines)
    // KNOWLEDGE: Contextual reference material (examples, background, patterns)
    TEMPLATE_INSTRUCTIONS_DOC_URL: props.getProperty('TEMPLATE_INSTRUCTIONS_DOC_URL'),
    TEMPLATE_KNOWLEDGE_FOLDER_URL: props.getProperty('TEMPLATE_KNOWLEDGE_FOLDER_URL'),
    TEMPLATE_KNOWLEDGE_MAX_DOCS: parseInt(props.getProperty('TEMPLATE_KNOWLEDGE_MAX_DOCS') || '5', 10),

    // Debugging
    TEMPLATE_DEBUG: (props.getProperty('TEMPLATE_DEBUG') || 'false').toLowerCase() === 'true',
    TEMPLATE_DRY_RUN: (props.getProperty('TEMPLATE_DRY_RUN') || 'false').toLowerCase() === 'true'
  };
}

// ============================================================================
// TEMPLATE: Label Management (Self-Contained Pattern)
// ============================================================================

/**
 * Ensure agent-specific labels exist
 * Agents create and manage their own labels independently
 */
function ensureTemplateAgentLabels_() {
  const labelName = 'template_processed'; // Use descriptive, agent-specific names
  return GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
}

// ============================================================================
// TEMPLATE: onLabel Hook - Immediate Per-Email Actions
// ============================================================================

/**
 * Template agent onLabel handler (immediate action on newly-classified emails)
 * ctx provides: label, decision, threadId, thread (GmailThread), cfg, dryRun, log(msg)
 * Returns { status: 'ok'|'skip'|'retry'|'error', info?: string }
 *
 * This hook fires immediately as each email is labeled during classification.
 * Use for actions that should happen right away (forward, draft, notify).
 */
function templateAgentOnLabel_(ctx) {
  try {
    // Get agent-specific configuration
    const config = getTemplateAgentConfig_();

    if (!config.TEMPLATE_ENABLED) {
      return { status: 'skip', info: 'agent disabled' };
    }

    ctx.log('templateAgent running for thread ' + ctx.threadId);

    if (ctx.dryRun) {
      return { status: 'skip', info: 'dry-run mode' };
    }

    // Ensure agent labels exist
    const processedLabel = ensureTemplateAgentLabels_();

    // For AI-powered agents: Fetch knowledge before processing
    // Uncomment if your agent uses AI with customizable behavior
    // const knowledge = fetchTemplateAgentKnowledge_({
    //   instructionsUrl: config.TEMPLATE_INSTRUCTIONS_DOC_URL,
    //   knowledgeFolderUrl: config.TEMPLATE_KNOWLEDGE_FOLDER_URL,
    //   maxDocs: config.TEMPLATE_KNOWLEDGE_MAX_DOCS
    // });
    //
    // Fetch global knowledge (shared across all AI operations)
    // const globalKnowledge = fetchGlobalKnowledge_({
    //   folderUrl: ctx.cfg.GLOBAL_KNOWLEDGE_FOLDER_URL,
    //   maxDocs: ctx.cfg.GLOBAL_KNOWLEDGE_MAX_DOCS
    // });
    //
    // Build AI prompt with knowledge injection
    // const prompt = buildTemplatePrompt_(emailData, knowledge, globalKnowledge, config);
    //
    // Call LLMService with built prompt
    // const result = someAIFunction_(prompt, config);

    // TODO: Implement your agent's main logic here
    // Example: Add processed label to show agent ran
    ctx.thread.addLabel(processedLabel);

    return { status: 'ok', info: 'template agent onLabel processed thread' };

  } catch (error) {
    // Use shared utility for standardized error handling
    const errorResult = standardErrorHandler_(error, 'templateAgent onLabel');
    ctx.log('templateAgent onLabel error: ' + errorResult.message);
    return { status: 'error', info: errorResult.message };
  }
}

// ============================================================================
// TEMPLATE: postLabel Hook - Inbox-Wide Scanning
// ============================================================================

/**
 * Template agent postLabel handler (inbox scan after all labeling complete)
 * No parameters - scans inbox independently for emails with target label
 *
 * This hook fires once after all classification/labeling is complete.
 * Use for catching manually-labeled emails, cleanup operations, batch processing.
 * Implement idempotency to skip already-processed emails.
 */
function templateAgentPostLabel_() {
  try {
    const config = getTemplateAgentConfig_();

    if (!config.TEMPLATE_ENABLED) {
      return;
    }

    if (config.TEMPLATE_DEBUG) {
      Logger.log('templateAgent postLabel: Starting inbox scan');
    }

    // Find all emails with target label (adjust label name as needed)
    const query = 'in:inbox label:template_target';  // Replace with your label
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
      if (config.TEMPLATE_DEBUG) {
        Logger.log('templateAgent postLabel: No emails found');
      }
      return;
    }

    Logger.log(`templateAgent postLabel: Found ${threads.length} emails to process`);

    let processed = 0;
    let skipped = 0;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const threadId = thread.getId();

      try {
        // TODO: Implement idempotency check
        // Example: Check if thread has been processed before
        // const processedLabel = GmailApp.getUserLabelByName('template_processed');
        // if (thread.getLabels().some(l => l.getName() === 'template_processed')) {
        //   skipped++;
        //   continue;
        // }

        // TODO: Implement your processing logic here
        if (config.TEMPLATE_DRY_RUN) {
          Logger.log(`templateAgent postLabel: DRY RUN - Would process thread ${threadId}`);
        } else {
          // Your processing logic here
          // Example: thread.addLabel(processedLabel);
        }

        processed++;

      } catch (error) {
        Logger.log(`templateAgent postLabel: Error processing thread ${threadId} - ${error.toString()}`);
      }
    }

    if (processed > 0) {
      Logger.log(`templateAgent postLabel completed: processed ${processed}, skipped ${skipped}`);
    }

  } catch (error) {
    Logger.log('templateAgent postLabel error: ' + error.toString());
  }
}

// ============================================================================
// TEMPLATE: Trigger Management (Optional - for scheduled agents)
// ============================================================================

/**
 * Install scheduled trigger for this agent (if needed)
 * Agents manage their own trigger lifecycle
 */
function installTemplateAgentTrigger() {
  // Use shared utility for trigger management
  const result = createTimeTrigger_('runTemplateAgent', { type: 'daily', hour: 5 });
  if (result.success) {
    console.log('Template agent trigger installed successfully');
  }
  return result;
}

/**
 * Entry point for scheduled execution
 */
function runTemplateAgent() {
  try {
    const config = getTemplateAgentConfig_();
    if (!config.TEMPLATE_ENABLED) {
      console.log('Template agent is disabled');
      return;
    }

    // TODO: Implement scheduled agent logic here
    // This runs independently of the main email processing workflow

    console.log('Template agent scheduled run completed');
  } catch (error) {
    // Use shared utility for error handling
    const errorResult = standardErrorHandler_(error, 'templateAgent scheduled run');
    console.log(errorResult.message);
  }
}

/**
 * Remove all triggers for this agent
 */
function deleteTemplateAgentTriggers_() {
  // Use shared utility for trigger cleanup
  return deleteTriggersByFunction_('runTemplateAgent');
}

// ============================================================================
// TEMPLATE: KnowledgeService Integration (For AI-Powered Agents)
// ============================================================================

/**
 * Example: Fetch agent-specific knowledge from Google Drive
 *
 * For AI-powered agents, use KnowledgeService to fetch customization documents:
 * - INSTRUCTIONS: How to perform tasks (methodology, style, criteria)
 * - KNOWLEDGE: Contextual reference material (examples, context, patterns)
 *
 * This pattern enables users to customize agent behavior without code changes.
 *
 * See ADR-015 for INSTRUCTIONS vs KNOWLEDGE semantic naming convention.
 * See Email Summarizer (AgentSummarizer.gs) for a complete working example.
 */
function fetchTemplateAgentKnowledge_(config) {
  config = config || {};

  const instructionsUrl = config.instructionsUrl;
  const knowledgeFolderUrl = config.knowledgeFolderUrl;
  const maxDocs = config.maxDocs || 5;

  // Nothing configured - agent runs with default behavior
  if (!instructionsUrl && !knowledgeFolderUrl) {
    return {
      configured: false,
      knowledge: null,
      metadata: null
    };
  }

  const parts = [];
  const sources = [];
  let totalChars = 0;
  let totalDocs = 0;

  // Fetch instructions document (how to perform the task)
  if (instructionsUrl) {
    const instructionsResult = fetchDocument_(instructionsUrl, {
      propertyName: 'TEMPLATE_INSTRUCTIONS_DOC_URL'
    });

    if (instructionsResult.configured) {
      parts.push(instructionsResult.knowledge);
      sources.push(instructionsResult.metadata.source);
      totalChars += instructionsResult.metadata.chars;
      totalDocs++;
    }
  }

  // Fetch knowledge folder (contextual reference material)
  if (knowledgeFolderUrl) {
    const knowledgeResult = fetchFolder_(knowledgeFolderUrl, {
      propertyName: 'TEMPLATE_KNOWLEDGE_FOLDER_URL',
      maxDocs: maxDocs
    });

    if (knowledgeResult.configured && knowledgeResult.knowledge) {
      parts.push(knowledgeResult.knowledge);
      sources.push(...knowledgeResult.metadata.sources);
      totalChars += knowledgeResult.metadata.totalChars;
      totalDocs += knowledgeResult.metadata.docCount;
    }
  }

  const combinedKnowledge = parts.join('\n\n');
  const estimatedTokens = estimateTokens_(combinedKnowledge);
  const modelLimit = 1048576; // Gemini 2.5 supports 1M tokens

  const result = {
    configured: true,
    knowledge: combinedKnowledge,
    metadata: {
      docCount: totalDocs,
      totalChars: totalChars,
      estimatedTokens: estimatedTokens,
      modelLimit: modelLimit,
      utilizationPercent: (estimatedTokens / modelLimit * 100).toFixed(1) + '%',
      sources: sources
    }
  };

  // Log token warnings if approaching capacity
  logTokenWarnings_(result.metadata);

  return result;
}

/**
 * Example: Build AI prompt with knowledge injection
 *
 * For agents that use LLMService, build prompts in PromptBuilder.gs (preferred)
 * or within the agent if prompt structure is agent-specific.
 *
 * This example shows in-agent prompt building. For shared prompts, add to PromptBuilder.gs.
 */
function buildTemplatePromptWithKnowledge_(items, knowledge, globalKnowledge, config) {
  const parts = [
    'You are an AI assistant for [AGENT PURPOSE].'
  ];

  // GLOBAL KNOWLEDGE INJECTION (shared across all agents)
  if (globalKnowledge && globalKnowledge.configured) {
    parts.push('');
    parts.push('=== GLOBAL CONTEXT ===');
    parts.push('The following information applies to all email processing:');
    parts.push(globalKnowledge.knowledge);
  }

  // AGENT-SPECIFIC KNOWLEDGE INJECTION
  if (knowledge && knowledge.configured) {
    parts.push('');
    parts.push('=== AGENT GUIDELINES ===');
    parts.push(knowledge.knowledge);

    // Token utilization logging (when DEBUG enabled)
    if (knowledge.metadata && knowledge.metadata.utilizationPercent) {
      const agentConfig = getTemplateAgentConfig_();
      if (agentConfig.TEMPLATE_DEBUG) {
        console.log(JSON.stringify({
          templateAgentKnowledgeUtilization: knowledge.metadata.utilizationPercent,
          estimatedTokens: knowledge.metadata.estimatedTokens,
          modelLimit: knowledge.metadata.modelLimit
        }, null, 2));
      }
    }
  }

  parts.push('');
  parts.push('Items to process:');
  parts.push(JSON.stringify(items, null, 2));
  parts.push('');
  parts.push('Please process according to guidelines above.');

  return parts.join('\n');
}

// ============================================================================
// TEMPLATE: Agent Registration (Dual-Hook Pattern)
// ============================================================================

if (typeof AGENT_MODULES === 'undefined') {
  AGENT_MODULES = [];
}

AGENT_MODULES.push(function(api) {
  /**
   * Register template agent for demonstration
   * Disabled by default - enable for testing
   *
   * DUAL-HOOK PATTERN OPTIONS:
   *
   * Option 1: Both hooks (recommended for action agents)
   * - Immediate action on classification (onLabel)
   * - Inbox scan for manually-labeled emails (postLabel)
   */
  api.register(
    'template_target',  // Label to trigger on (replace with your label)
    'templateAgent',    // Agent name
    {
      onLabel: templateAgentOnLabel_,    // Immediate per-email action
      postLabel: templateAgentPostLabel_  // Inbox-wide scan
    },
    {
      runWhen: 'afterLabel',  // Run after labeling (respects dry-run)
      timeoutMs: 30000,       // Soft timeout guidance
      enabled: false          // Disabled by default (enable for testing)
    }
  );

  /**
   * Option 2: onLabel only
   * Use when you only need immediate action, no inbox scanning
   */
  // api.register(
  //   'template_target',
  //   'templateAgent',
  //   {
  //     onLabel: templateAgentOnLabel_,
  //     postLabel: null
  //   },
  //   { runWhen: 'afterLabel', enabled: false }
  // );

  /**
   * Option 3: postLabel only
   * Use for periodic processing without immediate response
   */
  // api.register(
  //   'template_target',
  //   'templateAgent',
  //   {
  //     onLabel: null,
  //     postLabel: templateAgentPostLabel_
  //   },
  //   { enabled: false }
  // );
});


