# ADR-022: Agent-Owned Prompt Building Functions

**Status**: Accepted
**Date**: 2025-10-04
**Deciders**: Project team

## Context

The email automation system uses AI prompts to drive various operations: email categorization, reply drafting, and email summarization. Currently, all prompt building logic resides in a centralized `PromptBuilder.gs` file with three functions:

- `buildCategorizePrompt_()` - Core email classification prompts
- `buildReplyDraftPrompt_()` - Reply Drafter agent prompts
- `buildSummaryPrompt_()` - Email Summarizer agent prompts

### Architectural Tension

While ADR-011 established the **self-contained agent architecture** pattern, where agents manage their own configuration, labels, and execution logic, prompt building remained centralized in `PromptBuilder.gs`. This creates an inconsistency:

**Agents are self-contained for:**
- Configuration management (e.g., `getSummarizerConfig_()` in `AgentSummarizer.gs` per ADR-014)
- Label lifecycle (agents create and manage their own labels per ADR-011)
- Execution logic (dual-hook handlers in agent files per ADR-018)

**But agents are NOT self-contained for:**
- Prompt construction (still requires editing `PromptBuilder.gs`)

### Concrete Impact from Issue #33

When developing a new agent or modifying existing agent prompts:
1. Agent-specific code spans multiple files (`AgentReplyDrafter.gs` + `PromptBuilder.gs`)
2. Changes to agent prompt logic require editing core system files
3. Prompt evolution tightly coupled between agents and core system
4. Testing agent prompts requires understanding centralized prompt builder
5. Adding new agents requires modifying `PromptBuilder.gs`, violating open/closed principle

### Knowledge Management Context

The system supports multiple knowledge sources (ADR-019, ADR-015):
- **Global knowledge**: Organization-wide context (`GLOBAL_KNOWLEDGE_FOLDER_URL`)
- **Agent-specific knowledge**: Feature-specific INSTRUCTIONS and KNOWLEDGE documents

Prompt builders must correctly inject both knowledge types in the right order:
1. Base instructions (built-in system prompts)
2. Global knowledge (applies to ALL features - ADR-019)
3. Agent-specific knowledge (feature-specific INSTRUCTIONS + KNOWLEDGE - ADR-015)
4. Task data (emails to process)

This knowledge injection pattern must be preserved regardless of where prompt building functions live.

## Decision

We adopt **agent-owned prompt building** where agent-specific prompt construction functions are moved into their respective agent files:

### Function Migration

**Move to Agent Files:**
- `buildReplyDraftPrompt_()` → `AgentReplyDrafter.gs`
- `buildSummaryPrompt_()` → `AgentSummarizer.gs`

**Remain in PromptBuilder.gs:**
- `buildCategorizePrompt_()` - Core email classification (not agent-specific)

### Agent Ownership Boundaries

After this change, agents now own:
1. **Configuration management**: `get[AgentName]Config_()` functions (ADR-014)
2. **Label lifecycle**: Label creation and management within agent (ADR-011)
3. **Execution logic**: Dual-hook handlers (`onLabel`, `postLabel`) (ADR-018)
4. **Prompt construction**: `build[AgentName]Prompt_()` functions (this ADR)

### Knowledge Injection Requirements

All agent-owned prompt builders MUST preserve the knowledge hierarchy established in ADR-019 and ADR-015:

```javascript
function buildAgentPrompt_(data, agentKnowledge, globalKnowledge) {
  const parts = ['Base instructions for this agent'];

  // 1. GLOBAL KNOWLEDGE FIRST (organizational context - ADR-019)
  if (globalKnowledge && globalKnowledge.configured) {
    parts.push('');
    parts.push('=== GLOBAL KNOWLEDGE ===');
    parts.push(globalKnowledge.knowledge);
  }

  // 2. AGENT-SPECIFIC KNOWLEDGE SECOND (INSTRUCTIONS + KNOWLEDGE - ADR-015)
  if (agentKnowledge && agentKnowledge.configured) {
    parts.push('');
    parts.push('=== AGENT INSTRUCTIONS ===');
    parts.push(agentKnowledge.knowledge);
  }

  // 3. Task data
  parts.push('');
  parts.push('=== DATA TO PROCESS ===');
  parts.push(formatDataForAgent_(data));

  return parts.join('\n');
}
```

### Implementation Pattern

**Agent-Owned Prompt Builder:**
```javascript
// In AgentReplyDrafter.gs

/**
 * Build reply draft prompt with knowledge injection
 * @private
 * @param {Object} emailThread - Thread object with messages array
 * @param {Object} replyKnowledge - Agent-specific knowledge from KnowledgeService
 * @param {Object} globalKnowledge - Global knowledge from KnowledgeService
 * @returns {string} - Complete prompt for reply generation
 */
function buildReplyDraftPrompt_(emailThread, replyKnowledge, globalKnowledge) {
  const parts = ['You are drafting a professional email reply.'];

  // Global knowledge injection (ADR-019)
  if (globalKnowledge && globalKnowledge.configured) {
    parts.push('');
    parts.push('=== GLOBAL KNOWLEDGE ===');
    parts.push(globalKnowledge.knowledge);
  }

  // Agent-specific knowledge injection (ADR-015)
  if (replyKnowledge && replyKnowledge.configured) {
    parts.push('');
    parts.push('=== YOUR DRAFTING INSTRUCTIONS ===');
    parts.push(replyKnowledge.knowledge);
  }

  // Task-specific data
  parts.push('');
  parts.push('=== EMAIL THREAD ===');
  parts.push(formatEmailThread_(emailThread));

  parts.push('');
  parts.push('=== REPLY INSTRUCTIONS ===');
  parts.push('Draft a professional reply...');

  return parts.join('\n');
}
```

**Core Prompt Builder (remains centralized):**
```javascript
// In PromptBuilder.gs

/**
 * Build email categorization prompt with knowledge injection
 * This function remains in PromptBuilder.gs because categorization
 * is a core system operation, not agent-specific functionality.
 */
function buildCategorizePrompt_(emails, knowledge, allowed, fallback, globalKnowledge) {
  // Core categorization prompt logic
  // Knowledge injection follows same pattern as agents
}
```

## Alternatives Considered

### Alternative 1: Keep Centralized Prompt Building (Status Quo)
- **Pros**: Single location for all prompt logic, consistent patterns, easier to refactor prompt patterns across features, centralized knowledge injection
- **Cons**: Violates self-contained agent pattern, requires core file changes for agent development, creates coupling between agents and core, harder to test agent prompts in isolation
- **Why not chosen**: Contradicts ADR-011 self-contained agent architecture and creates unnecessary coupling between agents and core system

### Alternative 2: Shared Prompt Builder Base Class
```javascript
// PromptBuilderBase.gs - Abstract base class
function PromptBuilderBase() {
  this.injectKnowledge = function(parts, global, specific) {
    // Common knowledge injection logic
  };
}

// AgentReplyDrafter.gs - Extends base
function ReplyDrafterPromptBuilder() {
  PromptBuilderBase.call(this); // Inherit
  this.build = function(emailThread, knowledge, globalKnowledge) {
    // Use this.injectKnowledge()
  };
}
```
- **Pros**: Eliminates duplication of knowledge injection patterns, enforces consistent prompt structure, reusable patterns
- **Cons**: Adds framework complexity, requires inheritance understanding, overengineered for current needs, contradicts Apps Script simplicity
- **Why not chosen**: Too complex for the Apps Script environment. Simple duplication of knowledge injection pattern (~10 lines) is acceptable trade-off for true agent independence.

### Alternative 3: Prompt Template System
```javascript
// PromptTemplates.gs - Template engine
function renderPrompt_(templateName, data) {
  const template = PROMPT_TEMPLATES[templateName];
  return template.render(data);
}

// AgentReplyDrafter.gs - Uses templates
function buildReplyDraftPrompt_(emailThread, knowledge, globalKnowledge) {
  return renderPrompt_('replyDraft', {
    thread: emailThread,
    knowledge: knowledge,
    globalKnowledge: globalKnowledge
  });
}
```
- **Pros**: Declarative prompt definitions, separates structure from logic, easier non-technical prompt editing
- **Cons**: Requires template engine implementation, harder to debug, loses code-level flexibility, adds abstraction layer
- **Why not chosen**: Over-engineered for current needs. Direct string building is simpler, more transparent, and easier to understand.

### Alternative 4: External Prompt Documents (Google Docs)
- **Pros**: Non-developers can edit prompts, version control through Google Docs history, no code deployment for prompt changes
- **Cons**: Runtime fetching overhead, cache management complexity, harder to maintain logic + template separation, debugging difficulty, prompts contain conditional logic
- **Why not chosen**: Prompts contain conditional logic (knowledge injection order, formatting) that requires code. Knowledge documents already provide customization for instructions and examples.

### Alternative 5: Hybrid Approach (Core Helpers + Agent Implementations)
```javascript
// PromptBuilder.gs - Shared utilities
function injectGlobalKnowledge_(parts, globalKnowledge) { /* ... */ }
function injectAgentKnowledge_(parts, agentKnowledge) { /* ... */ }

// AgentReplyDrafter.gs - Uses helpers
function buildReplyDraftPrompt_(emailThread, knowledge, globalKnowledge) {
  const parts = ['Base instructions'];
  injectGlobalKnowledge_(parts, globalKnowledge);
  injectAgentKnowledge_(parts, knowledge);
  return parts.join('\n');
}
```
- **Pros**: Reduces duplication, maintains agent autonomy, shared knowledge injection logic
- **Cons**: Creates dependency on `PromptBuilder.gs` for agents, violates full self-containment, split responsibility
- **Why not chosen**: Knowledge injection pattern is simple enough (5-10 lines) that duplication is acceptable. Full self-containment preferred over partial dependency on core files.

## Consequences

### Positive

- **True self-containment**: Agents own all their functionality (config + labels + prompts + logic) - completes the vision from ADR-011
- **No core file changes**: Adding/modifying agents doesn't require editing `PromptBuilder.gs` or any other core system files
- **Independent evolution**: Agent prompts can evolve without affecting other agents or core classification
- **Easier testing**: Agent prompt logic testable without `PromptBuilder.gs` dependency or understanding core system
- **Clearer ownership**: All Reply Drafter code in `AgentReplyDrafter.gs`, all Summarizer code in `AgentSummarizer.gs`
- **Reduced coupling**: Agents don't depend on core prompt building infrastructure - only on `LLMService.gs` for execution
- **Consistent with ADR-011**: Completes the self-contained agent pattern established for configuration and labels
- **Better code locality**: All related code lives in same file (handler + config + prompts + execution logic)
- **Open/Closed Principle**: System open for extension (new agents) but closed for modification (no core changes)

### Negative

- **Slight duplication**: Knowledge injection pattern duplicated across agents (~10 lines per agent for global + agent-specific knowledge)
- **No centralized prompt patterns**: Harder to enforce consistent prompt structure across agents (must rely on documentation and code review)
- **Potential drift**: Agent prompts may diverge in quality or structure over time without centralized enforcement
- **Migration effort**: Existing agents must be updated to include prompt functions (one-time cost)
- **Discovery complexity**: No single place to see all prompt building logic - must check individual agent files
- **Testing burden**: Each agent must test its own knowledge injection pattern independently

### Neutral

- **File size**: Agent files grow slightly (~50-100 lines per prompt function depending on complexity)
- **Function count**: Same total number of prompt functions system-wide, just relocated to agent files
- **Knowledge injection**: Same pattern preserved (global → agent-specific → task data), just implemented per-agent
- **Core categorization**: `buildCategorizePrompt_()` remains in `PromptBuilder.gs` (not agent-specific, applies to all emails)
- **Learning curve**: Developers must check agent files for prompts instead of central `PromptBuilder.gs` location
- **Duplication is acceptable**: The ~10 lines of knowledge injection pattern duplication is a reasonable trade-off for true agent independence

## Implementation Notes

### Migration Steps

**1. Move `buildReplyDraftPrompt_()` to `AgentReplyDrafter.gs`:**
```javascript
// Cut from PromptBuilder.gs, paste into AgentReplyDrafter.gs
// No changes to function signature or logic required
// Preserve all knowledge injection patterns (global + reply-specific)
// Keep formatEmailThread_() helper function if needed
```

**2. Move `buildSummaryPrompt_()` to `AgentSummarizer.gs`:**
```javascript
// Cut from PromptBuilder.gs, paste into AgentSummarizer.gs
// No changes to function signature or logic required
// Preserve email reference map and web links logic
// Maintain global + summarizer-specific knowledge injection
```

**3. Update `PromptBuilder.gs`:**
```javascript
// Delete buildReplyDraftPrompt_() and buildSummaryPrompt_()
// Keep buildCategorizePrompt_() (core system function)
// Add header comment explaining ADR-022 agent-owned prompts
```

**4. Verify helper functions:**
```javascript
// If formatEmailThread_() exists in PromptBuilder.gs:
// - Move to AgentReplyDrafter.gs (only used there)
// - Or keep as shared utility if used by multiple agents

// If buildSummaryPrompt_() has unique helpers:
// - Move those helpers to AgentSummarizer.gs
```

**5. No function call changes needed:**
```javascript
// Functions already called locally within agent files
// No cross-file dependencies to update
```

### Knowledge Injection Checklist

Every agent prompt builder MUST implement this pattern:

- [ ] Accept `globalKnowledge` parameter (from `fetchGlobalKnowledge_()`)
- [ ] Accept agent-specific knowledge parameter (from agent's knowledge fetcher)
- [ ] Inject global knowledge FIRST with `=== GLOBAL KNOWLEDGE ===` header
- [ ] Inject agent-specific knowledge SECOND with descriptive header
- [ ] Include task data LAST
- [ ] Check `configured` property before injecting knowledge
- [ ] Preserve token utilization logging (if `DEBUG` enabled)
- [ ] Follow ADR-019 global knowledge hierarchy
- [ ] Follow ADR-015 INSTRUCTIONS + KNOWLEDGE naming convention

### Testing Agent Prompts

**Unit Testing Pattern:**
```javascript
// Test agent prompt builder in isolation
function testReplyDrafterPrompt_() {
  const mockThread = {
    messages: [
      { from: 'sender@example.com', subject: 'Test', body: 'Hello' }
    ]
  };

  const mockReplyKnowledge = {
    configured: true,
    knowledge: 'Use friendly tone and sign with your name'
  };

  const mockGlobalKnowledge = {
    configured: true,
    knowledge: 'Company: Acme Corp\nTeam: Engineering'
  };

  const prompt = buildReplyDraftPrompt_(mockThread, mockReplyKnowledge, mockGlobalKnowledge);

  // Assertions
  console.assert(prompt.includes('=== GLOBAL KNOWLEDGE ==='), 'Missing global knowledge section');
  console.assert(prompt.includes('Company: Acme Corp'), 'Missing global knowledge content');
  console.assert(prompt.includes('=== YOUR DRAFTING INSTRUCTIONS ==='), 'Missing agent instructions section');
  console.assert(prompt.includes('Use friendly tone'), 'Missing agent knowledge content');
  console.assert(prompt.includes('=== EMAIL THREAD ==='), 'Missing email thread section');

  Logger.log('✓ Reply Drafter prompt test passed');
}
```

**Integration Testing:**
```javascript
// Test with real knowledge sources
function testReplyDrafterWithRealKnowledge_() {
  const cfg = getConfig_();
  const replyConfig = getReplyDrafterConfig_();

  // Fetch real knowledge
  const globalKnowledge = fetchGlobalKnowledge_({
    folderUrl: cfg.GLOBAL_KNOWLEDGE_FOLDER_URL,
    maxDocs: parseInt(cfg.GLOBAL_KNOWLEDGE_MAX_DOCS || '5')
  });

  const replyKnowledge = fetchReplyKnowledge_({
    instructionsUrl: replyConfig.REPLY_DRAFTER_INSTRUCTIONS_URL,
    knowledgeFolderUrl: replyConfig.REPLY_DRAFTER_KNOWLEDGE_FOLDER_URL,
    maxDocs: parseInt(replyConfig.REPLY_DRAFTER_KNOWLEDGE_MAX_DOCS || '5')
  });

  // Build prompt
  const mockThread = { messages: [{ from: 'test@example.com', body: 'Test' }] };
  const prompt = buildReplyDraftPrompt_(mockThread, replyKnowledge, globalKnowledge);

  // Verify structure
  Logger.log('Prompt length: ' + prompt.length);
  Logger.log('Global knowledge included: ' + (globalKnowledge.configured ? 'Yes' : 'No'));
  Logger.log('Reply knowledge included: ' + (replyKnowledge.configured ? 'Yes' : 'No'));
}
```

### Agent Template Updates

The `AgentTemplate.gs` should be updated to include prompt building example:

```javascript
// In AgentTemplate.gs

/**
 * Build agent-specific prompt with knowledge injection
 * This demonstrates the standard pattern for agent-owned prompts (ADR-022)
 *
 * @private
 * @param {Object} data - Data to process (agent-specific format)
 * @param {Object} agentKnowledge - Agent-specific knowledge from KnowledgeService
 * @param {Object} globalKnowledge - Global knowledge from KnowledgeService
 * @returns {string} - Complete prompt for AI processing
 */
function buildTemplateAgentPrompt_(data, agentKnowledge, globalKnowledge) {
  const parts = ['You are a template agent performing a specific task.'];

  // 1. GLOBAL KNOWLEDGE (organizational context - ADR-019)
  if (globalKnowledge && globalKnowledge.configured) {
    parts.push('');
    parts.push('=== GLOBAL KNOWLEDGE ===');
    parts.push(globalKnowledge.knowledge);

    // Token utilization logging (optional, for debugging)
    const cfg = getConfig_();
    if (cfg.DEBUG && globalKnowledge.metadata) {
      Logger.log('Global knowledge tokens: ' + globalKnowledge.metadata.estimatedTokens);
    }
  }

  // 2. AGENT-SPECIFIC KNOWLEDGE (agent instructions - ADR-015)
  if (agentKnowledge && agentKnowledge.configured) {
    parts.push('');
    parts.push('=== AGENT INSTRUCTIONS ===');
    parts.push(agentKnowledge.knowledge);

    // Token utilization logging (optional)
    const agentConfig = getTemplateAgentConfig_();
    if (agentConfig.TEMPLATE_DEBUG && agentKnowledge.metadata) {
      Logger.log('Agent knowledge tokens: ' + agentKnowledge.metadata.estimatedTokens);
    }
  }

  // 3. Task data
  parts.push('');
  parts.push('=== DATA TO PROCESS ===');
  parts.push(JSON.stringify(data, null, 2));

  parts.push('');
  parts.push('Please process the data according to the instructions above.');

  return parts.join('\n');
}
```

### Duplication Management

**Acceptable Duplication:**
- Knowledge injection pattern (~10 lines per agent)
- Prompt section headers and structure
- Debug logging for token utilization
- Knowledge availability checks (`configured` property)

**When to Extract:**
If more than 3 agents need the same complex prompt logic (e.g., table formatting, complex markdown rendering), consider:
1. Creating shared utility in `Utilities.gs` (ADR-013)
2. Documenting pattern in agent template
3. Still keeping prompt building function in agent file (calls utility)

**Don't Extract Yet:**
- Simple knowledge injection (current state with 2 agents)
- Header formatting (`=== SECTION ===` patterns)
- Basic string concatenation
- `parts.join('\n')` pattern

### Documentation Updates

**Update CLAUDE.md:**
```markdown
### Development Patterns

#### Agent Prompt Building (ADR-022)
- Agents own their prompt construction functions
- Prompt builders named `build[AgentName]Prompt_()`
- MUST inject global knowledge before agent-specific knowledge
- MUST follow knowledge hierarchy: global → agent-specific → task data
- See AgentReplyDrafter.gs and AgentSummarizer.gs for examples
- Core categorization prompts remain in PromptBuilder.gs (not agent-specific)
```

**Update Agent Files:**
```javascript
// In AgentReplyDrafter.gs
/**
 * REPLY DRAFTER AGENT
 *
 * Self-Contained Architecture (ADR-011):
 * - Configuration: getReplyDrafterConfig_() (ADR-014)
 * - Execution: Dual-hook pattern with onLabel + postLabel (ADR-018)
 * - Prompts: buildReplyDraftPrompt_() (ADR-022 - this file)
 * - Knowledge: INSTRUCTIONS + KNOWLEDGE_FOLDER (ADR-015)
 */
```

### Backward Compatibility

**No Breaking Changes:**
- Function signatures unchanged
- Knowledge injection pattern preserved
- Agent behavior identical
- Only file location changes

**Migration Path:**
1. Move functions to agent files (no logic changes)
2. Delete from `PromptBuilder.gs`
3. Test each agent independently
4. Deploy normally (no configuration changes required)
5. No downstream impact on users or deployments

### Future Agent Development

**When creating new agents:**

1. **Determine if agent needs prompts**: Not all agents require AI prompts (e.g., forwarding agent, cleanup agent)
2. **Implement prompt builder in agent file**: `build[AgentName]Prompt_()` function
3. **Follow knowledge injection pattern**: Global first, agent-specific second, data last
4. **Accept both knowledge parameters**: `agentKnowledge` and `globalKnowledge`
5. **Test prompt generation**: Mock knowledge objects and verify structure
6. **Document prompt requirements**: What knowledge is expected, what format output should be

**NO NEED TO:**
- Edit `PromptBuilder.gs` (unless adding core system functionality)
- Create shared prompt infrastructure
- Coordinate with other agents
- Request changes to core system files

**Agent Development Checklist:**
- [ ] Agent file contains: config + labels + prompts + handlers
- [ ] Prompt builder follows knowledge hierarchy (ADR-019)
- [ ] Uses INSTRUCTIONS + KNOWLEDGE naming (ADR-015)
- [ ] Tests knowledge injection with mocks
- [ ] Documents all configuration properties
- [ ] Registers with dual-hook pattern (ADR-018)
- [ ] Self-contained (no core file changes)

## References

- ADR-004: Pluggable Agents Architecture (foundation for agent modularity)
- ADR-010: PromptBuilder and LLMService Separation (original prompt/service separation)
- ADR-011: Self-Contained Agent Architecture (agents own config + labels + logic - this ADR completes it)
- ADR-014: Configuration Management and Ownership (agents own configuration functions)
- ADR-015: INSTRUCTIONS vs KNOWLEDGE Configuration Naming (agent knowledge patterns)
- ADR-018: Dual-Hook Agent Architecture (agents own execution handlers)
- ADR-019: Global Knowledge Folder Architecture (knowledge injection requirements and hierarchy)
- Issue #33: Move agent-specific prompts from PromptBuilder to agent files
- `AgentReplyDrafter.gs`: Reference implementation after migration
- `AgentSummarizer.gs`: Reference implementation after migration
- `PromptBuilder.gs`: Core categorization prompts (non-agent functionality)
- `AgentTemplate.gs`: Template demonstrating agent-owned prompt pattern
