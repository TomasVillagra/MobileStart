// src/config/firebaseConfig.js
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

//  Solo se usa en React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyAvwnP4gpRCYn-75lo8nnz_Wwk8Q4bO1JE',
  authDomain: 'mobilestart-45f63.firebaseapp.com',
  projectId: 'mobilestart-45f63',
  storageBucket: 'mobilestart-45f63.appspot.com',
  messagingSenderId: '760370524623',
  appId: '1:760370524623:web:3e24eb4a9573e7396062ba',
  measurementId: 'G-4JXQ8HS4TE',
};

const app = initializeApp(firebaseConfig);

/**
 * AUTH
 * - En RN: usa initializeAuth + AsyncStorage para persistir sesión entre aperturas.
 * - En web: usa getAuth normal.
 * - Con Fast Refresh (Expo) si auth ya fue inicializado, caemos a getAuth().
 */
let authInstance;
if (Platform.OS === 'web') {
  authInstance = getAuth(app);
} else {
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    // Si ya estaba inicializado (Fast Refresh), obtenemos la instancia existente
    authInstance = getAuth(app);
  }
}
export const auth = authInstance;

/**
 * FIRESTORE (igual que antes)
 * - Ajustes recomendados para RN para evitar errores de WebChannel.
 */
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

/**
 *
 */
export const storage = getStorage(app);

export default app;




















