// src/services/llm.js

/**
 * LLM service for handling API calls to different LLM providers
 * With enhanced prompt handling capabilities
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const { yovoPrompt } = require('../prompts/yovo-prompt');

// Initialize deepseek API client
const deepseekClient = axios.create({
  baseURL: config.llm.deepseek.apiUrl,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.llm.deepseek.apiKey}`
  }
});

// Initialize OpenAI API client
const openaiClient = axios.create({
  baseURL: config.llm.openai.apiUrl,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.llm.openai.apiKey}`
  }
});

/**
 * Call Deepseek API for chat completions
 * @param {Array} messages - Array of conversation messages
 * @param {String} promptSection - Optional specific prompt section to use instead of full prompt
 * @returns {Promise} - API response
 */
const callDeepseekAPI = async (messages, promptSection = null) => {
  try {
    // Check if API key is configured
    if (!config.llm.deepseek.apiKey) {
      logger.error('DEEPSEEK_API_KEY is not set in environment variables');
      return createFallbackResponse('Configuration Error: API key not set.');
    }

    // Use specific prompt section if provided, otherwise use the message history as is
    let messageHistory = [...messages];

    // If a specific prompt section is requested, replace the system message
    if (promptSection && yovoPrompt[promptSection]) {
      // Find and replace the system message or add one if it doesn't exist
      const systemMessageIndex = messageHistory.findIndex(msg => msg.role === 'system');

      if (systemMessageIndex >= 0) {
        messageHistory[systemMessageIndex].content = yovoPrompt[promptSection];
      } else {
        messageHistory.unshift({ role: 'system', content: yovoPrompt[promptSection] });
      }
    }

    logger.debug('Calling Deepseek API', {
      messageCount: messageHistory.length,
      promptSection: promptSection || 'full system prompt'
    });

    const response = await deepseekClient.post('/chat/completions', {
      model: config.llm.deepseek.defaultModel,
      messages: messageHistory,
      max_tokens: 350, // Increased for more detailed responses
      temperature: 0.7
    });

    return response.data;
  } catch (error) {
    logger.error('Error calling Deepseek API:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    return createFallbackResponse();
  }
};

/**
 * Call OpenAI API for chat completions
 * @param {Array} messages - Array of conversation messages
 * @param {String} promptSection - Optional specific prompt section to use instead of full prompt
 * @returns {Promise} - API response
 */
const callOpenAIAPI = async (messages, promptSection = null) => {
  try {
    // Check if API key is configured
    if (!config.llm.openai.apiKey) {
      logger.error('OPENAI_API_KEY is not set in environment variables');
      return createFallbackResponse('Configuration Error: API key not set.');
    }

    // Use specific prompt section if provided, otherwise use the message history as is
    let messageHistory = [...messages];

    // If a specific prompt section is requested, replace the system message
    if (promptSection && yovoPrompt[promptSection]) {
      // Find and replace the system message or add one if it doesn't exist
      const systemMessageIndex = messageHistory.findIndex(msg => msg.role === 'system');

      if (systemMessageIndex >= 0) {
        messageHistory[systemMessageIndex].content = yovoPrompt[promptSection];
      } else {
        messageHistory.unshift({ role: 'system', content: yovoPrompt[promptSection] });
      }
    }

    logger.debug('Calling OpenAI API', {
      messageCount: messageHistory.length,
      promptSection: promptSection || 'full system prompt'
    });

    const response = await openaiClient.post('/chat/completions', {
      model: config.llm.openai.defaultModel,
      messages: messageHistory,
      max_tokens: 350, // Increased for more detailed responses
      temperature: 0.7
    });

    return response.data;
  } catch (error) {
    logger.error('Error calling OpenAI API:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    return createFallbackResponse();
  }
};

/**
 * Create a fallback response for when API calls fail
 * @param {string} message - Optional custom error message
 * @returns {Object} - Fallback response object
 */
const createFallbackResponse = (message) => {
  return {
    choices: [{
      message: {
        content: message || "I apologize, but I'm having trouble connecting to my knowledge base right now. Please try again later."
      }
    }]
  };
};

/**
 * Main function to call the appropriate LLM API based on configuration
 * @param {Array} messages - Array of conversation messages
 * @param {String} promptSection - Optional specific prompt section to use
 * @returns {Promise} - API response
 */
const generateResponse = async (messages, promptSection = null) => {
  const provider = config.llm.provider.toLowerCase();

  switch (provider) {
    case 'deepseek':
      return callDeepseekAPI(messages, promptSection);
    case 'openai':
      return callOpenAIAPI(messages, promptSection);
    default:
      logger.error(`Unknown LLM provider: ${provider}`);
      return createFallbackResponse(`Configuration Error: Unknown provider '${provider}'`);
  }
};

module.exports = {
  generateResponse
};