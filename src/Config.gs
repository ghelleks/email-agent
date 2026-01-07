function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  return {
    GEMINI_API_KEY: p.getProperty('GEMINI_API_KEY'),
    PROJECT_ID: p.getProperty('GOOGLE_CLOUD_PROJECT') || p.getProperty('PROJECT_ID'),
    LOCATION: p.getProperty('GOOGLE_CLOUD_LOCATION') || 'us-central1',
    RULE_DOC_ID: p.getProperty('RULE_DOC_ID'),
    RULE_DOC_URL: p.getProperty('RULE_DOC_URL'),
    // Label names (configurable)
    LABEL_REPLY_NEEDED: p.getProperty('LABEL_REPLY_NEEDED') || 'reply_needed',
    LABEL_REVIEW: p.getProperty('LABEL_REVIEW') || 'review',
    LABEL_TODO: p.getProperty('LABEL_TODO') || 'todo',
    LABEL_SUMMARIZE: p.getProperty('LABEL_SUMMARIZE') || 'summarize',
    DEFAULT_FALLBACK_LABEL: p.getProperty('DEFAULT_FALLBACK_LABEL') || 'review',
    MAX_EMAILS_PER_RUN: parseInt(p.getProperty('MAX_EMAILS_PER_RUN') || '10', 10),
    BATCH_SIZE: parseInt(p.getProperty('BATCH_SIZE') || '10', 10),
    BODY_CHARS: parseInt(p.getProperty('BODY_CHARS') || '1200', 10),
    DRY_RUN: (p.getProperty('DRY_RUN') || 'false').toLowerCase() === 'true',
    DEBUG: (p.getProperty('DEBUG') || 'false').toLowerCase() === 'true',
    MODEL_PRIMARY: 'gemini-2.5-flash',
    MODEL_ESCALATE: 'gemini-2.5-pro',
    // Agents framework
    AGENTS_ENABLED: (p.getProperty('AGENTS_ENABLED') || 'true').toLowerCase() === 'true',
    AGENTS_DRY_RUN: (p.getProperty('AGENTS_DRY_RUN') || '').toLowerCase() === 'true' ? true : ((p.getProperty('AGENTS_DRY_RUN') || '').toLowerCase() === 'false' ? false : null),
    AGENTS_BUDGET_PER_RUN: parseInt(p.getProperty('AGENTS_BUDGET_PER_RUN') || '50', 10),
    AGENTS_LABEL_MAP: (function(){
      try { return JSON.parse(p.getProperty('AGENTS_LABEL_MAP') || 'null'); } catch (e) { return null; }
    })(),
    // Web App Configuration
    WEBAPP_ENABLED: (p.getProperty('WEBAPP_ENABLED') || 'true').toLowerCase() === 'true',
    WEBAPP_MAX_EMAILS_PER_SUMMARY: parseInt(p.getProperty('WEBAPP_MAX_EMAILS_PER_SUMMARY') || '50', 10),
    // KnowledgeService Configuration
    // Global Knowledge (applies to ALL AI operations - ADR-019)
    GLOBAL_KNOWLEDGE_FOLDER_URL: p.getProperty('GLOBAL_KNOWLEDGE_FOLDER_URL'),
    GLOBAL_KNOWLEDGE_MAX_DOCS: parseInt(p.getProperty('GLOBAL_KNOWLEDGE_MAX_DOCS') || '5', 10),
    // Email Labeling Knowledge (INSTRUCTIONS = how to label, KNOWLEDGE = contextual reference)
    LABEL_INSTRUCTIONS_DOC_URL: p.getProperty('LABEL_INSTRUCTIONS_DOC_URL'),
    LABEL_KNOWLEDGE_FOLDER_URL: p.getProperty('LABEL_KNOWLEDGE_FOLDER_URL'),
    LABEL_KNOWLEDGE_MAX_DOCS: parseInt(p.getProperty('LABEL_KNOWLEDGE_MAX_DOCS') || '5', 10),
    // KnowledgeService Core Settings
    KNOWLEDGE_CACHE_DURATION_MINUTES: parseInt(p.getProperty('KNOWLEDGE_CACHE_DURATION_MINUTES') || '30', 10),
    KNOWLEDGE_DEBUG: (p.getProperty('KNOWLEDGE_DEBUG') || 'false').toLowerCase() === 'true',
    KNOWLEDGE_LOG_SIZE_WARNINGS: (p.getProperty('KNOWLEDGE_LOG_SIZE_WARNINGS') || 'true').toLowerCase() === 'true',
    // KnowledgeService Test Configuration
    TEST_DOC_URL: p.getProperty('TEST_DOC_URL'),
    TEST_FOLDER_URL: p.getProperty('TEST_FOLDER_URL'),
    // API Retry Configuration
    API_MAX_RETRIES: parseInt(p.getProperty('API_MAX_RETRIES') || '3', 10)
  };
}

function ensureLabels_() {
  const cfg = getConfig_();
  [cfg.LABEL_REPLY_NEEDED, cfg.LABEL_REVIEW, cfg.LABEL_TODO, cfg.LABEL_SUMMARIZE].forEach(function(name) {
    if (!GmailApp.getUserLabelByName(name)) GmailApp.createLabel(name);
  });
}
