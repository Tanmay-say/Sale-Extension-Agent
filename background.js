// Background service worker for AI Chatbot Extension

class SessionManager {
  constructor() {
    this.init();
    this.sessions = new Map();
    this.aiService = new AIService();
  }

  init() {
    // Handle installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.handleFirstInstall();
      }
    });

    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Will respond asynchronously
    });

    // Handle tab changes
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });

    // Handle tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdated(tabId, tab);
      }
    });

    // Load existing sessions on startup
    this.loadSessions();
  }

  async handleFirstInstall() {
    // Initialize default settings
    await chrome.storage.local.set({
      userSettings: {
        aiProvider: 'openai',
        autoScan: true,
        notifications: true,
        theme: 'light'
      },
      sessions: {},
      userCredentials: null
    });

    // Open welcome page
    chrome.tabs.create({ url: 'options.html' });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      console.log('Background received message:', message.action);

      // Validate message format
      if (!message || !message.action) {
        console.error('Invalid message format:', message);
        return sendResponse({ success: false, error: 'Invalid message format' });
      }

      switch (message.action) {
        case 'pageScanned':
          await this.handlePageScanned(message, sender);
          sendResponse({ success: true });
          break;

        case 'chatWithAI':
          if (!message.message || !message.pageData) {
            console.error('Invalid chat request:', message);
            sendResponse({ success: false, error: 'Invalid chat request format' });
            return;
          }
          const chatResponse = await this.handleChatWithAI(message);
          sendResponse(chatResponse);
          break;

        case 'authenticateUser':
          if (!message.credentials) {
            console.error('Invalid auth request:', message);
            sendResponse({ success: false, error: 'Invalid authentication request' });
            return;
          }
          const authResult = await this.authenticateUser(message.credentials);
          sendResponse(authResult);
          break;

        case 'getSession':
          if (!message.tabId) {
            console.error('Invalid session request:', message);
            sendResponse({ success: false, error: 'Invalid session request' });
            return;
          }
          const session = await this.getSession(message.tabId);
          sendResponse({ success: true, session });
          break;

        case 'updateSession':
          if (!message.tabId || !message.data) {
            console.error('Invalid session update:', message);
            sendResponse({ success: false, error: 'Invalid session update request' });
            return;
          }
          await this.updateSession(message.tabId, message.data);
          sendResponse({ success: true });
          break;

        default:
          console.warn('Unknown action:', message.action);
          sendResponse({ 
            success: false, 
            error: `Unknown action: ${message.action}. Please refresh the extension.` 
          });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ 
        success: false, 
        error: error.message || 'An unexpected error occurred' 
      });
    }
  }

  async handlePageScanned(message, sender) {
    const tabId = sender.tab.id;
    const pageData = message.data;

    // Update session with scanned data
    await this.updateSession(tabId, {
      url: message.url,
      scanData: pageData,
      lastScan: Date.now()
    });

    // Process data with AI if user is authenticated
    const credentials = await this.getUserCredentials();
    if (credentials) {
      this.processPageDataWithAI(tabId, pageData);
    }
  }

  async handleChatWithAI(message) {
    try {
      console.log('Processing chat request...');
      
      const credentials = await this.getUserCredentials();
      if (!credentials || !credentials.apiKey) {
        return { success: false, error: 'User not authenticated. Please connect your API key first.' };
      }

      const { message: userMessage, pageData, chatHistory } = message;
      
      if (!userMessage || userMessage.trim().length === 0) {
        return { success: false, error: 'Please enter a message to send.' };
      }

      if (!pageData) {
        return { success: false, error: 'No page data available. Please scan the page first.' };
      }

      // Set credentials for AI service
      await this.aiService.setCredentials(credentials);
      
      // Generate contextual response
      console.log('Generating AI response...');
      const reply = await this.aiService.generateChatResponse(userMessage, pageData, chatHistory);
      
      if (!reply) {
        throw new Error('No response received from AI service');
      }

      console.log('AI response generated successfully');
      return { success: true, reply };
    } catch (error) {
      console.error('Chat AI error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'An error occurred while processing your request.';
      
      if (error.message.includes('API key')) {
        errorMessage = 'Invalid API key. Please check your OpenAI API key in settings.';
      } else if (error.message.includes('quota') || error.message.includes('billing')) {
        errorMessage = 'API quota exceeded. Please check your OpenAI billing and usage limits.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again with a shorter message.';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async processPageDataWithAI(tabId, pageData) {
    try {
      const analysis = await this.aiService.analyzePageData(pageData);
      
      // Update session with AI analysis
      await this.updateSession(tabId, {
        aiAnalysis: analysis,
        lastAnalysis: Date.now()
      });

      // Notify popup if it's open
      this.notifyPopup(tabId, {
        type: 'analysisComplete',
        analysis: analysis
      });

    } catch (error) {
      console.error('AI analysis failed:', error);
    }
  }

  async getRecommendations(pageData) {
    const credentials = await this.getUserCredentials();
    if (!credentials) {
      throw new Error('User not authenticated');
    }

    await this.aiService.setCredentials(credentials);
    return await this.aiService.getRecommendations(pageData);
  }

  async getSimilarProducts(product) {
    const credentials = await this.getUserCredentials();
    if (!credentials) {
      throw new Error('User not authenticated');
    }

    await this.aiService.setCredentials(credentials);
    return await this.aiService.findSimilarProducts(product);
  }

  async getProductReviews(product) {
    const credentials = await this.getUserCredentials();
    if (!credentials) {
      throw new Error('User not authenticated');
    }

    await this.aiService.setCredentials(credentials);
    return await this.aiService.getProductReviews(product);
  }

  async authenticateUser(credentials) {
    try {
      console.log('Authenticating user...');
      
      // Validate credentials with AI service
      const isValid = await this.aiService.validateCredentials(credentials);
      
      if (isValid) {
        // Store encrypted credentials
        await chrome.storage.local.set({
          userCredentials: this.encryptCredentials(credentials),
          lastAuth: Date.now()
        });

        console.log('Authentication successful');
        return { success: true, message: 'Authentication successful' };
      } else {
        console.log('Authentication failed - invalid credentials');
        return { success: false, error: 'Invalid API key. Please check your OpenAI API key and try again.' };
      }
    } catch (error) {
      console.error('Authentication error:', error);
      
      let errorMessage = 'Authentication failed.';
      if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error during authentication. Please check your internet connection.';
      } else if (error.message.includes('quota') || error.message.includes('billing')) {
        errorMessage = 'API key is valid but has no available credits. Please check your OpenAI billing.';
      }
      
      return { success: false, error: errorMessage };
    }
  }

  async getUserCredentials() {
    try {
      const result = await chrome.storage.local.get(['userCredentials']);
      if (result.userCredentials) {
        return this.decryptCredentials(result.userCredentials);
      }
      return null;
    } catch (error) {
      console.error('Failed to get credentials:', error);
      return null;
    }
  }

  encryptCredentials(credentials) {
    // Simple encoding - in production, use proper encryption
    return btoa(JSON.stringify(credentials));
  }

  decryptCredentials(encryptedCredentials) {
    try {
      return JSON.parse(atob(encryptedCredentials));
    } catch (error) {
      console.error('Failed to decrypt credentials:', error);
      return null;
    }
  }

  async getSession(tabId) {
    const sessions = await this.loadSessions();
    return sessions[tabId] || this.createNewSession(tabId);
  }

  async updateSession(tabId, data) {
    const sessions = await this.loadSessions();
    
    if (!sessions[tabId]) {
      sessions[tabId] = this.createNewSession(tabId);
    }

    // Merge new data with existing session
    sessions[tabId] = { ...sessions[tabId], ...data };
    sessions[tabId].lastUpdated = Date.now();

    // Save sessions
    await chrome.storage.local.set({ sessions });
    this.sessions.set(tabId, sessions[tabId]);
  }

  createNewSession(tabId) {
    return {
      tabId: tabId,
      created: Date.now(),
      lastUpdated: Date.now(),
      scanData: null,
      aiAnalysis: null,
      userInteractions: [],
      preferences: {}
    };
  }

  async loadSessions() {
    try {
      const result = await chrome.storage.local.get(['sessions']);
      return result.sessions || {};
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return {};
    }
  }

  async handleTabActivated(activeInfo) {
    // Clean up old sessions periodically
    await this.cleanupOldSessions();
    
    // Ensure session exists for active tab
    await this.getSession(activeInfo.tabId);
  }

  async handleTabUpdated(tabId, tab) {
    // Update session with new URL if changed
    const session = await this.getSession(tabId);
    if (session.url !== tab.url) {
      await this.updateSession(tabId, { url: tab.url });
    }
  }

  async cleanupOldSessions() {
    const sessions = await this.loadSessions();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    const cleanedSessions = {};
    for (const [tabId, session] of Object.entries(sessions)) {
      if (now - session.lastUpdated < maxAge) {
        cleanedSessions[tabId] = session;
      }
    }

    await chrome.storage.local.set({ sessions: cleanedSessions });
  }

  notifyPopup(tabId, message) {
    // Send message to popup if it's listening
    chrome.runtime.sendMessage({
      target: 'popup',
      tabId: tabId,
      ...message
    }).catch(() => {
      // Popup not open, ignore error
    });
  }
}

class AIService {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://api.openai.com/v1';
    this.model = 'gpt-3.5-turbo';
  }

  async setCredentials(credentials) {
    this.apiKey = credentials.apiKey;
    this.model = credentials.aiModel || 'gpt-3.5-turbo';
  }

  async validateCredentials(credentials) {
    this.apiKey = credentials.apiKey;
    
    try {
      console.log('Validating API credentials...');
      
      // Test API key with a simple request
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const responseText = await response.text();
      
      if (response.ok) {
        console.log('API credentials validated successfully');
        return true;
      } else {
        console.error('API validation failed:', response.status, responseText);
        return false;
      }
    } catch (error) {
      console.error('Credential validation failed:', error);
      return false;
    }
  }

  async generateChatResponse(userMessage, pageData, chatHistory = []) {
    if (!this.apiKey) {
      throw new Error('No API key available');
    }

    const systemPrompt = this.createChatSystemPrompt(pageData);
    const messages = [{ role: 'system', content: systemPrompt }];
    
    // Add recent chat history for context (last 6 messages)
    const recentHistory = chatHistory.slice(-6);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });
    
    // Add current user message
    messages.push({ role: 'user', content: userMessage });
    
    try {
      console.log('Making OpenAI API request...');
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          max_tokens: 800,
          temperature: 0.7,
          stream: false
        })
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.error('OpenAI API error:', response.status, responseText);
        
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your OpenAI API key.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else if (response.status === 402) {
          throw new Error('Quota exceeded. Please check your OpenAI billing and usage limits.');
        } else {
          throw new Error(`API request failed with status ${response.status}: ${responseText}`);
        }
      }

      const data = JSON.parse(responseText);
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from OpenAI API');
      }
      
      const reply = data.choices[0].message.content;
      console.log('OpenAI response received successfully');
      
      return reply;
    } catch (error) {
      console.error('Chat AI failed:', error);
      throw error;
    }
  }

  createChatSystemPrompt(pageData) {
    let prompt = `You are an AI assistant helping users understand and analyze web pages. You have access to information from the current web page they're viewing.

Current page information:
- URL: ${pageData?.url || 'Unknown'}
- Domain: ${pageData?.domain || 'Unknown'}
- Page Type: ${pageData?.pageType || 'Unknown'}
- Title: ${pageData?.title || 'Unknown'}`;

    if (pageData?.products && pageData.products.length > 0) {
      prompt += `\n\nProducts found (${pageData.products.length}):`;
      pageData.products.slice(0, 3).forEach((product, i) => {
        prompt += `\n${i + 1}. ${product.name}`;
        if (product.price) prompt += ` - ${product.price}`;
        if (product.rating) prompt += ` (Rating: ${product.rating})`;
        if (product.description) prompt += `\n   Description: ${product.description.substring(0, 200)}`;
      });
    }

    if (pageData?.prices && pageData.prices.length > 0) {
      prompt += `\n\nPrices detected: ${pageData.prices.slice(0, 5).join(', ')}`;
    }

    if (pageData?.reviews && pageData.reviews.length > 0) {
      prompt += `\n\nReviews found: ${pageData.reviews.length} reviews available`;
      if (pageData.reviews[0]) {
        prompt += `\nSample review: "${pageData.reviews[0].text.substring(0, 150)}..."`;
      }
    }

    if (pageData?.specifications && pageData.specifications.length > 0) {
      prompt += `\n\nSpecifications (${pageData.specifications.length}):`;
      pageData.specifications.slice(0, 5).forEach(spec => {
        prompt += `\n- ${spec.name}: ${spec.value}`;
      });
    }

    if (pageData?.availability) {
      prompt += `\n\nAvailability: ${pageData.availability.inStock ? 'In Stock' : 'Out of Stock'}`;
      if (pageData.availability.deliveryInfo) {
        prompt += `\nDelivery: ${pageData.availability.deliveryInfo}`;
      }
    }

    if (pageData?.categories && pageData.categories.length > 0) {
      prompt += `\n\nCategories: ${pageData.categories.slice(0, 3).join(', ')}`;
    }

    prompt += `\n\nPlease help the user with their questions about this page/content. Be helpful, friendly, and provide specific insights based on the available data. If they ask about comparisons, prices, features, or recommendations, use the information provided. Keep responses concise but informative.`;

    return prompt;
  }

  async analyzePageData(pageData) {
    if (!this.apiKey) {
      throw new Error('No API key available');
    }

    const prompt = this.createAnalysisPrompt(pageData);
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant analyzing web pages to provide helpful recommendations and insights. Be concise and actionable.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return this.parseAnalysisResponse(data.choices[0].message.content);
    } catch (error) {
      console.error('AI analysis failed:', error);
      throw error;
    }
  }

  createAnalysisPrompt(pageData) {
    return `Analyze this webpage data and provide insights:

URL: ${pageData?.url}
Title: ${pageData?.title}
Description: ${pageData?.description}
Products: ${JSON.stringify(pageData?.products || [])}
Prices: ${pageData?.prices?.join(', ') || 'None'}
Categories: ${pageData?.categories?.join(', ') || 'None'}

Provide:
1. Product insights and recommendations
2. Price analysis
3. Similar product suggestions
4. Buying advice

Format as JSON with sections: insights, recommendations, similar_products, advice`;
  }

  parseAnalysisResponse(response) {
    try {
      return JSON.parse(response);
    } catch (error) {
      // Fallback to structured text parsing
      return {
        insights: response.substring(0, 200),
        recommendations: ['Check for better prices', 'Read reviews'],
        similar_products: [],
        advice: 'Consider comparing with similar products'
      };
    }
  }

  async getRecommendations(pageData) {
    const analysis = await this.analyzePageData(pageData);
    return analysis.recommendations || [];
  }

  async findSimilarProducts(product) {
    if (!this.apiKey) {
      throw new Error('No API key available');
    }

    try {
      const prompt = `Based on this product: "${product.name}" with price ${product.price}, suggest 3 similar or alternative products that might be better value or quality. Include product names, estimated prices, and brief reasons why they're good alternatives.

Format as JSON array with objects containing: name, price, reason`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are a product research assistant. Provide realistic product alternatives with helpful insights.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 400,
          temperature: 0.8
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const suggestions = data.choices[0].message.content;
      
      try {
        return JSON.parse(suggestions);
      } catch {
        // Fallback similar products
        return [
          { name: 'Alternative Product 1', price: '$99', rating: '4.5', reason: 'Better value for money' },
          { name: 'Alternative Product 2', price: '$89', rating: '4.3', reason: 'Higher quality materials' }
        ];
      }
    } catch (error) {
      console.error('Similar products AI failed:', error);
      // Return fallback products
      return [
        { name: 'Similar Product 1', price: '$99', rating: '4.5' },
        { name: 'Similar Product 2', price: '$89', rating: '4.3' }
      ];
    }
  }

  async getProductReviews(product) {
    // Placeholder for review analysis
    return [
      { rating: 5, text: 'Great product, highly recommended!' },
      { rating: 4, text: 'Good value for money' }
    ];
  }
}

// Initialize the session manager
const sessionManager = new SessionManager(); 