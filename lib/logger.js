'use strict';

const path = require('path');
const fs = require('fs');

function setupFileLogging() {
  const logsDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const logFilePath = path.join(logsDir, 'server.log');
  try {
    fs.writeFileSync(logFilePath, `=== SERVER LOG STARTED AT ${new Date().toISOString()} ===\nNODE_ENV: ${process.env.NODE_ENV}\n\n`);
    // eslint-disable-next-line no-unused-vars
  } catch (_e) {}

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = function(...args) {
    originalLog.apply(console, args);
    try {
      fs.appendFileSync(logFilePath, `[LOG] [${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`);
      // eslint-disable-next-line no-unused-vars
    } catch (_e) {}
  };
  console.error = function(...args) {
    originalError.apply(console, args);
    try {
      // Sanitize errors: log only message/code, not full stack traces (prevent data leaks)
      const sanitized = args.map(a => {
        if (a instanceof Error) {
          return `${a.name}: ${a.message}`;
        } else if (a !== null && typeof a === 'object') {
          return a.code || a.message || '[Object]';
        }
        return String(a);
      }).join(' ');
      fs.appendFileSync(logFilePath, `[ERROR] [${new Date().toISOString()}] ${sanitized}\n`);
      // eslint-disable-next-line no-unused-vars
    } catch (_e) {}
  };
  console.warn = function(...args) {
    originalWarn.apply(console, args);
    try {
      fs.appendFileSync(logFilePath, `[WARN] [${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`);
      // eslint-disable-next-line no-unused-vars
    } catch (_e) {}
  };

  return { logFilePath };
}

module.exports = { setupFileLogging };
