function categorizeWithGemini_(emails, knowledge, cfg, globalKnowledge) {
  const allowed = new Set([cfg.LABEL_REPLY_NEEDED, cfg.LABEL_REVIEW, cfg.LABEL_TODO, cfg.LABEL_SUMMARIZE]);
  const batches = [];
  for (let i = 0; i < emails.length; i += cfg.BATCH_SIZE) {
    batches.push(emails.slice(i, i + cfg.BATCH_SIZE));
  }

  const results = [];
  for (const batch of batches) {
    // Build prompt using PromptBuilder (enforces separation of concerns)
    const prompt = buildCategorizePrompt_(batch, knowledge,
      [cfg.LABEL_REPLY_NEEDED, cfg.LABEL_REVIEW, cfg.LABEL_TODO, cfg.LABEL_SUMMARIZE],
      cfg.DEFAULT_FALLBACK_LABEL, globalKnowledge);

    // LLMService now receives complete prompt (no longer builds it internally)
    const out = categorizeBatch_(prompt, cfg.MODEL_PRIMARY, cfg.PROJECT_ID,
      cfg.LOCATION, cfg.GEMINI_API_KEY);
    if (cfg.DEBUG) {
      console.log(JSON.stringify({ batchSize: batch.length, llmRaw: out }, null, 2));
    }

    // Handle parsing failure - LLMService returns null when it can't parse response
    if (!out) {
      results.push.apply(results, batch.map(function(e) {
        return { id: e.id, required_action: null, reason: 'fallback-on-error', threadId: e.threadId };
      }));
      continue;
    }

    const byId = new Map(out.map(function(o) { return [o.id, o]; }));
    for (const e of batch) {
      const r = byId.get(e.id);
      const normalized = r && typeof r.required_action === 'string' ? String(r.required_action).toLowerCase().trim() : null;
      const valid = normalized && allowed.has(normalized);
      results.push({
        id: e.id,
        threadId: e.threadId,
        required_action: valid ? normalized : null,
        reason: valid ? (r.reason || 'ok') : 'invalid-or-missing'
      });
    }
  }
  return results;
}
