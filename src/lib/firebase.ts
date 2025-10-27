
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "studio-8417032287-659a9",
  "appId": "1:905325384029:web:519e0e0cbf6baa5507d8b4",
  "storageBucket": "studio-8417032287-659a9.firebasestorage.app",
  "apiKey": "AIzaSyC2weRk8654L5nFAVFDDCtGRN-a66Es84o",
  "authDomain": "studio-8417032287-659a9.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "905325384029"
};

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let db: Firestore | null = null;

async function getClientDb() {
    if (typeof window !== 'undefined') {
        if (!db) {
            const { getFirestore } = await import('firebase/firestore');
            db = getFirestore(app);
        }
        return db;
    }
    return null;
}

export { app, getClientDb, firebaseConfig };
