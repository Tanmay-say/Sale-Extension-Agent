// Popup script for AI Chatbot Extension

class PopupController {
  constructor() {
    this.currentTab = null;
    this.isAuthenticated = false;
    this.pageData = null;
    this.chatHistory = [];
    this.init();
  }

  async init() {
    // Get current tab
    await this.getCurrentTab();
    
    // Check authentication status
    await this.checkAuthStatus();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Listen for background messages
    this.setupMessageListener();
    
    // Load session data
    await this.loadSessionData();
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
      const result = await chrome.storage.local.get(['userCredentials']);
      this.isAuthenticated = !!result.userCredentials;
      this.updateUI();
    } catch (error) {
      console.error('Failed to check auth status:', error);
    }
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

      if (response.success) {
        this.isAuthenticated = true;
        this.updateUI();
        this.updateStatus('Connected successfully!', 'success');
        
        // Add welcome message to chat
        this.addChatMessage('ai', 'Perfect! I\'m now connected and ready to help. Click the "Scan" button above to analyze the current webpage, then ask me anything about it!');
      } else {
        this.showError(response.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      this.showError('Connection failed. Please check your API key and try again.');
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
    const typingId = this.addChatMessage('ai', '💭 Thinking...');
    
    try {
      // Send to AI service
      const response = await chrome.runtime.sendMessage({
        action: 'chatWithAI',
        message: message,
        pageData: this.pageData,
        chatHistory: this.chatHistory.slice(-10) // Last 10 messages for context
      });
      
      // Remove typing indicator
      this.removeChatMessage(typingId);
      
      if (response.success) {
        this.addChatMessage('ai', response.reply);
      } else {
        this.addChatMessage('ai', 'Sorry, I encountered an error. Please try again or check your connection.');
      }
    } catch (error) {
      console.error('Chat error:', error);
      this.removeChatMessage(typingId);
      this.addChatMessage('ai', 'Sorry, I had trouble processing your request. Please check your connection and try again.');
    }
  }

  addChatMessage(sender, content) {
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
    if (!content.includes('💭 Thinking...')) {
      this.chatHistory.push({
        sender: sender,
        content: content,
        timestamp: Date.now()
      });
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

      if (response.success && response.session) {
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