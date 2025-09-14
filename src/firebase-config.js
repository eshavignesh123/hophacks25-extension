import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDcLhnL8aextN45mylPbGVMJ2ivkGJDIb8",
  authDomain: "hophacks25.firebaseapp.com",
  projectId: "hophacks25",
  storageBucket: "hophacks25.firebasestorage.app",
  messagingSenderId: "903988548661",
  appId: "1:903988548661:web:ffba20a58be0b20c9b8d7c",
  measurementId: "G-FC5F28TS5F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);