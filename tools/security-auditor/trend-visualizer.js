/**
 * Audit Trend Visualizer
 * Generates visualization data for audit findings trends over time
 */

class TrendVisualizer {
  constructor() {
    this.severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  }

  // Extract severity from finding object
  getSeverity(finding) {
    if (finding.severity) {
      return finding.severity.toUpperCase();
    }
    return 'MEDIUM';
  }

  // Parse findings JSON safely
  parseFindingsJSON(findingsStr) {
    if (!findingsStr) return [];
    try {
      const parsed = JSON.parse(findingsStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[TrendVisualizer] Failed to parse findings JSON:', err.message);
      return [];
    }
  }

  // Aggregate findings by severity
  aggregateBySeverity(findings) {
    const aggregated = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
      total: 0
    };

    findings.forEach(f => {
      const sev = this.getSeverity(f);
      if (aggregated.hasOwnProperty(sev)) {
        aggregated[sev]++;
      }
      aggregated.total++;
    });

    return aggregated;
  }

  // Generate timeseries data for charting
  generateTimeseriesData(auditHistory) {
    if (!Array.isArray(auditHistory) || auditHistory.length === 0) {
      return { data: [], message: 'No audit history available' };
    }

    // Sort by date ascending
    const sorted = auditHistory.slice().sort((a, b) => {
      return new Date(a.run_at).getTime() - new Date(b.run_at).getTime();
    });

    const data = sorted.map(audit => {
      const findings = this.parseFindingsJSON(audit.findings);
      const aggregated = this.aggregateBySeverity(findings);

      return {
        timestamp: audit.run_at,
        date: new Date(audit.run_at).toLocaleDateString(),
        time: new Date(audit.run_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        findings: aggregated,
        status: audit.status || 'unknown',
        auditId: audit.id
      };
    });

    return {
      data,
      startDate: sorted[0].run_at,
      endDate: sorted[sorted.length - 1].run_at,
      auditCount: data.length
    };
  }

  // Generate severity trend (tracking each level separately)
  generateSeverityTrend(auditHistory) {
    const timeseries = this.generateTimeseriesData(auditHistory);

    const severityData = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
      INFO: []
    };

    timeseries.data.forEach(point => {
      this.severities.forEach(sev => {
        severityData[sev].push({
          timestamp: point.timestamp,
          date: point.date,
          count: point.findings[sev],
          auditId: point.auditId
        });
      });
    });

    return {
      severityData,
      metadata: {
        auditCount: timeseries.auditCount,
        startDate: timeseries.startDate,
        endDate: timeseries.endDate
      }
    };
  }

  // Calculate trend statistics
  calculateTrendStats(auditHistory) {
    if (auditHistory.length < 2) {
      return {
        trend: 'insufficient_data',
        message: 'Need at least 2 audits for trend analysis'
      };
    }

    const sorted = auditHistory.slice().sort((a, b) => {
      return new Date(a.run_at).getTime() - new Date(b.run_at).getTime();
    });

    const oldest = this.parseFindingsJSON(sorted[0].findings);
    const latest = this.parseFindingsJSON(sorted[sorted.length - 1].findings);

    const oldestAgg = this.aggregateBySeverity(oldest);
    const latestAgg = this.aggregateBySeverity(latest);

    const criticalChange = latestAgg.CRITICAL - oldestAgg.CRITICAL;
    const highChange = latestAgg.HIGH - oldestAgg.HIGH;
    const totalChange = latestAgg.total - oldestAgg.total;

    // Determine overall trend direction
    let trend = 'stable';
    if (totalChange < -5) {
      trend = 'significantly_improving';
    } else if (totalChange < 0) {
      trend = 'improving';
    } else if (totalChange > 5) {
      trend = 'significantly_worsening';
    } else if (totalChange > 0) {
      trend = 'worsening';
    }

    return {
      trend,
      totalChange,
      criticalChange,
      highChange,
      oldestTotal: oldestAgg.total,
      latestTotal: latestAgg.total,
      auditCount: auditHistory.length,
      improvementRate: oldestAgg.total > 0 ? ((oldestAgg.total - latestAgg.total) / oldestAgg.total * 100).toFixed(1) : 0
    };
  }

  // Generate summary statistics for dashboard
  generateSummaryStats(auditHistory) {
    if (auditHistory.length === 0) {
      return {
        message: 'No audit history available',
        auditCount: 0
      };
    }

    const sorted = auditHistory.slice().sort((a, b) => {
      return new Date(a.run_at).getTime() - new Date(b.run_at).getTime();
    });

    const latest = sorted[sorted.length - 1];
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

    const latestFindings = this.parseFindingsJSON(latest.findings);
    const latestAgg = this.aggregateBySeverity(latestFindings);

    const stats = {
      latestAuditId: latest.id,
      latestAuditDate: latest.run_at,
      latestFindings: latestAgg,
      auditCount: auditHistory.length
    };

    if (previous) {
      const prevFindings = this.parseFindingsJSON(previous.findings);
      const prevAgg = this.aggregateBySeverity(prevFindings);

      stats.previousAuditDate = previous.run_at;
      stats.changeFromPrevious = {
        total: latestAgg.total - prevAgg.total,
        critical: latestAgg.CRITICAL - prevAgg.CRITICAL,
        high: latestAgg.HIGH - prevAgg.HIGH,
        medium: latestAgg.MEDIUM - prevAgg.MEDIUM
      };
    }

    return stats;
  }

  // Generate heatmap data (audit quality by date)
  generateHeatmapData(auditHistory) {
    if (auditHistory.length === 0) {
      return { data: [], message: 'No audit history available' };
    }

    const heatmapData = auditHistory.slice().sort((a, b) => {
      return new Date(a.run_at).getTime() - new Date(b.run_at).getTime();
    }).map(audit => {
      const findings = this.parseFindingsJSON(audit.findings);
      const aggregated = this.aggregateBySeverity(findings);

      // Calculate "health score" (0-100, lower findings = higher score)
      // Weighted: critical=10, high=5, medium=2, low=1, info=0
      const weightedScore = (
        aggregated.CRITICAL * 10 +
        aggregated.HIGH * 5 +
        aggregated.MEDIUM * 2 +
        aggregated.LOW * 1
      );

      // Normalize to 0-100 scale (assuming max ~100 weighted issues = 0 score)
      const healthScore = Math.max(0, 100 - Math.min(100, weightedScore));

      return {
        auditId: audit.id,
        date: new Date(audit.run_at).toLocaleDateString(),
        timestamp: audit.run_at,
        healthScore,
        findingsCount: aggregated.total,
        severity: aggregated.CRITICAL > 0 ? 'CRITICAL' : aggregated.HIGH > 0 ? 'HIGH' : 'OK'
      };
    });

    return {
      data: heatmapData,
      auditCount: heatmapData.length
    };
  }
}

module.exports = TrendVisualizer;
