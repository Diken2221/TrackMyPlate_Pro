// js/config.js

export const CONFIG = {
    // -------------------------------------------------------------------------
    // INSTRUCTIONS FOR BUYER:
    // 1. Go to console.firebase.google.com -> Create Project -> Web App
    // 2. Paste your Firebase config object below.
    // -------------------------------------------------------------------------
    
    FIREBASE: {
       apiKey: "YOUR_FIREBASE_API_KEY_HERE",
       authDomain: "YOUR_APP.firebaseapp.com",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_APP.firebasestorage.app",
       messagingSenderId: "YOUR_SENDER_ID",
       appId: "YOUR_APP_ID",
       measurementId: "G-MEASUREMENT_ID"
    },

    // -------------------------------------------------------------------------
    // 2. AI CONFIGURATION
    // Get a free key from: https://console.groq.com/keys
    // -------------------------------------------------------------------------
    GROQ_API_KEY: "gsk_YOUR_GROQ_API_KEY_HERE",

    // -------------------------------------------------------------------------
    // APP SETTINGS
    // -------------------------------------------------------------------------
    APP_NAME: "TrackMyPlate",
    VERSION: "2.1.0",
    
    // Default goals for a new user
    DEFAULT_GOALS: { 
        calories: 2500, 
        protein: 150, 
        carbs: 250, 
        fat: 80, 
        water: 3000 
    }
};
