# Slack Notifier Agent

The Slack Notifier is an intelligent agent that automatically sends Slack notifications when certain labels are applied to emails, enabling real-time visibility into email classification activity.

## What It Does

The Slack Notifier agent:

- **Monitors** emails labeled by the core classification system
- **Sends immediate notifications** via Slack webhook when labels are applied
- **Configurable label filtering** - notify for all labels or specific ones only
- **Rich message formatting** with email details, subject, sender, and Gmail link
- **Color-coded by label type** - visual distinction for different label categories
- **Runs automatically** during email classification (onLabel hook)
- **Graceful error handling** - failures don't break email processing
- **Respects dry-run mode** for safe testing before enabling

This agent operates automatically during the email classification process, requiring no manual intervention once configured.

## Perfect For

- **Team visibility**: Keep team members informed about important email classifications
- **Urgent alerts**: Get notified immediately when critical emails are labeled
- **Workflow integration**: Connect Gmail labeling to Slack workflows and channels
- **Activity monitoring**: Track email classification activity in real-time
- **Multiple account management**: Monitor email processing across different accounts

## Quick Start

### Prerequisites

- Complete the [basic email labeling setup](../../README.md#setup-guide) first
- Slack Notifier is disabled by default (`SLACK_ENABLED=false`)
- Core labeling system must be running to apply labels
- **Required**: Slack webhook URL (`SLACK_WEBHOOK_URL`)

### Setup Steps

1. **Create Slack webhook**:
   - Go to your Slack workspace settings
   - Navigate to Apps → Incoming Webhooks
   - Click "Add to Slack"
   - Choose a channel for notifications (or use default)
   - Copy the webhook URL (looks like `https://hooks.slack.com/services/...`)

2. **Configure Slack Notifier**:
   - In Apps Script editor, go to "Project Settings" → "Script properties"
   - Add property: `SLACK_WEBHOOK_URL` = your webhook URL from step 1
   - Add property: `SLACK_ENABLED` = `true`
   - This is the minimal configuration - notifications will be sent for all labels

3. **Optional: Filter by label**:
   - To notify only for specific labels, add: `SLACK_LABELS` = `["reply_needed","todo"]`
   - Use JSON array format: `["label1","label2"]`
   - Leave unset to notify for all labels (`reply_needed`, `review`, `todo`, `summarize`)

4. **Optional: Customize appearance**:
   - `SLACK_USERNAME`: Bot username (default: "Email Agent")
   - `SLACK_CHANNEL`: Override channel (e.g., `#email-alerts`)
   - `SLACK_ICON_EMOJI`: Emoji icon (default: `:email:`)

5. **Test the agent**:
   - Enable debug mode: `SLACK_DEBUG=true`
   - Enable dry-run mode: `DRY_RUN=true` (in global config)
   - Run the core email labeling process (or wait for hourly trigger)
   - Check execution logs for "Slack Notifier" messages
   - Verify notifications appear in Slack channel
   - Disable dry-run once testing confirms behavior

## How It Works

### onLabel Hook Architecture

The Slack Notifier uses the **onLabel hook** to send immediate notifications:

- **Trigger**: Email is labeled during classification
- **Timing**: Immediately after labeling completes during `Organizer.apply_()`
- **Coverage**: All emails that receive labels during classification
- **Use case**: Real-time notifications as emails are processed

### Workflow

1. **Email Classification**:
   - Core system analyzes email and decides on label (`reply_needed`, `review`, `todo`, `summarize`)
   - Label is applied to email thread

2. **Agent Trigger**:
   - `onLabel` hook fires with context (label, thread, decision, etc.)
   - Slack Notifier checks if it should notify for this label
   - If enabled and label matches filter, proceeds to notification

3. **Message Formatting**:
   - Extracts email details (subject, from, thread ID)
   - Formats Slack message with attachments
   - Adds color coding based on label type
   - Includes Gmail link for easy access

4. **Notification Delivery**:
   - Sends HTTP POST request to Slack webhook URL
   - Slack displays formatted message in configured channel
   - Error handling ensures failures don't break email processing

### Label Filtering

The `SLACK_LABELS` property controls which labels trigger notifications:

- **Not set** (default): Notifies for all labels
  ```
  SLACK_ENABLED = true
  SLACK_WEBHOOK_URL = https://hooks.slack.com/services/...
  ```
  Result: Notifications for `reply_needed`, `review`, `todo`, `summarize`

- **Empty array**: Disables notifications
  ```
  SLACK_LABELS = []
  ```
  Result: No notifications (even if `SLACK_ENABLED=true`)

- **Specific labels**: Only notify for listed labels
  ```
  SLACK_LABELS = ["reply_needed","todo"]
  ```
  Result: Only notifications for `reply_needed` and `todo` labels

## Configuration Reference

### Required Properties

| Property | Description |
|----------|-------------|
| `SLACK_ENABLED` | Enable/disable agent (default: `false`) |
| `SLACK_WEBHOOK_URL` | Slack webhook URL (required - agent disabled if not set) |

### Optional Properties

| Property | Default | Description |
|----------|---------|-------------|
| `SLACK_LABELS` | All labels | JSON array of labels to notify about |
| `SLACK_USERNAME` | `Email Agent` | Bot username for Slack messages |
| `SLACK_CHANNEL` | Webhook default | Override channel (e.g., `#email-alerts`) |
| `SLACK_ICON_EMOJI` | `:email:` | Emoji icon for bot messages |
| `SLACK_DEBUG` | `false` | Enable detailed logging |

### Configuration Examples

**Minimal setup** (notify for all labels):
```
SLACK_WEBHOOK_URL = https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ENABLED = true
```

**Selective notifications** (only urgent labels):
```
SLACK_WEBHOOK_URL = https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ENABLED = true
SLACK_LABELS = ["reply_needed","todo"]
```

**Custom channel and username**:
```
SLACK_WEBHOOK_URL = https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ENABLED = true
SLACK_LABELS = ["reply_needed"]
SLACK_CHANNEL = #urgent-emails
SLACK_USERNAME = Gmail Labeler
```

**Debug mode**:
```
SLACK_WEBHOOK_URL = https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ENABLED = true
SLACK_DEBUG = true
```

## Message Format

Slack notifications include:

- **Main message**: "📧 Email labeled: [label]"
- **Subject**: Email subject line
- **From**: Sender email address
- **Label**: Classification label applied
- **Link**: Direct link to Gmail thread
- **Reason**: AI classification reason (if available)

Color coding:
- `reply_needed`: Red (danger)
- `todo`: Yellow (warning)
- `review`: Green (good)
- `summarize`: Green (good)

## Troubleshooting

### Notifications not appearing in Slack

**Check configuration**:
1. Verify `SLACK_ENABLED=true` in Script Properties
2. Verify `SLACK_WEBHOOK_URL` is set correctly
3. Check that webhook URL is valid and active
4. Verify webhook hasn't been revoked in Slack

**Check label filtering**:
1. If `SLACK_LABELS` is set, verify it includes the labels being applied
2. If `SLACK_LABELS=[]`, notifications are disabled even if `SLACK_ENABLED=true`
3. Check execution logs for "label not in SLACK_LABELS filter" messages

**Check execution logs**:
1. Enable `SLACK_DEBUG=true` for detailed logging
2. Check Apps Script execution logs for "Slack Notifier" messages
3. Look for error messages indicating webhook failures

### Notifications appearing too frequently

**Solution**: Use `SLACK_LABELS` to filter to specific labels:
```
SLACK_LABELS = ["reply_needed"]
```

### Notifications failing silently

**Solution**: Enable debug mode to see errors:
```
SLACK_DEBUG = true
```

Check logs for HTTP errors or webhook issues.

### Dry-run mode not working

**Note**: Dry-run mode respects global `DRY_RUN` setting. If `DRY_RUN=true`, Slack Notifier will skip actual webhook calls but log what it would send.

## Advanced Usage

### Multiple Channel Notifications

If you need notifications in different channels for different labels, you can:
1. Create multiple webhooks, each pointing to different channels
2. Use multiple Slack Notifier instances (requires code modification)
3. Use Slack's webhook default channel and route via Slack rules

### Rate Limiting

Slack webhooks have rate limits. If processing many emails:
- Consider using `SLACK_LABELS` to filter to important labels only
- Monitor Slack API rate limit responses
- Future enhancement: Batch notifications via `postLabel` hook

### Custom Message Formatting

The current implementation uses Slack's standard attachment format. For richer formatting:
- Use Slack Blocks API (requires code modification)
- Customize `formatSlackMessage_()` function in `AgentSlackNotifier.gs`

## Related Documentation

- [Configuration Guide](../guides/configuration.md) - Complete configuration reference
- [Agent Architecture](../../docs/adr/011-self-contained-agents.md) - Self-contained agent pattern
- [Dual-Hook Architecture](../../docs/adr/018-dual-hook-agent-architecture.md) - Hook system overview

## Implementation Details

### Self-Contained Architecture

The Slack Notifier follows the self-contained agent pattern (ADR-011):
- Manages own configuration via `getSlackNotifierConfig_()`
- No changes to core `Config.gs` required
- Can be enabled/disabled without affecting other agents

### Error Handling

The agent implements graceful error handling:
- Webhook failures don't break email processing
- Errors are logged but don't throw exceptions
- Returns status codes compatible with agent framework

### No Idempotency Needed

Notifications are side effects, not stateful operations:
- Each labeling event triggers a notification
- Re-labeling the same email triggers another notification
- No duplicate tracking needed

### HTTP Implementation

Uses Apps Script's `UrlFetchApp.fetch()` for webhook calls:
- Standard HTTP POST requests
- JSON payload format
- Error handling for HTTP errors and timeouts

