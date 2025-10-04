var Agents = (function() {
  var registryByLabel = new Map();
  var runCountThisExecution = 0;

  function isFunction_(f) {
    return typeof f === 'function';
  }

  /**
   * Register an agent with dual-hook pattern (onLabel + postLabel)
   *
   * @param {string} label - Gmail label to trigger on
   * @param {string} name - Agent name for logging
   * @param {Object} hooks - Object with onLabel and/or postLabel functions
   *   - onLabel: Called per-email during labeling (immediate action)
   *   - postLabel: Called once after all labeling (inbox-wide scan)
   * @param {Object} options - Configuration options
   */
  function register(label, name, hooks, options) {
    if (!label || !name) {
      throw new Error('Agent registration requires label and name');
    }

    // Validate hooks parameter - must be object with at least one hook
    if (typeof hooks !== 'object' || hooks === null) {
      throw new Error('Agent "' + name + '": hooks parameter must be an object with onLabel and/or postLabel');
    }

    var onLabel = hooks.onLabel || null;
    var postLabel = hooks.postLabel || null;

    // Require at least one hook
    if (!onLabel && !postLabel) {
      throw new Error('Agent "' + name + '": must provide at least one hook (onLabel or postLabel)');
    }

    // Validate hook types
    if (onLabel && !isFunction_(onLabel)) {
      throw new Error('Agent "' + name + '": onLabel must be a function');
    }
    if (postLabel && !isFunction_(postLabel)) {
      throw new Error('Agent "' + name + '": postLabel must be a function');
    }

    var list = registryByLabel.get(label);
    if (!list) {
      list = [];
      registryByLabel.set(label, list);
    }

    list.push({
      name: name,
      onLabel: onLabel,
      postLabel: postLabel,
      options: options || {}
    });
  }

  /**
   * Run onLabel handlers for a specific label
   * Called during labeling to provide immediate per-email actions
   */
  function runFor(label, ctx) {
    var results = [];
    var cfg = ctx && ctx.cfg || {};
    if (cfg.AGENTS_ENABLED === false) return results;

    var list = registryByLabel.get(label) || [];

    // Optional filtering by config map
    var allowList = cfg.AGENTS_LABEL_MAP && cfg.AGENTS_LABEL_MAP[label];
    if (allowList && allowList.length) {
      list = list.filter(function(item) { return allowList.indexOf(item.name) !== -1; });
    }

    if (!list.length) return results;

    var budget = typeof cfg.AGENTS_BUDGET_PER_RUN === 'number' ? cfg.AGENTS_BUDGET_PER_RUN : 50;

    for (var i = 0; i < list.length; i++) {
      var item = list[i];

      // Skip if agent doesn't have onLabel hook
      if (!item.onLabel) {
        results.push({ agent: item.name, status: 'skip', info: 'no-onLabel-hook' });
        continue;
      }

      // Respect per-agent enabled flag (default: enabled)
      var isEnabled = !(item.options && item.options.enabled === false);
      if (!isEnabled) {
        results.push({ agent: item.name, status: 'skip', info: 'disabled' });
        continue;
      }

      var runWhen = item.options && item.options.runWhen || 'afterLabel';
      var shouldSkipForDryRun = ctx.dryRun && runWhen !== 'always' && (cfg.AGENTS_DRY_RUN !== false);
      if (shouldSkipForDryRun) {
        results.push({ agent: item.name, status: 'skip', info: 'dry-run' });
        continue;
      }

      try {
        runCountThisExecution++;
        var result = item.onLabel(ctx) || { status: 'ok' };
        results.push({ agent: item.name, status: result.status || 'ok', info: result.info, retryAfterMs: result.retryAfterMs });
      } catch (e) {
        results.push({ agent: item.name, status: 'error', info: (e && e.toString ? e.toString() : String(e)) });
      }
    }
    return results;
  }

  /**
   * Run postLabel handlers for all agents
   * Called once after all labeling is complete
   * Enables inbox-wide scans to catch manually-labeled emails
   */
  function runPostLabelHandlers(cfg) {
    cfg = cfg || {};

    if (cfg.AGENTS_ENABLED === false) {
      return { total: 0, executed: 0, skipped: 0, errors: 0 };
    }

    var stats = { total: 0, executed: 0, skipped: 0, errors: 0 };

    // Get all unique agents across all labels
    var allAgents = [];
    var seenNames = {};

    registryByLabel.forEach(function(list) {
      list.forEach(function(agent) {
        if (!seenNames[agent.name]) {
          seenNames[agent.name] = true;
          allAgents.push(agent);
        }
      });
    });

    if (cfg.DEBUG) {
      Logger.log('Running postLabel handlers for ' + allAgents.length + ' agents...');
    }

    allAgents.forEach(function(agent) {
      stats.total++;

      // Skip if no postLabel hook
      if (!agent.postLabel) {
        stats.skipped++;
        return;
      }

      // Respect enabled flag
      var isEnabled = !(agent.options && agent.options.enabled === false);
      if (!isEnabled) {
        stats.skipped++;
        if (cfg.DEBUG) {
          Logger.log('Skipping ' + agent.name + ' postLabel (disabled)');
        }
        return;
      }

      try {
        var startTime = Date.now();

        if (cfg.DEBUG) {
          Logger.log('Running postLabel for ' + agent.name);
        }

        agent.postLabel();

        var duration = Date.now() - startTime;
        stats.executed++;

        if (cfg.DEBUG) {
          Logger.log(agent.name + ' postLabel completed in ' + duration + 'ms');
        }

        // Soft timeout warning
        if (agent.options && agent.options.timeoutMs && duration > agent.options.timeoutMs) {
          Logger.log('⚠️  ' + agent.name + ' postLabel exceeded soft timeout (' + agent.options.timeoutMs + 'ms)');
        }
      } catch (e) {
        stats.errors++;
        Logger.log('❌ ' + agent.name + ' postLabel failed: ' + (e && e.toString ? e.toString() : String(e)));
        if (cfg.DEBUG && e && e.stack) {
          Logger.log(e.stack);
        }
      }
    });

    if (cfg.DEBUG || stats.executed > 0) {
      Logger.log('postLabel handlers complete: executed=' + stats.executed + ', skipped=' + stats.skipped + ', errors=' + stats.errors);
    }

    return stats;
  }

  function registerAllModules() {
    try {
      var mods = (typeof AGENT_MODULES !== 'undefined' && AGENT_MODULES) || [];
      if (!mods || !mods.length) return 0;
      for (var i = 0; i < mods.length; i++) {
        var registrar = mods[i];
        if (typeof registrar === 'function') {
          try { registrar({ register: register }); } catch (e) {
            // swallow to avoid breaking startup; errors will be visible in DEBUG logs elsewhere
          }
        }
      }
      // drain the queue so repeated calls don't duplicate registrations
      if (typeof AGENT_MODULES !== 'undefined') {
        AGENT_MODULES = [];
      }
      return mods.length;
    } catch (e) {
      return 0;
    }
  }

  return {
    register: register,
    runFor: runFor,
    runPostLabelHandlers: runPostLabelHandlers,
    registerAllModules: registerAllModules
  };
})();

// ============================================================================
// Migration Utilities (ADR-017)
// ============================================================================

/**
 * Clear all legacy agent idempotency keys from UserProperties
 * Run once after deploying ADR-017 changes
 *
 * This removes all 'agent_done:*' keys that were used for framework-level
 * idempotency tracking. After ADR-017, agents implement their own
 * application-level idempotency checks as needed.
 *
 * @returns {Object} Summary of cleanup operation
 */
function clearAllAgentIdempotencyKeys() {
  const userProps = PropertiesService.getUserProperties();
  const allProps = userProps.getProperties();
  const agentKeys = Object.keys(allProps).filter(function(k) {
    return k.startsWith('agent_done:');
  });

  console.log('Found ' + agentKeys.length + ' legacy agent idempotency keys to clear');

  // Clear all agent state keys
  agentKeys.forEach(function(key) {
    userProps.deleteProperty(key);
  });

  const summary = {
    keysCleared: agentKeys.length,
    sampleKeys: agentKeys.slice(0, 5), // Show first 5 for verification
    timestamp: new Date().toISOString()
  };

  console.log('Migration complete: ' + JSON.stringify(summary, null, 2));
  return summary;
}
