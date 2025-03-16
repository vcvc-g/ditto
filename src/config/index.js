/**
 * Central configuration file for the application
 */

require('dotenv').config();
const { getCompiledPrompt } = require('../prompts/yovo-prompt');

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
  },

  // LLM provider configuration
  llm: {
    provider: process.env.LLM_PROVIDER || 'deepseek',

    // Deepseek configuration
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
    },

    // OpenAI configuration (alternative)
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      apiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1',
      defaultModel: 'gpt-3.5-turbo',
    },
  },

  // System prompt for conversation initialization
  systemPrompt: getCompiledPrompt(),
};

module.exports = config;