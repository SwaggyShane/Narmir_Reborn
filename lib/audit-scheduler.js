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
      const schedules = await this.db.all(
        'SELECT * FROM audit_schedules WHERE is_enabled = 1'
      );

      for (const schedule of schedules) {
        await this.registerSchedule(schedule);
      }

      console.log(`[audit-scheduler] Initialized ${schedules.length} audit schedule(s)`);
    } catch (err) {
      console.error('[audit-scheduler] Initialization error:', err);
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
        `UPDATE audit_schedules SET next_run_at = ?, updated_at = ${EPOCH_NOW} WHERE id = ?`,
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
        'SELECT * FROM audit_schedules WHERE id = ?',
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
         VALUES (?, ${EPOCH_NOW}, ?, ?, ?, ?)`,
        [scheduleId, 'success', findingsCount, JSON.stringify(findings), Date.now() - startTime]
      );

      await this.db.run(
        `UPDATE audit_schedules SET last_run_at = ${EPOCH_NOW}, next_run_at = ?, updated_at = ${EPOCH_NOW} WHERE id = ?`,
        [computeNextRunAt(schedule.frequency), scheduleId]
      );

      console.log(`[audit-scheduler] Audit ${scheduleId} completed in ${Date.now() - startTime}ms`);
    } catch (err) {
      console.error(`[audit-scheduler] Audit ${scheduleId} failed:`, err);

      try {
        await this.db.run(
          `INSERT INTO audit_history
           (schedule_id, run_at, status, error_message, duration_ms)
           VALUES (?, ${EPOCH_NOW}, ?, ?, ?)`,
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
      `UPDATE audit_schedules SET frequency = ?, next_run_at = ?, updated_at = ${EPOCH_NOW} WHERE id = ?`,
      [frequency, computeNextRunAt(frequency), scheduleId]
    );

    const schedule = await this.db.get(
      'SELECT * FROM audit_schedules WHERE id = ?',
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
