import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  browserLocalPersistence,
  indexedDBLocalPersistence 
} from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Platform-specific imports
let AsyncStorage: any;
let getReactNativePersistence: any;

if (Platform.OS !== 'web') {
  // Only import React Native modules for non-web platforms
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
  getReactNativePersistence = require('firebase/auth').getReactNativePersistence;
}

// SECURE: Load Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || Constants.expoConfig?.extra?.firebaseApiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || Constants.expoConfig?.extra?.firebaseAuthDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || Constants.expoConfig?.extra?.firebaseProjectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || Constants.expoConfig?.extra?.firebaseStorageBucket,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || Constants.expoConfig?.extra?.firebaseMessagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || Constants.expoConfig?.extra?.firebaseAppId,
};

// Validate that required config is present
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Firebase configuration missing! Please set EXPO_PUBLIC_FIREBASE_* environment variables.');
  throw new Error('Firebase configuration incomplete');
}

console.log('✓ Firebase config loaded from environment variables');

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with platform-specific persistence
// Web: Uses browserLocalPersistence (localStorage)
// Native: Uses getReactNativePersistence (AsyncStorage)
const getAuthInstance = () => {
  try {
    // Platform-specific persistence configuration
    let persistenceConfig;
    
    if (Platform.OS === 'web') {
      // Web platforms use browserLocalPersistence (localStorage)
      persistenceConfig = {
        persistence: browserLocalPersistence
      };
    } else {
      // React Native platforms (iOS/Android) use AsyncStorage
      persistenceConfig = {
        persistence: getReactNativePersistence(AsyncStorage)
      };
    }
    
    return initializeAuth(app, persistenceConfig);
  } catch (error: any) {
    // If auth already initialized, get existing instance
    if (error.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw error;
  }
};

const auth = getAuthInstance();

// Initialize Firestore and Storage
const db = getFirestore(app);
const storage = getStorage(app);

// Enable offline persistence for Firestore
if (Platform.OS === 'web') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log('Multiple tabs open, persistence enabled in first tab only');
    } else if (err.code === 'unimplemented') {
      console.log('Browser does not support persistence');
    }
  });
}

// Note: FCM/Push notifications removed per owner decision - server-side only for sync

export { app, auth, db, storage };
