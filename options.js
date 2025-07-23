// Options page script for AI Sales Agent Extension

class OptionsController {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    await this.checkApiStatus();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get([
        'userCredentials',
        'userSettings'
      ]);

      // Load API credentials
      if (result.userCredentials) {
        const credentials = this.decryptCredentials(result.userCredentials);
        if (credentials && credentials.apiKey) {
          document.getElementById('apiKey').value = credentials.apiKey;
        }
      }

      // Load user settings
      const settings = result.userSettings || {};
      document.getElementById('autoScan').checked = settings.autoScan !== false;
      document.getElementById('notifications').checked = settings.notifications !== false;
      document.getElementById('saveSession').checked = settings.saveSession !== false;
      document.getElementById('theme').value = settings.theme || 'light';
      document.getElementById('aiModel').value = settings.aiModel || 'gpt-3.5-turbo';

    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  setupEventListeners() {
    // API form submission
    const apiForm = document.getElementById('apiForm');
    apiForm.addEventListener('submit', (e) => this.handleApiSubmit(e));

    // Clear API button
    const clearApiBtn = document.getElementById('clearApi');
    clearApiBtn.addEventListener('click', () => this.clearApiCredentials());

    // Settings change listeners
    const settingInputs = document.querySelectorAll('#autoScan, #notifications, #saveSession, #theme, #aiModel');
    settingInputs.forEach(input => {
      input.addEventListener('change', () => this.saveSettings());
    });

    // Privacy actions
    const clearDataBtn = document.getElementById('clearData');
    clearDataBtn.addEventListener('click', () => this.clearAllData());

    const exportDataBtn = document.getElementById('exportData');
    exportDataBtn.addEventListener('click', () => this.exportSettings());

    // Reset settings
    const resetBtn = document.getElementById('resetSettings');
    resetBtn.addEventListener('click', () => this.resetToDefaults());
  }

  async handleApiSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const apiKey = document.getElementById('apiKey').value.trim();

    if (!apiKey) {
      this.showError('Please enter your API key');
      return;
    }

    if (!this.validateApiKey(apiKey)) {
      this.showError('Invalid API key format. It should start with "sk-"');
      return;
    }

    this.setButtonLoading(submitBtn, true);

    try {
      // Test API connection
      const response = await chrome.runtime.sendMessage({
        action: 'authenticateUser',
        credentials: { apiKey }
      });

      if (response.success) {
        await this.saveApiCredentials(apiKey);
        this.updateApiStatus(true);
        this.showSuccess('API key saved and tested successfully!');
      } else {
        this.showError(response.error || 'API key validation failed');
        this.updateApiStatus(false);
      }
    } catch (error) {
      console.error('API test failed:', error);
      this.showError('Failed to connect to OpenAI. Please check your API key.');
      this.updateApiStatus(false);
    } finally {
      this.setButtonLoading(submitBtn, false);
    }
  }

  validateApiKey(apiKey) {
    return apiKey.startsWith('sk-') && apiKey.length > 20;
  }

  async saveApiCredentials(apiKey) {
    try {
      const aiModel = document.getElementById('aiModel').value;
      const credentials = { apiKey, aiModel };
      
      await chrome.storage.local.set({
        userCredentials: this.encryptCredentials(credentials),
        lastAuth: Date.now()
      });
    } catch (error) {
      console.error('Failed to save API credentials:', error);
      throw error;
    }
  }

  async clearApiCredentials() {
    if (confirm('Are you sure you want to clear your API credentials?')) {
      try {
        await chrome.storage.local.remove(['userCredentials', 'lastAuth']);
        document.getElementById('apiKey').value = '';
        this.updateApiStatus(false);
        this.showSuccess('API credentials cleared');
      } catch (error) {
        console.error('Failed to clear credentials:', error);
        this.showError('Failed to clear credentials');
      }
    }
  }

  async saveSettings() {
    try {
      const settings = {
        autoScan: document.getElementById('autoScan').checked,
        notifications: document.getElementById('notifications').checked,
        saveSession: document.getElementById('saveSession').checked,
        theme: document.getElementById('theme').value,
        aiModel: document.getElementById('aiModel').value
      };

      await chrome.storage.local.set({ userSettings: settings });
      
      // If API key exists, update it with new model selection
      const result = await chrome.storage.local.get(['userCredentials']);
      if (result.userCredentials) {
        const credentials = this.decryptCredentials(result.userCredentials);
        if (credentials) {
          credentials.aiModel = settings.aiModel;
          await chrome.storage.local.set({
            userCredentials: this.encryptCredentials(credentials)
          });
        }
      }

      this.showSuccess('Settings saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showError('Failed to save settings');
    }
  }

  async checkApiStatus() {
    try {
      const result = await chrome.storage.local.get(['userCredentials']);
      const hasCredentials = !!result.userCredentials;
      this.updateApiStatus(hasCredentials);
    } catch (error) {
      console.error('Failed to check API status:', error);
      this.updateApiStatus(false);
    }
  }

  updateApiStatus(connected) {
    const statusBadge = document.getElementById('apiStatus');
    
    if (connected) {
      statusBadge.textContent = 'Connected';
      statusBadge.className = 'status-badge connected';
    } else {
      statusBadge.textContent = 'Not Connected';
      statusBadge.className = 'status-badge';
    }
  }

  async clearAllData() {
    const confirmText = 'Are you sure you want to clear all extension data? This action cannot be undone.';
    
    if (confirm(confirmText)) {
      try {
        await chrome.storage.local.clear();
        
        // Reload settings to defaults
        await this.loadSettings();
        this.updateApiStatus(false);
        document.getElementById('apiKey').value = '';
        
        this.showSuccess('All data cleared successfully');
      } catch (error) {
        console.error('Failed to clear data:', error);
        this.showError('Failed to clear data');
      }
    }
  }

  async exportSettings() {
    try {
      const result = await chrome.storage.local.get(['userSettings']);
      const settings = result.userSettings || {};
      
      // Remove sensitive data for export
      const exportData = {
        ...settings,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ai-sales-agent-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showSuccess('Settings exported successfully');
    } catch (error) {
      console.error('Failed to export settings:', error);
      this.showError('Failed to export settings');
    }
  }

  async resetToDefaults() {
    if (confirm('Reset all settings to default values?')) {
      try {
        const defaultSettings = {
          autoScan: true,
          notifications: true,
          saveSession: true,
          theme: 'light',
          aiModel: 'gpt-3.5-turbo'
        };

        await chrome.storage.local.set({ userSettings: defaultSettings });
        
        // Update UI
        document.getElementById('autoScan').checked = true;
        document.getElementById('notifications').checked = true;
        document.getElementById('saveSession').checked = true;
        document.getElementById('theme').value = 'light';
        document.getElementById('aiModel').value = 'gpt-3.5-turbo';

        this.showSuccess('Settings reset to defaults');
      } catch (error) {
        console.error('Failed to reset settings:', error);
        this.showError('Failed to reset settings');
      }
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

  setButtonLoading(button, loading) {
    const loader = button.querySelector('.loader');
    const span = button.querySelector('span');
    
    if (loading) {
      button.classList.add('loading');
      loader.style.display = 'inline-block';
      span.style.opacity = '0';
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      loader.style.display = 'none';
      span.style.opacity = '1';
      button.disabled = false;
    }
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    // Remove existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(el => el.remove());

    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      font-size: 14px;
      font-weight: 500;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
      ${type === 'success' 
        ? 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;' 
        : 'background: #fee2e2; color: #991b1b; border: 1px solid #fecaca;'
      }
    `;

    // Add animation CSS if not exists
    if (!document.querySelector('#notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .notification-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .notification-close {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          opacity: 0.7;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .notification-close:hover {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => notification.remove());

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }
}

// Initialize the options controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
}); 