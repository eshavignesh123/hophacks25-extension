import React from "react";
import { useEffect, useState } from "react";

const Popup = () => {
  const [orderTotal, setOrderTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
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

    // Cleanup listener on unmount
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
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
  const handleDonate = () => {
    const donationAmount = getRoundUpAmount();
    // Here you would integrate with your donation service
    alert(`Thank you for your ${donationAmount.toFixed(2)} donation!`);

    // Clear the stored total after donation
    chrome.storage.local.remove(['lastOrderTotal', 'lastUpdated']);
    setOrderTotal(null);
    setLastUpdated(null);
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

  if (loading) {
    return (
      <div className="p-4 w-72">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 w-72 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Round Up 🎉</h1>
        <button
          onClick={refreshData}
          className="text-sm text-blue-600 hover:text-blue-800"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {orderTotal !== null ? (
        <div className="space-y-4">
          {/* Order Total Display */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Your order total:</div>
            <div className="text-2xl font-bold text-gray-800">
              ${orderTotal.toFixed(2)}
            </div>
            {lastUpdated && (
              <div className="text-xs text-gray-500 mt-1">
                {getTimeAgo(lastUpdated)}
              </div>
            )}
          </div>

          {/* Donation Suggestion */}
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
            <div className="text-sm text-green-700 mb-2">
              Round up for charity?
            </div>
            <div className="text-lg font-semibold text-green-800">
              Donate ${getRoundUpAmount().toFixed(2)}
            </div>
            <div className="text-xs text-green-600 mt-1">
              Every little bit helps! 💚
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={handleDonate}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Donate
            </button>
            <button
              onClick={() => {
                chrome.storage.local.remove(['lastOrderTotal', 'lastUpdated']);
                setOrderTotal(null);
                setLastUpdated(null);
              }}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🛒</div>
          <div className="text-gray-600 mb-4">
            No recent Amazon orders found
          </div>
          <div className="text-sm text-gray-500">
            Complete a purchase on Amazon and we'll help you round up for charity!
          </div>
          <button
            onClick={refreshData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Check Again
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          Round Up Extension • Make every purchase count
        </div>
      </div>
    </div>
  );
}

export default Popup;