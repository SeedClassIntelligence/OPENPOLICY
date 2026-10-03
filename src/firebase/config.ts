import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Cloud Firestore (using configured database ID if present)
export const firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Validate Connection to Firestore on startup per skill requirements
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(firestore, 'test', 'connection'));
    console.log('[Open Policy] Firestore connection verified successfully.');
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Open Policy] Firestore client is offline or network connection pending.');
    }
  }
}

// Initial boot check
testFirestoreConnection();
