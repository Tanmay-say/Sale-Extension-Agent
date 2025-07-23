// Content script for AI Chatbot Extension
class PageScanner {
  constructor() {
    this.pageData = {};
    this.isScanning = false;
    this.init();
  }

  init() {
    try {
      // Listen for messages from popup/background
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scanPage') {
          console.log('Received scan request from popup');
          this.scanPage().then(data => {
            console.log('Scan completed, sending response:', data);
            sendResponse({ success: true, data });
          }).catch(error => {
            console.error('Scan failed:', error);
            sendResponse({ success: false, error: error.message });
          });
          return true; // Will respond asynchronously
        }
      });

      // Auto-scan when page loads
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.autoScan());
      } else {
        this.autoScan();
      }
      
      console.log('PageScanner initialized for:', window.location.href);
    } catch (error) {
      console.error('Error initializing PageScanner:', error);
    }
  }

  async autoScan() {
    try {
      // Wait a bit for page to fully load
      setTimeout(async () => {
        try {
          const data = await this.scanPage();
          // Send data to background script for processing
          chrome.runtime.sendMessage({
            action: 'pageScanned',
            url: window.location.href,
            data: data
          }).catch(() => {
            // Background script might not be ready, store locally
            console.log('Background script not ready, storing data locally');
          });
        } catch (error) {
          console.log('Auto-scan failed:', error);
        }
      }, 2000);
    } catch (error) {
      console.log('Auto-scan setup failed:', error);
    }
  }

  async scanPage() {
    if (this.isScanning) return this.pageData;
    
    this.isScanning = true;
    
    try {
      console.log('Starting page scan for:', window.location.href);
      
      const data = {
        url: window.location.href,
        title: document.title || 'Untitled Page',
        description: this.getMetaDescription(),
        content: this.extractMainContent(),
        products: this.extractProductInfo(),
        prices: this.extractPrices(),
        images: this.extractImages(),
        reviews: this.extractReviews(),
        categories: this.extractCategories(),
        specifications: this.extractSpecifications(),
        availability: this.extractAvailability(),
        seller: this.extractSellerInfo(),
        timestamp: Date.now(),
        domain: window.location.hostname,
        pageType: this.detectPageType()
      };
      
      console.log('Scan completed:', data);
      this.pageData = data;
      return data;
    } catch (error) {
      console.error('Error during page scan:', error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  getMetaDescription() {
    try {
      const metaDesc = document.querySelector('meta[name="description"]');
      return metaDesc ? metaDesc.getAttribute('content') : '';
    } catch (error) {
      console.error('Error getting meta description:', error);
      return '';
    }
  }

  extractMainContent() {
    try {
      // Try to find main content areas
      const selectors = [
        'main',
        '[role="main"]',
        '.main-content',
        '#main-content',
        '.content',
        '#content',
        'article',
        '.product-details',
        '.product-info'
      ];

      let content = '';
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          content = this.cleanText(element.innerText);
          break;
        }
      }

      // Fallback to body if no main content found
      if (!content) {
        content = this.cleanText(document.body.innerText).substring(0, 5000);
      }

      return content;
    } catch (error) {
      console.error('Error extracting main content:', error);
      return 'Error extracting content';
    }
  }

  extractProductInfo() {
    try {
      const products = [];
      
      // Common product selectors
      const productSelectors = [
        '.product',
        '.item',
        '[data-product]',
        '.product-item',
        '.listing-item',
        '.search-result'
      ];

      productSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element, index) => {
            if (index < 10) { // Limit to first 10 products
              const product = this.extractSingleProduct(element);
              if (product.name) {
                products.push(product);
              }
            }
          });
        } catch (error) {
          console.error(`Error with selector ${selector}:`, error);
        }
      });

      // If no products found, try to extract single product page info
      if (products.length === 0) {
        const singleProduct = this.extractSingleProductPage();
        if (singleProduct.name) {
          products.push(singleProduct);
        }
      }

      return products;
    } catch (error) {
      console.error('Error extracting product info:', error);
      return [];
    }
  }

  extractSingleProduct(element) {
    try {
      const product = {
        name: '',
        price: '',
        image: '',
        description: '',
        rating: '',
        link: ''
      };

      // Extract product name
      const nameSelectors = ['.product-name', '.title', 'h1', 'h2', 'h3', '[data-title]'];
      product.name = this.getTextFromSelectors(element, nameSelectors);

      // Extract price
      const priceSelectors = ['.price', '.cost', '[data-price]', '.amount'];
      product.price = this.getTextFromSelectors(element, priceSelectors);

      // Extract image
      const img = element.querySelector('img');
      product.image = img ? img.src : '';

      // Extract description
      const descSelectors = ['.description', '.summary', '.excerpt'];
      product.description = this.getTextFromSelectors(element, descSelectors);

      // Extract rating
      const ratingSelectors = ['.rating', '.stars', '.review-score'];
      product.rating = this.getTextFromSelectors(element, ratingSelectors);

      // Extract link
      const link = element.querySelector('a');
      product.link = link ? link.href : '';

      return product;
    } catch (error) {
      console.error('Error extracting single product:', error);
      return { name: '', price: '', image: '', description: '', rating: '', link: '' };
    }
  }

  extractSingleProductPage() {
    try {
      const product = {
        name: '',
        price: '',
        image: '',
        description: '',
        rating: '',
        link: window.location.href
      };

      // Product name from title or heading
      product.name = document.title || 
                    this.getTextFromSelectors(document, ['h1', '.product-title', '.product-name']);

      // Price
      product.price = this.getTextFromSelectors(document, [
        '.price', '.cost', '.amount', '[data-price]', '.price-current'
      ]);

      // Main product image
      const mainImg = document.querySelector('.product-image img, .main-image img, .hero-image img') ||
                     document.querySelector('img[alt*="product"], img[alt*="main"]') ||
                     document.querySelector('img');
      product.image = mainImg ? mainImg.src : '';

      // Product description
      product.description = this.getTextFromSelectors(document, [
        '.product-description', '.description', '.summary', '.overview'
      ]);

      // Rating
      product.rating = this.getTextFromSelectors(document, [
        '.rating', '.stars', '.review-score', '.rating-value'
      ]);

      return product;
    } catch (error) {
      console.error('Error extracting single product page:', error);
      return { name: '', price: '', image: '', description: '', rating: '', link: window.location.href };
    }
  }

  extractPrices() {
    try {
      const prices = [];
      const priceRegex = /[$€£¥₹]\s*[\d,]+\.?\d*/g;
      const text = document.body.innerText;
      const matches = text.match(priceRegex);
      
      if (matches) {
        prices.push(...new Set(matches.slice(0, 10))); // Unique prices, limit 10
      }
      
      return prices;
    } catch (error) {
      console.error('Error extracting prices:', error);
      return [];
    }
  }

  extractImages() {
    try {
      const images = [];
      const imgs = document.querySelectorAll('img');
      
      imgs.forEach((img, index) => {
        if (index < 5 && img.src && img.width > 100 && img.height > 100) {
          images.push({
            src: img.src,
            alt: img.alt || '',
            width: img.width,
            height: img.height
          });
        }
      });
      
      return images;
    } catch (error) {
      console.error('Error extracting images:', error);
      return [];
    }
  }

  extractReviews() {
    try {
      const reviews = [];
      const reviewSelectors = [
        '.review',
        '.testimonial',
        '.comment',
        '[data-review]',
        '.rating-comment',
        '.user-review'
      ];

      reviewSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element, index) => {
            if (index < 5) { // Limit to 5 reviews
              const review = {
                text: this.cleanText(element.innerText),
                rating: this.getTextFromSelectors(element, ['.rating', '.stars', '.score'])
              };
              if (review.text.length > 20) {
                reviews.push(review);
              }
            }
          });
        } catch (error) {
          console.error(`Error with review selector ${selector}:`, error);
        }
      });

      return reviews;
    } catch (error) {
      console.error('Error extracting reviews:', error);
      return [];
    }
  }

  extractCategories() {
    try {
      const categories = [];
      
      // Breadcrumb categories
      const breadcrumbs = document.querySelectorAll('.breadcrumb a, .breadcrumbs a, nav a');
      breadcrumbs.forEach(link => {
        const text = this.cleanText(link.innerText);
        if (text && text !== 'Home') {
          categories.push(text);
        }
      });

      // Navigation categories
      const navLinks = document.querySelectorAll('nav a, .navigation a, .menu a');
      navLinks.forEach((link, index) => {
        if (index < 5) {
          const text = this.cleanText(link.innerText);
          if (text && text.length > 2) {
            categories.push(text);
          }
        }
      });

      return [...new Set(categories)]; // Remove duplicates
    } catch (error) {
      console.error('Error extracting categories:', error);
      return [];
    }
  }

  extractSpecifications() {
    try {
      const specs = [];
      
      // Common specification selectors
      const specSelectors = [
        '.specifications table tr',
        '.specs-table tr',
        '.product-details table tr',
        '.feature-list li',
        '.attributes li',
        '[data-spec]'
      ];

      specSelectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            const spec = this.extractSpecFromElement(element);
            if (spec.name && spec.value) {
              specs.push(spec);
            }
          });
        } catch (error) {
          console.error(`Error with spec selector ${selector}:`, error);
        }
      });

      return specs.slice(0, 20); // Limit to 20 specs
    } catch (error) {
      console.error('Error extracting specifications:', error);
      return [];
    }
  }

  extractSpecFromElement(element) {
    try {
      const spec = { name: '', value: '' };
      
      // Try different structures
      const nameEl = element.querySelector('td:first-child, .spec-name, .attr-name');
      const valueEl = element.querySelector('td:last-child, .spec-value, .attr-value');
      
      if (nameEl && valueEl) {
        spec.name = this.cleanText(nameEl.innerText);
        spec.value = this.cleanText(valueEl.innerText);
      } else {
        // Try colon-separated format
        const text = element.innerText;
        if (text.includes(':')) {
          const parts = text.split(':');
          if (parts.length >= 2) {
            spec.name = this.cleanText(parts[0]);
            spec.value = this.cleanText(parts.slice(1).join(':'));
          }
        }
      }
      
      return spec;
    } catch (error) {
      console.error('Error extracting spec from element:', error);
      return { name: '', value: '' };
    }
  }

  extractAvailability() {
    try {
      const availability = {
        inStock: false,
        stockLevel: '',
        deliveryInfo: '',
        shippingInfo: ''
      };

      // Stock status
      const stockSelectors = [
        '.availability',
        '.stock-status',
        '.in-stock',
        '.out-of-stock',
        '[data-availability]'
      ];

      stockSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.innerText.toLowerCase();
          availability.inStock = text.includes('in stock') || text.includes('available');
          availability.stockLevel = this.cleanText(element.innerText);
        }
      });

      // Delivery info
      const deliverySelectors = [
        '.delivery-info',
        '.shipping-info',
        '.delivery-time',
        '.prime-delivery'
      ];

      deliverySelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          availability.deliveryInfo += this.cleanText(element.innerText) + ' ';
        }
      });

      return availability;
    } catch (error) {
      console.error('Error extracting availability:', error);
      return { inStock: false, stockLevel: '', deliveryInfo: '', shippingInfo: '' };
    }
  }

  extractSellerInfo() {
    try {
      const seller = {
        name: '',
        rating: '',
        location: '',
        returnPolicy: ''
      };

      // Seller name
      const sellerSelectors = [
        '.seller-name',
        '.merchant-name',
        '.sold-by',
        '[data-seller]'
      ];

      sellerSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element && !seller.name) {
          seller.name = this.cleanText(element.innerText);
        }
      });

      // Seller rating
      const ratingSelectors = [
        '.seller-rating',
        '.merchant-rating',
        '.seller-stars'
      ];

      ratingSelectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element && !seller.rating) {
          seller.rating = this.cleanText(element.innerText);
        }
      });

      return seller;
    } catch (error) {
      console.error('Error extracting seller info:', error);
      return { name: '', rating: '', location: '', returnPolicy: '' };
    }
  }

  detectPageType() {
    try {
      const url = window.location.href.toLowerCase();
      const title = document.title.toLowerCase();
      
      if (url.includes('/dp/') || url.includes('/product/') || url.includes('/item/')) {
        return 'product';
      } else if (url.includes('/search') || url.includes('/s?') || title.includes('search results')) {
        return 'search';
      } else if (url.includes('/category/') || url.includes('/browse/')) {
        return 'category';
      } else if (url.includes('/cart') || url.includes('/basket')) {
        return 'cart';
      } else if (url.includes('/checkout')) {
        return 'checkout';
      }
      
      return 'other';
    } catch (error) {
      console.error('Error detecting page type:', error);
      return 'unknown';
    }
  }

  getTextFromSelectors(parent, selectors) {
    try {
      for (const selector of selectors) {
        const element = parent.querySelector(selector);
        if (element) {
          return this.cleanText(element.innerText);
        }
      }
      return '';
    } catch (error) {
      console.error('Error getting text from selectors:', error);
      return '';
    }
  }

  cleanText(text) {
    try {
      return text ? text.trim().replace(/\s+/g, ' ').substring(0, 500) : '';
    } catch (error) {
      console.error('Error cleaning text:', error);
      return '';
    }
  }
}

// Initialize the page scanner
try {
  // Add global access for debugging
  window.aiChatbotScanner = new PageScanner();
  console.log('AI Chatbot scanner ready');
} catch (error) {
  console.error('Failed to initialize AI Chatbot scanner:', error);
} 