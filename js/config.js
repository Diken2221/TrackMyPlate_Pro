// js/config.js

export const CONFIG = {
    // -------------------------------------------------------------------------
    // FLIPPA BUYER: REPLACE THESE VALUES WITH YOUR OWN API KEYS
    // -------------------------------------------------------------------------
    
    // 1. Firebase Configuration (From Firebase Console)
    FIREBASE: {
       apiKey: "AIzaSyAfZ9TtlMIiVFNyBHoP5bJB5B6M8TL1IG8",
       authDomain: "trackmyplate-v.firebaseapp.com",
       projectId: "trackmyplate-v",
       storageBucket: "trackmyplate-v.firebasestorage.app",
       messagingSenderId: "89027611787",
       appId: "1:89027611787:web:1e78281964d16afaabd88e",
       measurementId: "G-WRTZ5WXPCT"
    },

    // 2. Google Gemini AI Key (For Food Analysis & Easy Maker)
    GEMINI_API_KEY: "AIzaSyB4A63BBj9mRkXUDLPCw8g2-mqcnQVq-X4",

    // -------------------------------------------------------------------------
    // APP SETTINGS
    // -------------------------------------------------------------------------
    APP_NAME: "TrackMyPlate",
    VERSION: "2.0.0",
    
    // Default goals for a new user (Targeting Weight Gain)
    DEFAULT_GOALS: {
        calories: 2500, // Surplus for weight gain
        protein: 60,    // High protein for muscle
        carbs: 350,     // Energy
        fat: 80,        // Healthy fats
        water: 3000     // 3 Liters
    }
};