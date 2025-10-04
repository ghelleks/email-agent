# Troubleshooting Guide

Common issues and solutions for the Email Agent system. If you don't find your issue here, check the specific documentation for the feature you're using.

## Quick Diagnostic Steps

Before diving into specific issues, try these general diagnostic steps:

1. **Check execution logs**: In Apps Script editor, look at the bottom panel after running
2. **Enable debug mode**: Set `DEBUG=true` in Script Properties for detailed logging
3. **Try dry run mode**: Set `DRY_RUN=true` to test without making changes
4. **Verify configuration**: Check all Script Properties are spelled correctly
5. **Check API quota**: Monitor usage at Google Cloud Console: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

## Core Email Labeling Issues

### Everything gets labeled as `review`

**Symptoms**: All or most emails receive the `review` label regardless of content.

**Causes**:
- Not enough email content being analyzed
- Generic or unclear email patterns
- AI uncertain due to lack of context

**Solutions**:

**Solution 1**: Increase email content analyzed:
```
BODY_CHARS = 2000
```

**Solution 2**: Create custom classification rules with the [Knowledge System](../features/knowledge-system.md):
```
LABEL_INSTRUCTIONS_DOC_URL = https://docs.google.com/document/d/abc123/edit
```

**Solution 3**: Enable debug mode to see AI reasoning:
```
DEBUG = true
```

**Solution 4**: Check email content in execution logs - may genuinely be informational.

### "API key invalid" errors

**Symptoms**: Execution fails with API authentication errors.

**Causes**:
- Invalid or expired API key
- API not enabled in Google Cloud Console
- Organizational restrictions

**Solutions**:

**Solution 1**: Verify API key in Script Properties:
- Check for typos, truncation, or extra spaces
- Ensure complete key is present (starts with `AIzaSy`)

**Solution 2**: Verify Generative Language API is enabled:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Search for "Generative Language API"
3. Click "Enable" if not already enabled

**Solution 3**: Check organizational restrictions:
- If using work account, verify APIs are allowed
- Contact IT admin about API restrictions
- Try with personal Google account to isolate issue

**Solution 4**: Create new API key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Credentials"
3. Create new API key
4. Update Script Properties

### "Authorization required" messages

**Symptoms**: Permission errors when running the script.

**Causes**:
- Script hasn't been authorized yet
- Permissions were revoked
- OAuth scopes changed

**Solutions**:

**Solution 1**: Re-run authorization process:
1. In Apps Script editor, select `run` function
2. Click "Run" button (▶️)
3. Click "Review permissions"
4. Choose your Google account
5. Click "Advanced" → "Go to Gmail Labeler (unsafe)"
6. Click "Allow"

**Solution 2**: Check granted permissions:
1. Visit [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find "Gmail Labeler" (or your project name)
3. Verify Gmail access is granted
4. If not present, re-authorize as above

**Solution 3**: Clear and re-authorize:
1. Remove permissions in Google Account settings
2. Redeploy the script: `npm run deploy:personal`
3. Re-authorize when prompted

### Script times out or runs slowly

**Symptoms**: Execution exceeds time limit (6 minutes for triggers, 30 seconds for simple triggers).

**Causes**:
- Processing too many emails at once
- Large batch sizes causing slow API responses
- Network latency to AI service

**Solutions**:

**Solution 1**: Reduce emails per run:
```
MAX_EMAILS_PER_RUN = 10
```

**Solution 2**: Reduce batch size:
```
BATCH_SIZE = 5
```

**Solution 3**: Reduce email content analyzed:
```
BODY_CHARS = 800
```

**Solution 4**: Check execution logs for slow operations:
```
DEBUG = true
```
Look for operations taking >1 second.

### No emails being processed

**Symptoms**: Script runs but processes 0 emails.

**Causes**:
- All emails already have labels
- No emails in inbox matching criteria
- Filters excluding emails

**Solutions**:

**Solution 1**: Check execution logs:
```
DEBUG = true
```
Look for "No candidates" or "All emails already processed" messages.

**Solution 2**: Verify you have unlabeled emails:
- Check Gmail inbox for recent emails
- Remove existing labels from test emails
- Send yourself a test email

**Solution 3**: Check label filters in code:
- Script only processes emails without existing labels
- Emails with any of the 4 core labels are skipped

**Solution 4**: Verify trigger is running:
- Check "Triggers" section in Apps Script editor
- Ensure trigger is enabled
- Check trigger execution history

## Web App Issues

See also: [Web App Documentation](../features/web-app.md#troubleshooting)

### Web app shows "Web app functionality is disabled"

**Solution**: Set `WEBAPP_ENABLED=true` in Script Properties

**Solution**: Redeploy the web app if the setting was changed after deployment:
```bash
npm run deploy:personal
```

### "No emails found with 'summarize' label"

**Solution**: Apply the `summarize` label to some emails in Gmail first

**Solution**: Verify the label exists and is spelled correctly (all lowercase)

**Solution**: Check that you're logged into the correct Google account

### Web app times out during summarization

**Solution**: Reduce emails processed per summary:
```
WEBAPP_MAX_EMAILS_PER_SUMMARY = 10
```

**Solution**: Check API quota usage at Google Cloud Console:
```
https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
```

**Solution**: Try processing fewer emails at once (unlabel some emails, process in batches)

### Archive button doesn't work

**Solution**: Ensure you've generated a summary first before trying to archive

**Solution**: Check that emails still have the `summarize` label applied

**Solution**: Verify you have permission to modify labels in Gmail

### Web app URL not working

**Solution**: Redeploy the web app and get a new URL:
```bash
npm run deploy:personal
```

**Solution**: Check that deployment type is set to "Web app" not "API executable"

**Solution**: Verify "Who has access" is set to "Only myself" or appropriate access level

### Authorization errors in web app

**Solution**: Clear browser cookies and re-authorize

**Solution**: Visit the web app URL while logged into the correct Google account

**Solution**: Redeploy web app and use the new URL

## Email Summarizer Issues

See also: [Email Summarizer Documentation](../agents/email-summarizer.md#troubleshooting)

### Email Summarizer not running automatically

**Solution**: Install the summarizer trigger by running `installSummarizerTrigger` in Apps Script editor:
1. Open Apps Script editor
2. Select `installSummarizerTrigger` from function dropdown
3. Click "Run" button (▶️)

**Solution**: Check the "Triggers" section to verify the daily trigger exists

**Solution**: Verify `SUMMARIZER_ENABLED=true` in Script Properties

**Solution**: Check trigger execution history for errors

### No summary emails being received

**Solution**: Check that you have emails with the `summarize` label from the past 7 days

**Solution**: Verify `SUMMARIZER_DESTINATION_EMAIL` is set correctly:
- Should be full email address
- Check for typos

**Solution**: Check Gmail spam folder for summary emails

**Solution**: Run `runSummarizerAgent` manually in Apps Script editor to test immediately

**Solution**: Enable debug mode:
```
SUMMARIZER_DEBUG = true
```

### Email Summarizer times out or fails

**Solution**: Reduce maximum emails per summary:
```
SUMMARIZER_MAX_EMAILS_PER_SUMMARY = 25
```

**Solution**: Check API quota usage at Google Cloud Console

**Solution**: Enable debug mode and check execution logs:
```
SUMMARIZER_DEBUG = true
```

**Solution**: Verify API key is valid and API is enabled

### Emails not being archived

**Solution**: Verify archive-on-label is enabled:
```
SUMMARIZER_ARCHIVE_ON_LABEL = true
```

**Solution**: Check that emails have the `summarize` label applied correctly

**Solution**: Ensure trigger is installed and running (check Triggers section)

**Solution**: Check execution logs for permission errors

### Duplicate summaries or processing issues

**Solution**: Check execution logs for errors during summarization

**Solution**: Verify only one summarizer trigger exists (remove duplicates):
1. Go to "Triggers" section
2. Look for multiple `runSummarizerAgent` triggers
3. Delete extras, keep only one

**Solution**: Use dry run mode to test without sending emails:
```
SUMMARIZER_DRY_RUN = true
```

## Multi-Account Issues

See also: [Multi-Account Documentation](../features/multi-account.md#troubleshooting)

### Multi-account commands not working

**Solution**: Run `npm run setup:account` to create initial configuration

**Solution**: Ensure you have the latest project version with multi-account support

**Solution**: Update `package.json` if missing multi-account scripts

### `accounts.json not found` error

**Solution**: Run `npm run setup:account` to create the configuration file

**Solution**: Check that you're running commands from the project root directory

**Solution**: Create `accounts.json` manually (see [Multi-Account Documentation](../features/multi-account.md))

### Wrong account project file is being used

**Solution**: Check account statuses:
```bash
npm run switch:status
```

**Solution**: Ensure you're using account-specific commands:
```bash
npm run deploy:personal  # Not just 'deploy'
```

**Solution**: Verify `.clasp.json.[account]` files exist with correct Script IDs

### Script ID errors in multi-account setup

**Solution**: Verify Script IDs in `accounts.json` are correct (57+ characters)

**Solution**: Get Script ID from Apps Script URL:
```
script.google.com/.../SCRIPT_ID/edit
                      ↑ this part ↑
```

**Solution**: Re-create Apps Script project if Script ID is invalid

### `clasp login` required for each account

**This is normal behavior** - each Google account needs separate authentication.

**Solution**: Run authentication for each account:
```bash
clasp --user personal login
clasp --user work login
```

**Solution**: Use `--no-localhost` flag if having browser issues:
```bash
clasp --user personal login --no-localhost
```

### Account-specific commands fail

**Solution**: Validate configuration:
```bash
npm run validate:accounts
```

**Solution**: Ensure all Script IDs in `accounts.json` are valid

**Solution**: Recreate project files:
```bash
npm run switch:create-project-files
```

### Trigger installation fails

**This is a known limitation** - automated trigger installation via `clasp run` is unreliable.

**Solution**: Install triggers manually in Apps Script editor:
1. Open Apps Script editor: `npm run open:personal`
2. Select `installTrigger` from function dropdown
3. Click "Run" button (▶️)
4. Grant permissions when prompted

**Solution**: For Email Summarizer, use `installSummarizerTrigger` function

**Solution**: Verify triggers in "Triggers" section of Apps Script editor

### Authentication issues with specific account

**Solution**: Check authentication status:
```bash
npm run switch:status
```

**Solution**: Re-authenticate problematic account:
```bash
clasp --user personal login
```

**Solution**: Clear browser cookies and re-authorize

## Knowledge System Issues

See also: [Knowledge System Documentation](../features/knowledge-system.md#troubleshooting)

### KnowledgeService failing to fetch documents

**Solution**: Verify document/folder URL is correct format in Script Properties:
- Full URL: `https://docs.google.com/document/d/abc123/edit`
- Or just ID: `abc123`

**Solution**: Check document/folder permissions:
- Must have at least Viewer access
- Try "Anyone with the link can view" sharing setting

**Solution**: Enable debug mode:
```
KNOWLEDGE_DEBUG = true
```

**Solution**: If configured but want to proceed without knowledge, remove the property

**Solution**: Check execution logs for token warnings (may be hitting capacity limits)

### Knowledge documents too large

**Symptoms**: Warnings about token usage in execution logs.

**Solution**: Monitor soft warnings at 50% capacity (informational only)

**Solution**: Critical warnings at 90% capacity mean action needed:
```
LABEL_KNOWLEDGE_MAX_DOCS = 3
```

**Solution**: Remove some documents from knowledge folder

**Solution**: Split large documents into smaller focused documents

**Solution**: Disable warnings if you're comfortable with current usage:
```
KNOWLEDGE_LOG_SIZE_WARNINGS = false
```

### Document permissions errors

**Solution**: Share document/folder with your Google account (same account running Apps Script)

**Solution**: Verify document isn't in a restricted organizational folder

**Solution**: Try accessing document directly in browser while logged into same account

**Solution**: Use "Anyone with the link can view" sharing setting

### Classification not using knowledge

**Solution**: Check execution logs to verify knowledge is being loaded:
```
KNOWLEDGE_DEBUG = true
```

**Solution**: Verify knowledge documents contain clear examples and rules

**Solution**: Knowledge may be too generic - make examples more specific

**Solution**: Check that property names are spelled correctly:
- `LABEL_INSTRUCTIONS_DOC_URL` (not `LABEL_KNOWLEDGE_DOC_URL`)
- `LABEL_KNOWLEDGE_FOLDER_URL`

### Cache not refreshing

**Solution**: Wait for cache TTL to expire (default 30 minutes)

**Solution**: Temporarily set cache duration to 0, then restore:
```
KNOWLEDGE_CACHE_DURATION_MINUTES = 0
```
Then restore to `30` after testing.

**Solution**: Use different document URL to force cache miss

**Solution**: Redeploy the Apps Script project to clear all caches:
```bash
npm run deploy:personal
```

## General Issues

### Configuration not taking effect

**Solution**: Redeploy after changing Script Properties:
```bash
npm run deploy:personal
```

**Solution**: Verify property name is spelled correctly (case-sensitive)

**Solution**: Check that value is in expected format:
- Booleans: `true` or `false` (lowercase strings)
- Numbers: `"20"` or just `20`

**Solution**: Clear Apps Script cache by redeploying

### Boolean values not working

**Incorrect formats**:
- `True`, `TRUE` (wrong case)
- `1`, `0` (wrong type)
- `yes`, `no` (wrong value)

**Correct format**:
```
DRY_RUN = true
DEBUG = false
SUMMARIZER_ENABLED = true
```

Use lowercase `true` or `false` as strings.

### Execution logs not showing details

**Solution**: Enable debug mode:
```
DEBUG = true
```

**Solution**: For Email Summarizer, use agent-specific debug:
```
SUMMARIZER_DEBUG = true
```

**Solution**: For Knowledge System:
```
KNOWLEDGE_DEBUG = true
```

**Solution**: Check that you're viewing the correct execution:
- Logs are per-execution
- Check timestamp matches when you ran the script

### Gmail labels not being created

**Solution**: Verify script has Gmail permissions (re-authorize if needed)

**Solution**: Check execution logs for permission errors

**Solution**: Manually create labels in Gmail as test:
- `reply_needed`
- `review`
- `todo`
- `summarize`

**Solution**: Check that label names are lowercase and exactly match

### API quota exceeded errors

**Symptoms**: Errors mentioning quota limits or rate limiting.

**Solutions**:

**Solution 1**: Monitor quota usage at Google Cloud Console:
```
https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
```

**Solution 2**: Reduce emails processed per run:
```
MAX_EMAILS_PER_RUN = 10
```

**Solution 3**: Wait 24 hours for quota to reset

**Solution 4**: Request quota increase through Google Cloud Console if needed

**Solution 5**: For multi-account, use separate API keys per account for better quota isolation

**Solution 6**: Consider upgrading to a paid API tier for higher quotas

## Getting Help

### Before Asking for Help

1. **Check this guide** for your specific issue
2. **Review execution logs** with debug mode enabled
3. **Try dry run mode** to test safely
4. **Verify configuration** matches documentation
5. **Check feature-specific docs** for detailed troubleshooting

### Information to Provide

When seeking help, include:

1. **What you're trying to do**: Expected behavior
2. **What's happening**: Actual behavior
3. **Error messages**: Exact text from execution logs
4. **Configuration**: Relevant Script Properties (hide API keys)
5. **Steps to reproduce**: What triggers the issue
6. **Environment**: Single account or multi-account, personal or work account

### Execution Log Examples

**Good execution log snippet**:
```
[2025-10-02 10:30:15] Starting email labeling...
[2025-10-02 10:30:16] ERROR: Failed to fetch knowledge document
[2025-10-02 10:30:16] Document ID: abc123
[2025-10-02 10:30:16] Error: Permission denied
```

**Include full context** but redact sensitive information like email addresses and API keys.

## Advanced Diagnostics

### Enable All Debug Flags

For comprehensive troubleshooting, enable all debug flags:

```
DEBUG = true
SUMMARIZER_DEBUG = true
KNOWLEDGE_DEBUG = true
DRY_RUN = true
```

This provides maximum logging without making changes.

### Test Individual Components

**Test core email labeling**:
1. Set `MAX_EMAILS_PER_RUN = 1`
2. Run manually in Apps Script editor
3. Check execution logs

**Test Email Summarizer**:
1. Run `runSummarizerAgent` function directly
2. Check execution logs for errors
3. Verify summary email sent

**Test Web App**:
1. Open web app URL
2. Open browser console (F12)
3. Check for JavaScript errors
4. Test "Get Summary" button

**Test Knowledge System**:
1. Enable `KNOWLEDGE_DEBUG = true`
2. Run email labeling
3. Check logs for document fetch details

### Check Apps Script Quotas

View current quota usage:

1. Go to [Apps Script Dashboard](https://script.google.com/home)
2. Click on your project
3. Check execution count and failures
4. Review trigger execution history

### Manual Function Testing

Test specific functions in Apps Script editor:

1. Select function from dropdown
2. Click "Run" button
3. Check execution logs
4. Verify expected behavior

## See Also

- [Back to README](../../README.md)
- [Configuration Reference](configuration.md) - All configuration options
- [Web App Documentation](../features/web-app.md) - Web app specific issues
- [Email Summarizer Documentation](../agents/email-summarizer.md) - Agent specific issues
- [Multi-Account Documentation](../features/multi-account.md) - Multi-account specific issues
- [Knowledge System Documentation](../features/knowledge-system.md) - Knowledge system specific issues
