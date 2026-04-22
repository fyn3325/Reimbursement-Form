import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: ReturnType<typeof initializeApp> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;
let database: ReturnType<typeof getDatabase> | null = null;

export function getFirebaseApp() {
  if (!app) {
    const hasConfig = firebaseConfig.apiKey && firebaseConfig.projectId;
    if (!hasConfig) {
      throw new Error(
        'Firebase config missing. Add VITE_FIREBASE_* vars to .env.local (see .env.example)'
      );
    }
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseStorage() {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}

export function getFirebaseDatabase() {
  if (!database) {
    database = getDatabase(getFirebaseApp());
  }
  return database;
}

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
}
