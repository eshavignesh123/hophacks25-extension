console.log('This is the background page.');
console.log('Put the background scripts here.');

// Donation management and storage
class DonationManager {
  constructor() {
    this.donations = [];
    this.defaultNonprofit = 'default';
    this.favoriteNonprofits = [];
    this.init();
  }

  init() {
    // Load saved data
    this.loadData();
    
    // Listen for messages from content script and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'storeDonation':
          this.storeDonation(request.data);
          sendResponse({ success: true });
          break;
        case 'getDonations':
          sendResponse({ donations: this.donations });
          break;
        case 'getDonationStats':
          sendResponse({ stats: this.getDonationStats() });
          break;
        case 'setDefaultNonprofit':
          this.setDefaultNonprofit(request.nonprofit);
          sendResponse({ success: true });
          break;
        case 'addFavoriteNonprofit':
          this.addFavoriteNonprofit(request.nonprofit);
          sendResponse({ success: true });
          break;
        case 'removeFavoriteNonprofit':
          this.removeFavoriteNonprofit(request.nonprofit);
          sendResponse({ success: true });
          break;
        case 'getNonprofitSettings':
          sendResponse({
            defaultNonprofit: this.defaultNonprofit,
            favoriteNonprofits: this.favoriteNonprofits
          });
          break;
      }
    });
  }

  storeDonation(donationData) {
    this.donations.push(donationData);
    this.saveData();
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'Donation Recorded',
      message: `$${donationData.amount.toFixed(2)} donated to ${this.getNonprofitName(donationData.nonprofit)}`
    });
  }

  getDonationStats() {
    const totalDonated = this.donations.reduce((sum, donation) => sum + donation.amount, 0);
    const totalRounded = this.donations.reduce((sum, donation) => sum + donation.originalAmount, 0);
    const donationCount = this.donations.length;
    
    // Group by nonprofit
    const nonprofitStats = {};
    this.donations.forEach(donation => {
      const nonprofit = donation.nonprofit;
      if (!nonprofitStats[nonprofit]) {
        nonprofitStats[nonprofit] = { count: 0, amount: 0 };
      }
      nonprofitStats[nonprofit].count++;
      nonprofitStats[nonprofit].amount += donation.amount;
    });

    return {
      totalDonated,
      totalRounded,
      donationCount,
      nonprofitStats,
      averageDonation: donationCount > 0 ? totalDonated / donationCount : 0
    };
  }

  setDefaultNonprofit(nonprofit) {
    this.defaultNonprofit = nonprofit;
    this.saveData();
  }

  addFavoriteNonprofit(nonprofit) {
    if (!this.favoriteNonprofits.includes(nonprofit)) {
      this.favoriteNonprofits.push(nonprofit);
      this.saveData();
    }
  }

  removeFavoriteNonprofit(nonprofit) {
    const index = this.favoriteNonprofits.indexOf(nonprofit);
    if (index > -1) {
      this.favoriteNonprofits.splice(index, 1);
      this.saveData();
    }
  }

  getNonprofitName(nonprofitId) {
    const nonprofitNames = {
      'default': 'Default Nonprofit',
      'red-cross': 'American Red Cross',
      'unicef': 'UNICEF',
      'doctors-without-borders': 'Doctors Without Borders',
      'world-wildlife': 'World Wildlife Fund',
      'feeding-america': 'Feeding America'
    };
    return nonprofitNames[nonprofitId] || nonprofitId;
  }

  saveData() {
    const data = {
      donations: this.donations,
      defaultNonprofit: this.defaultNonprofit,
      favoriteNonprofits: this.favoriteNonprofits
    };
    chrome.storage.local.set({ donationData: data });
  }

  loadData() {
    chrome.storage.local.get(['donationData'], (result) => {
      if (result.donationData) {
        this.donations = result.donationData.donations || [];
        this.defaultNonprofit = result.donationData.defaultNonprofit || 'default';
        this.favoriteNonprofits = result.donationData.favoriteNonprofits || [];
      }
    });
  }
}

// Initialize donation manager
const donationManager = new DonationManager();
