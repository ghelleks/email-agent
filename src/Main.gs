function run() {
  const cfg = getConfig_();
  const usingApiKey = !!cfg.GEMINI_API_KEY;
  if (!usingApiKey && !cfg.PROJECT_ID) throw new Error('Set GEMINI_API_KEY (API key mode) or GOOGLE_CLOUD_PROJECT (Vertex mode).');

  // First, load any agent modules queued in AGENT_MODULES
  try {
    if (typeof Agents !== 'undefined' && Agents && typeof Agents.registerAllModules === 'function') {
      Agents.registerAllModules();
    }
  } catch (e) {
    if (cfg.DEBUG) console.log('registerAllModules() error: ' + (e && e.toString ? e.toString() : String(e)));
  }

  // Optional agent registration hook
  try {
    if (typeof registerAgents === 'function') {
      registerAgents();
    }
  } catch (e) {
    if (cfg.DEBUG) console.log('registerAgents() error: ' + (e && e.toString ? e.toString() : String(e)));
  }
  ensureLabels_();

  if (cfg.DEBUG) {
    const hasInstructions = !!cfg.LABEL_INSTRUCTIONS_DOC_URL;
    const hasFolder = !!cfg.LABEL_KNOWLEDGE_FOLDER_URL;
    console.log('Email Labeling: Knowledge configuration: instructions=' + hasInstructions + ', folder=' + hasFolder);
  }

  const knowledge = fetchLabelingKnowledge_({
    instructionsUrl: cfg.LABEL_INSTRUCTIONS_DOC_URL,
    knowledgeFolderUrl: cfg.LABEL_KNOWLEDGE_FOLDER_URL,
    maxDocs: cfg.LABEL_KNOWLEDGE_MAX_DOCS
  });
  // Note: No error check needed - fetchLabelingKnowledge_() handles fail-fast internally

  if (cfg.DEBUG) {
    if (knowledge.configured) {
      console.log('Email Labeling: ✓ Loaded ' + knowledge.metadata.docCount + ' documents, ' +
                  knowledge.metadata.estimatedTokens + ' tokens (' +
                  knowledge.metadata.utilizationPercent + ' utilization)');
    } else {
      console.log('Email Labeling: ℹ No knowledge configured - using built-in classification rules');
    }
  }

  // Fetch global knowledge (shared across all AI operations)
  const globalKnowledge = fetchGlobalKnowledge_();

  if (cfg.DEBUG) {
    if (globalKnowledge.configured) {
      console.log('Global Knowledge: ✓ Loaded ' + globalKnowledge.metadata.docCount + ' documents, ' +
                  globalKnowledge.metadata.estimatedTokens + ' tokens (' +
                  globalKnowledge.metadata.utilizationPercent + ' utilization)');
    } else {
      console.log('Global Knowledge: ℹ No global knowledge configured');
    }
  }

  const threads = findUnprocessed_(cfg.MAX_EMAILS_PER_RUN);
  if (!threads.length) return console.log('No candidates.');

  const emails = minimalize_(threads, cfg.BODY_CHARS);
  const results = categorizeWithGemini_(emails, knowledge, cfg, globalKnowledge);

  const summary = Organizer.apply_(results, cfg);
  if (cfg.DEBUG) {
    console.log(JSON.stringify({ summary: summary, sample: results.slice(0, 5) }, null, 2));
  }
  console.log(JSON.stringify({ ...summary, dryRun: cfg.DRY_RUN }, null, 2));
}

function installTrigger() {
  // Use shared utility for trigger management
  const result = createTimeTrigger_('run', { type: 'hourly', interval: 1 });
  if (!result.success) {
    console.log('Failed to install trigger: ' + result.error);
  }
  return result;
}

function deleteTriggers() {
  // Use shared utility for trigger cleanup
  const result = deleteTriggersByFunction_('run');
  console.log('All email processing triggers deleted');
  return result;
}

function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'run');

  if (triggers.length === 0) {
    console.log('No email processing triggers installed');
    return;
  }

  console.log(`Found ${triggers.length} email processing trigger(s):`);
  triggers.forEach((trigger, index) => {
    const source = trigger.getTriggerSource();
    const eventType = trigger.getEventType();
    console.log(`  ${index + 1}. ${source} - ${eventType}`);
  });
}

function deleteExistingTriggers_() {
  // Use shared utility for trigger management
  return deleteTriggersByFunction_('run');
}

/**
 * Get the web app URL for the current deployment
 * This function can be called via clasp to get the web app URL after deployment
 */
function getWebAppUrl() {
  try {
    // Get the script ID
    const scriptId = ScriptApp.getScriptId();

    // Get project deployments to find the web app
    const deployments = ScriptApp.getProjectDeployments();

    // Find the latest web app deployment
    let webAppDeployment = null;
    for (const deployment of deployments) {
      if (deployment.getDeploymentConfig().getWebApp()) {
        webAppDeployment = deployment;
        break; // Get the first (most recent) web app deployment
      }
    }

    if (webAppDeployment) {
      const deploymentId = webAppDeployment.getDeploymentId();
      const webAppUrl = `https://script.google.com/macros/s/${deploymentId}/exec`;

      console.log('='.repeat(60));
      console.log('WEB APP DEPLOYMENT SUCCESSFUL');
      console.log('='.repeat(60));
      console.log(`📱 Web App URL: ${webAppUrl}`);
      console.log('');
      console.log('Next steps:');
      console.log('1. Bookmark this URL for easy access');
      console.log('2. Test the web app by visiting the URL');
      console.log('3. Apply the "summarize" label to emails in Gmail');
      console.log('4. Use the web app to generate summaries');
      console.log('='.repeat(60));

      return {
        success: true,
        url: webAppUrl,
        deploymentId: deploymentId,
        scriptId: scriptId
      };
    } else {
      console.log('⚠️  No web app deployment found.');
      console.log('');
      console.log('To deploy the web app:');
      console.log('1. Run: npm run open');
      console.log('2. Click "Deploy" → "New deployment"');
      console.log('3. Choose type: "Web app"');
      console.log('4. Set "Execute as": "Me", "Access": "Only myself"');
      console.log('5. Click "Deploy" and copy the URL');
      console.log('6. Or run: npm run deploy:webapp');

      return {
        success: false,
        error: 'No web app deployment found. Please deploy the web app first.',
        scriptId: scriptId
      };
    }
  } catch (error) {
    // Use shared utility for error handling
    const errorResult = standardErrorHandler_(error, 'getWebAppUrl');
    console.log(errorResult.message);
    return {
      success: false,
      error: errorResult.message
    };
  }
}
