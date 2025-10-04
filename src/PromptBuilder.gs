/**
 * PromptBuilder.gs - Core Classification Prompts (ADR-022)
 *
 * This file contains ONLY the core email classification prompt builder.
 * Agent-specific prompts are now owned by their respective agents:
 * - Reply Drafter prompts: AgentReplyDrafter.gs
 * - Email Summarizer prompts: AgentSummarizer.gs
 *
 * This supports the self-contained agent architecture where agents manage
 * their own prompts, knowledge injection, and AI interactions.
 */

function buildCategorizePrompt_(emails, knowledge, allowed, fallback, globalKnowledge) {
  const schema = JSON.stringify({
    emails: [{ id: 'string', required_action: allowed.join('|'), reason: 'string' }]
  }, null, 2);

  const items = emails.map(function(e) {
    return {
      id: e.id,
      subject: e.subject || '',
      from: e.from || '',
      date: e.date || '',
      age_days: e.ageDays || 0,
      body_excerpt: (e.plainBody || '').slice(0, 1200)
    };
  });

  const parts = [
    'You are an email triage assistant.'
  ];

  // GLOBAL KNOWLEDGE INJECTION (applies to ALL prompts)
  if (globalKnowledge && globalKnowledge.configured) {
    parts.push('');
    parts.push('=== GLOBAL KNOWLEDGE ===');
    parts.push(globalKnowledge.knowledge);

    // Token utilization logging (when DEBUG enabled)
    if (globalKnowledge.metadata && globalKnowledge.metadata.utilizationPercent) {
      const cfg = getConfig_();
      if (cfg.DEBUG) {
        Logger.log(JSON.stringify({
          globalKnowledgeUtilization: globalKnowledge.metadata.utilizationPercent,
          estimatedTokens: globalKnowledge.metadata.estimatedTokens,
          modelLimit: globalKnowledge.metadata.modelLimit
        }, null, 2));
      }
    }
  }

  // AGENT-SPECIFIC KNOWLEDGE INJECTION (labeling policy)
  if (knowledge && knowledge.configured) {
    parts.push('');
    parts.push('=== LABELING POLICY ===');
    parts.push(knowledge.knowledge);

    // Token utilization logging (when DEBUG enabled)
    if (knowledge.metadata && knowledge.metadata.utilizationPercent) {
      const cfg = getConfig_();
      if (cfg.DEBUG) {
        console.log(JSON.stringify({
          knowledgeUtilization: knowledge.metadata.utilizationPercent,
          estimatedTokens: knowledge.metadata.estimatedTokens,
          modelLimit: knowledge.metadata.modelLimit
        }, null, 2));
      }
    }
  }

  parts.push('');
  parts.push('Allowed labels: ' + allowed.join(', '));
  parts.push("If multiple labels could apply, follow the Policy's precedence. If uncertain, choose: " + fallback + ".");
  parts.push('Return ONLY valid JSON with this exact shape, no extra text:');
  parts.push(schema);
  parts.push('');
  parts.push('Emails to categorize:');
  parts.push(JSON.stringify(items, null, 2));
  parts.push('');
  parts.push('Return JSON for ALL items.');

  return parts.join('\n');
}
