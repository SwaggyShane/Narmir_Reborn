'use strict';

// Security audit tooling (codebase scans, SQL injection scanner), JSON
// repair, and audit notification/schedule management — split out of
// routes/admin.js (A2-9, 2026-07-19). requireAdmin + CSRF are applied once
// by the composer (routes/admin.js) before this router is mounted.

const express = require('express');
const path = require('path');
const { computeNextRunAt } = require('../lib/audit-scheduler');
const { EPOCH_NOW } = require('../lib/db-sql');

const AUDIT_FREQUENCIES = new Set(["daily", "weekly", "monthly"]);

const router = express.Router();

module.exports = function (db) {

  router.post("/security-audit", async (req, res) => {
    try {
      const AuditReportGenerator = require("../tools/security-auditor/report-generator");
      const generator = new AuditReportGenerator(path.join(__dirname, ".."));

      const analysis = generator.analyzer.analyzeProject(['index.js', 'database.js', 'config.js']);
      const findings = generator.compileFinding(analysis);

      const allFindings = [
        ...findings.critical,
        ...findings.high,
        ...findings.medium,
        ...findings.low,
        ...findings.info
      ];

      const summary = {
        critical: findings.critical.length,
        high: findings.high.length,
        medium: findings.medium.length,
        low: findings.low.length,
        info: findings.info.length
      };

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        summary,
        findings: allFindings
      });
    } catch (err) {
      console.error("[admin] Security audit error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  router.post("/security-audit-full", async (req, res) => {
    try {
      const AuditReportGenerator = require("../tools/security-auditor/report-generator");
      const NotificationService = require("../tools/security-auditor/notification-service");
      const ComparisonAnalyzer = require("../tools/security-auditor/comparison-analyzer");

      const generator = new AuditReportGenerator(path.join(__dirname, ".."));
      const result = await generator.generateFullCodebaseReport();
      const allFindings = [
        ...result.findings.critical,
        ...result.findings.high,
        ...result.findings.medium,
        ...result.findings.low,
        ...result.findings.info
      ];

      // Save audit results to database
      const findingsJson = JSON.stringify(allFindings);
      const timestamp = new Date().toISOString();
      const auditId = await db.run(
        "INSERT INTO audit_history (run_at, findings, findings_count, status) VALUES ($1, $2, $3, $4)",
        [timestamp, findingsJson, allFindings.length, 'completed']
      ).then(stmt => stmt.lastID || null).catch(err => {
        console.error("[audit] Failed to save audit history:", err);
        return null;
      });

      // Compare with previous audit and send notifications
      let comparisonData = null;
      if (auditId) {
        try {
          const previousAudit = await db.get(
            "SELECT id, run_at, findings FROM audit_history WHERE id < $1 ORDER BY id DESC LIMIT 1",
            [auditId]
          );

          if (previousAudit) {
            const analyzer = new ComparisonAnalyzer();
            let previousFindings = [];
            try {
              previousFindings = JSON.parse(previousAudit.findings || '[]');
            } catch (e) {
              console.warn("[audit] Failed to parse previous findings:", e.message);
            }

            comparisonData = analyzer.compare(previousFindings, allFindings);

            // Send notifications for new issues
            if (comparisonData.new.length > 0) {
              const notificationSettings = await db.get(
                "SELECT notify_on_new_issues, min_severity FROM audit_notification_settings LIMIT 1"
              );

              if (notificationSettings && notificationSettings.notify_on_new_issues) {
                const notifier = new NotificationService();
                const severitySummary = notifier.getSeveritySummary(comparisonData.new);
                const shouldNotify = notifier.meetsSeverityThreshold(
                  comparisonData.new,
                  notificationSettings.min_severity || 'MEDIUM'
                );

                if (shouldNotify) {
                  notifier.sendDiscordNotification(
                    comparisonData.new.length,
                    severitySummary,
                    comparisonData.stats
                  ).catch(err => {
                    console.error("[audit] Background notification failed:", err);
                  });
                }
              }
            }
          }
        } catch (comparisonErr) {
          console.error("[audit] Comparison/notification error:", comparisonErr.message);
        }
      }

      res.json({
        success: true,
        auditId,
        timestamp,
        filesAnalyzed: result.stats.totalFiles,
        stats: result.stats,
        summary: {
          critical: result.findings.critical.length,
          high: result.findings.high.length,
          medium: result.findings.medium.length,
          low: result.findings.low.length,
          info: result.findings.info.length,
          total: allFindings.length
        },
        findings: allFindings.slice(0, 100),
        totalFindingsAvailable: allFindings.length,
        message: allFindings.length > 100 ? `Showing first 100 of ${allFindings.length} findings` : undefined,
        comparison: comparisonData
      });
    } catch (err) {
      console.error("[admin] Full codebase audit error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  router.post("/repair-json-rows", async (req, res) => {
    try {
      const { repairJsonRows } = require("../db/schema");

      const startTime = Date.now();
      const result = await repairJsonRows(db);
      const duration = Date.now() - startTime;

      console.log(`[admin] JSON repair complete: ${result.fixedRows} rows, ${result.fixedCells} cells fixed in ${duration}ms`);

      res.json({
        success: true,
        message: "JSON corruption repair completed",
        fixedRows: result.fixedRows,
        fixedCells: result.fixedCells,
        details: result.details,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("[admin] JSON repair error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  router.get("/repair-json-rows/status", async (req, res) => {
    try {
      res.json({
        success: true,
        message: "JSON repair endpoint ready",
        tables: [
          "kingdoms",
          "alliances",
          "heroes",
          "resource_expeditions"
        ],
        description: "POST /api/admin/repair-json-rows to scan and repair corrupted JSON in these tables",
        note: "This operation scans all rows and fixes invalid JSON, double-encoded strings, and type mismatches. Safe to run multiple times.",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("[admin] JSON repair status error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  router.get("/audit-notifications/settings", async (req, res) => {
    try {
      const settings = await db.get(
        "SELECT id, notify_on_new_issues, min_severity, discord_channel_id, updated_at FROM audit_notification_settings LIMIT 1"
      );

      if (!settings) {
        return res.json({
          success: true,
          settings: {
            notify_on_new_issues: true,
            min_severity: 'MEDIUM',
            discord_channel_id: null
          }
        });
      }

      res.json({
        success: true,
        settings
      });
    } catch (err) {
      console.error("[admin] Error fetching notification settings:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  router.post("/audit-notifications/settings", async (req, res) => {
    try {
      const { notify_on_new_issues, min_severity, discord_channel_id } = req.body;

      const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      const severity = min_severity && validSeverities.includes(min_severity) ? min_severity : 'MEDIUM';

      // Update or insert settings
      const existing = await db.get("SELECT id FROM audit_notification_settings LIMIT 1");
      if (existing) {
        await db.run(
          "UPDATE audit_notification_settings SET notify_on_new_issues = $1, min_severity = $2, discord_channel_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
          [notify_on_new_issues ? true : false, severity, discord_channel_id || null, existing.id]
        );
      } else {
        await db.run(
          "INSERT INTO audit_notification_settings (notify_on_new_issues, min_severity, discord_channel_id, created_at, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          [notify_on_new_issues ? true : false, severity, discord_channel_id || null]
        );
      }

      res.json({
        success: true,
        message: "Notification settings updated",
        settings: {
          notify_on_new_issues: !!notify_on_new_issues,
          min_severity: severity,
          discord_channel_id: discord_channel_id || null
        }
      });
    } catch (err) {
      console.error("[admin] Error updating notification settings:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  router.get("/audit-notifications/recent", async (req, res) => {
    try {
      let limit = parseInt(req.query.limit || "10", 10);
      if (isNaN(limit) || limit <= 0) {
        limit = 10;
      }

      const audits = await db.all(
        "SELECT id, run_at, findings_count FROM audit_history ORDER BY run_at DESC LIMIT $1",
        [Math.min(limit, 100)]
      );

      res.json({
        success: true,
        audits
      });
    } catch (err) {
      console.error("[admin] Error fetching audit history:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  router.get("/audit-schedules", async (_req, res) => {
    try {
      const schedules = await db.all(
        `SELECT id, created_by, frequency, is_enabled, next_run_at, last_run_at, created_at, updated_at
         FROM audit_schedules
         ORDER BY is_enabled DESC, created_at DESC`
      );
      res.json(schedules);
    } catch (err) {
      console.error("[admin] Audit schedule fetch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/audit-schedules", async (req, res) => {
    try {
      const frequency = String(req.body?.frequency || "weekly").toLowerCase();
      if (!AUDIT_FREQUENCIES.has(frequency)) {
        return res.status(400).json({ error: "Invalid audit frequency" });
      }

      const result = await db.run(
        `INSERT INTO audit_schedules (created_by, frequency, is_enabled, next_run_at, created_at, updated_at)
         VALUES ($1, $2, 1, $3, ${EPOCH_NOW}, ${EPOCH_NOW})`,
        [req.player.playerId, frequency, computeNextRunAt(frequency)]
      );

      const schedule = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [result.lastID]);
      if (global._audit_scheduler) {
        await global._audit_scheduler.registerSchedule(schedule);
      }

      res.status(201).json(schedule);
    } catch (err) {
      console.error("[admin] Audit schedule create error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/audit-schedules/:id", async (req, res) => {
    try {
      const scheduleId = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
        return res.status(400).json({ error: "Invalid schedule id" });
      }

      const schedule = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [scheduleId]);
      if (!schedule) {
        return res.status(404).json({ error: "Audit schedule not found" });
      }

      const nextFrequency = req.body?.frequency
        ? String(req.body.frequency).toLowerCase()
        : schedule.frequency;
      if (!AUDIT_FREQUENCIES.has(nextFrequency)) {
        return res.status(400).json({ error: "Invalid audit frequency" });
      }

      const nextEnabled = req.body?.is_enabled === undefined
        ? schedule.is_enabled
        : (req.body.is_enabled ? 1 : 0);

      const nextRunAt = nextEnabled ? computeNextRunAt(nextFrequency) : null;

      await db.run(
        `UPDATE audit_schedules
         SET frequency = $1, is_enabled = $2, next_run_at = $3, updated_at = ${EPOCH_NOW}
         WHERE id = $4`,
        [nextFrequency, nextEnabled, nextRunAt, scheduleId]
      );

      const updated = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [scheduleId]);
      if (global._audit_scheduler) {
        if (updated.is_enabled) {
          await global._audit_scheduler.registerSchedule(updated);
        } else {
          await global._audit_scheduler.unregisterSchedule(scheduleId);
        }
      }

      res.json(updated);
    } catch (err) {
      console.error("[admin] Audit schedule update error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/audit-schedules/:id/run", async (req, res) => {
    try {
      const scheduleId = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
        return res.status(400).json({ error: "Invalid schedule id" });
      }

      const schedule = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [scheduleId]);
      if (!schedule) {
        return res.status(404).json({ error: "Audit schedule not found" });
      }

      if (global._audit_scheduler) {
        await global._audit_scheduler.runAudit(scheduleId);
      } else {
        await db.run(
          `INSERT INTO audit_history
           (schedule_id, run_at, status, findings_count, findings, duration_ms)
           VALUES ($1, ${EPOCH_NOW}, 'success', 0, $2, 0)`,
          [scheduleId, JSON.stringify({ critical: [], high: [], medium: [], low: [], info: [] })]
        );
        await db.run(
          `UPDATE audit_schedules SET last_run_at = ${EPOCH_NOW}, next_run_at = $1, updated_at = ${EPOCH_NOW} WHERE id = $2`,
          [computeNextRunAt(schedule.frequency), scheduleId]
        );
      }

      const updated = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [scheduleId]);
      res.json(updated);
    } catch (err) {
      console.error("[admin] Audit run error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/audit-history", async (_req, res) => {
    try {
      const history = await db.all(
        "SELECT * FROM audit_history ORDER BY run_at DESC LIMIT 50"
      );
      res.json(history);
    } catch (err) {
      console.error("[admin] Audit history fetch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/security-audit/sql-injection", async (req, res) => {
    try {
      const SQLInjectionAnalyzer = require("../tools/security-auditor/sql-injection-analyzer");
      const analyzer = new SQLInjectionAnalyzer();

      const startTime = Date.now();
      const findings = await analyzer.scanDirectory(path.join(__dirname, ".."));
      const duration = Date.now() - startTime;

      const bySeverity = {
        CRITICAL: [],
        HIGH: [],
        MEDIUM: [],
        LOW: []
      };

      findings.forEach(f => {
        const severity = f.severity || 'MEDIUM';
        if (bySeverity[severity]) {
          bySeverity[severity].push(f);
        }
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        summary: {
          critical: bySeverity.CRITICAL.length,
          high: bySeverity.HIGH.length,
          medium: bySeverity.MEDIUM.length,
          low: bySeverity.LOW.length,
          total: findings.length
        },
        findings: findings.slice(0, 100),
        totalFindingsAvailable: findings.length,
        message: findings.length > 100 ? `Showing first 100 of ${findings.length} findings` : undefined
      });
    } catch (err) {
      console.error("[admin] SQL injection audit error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  router.get("/security-audit/sql-injection/status", async (req, res) => {
    try {
      res.json({
        success: true,
        message: "SQL injection scanner ready",
        description: "Scans codebase for SQL injection vulnerabilities including string concatenation, template literals, and unsafe dynamic queries",
        patterns: [
          "Direct string concatenation in SQL queries",
          "Template literals with variables",
          "Unsafe db.run/db.get/db.all with concatenation",
          "Dynamic SQL keyword concatenation",
          "Object property concatenation in queries"
        ],
        recommendations: [
          "Use parameterized queries with ? placeholders",
          "Use named parameters (:name) for clarity",
          "Never concatenate user input directly",
          "Validate all user inputs",
          "Use ORM or query builder libraries",
          "Implement input whitelisting"
        ],
        endpoint: "POST /api/admin/security-audit/sql-injection",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("[admin] SQL injection scanner status error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  return router;
};
