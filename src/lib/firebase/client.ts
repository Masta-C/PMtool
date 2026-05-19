import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { env } from '@/config/env'

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>

  if (env.NEXT_PUBLIC_USE_EMULATOR) {
    // Use window flag so Fast Refresh module re-execution doesn't double-connect.
    // Firebase SDK throws if connectAuthEmulator is called twice on the same instance.
    if (!w.__pmtoolEmulatorsConnected) {
      w.__pmtoolEmulatorsConnected = true
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
      connectFirestoreEmulator(db, 'localhost', 8080)
      connectStorageEmulator(storage, 'localhost', 9199)
    }
  }

  // Enable offline persistence for PWA support on factory floor tablets with unreliable Wi-Fi.
  // Must be called after emulator connection (if any) and only once per app instance.
  if (!w.__pmtoolPersistenceEnabled) {
    w.__pmtoolPersistenceEnabled = true
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open — persistence can only be enabled in one tab at a time.
        console.warn('Firestore persistence unavailable: multiple tabs open')
      } else if (err.code === 'unimplemented') {
        // Browser does not support persistence (e.g. Firefox private mode).
        console.warn('Firestore persistence not supported in this browser')
      }
    })
  }
}
