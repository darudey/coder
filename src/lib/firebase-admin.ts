
import admin from 'firebase-admin';
import { firebaseConfig } from './firebase';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`,
      storageBucket: firebaseConfig.storageBucket
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const adminDb = admin.firestore();
export { adminDb };
