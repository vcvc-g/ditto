/**
 * Logger utility for consistent application logging
 */

const winston = require('winston');
const path = require('path');
const config = require('../config');

// Define log directory
const logDir = path.join(process.cwd(), 'logs');

// Create log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format (more readable for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: config.server.environment === 'development' ? 'debug' : 'info',
  format: logFormat,
  defaultMeta: { service: 'voice-chat-llm' },
  transports: [
    // Console transport (all environments)
    new winston.transports.Console({
      format: consoleFormat
    }),

    // File transports (all environments)
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      mkdir: true
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      mkdir: true
    })
  ],
});

module.exports = logger;