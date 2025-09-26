function getConfig_() {
  const p = PropertiesService.getScriptProperties();
  return {
    GEMINI_API_KEY: p.getProperty('GEMINI_API_KEY'),
    PROJECT_ID: p.getProperty('GOOGLE_CLOUD_PROJECT') || p.getProperty('PROJECT_ID'),
    LOCATION: p.getProperty('GOOGLE_CLOUD_LOCATION') || 'us-central1',
    RULE_DOC_ID: p.getProperty('RULE_DOC_ID'),
    RULE_DOC_URL: p.getProperty('RULE_DOC_URL'),
    DEFAULT_FALLBACK_LABEL: p.getProperty('DEFAULT_FALLBACK_LABEL') || 'review',
    MAX_EMAILS_PER_RUN: parseInt(p.getProperty('MAX_EMAILS_PER_RUN') || '20', 10),
    BATCH_SIZE: parseInt(p.getProperty('BATCH_SIZE') || '10', 10),
    BODY_CHARS: parseInt(p.getProperty('BODY_CHARS') || '1200', 10),
    DAILY_GEMINI_BUDGET: parseInt(p.getProperty('DAILY_GEMINI_BUDGET') || '50', 10),
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
    })()
  };
}

function ensureLabels_() {
  ['reply_needed','review','todo','summarize'].forEach(function(name) {
    if (!GmailApp.getUserLabelByName(name)) GmailApp.createLabel(name);
  });
}
