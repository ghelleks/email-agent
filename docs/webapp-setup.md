# Interactive Web App Deployment Guide

This guide provides step-by-step instructions for deploying the Email Agent's Interactive Web App Dashboard.

**Note**: This web app is separate from the Email Summarizer agent. The web app provides on-demand email summarization through a web interface, while the Email Summarizer agent provides automated daily summaries via email. Both can work together or independently.

## Prerequisites

Before deploying the web app, ensure you have:

- ✅ **Completed the main setup** following the [README.md](README.md) instructions
- ✅ **Working email labeling system** (you can run the script manually)
- ✅ **Valid Gemini API key** configured in Script Properties
- ✅ **All required labels created** (`reply_needed`, `review`, `todo`, `summarize`)
- ✅ **Optional**: Email Summarizer agent configured if you want automated daily summaries

## Deployment Steps

### Option A: Multi-Account Deployment (Recommended)

**Navigate to your project directory**:
```bash
cd /path/to/your/email-agent
```

**Deploy the web app for specific account**:
```bash
# For personal account
npm run deploy:personal

# For work account
npm run deploy:work

# For all configured accounts
npm run deploy:all
```

These commands will:
1. Upload your latest code to the specified Apps Script project
2. Create/update deployment with web app enabled
3. Attempt to install triggers (may require manual installation)
4. Show deployment status and next steps

**Note**: Web app URLs must be retrieved manually from the Apps Script editor due to clasp limitations.

### Option B: Legacy Single Account Deployment

For existing single-account setups:
```bash
npm run deploy:webapp  # May not be available in current setup
```

### Option C: Manual Deployment (Always Available)

If you prefer manual control or the automated deployment doesn't work:

1. **Upload the latest code**:
   ```bash
   # For specific account (use deploy for complete process)
   npm run deploy:personal
   npm run deploy:work

   # For legacy single account setup
   npm run push
   ```

2. **Open the Apps Script editor**:
   ```bash
   # For specific account
   npm run open:personal
   npm run open:work

   # For legacy single account setup
   npm run open
   ```
   - Verify you see `WebApp.html` and `WebAppController.gs` in the file list

3. **Deploy manually**:
   - Click the **"Deploy"** button (top right)
   - Click **"New deployment"**
   - **Type**: Select **"Web app"** from the dropdown
   - **Description**: "Email Agent Dashboard" (or your preferred name)
   - **Execute as**: **"Me"** (your email address)
   - **Who has access**: **"Only myself"**
   - Click **"Deploy"**

4. **Authorize the deployment**:
   - Click **"Authorize access"**
   - Choose your Google account
   - Click **"Advanced"** → **"Go to [Your Project Name] (unsafe)"**
   - Click **"Allow"**

5. **Copy the web app URL**:
   - The deployment will show a URL like: `https://script.google.com/macros/s/AKfyc...../exec`
   - **Copy this URL** - you'll need it to access your dashboard

### Getting Your Web App URL

**Important**: Due to clasp limitations, web app URLs must be retrieved manually:

1. **Open the Apps Script editor**:
   ```bash
   npm run open:personal  # or npm run open:work
   ```

2. **Get the web app URL**:
   - Click **"Deploy"** → **"Manage deployments"**
   - Copy the web app URL from the active deployment
   - Bookmark this URL for quick access

**Legacy command** (may not work with multi-account setup):
```bash
npm run webapp:url  # Only works with legacy single-account setup
```

## Testing the Deployment

1. **Open the web app URL** in a new browser tab

2. **Verify authentication**:
   - You should see the "Email Dashboard" interface
   - If you see "Access Denied", check your deployment settings

3. **Test basic functionality**:
   - The page should load without errors
   - You should see "Ready to process emails" message
   - Both buttons should be visible and responsive

## Configure for Production Use

#### Set Web App Configuration (Optional)

In the Apps Script editor, go to **Project Settings** → **Script Properties** and add:

| Property Name | Recommended Value | Purpose |
|---------------|-------------------|---------|
| `WEBAPP_ENABLED` | `true` | Enable web app (default: true) |
| `WEBAPP_MAX_EMAILS_PER_SUMMARY` | `25` | Limit emails per summary (default: 25) |

#### Security Settings Verification

Ensure these settings are properly configured:

- **Web app access**: "Only myself" (never use "Anyone" for this app)
- **Execute as**: "Me" (ensures proper Gmail access)
- **Project visibility**: Keep private (don't share the project)

## Create Bookmark (Mobile-Friendly)

#### For iOS (iPhone/iPad):
1. Open the web app URL in Safari
2. Tap the **Share** button
3. Tap **"Add to Home Screen"**
4. Name it "Email Dashboard" and tap **"Add"**

#### For Android:
1. Open the web app URL in Chrome
2. Tap the **three dots** menu
3. Tap **"Add to Home screen"**
4. Name it "Email Dashboard" and tap **"Add"**

#### For Desktop:
1. Bookmark the web app URL in your browser
2. Consider pinning the tab for quick access

## Usage Workflow

Once deployed, use the web app with this workflow:

### 1. Label Emails for Summarization
- In Gmail, apply the **"summarize"** label to emails you want processed
- Can be newsletters, long threads, multiple related emails

### 2. Generate Summary
- Open your web app bookmark
- Tap **"Get Summary"**
- Wait for AI processing (typically 10-30 seconds)
- Review the consolidated summary with source links

### 3. Archive Processed Emails
- Tap **"Archive X Emails"** (shows exact count)
- Confirm the action
- Emails are moved to Archive and labels removed

## Troubleshooting Deployment Issues

### Problem: "Access Denied" Error
**Symptoms**: Web app shows access denied page

**Solutions**:
1. **Check deployment settings**:
   - Ensure "Execute as" is set to "Me"
   - Verify "Who has access" is "Only myself"
2. **Redeploy**:
   - Create a new deployment with correct settings
   - Use the new URL

### Problem: Web App URL Not Working
**Symptoms**: URL returns 404 or doesn't load

**Solutions**:
1. **Verify the URL**:
   - Ensure you copied the complete URL ending in `/exec`
   - Check for any missing characters
2. **Create new deployment**:
   - In Apps Script, create a new deployment
   - Get fresh URL

### Problem: "Web App Functionality Disabled" Message
**Symptoms**: App loads but shows disabled message

**Solutions**:
1. **Check Script Properties**:
   - Ensure `WEBAPP_ENABLED` is set to `true` (or not set at all)
2. **Redeploy after configuration changes**:
   - Configuration changes may require redeployment

### Problem: Authentication Loops or Errors
**Symptoms**: Repeated sign-in prompts or authorization failures

**Solutions**:
1. **Clear browser cache and cookies**
2. **Use incognito/private browsing mode**
3. **Check Google Account permissions**:
   - Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
   - Remove old authorizations for your script
   - Re-authorize from scratch

### Problem: No Emails Found Despite Having Labeled Emails
**Symptoms**: "No emails found" message when you have emails with "summarize" label

**Solutions**:
1. **Verify label name**:
   - Label must be exactly "summarize" (lowercase)
   - Check spelling and case sensitivity
2. **Check Gmail access**:
   - Ensure script has Gmail permissions
   - Try running the main email labeling script first
3. **Label placement**:
   - Ensure label is applied to the thread, not just individual messages

## Performance Optimization

### For Large Email Volumes
If you regularly process many emails:

1. **Reduce batch size**:
   - Set `WEBAPP_MAX_EMAILS_PER_SUMMARY` to `10` or `15`
   - This prevents timeouts with very long emails

2. **Process in smaller batches**:
   - Instead of labeling 50 emails at once, do 10-20 at a time
   - Generate multiple summaries if needed

### For Better Mobile Performance
1. **Use WiFi when possible** for faster processing
2. **Close other browser tabs** to free up memory
3. **Use the home screen bookmark** for fastest access

## Security Best Practices

### Deployment Security
- ✅ **Never share your web app URL** with others
- ✅ **Keep "Who has access" set to "Only myself"**
- ✅ **Don't embed the web app in other sites**
- ✅ **Regularly review Google Account permissions**

### Data Privacy
- 📧 **Email content** is processed by Google's AI but not stored permanently
- 🔑 **API keys and tokens** are stored securely in Google's infrastructure
- 📱 **Web app access** is logged for security auditing
- 🗑️ **Processed emails** are moved to Archive (not deleted)

### Regular Maintenance
1. **Monthly permission review**:
   - Check [Google Account permissions](https://myaccount.google.com/permissions)
   - Remove any unknown or old applications

2. **Quarterly redeployment**:
   - Consider redeploying with fresh permissions every few months
   - Update to latest code versions

## Advanced Configuration

### Custom Email Limits
For power users who want to adjust processing limits:

```javascript
// In Script Properties, adjust this value:
WEBAPP_MAX_EMAILS_PER_SUMMARY = 50  // Process up to 50 emails (may cause timeouts)
```

**Note**: API quotas are managed natively through Google Cloud Console. Monitor usage at: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

### Integration with Existing Workflows
The web app works alongside the existing automatic labeling:

1. **Automatic labeling** continues to work on schedule
2. **Web app** provides on-demand processing for "summarize" label
3. **Both systems** share the same configuration and API quotas

## Getting Help

### Before Contacting Support
1. **Check the console**:
   - In your browser, press F12 and check the Console tab for errors
   - Look for red error messages

2. **Try these steps**:
   - Clear browser cache
   - Try incognito/private mode
   - Disable browser extensions
   - Test on different device/browser

### Error Reporting
When reporting issues, include:
- **Exact error message** from the web app
- **Browser and device type** (Chrome on iPhone, etc.)
- **Steps to reproduce** the problem
- **Number of emails** you're trying to process

### Support Resources
- 📚 **Main documentation**: [README.md](README.md)
- 🔧 **Configuration reference**: See "Configuration Reference" in README
- 🐛 **Issue reporting**: Check project repository for issue templates

---

## Quick Reference

### Essential URLs
- **Apps Script Editor**: Run `npm run open` or visit [script.google.com](https://script.google.com)
- **Google Account Permissions**: [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
- **Google Cloud Console**: [console.cloud.google.com](https://console.cloud.google.com)

### Key Commands

#### Multi-Account Commands (Current System)
```bash
# Complete deployment (recommended)
npm run deploy:personal      # Deploy everything to personal account (code + web app + triggers)
npm run deploy:work          # Deploy everything to work account (code + web app + triggers)
npm run deploy:all           # Deploy to all configured accounts

# Development workflow
npm run open:personal       # Open personal Apps Script editor
npm run open:work          # Open work Apps Script editor
npm run logs:personal      # View personal account logs
npm run logs:work         # View work account logs

# Account management
npm run switch:status      # Show all account statuses
npm run validate:accounts  # Validate account configuration
```

#### Legacy Single Account Commands
```bash
npm run deploy:all    # Deploy complete system (if using legacy setup)
npm run push          # Upload code changes (legacy)
npm run open          # Open Apps Script editor (legacy)
npm run logs          # View execution logs (legacy)
```

### Mobile Shortcuts
- **Ctrl/Cmd + R**: Refresh and get new summary
- **Ctrl/Cmd + A**: Archive current emails (when available)
- **Escape**: Hide status messages

---

**Your Email Agent Web App is now ready for production use!** 🎉

Bookmark your web app URL and start processing emails with AI-powered summaries.