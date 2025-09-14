import React from "react";
import { useEffect, useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion, increment } from "firebase/firestore";
import "./Popup.css";
import { auth, db } from "../../firebase-config";

const Popup = () => {
  const [orderTotal, setOrderTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [charitiesInterestedIn, setCharitiesInterestedIn] = useState([]);
  const [selectedCharity, setSelectedCharity] = useState("");
  const [charityLoading, setCharityLoading] = useState(false);
  const [donationLoading, setDonationLoading] = useState(false);

  // ✅ Function to fetch user charity data
  const fetchUserCharities = async (userId) => {
    if (!userId) return;

    setCharityLoading(true);
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const charities = userData.charitiesInterestedIn || [];
        setCharitiesInterestedIn(charities);
        // Set first charity as default if available
        if (charities.length > 0) {
          setSelectedCharity(charities[0]);
        }
      } else {
        console.log('No user document found');
        setCharitiesInterestedIn([]);
      }
    } catch (error) {
      console.error('Error fetching user charities:', error);
      setCharitiesInterestedIn([]);
    } finally {
      setCharityLoading(false);
    }
  };

  useEffect(() => {
    // Set up authentication state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);

      // Fetch user charity data when user is authenticated
      if (user) {
        fetchUserCharities(user.uid);
      } else {
        setCharitiesInterestedIn([]);
        setSelectedCharity("");
      }
    });

    // Fetch the stored order total when popup loads
    const fetchOrderTotal = () => {
      chrome.storage.local.get(["lastOrderTotal", "lastUpdated"], (data) => {
        if (data.lastOrderTotal) {
          setOrderTotal(data.lastOrderTotal);
          setLastUpdated(data.lastUpdated ? new Date(data.lastUpdated) : null);
        }
        setLoading(false);
      });
    };

    fetchOrderTotal();

    // ✅ Listen for storage changes to update in real-time
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local' && changes.lastOrderTotal) {
        setOrderTotal(changes.lastOrderTotal.newValue);
        if (changes.lastUpdated) {
          setLastUpdated(new Date(changes.lastUpdated.newValue));
        }
      }
    };

    // Add listener for storage changes
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Cleanup listeners on unmount
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      unsubscribe();
    };
  }, []);

  // ✅ Function to refresh data manually
  const refreshData = () => {
    setLoading(true);
    chrome.storage.local.get(["lastOrderTotal", "lastUpdated"], (data) => {
      setOrderTotal(data.lastOrderTotal || null);
      setLastUpdated(data.lastUpdated ? new Date(data.lastUpdated) : null);
      setLoading(false);
    });
  };

  // ✅ Calculate round-up amount
  const getRoundUpAmount = () => {
    if (!orderTotal) return 0;
    const roundUp = Math.ceil(orderTotal) - orderTotal;
    return roundUp === 0 ? 1.00 : roundUp; // If already whole number, suggest $1
  };

  // ✅ Handle donation action
  const handleDonate = async () => {
    setDonationLoading(true);

    try {
      const donationAmount = getRoundUpAmount();
      const charityMessage = selectedCharity
        ? `Thank you for your $${donationAmount.toFixed(2)} donation to ${selectedCharity}!`
        : `Thank you for your $${donationAmount.toFixed(2)} donation!`;

      // Update donation tracking in Firebase if a charity is selected
      if (selectedCharity) {
        await updateDonationTracking(selectedCharity, donationAmount);
      }

      // Here you would integrate with your donation service
      alert(charityMessage);

      // Clear the stored total after donation
      chrome.storage.local.remove(['lastOrderTotal', 'lastUpdated']);
      setOrderTotal(null);
      setLastUpdated(null);
    } catch (error) {
      console.error('Error processing donation:', error);
      alert('There was an error processing your donation. Please try again.');
    } finally {
      setDonationLoading(false);
    }
  };

  // ✅ Format time ago
  const getTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // ✅ Authentication functions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthActionLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthActionLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setAuthError("");
    setEmail("");
    setPassword("");
  };

  // ✅ Function to update donation tracking in Firebase
  const updateDonationTracking = async (charityName, donationAmount) => {
    if (!user || !charityName) return;

    try {
      const userDocRef = doc(db, 'users', user.uid);

      // Get current user document to check if charitiesDonatedTo exists
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentDonations = userData.charitiesDonatedTo || {};

        // Get current charity data (array with [account_id, amount])
        const currentCharityData = currentDonations[charityName];

        if (currentCharityData && Array.isArray(currentCharityData) && currentCharityData.length >= 2) {
          // Charity exists, update the amount (second element)
          const accountId = currentCharityData[0]; // Keep existing account ID
          const currentAmount = currentCharityData[1] || 0;
          const newAmount = currentAmount + donationAmount;

          // Update with new amount, keeping the same account ID
          await updateDoc(userDocRef, {
            [`charitiesDonatedTo.${charityName}`]: [accountId, newAmount]
          });

          console.log(`Updated donation for ${charityName}: $${newAmount.toFixed(2)} (Account: ${accountId})`);
        } else {
          // Charity doesn't exist yet, create new entry with placeholder account ID
          const placeholderAccountId = `acct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          await updateDoc(userDocRef, {
            [`charitiesDonatedTo.${charityName}`]: [placeholderAccountId, donationAmount]
          });

          console.log(`Created new donation entry for ${charityName}: $${donationAmount.toFixed(2)} (Account: ${placeholderAccountId})`);
        }
      } else {
        console.error('User document not found');
      }
    } catch (error) {
      console.error('Error updating donation tracking:', error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="popup-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  // Show login page if user is not authenticated
  if (!user) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h1>Round Up 🎉</h1>
          <p className="header-subtitle">Sign in to start making a difference</p>
        </div>

        <div className="auth-container">
          <form onSubmit={handleAuth} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="auth-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="auth-input"
              />
            </div>

            {authError && (
              <div className="auth-error">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authActionLoading}
              className="auth-button"
            >
              {authActionLoading ? (
                <div className="button-loading">
                  <div className="button-spinner"></div>
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </div>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="auth-switch">
            <p>
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                type="button"
                onClick={toggleAuthMode}
                className="auth-switch-button"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <h1>Round Up 🎉</h1>
        <div className="header-actions">
          <button
            onClick={refreshData}
            className="refresh-button"
            title="Refresh"
          >
            ↻
          </button>
          <button
            onClick={handleSignOut}
            className="signout-button"
            title="Sign Out"
          >
            Sign Out
          </button>
        </div>
      </div>

      <div className="popup-content">

        {orderTotal !== null ? (
          <div className="donation-section">
            {/* Order Total Display */}
            <div className="amount-display">
              <div className="purchase-amount">
                <span className="label">Your order total:</span>
                <span className="amount">${orderTotal.toFixed(2)}</span>
              </div>
              {lastUpdated && (
                <div className="time-ago">
                  {getTimeAgo(lastUpdated)}
                </div>
              )}
            </div>

            {/* Donation Suggestion */}
            <div className="donation-suggestion">
              <div className="suggestion-text">
                Round up for charity?
              </div>
              <div className="suggestion-amount">
                Donate ${getRoundUpAmount().toFixed(2)}
              </div>
              <div className="suggestion-subtext">
                Every little bit helps! 💚
              </div>
            </div>

            {/* Charity Selection Dropdown */}
            {charitiesInterestedIn.length > 0 && (
              <div className="charity-selection">
                <label htmlFor="charity-select" className="charity-label">
                  Choose a charity:
                </label>
                <div className="charity-dropdown-container">
                  <select
                    id="charity-select"
                    value={selectedCharity}
                    onChange={(e) => setSelectedCharity(e.target.value)}
                    className="charity-dropdown"
                    disabled={charityLoading}
                  >
                    {charitiesInterestedIn.map((charity, index) => (
                      <option key={index} value={charity}>
                        {charity}
                      </option>
                    ))}
                  </select>
                  {charityLoading && (
                    <div className="charity-loading">
                      <div className="charity-spinner"></div>
                    </div>
                  )}
                </div>
                {selectedCharity && (
                  <div className="selected-charity-info">
                    <span className="charity-icon">❤️</span>
                    <span className="charity-name">{selectedCharity}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="action-buttons">
              <button
                onClick={handleDonate}
                className="donate-button"
                disabled={donationLoading}
              >
                {donationLoading ? (
                  <div className="button-loading">
                    <div className="button-spinner"></div>
                    Processing...
                  </div>
                ) : (
                  'Donate'
                )}
              </button>
              <button
                onClick={() => {
                  chrome.storage.local.remove(['lastOrderTotal', 'lastUpdated']);
                  setOrderTotal(null);
                  setLastUpdated(null);
                }}
                className="skip-button"
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <div className="no-purchase">
            <div className="no-purchase-icon">🛒</div>
            <h3>No recent Amazon orders found</h3>
            <p>
              Complete a purchase on Amazon and we'll help you round up for charity!
            </p>
            <button
              onClick={refreshData}
              className="check-again-button"
            >
              Check Again
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="popup-footer">
          <p className="footer-text">
            Round Up Extension • Make every purchase count
          </p>
        </div>
      </div>
    </div>
  );
}

export default Popup;