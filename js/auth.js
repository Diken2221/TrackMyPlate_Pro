// 1. Import the 'auth' we just exported from db.js
import { auth, initializeUserProfile } from './db.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const provider = new GoogleAuthProvider();

export async function loginUser() {
    try {
        const result = await signInWithPopup(auth, provider);
        // Initialize user in DB immediately after login
        await initializeUserProfile(result.user);
        return result.user;
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed. Check console for details.");
    }
}

export function logoutUser() {
    return signOut(auth);
}

export function subscribeToAuthChanges(callback) {
    onAuthStateChanged(auth, callback);
}