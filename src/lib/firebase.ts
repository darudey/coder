import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "studio-8417032287-659a9",
  appId: "1:905325384029:web:519e0e0cbf6baa5507d8b4",
  storageBucket: "studio-8417032287-659a9.firebasestorage.app",
  apiKey: "AIzaSyC2weRk8654L5nFAVFDDCtGRN-a66Es84o",
  authDomain: "studio-8417032287-659a9.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "905325384029"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
