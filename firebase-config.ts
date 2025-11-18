
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ⚠️ هام جداً: يجب عليك استبدال هذه البيانات ببيانات مشروعك من موقع Firebase Console
// 1. اذهب إلى https://console.firebase.google.com/
// 2. أنشئ مشروع جديد
// 3. اختر Web App (أيقونة </>)
// 4. انسخ الإعدادات وضعها هنا
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
let app;
let db: any;
let auth: any;

// Check if the config is still using placeholders
const isConfigured = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" && !firebaseConfig.apiKey.includes("YOUR_API_KEY");

if (isConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    } catch (error) {
        console.warn("Firebase initialization failed. App will run in mock mode.", error);
    }
} else {
    console.log("⚠️ Firebase keys not set. App running in Mock Mode (LocalStorage).");
}

export { db, auth };
