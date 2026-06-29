/**
 * SQL Injection Vulnerability Analyzer
 * Detects common SQL injection patterns and vulnerable query construction
 */

const fs = require('fs');
const path = require('path');

class SQLInjectionAnalyzer {
  constructor() {
    this.vulnerabilities = [];
    this.patterns = {
      // Direct string concatenation in SQL queries
      directConcat: /(['"`])?\s*\+\s*(?:req\.|params\.|user\.|input\.|data\.)[\w.]+\s*\+?\s*['"`]?/gi,

      // Template literals with variables in queries
      templateLiteral: /`[^`]*\$\{[^}]+\}[^`]*`/g,

      // Dangerous SQL functions without parameterization
      dangerousPatterns: [
        /db\.run\s*\(\s*[`'"]\s*[A-Z\s]+\s*\+/gi,
        /db\.get\s*\(\s*[`'"]\s*[A-Z\s]+\s*\+/gi,
        /db\.all\s*\(\s*[`'"]\s*[A-Z\s]+\s*\+/gi,
        /db\.exec\s*\(\s*[`'"]\s*[A-Z\s]+\s*\+/gi,
        /query\s*\(\s*[`'"]\s*[A-Z\s]+\s*\+/gi,
      ],

      // SQL keywords that indicate dynamic query construction
      dynamicKeywords: /(?:INSERT|SELECT|UPDATE|DELETE|DROP|CREATE)\s+(?:INTO|FROM|WHERE).*\+/gi,

      // Concatenation with object properties (common vulnerability)
      objectConcat: /['"`]\s*\+\s*(?:this\.|obj\.)[\w.]+/gi,
    };
  }

  // Analyze a file for SQL injection vulnerabilities
  analyzeFile(filePath) {
    const findings = [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const lineNumber = index + 1;

        // Skip comments and whitespace
        if (line.trim().startsWith('//') || line.trim().startsWith('/*') || !line.trim()) {
          return;
        }

        // Check for parameterized queries (safe pattern)
        if (this.isParameterized(line)) {
          return;
        }

        // Check for dangerous patterns
        for (const [patternName, pattern] of Object.entries(this.patterns)) {
          if (Array.isArray(pattern)) {
            for (const p of pattern) {
              if (p.test(line)) {
                findings.push({
                  file: filePath,
                  line: lineNumber,
                  type: 'SQL_INJECTION',
                  severity: 'CRITICAL',
                  issue: `Potential SQL injection: ${patternName}`,
                  message: `Detected ${patternName} in SQL query construction`,
                  code: line.trim()
                });
                break;
              }
            }
          } else if (pattern.test && pattern.test(line)) {
            findings.push({
              file: filePath,
              line: lineNumber,
              type: 'SQL_INJECTION',
              severity: 'CRITICAL',
              issue: `Potential SQL injection: ${patternName}`,
              message: `Detected ${patternName} in query`,
              code: line.trim()
            });
          }
        }

        // Check for missing input validation before SQL use
        if (this.hasUserInput(line) && !this.isValidated(line)) {
          findings.push({
            file: filePath,
            line: lineNumber,
            type: 'SQL_INJECTION',
            severity: 'HIGH',
            issue: 'User input used in SQL without validation',
            message: 'User input appears to be used in SQL context without validation',
            code: line.trim()
          });
        }
      });
    } catch (err) {
      console.error(`[sql-analyzer] Error reading file ${filePath}:`, err.message);
    }

    return findings;
  }

  // Check if query uses parameterized statements (safe)
  isParameterized(line) {
    return /\?|:\w+|\$\d+/.test(line) && /\[\s*(?:values|params|args)/i.test(line);
  }

  // Check if line contains user input references
  hasUserInput(line) {
    return /(?:req\.|params\.|query\.|body\.|user\.|input\.|process\.argv)/i.test(line);
  }

  // Check if user input is validated before use
  isValidated(line) {
    return /(?:escape|sanitize|validate|prepare|parameterize|quote)/i.test(line);
  }

  // Scan directory for SQL injection vulnerabilities
  async scanDirectory(dirPath, excludeDirs = ['node_modules', '.git', 'dist', 'build']) {
    const allFindings = [];

    const scanDir = async (dir) => {
      try {
        const files = fs.readdirSync(dir);

        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
              await scanDir(fullPath);
            }
          } else if (/\.(js|jsx|mjs|cjs)$/.test(file)) {
            const findings = this.analyzeFile(fullPath);
            allFindings.push(...findings);
          }
        }
      } catch (err) {
        console.error(`[sql-analyzer] Error scanning directory ${dir}:`, err.message);
      }
    };

    await scanDir(dirPath);
    return allFindings;
  }

  // Generate SQL injection audit report
  generateReport(findings) {
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

    let report = `# SQL Injection Audit Report\n\n`;
    report += `**Report Generated:** ${new Date().toISOString()}\n`;
    report += `**Total Vulnerabilities Found:** ${findings.length}\n\n`;

    report += `## Summary\n`;
    report += `- 🔴 Critical: ${bySeverity.CRITICAL.length}\n`;
    report += `- 🟠 High: ${bySeverity.HIGH.length}\n`;
    report += `- 🟡 Medium: ${bySeverity.MEDIUM.length}\n`;
    report += `- 🔵 Low: ${bySeverity.LOW.length}\n\n`;

    if (bySeverity.CRITICAL.length > 0) {
      report += `## 🔴 Critical Issues\n`;
      bySeverity.CRITICAL.slice(0, 20).forEach((f, i) => {
        report += `${i + 1}. **${f.issue}** - \`${f.file}:${f.line}\`\n`;
        report += `   \`\`\`\n   ${f.code}\n   \`\`\`\n`;
      });
      if (bySeverity.CRITICAL.length > 20) {
        report += `... and ${bySeverity.CRITICAL.length - 20} more critical issues\n`;
      }
      report += `\n`;
    }

    if (bySeverity.HIGH.length > 0) {
      report += `## 🟠 High Risk Issues\n`;
      bySeverity.HIGH.slice(0, 10).forEach((f, i) => {
        report += `${i + 1}. **${f.issue}** - \`${f.file}:${f.line}\`\n`;
      });
      if (bySeverity.HIGH.length > 10) {
        report += `... and ${bySeverity.HIGH.length - 10} more high risk issues\n`;
      }
      report += `\n`;
    }

    report += `## Recommendations\n`;
    if (bySeverity.CRITICAL.length > 0) {
      report += `⚠️ **URGENT:** ${bySeverity.CRITICAL.length} critical SQL injection vulnerabilities found. Fix immediately before production deployment.\n\n`;
    }
    report += `**Remediation Steps:**\n`;
    report += `1. Use parameterized queries with placeholders (?) or named parameters\n`;
    report += `2. Never concatenate user input directly into SQL strings\n`;
    report += `3. Validate and sanitize all user inputs\n`;
    report += `4. Use ORM or query builder libraries that handle escaping\n`;
    report += `5. Implement input whitelisting for known safe values\n`;
    report += `6. Run prepared statements with bound parameters\n\n`;

    report += `## Example: Safe vs Unsafe\n\n`;
    report += `### ❌ UNSAFE (Vulnerable)\n`;
    report += `\`\`\`javascript\n`;
    report += `const userId = req.query.id;\n`;
    report += `db.get('SELECT * FROM users WHERE id = ' + userId);\n`;
    report += `\`\`\`\n\n`;

    report += `### ✅ SAFE (Parameterized)\n`;
    report += `\`\`\`javascript\n`;
    report += `const userId = req.query.id;\n`;
    report += `db.get('SELECT * FROM users WHERE id = ?', [userId]);\n`;
    report += `\`\`\`\n`;

    return report;
  }
}

module.exports = SQLInjectionAnalyzer;
