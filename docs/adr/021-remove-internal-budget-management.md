# ADR-021: Remove Internal Budget Management System

**Status**: Accepted
**Date**: 2025-10-04
**Deciders**: Project team
**Supersedes**: ADR-005

## Context

The email-agent system initially implemented an internal budget management system (ADR-005) to provide cost control and predictability for Gemini API usage. This system included:

**Internal Budget Components:**
- `DAILY_GEMINI_BUDGET` configuration property (default: 50 calls/day)
- `enforceBudget_()` function to check and enforce daily limits
- `cleanupOldBudgetProperties_()` function to manage historical budget tracking
- Daily budget counters stored in Script Properties (`BUDGET-YYYY-MM-DD`)
- Pre-flight budget checks before AI operations
- Graceful termination when daily budgets exceeded

**Problems Identified:**

1. **Artificial Limits Not Aligned with API Quotas**: The default 50 calls/day limit is far below Google's actual API quotas. Users with legitimate high-volume needs hit artificial limits even when Google would allow the usage.

2. **Increased Complexity**: The budget system added approximately 150 lines of code across multiple files, introducing:
   - Additional configuration properties to manage
   - State tracking in Script Properties
   - Cleanup routines for old budget data
   - Error handling for budget-related failures

3. **Poor User Experience**: When users hit the internal budget limit:
   - Processing stops with generic budget messages
   - Emails remain unprocessed even when API quotas available
   - Users must manually adjust `DAILY_GEMINI_BUDGET` or wait until next day
   - No clear guidance on appropriate budget values

4. **Duplicate Quota Management**: Google Cloud Platform and Apps Script already provide comprehensive quota management:
   - Gemini API has its own rate limits and quotas
   - Apps Script has execution time and service quotas
   - Google Cloud Console provides usage monitoring and alerts
   - Native APIs return clear error messages when quotas exceeded

5. **Maintenance Burden**: Budget cleanup logic required ongoing maintenance:
   - `BUDGET_HISTORY_DAYS` configuration to prevent property accumulation
   - Periodic cleanup runs consuming execution time
   - Additional debugging complexity when budget issues occur

## Decision

**Remove the internal budget management system entirely** and rely on Google Apps Script and Gemini API native quota management.

**Specific Changes:**
- Remove `DAILY_GEMINI_BUDGET` configuration property
- Remove `enforceBudget_()` function and all budget checking logic
- Remove `cleanupOldBudgetProperties_()` function
- Remove `BUDGET_HISTORY_DAYS` configuration property
- Remove all budget-related Script Properties (keys like `BUDGET-YYYY-MM-DD`)
- Update documentation to remove budget references
- Rely on native API error handling for quota exceeded scenarios

**Quota Management Strategy:**
- Let Google's native APIs enforce their own quotas
- Users monitor usage via Google Cloud Console
- Clear error messages from native APIs guide users when quotas exceeded
- Apps Script execution time limits naturally bound processing
- Users can set `MAX_EMAILS_PER_RUN` to control batch sizes if needed

## Alternatives Considered

### Alternative 1: Increase Default Budget Limit
- **Pros**: Quick fix, minimal code changes, maintains budget concept
- **Cons**: Still artificial limit, doesn't solve alignment problem, users still hit limits
- **Why not chosen**: Doesn't address root cause of complexity and misalignment

### Alternative 2: Make Budget Optional
- **Pros**: Users can opt-in to budget management, maintains feature for those who want it
- **Cons**: Keeps complexity in codebase, most users won't use it, maintenance burden remains
- **Why not chosen**: Complexity not justified for edge case usage

### Alternative 3: Dynamic Budget Based on Quotas
- **Pros**: Automatically aligns with Google quotas, smarter budget management
- **Cons**: Significantly increases complexity, requires quota API integration, brittle
- **Why not chosen**: Complexity far exceeds value, quota APIs have their own limits

### Alternative 4: User-Configurable Budget Tiers
- **Pros**: Predefined safe/moderate/aggressive tiers, easier configuration
- **Cons**: Still artificial limits, adds UI complexity, users still need to understand quotas
- **Why not chosen**: Doesn't solve fundamental misalignment problem

### Alternative 5: Weekly/Monthly Budget Windows
- **Pros**: Better aligns with typical quota windows, smoother usage distribution
- **Cons**: Even more complex state management, harder to reason about, still artificial
- **Why not chosen**: Increases complexity without solving core problems

## Consequences

### Positive

- **Simpler Codebase**: Removes ~150 lines of budget management code across multiple files
- **Better Quota Alignment**: Users can utilize full Google API quotas without artificial limits
- **Clearer Error Messages**: Native API errors provide specific quota information and remediation
- **Reduced Configuration Burden**: Two fewer configuration properties to manage (`DAILY_GEMINI_BUDGET`, `BUDGET_HISTORY_DAYS`)
- **Lower Maintenance**: No budget cleanup logic, state management, or budget-related debugging
- **Better Developer Experience**: Fewer moving parts, easier to understand and debug
- **Faster Execution**: No budget checking overhead or cleanup routines
- **Reduced Property Accumulation**: No daily budget properties to clean up

### Negative

- **Less Proactive Cost Control**: Users can't set artificial daily limits to prevent runaway costs
- **Requires External Monitoring**: Users must monitor usage via Google Cloud Console instead of application logs
- **No Built-in Usage Tracking**: Historical daily usage no longer tracked in Script Properties
- **Potential for Quota Surprises**: Users may hit Google quotas unexpectedly without daily budget guardrails

### Neutral

- **Shift in Responsibility**: Cost monitoring moves from application to Google Cloud Platform
- **Different Error Handling**: Quota errors come from native APIs instead of budget system
- **Configuration Changes Required**: Users must remove obsolete budget properties after upgrade

## Implementation Notes

### Migration Steps

1. **Code Removal**:
   - Remove `enforceBudget_()` from `LLMService.gs`
   - Remove budget check calls from `categorizeWithGemini_()` in `Categorizer.gs`
   - Remove budget check calls from web app operations in `WebAppController.gs`
   - Remove `cleanupOldBudgetProperties_()` from `Config.gs`
   - Remove cleanup call from `Main.gs` execution pipeline
   - Remove `DAILY_GEMINI_BUDGET` and `BUDGET_HISTORY_DAYS` from `Config.gs` defaults

2. **Documentation Updates**:
   - Update CLAUDE.md to remove budget configuration references
   - Update configuration documentation to remove budget properties
   - Add migration notes for users upgrading from budget-enabled versions
   - Update troubleshooting guides to recommend Google Cloud Console monitoring

3. **Property Cleanup**:
   - Users should manually delete `DAILY_GEMINI_BUDGET` from Script Properties
   - Users should manually delete `BUDGET_HISTORY_DAYS` from Script Properties
   - Old `BUDGET-YYYY-MM-DD` properties will remain but become inert (no automatic cleanup)
   - Optional: Users can manually delete old budget properties with `BUDGET-` prefix

### User Guidance for Quota Monitoring

**Google Cloud Console Monitoring:**
- Navigate to Google Cloud Console > APIs & Services > Quotas
- Filter for Gemini API / Vertex AI quotas
- Set up quota alerts for proactive notification
- Monitor usage trends over time

**Apps Script Execution Logs:**
- Native API quota errors appear in execution logs
- Error messages include specific quota information
- Logs show which API calls failed due to quotas

**Cost Management:**
- Use `MAX_EMAILS_PER_RUN` to control batch sizes
- Monitor costs via Google Cloud Billing
- Set billing budgets and alerts in Google Cloud Console
- Review usage patterns to optimize processing

### Error Handling Changes

**Before (with internal budget):**
```
Budget limit reached (50/50 calls). Processing stopped.
```

**After (native API errors):**
```
Gemini API quota exceeded. Quota limit: 60 requests per minute.
See https://cloud.google.com/vertex-ai/docs/quotas for details.
```

Native errors provide:
- Specific quota type that was exceeded
- Current quota limits
- Links to quota documentation
- Guidance on increasing quotas if needed

### Configuration Property Changes

**Properties to Remove:**
- `DAILY_GEMINI_BUDGET` (was: default 50)
- `BUDGET_HISTORY_DAYS` (was: default 3)

**Properties to Keep:**
- `MAX_EMAILS_PER_RUN` (still controls batch size, default: 20)
- `BATCH_SIZE` (still controls emails per AI request, default: 10)

These remaining properties provide operational control without artificial quota limits.

### Backward Compatibility

**Breaking Changes:**
- `DAILY_GEMINI_BUDGET` property no longer used (safe to delete)
- Internal budget tracking removed (no impact on functionality)
- Users relying on budget limits must migrate to external monitoring

**Non-Breaking:**
- All core functionality remains unchanged
- Email processing logic unaffected
- Agent operations continue normally
- Web app operations unaffected

## References

- [GitHub Issue #34: Remove Internal Budget Management System](https://github.com/ghelleks/email-agent/issues/34)
- [ADR-005: Batch Processing and Budget Management](005-batch-processing-budget.md) (Superseded)
- [Apps Script Quotas and Limitations](https://developers.google.com/apps-script/guides/services/quotas)
- [Gemini API Quotas](https://cloud.google.com/vertex-ai/docs/quotas)
- [Google Cloud Console Monitoring](https://console.cloud.google.com/apis/quotas)
