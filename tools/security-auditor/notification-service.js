/**
 * Audit Notification Service
 * Sends notifications when new security audit issues are detected
 */

const fetch = require('node-fetch');

class NotificationService {
  constructor() {
    this.discordBotToken = process.env.DISCORD_BOT_TOKEN;
    this.discordWebhookUrl = process.env.DISCORD_UPDATES_WEBHOOK_URL;
  }

  // Send notification via Discord webhook
  async sendDiscordNotification(newIssuesCount, severityBreakdown) {
    if (!this.discordWebhookUrl) {
      console.log('[NotificationService] Discord webhook URL not configured, skipping notification');
      return false;
    }

    try {
      const criticalCount = severityBreakdown.CRITICAL || 0;
      const highCount = severityBreakdown.HIGH || 0;
      const mediumCount = severityBreakdown.MEDIUM || 0;

      // Build emoji for severity level
      let severityEmoji = '🟢';
      if (criticalCount > 0) severityEmoji = '🔴';
      else if (highCount > 0) severityEmoji = '🟠';
      else if (mediumCount > 0) severityEmoji = '🟡';

      const fields = [];

      if (newIssuesCount > 0) {
        fields.push({
          name: '📊 New Issues Found',
          value: `${newIssuesCount} new finding${newIssuesCount !== 1 ? 's' : ''}`,
          inline: true
        });
      }

      if (criticalCount > 0) {
        fields.push({
          name: '🔴 Critical',
          value: criticalCount.toString(),
          inline: true
        });
      }

      if (highCount > 0) {
        fields.push({
          name: '🟠 High',
          value: highCount.toString(),
          inline: true
        });
      }

      if (mediumCount > 0) {
        fields.push({
          name: '🟡 Medium',
          value: mediumCount.toString(),
          inline: true
        });
      }

      const embed = {
        title: `${severityEmoji} Security Audit: New Issues Detected`,
        color: criticalCount > 0 ? 0xFF0000 : highCount > 0 ? 0xFF9900 : mediumCount > 0 ? 0xFFCC00 : 0x00CC00,
        description: `A scheduled security audit has detected ${newIssuesCount} new issue${newIssuesCount !== 1 ? 's' : ''}.`,
        fields,
        footer: {
          text: 'Narmir Reborn Security Auditor',
          icon_url: 'https://img.icons8.com/color/96/000000/security-checked.png'
        },
        timestamp: new Date().toISOString()
      };

      const payload = {
        embeds: [embed],
        username: 'Security Auditor',
        avatar_url: 'https://img.icons8.com/color/96/000000/security-checked.png'
      };

      const response = await fetch(this.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error(`[NotificationService] Discord webhook failed: ${response.status} ${response.statusText}`);
        return false;
      }

      console.log(`[NotificationService] Discord notification sent for ${newIssuesCount} new issue(s)`);
      return true;
    } catch (err) {
      console.error('[NotificationService] Discord notification error:', err.message);
      return false;
    }
  }

  // Determine if notification should be sent based on settings
  shouldNotifyOnNewIssues(config) {
    if (!config) return true;
    return config.notify_on_new_issues !== false;
  }

  // Determine severity threshold for notifications
  getSeverityThreshold(config) {
    if (!config || !config.min_severity) return 'LOW';
    return config.min_severity;
  }

  // Check if findings meet severity threshold
  meetsSeverityThreshold(findings, threshold) {
    const severityLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const thresholdIndex = severityLevels.indexOf(threshold);

    return findings.some(f => {
      const findingSeverity = (f.severity || 'MEDIUM').toUpperCase();
      const findingIndex = severityLevels.indexOf(findingSeverity);
      return findingIndex >= 0 && findingIndex <= thresholdIndex;
    });
  }

  // Get summary of new issues by severity
  getSeveritySummary(newFindings) {
    const summary = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
      total: newFindings.length
    };

    newFindings.forEach(f => {
      const severity = (f.severity || 'MEDIUM').toUpperCase();
      if (summary.hasOwnProperty(severity)) {
        summary[severity]++;
      }
    });

    return summary;
  }

  // Format notification message for email (if needed in future)
  formatEmailNotification(newIssuesCount, severityBreakdown) {
    const criticalCount = severityBreakdown.CRITICAL || 0;
    const highCount = severityBreakdown.HIGH || 0;
    const mediumCount = severityBreakdown.MEDIUM || 0;

    return `
Security Audit Alert: New Issues Detected

A scheduled security audit has found ${newIssuesCount} new issue(s):
- Critical: ${criticalCount}
- High: ${highCount}
- Medium: ${mediumCount}

Please review the security audit dashboard for details.
    `.trim();
  }
}

module.exports = NotificationService;
