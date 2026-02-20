function categorizeWithGemini_(emails, knowledge, cfg, globalKnowledge) {
  const allowed = new Set(['reply_needed','review','todo','summarize']);
  const batches = [];
  for (let i = 0; i < emails.length; i += cfg.BATCH_SIZE) {
    batches.push(emails.slice(i, i + cfg.BATCH_SIZE));
  }

  // Build systemInstruction once — identical for every batch, enables implicit caching
  const systemInstruction = buildCategorizeSystemInstruction_(knowledge,
    ['reply_needed', 'review', 'todo', 'summarize'],
    cfg.DEFAULT_FALLBACK_LABEL, globalKnowledge);

  const results = [];
  for (const batch of batches) {
    // User turn contains only the variable email data
    const userTurn = buildCategorizeUserTurn_(batch);

    // LLMService now receives user turn + system instruction separately
    const out = categorizeBatch_(userTurn, cfg.MODEL_PRIMARY, cfg.PROJECT_ID,
      cfg.LOCATION, cfg.GEMINI_API_KEY, systemInstruction);
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
