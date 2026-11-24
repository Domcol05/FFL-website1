/* ==========================================================================
   FLEGREA FOOD LOVERS (FFL) — Configurazione Firebase
   ========================================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// Sostituisci questi valori con quelli della tua app Web su Console Firebase
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCOvKg4TjLq8JeXUfcNb6gVD6sYX4jiQzE",
  authDomain: "flegreafoodlovers-29e6d.firebaseapp.com",
  projectId: "flegreafoodlovers-29e6d",
  storageBucket: "flegreafoodlovers-29e6d.firebasestorage.app",
  messagingSenderId: "536957580562",
  appId: "1:536957580562:web:c5dedb0a6dfebea6f46fcb",
  measurementId: "G-G9SH6B67E1"
};

export function isFirebaseConfigured() {
  return (
    Boolean(firebaseConfig.apiKey) &&
    !firebaseConfig.apiKey.includes('INSERISCI_QUI')
  );
}

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured()) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };