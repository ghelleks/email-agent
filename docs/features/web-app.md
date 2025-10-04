# Interactive Web App Dashboard

The Web App Dashboard provides a mobile-optimized web interface for on-demand email summarization and archiving. Perfect for processing emails on-the-go from your phone or getting quick summaries when you need them right now.

## What It Does

The web app provides:

- **On-demand summarization**: Get AI summaries of emails labeled with `summarize` anytime
- **Mobile-optimized interface**: Touch-friendly design that works on phones, tablets, and computers
- **Source email links**: Direct links back to your Gmail threads
- **Web link extraction**: Automatically finds and displays URLs from emails
- **Batch archiving**: Archive all summarized emails with one tap
- **Dark mode support**: Automatically adapts to your device preferences

## When to Use It

**Web App** is perfect for:
- Immediate summarization when you need answers right now
- Processing emails while on your phone
- Quick review before a meeting
- On-demand batch processing

**Email Summarizer Agent** is better for:
- Daily automated summaries
- Scheduled processing
- Set-it-and-forget-it automation

See [Email Summarizer Agent](../agents/email-summarizer.md) for the automated alternative.

## Quick Start

### Prerequisites

- Complete the [basic email labeling setup](../../README.md#setup-guide) first
- Web app is enabled by default (`WEBAPP_ENABLED=true`)

### Setup Steps

#### Automated Setup (Recommended)

```bash
npm run deploy:personal   # or deploy:work if using multi-account
```

This command will:
1. Upload your latest code to Apps Script
2. Create or update the web app deployment with consistent URLs
3. Install triggers
4. **Display your web app URL** for bookmarking

#### Manual Setup (Alternative)

1. In the Apps Script editor, click "Deploy" → "New deployment"
2. Click the gear icon next to "Select type" → "Web app"
3. Configure deployment:
   - **Description**: "Email Agent Web App" (optional)
   - **Execute as**: "Me"
   - **Who has access**: "Only myself"
4. Click "Deploy"
5. Copy the web app URL
6. Bookmark the URL for easy access

### Getting Your Web App URL Anytime

```bash
npm run url:personal    # Get personal account web app URL
npm run url:work        # Get work account web app URL (multi-account)
npm run url:all         # Get all web app URLs (multi-account)
```

## How to Use the Web App

### Step-by-Step Workflow

1. **Label emails for summarization**:
   - In Gmail, apply the `summarize` label to one or more emails
   - You can label newsletters, long threads, or any emails you want summarized

2. **Open the web dashboard**:
   - Visit your web app URL (bookmark it for quick access)
   - The dashboard loads instantly

3. **Get summary**:
   - Tap "Get Summary" button
   - AI processes all emails with the `summarize` label
   - Summary appears in Economist-style format

4. **Review the summary**:
   - Read the consolidated summary
   - Click source links to view original emails in Gmail
   - Check extracted web links for referenced URLs

5. **Archive emails** (optional):
   - Tap "Archive X Emails" to batch archive
   - Removes `summarize` label and archives emails
   - Emails stay accessible via `summarized` label

### Example Workflow

**Morning email triage**:
1. Open Gmail on your phone
2. Scan inbox, apply `summarize` to 5 newsletters
3. Open web app dashboard
4. Tap "Get Summary" → Read consolidated summary
5. Tap "Archive 5 Emails" → Inbox cleared

**Pre-meeting preparation**:
1. Find email thread about upcoming meeting
2. Apply `summarize` label
3. Open web app
4. Get instant summary of thread
5. Review key points before meeting starts

## Interface Overview

### Main Dashboard

```
📧 Email Agent Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━

[Get Summary] button
  ↓ generates ↓
━━━━━━━━━━━━━━━━━━━━━━━━━
Summary Display Area:
• Executive summary
• Key details with links
• Web links extracted
━━━━━━━━━━━━━━━━━━━━━━━━━

[Archive X Emails] button
  (appears after summary)
```

### Features

**Summary Display**:
- Headline with date
- Executive summary section
- Detailed breakdown with source links
- Web links section
- Processing statistics

**Interactive Elements**:
- "Get Summary" button: Triggers AI summarization
- "Archive X Emails" button: Batch archives processed emails
- Email permalinks: Click to open original emails in Gmail
- Web links: Click to visit referenced URLs

**Responsive Design**:
- Large touch targets for mobile
- Readable font sizes on all devices
- Smooth animations and feedback
- Dark mode support

## Configuration

Add these properties to Script Properties in the Apps Script editor:

| Property | Default | Description |
|----------|---------|-------------|
| `WEBAPP_ENABLED` | `true` | Enable/disable web app functionality |
| `WEBAPP_MAX_EMAILS_PER_SUMMARY` | `50` | Maximum emails to process per summary |

### Configuration Examples

**Disable web app** (only use automated Email Summarizer):
```
WEBAPP_ENABLED = false
```

**Process fewer emails** (prevent timeouts on slow connections):
```
WEBAPP_MAX_EMAILS_PER_SUMMARY = 25
```

**Process many emails** (if you have fast connection and label many emails):
```
WEBAPP_MAX_EMAILS_PER_SUMMARY = 100
```

## Troubleshooting

### Web app shows "Web app functionality is disabled"

**Solution**: Set `WEBAPP_ENABLED=true` in Script Properties

**Solution**: Redeploy the web app if the setting was changed after deployment

### "No emails found with 'summarize' label"

**Solution**: Apply the `summarize` label to some emails in Gmail first

**Solution**: Verify the label exists and is spelled correctly (all lowercase)

**Solution**: Check that you're logged into the correct Google account

### Web app times out during summarization

**Solution**: Reduce `WEBAPP_MAX_EMAILS_PER_SUMMARY` to a smaller number (try `10-25`)

**Solution**: Check API quota usage at Google Cloud Console: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas

**Solution**: Try processing fewer emails at once (unlabel some emails, process in batches)

### Archive button doesn't work

**Solution**: Ensure you've generated a summary first before trying to archive

**Solution**: Check that emails still have the `summarize` label applied

**Solution**: Verify you have permission to modify labels in Gmail

### Web app URL not working

**Solution**: Redeploy the web app and get a new URL:
```bash
npm run deploy:personal   # Redeploys and shows new URL
```

**Solution**: Check that deployment type is set to "Web app" not "API executable"

**Solution**: Verify "Who has access" is set to "Only myself" or appropriate access level

### Authorization errors

**Solution**: Clear browser cookies and re-authorize

**Solution**: Visit the web app URL while logged into the correct Google account

**Solution**: Redeploy web app and use the new URL

### Styling or display issues

**Solution**: Clear browser cache and refresh

**Solution**: Try a different browser (works best in Chrome, Safari, Firefox)

**Solution**: Check that JavaScript is enabled in your browser

## Security and Privacy

### Access Control

- **Authentication required**: Web app requires Google account login
- **Single user access**: Configured for "Only myself" by default
- **No public access**: URL is private and only works for authorized account

### Data Handling

- **No data stored**: Summaries are not saved by the web app
- **Direct Gmail access**: Reads emails directly from your Gmail
- **Gemini AI processing**: Email content sent to Google's Gemini AI for summarization
- **Session-based**: Each summary request is independent

### Security Best Practices

- **Keep URL private**: Don't share your web app URL
- **Use HTTPS**: Web app URLs always use secure HTTPS
- **Regular redeployment**: Redeploy periodically to get security updates
- **Monitor access logs**: Check Apps Script execution logs for unexpected access

## Best Practices

### When to Use Web App vs Email Summarizer

**Use Web App when**:
- You need immediate results
- Processing emails on your phone
- Quick review before a meeting
- Variable schedule (not daily processing)

**Use Email Summarizer when**:
- Regular daily summaries
- Automated background processing
- Set-it-and-forget-it approach
- Processing large batches overnight

**Use both together**:
- Web app for urgent/immediate needs
- Email Summarizer for daily digest
- Best of both worlds: automation + control

### Optimization Tips

**For faster performance**:
- Label fewer emails per summary session
- Reduce `WEBAPP_MAX_EMAILS_PER_SUMMARY` if experiencing timeouts
- Archive processed emails regularly

**For better summaries**:
- Label related emails together (e.g., all emails about one project)
- Include full email threads, not individual messages
- Use descriptive subject lines (helps AI understand context)

**For mobile usage**:
- Bookmark web app URL to home screen
- Use landscape mode for wider view
- Enable dark mode for easier reading

### Workflow Recommendations

**Daily triage** (mobile-friendly):
1. Morning: Scan Gmail, label newsletters with `summarize`
2. Commute: Open web app, get summary
3. Read summary during coffee break
4. Archive batch when done

**Project-based processing**:
1. Find all emails related to project
2. Apply `summarize` label to thread
3. Open web app, get consolidated view
4. Use for meeting prep or status updates

**Email zero workflow**:
1. Process inbox, label non-urgent emails with `summarize`
2. Deal with urgent items immediately
3. Open web app, review summary of labeled emails
4. Archive batch → Inbox zero achieved

## Technical Details

### Architecture

The web app follows the service extension pattern:

- **WebAppController.gs**: Entry point and API orchestration
- **WebApp.html**: Mobile-optimized HTML interface
- **GmailService.gs**: Gmail operations (finding emails)
- **LLMService.gs**: AI summarization
- **PromptBuilder.gs**: Prompt construction

### Deployment Details

- **Apps Script Web App**: Serverless deployment on Google's infrastructure
- **Automatic HTTPS**: All requests encrypted
- **No server management**: Google handles scaling and uptime
- **Version control**: Each deployment creates a new version

### Performance Characteristics

- **Initial load**: < 1 second (HTML served from Google's CDN)
- **Summary generation**: 5-30 seconds (depends on email count and AI processing)
- **Archive operation**: 1-5 seconds (depends on email count)
- **Concurrent users**: Supports single user per deployment

### Browser Compatibility

**Fully supported**:
- Chrome/Edge (latest)
- Safari (latest)
- Firefox (latest)
- Mobile Safari (iOS)
- Chrome Mobile (Android)

**Basic support**:
- Older browsers (may lack dark mode, animations)

## Architecture Decisions

- [ADR-008: Interactive Web App Integration](../../docs/adr/008-interactive-web-app-integration.md)
- [ADR-009: Deployment Automation](../../docs/adr/009-deployment-automation.md)

## See Also

- [Back to README](../../README.md)
- [Email Summarizer Agent](../agents/email-summarizer.md) - Automated alternative
- [Multi-Account Deployment](multi-account.md) - Deploy to multiple accounts
- [Configuration Reference](../guides/configuration.md) - All configuration options
- [Troubleshooting Guide](../guides/troubleshooting.md) - General troubleshooting
