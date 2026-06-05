#!/usr/bin/env node

const AuditReportGenerator = require('./report-generator');
const path = require('path');

const projectPath = process.argv[2] || path.join(__dirname, '../../');

console.log(`🔍 Analyzing: ${projectPath}\n`);

try {
  const generator = new AuditReportGenerator(projectPath);
  const report = generator.generateReport();

  console.log(report);
  console.log('\n---\n');
  console.log('💾 Saving report...\n');

  const reportPath = path.join(projectPath, 'AUDIT_REPORT.md');
  generator.saveReport(report, reportPath);
} catch (err) {
  console.error('❌ Audit failed:', err.message);
  process.exit(1);
}
