import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyDz9sNBaSblZQYEJPhoAZmyygcghmHSh_I",
  authDomain: "nt-traders.firebaseapp.com",
  projectId: "nt-traders",
  storageBucket: "nt-traders.firebasestorage.app",
  messagingSenderId: "312840988986",
  appId: "1:312840988986:web:6b9e8030bfb2a596540803",
  measurementId: "G-EVZKK3ZBJK",
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const BUSINESS_ID = "noor-traders"
