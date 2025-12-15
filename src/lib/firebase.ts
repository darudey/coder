
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getDatabase, type Database } from 'firebase/database';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC2weRk8654L5nFAVFDDCtGRN-a66Es84o",
  authDomain: "studio-8417032287-659a9.firebaseapp.com",
  projectId: "studio-8417032287-659a9",
  storageBucket: "studio-8417032287-659a9.firebasestorage.app",
  messagingSenderId: "905325384029",
  appId: "1:905325384029:web:519e0e0cbf6baa5507d8b4",
  databaseURL: "https://studio-8417032287-659a9-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let db: Firestore | null = null;
let rtdb: Database | null = null;

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

async function getClientRtdb() {
    if (typeof window !== 'undefined') {
        if (!rtdb) {
            const { getDatabase } = await import('firebase/database');
            rtdb = getDatabase(app);
        }
        return rtdb;
    }
    return null;
}


export { app, getClientDb, getClientRtdb, firebaseConfig };
