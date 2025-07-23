// Popup script for AI Chatbot Extension

class PopupController {
  constructor() {
    this.currentTab = null;
    this.isAuthenticated = false;
    this.pageData = null;
    this.chatHistory = [];
    this.sessionKey = null;
    this.init();
  }

  async init() {
    // Get current tab
    await this.getCurrentTab();
    
    // Generate session key for this popup instance
    this.sessionKey = `popup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check authentication status
    await this.checkAuthStatus();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Listen for background messages
    this.setupMessageListener();
    
    // Load session data
    await this.loadSessionData();
    
    // Save session periodically
    this.startSessionSaver();
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      console.log('Current tab loaded:', tab?.url);
    } catch (error) {
      console.error('Failed to get current tab:', error);
      this.showError('Failed to access current tab. Please refresh the page.');
    }
  }

  async checkAuthStatus() {
    try {
      const result = await chrome.storage.local.get(['userCredentials', 'chatbotSession']);
      this.isAuthenticated = !!result.userCredentials;
      
      // Restore session if available
      if (result.chatbotSession) {
        this.restoreSession(result.chatbotSession);
      }
      
      this.updateUI();
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }
  }

  restoreSession(session) {
    try {
      if (session.pageData) {
        this.pageData = session.pageData;
      }
      if (session.chatHistory && Array.isArray(session.chatHistory)) {
        this.chatHistory = session.chatHistory;
        this.restoreChatMessages();
      }
      console.log('Session restored successfully');
    } catch (error) {
      console.error('Error restoring session:', error);
    }
  }

  restoreChatMessages() {
    try {
      const chatMessages = document.getElementById('chatMessages');
      if (!chatMessages) return;

      // Clear existing messages except the initial AI greeting
      const initialMessage = chatMessages.querySelector('.ai-message');
      chatMessages.innerHTML = '';
      if (initialMessage) {
        chatMessages.appendChild(initialMessage);
      }

      // Restore chat history
      this.chatHistory.forEach(message => {
        if (message.sender && message.content) {
          this.addChatMessage(message.sender, message.content, false); // false = don't save to history again
        }
      });
    } catch (error) {
      console.error('Error restoring chat messages:', error);
    }
  }

  async saveSession() {
    try {
      const sessionData = {
        timestamp: Date.now(),
        pageData: this.pageData,
        chatHistory: this.chatHistory,
        currentTabUrl: this.currentTab?.url,
        sessionKey: this.sessionKey
      };

      await chrome.storage.local.set({
        chatbotSession: sessionData
      });

      console.log('Session saved successfully');
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  startSessionSaver() {
    // Save session every 10 seconds
    setInterval(() => {
      if (this.isAuthenticated) {
        this.saveSession();
      }
    }, 10000);

    // Save session when popup is about to close
    window.addEventListener('beforeunload', () => {
      this.saveSession();
    });
  }

  updateUI() {
    const authSection = document.getElementById('authSection');
    const mainInterface = document.getElementById('mainInterface');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (this.isAuthenticated) {
      authSection.style.display = 'none';
      mainInterface.style.display = 'flex';
      statusText.textContent = 'Connected';
      statusDot.className = 'status-dot success';
      this.enableInterface();
    } else {
      authSection.style.display = 'flex';
      mainInterface.style.display = 'none';
      statusText.textContent = 'Not Connected';
      statusDot.className = 'status-dot error';
    }
  }

  enableInterface() {
    const scanBtn = document.getElementById('scanBtn');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    
    scanBtn.disabled = false;
    
    if (this.pageData) {
      this.enableChatInterface();
    } else {
      chatInput.disabled = true;
      sendChatBtn.disabled = true;
      chatInput.placeholder = "Click Scan first, then ask me anything...";
    }
  }

  setupEventListeners() {
    // Authentication form
    const authForm = document.getElementById('authForm');
    authForm.addEventListener('submit', (e) => this.handleAuthentication(e));

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', () => this.refreshChat());

    // Scan button
    const scanBtn = document.getElementById('scanBtn');
    scanBtn.addEventListener('click', () => this.scanCurrentPage());

    // Chat functionality
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
    
    sendChatBtn.addEventListener('click', () => this.sendChatMessage());

    // Chat suggestions
    const suggestionBtns = document.querySelectorAll('.suggestion-btn');
    suggestionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.dataset.query;
        this.sendChatMessage(query);
      });
    });
  }

  async refreshChat() {
    try {
      const refreshBtn = document.getElementById('refreshBtn');
      this.setButtonLoading(refreshBtn, true);

      // Clear chat history except the initial greeting
      const chatMessages = document.getElementById('chatMessages');
      const initialMessage = chatMessages.querySelector('.ai-message');
      chatMessages.innerHTML = '';
      if (initialMessage) {
        chatMessages.appendChild(initialMessage.cloneNode(true));
      }

      // Reset chat history
      this.chatHistory = [];

      // Clear page data if it exists
      if (this.pageData) {
        this.pageData = null;
        // Disable chat interface until new scan
        this.enableChatInterface();
      }

      // Update status
      this.updateStatus('Chat refreshed', 'success');

      // Save the cleared session
      await this.saveSession();

      // Re-attach event listeners to new suggestion buttons
      const suggestionBtns = document.querySelectorAll('.suggestion-btn');
      suggestionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const query = btn.dataset.query;
          this.sendChatMessage(query);
        });
        btn.disabled = true;
      });

      // Show success message
      this.addChatMessage('ai', 'Chat session refreshed! Click "Scan" to analyze the current webpage and start a new conversation.');

    } catch (error) {
      console.error('Error refreshing chat:', error);
      this.showError('Failed to refresh chat. Please try again.');
    } finally {
      const refreshBtn = document.getElementById('refreshBtn');
      this.setButtonLoading(refreshBtn, false);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.target === 'popup' && message.tabId === this.currentTab?.id) {
        this.handleBackgroundMessage(message);
      }
    });
  }

  handleBackgroundMessage(message) {
    switch (message.type) {
      case 'analysisComplete':
        this.handleAnalysisComplete(message.analysis);
        break;
    }
  }

  handleAnalysisComplete(analysis) {
    // Add analysis complete message to chat
    this.addChatMessage('ai', 'Great! I\'ve analyzed the page successfully. Now I can help you with any questions about the content, products, or information found here. What would you like to know?');
  }

  async handleAuthentication(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const apiKey = document.getElementById('apiKey').value.trim();

    if (!apiKey) {
      this.showError('Please enter your API key');
      return;
    }

    // Show loading state
    this.setButtonLoading(submitBtn, true);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'authenticateUser',
        credentials: { apiKey }
      });

      if (response && response.success) {
        this.isAuthenticated = true;
        this.updateUI();
        this.updateStatus('Connected successfully!', 'success');
        
        // Add welcome message to chat
        this.addChatMessage('ai', 'Perfect! I\'m now connected and ready to help. Click the "Scan" button above to analyze the current webpage, then ask me anything about it!');
        
        // Save session after authentication
        await this.saveSession();
      } else {
        this.showError(response?.error || 'Authentication failed. Please check your API key.');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      this.showError('Connection failed. Please check your API key and internet connection.');
    } finally {
      this.setButtonLoading(submitBtn, false);
    }
  }

  async scanCurrentPage() {
    const scanBtn = document.getElementById('scanBtn');
    
    if (!this.isAuthenticated) {
      this.showError('Please connect your API key first');
      return;
    }

    this.setButtonLoading(scanBtn, true);

    try {
      // Check if we have a current tab
      if (!this.currentTab || !this.currentTab.id) {
        throw new Error('No active tab found. Please make sure you have a webpage open.');
      }

      console.log('Starting scan for tab:', this.currentTab.id, this.currentTab.url);

      // Update status
      this.updateStatus('Scanning page...', 'connecting');

      // Add scanning message to chat
      this.addChatMessage('ai', '🔍 Scanning the current page... Please wait a moment while I analyze the content.');

      // First, try to inject content script if it's not already there
      try {
        await chrome.scripting.executeScript({
          target: { tabId: this.currentTab.id },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
      } catch (scriptError) {
        console.log('Content script may already be injected:', scriptError.message);
      }

      // Wait a moment for content script to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Request page scan from content script with timeout
      const response = await Promise.race([
        chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'scanPage'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Scan timeout - page took too long to respond')), 15000)
        )
      ]);

      if (response && response.success) {
        this.pageData = response.data;
        console.log('Page data received:', this.pageData);
        
        // Enable chat interface
        this.enableChatInterface();
        
        // Create scan summary message
        let scanSummary = `✅ Page scan completed!\n\n`;
        scanSummary += `📄 **Page:** ${this.pageData.title}\n`;
        scanSummary += `🌐 **Domain:** ${this.pageData.domain}\n`;
        scanSummary += `📊 **Type:** ${this.pageData.pageType}\n`;
        
        if (this.pageData.products && this.pageData.products.length > 0) {
          scanSummary += `🛍️ **Products found:** ${this.pageData.products.length}\n`;
        }
        
        if (this.pageData.prices && this.pageData.prices.length > 0) {
          scanSummary += `💰 **Prices detected:** ${this.pageData.prices.length}\n`;
        }
        
        if (this.pageData.reviews && this.pageData.reviews.length > 0) {
          scanSummary += `⭐ **Reviews found:** ${this.pageData.reviews.length}\n`;
        }
        
        scanSummary += `\nNow you can ask me anything about this page! Try questions like:\n• "What products are on this page?"\n• "What are the prices?"\n• "Summarize the content"\n• "What should I know about this?"`;
        
        this.addChatMessage('ai', scanSummary);
        
        this.updateStatus('Scan complete', 'success');
        
        // Save session after successful scan
        await this.saveSession();
      } else {
        throw new Error(response?.error || 'Scan failed - no response from content script');
      }
    } catch (error) {
      console.error('Scan error:', error);
      let errorMessage = 'Failed to scan page. ';
      
      if (error.message.includes('timeout')) {
        errorMessage += 'The page took too long to respond. Try refreshing the page and waiting for it to fully load.';
      } else if (error.message.includes('Cannot access') || error.message.includes('active tab')) {
        errorMessage += 'Cannot access the current tab. Make sure you have a webpage open.';
      } else if (this.currentTab?.url?.startsWith('chrome://') || this.currentTab?.url?.startsWith('chrome-extension://')) {
        errorMessage += 'Cannot scan Chrome internal pages. Please navigate to a regular website.';
      } else {
        errorMessage += 'This can happen on secure pages that block extensions. Try a different page or refresh this one.';
      }
      
      this.showError(errorMessage);
      this.updateStatus('Scan failed', 'error');
      
      // Add error message to chat
      this.addChatMessage('ai', `❌ Sorry, I had trouble scanning this page.\n\n**Error:** ${error.message}\n\n**Troubleshooting:**\n• Refresh the current page\n• Wait for the page to fully load\n• Try on a different webpage\n• Avoid Chrome internal pages (chrome://)`);
    } finally {
      this.setButtonLoading(scanBtn, false);
    }
  }

  enableChatInterface() {
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const suggestionBtns = document.querySelectorAll('.suggestion-btn');
    
    if (this.pageData) {
      chatInput.disabled = false;
      sendChatBtn.disabled = false;
      chatInput.placeholder = "Ask me anything about this page...";
      
      suggestionBtns.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
      });
    } else {
      chatInput.disabled = true;
      sendChatBtn.disabled = true;
      chatInput.placeholder = "Scan the page first, then ask me anything...";
      
      suggestionBtns.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      });
    }
  }

  async sendChatMessage(predefinedQuery = null) {
    const chatInput = document.getElementById('chatInput');
    const message = predefinedQuery || chatInput.value.trim();
    
    if (!message) return;
    
    // Clear input if not predefined
    if (!predefinedQuery) {
      chatInput.value = '';
    }
    
    // Add user message
    this.addChatMessage('user', message);
    
    // Show typing indicator
    const typingId = this.addChatMessage('ai', '💭 Thinking...', false);
    
    try {
      // Check if we have page data
      if (!this.pageData) {
        throw new Error('Please scan the page first before asking questions.');
      }

      // Check authentication
      if (!this.isAuthenticated) {
        throw new Error('Please connect your API key first.');
      }

      // Send to AI service with better error handling
      const response = await Promise.race([
        chrome.runtime.sendMessage({
          action: 'chatWithAI',
          message: message,
          pageData: this.pageData,
          chatHistory: this.chatHistory.slice(-10), // Last 10 messages for context
          timestamp: Date.now()
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Chat request timeout')), 30000)
        )
      ]);
      
      // Remove typing indicator
      this.removeChatMessage(typingId);
      
      if (response && response.success) {
        this.addChatMessage('ai', response.reply);
      } else if (response && response.error) {
        console.error('Chat API error:', response.error);
        let errorMessage = response.error;
        
        // Make error messages more user-friendly
        if (errorMessage.includes('Unknown action')) {
          errorMessage = 'There was a problem connecting to the AI service. Please try refreshing the extension.';
        } else if (errorMessage.includes('API key')) {
          errorMessage = 'Please check your OpenAI API key in settings.';
        } else if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
          errorMessage = 'API quota exceeded. Please check your OpenAI billing limits.';
        }
        
        this.addChatMessage('ai', `I apologize, but I encountered an issue: ${errorMessage}`);
      } else {
        console.error('Chat failed with no response');
        this.addChatMessage('ai', 'I apologize, but I didn\'t receive a response. Please try refreshing the extension.');
      }
    } catch (error) {
      console.error('Chat error:', error);
      this.removeChatMessage(typingId);
      
      let errorMessage = 'I apologize, but there was an issue processing your request.\n\n';
      
      if (error.message.includes('scan the page first')) {
        errorMessage += '**Please scan the page first** before asking questions. Click the "Scan" button above to analyze the current webpage.';
      } else if (error.message.includes('API key')) {
        errorMessage += '**Please connect your API key** first. You can do this in the settings.';
      } else if (error.message.includes('timeout')) {
        errorMessage += '**The request timed out.** Please check your internet connection and try again.';
      } else {
        errorMessage += '**Troubleshooting steps:**\n• Refresh the extension\n• Check your internet connection\n• Try scanning the page again';
      }
      
      this.addChatMessage('ai', errorMessage);
    }
    
    // Save session after chat
    await this.saveSession();
  }

  addChatMessage(sender, content, saveToHistory = true) {
    const chatMessages = document.getElementById('chatMessages');
    const messageId = Date.now() + Math.random();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    messageDiv.dataset.messageId = messageId;
    
    const avatar = sender === 'ai' ? '🤖' : '👤';
    
    messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        ${this.formatChatMessage(content)}
      </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Store in chat history (exclude system messages like typing indicators)
    if (saveToHistory && !content.includes('💭 Thinking...')) {
      this.chatHistory.push({
        sender: sender,
        content: content,
        timestamp: Date.now()
      });
      
      // Limit chat history to prevent memory issues
      if (this.chatHistory.length > 50) {
        this.chatHistory = this.chatHistory.slice(-30);
      }
    }
    
    return messageId;
  }

  removeChatMessage(messageId) {
    const message = document.querySelector(`[data-message-id="${messageId}"]`);
    if (message) {
      message.remove();
    }
  }

  formatChatMessage(content) {
    // Handle different content types
    if (typeof content === 'string') {
      // Convert newlines to <br> and handle basic formatting
      return content
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/•/g, '&bull;');
    }
    return content;
  }

  async loadSessionData() {
    if (!this.isAuthenticated || !this.currentTab) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSession',
        tabId: this.currentTab.id
      });

      if (response && response.success && response.session) {
        const session = response.session;
        
        if (session.scanData) {
          this.pageData = session.scanData;
          // Enable chat if data is available
          this.enableChatInterface();
        }
      }
    } catch (error) {
      console.error('Failed to load session data:', error);
    }
  }

  updateStatus(text, type = 'success') {
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    
    statusText.textContent = text;
    statusDot.className = `status-dot ${type}`;
    
    // Reset to default after 3 seconds for non-success states
    if (type !== 'success') {
      setTimeout(() => {
        statusText.textContent = this.isAuthenticated ? 'Connected' : 'Not Connected';
        statusDot.className = this.isAuthenticated ? 'status-dot success' : 'status-dot error';
      }, 3000);
    }
  }

  setButtonLoading(button, loading) {
    const loader = button.querySelector('.loader');
    const span = button.querySelector('span');
    
    if (loading) {
      button.classList.add('loading');
      if (loader) loader.style.display = 'inline-block';
      if (span) span.style.opacity = '0';
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      if (loader) loader.style.display = 'none';
      if (span) span.style.opacity = '1';
      button.disabled = false;
    }
  }

  showError(message) {
    console.error(message);
    this.updateStatus(message, 'error');
  }

  showSuccess(message) {
    console.log(message);
    this.updateStatus(message, 'success');
  }
}

// Initialize the popup controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
}); 