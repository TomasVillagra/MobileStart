// src/config/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAvwnP4gpRCYn-75lo8nnz_Wwk8Q4bO1JE",
  authDomain: "mobilestart-45f63.firebaseapp.com",
  projectId: "mobilestart-45f63",
  // ⚠️ IMPORTANTE: usar .appspot.com para Storage
  storageBucket: "mobilestart-45f63.appspot.com",
  messagingSenderId: "760370524623",
  appId: "1:760370524623:web:3e24eb4a9573e7396062ba",
  measurementId: "G-4JXQ8HS4TE"
};

const app = initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);

// Firestore para React Native: evita errores WebChannel (... transport errored)
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

// Storage (para fotos, etc.)
export const storage = getStorage(app);

export default app;



















