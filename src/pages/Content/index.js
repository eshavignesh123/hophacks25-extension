function getCheckoutTotal() {
  // ✅ Your selector + Amazon-specific selectors
  const selectors = [
    ".order-summary-line-definition", // Your site's selector (take last visible)
    "[data-test-id='order-summary-grand-total-amount']",
    "[data-testid='order-summary-grand-total-amount']",
    ".grand-total-price",
    ".order-summary-grand-total",
    ".a-size-medium.a-color-price.a-text-bold",
    ".a-price.a-text-price.a-size-medium.a-color-price",
    "[data-test-id='order-total']",
    ".order-summary .a-color-price.a-text-bold",
    ".a-color-price.a-text-bold",
    ".a-price-whole",
    "#grand-total-price",
    // Additional Amazon selectors for different checkout states
    ".pmts-summary-preview-single-item-amount",
    ".a-price-range",
    ".pmts-order-summary-line-amount",
  ];

  let priceElement = null;
  let foundSelector = null;

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        let elementToUse = null;

        // ✅ Special case: take the LAST visible .order-summary-line-definition
        if (selector === ".order-summary-line-definition") {
          const visibleElements = [...elements].filter(
            (el) =>
              el.offsetHeight > 0 &&
              el.offsetWidth > 0 &&
              el.textContent.trim().length > 0
          );
          if (visibleElements.length > 0) {
            elementToUse = visibleElements[visibleElements.length - 1];
          }
        } else {
          // Take first visible element for other selectors
          for (const el of elements) {
            if (
              el.offsetHeight > 0 &&
              el.offsetWidth > 0 &&
              el.textContent.trim().length > 0
            ) {
              elementToUse = el;
              break;
            }
          }
        }

        if (elementToUse) {
          priceElement = elementToUse;
          foundSelector = selector;
          break;
        }
      }
    } catch (e) {
      continue; // Ignore invalid selectors
    }
  }

  if (!priceElement) {
    console.warn("⚠️ Could not find order total element");
    return null;
  }

  const priceText = priceElement.textContent || priceElement.innerText;
  console.log(`✅ Found order total using selector "${foundSelector}":`, priceText);

  const cleanedText = priceText.replace(/\s+/g, " ").trim();

  const pricePatterns = [
    /\$\s*([\d,]+\.?\d*)/, // $123.45
    /USD\s*([\d,]+\.?\d*)/i, // USD 123.45
    /([\d,]+\.?\d*)\s*USD/i, // 123.45 USD
    /([\d,]+\.?\d*)\s*\$/, // 123.45 $
    /\b([\d,]{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/, // Generic number pattern
  ];

  let amount = null;
  for (const pattern of pricePatterns) {
    const match = cleanedText.match(pattern);
    if (match) {
      const numberStr = match[1].replace(/,/g, "");
      const parsed = parseFloat(numberStr);
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        break;
      }
    }
  }

  if (!amount) {
    console.warn("⚠️ Could not parse price from text:", priceText);
    return null;
  }

  console.log(`💰 Successfully parsed order total: $${amount.toFixed(2)}`);
  return amount;
}

// ✅ Enhanced function to update price with debouncing
let updateTimeout;
let lastKnownTotal = null;

function updatePriceWithDebounce() {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    const newTotal = getCheckoutTotal();
    if (newTotal && newTotal !== lastKnownTotal) {
      lastKnownTotal = newTotal;
      chrome.storage.local.set({ lastOrderTotal: newTotal });
      console.log("🔄 Order total updated:", newTotal);

      // Dispatch custom event for other parts of your extension
      window.dispatchEvent(new CustomEvent('priceUpdated', {
        detail: { total: newTotal }
      }));
    }
  }, 300); // 300ms debounce
}

// ✅ Multiple observation strategies
function setupPriceWatching() {
  // Strategy 1: Watch for DOM mutations
  const observerTargets = [
    "#subtotals-marketplace-table",
    ".a-container.order-summary",
    ".pmts-portal-root",
    "#checkout_displayAddressDiv",
    ".a-section.pmts-widget-section",
    document.body // Fallback
  ].map(sel => typeof sel === 'string' ? document.querySelector(sel) : sel)
    .filter(Boolean);

  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;

    for (const mutation of mutations) {
      // Check if any added/removed nodes contain price-related elements
      const nodes = [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])];
      for (const node of nodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches && (
            node.matches('.a-price, .order-summary, [class*="total"], [class*="amount"]') ||
            node.querySelector('.a-price, .order-summary, [class*="total"], [class*="amount"]')
          )) {
            shouldUpdate = true;
            break;
          }
        }
      }

      // Also check for attribute changes that might affect visibility
      if (mutation.type === 'attributes' &&
        ['class', 'style', 'hidden'].includes(mutation.attributeName)) {
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      updatePriceWithDebounce();
    }
  });

  // Observe multiple targets
  observerTargets.forEach(target => {
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden']
      });
    }
  });

  console.log("👀 Watching for price changes on", observerTargets.length, "targets");
}

// ✅ Strategy 2: Periodic polling as backup
function startPeriodicCheck() {
  setInterval(() => {
    const currentTotal = getCheckoutTotal();
    if (currentTotal && currentTotal !== lastKnownTotal) {
      lastKnownTotal = currentTotal;
      chrome.storage.local.set({ lastOrderTotal: currentTotal });
      console.log("🔄 Periodic check found price change:", currentTotal);
    }
  }, 2000); // Check every 2 seconds
}

// ✅ Strategy 3: Listen for common AJAX completion events
function setupAjaxListeners() {
  // Override XMLHttpRequest to detect AJAX calls
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this._url = url;
    return originalOpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('loadend', () => {
      // Check if this was a checkout-related AJAX call
      if (this._url && (
        this._url.includes('checkout') ||
        this._url.includes('order') ||
        this._url.includes('payment') ||
        this._url.includes('total')
      )) {
        console.log("🌐 AJAX call completed:", this._url);
        setTimeout(updatePriceWithDebounce, 100); // Small delay for DOM update
      }
    });

    return originalSend.apply(this, args);
  };

  // Also listen for fetch API
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input.url;

    return originalFetch.apply(this, arguments).then(response => {
      if (url && (
        url.includes('checkout') ||
        url.includes('order') ||
        url.includes('payment') ||
        url.includes('total')
      )) {
        console.log("🌐 Fetch call completed:", url);
        setTimeout(updatePriceWithDebounce, 100);
      }
      return response;
    });
  };
}

// ✅ Strategy 4: Watch for URL changes (in case of pushState/replaceState)
function setupURLWatcher() {
  let currentURL = window.location.href;

  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentURL) {
      currentURL = window.location.href;
      console.log("🔄 URL changed:", currentURL);
      setTimeout(updatePriceWithDebounce, 500); // Delay for new content to load
    }
  });

  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Also override pushState and replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    setTimeout(updatePriceWithDebounce, 500);
    return originalPushState.apply(this, args);
  };

  history.replaceState = function (...args) {
    setTimeout(updatePriceWithDebounce, 500);
    return originalReplaceState.apply(this, args);
  };
}

// 🚀 Initialize everything
console.log("My extension is running HAHAHAHAHAHAHAHAHAHHA");

// Get initial total
const initialTotal = getCheckoutTotal();
if (initialTotal) {
  lastKnownTotal = initialTotal;
  chrome.storage.local.set({ lastOrderTotal: initialTotal });
  console.log("📦 Initial order total saved:", initialTotal);
}

// Start all watching strategies
setupPriceWatching();
startPeriodicCheck();
setupAjaxListeners();
setupURLWatcher();

// ✅ Capture on form submissions and button clicks
document.addEventListener('click', (e) => {
  if (e.target.matches('input[type="submit"], button[type="submit"], .place-your-order-button, [name*="placeYourOrder"]')) {
    console.log("🖱️ Submit button clicked");
    const total = getCheckoutTotal();
    if (total) {
      chrome.storage.local.set({ lastOrderTotal: total });
      console.log("💾 Saved final order total before checkout:", total);
    }
  }
});

// ✅ Handle page visibility changes (user switching tabs/returning)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log("👁️ Page became visible, checking price");
    setTimeout(updatePriceWithDebounce, 200);
  }
});

// ✅ Handle window focus events
window.addEventListener('focus', () => {
  setTimeout(updatePriceWithDebounce, 200);
});