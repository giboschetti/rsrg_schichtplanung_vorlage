import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCS2HSbcIebYw_pdVuQZuUnJDaBsiwmVew",
  authDomain: "rsrg-schichtplanung.firebaseapp.com",
  projectId: "rsrg-schichtplanung",
  storageBucket: "rsrg-schichtplanung.firebasestorage.app",
  messagingSenderId: "424627790843",
  appId: "1:424627790843:web:79b2225ac3487d735b215e",
  measurementId: "G-GNQ8FK3RMD",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
