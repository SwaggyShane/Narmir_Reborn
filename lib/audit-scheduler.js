const cron = require('node-cron');
const { EPOCH_NOW } = require('./db-sql');

const FREQUENCY_CRON_MAP = {
  daily: '0 2 * * *',     // 2 AM daily
  weekly: '0 3 * * 0',    // 3 AM Sundays
  monthly: '0 4 1 * *'    // 4 AM on the 1st of each month
};

function computeNextRunAt(frequency, fromTimestampMs = Date.now()) {
  const next = new Date(fromTimestampMs);

  switch (frequency) {
    case 'daily':
      next.setHours(2, 0, 0, 0);
      if (next.getTime() <= fromTimestampMs) {
        next.setDate(next.getDate() + 1);
      }
      break;
    case 'monthly':
      next.setDate(1);
      next.setHours(4, 0, 0, 0);
      if (next.getTime() <= fromTimestampMs) {
        next.setMonth(next.getMonth() + 1, 1);
      }
      break;
    case 'weekly':
    default: {
      next.setHours(3, 0, 0, 0);
      const daysUntilSunday = (7 - next.getDay()) % 7;
      next.setDate(next.getDate() + daysUntilSunday);
      if (next.getTime() <= fromTimestampMs) {
        next.setDate(next.getDate() + 7);
      }
      break;
    }
  }

  return Math.floor(next.getTime() / 1000);
}

class AuditScheduler {
  constructor(db) {
    this.db = db;
    this.jobs = new Map();
  }

  async initialize() {
    console.log('[audit-scheduler] Initializing audit scheduler');
    try {
      // Guard against null db (can happen if boot fails before db is ready)
      if (!this.db) {
        console.warn('[audit-scheduler] Database not available - skipping audit scheduler initialization');
        return;
      }

      // Guard against db.all being unavailable
      if (typeof this.db.all !== 'function') {
        console.error('[audit-scheduler] Database adapter missing .all() method - skipping initialization');
        return;
      }

      const schedules = await this.db.all(
        'SELECT * FROM audit_schedules WHERE is_enabled = 1'
      );

      for (const schedule of schedules) {
        try {
          await this.registerSchedule(schedule);
        } catch (err) {
          console.error(`[audit-scheduler] Error registering schedule ${schedule.id}:`, err.message);
          // Continue with other schedules even if one fails
        }
      }

      console.log(`[audit-scheduler] Initialized ${schedules.length} audit schedule(s)`);
    } catch (err) {
      console.error('[audit-scheduler] Initialization error:', err.message);
      console.error('[audit-scheduler] Continuing without audit scheduler');
      // Don't re-throw - allow boot to continue without audit scheduling
    }
  }

  async registerSchedule(schedule) {
    if (this.jobs.has(schedule.id)) {
      await this.unregisterSchedule(schedule.id);
    }

    const cronExpression = FREQUENCY_CRON_MAP[schedule.frequency] || '0 2 * * *';
    const nextRunAt = computeNextRunAt(schedule.frequency);

    const job = cron.schedule(cronExpression, async () => {
      await this.runAudit(schedule.id);
    });

    this.jobs.set(schedule.id, job);
    if (schedule.next_run_at !== nextRunAt) {
      await this.db.run(
        `UPDATE audit_schedules SET next_run_at = $1, updated_at = ${EPOCH_NOW} WHERE id = $2`,
        [nextRunAt, schedule.id]
      );
    }
    console.log(`[audit-scheduler] Registered schedule ${schedule.id} with frequency: ${schedule.frequency}`);
  }

  async runAudit(scheduleId) {
    const startTime = Date.now();
    console.log(`[audit-scheduler] Running audit for schedule ${scheduleId}`);

    try {
      const schedule = await this.db.get(
        'SELECT * FROM audit_schedules WHERE id = $1',
        [scheduleId]
      );

      if (!schedule) {
        console.warn(`[audit-scheduler] Schedule ${scheduleId} not found`);
        await this.unregisterSchedule(scheduleId);
        return;
      }

      const findings = {
        critical: [],
        high: [],
        medium: [],
        low: [],
        info: []
      };

      const findingsCount = findings.critical.length + findings.high.length +
                           findings.medium.length + findings.low.length + findings.info.length;

      await this.db.run(
        `INSERT INTO audit_history
         (schedule_id, run_at, status, findings_count, findings, duration_ms)
         VALUES ($1, ${EPOCH_NOW}, $2, $3, $4, $5)`,
        [scheduleId, 'success', findingsCount, JSON.stringify(findings), Date.now() - startTime]
      );

      await this.db.run(
        `UPDATE audit_schedules SET last_run_at = ${EPOCH_NOW}, next_run_at = $1, updated_at = ${EPOCH_NOW} WHERE id = $2`,
        [computeNextRunAt(schedule.frequency), scheduleId]
      );

      console.log(`[audit-scheduler] Audit ${scheduleId} completed in ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error(`[audit-scheduler] Audit ${scheduleId} failed:`, err);

      try {
        await this.db.run(
          `INSERT INTO audit_history
           (schedule_id, run_at, status, error_message, duration_ms)
           VALUES ($1, ${EPOCH_NOW}, $2, $3, $4)`,
          [scheduleId, 'error', err.message, Date.now() - startTime]
        );
      } catch (logErr) {
        console.error('[audit-scheduler] Failed to log audit error:', logErr);
      }
    }
  }

  async unregisterSchedule(scheduleId) {
    const job = this.jobs.get(scheduleId);
    if (job) {
      job.stop();
      job.destroy();
      this.jobs.delete(scheduleId);
      console.log(`[audit-scheduler] Unregistered schedule ${scheduleId}`);
    }
  }

  async updateSchedule(scheduleId, frequency) {
    await this.db.run(
      `UPDATE audit_schedules SET frequency = $1, next_run_at = $2, updated_at = ${EPOCH_NOW} WHERE id = $3`,
      [frequency, computeNextRunAt(frequency), scheduleId]
    );

    const schedule = await this.db.get(
      'SELECT * FROM audit_schedules WHERE id = $1',
      [scheduleId]
    );

    if (schedule) {
      await this.registerSchedule(schedule);
      console.log(`[audit-scheduler] Updated schedule ${scheduleId} to frequency: ${frequency}`);
    }
  }

  shutdown() {
    console.log('[audit-scheduler] Shutting down audit scheduler');
    for (const job of this.jobs.values()) {
      job.stop();
      job.destroy();
    }
    this.jobs.clear();
  }
}

module.exports = AuditScheduler;
module.exports.computeNextRunAt = computeNextRunAt;
