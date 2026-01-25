TrackMyPlate Pro - AI Nutrition Coach & Meal Tinder
===================================================

Thank you for purchasing TrackMyPlate Pro!

This is a modern, serverless web application built with Vanilla JS, Tailwind CSS, and Firebase.
It features Llama-3 AI integration for food analysis, meal suggestions, and a "Tinder-like" swipe interface.

FEATURES:
---------
1. AI Food Vision: Take a photo of food to auto-log calories/macros (powered by Llama 3.2 Vision).
2. "Meal Tinder": Swipe left/right on AI-generated meal ideas based on your remaining daily macros.
3. Waifu Companion: An interactive Live2D character (Shizuku) that reacts to your progress.
4. Barcode Scanner: Integrated OpenFoodFacts scanner.
5. Gamification: Streak tracking, "Streak Freeze" mechanics, and level-up logic.
6. Export: Download logs as CSV or visual PDF reports.

SETUP INSTRUCTIONS:
-------------------

1. FIREBASE SETUP
   - Go to https://console.firebase.google.com/
   - Create a new project.
   - Go to Project Settings -> General -> "Your apps" -> Select Web (</> icon).
   - Copy the `firebaseConfig` object.
   - Go to Firestore Database -> Create Database -> Start in Test Mode (or set rules to allow read/write).
   - Go to Authentication -> Sign-in method -> Enable Google.

2. AI KEY SETUP
   - Go to https://console.groq.com/
   - Create a free API Key.

3. CONFIGURATION
   - Open the folder `js/` and open `config.js` in a text editor.
   - Paste your Firebase Config and Groq API Key in the designated spots.

4. HOSTING (FREE)
   - You can simply drag and drop the root folder into Netlify Drop.
   - OR run it locally using VS Code "Live Server".

SUPPORT:
--------
For questions, please contact [Your Support Email].
