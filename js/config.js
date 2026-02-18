// js/config.js

export const CONFIG = {
    // -------------------------------------------------------------------------
    // INSTRUCTIONS FOR BUYER:
    // 1. Go to console.firebase.google.com -> Create Project -> Web App
    // 2. Paste your Firebase config object below.
    // -------------------------------------------------------------------------
    
    FIREBASE: {
       apiKey: "AIzaSyAfZ9TtlMIiVFNyBHoP5bJB5B6M8TL1IG8",
       authDomain: "trackmyplate-v.firebaseapp.com",
       projectId: "trackmyplate-v",
       storageBucket: "trackmyplate-v.firebasestorage.app",
       messagingSenderId: "89027611787",
       appId: "1:89027611787:web:1e78281964d16afaabd88e",
       measurementId: "G-WRTZ5WXPCT"
    },

    // -------------------------------------------------------------------------
    // 2. AI CONFIGURATION
    // Get a free key from: https://console.groq.com/keys
    // -------------------------------------------------------------------------
    GROQ_API_KEY: "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",

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


