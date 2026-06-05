const ASTAnalyzer = require('./ast-analyzer');
const fs = require('fs');

class AuditReportGenerator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.analyzer = new ASTAnalyzer(projectRoot);
  }

  generateReport(targetFiles = ['index.js', 'database.js', 'config.js']) {
    const analysis = this.analyzer.analyzeProject(targetFiles);
    const findings = this.compileFinding(analysis);
    const report = this.formatReport(findings);
    return report;
  }

  compileFinding(analysis) {
    const findings = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: []
    };

    for (const [file, result] of Object.entries(analysis)) {
      if (!result) continue;

      if (!result.middleware.helmet.found) {
        findings.high.push({
          file,
          issue: 'Missing Helmet Middleware',
          description: 'HTTP security headers not configured. App vulnerable to XSS, clickjacking, MIME-sniffing.',
          recommendation: 'npm install helmet && app.use(helmet())',
          severity: 'HIGH',
          cwe: 'CWE-693'
        });
      }

      if (!result.middleware.rateLimit.found) {
        findings.high.push({
          file,
          issue: 'Missing Rate Limiting',
          description: 'No rate limiting on API endpoints. Vulnerable to DoS, brute-force attacks.',
          recommendation: 'npm install express-rate-limit && app.use(rateLimit({...}))',
          severity: 'HIGH',
          cwe: 'CWE-307'
        });
      }

      if (!result.middleware.cors.found) {
        findings.medium.push({
          file,
          issue: 'CORS Not Explicitly Configured',
          description: 'Cross-Origin requests may be blocked or overly permissive.',
          recommendation: 'Implement CORS with dynamic origin validation',
          severity: 'MEDIUM',
          cwe: 'CWE-346'
        });
      }

      result.security.sqlInjection.forEach(vuln => {
        findings.critical.push({
          file,
          ...vuln,
          cwe: 'CWE-89',
          recommendation: 'Use parameterized queries: db.query(text, params)'
        });
      });

      result.security.hardcodedSecrets.forEach(secret => {
        findings.critical.push({
          file,
          ...secret,
          cwe: 'CWE-798',
          recommendation: 'Move to .env file and use process.env'
        });
      });

      result.security.errorHandling.forEach(err => {
        findings.medium.push({
          file,
          ...err,
          cwe: 'CWE-209',
          recommendation: 'Return generic error message in production'
        });
      });

      if (result.security.parameterizedQueries.length > 0) {
        findings.info.push({
          file,
          issue: 'Safe Database Queries Detected',
          description: `Found ${result.security.parameterizedQueries.length} parameterized queries`,
          severity: 'INFO',
          type: 'POSITIVE'
        });
      }
    }

    return findings;
  }

  formatReport(findings) {
    const timestamp = new Date().toISOString();
    const totalFindings =
      findings.critical.length +
      findings.high.length +
      findings.medium.length +
      findings.low.length;

    let report = `# Narmir Reborn: Security Audit Report\n`;
    report += `**Generated:** ${timestamp}\n`;
    report += `**Status:** ${totalFindings > 0 ? '⚠️ Action Required' : '✅ No Issues Found'}\n\n`;

    report += `## Summary\n`;
    report += `- 🔴 **Critical:** ${findings.critical.length}\n`;
    report += `- 🔴 **High:** ${findings.high.length}\n`;
    report += `- 🟡 **Medium:** ${findings.medium.length}\n`;
    report += `- 🟢 **Low:** ${findings.low.length}\n`;
    report += `- ℹ️ **Info:** ${findings.info.length}\n\n`;

    if (findings.critical.length > 0) {
      report += `---\n## 🔴 CRITICAL Findings\n`;
      findings.critical.forEach((f, i) => {
        report += this.formatFinding(f, i);
      });
    }

    if (findings.high.length > 0) {
      report += `---\n## 🔴 HIGH Priority Findings\n`;
      findings.high.forEach((f, i) => {
        report += this.formatFinding(f, i);
      });
    }

    if (findings.medium.length > 0) {
      report += `---\n## 🟡 MEDIUM Priority Findings\n`;
      findings.medium.forEach((f, i) => {
        report += this.formatFinding(f, i);
      });
    }

    if (findings.info.length > 0) {
      report += `---\n## ✅ Positive Findings\n`;
      findings.info.forEach((f, i) => {
        report += `### ${i + 1}. ${f.issue}\n`;
        report += `**File:** \`${f.file}\`\n`;
        report += `**Status:** ✅ ${f.description}\n\n`;
      });
    }

    return report;
  }

  formatFinding(finding, index) {
    let text = `### ${index + 1}. ${finding.issue}\n`;
    text += `**File:** \`${finding.file}\`\n`;
    if (finding.line) text += `**Line:** ${finding.line}\n`;
    text += `**Severity:** ${finding.severity}\n`;
    if (finding.cwe) text += `**CWE:** [${finding.cwe}](https://cwe.mitre.org/data/definitions/${finding.cwe.split('-')[1]}.html)\n`;
    text += `\n**Issue:** ${finding.description || finding.message}\n\n`;
    text += `**Remediation:**\n\`\`\`\n${finding.recommendation}\n\`\`\`\n\n`;
    return text;
  }

  saveReport(report, outputPath = './AUDIT_REPORT.md') {
    fs.writeFileSync(outputPath, report);
    console.log(`✅ Report saved to ${outputPath}`);
  }
}

module.exports = AuditReportGenerator;
