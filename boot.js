// boot.js — asal Firebase SDK yahan se aata hai. Baqi app sdk ko bahar se leti hai taake test ho sake.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence,
  signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, runTransaction, writeBatch
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { startApp } from './app.js';

startApp({
  firebaseConfig,
  sdk: {
    initializeApp, getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence,
    signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword,
    getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, doc, onSnapshot, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, runTransaction, writeBatch
  }
});
