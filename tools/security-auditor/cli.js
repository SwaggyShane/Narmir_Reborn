#!/usr/bin/env node

const AuditReportGenerator = require('./report-generator');
const path = require('path');

const projectPath = process.argv[2] || path.join(__dirname, '../../');
const mode = process.argv[3] || 'quick'; // 'quick' or 'full'

console.log(`🔍 Analyzing: ${projectPath}`);
console.log(`📋 Mode: ${mode === 'full' ? 'Full Codebase Scan' : 'Quick Scan'}\n`);

(async () => {
  try {
    const generator = new AuditReportGenerator(projectPath);

    if (mode === 'full') {
      console.log('⏳ Scanning entire codebase (this may take a moment)...\n');
      const result = await generator.generateFullCodebaseReport();
      console.log(result.report);
      console.log('\n---\n');
      console.log(`📊 Audit Statistics:`);
      console.log(`   Total Files: ${result.stats.totalFiles}`);
      console.log(`   Critical Issues: ${result.stats.findings.critical}`);
      console.log(`   High Issues: ${result.stats.findings.high}`);
      console.log(`   Medium Issues: ${result.stats.findings.medium}`);
      console.log('\n💾 Saving full report...\n');

      const reportPath = path.join(projectPath, 'AUDIT_REPORT_FULL.md');
      generator.saveReport(result.report, reportPath);
    } else {
      const report = generator.generateReport();
      console.log(report);
      console.log('\n---\n');
      console.log('💾 Saving quick report...\n');

      const reportPath = path.join(projectPath, 'AUDIT_REPORT.md');
      generator.saveReport(report, reportPath);
    }
  } catch (err) {
    console.error('❌ Audit failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
