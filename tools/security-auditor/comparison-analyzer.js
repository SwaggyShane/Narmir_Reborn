/**
 * Audit Comparison Analyzer
 * Compares two audit runs to identify new, resolved, and persistent findings
 */

class ComparisonAnalyzer {
  constructor() {
    this.findings = {};
  }

  // Create a unique key for a finding (file + line + issue type)
  findingKey(finding) {
    return `${finding.file}:${finding.line || 0}:${finding.type || finding.issue}`;
  }

  // Convert findings array to Map for comparison
  findingsToMap(findings) {
    const map = new Map();
    if (Array.isArray(findings)) {
      findings.forEach(f => {
        const key = this.findingKey(f);
        map.set(key, f);
      });
    }
    return map;
  }

  // Compare two audit results
  compare(previousFindings, currentFindings) {
    const prevMap = this.findingsToMap(previousFindings);
    const currMap = this.findingsToMap(currentFindings);

    const comparison = {
      new: [],
      resolved: [],
      persistent: [],
      stats: {
        previousTotal: prevMap.size,
        currentTotal: currMap.size,
        newCount: 0,
        resolvedCount: 0,
        persistentCount: 0
      }
    };

    // Find new findings
    for (const [key, finding] of currMap) {
      if (!prevMap.has(key)) {
        comparison.new.push(finding);
        comparison.stats.newCount++;
      }
    }

    // Find resolved findings
    for (const [key, finding] of prevMap) {
      if (!currMap.has(key)) {
        comparison.resolved.push(finding);
        comparison.stats.resolvedCount++;
      }
    }

    // Find persistent findings
    for (const [key, finding] of currMap) {
      if (prevMap.has(key)) {
        comparison.persistent.push(finding);
        comparison.stats.persistentCount++;
      }
    }

    return comparison;
  }

  // Generate comparison report
  generateComparisonReport(comparison, previousTimestamp, currentTimestamp) {
    return this.formatComparisonReport(comparison, previousTimestamp, currentTimestamp);
  }

  // Format comparison as markdown report
  formatComparisonReport(comparison, previousTimestamp, currentTimestamp) {
    const prevDate = new Date(previousTimestamp).toLocaleString();
    const currDate = new Date(currentTimestamp).toLocaleString();

    let report = `# Audit Comparison Report\n\n`;
    report += `**Previous Audit:** ${prevDate}\n`;
    report += `**Current Audit:** ${currDate}\n`;
    report += `**Time Between Audits:** ${this.formatTimeDifference(previousTimestamp, currentTimestamp)}\n\n`;

    report += `## Summary\n`;
    report += `- 📊 **Previous Total:** ${comparison.stats.previousTotal} findings\n`;
    report += `- 📊 **Current Total:** ${comparison.stats.currentTotal} findings\n`;
    report += `- ✨ **New Issues:** ${comparison.stats.newCount}\n`;
    report += `- ✅ **Resolved Issues:** ${comparison.stats.resolvedCount}\n`;
    report += `- ⚠️ **Persistent Issues:** ${comparison.stats.persistentCount}\n\n`;

    const improvement = comparison.stats.resolvedCount - comparison.stats.newCount;
    const improvementText = improvement > 0 ? `✅ **Net Improvement:** +${improvement} issues resolved` : improvement < 0 ? `⚠️ **Net Regression:** ${improvement} new issues` : `➡️ **Net Change:** No change`;
    report += `${improvementText}\n\n`;

    if (comparison.new.length > 0) {
      report += `---\n## ✨ New Issues (${comparison.new.length})\n`;
      report += this.formatFindingsList(comparison.new);
    }

    if (comparison.resolved.length > 0) {
      report += `---\n## ✅ Resolved Issues (${comparison.resolved.length})\n`;
      report += `Great progress! These issues have been fixed:\n\n`;
      report += this.formatFindingsList(comparison.resolved);
    }

    if (comparison.persistent.length > 0) {
      const critical = comparison.persistent.filter(f => f.severity === 'CRITICAL' || f.severity === 'critical').length;
      const high = comparison.persistent.filter(f => f.severity === 'HIGH' || f.severity === 'high').length;
      report += `---\n## ⚠️ Persistent Issues (${comparison.persistent.length})\n`;
      report += `These issues were present in both audits (${critical} critical, ${high} high):\n\n`;

      const bySeverity = {};
      comparison.persistent.forEach(f => {
        const sev = f.severity?.toUpperCase() || 'MEDIUM';
        if (!bySeverity[sev]) bySeverity[sev] = [];
        bySeverity[sev].push(f);
      });

      for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']) {
        if (bySeverity[severity]) {
          report += `### ${severity} (${bySeverity[severity].length})\n`;
          bySeverity[severity].slice(0, 5).forEach((f, i) => {
            report += `${i + 1}. **${f.issue}** - \`${f.file}:${f.line || '?'}\`\n`;
          });
          if (bySeverity[severity].length > 5) {
            report += `... and ${bySeverity[severity].length - 5} more\n`;
          }
          report += `\n`;
        }
      }
    }

    report += `---\n`;
    report += `## Recommendation\n`;
    if (comparison.stats.newCount === 0 && comparison.stats.resolvedCount > 0) {
      report += `🎉 Excellent! No new issues detected and ${comparison.stats.resolvedCount} were resolved. Keep maintaining this quality.\n`;
    } else if (comparison.stats.newCount > 0) {
      report += `⚠️ ${comparison.stats.newCount} new issue(s) detected. Review and address these before the next audit cycle.\n`;
    } else if (comparison.stats.persistentCount > 0) {
      report += `📋 Focus on resolving the ${comparison.stats.persistentCount} persistent issue(s) to improve code quality.\n`;
    } else {
      report += `✅ No findings. Audit shows clean codebase.\n`;
    }

    return report;
  }

  // Format findings list for report
  formatFindingsList(findings) {
    const bySeverity = {};
    findings.forEach(f => {
      const sev = f.severity?.toUpperCase() || 'MEDIUM';
      if (!bySeverity[sev]) bySeverity[sev] = [];
      bySeverity[sev].push(f);
    });

    let output = '';
    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']) {
      if (bySeverity[severity]) {
        output += `### ${severity} (${bySeverity[severity].length})\n`;
        bySeverity[severity].slice(0, 10).forEach((f, i) => {
          output += `${i + 1}. **${f.issue}** - \`${f.file}:${f.line || '?'}\`\n`;
          if (f.message) output += `   ${f.message}\n`;
        });
        if (bySeverity[severity].length > 10) {
          output += `... and ${bySeverity[severity].length - 10} more\n`;
        }
        output += `\n`;
      }
    }
    return output;
  }

  // Format time difference nicely
  formatTimeDifference(timestamp1, timestamp2) {
    const t1 = new Date(timestamp1).getTime();
    const t2 = new Date(timestamp2).getTime();
    const diffMs = Math.abs(t2 - t1);

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  // Get trend summary (comparing multiple audits)
  getTrendSummary(auditHistory) {
    if (auditHistory.length < 2) {
      return { trend: 'insufficient_data', message: 'Need at least 2 audits for trend analysis' };
    }

    const sorted = auditHistory.slice().sort((a, b) => new Date(a.run_at) - new Date(b.run_at));
    const latestCount = sorted[sorted.length - 1].findings_count || 0;
    const previousCount = sorted[sorted.length - 2].findings_count || 0;
    const oldestCount = sorted[0].findings_count || 0;

    const recentChange = latestCount - previousCount;
    const overallChange = latestCount - oldestCount;
    const direction = recentChange < 0 ? 'improving' : recentChange > 0 ? 'worsening' : 'stable';

    return {
      trend: direction,
      recentChange,
      overallChange,
      latestCount,
      previousCount,
      oldestCount,
      auditCount: auditHistory.length
    };
  }
}

module.exports = ComparisonAnalyzer;
