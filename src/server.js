/**
 * Main server file for the Voice Chat LLM application
 * Updated with enhanced prompt management for Yovo
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
const { yovoPrompt } = require('./prompts/yovo-prompt');

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

// Keep track of conversation history and session states for each client
const conversationHistory = new Map();
const sessionStates = new Map();

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

  // Initialize conversation history for this client with full system prompt
  conversationHistory.set(socket.id, [
    { role: "system", content: config.systemPrompt }
  ]);

  // Initialize session state for tracking conversation progress
  sessionStates.set(socket.id, {
    currentTopic: 'interest-discovery',
    topicRounds: 0,
    sessionDuration: 0,
    startTime: Date.now()
  });

  // Handle speech-to-text input from client
  socket.on('speech', async (speechData) => {
    try {
      // Extract the user's message from the speech data
      const userMessage = speechData.text;
      logger.info(`Received from ${socket.id}: ${userMessage}`);

      // Get current session state
      const sessionState = sessionStates.get(socket.id);

      // Add user message to conversation history
      const history = conversationHistory.get(socket.id);
      history.push({ role: "user", content: userMessage });

      // Emit acknowledgment that we received the message
      socket.emit('processingStart');

      // Get response from LLM
      // Use full conversation history with the system prompt
      const response = await llmService.generateResponse(history);

      // Extract response text
      const responseText = response.choices[0].message.content;
      logger.info(`Response to ${socket.id}: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);

      // Add AI response to conversation history
      history.push({ role: "assistant", content: responseText });

      // Update session metrics
      sessionState.topicRounds += 1;
      sessionState.sessionDuration = Math.floor((Date.now() - sessionState.startTime) / 1000);

      // Check if we should advance to next topic based on rounds or user input
      if (shouldAdvanceTopic(userMessage, sessionState)) {
        advanceToNextTopic(socket.id, sessionState);
      }

      // Truncate history if it gets too long (to save tokens)
      if (history.length > 15) {
        // Keep system message and last 8 exchanges
        const systemMessage = history[0];
        const recentMessages = history.slice(-16);
        conversationHistory.set(socket.id, [systemMessage, ...recentMessages]);
      }

      // Send response back to client
      socket.emit('llmResponse', {
        text: responseText,
        sessionState: {
          currentTopic: sessionState.currentTopic,
          sessionDuration: sessionState.sessionDuration
        }
      });

    } catch (error) {
      logger.error('Error processing speech:', error);
      socket.emit('error', { message: 'Error processing your request. Please try again.' });
    }
  });

  // Handle topic change requests
  socket.on('change-topic', async (data) => {
    try {
      const requestedTopic = data.topic;
      const sessionState = sessionStates.get(socket.id);

      // Update session state
      sessionState.currentTopic = requestedTopic;
      sessionState.topicRounds = 0;

      // Get the appropriate prompt section based on the topic
      let promptSection;
      switch (requestedTopic) {
        case 'interest-discovery':
          promptSection = 'approach';
          break;
        case 'major-exploration':
          promptSection = 'approach';
          break;
        case 'career-path':
          promptSection = 'guidance';
          break;
        case 'college-recommendations':
          promptSection = 'guidance';
          break;
        case 'session-closure':
          promptSection = 'closure';
          break;
        default:
          promptSection = null;
      }

      // Get history and add a transition message
      const history = conversationHistory.get(socket.id);
      history.push({
        role: "user",
        content: `Let's move on to discuss ${requestedTopic.replace(/-/g, ' ')}`
      });

      // Generate response with the appropriate prompt section
      const response = await llmService.generateResponse(history, promptSection);

      // Extract response text
      const responseText = response.choices[0].message.content;

      // Add AI response to conversation history
      history.push({ role: "assistant", content: responseText });

      // Send response back to client
      socket.emit('llmResponse', {
        text: responseText,
        sessionState: {
          currentTopic: sessionState.currentTopic,
          sessionDuration: sessionState.sessionDuration
        }
      });

    } catch (error) {
      logger.error('Error changing topic:', error);
      socket.emit('error', { message: 'Error changing the discussion topic. Please try again.' });
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    // Clean up conversation history and session state
    conversationHistory.delete(socket.id);
    sessionStates.delete(socket.id);
  });
});

/**
 * Determine if we should advance to the next topic based on conversation
 * @param {string} userMessage - The user's last message
 * @param {Object} sessionState - Current session state
 * @returns {boolean} - Whether to advance to next topic
 */
function shouldAdvanceTopic(userMessage, sessionState) {
  // Check if we've hit the maximum rounds for this topic
  const maxRoundsByTopic = {
    'interest-discovery': 5,  // 5 minutes
    'major-exploration': 3,   // 3 minutes
    'career-path': 3,         // 3 minutes
    'college-recommendations': 3, // 3 minutes
    'session-closure': 1      // 1 minute
  };

  const maxRounds = maxRoundsByTopic[sessionState.currentTopic] || 3;

  // Check if user explicitly asks to move on
  const moveOnKeywords = ['next topic', 'move on', 'continue', 'next section'];
  const userWantsToMoveOn = moveOnKeywords.some(keyword =>
    userMessage.toLowerCase().includes(keyword)
  );

  return sessionState.topicRounds >= maxRounds || userWantsToMoveOn;
}

/**
 * Advance the conversation to the next topic
 * @param {string} socketId - The client socket ID
 * @param {Object} sessionState - Current session state
 */
function advanceToNextTopic(socketId, sessionState) {
  const topicSequence = [
    'interest-discovery',
    'major-exploration',
    'career-path',
    'college-recommendations',
    'session-closure'
  ];

  const currentIndex = topicSequence.indexOf(sessionState.currentTopic);
  if (currentIndex >= 0 && currentIndex < topicSequence.length - 1) {
    // Move to next topic
    sessionState.currentTopic = topicSequence[currentIndex + 1];
    sessionState.topicRounds = 0;

    logger.info(`Advancing socket ${socketId} to topic: ${sessionState.currentTopic}`);
  }
}

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