import { printLine } from './modules/print';

console.log('Content script works!');
console.log('Must reload extension for modifications to take effect.');

printLine("Using the 'printLine' function from the Print Module");

// Purchase detection and round-up donation functionality
class PurchaseDetector {
  constructor() {
    this.observers = [];
    this.isDonationModalOpen = false;
    this.lastDetectedAmount = 0;
    this.lastRoundUpAmount = 0;
    this.init();
  }

  init() {
    console.log('PurchaseDetector initialized');
    
    // Listen for DOM changes to detect purchase completion
    this.observePageChanges();
    
    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getPurchaseData') {
        sendResponse({ purchaseData: this.getCurrentPurchaseData() });
      }
    });
    
    // Check immediately on load
    setTimeout(() => {
      this.checkForPurchaseCompletion();
    }, 1000);
  }

  observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'subtree') {
          this.checkForPurchaseCompletion();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  checkForPurchaseCompletion() {
    console.log('Checking for purchase completion...');
    
    // Common selectors for purchase completion pages
    const purchaseSelectors = [
      '[data-testid*="order-confirmation"]',
      '[data-testid*="checkout-success"]',
      '.order-confirmation',
      '.checkout-success',
      '.purchase-complete',
      '.thank-you',
      '[class*="confirmation"]',
      '[class*="success"]',
      '[class*="complete"]',
      'body.purchase-complete' // For our test page
    ];

    const totalSelectors = [
      '[data-testid*="total"]',
      '[data-testid*="amount"]',
      '.total',
      '.amount',
      '.price',
      '[class*="total"]',
      '[class*="amount"]',
      '[class*="price"]',
      '.order-total',
      '.checkout-total',
      '.final-total'
    ];

    // Check if we're on a purchase completion page
    const isPurchasePage = purchaseSelectors.some(selector => {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Found purchase page element:', selector, element);
        return true;
      }
      return false;
    });

    // Also check for our test page specifically
    const isTestPage = document.body.classList.contains('purchase-complete');
    console.log('Is test page:', isTestPage);
    console.log('Is purchase page:', isPurchasePage);
    console.log('Modal open:', this.isDonationModalOpen);

    if ((isPurchasePage || isTestPage) && !this.isDonationModalOpen) {
      const totalAmount = this.extractTotalAmount(totalSelectors);
      console.log('Extracted total amount:', totalAmount);
      if (totalAmount > 0) {
        const roundUpAmount = this.calculateRoundUp(totalAmount);
        
        // Store the amounts for popup access
        this.lastDetectedAmount = totalAmount;
        this.lastRoundUpAmount = roundUpAmount;
        
        console.log('Purchase detected, showing donation modal for amount:', totalAmount);
        this.showDonationModal(totalAmount);
        
        // Send data to popup
        chrome.runtime.sendMessage({
          action: 'purchaseDetected',
          amount: totalAmount,
          roundUp: roundUpAmount
        });
      }
    }
  }

  extractTotalAmount(selectors) {
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || element.innerText;
        const amount = this.parseAmount(text);
        if (amount > 0) {
          return amount;
        }
      }
    }
    return 0;
  }

  parseAmount(text) {
    // Extract monetary amounts from text
    const amountRegex = /[\$]?(\d+\.?\d*)/g;
    const matches = text.match(amountRegex);
    
    if (matches) {
      // Find the largest amount (likely the total)
      const amounts = matches.map(match => {
        const num = parseFloat(match.replace('$', ''));
        return isNaN(num) ? 0 : num;
      });
      
      return Math.max(...amounts);
    }
    
    return 0;
  }

  calculateRoundUp(amount) {
    return Math.ceil(amount) - amount;
  }

  showDonationModal(totalAmount) {
    this.isDonationModalOpen = true;
    const roundUpAmount = this.calculateRoundUp(totalAmount);
    
    // Get nonprofit settings from background script
    chrome.runtime.sendMessage({ action: 'getNonprofitSettings' }, (response) => {
      if (response) {
        this.createDonationModal(totalAmount, roundUpAmount, response);
      } else {
        // Fallback if no response
        this.createDonationModal(totalAmount, roundUpAmount, {
          defaultNonprofit: 'default',
          favoriteNonprofits: []
        });
      }
    });
  }

  createDonationModal(totalAmount, roundUpAmount, nonprofitSettings) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.id = 'donation-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;

    // Build nonprofit options with favorites first
    const nonprofitOptions = this.buildNonprofitOptions(nonprofitSettings);
    
    modalContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0 0 8px 0; color: #1f2937; font-size: 24px;">Round Up for Good</h2>
        <p style="margin: 0; color: #6b7280; font-size: 16px;">
          Round up your purchase of $${totalAmount.toFixed(2)} to donate $${roundUpAmount.toFixed(2)}?
        </p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; color: #374151; font-weight: 500;">
          Choose a nonprofit:
        </label>
        <select id="nonprofit-select" style="
          width: 100%;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 16px;
          background: white;
        ">
          ${nonprofitOptions}
        </select>
      </div>
      
      <div style="display: flex; gap: 12px;">
        <button id="donate-btn" style="
          flex: 1;
          padding: 12px 24px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
        ">Donate $${roundUpAmount.toFixed(2)}</button>
        <button id="skip-btn" style="
          flex: 1;
          padding: 12px 24px;
          background: #f3f4f6;
          color: #374151;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
        ">Skip</button>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Set default selection
    const select = document.getElementById('nonprofit-select');
    select.value = nonprofitSettings.defaultNonprofit;

    // Add event listeners
    document.getElementById('donate-btn').addEventListener('click', () => {
      const selectedNonprofit = document.getElementById('nonprofit-select').value;
      this.processDonation(roundUpAmount, selectedNonprofit, totalAmount);
      this.closeModal();
    });

    document.getElementById('skip-btn').addEventListener('click', () => {
      this.closeModal();
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });
  }

  buildNonprofitOptions(nonprofitSettings) {
    const nonprofitNames = {
      'default': 'Default Nonprofit',
      'red-cross': 'American Red Cross',
      'unicef': 'UNICEF',
      'doctors-without-borders': 'Doctors Without Borders',
      'world-wildlife': 'World Wildlife Fund',
      'feeding-america': 'Feeding America'
    };

    let options = '';
    
    // Add default nonprofit first
    options += `<option value="default">${nonprofitNames['default']}</option>`;
    
    // Add favorite nonprofits
    nonprofitSettings.favoriteNonprofits.forEach(nonprofitId => {
      if (nonprofitId !== 'default' && nonprofitNames[nonprofitId]) {
        options += `<option value="${nonprofitId}">${nonprofitNames[nonprofitId]}</option>`;
      }
    });
    
    // Add separator if there are favorites
    if (nonprofitSettings.favoriteNonprofits.length > 0) {
      options += '<option disabled>────────────</option>';
    }
    
    // Add other nonprofits (excluding default and favorites)
    const allNonprofits = ['red-cross', 'unicef', 'doctors-without-borders', 'world-wildlife', 'feeding-america'];
    allNonprofits.forEach(nonprofitId => {
      if (!nonprofitSettings.favoriteNonprofits.includes(nonprofitId)) {
        options += `<option value="${nonprofitId}">${nonprofitNames[nonprofitId]}</option>`;
      }
    });

    return options;
  }

  processDonation(amount, nonprofit, originalAmount) {
    // Store donation data
    const donationData = {
      amount: amount,
      nonprofit: nonprofit,
      originalAmount: originalAmount,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    // Send to background script for storage
    chrome.runtime.sendMessage({
      action: 'storeDonation',
      data: donationData
    });

    // Show confirmation
    this.showDonationConfirmation(amount, nonprofit);
  }

  showDonationConfirmation(amount, nonprofit) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    `;
    
    notification.textContent = `Thank you! $${amount.toFixed(2)} donated to ${nonprofit}`;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  closeModal() {
    const modal = document.getElementById('donation-modal');
    if (modal) {
      modal.remove();
      this.isDonationModalOpen = false;
    }
  }

  getCurrentPurchaseData() {
    // Return current purchase data for popup
    return {
      hasActivePurchase: this.isDonationModalOpen,
      detectedAmount: this.lastDetectedAmount || 0,
      roundUpAmount: this.lastRoundUpAmount || 0
    };
  }
}

// Initialize purchase detector
const purchaseDetector = new PurchaseDetector();
