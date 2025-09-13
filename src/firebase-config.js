// Firebase configuration
// Replace these with your actual Firebase project credentials
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase (commented out until you add your credentials)
// import { initializeApp } from 'firebase/app';
// import { getFirestore } from 'firebase/firestore';

// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);

// For now, we'll use mock data
const mockNonprofits = [
  { id: 'red-cross', name: 'American Red Cross', description: 'Humanitarian organization providing emergency assistance' },
  { id: 'unicef', name: 'UNICEF', description: 'United Nations agency for children' },
  { id: 'doctors-without-borders', name: 'Doctors Without Borders', description: 'International medical humanitarian organization' },
  { id: 'world-wildlife', name: 'World Wildlife Fund', description: 'International conservation organization' },
  { id: 'feeding-america', name: 'Feeding America', description: 'Nationwide network of food banks' },
  { id: 'st-jude', name: 'St. Jude Children\'s Research Hospital', description: 'Pediatric treatment and research facility' },
  { id: 'salvation-army', name: 'The Salvation Army', description: 'International charitable organization' },
  { id: 'habitat-for-humanity', name: 'Habitat for Humanity', description: 'Nonprofit housing organization' }
];

// Mock Firebase functions
export const getNonprofits = async () => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockNonprofits;
};

export const addNonprofitToFavorites = async (userId, nonprofitId) => {
  // Mock implementation
  console.log(`Adding ${nonprofitId} to favorites for user ${userId}`);
  return { success: true };
};

export const removeNonprofitFromFavorites = async (userId, nonprofitId) => {
  // Mock implementation
  console.log(`Removing ${nonprofitId} from favorites for user ${userId}`);
  return { success: true };
};

export const getUserFavorites = async (userId) => {
  // Mock implementation - return some default favorites
  await new Promise(resolve => setTimeout(resolve, 300));
  return ['red-cross', 'unicef', 'doctors-without-borders'];
};

// Real Firebase implementation (uncomment when you have Firebase set up)
/*
export const getNonprofits = async () => {
  const nonprofitsRef = collection(db, 'nonprofits');
  const snapshot = await getDocs(nonprofitsRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const addNonprofitToFavorites = async (userId, nonprofitId) => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    const favorites = userData.favorites || [];
    
    if (!favorites.includes(nonprofitId)) {
      await updateDoc(userRef, {
        favorites: [...favorites, nonprofitId]
      });
    }
  } else {
    await setDoc(userRef, {
      favorites: [nonprofitId]
    });
  }
  
  return { success: true };
};

export const removeNonprofitFromFavorites = async (userId, nonprofitId) => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    const favorites = userData.favorites || [];
    const updatedFavorites = favorites.filter(id => id !== nonprofitId);
    
    await updateDoc(userRef, {
      favorites: updatedFavorites
    });
  }
  
  return { success: true };
};

export const getUserFavorites = async (userId) => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    return userDoc.data().favorites || [];
  }
  
  return [];
};
*/
