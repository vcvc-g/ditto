/**
 * Client-side JavaScript for Voice Chat LLM application
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const micButton = document.getElementById('micButton');
  const chatContainer = document.getElementById('chatContainer');
  const statusText = document.getElementById('statusText');
  const voiceSelect = document.getElementById('voiceSelect');
  const speechRateRange = document.getElementById('speechRateRange');
  const speechRateValue = document.getElementById('speechRateValue');
  const pitchRange = document.getElementById('pitchRange');
  const pitchValue = document.getElementById('pitchValue');

  // Socket.io connection
  const socket = io();

  // Web Speech API initialization
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechSynthesis = window.speechSynthesis;

  // Check if browser supports speech recognition
  if (!SpeechRecognition) {
    addErrorMessage("Your browser doesn't support speech recognition. Please try Chrome, Edge, or Safari.");
    statusText.textContent = "Speech recognition not supported";
    micButton.disabled = true;
    return;
  }

  // Initialize speech recognition
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';  // Set language

  // Initialize speech synthesis
  let voices = [];
  let selectedVoice = null;

  // Populate voice selection dropdown
  function populateVoiceList() {
    voices = speechSynthesis.getVoices();

    // Clear existing options
    voiceSelect.innerHTML = '';

    // Add voices to select element
    voices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.textContent = `${voice.name} (${voice.lang})`;
      option.setAttribute('data-lang', voice.lang);
      option.setAttribute('data-index', index);
      voiceSelect.appendChild(option);

      // Select a default voice (preferably a US English voice)
      if (voice.name.includes('US English') ||
          voice.name.includes('Samantha') ||
          voice.lang === 'en-US') {
        voiceSelect.selectedIndex = index;
        selectedVoice = voice;
      }
    });

    // If no US English voice was found, use the first voice
    if (!selectedVoice && voices.length > 0) {
      selectedVoice = voices[0];
    }
  }

  // Handle voice selection change
  voiceSelect.addEventListener('change', () => {
    const selectedIndex = voiceSelect.selectedOptions[0].getAttribute('data-index');
    selectedVoice = voices[selectedIndex];
  });

  // Handle speech rate change
  speechRateRange.addEventListener('input', () => {
    const value = speechRateRange.value;
    speechRateValue.textContent = value;
  });

  // Handle pitch change
  pitchRange.addEventListener('input', () => {
    const value = pitchRange.value;
    pitchValue.textContent = value;
  });

  // Chrome loads voices asynchronously
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  // Initial population of voices
  populateVoiceList();

  // Recording state
  let isRecording = false;
  let finalTranscript = '';

  // Add message to chat
  function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ai-message');

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return messageDiv;
  }

  // Add error message
  function addErrorMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('speech-not-supported');
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Add loading indicator
  function addLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.classList.add('loading');
    loadingDiv.textContent = "AI is thinking";
    loadingDiv.id = "loadingIndicator";
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return loadingDiv;
  }

  // Remove loading indicator
  function removeLoadingIndicator() {
    const loadingDiv = document.getElementById("loadingIndicator");
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }

  // Speak text using speech synthesis
  function speakText(text) {
    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);

    // Set voice
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Set speech rate and pitch
    utterance.rate = parseFloat(speechRateRange.value);
    utterance.pitch = parseFloat(pitchRange.value);

    // Speak
    speechSynthesis.speak(utterance);

    // Enable mic button after speaking is done
    utterance.onend = function() {
      micButton.disabled = false;
    };
  }

  // Handle speech recognition results
  recognition.onresult = (event) => {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // Update status with interim results
    if (interimTranscript) {
      statusText.textContent = "I heard: " + interimTranscript;
    }
  };

  // Handle speech recognition end
  recognition.onend = () => {
    if (isRecording) {
      // If we're still in recording mode but recognition ended,
      // it means we have a final transcript
      if (finalTranscript) {
        // Add user message to chat
        addMessage(finalTranscript, 'user');

        // Send to server
        socket.emit('speech', { text: finalTranscript });

        // Show loading indicator
        addLoadingIndicator();

        // Disable mic button while processing
        micButton.disabled = true;

        // Reset transcript
        finalTranscript = '';
      }

      // End recording mode
      isRecording = false;
      micButton.classList.remove('recording');
      statusText.textContent = "Processing...";
    } else {
      // Normal end of recording
      micButton.classList.remove('recording');
      statusText.textContent = "Press and hold to speak";
    }
  };

  // Handle speech recognition errors
  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);

    if (event.error === 'no-speech') {
      statusText.textContent = "No speech detected. Try again.";
    } else {
      statusText.textContent = `Error: ${event.error}`;
    }

    stopRecording();
  };

  // Start recording
  function startRecording() {
    isRecording = true;
    finalTranscript = '';

    try {
      recognition.start();
      micButton.classList.add('recording');
      statusText.textContent = "Listening...";
    } catch (e) {
      console.error('Recognition failed to start:', e);
      statusText.textContent = "Recognition failed to start";
    }
  }

  // Stop recording
  function stopRecording() {
    isRecording = false;
    try {
      recognition.stop();
    } catch (e) {
      console.error('Recognition failed to stop:', e);
    }
    micButton.classList.remove('recording');
  }

  // Handle microphone button press
  micButton.addEventListener('mousedown', startRecording);
  micButton.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent click event from firing
    startRecording();
  });

  // Handle microphone button release
  micButton.addEventListener('mouseup', stopRecording);
  micButton.addEventListener('mouseleave', stopRecording);
  micButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopRecording();
  });

  // Socket event handlers
  socket.on('connect', () => {
    console.log('Connected to server');
    statusText.textContent = "Connected! Press and hold to speak";
  });

  socket.on('processingStart', () => {
    statusText.textContent = "Processing your request...";
  });

  socket.on('llmResponse', (data) => {
    // Remove loading indicator
    removeLoadingIndicator();

    // Add AI response to chat
    addMessage(data.text, 'ai');

    // Speak the response
    speakText(data.text);

    // Update status
    statusText.textContent = "Press and hold to speak";
  });

  socket.on('error', (data) => {
    console.error('Server error:', data.message);
    removeLoadingIndicator();
    statusText.textContent = data.message;
    addMessage(`Sorry, an error occurred: ${data.message}`, 'ai');
    micButton.disabled = false;
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    addMessage("Connection lost. Please refresh the page.", 'ai');
    statusText.textContent = "Disconnected";
    micButton.disabled = true;
  });

  // Handle connection error
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    statusText.textContent = "Connection error. Check server.";
    micButton.disabled = true;
  });

  // Initial message
  setTimeout(() => {
    speakText("Hello! I'm your AI voice assistant. How can I help you today?");
  }, 1000);
});