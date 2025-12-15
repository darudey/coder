require('dotenv').config();
import admin from 'firebase-admin';

// Check if we have the credentials in the environment
const serviceAccountString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

if (!admin.apps.length) {
  if (serviceAccountString) {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch (error) {
      console.error('Error parsing service account credentials:', error);
      console.error('Firebase admin initialization failed.');
    }
  } else if (process.env.VERCEL) {
      // In Vercel, application default credentials should work
       admin.initializeApp();
  } else {
    console.warn(
      'GOOGLE_APPLICATION_CREDENTIALS_JSON not set. Firebase Admin SDK might not be initialized.'
    );
  }
}

let adminDb: admin.firestore.Firestore | null = null;
try {
  adminDb = admin.firestore();
} catch (e) {
  console.error("Failed to get Firestore instance from admin SDK.");
}

export { adminDb };
