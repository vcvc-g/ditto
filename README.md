# Voice Chat with LLM

A web application that enables voice conversations with Large Language Models (LLMs). This project uses the Web Speech API for speech recognition and synthesis, combined with LLM APIs to create a natural voice-based AI assistant.

## Features

- 🎤 Real-time speech recognition
- 🔊 Text-to-speech for AI responses
- 💬 Conversation memory
- 🎛️ Customizable voice settings (voice selection, speech rate, pitch)
- 🌐 Support for multiple LLM providers (Deepseek, OpenAI)
- 📱 Responsive design for all devices

## Requirements

- Node.js 16 or higher
- LLM API key (Deepseek or OpenAI)
- Modern browser that supports Web Speech API (Chrome, Edge, Safari)

## Setup Instructions for macOS

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd voice-chat-llm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Edit the .env file**
   - Add your LLM API key
   - Set the LLM provider (deepseek or openai)

5. **Create necessary directories**
   ```bash
   mkdir -p public/uploads logs
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Open your browser and navigate to http://localhost:3000

### Docker Setup

1. **Install Docker Desktop for macOS**
   - Download from [Docker's official website](https://www.docker.com/products/docker-desktop)
   - Install and start Docker Desktop

2. **Set up environment file**
   ```bash
   cp .env.example .env
   ```
   - Edit the .env file to add your LLM API key

3. **Build and start the Docker container**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Open your browser and navigate to http://localhost:3000

## Using the Application

1. **Press and hold** the microphone button to speak
2. **Release** the button when you're done speaking
3. Wait for the AI to process your speech and respond
4. The AI's response will be spoken back to you

## Customizing the Voice

- Select different voices from the dropdown menu
- Adjust speech rate and pitch using the sliders

## Troubleshooting

- **Speech recognition not working**: Ensure you're using a supported browser and have granted microphone permissions
- **No voices available**: Some browsers may take a moment to load the available voices
- **Connection issues**: Check your internet connection and ensure the server is running

## License

MIT