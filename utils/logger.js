// utils/logger.js
const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      user: data.user || 'system'
    };

    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    
    // Também log no console em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${level}] ${timestamp}: ${message}`);
    }
  }

  info(message, data) {
    this.log('INFO', message, data);
  }

  error(message, data) {
    this.log('ERROR', message, data);
  }

  warn(message, data) {
    this.log('WARN', message, data);
  }
}

module.exports = new Logger();
