/**
 * AST-Based Code Analyzer for Node.js Security Audits
 * Detects security patterns, middleware, and vulnerabilities via Abstract Syntax Tree parsing
 */

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

class ASTAnalyzer {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.findings = [];
  }

  parseFile(filePath) {
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const ast = acorn.parse(code, {
        ecmaVersion: 2024,
        sourceType: 'module',
        allowImportExportEverywhere: true,
        locations: true
      });
      return ast;
    } catch (err) {
      console.error(`[ERROR] Failed to parse ${filePath}: ${err.message}`);
      return null;
    }
  }

  walkAST(node, callback) {
    if (!node || typeof node !== 'object' || !node.type) return;
    callback(node);
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => this.walkAST(child, callback));
        } else if (node[key].type) {
          this.walkAST(node[key], callback);
        }
      }
    }
  }

  detectMiddleware(ast, middlewareName) {
    let found = false;
    let lineNumber = null;

    this.walkAST(ast, (node) => {
      if (node.type === 'CallExpression' &&
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'use') {

        const arg = node.arguments[0];
        if (arg) {
          if (arg.name === middlewareName || (arg.name && this.isVariableAssignedTo(ast, arg.name, middlewareName))) {
            found = true;
            lineNumber = node.loc?.start.line;
          } else if (arg.type === 'CallExpression' && arg.callee.name) {
            if (arg.callee.name === middlewareName || this.isVariableAssignedTo(ast, arg.callee.name, middlewareName)) {
              found = true;
              lineNumber = node.loc?.start.line;
            }
          }
        }
      }
    });

    return { found, lineNumber };
  }

  isVariableAssignedTo(ast, varName, assignedValue) {
    let result = false;

    this.walkAST(ast, (node) => {
      if (node.type === 'VariableDeclaration') {
        node.declarations.forEach(decl => {
          if (decl.id.name === varName) {
            if (decl.init) {
              if (decl.init.type === 'CallExpression') {
                // Direct call: const x = helmet()
                if (decl.init.callee.name === assignedValue) {
                  result = true;
                }
                // CommonJS require: const myHelmet = require('helmet')
                if (decl.init.callee.name === 'require' && decl.init.arguments[0]?.value === assignedValue) {
                  result = true;
                }
              }
            }
          }
        });
      }
    });

    return result;
  }

  detectSQLInjection(ast) {
    const vulnerabilities = [];

    this.walkAST(ast, (node) => {
      if (node.type === 'TemplateLiteral') {
        const code = node.quasis ? node.quasis.map(q => q.value?.raw || '').join('') : '';
        if (/SELECT|INSERT|UPDATE|DELETE|DROP|CREATE/i.test(code) &&
            node.expressions && node.expressions.length > 0) {

          vulnerabilities.push({
            type: 'SQL_INJECTION',
            line: node.loc?.start.line,
            message: 'Potential SQL Injection: Dynamic query construction detected',
            code: code.substring(0, 80),
            severity: 'HIGH'
          });
        }
      }

      if (node.type === 'BinaryExpression' && node.operator === '+') {
        if (node.left?.value && /SELECT|INSERT|UPDATE|DELETE/i.test(node.left.value)) {
          vulnerabilities.push({
            type: 'SQL_INJECTION',
            line: node.loc?.start.line,
            message: 'Potential SQL Injection: Query built via string concatenation',
            severity: 'HIGH'
          });
        }
      }
    });

    return vulnerabilities;
  }

  detectHardcodedSecrets(ast) {
    const secrets = [];
    const secretPatterns = /password|secret|key|token|credential|api_key|db_pass|jwt/i;

    this.walkAST(ast, (node) => {
      if (node.type === 'VariableDeclaration') {
        node.declarations.forEach(decl => {
          const varName = decl.id.name;
          if (secretPatterns.test(varName) && decl.init?.value) {
            secrets.push({
              type: 'HARDCODED_SECRET',
              line: node.loc?.start.line,
              variable: varName,
              message: `Hardcoded secret detected: ${varName}`,
              severity: 'CRITICAL'
            });
          }
        });
      }

      if (node.type === 'Property' &&
          secretPatterns.test(node.key.name) &&
          node.value?.type === 'Literal') {
        secrets.push({
          type: 'HARDCODED_SECRET',
          line: node.loc?.start.line,
          property: node.key.name,
          message: `Hardcoded secret in config: ${node.key.name}`,
          severity: 'CRITICAL'
        });
      }
    });

    return secrets;
  }

  detectParameterizedQueries(ast) {
    const queries = [];

    this.walkAST(ast, (node) => {
      if (node.type === 'CallExpression' &&
          node.callee.type === 'MemberExpression' &&
          (node.callee.property.name === 'query' ||
           node.callee.property.name === 'run' ||
           node.callee.property.name === 'all')) {

        const hasParams = node.arguments.length >= 2;
        const usesPlaceholders = node.arguments[0]?.value?.includes('$') ||
                                 node.arguments[0]?.value?.includes('?');

        if (hasParams && usesPlaceholders) {
          queries.push({
            type: 'SAFE_QUERY',
            line: node.loc?.start.line,
            message: 'Safe parameterized query detected',
            severity: 'INFO'
          });
        }
      }
    });

    return queries;
  }

  detectCORSConfig(ast) {
    let corsConfig = null;

    this.walkAST(ast, (node) => {
      if (node.type === 'CallExpression' &&
          node.callee.type === 'MemberExpression' &&
          node.callee.property.name === 'use') {

        const arg = node.arguments[0];
        if (arg?.callee?.name === 'cors' || arg?.name === 'cors') {
          corsConfig = {
            found: true,
            hasOptions: arg.type === 'CallExpression' && arg.arguments[0],
            line: node.loc?.start.line
          };
        }
      }

      if (node.type === 'Property' && node.key.name === 'cors') {
        corsConfig = {
          found: true,
          isSocketIO: true,
          line: node.loc?.start.line
        };
      }
    });

    return corsConfig || { found: false };
  }

  detectErrorHandling(ast) {
    const issues = [];

    this.walkAST(ast, (node) => {
      const isFunction = node.type === 'FunctionExpression' ||
                         node.type === 'ArrowFunctionExpression' ||
                         node.type === 'FunctionDeclaration';

      if (isFunction && node.params.length === 4) {
        const errParamName = node.params[0].name;
        if (errParamName && (errParamName === 'err' || errParamName === 'error')) {
          this.walkAST(node, (innerNode) => {
            if (innerNode.type === 'CallExpression' &&
                innerNode.callee.type === 'MemberExpression' &&
                innerNode.callee.property.name === 'json' &&
                innerNode.arguments[0]?.name === errParamName) {

              issues.push({
                type: 'ERROR_INFO_DISCLOSURE',
                line: node.loc?.start.line,
                message: 'Error object sent directly to client (may leak stack traces)',
                severity: 'MEDIUM'
              });
            }
          });
        }
      }
    });

    return issues;
  }

  analyzeFile(filePath) {
    const ast = this.parseFile(filePath);
    if (!ast) return null;

    return {
      file: filePath,
      middleware: {
        helmet: this.detectMiddleware(ast, 'helmet'),
        rateLimit: this.detectMiddleware(ast, 'rateLimit'),
        cors: this.detectCORSConfig(ast)
      },
      security: {
        sqlInjection: this.detectSQLInjection(ast),
        hardcodedSecrets: this.detectHardcodedSecrets(ast),
        parameterizedQueries: this.detectParameterizedQueries(ast),
        errorHandling: this.detectErrorHandling(ast)
      }
    };
  }

  analyzeProject(targetFiles = ['index.js', 'database.js', 'config.js']) {
    const results = {};

    targetFiles.forEach(file => {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        results[file] = this.analyzeFile(filePath);
      }
    });

    return results;
  }
}

module.exports = ASTAnalyzer;
