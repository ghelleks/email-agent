function applyLabel_(thread, labelName, dryRun) {
  const cfg = getConfig_();
  const actionNames = [cfg.LABEL_REPLY_NEEDED, cfg.LABEL_REVIEW, cfg.LABEL_TODO, cfg.LABEL_SUMMARIZE];
  const hasAny = thread.getLabels().some(function(l) { return actionNames.includes(l.getName()); });
  if (hasAny) return 'skipped';
  if (dryRun) return 'would-label:' + labelName;
  const lbl = GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
  thread.addLabel(lbl);
  return 'labeled';
}

const Organizer = {
  apply_: function(results, cfg) {
    let labeled = 0, skipped = 0, errors = 0;
    let agentOk = 0, agentSkip = 0, agentRetry = 0, agentError = 0;
    const byThread = new Map();
    results.forEach(function(r) { byThread.set(r.threadId, r); });

    for (const entry of byThread.entries()) {
      const threadId = entry[0];
      const r = entry[1];
      try {
        if (cfg.DEBUG) {
          console.log(JSON.stringify({ action: 'apply', threadId: threadId, decided_label: r.required_action, reason: r.reason }, null, 2));
        }
        const thread = GmailApp.getThreadById(threadId);
        if (!r.required_action) {
          skipped++;
          continue;
        }
        const status = applyLabel_(thread, r.required_action, cfg.DRY_RUN);
        if (status === 'labeled') labeled++;
        else if (status === 'skipped' || status.indexOf('would-label') === 0) skipped++;

        // Agents hook (onLabel - per-email immediate action)
        if (typeof Agents !== 'undefined' && Agents && typeof Agents.runFor === 'function') {
          var ctx = {
            label: r.required_action,
            decision: { required_action: r.required_action, reason: r.reason },
            threadId: threadId,
            thread: thread,
            cfg: cfg,
            dryRun: cfg.DRY_RUN,
            log: function(msg) { if (cfg.DEBUG) console.log('agent log (' + threadId + '): ' + msg); }
          };
          var agentResults = Agents.runFor(r.required_action, ctx) || [];
          for (var i = 0; i < agentResults.length; i++) {
            var ar = agentResults[i];
            if (ar.status === 'ok') agentOk++;
            else if (ar.status === 'skip') agentSkip++;
            else if (ar.status === 'retry') agentRetry++;
            else agentError++;
          }
        }
      } catch (e) {
        errors++;
        console.log('Error labeling thread ' + threadId + ': ' + e);
      }
    }

    // Run postLabel handlers after all labeling complete
    // This catches manually-labeled emails and enables inbox-wide scans
    if (typeof Agents !== 'undefined' && Agents && typeof Agents.runPostLabelHandlers === 'function') {
      try {
        var postLabelStats = Agents.runPostLabelHandlers(cfg);
        // Add postLabel stats to agent stats
        agentOk += postLabelStats.executed;
        agentSkip += postLabelStats.skipped;
        agentError += postLabelStats.errors;
      } catch (e) {
        console.log('Error running postLabel handlers: ' + e);
      }
    }

    return { candidates: results.length, labeled: labeled, skipped: skipped, errors: errors, agents: { ok: agentOk, skip: agentSkip, retry: agentRetry, error: agentError } };
  }
};
