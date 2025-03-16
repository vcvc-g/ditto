/**
 * Main server file for the Voice Chat LLM application
 */

// Core dependencies
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const socketIo = require('socket.io');
const fs = require('fs');

// Application modules
const config = require('./config');
const logger = require('./utils/logger');
const llmService = require('./services/llm');
const routes = require('./routes');

// Constants
const PORT = config.server.port;
const NODE_ENV = config.server.environment;

// Create directories if they don't exist
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
const logsDir = path.join(process.cwd(), 'logs');

[uploadsDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Keep track of conversation history for each client
const conversationHistory = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));

// Static files
app.use(express.static(path.join(process.cwd(), 'public')));

// Routes
app.use('/', routes);

// Socket connection
io.on('connection', (socket) => {
  logger.info(`New client connected: ${socket.id}`);

  // Initialize conversation history for this client
  conversationHistory.set(socket.id, [
    { role: "system", content: config.systemPrompt }
  ]);

  // Handle speech-to-text input from client
  socket.on('speech', async (speechData) => {
    try {
      // Extract the user's message from the speech data
      const userMessage = speechData.text;
      logger.info(`Received from ${socket.id}: ${userMessage}`);

      // Add user message to conversation history
      const history = conversationHistory.get(socket.id);
      history.push({ role: "user", content: userMessage });

      // Emit acknowledgment that we received the message
      socket.emit('processingStart');

      // Get response from LLM
      const response = await llmService.generateResponse(history);

      // Extract response text
      const responseText = response.choices[0].message.content;
      logger.info(`Response to ${socket.id}: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);

      // Add AI response to conversation history
      history.push({ role: "assistant", content: responseText });

      // Truncate history if it gets too long (to save tokens)
      if (history.length > 15) {
        // Keep system message and last 8 exchanges
        const systemMessage = history[0];
        const recentMessages = history.slice(-16);
        conversationHistory.set(socket.id, [systemMessage, ...recentMessages]);
      }

      // Send response back to client
      socket.emit('llmResponse', { text: responseText });

    } catch (error) {
      logger.error('Error processing speech:', error);
      socket.emit('error', { message: 'Error processing your request. Please try again.' });
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    // Clean up conversation history
    conversationHistory.delete(socket.id);
  });
});

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  logger.error('Express error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  logger.info(`http://localhost:${PORT}`);
}).on('error', (err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

// Handle unexpected errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  // Don't exit in production to avoid container restart loops
  if (NODE_ENV === 'development') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', { promise, reason });
});