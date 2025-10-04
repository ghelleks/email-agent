# ADR-005: Batch Processing and Budget Management

**Status**: Superseded by ADR-021
**Date**: 2025-01-26
**Deciders**: Project team
**Superseded by**: [ADR-021: Remove Internal Budget Management System](021-remove-internal-budget-management.md)

## Context

The email-agent system operates within several important constraints that required a cost-effective and reliable processing strategy:

**Platform Constraints:**
- Google Apps Script has a 6-minute maximum execution time limit
- Gmail API has rate limiting and quota restrictions
- Gemini API calls have cost implications that scale with usage

**Operational Requirements:**
- Process potentially large numbers of emails automatically
- Maintain predictable and controlled operational costs
- Ensure reliable processing without timeouts or failures
- Provide users with cost visibility and control

The system needed a processing strategy that could handle variable email volumes while staying within execution time limits and maintaining cost predictability.

## Decision

We implemented a batch processing architecture with comprehensive budget management:

**Batch Processing Strategy:**
- Process emails in configurable batches rather than all at once
- Default batch size balances processing efficiency with execution time limits
- Batch size is configurable to accommodate different usage patterns
- Each batch execution completes within Apps Script time limits

**Budget Management System:**
- Daily API call budgets prevent runaway costs
- Separate budget tracking for different API types (Gemini, Gmail)
- Budget counters reset daily for predictable cost control
- Processing stops when daily budgets are exceeded
- Configuration allows users to set budget limits based on their needs

**Budget Enforcement:**
- Pre-flight budget checks before starting processing
- Real-time budget tracking during execution
- Graceful termination when budgets are reached
- Clear logging and reporting of budget status

## Alternatives Considered

### Alternative 1: Process All Emails in Single Execution
- **Pros**: Simpler implementation, no state management between batches
- **Cons**: Hits execution time limits, unpredictable processing times, all-or-nothing failure
- **Why not chosen**: Violates Apps Script execution time constraints

### Alternative 2: Fixed Small Batch Sizes
- **Pros**: Predictable execution time, simple implementation
- **Cons**: Inefficient for users with few emails, may not utilize available execution time
- **Why not chosen**: Doesn't optimize for different usage patterns

### Alternative 3: Unlimited API Usage
- **Pros**: Maximum functionality, no artificial constraints
- **Cons**: Unpredictable costs, potential for runaway expenses, no cost control
- **Why not chosen**: Unacceptable cost risk for users

### Alternative 4: Per-Email Budget Limits
- **Pros**: Very granular cost control, predictable per-email costs
- **Cons**: Complex accounting, may prevent processing important emails
- **Why not chosen**: Too restrictive and complex for practical use

### Alternative 5: Time-Based Budget Windows
- **Pros**: Smooth cost distribution, flexible time periods
- **Cons**: Complex implementation, harder to understand, timing edge cases
- **Why not chosen**: Daily budgets provide sufficient control with simpler implementation

## Consequences

### Positive
- **Cost predictability**: Daily budgets provide clear cost limits
- **Execution reliability**: Batch processing prevents timeout failures
- **Scalability**: System handles both light and heavy email volumes
- **User control**: Configurable batch sizes and budgets for different needs
- **Resource efficiency**: Optimizes use of available execution time
- **Error isolation**: Batch failures don't affect other batches

### Negative
- **Processing delays**: Large email backlogs may take multiple days to process
- **Complexity**: Additional state management for batch tracking
- **Budget constraints**: May prevent processing all emails on high-volume days

### Neutral
- **Configuration requirements**: Users need to set appropriate batch sizes and budgets
- **Monitoring needs**: Budget and batch status require visibility and alerting
- **State persistence**: Need to track batch progress across executions

## Implementation Notes

### Batch Size Configuration
- Default batch size: 50 emails (balances efficiency and execution time)
- Configurable via PropertiesService settings
- Consider email complexity and agent processing overhead
- Monitor execution times to optimize batch sizes

### Budget Tracking Implementation
```javascript
// Daily budget structure
const dailyBudgets = {
  gemini_api_calls: 100,
  gmail_api_calls: 1000,
  agent_executions: 50
};

// Budget enforcement
function checkBudget(apiType) {
  const used = getDailyUsage(apiType);
  const limit = getBudgetLimit(apiType);
  return used < limit;
}
```

### Batch State Management
- Track current batch position in PropertiesService
- Store batch completion status and timestamps
- Implement resume capability for interrupted processing
- Clean up old batch state data

### Budget Property Cleanup (Added 2025)
- Automatic cleanup of old date-based budget properties (`BUDGET-YYYY-MM-DD`)
- Configurable retention period via `BUDGET_HISTORY_DAYS` (default: 3 days)
- Runs automatically at the start of each execution cycle
- Prevents Script Properties accumulation over time
- Logs cleanup activity when `DEBUG=true`
- Non-fatal errors don't interrupt main execution

### Budget Reset Mechanism
- Daily reset based on user timezone
- Clear budget counters at midnight
- Log budget reset events for auditing
- Handle timezone changes gracefully

### Monitoring and Alerting
- Daily budget usage reports
- Batch processing status updates
- Alert users when budgets are exhausted
- Provide recommendations for budget adjustments

## References

- [Apps Script Quotas and Limitations](https://developers.google.com/apps-script/guides/services/quotas)
- [Gmail API Usage Limits](https://developers.google.com/gmail/api/reference/quota)
- [Gemini API Pricing](https://cloud.google.com/vertex-ai/pricing)