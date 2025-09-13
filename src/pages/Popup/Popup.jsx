import React, { useState, useEffect } from 'react';
import logo from '../../assets/img/logo.svg';
import './Popup.css';
import { getNonprofits, getUserFavorites } from '../../firebase-config';

const Popup = () => {
  const [stats, setStats] = useState({
    totalDonated: 0,
    donationCount: 0,
    averageDonation: 0,
    nonprofitStats: {}
  });
  const [selectedNonprofit, setSelectedNonprofit] = useState('red-cross');
  const [detectedAmount, setDetectedAmount] = useState(0);
  const [roundUpAmount, setRoundUpAmount] = useState(0);
  const [activeTab, setActiveTab] = useState('donate');
  const [nonprofits, setNonprofits] = useState([]);
  const [favoriteNonprofits, setFavoriteNonprofits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDonationStats();
    loadNonprofits();
    checkForDetectedPurchase();
    
    // Listen for purchase detection from content script
    const handleMessage = (request, sender, sendResponse) => {
      if (request.action === 'purchaseDetected') {
        setDetectedAmount(request.amount);
        setRoundUpAmount(request.roundUp);
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const loadDonationStats = () => {
    chrome.runtime.sendMessage({ action: 'getDonationStats' }, (response) => {
      if (response && response.stats) {
        setStats(response.stats);
      }
    });
  };

  const checkForDetectedPurchase = () => {
    chrome.runtime.sendMessage({ action: 'getPurchaseData' }, (response) => {
      if (response && response.purchaseData) {
        // Check if there's a detected purchase
        if (response.purchaseData.detectedAmount) {
          setDetectedAmount(response.purchaseData.detectedAmount);
          setRoundUpAmount(response.purchaseData.roundUpAmount);
        }
      }
    });
  };

  const loadNonprofits = async () => {
    try {
      setLoading(true);
      const [nonprofitsData, favoritesData] = await Promise.all([
        getNonprofits(),
        getUserFavorites('user123') // Mock user ID
      ]);
      
      setNonprofits(nonprofitsData);
      setFavoriteNonprofits(favoritesData);
      
      // Set default nonprofit to first favorite if available
      if (favoritesData.length > 0) {
        setSelectedNonprofit(favoritesData[0]);
      }
    } catch (error) {
      console.error('Error loading nonprofits:', error);
      // Fallback to hardcoded list
      setNonprofits([
        { id: 'default', name: 'Default Nonprofit' },
        { id: 'red-cross', name: 'American Red Cross' },
        { id: 'unicef', name: 'UNICEF' },
        { id: 'doctors-without-borders', name: 'Doctors Without Borders' },
        { id: 'world-wildlife', name: 'World Wildlife Fund' },
        { id: 'feeding-america', name: 'Feeding America' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDonate = () => {
    if (roundUpAmount <= 0) {
      alert('No purchase detected. Please make a purchase first to see the round-up amount.');
      return;
    }

    const donationData = {
      amount: roundUpAmount,
      nonprofit: selectedNonprofit,
      originalAmount: detectedAmount,
      timestamp: new Date().toISOString(),
      url: 'detected_purchase'
    };

    chrome.runtime.sendMessage({
      action: 'storeDonation',
      data: donationData
    }, () => {
      loadDonationStats();
      alert(`Thank you! $${roundUpAmount.toFixed(2)} donated to ${getNonprofitName(selectedNonprofit)}`);
      // Reset the detected amounts after donation
      setDetectedAmount(0);
      setRoundUpAmount(0);
    });
  };

  const getNonprofitName = (nonprofitId) => {
    const nonprofitNames = {
      'default': 'Default Nonprofit',
      'red-cross': 'American Red Cross',
      'unicef': 'UNICEF',
      'doctors-without-borders': 'Doctors Without Borders',
      'world-wildlife': 'World Wildlife Fund',
      'feeding-america': 'Feeding America'
    };
    return nonprofitNames[nonprofitId] || nonprofitId;
  };

  // Get nonprofits for donation dropdown (all nonprofits except default)
  const availableNonprofits = nonprofits;

  return (
    <div className="popup-container">
      <div className="popup-header">
        <img src={logo} className="popup-logo" alt="logo" />
        <h1>Round Up for Good</h1>
      </div>

      <div className="tab-container">
        <button 
          className={`tab-button ${activeTab === 'donate' ? 'active' : ''}`}
          onClick={() => setActiveTab('donate')}
        >
          Donate
        </button>
        <button 
          className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Stats
        </button>
      </div>

      {activeTab === 'donate' && (
        <div className="donate-container">
          <div className="donation-form">
            {detectedAmount > 0 ? (
              <div className="purchase-info">
                <h3>Purchase Detected!</h3>
                <div className="amount-display">
                  <div className="purchase-amount">
                    <span className="label">Purchase Total:</span>
                    <span className="amount">${detectedAmount.toFixed(2)}</span>
                  </div>
                  <div className="roundup-amount">
                    <span className="label">Round Up:</span>
                    <span className="amount highlight">${roundUpAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-purchase">
                <h3>No Purchase Detected</h3>
                <p>Make a purchase on any shopping website to see the round-up amount here.</p>
              </div>
            )}
            
            <div className="form-group">
              <label>Choose Nonprofit</label>
              <select 
                value={selectedNonprofit}
                onChange={(e) => setSelectedNonprofit(e.target.value)}
                className="nonprofit-select"
              >
                {availableNonprofits.map(nonprofit => (
                  <option key={nonprofit.id} value={nonprofit.id}>
                    {nonprofit.name}
                  </option>
                ))}
              </select>
            </div>
            
            <button 
              className="donate-button"
              onClick={handleDonate}
              disabled={roundUpAmount <= 0}
            >
              {roundUpAmount > 0 ? `Donate $${roundUpAmount.toFixed(2)}` : 'No Purchase Detected'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="stats-container">
          <div className="stat-card">
            <h3>Total Donated</h3>
            <p className="stat-value">${stats.totalDonated.toFixed(2)}</p>
          </div>
          
          <div className="stat-card">
            <h3>Donations Made</h3>
            <p className="stat-value">{stats.donationCount}</p>
          </div>
          
          <div className="stat-card">
            <h3>Average Donation</h3>
            <p className="stat-value">${stats.averageDonation.toFixed(2)}</p>
          </div>

          {Object.keys(stats.nonprofitStats).length > 0 && (
            <div className="nonprofit-stats">
              <h3>Donations by Nonprofit</h3>
              {Object.entries(stats.nonprofitStats).map(([nonprofit, data]) => (
                <div key={nonprofit} className="nonprofit-stat-item">
                  <span className="nonprofit-name">{getNonprofitName(nonprofit)}</span>
                  <span className="nonprofit-amount">${data.amount.toFixed(2)} ({data.count} donations)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      <div className="popup-footer">
        <p className="footer-text">
          Round up your purchases to make a difference!
        </p>
      </div>
    </div>
  );
};

export default Popup;
