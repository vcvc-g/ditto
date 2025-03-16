/**
 * Main routes for the application
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const logger = require('../utils/logger');

// Home page
router.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Health check endpoint
router.get('/health', (req, res) => {
  logger.debug('Health check requested');
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API version endpoint
router.get('/api/version', (req, res) => {
  const { version } = require('../../package.json');
  res.json({ version });
});

module.exports = router;