# AI Sales Agent Chrome Extension

An intelligent shopping assistant that scans web pages and provides personalized recommendations, price analysis, and product insights using AI.

## Features

🔍 **Intelligent Page Scanning** - Automatically analyzes web pages to detect products, prices, and reviews

🤖 **AI-Powered Recommendations** - Get personalized suggestions and insights from OpenAI's GPT models

💰 **Price Analysis** - Compare prices and find better deals across different sites

⭐ **Review Analysis** - Sentiment analysis of product reviews to help make informed decisions

🔄 **Cross-Tab Session Management** - Keep your analysis results when switching between tabs

🔒 **Secure Local Storage** - All data stored locally with encrypted API credentials

## Installation

### Method 1: Load as Unpacked Extension (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The AI Sales Agent extension should appear in your extensions list
6. Pin it to your toolbar for easy access

**Note**: The extension currently loads without custom icons to avoid errors. See `ICONS_SETUP.md` for instructions on adding icons (optional).

### Method 2: From Chrome Web Store (Coming Soon)

*This extension will be available on the Chrome Web Store soon.*

## Setup

### 1. Get OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com)
2. Sign in to your account (or create one)
3. Go to the API section and create a new API key
4. Copy the API key (starts with `sk-`)
5. **Important**: Ensure your OpenAI account has billing information set up

### 2. Configure Extension

1. Click the AI Sales Agent icon in your Chrome toolbar
2. Enter your OpenAI API key in the authentication form
3. Click "Connect" to test and save your credentials
4. (Optional) Click the settings button to customize preferences

## Usage

### Basic Usage

1. **Navigate to any shopping website** (Amazon, eBay, product pages, etc.)
2. **Click the extension icon** to open the popup
3. **Click "Scan"** to analyze the current page
4. **View recommendations** and insights provided by the AI

### Features Overview

#### Page Analysis
- Automatically detects products, prices, and descriptions
- Extracts reviews and ratings
- Identifies product categories and specifications

#### AI Recommendations
- Get buying advice based on page content
- Price analysis and comparison suggestions
- Product quality insights from review analysis

#### Similar Products
- Find alternative products with better ratings or prices
- Compare features across different options
- Get suggestions for complementary items

#### Session Management
- Analysis results persist when switching tabs
- Session data automatically cleans up after 24 hours
- Settings and preferences saved across browser sessions

## Settings & Configuration

Access the settings page by clicking the settings button in the popup or extension options.

### API Configuration
- **OpenAI API Key**: Your personal API key for AI analysis
- **AI Model**: Choose between GPT-3.5 Turbo (faster) or GPT-4 (higher quality)

### Extension Settings
- **Auto-scan Pages**: Automatically analyze pages when you visit them
- **Show Notifications**: Display notifications for recommendations and deals
- **Save Session Data**: Keep analysis results when switching tabs
- **Theme**: Choose between light, dark, or auto themes

### Privacy & Data
- **Clear All Data**: Remove all stored extension data
- **Export Settings**: Save your settings configuration
- **Reset to Defaults**: Restore all settings to default values

## Privacy & Security

### Data Collection
- **Page content**: Only for AI analysis (products, prices, reviews)
- **API credentials**: Stored locally and encrypted
- **Settings**: Extension preferences and configuration
- **Session data**: Temporary analysis results (auto-deleted after 24 hours)

### Data Protection
- ✅ All data stored locally on your device
- ✅ API keys encrypted before storage
- ✅ No data sent to third-party servers (except OpenAI for analysis)
- ✅ Automatic cleanup of old session data
- ✅ No tracking or analytics

## Supported Websites

The extension works on most e-commerce and product websites, including:

- **Amazon** - Product pages, search results, reviews
- **eBay** - Listings, auctions, product details
- **Shopping sites** - Most major retailers and marketplaces
- **Product pages** - Individual product listings and details
- **Review sites** - Pages with product reviews and ratings

## Troubleshooting

### Common Issues

**Extension not working on a page**
- Ensure the page has loaded completely
- Try clicking "Scan" manually
- Check if the page has products or pricing information

**API key not working**
- Verify your API key starts with `sk-`
- Ensure your OpenAI account has billing set up
- Check your API usage limits on OpenAI platform

**No recommendations appearing**
- Make sure you've entered a valid API key
- Try scanning the page manually
- Check that the page contains product information

**Session data not persisting**
- Ensure "Save Session Data" is enabled in settings
- Check if you're in incognito mode (limited storage)
- Try refreshing the extension popup

### Getting Help

1. **Check Settings**: Ensure all configuration is correct
2. **Review Console**: Check browser developer console for errors
3. **Reset Extension**: Try clearing all data and reconfiguring
4. **Contact Support**: Report issues through the extension feedback

## Development

### Project Structure

```
extension-web/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for session management
├── content.js            # Page content scanning and analysis
├── popup.html/css/js     # Main extension popup interface
├── options.html/css/js   # Settings and configuration page
├── icons/               # Extension icons
└── README.md           # This file
```

### Building & Testing

1. **Load Extension**: Load as unpacked in Chrome
2. **Test Features**: Visit various shopping sites
3. **Check Console**: Monitor for errors in developer tools
4. **Update Code**: Make changes and reload extension

### API Integration

The extension integrates with OpenAI's API for intelligent analysis:

- **Model**: GPT-3.5 Turbo or GPT-4
- **Purpose**: Product analysis and recommendations
- **Data Flow**: Page content → OpenAI → Structured recommendations

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

### Development Setup

1. Clone the repository
2. Load as unpacked extension in Chrome
3. Make your changes
4. Test thoroughly on various websites
5. Submit a pull request

## License

This project is open source. Please see the LICENSE file for details.

## Version History

### v1.0.0 (Current)
- Initial release
- Basic page scanning and AI analysis
- OpenAI integration for recommendations
- Session management across tabs
- Settings and configuration page
- Secure credential storage

---

**Made with ❤️ for smarter shopping**

For support or questions, please check the extension settings page or submit an issue on the project repository. 