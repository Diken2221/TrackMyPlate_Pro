import { CONFIG } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const app = initializeApp(CONFIG.FIREBASE);
const db = getFirestore(app);
export const auth = getAuth(app); 

// Helper: Ensure we always get YYYY-MM-DD in local time
export function getDateId(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function initializeUserProfile(user) {
    const userRef = doc(db, "users", user.uid);
    const defaultGoals = { calories: 2500, protein: 120, carbs: 250, fat: 70, water: 3000 };
    const defaultStats = { currentStreak: 0, bestStreak: 0, freezeCount: 0, lastLogDate: null };
    const defaultPrefs = { isVegetarian: false };

    try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            const g = data.goals || {};
            const s = data.stats || {};
            const p = data.preferences || {};
            
            // Return combined object with fallbacks for existing users
            return {
                goals: {
                    calories: Number(g.calories) || defaultGoals.calories,
                    protein: Number(g.protein) || defaultGoals.protein,
                    carbs: Number(g.carbs) || defaultGoals.carbs,
                    fat: Number(g.fat) || defaultGoals.fat,
                    water: Number(g.water) || defaultGoals.water
                },
                stats: {
                    currentStreak: Number(s.currentStreak) || 0,
                    bestStreak: Number(s.bestStreak) || 0,
                    freezeCount: Number(s.freezeCount) || 0,
                    lastLogDate: s.lastLogDate || null
                },
                preferences: {
                    isVegetarian: p.isVegetarian || false
                }
            };
        } else {
            // Create new user profile
            const newProfile = {
                name: user.displayName,
                email: user.email,
                goals: defaultGoals,
                stats: defaultStats,
                preferences: defaultPrefs,
                createdAt: new Date()
            };
            await setDoc(userRef, newProfile);
            return { goals: defaultGoals, stats: defaultStats, preferences: defaultPrefs };
        }
    } catch (error) {
        console.error("Profile Load Error:", error);
        return { goals: defaultGoals, stats: defaultStats, preferences: defaultPrefs };
    }
}

export async function updateUserGoals(uid, newGoals) {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { goals: newGoals });
    return newGoals;
}

// NEW: Update User Stats (Streaks, Freezes)
export async function updateUserStats(uid, newStats) {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { stats: newStats });
    return newStats;
}

// NEW: Update User Preferences (Vegetarian Mode)
export async function updateUserPreferences(uid, newPrefs) {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { preferences: newPrefs });
    return newPrefs;
}

export async function updateDailyGoals(uid, dateId, dailyGoals) {
    const logRef = doc(db, "users", uid, "logs", dateId);
    await setDoc(logRef, { dailyGoals: dailyGoals }, { merge: true });
}

export async function getDailyLog(uid, dateId) {
    try {
        const logRef = doc(db, "users", uid, "logs", dateId);
        const logSnap = await getDoc(logRef);
        return logSnap.exists() ? logSnap.data() : { entries: [], water: 0 };
    } catch (error) {
        console.error("Get Log Error:", error);
        return { entries: [], water: 0 };
    }
}

export async function updateWaterLog(uid, dateId, newAmount) {
    const logRef = doc(db, "users", uid, "logs", dateId);
    await setDoc(logRef, { water: newAmount }, { merge: true });
}

export async function addFoodItem(uid, dateId, item) {
    const logRef = doc(db, "users", uid, "logs", dateId);
    await setDoc(logRef, { entries: arrayUnion(item) }, { merge: true });
}

export async function updateDailyLog(uid, dateId, newEntries) {
    const logRef = doc(db, "users", uid, "logs", dateId);
    await setDoc(logRef, { entries: newEntries }, { merge: true });
}

export async function getHistory(uid, days = 7, endDate = new Date()) {
    const history = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(endDate); 
        d.setDate(d.getDate() - i);
        const dateId = getDateId(d);
        
        history.push(
            getDoc(doc(db, "users", uid, "logs", dateId))
            .then(snap => {
                const data = snap.exists() ? snap.data() : { entries: [], water: 0 };
                const stats = (data.entries || []).reduce((acc, item) => ({
                    calories: acc.calories + (item.calories || 0),
                    protein: acc.protein + (item.protein || 0),
                    carbs: acc.carbs + (item.carbs || 0),
                    fat: acc.fat + (item.fat || 0)
                }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
                
                // NEW: Include Energy Logs in history if available (for shizuku analysis)
                const energy = (data.entries || []).map(e => e.energy).filter(Boolean); // Extract energy tags
                const dominantEnergy = energy.length > 0 
                    ? energy.sort((a,b) => energy.filter(v=>v===a).length - energy.filter(v=>v===b).length).pop() 
                    : null;

                return { 
                    date: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }), 
                    calories: stats.calories,
                    protein: stats.protein,
                    carbs: stats.carbs,
                    fat: stats.fat,
                    water: data.water || 0,
                    energy: dominantEnergy
                };
            })
            .catch(() => ({ date: 'N/A', calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 }))
        );
    }
    return Promise.all(history);
}

export async function getWeeklyHistory(uid) {
    return getHistory(uid, 7);
}