import { CONFIG } from './config.js';

// Get Key from central config
const GROQ_API_KEY = CONFIG.GROQ_API_KEY; 
const BASE_PROMPT = "Return ONLY valid JSON: {\"name\": \"Short Name\", \"calories\": 0, \"protein\": 0, \"carbs\": 0, \"fat\": 0}. No markdown.";

// Updated: Accepts preferences for Vegetarian Mode
export async function updateAICoach(currentLog, goals, user, preferences = {}) {
    // Safety check for missing key
    if (!GROQ_API_KEY || GROQ_API_KEY.includes("YOUR_GROQ")) {
        console.warn("AI Error: No API Key provided in config.js");
        return;
    }

    const aiTextElement = document.getElementById('passive-ai-message');
    if (!aiTextElement) return;

    const entries = currentLog?.entries || [];
    const totals = entries.reduce((acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbs: acc.carbs + (item.carbs || 0),
        fat: acc.fat + (item.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const userName = user?.displayName ? user.displayName.split(' ')[0] : 'Friend';
    const hour = new Date().getHours();
    let timeContext = "Day";
    if(hour < 11) timeContext = "Morning";
    else if(hour < 15) timeContext = "Lunch";
    else if(hour < 19) timeContext = "Evening";
    else timeContext = "Late Night";

    // Vegetarian Logic
    const isVeg = preferences.isVegetarian;
    const dietLabel = isVeg ? "Strict Vegetarian (NO MEAT/FISH)" : "Standard";

    const prompt = `
    Role: Personal Nutrition Coach.
    User: ${userName}.
    Diet: ${dietLabel}.
    Time: ${timeContext} (${hour}:00).
    Stats: ${Math.round(totals.calories)}/${goals.calories} Cals, ${Math.round(totals.protein)}/${goals.protein}g Prot.
    Water: ${currentLog.water || 0}/${goals.water}ml.
    
    Task: Write ONE interactive, engaging sentence (Max 15 words) to ${userName}.
    Logic:
    1. If water < 500ml and it's not Morning, shout out hydration.
    2. If protein is low (< 30% of goal) by Afternoon, suggest a ${isVeg ? 'plant-based ' : ''}high-protein snack ${isVeg ? '(like lentils, tofu, or nuts)' : '(like yogurt or eggs)'}.
    3. If calories are almost full but protein is low, warn gently.
    4. If it's Late Night and calories are low, say "Don't go to bed hungry!".
    5. If log is empty, say "Hey ${userName}, what's for breakfast?".
    
    Tone: Friendly, specific, naming the user.
    `;

    try {
        aiTextElement.style.opacity = '0.5';
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }] })
        });
        const data = await response.json();
        const advice = data.choices[0].message.content.replace(/"/g, ''); 
        
        aiTextElement.style.opacity = '1';
        aiTextElement.textContent = "";
        let i = 0;
        function type() { if(i < advice.length) { aiTextElement.textContent += advice.charAt(i++); setTimeout(type, 20); } }
        type();
        
    } catch (error) { 
        console.error("AI Error:", error); 
        aiTextElement.textContent = "Updates for " + userName + " coming soon...";
        aiTextElement.style.opacity = '1';
    } 
}

// Full Chatbox Logic with Technical Awareness
export async function chatWithCoach(userMessage, currentLog, goals, user, preferences = {}, history = [], userStats = {}) {
    const entries = currentLog?.entries || [];
    const totals = entries.reduce((acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
        carbs: acc.carbs + (item.carbs || 0),
        fat: acc.fat + (item.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const userName = user?.displayName ? user.displayName.split(' ')[0] : 'Friend';
    const isVeg = preferences.isVegetarian;
    
    // 1. Analyze History for Insights
    const historySummary = history.map(d => 
        `[${d.date}: ${d.calories}cal, Energy: ${d.energy || 'N/A'}]`
    ).join(" ");

    const streakInfo = `Current Streak: ${userStats.currentStreak || 0} days. Frozen Days Left: ${userStats.freezeCount || 0}.`;

    // 2. Define Technical Facts (The "Truth Source")
    const technicalManual = `
    === TECHNICAL MANUAL (Use this ONLY for "How do I" or "Is it broken" questions) ===
    - **Tech Stack:** I am built with Vanilla JS, Firebase (Firestore/Auth), and Groq AI (Llama 3).
    - **Offline:** I require internet for AI and Saving.
    - **Streaks:** A streak increases if you log food today. If you miss a day, you lose it unless you have a "Freeze" (earned every 7 days).
    - **Vision:** I use Llama 3.2 Vision to "see" food photos.
    - **Data:** Your data is stored securely in Google Firestore.
    - **Vegetarian Mode:** Toggle this in Settings (Gear Icon). It hides meat suggestions.
    - **Export:** You can download data as CSV or PDF via the Download icon.
    `;

    // 3. Define the App's UI "Map"
    const uiGuide = `
    === APP NAVIGATION GUIDE ===
    1. **To Change Date:** Use the LEFT/RIGHT ARROWS at the very top.
    2. **To Add Food:** Tap the big floating "+" BUTTON.
    3. **To View Charts:** Tap the "Trend" tab.
    4. **To Edit Goals:** Tap the SETTINGS ICON (gear).
    5. **Meal Ideas:** Go to Add Food > Tap "Chef" (Magic Wand) for AI suggestions.
    `;

    // 4. Construct the System Prompt
    const systemPrompt = `
    You are Nova, the AI core of "TrackMyPlate".
    
    USER CONTEXT:
    - Name: ${userName}
    - Today's Stats: ${Math.round(totals.calories)}/${goals.calories} kcal, ${Math.round(totals.protein)}/${goals.protein}g Protein.
    - Diet Mode: ${isVeg ? "Strict Vegetarian (NO MEAT)" : "Standard"}
    - ${streakInfo}
    - History: ${historySummary}

    ${technicalManual}
    ${uiGuide}

    USER MESSAGE: "${userMessage}"

    STRICT RESPONSE GUIDELINES:
    1. **TECHNICAL ACCURACY:** If the user asks for technical help (e.g., "Why isn't it working?", "How does this work?"), IGNORE nutrition advice and use the TECHNICAL MANUAL. Do not make up features.
    2. **FORMATTING:**
       - Use <h3>Heading</h3> for topics.
       - Use <ul><li>Bullet points</li></ul> for lists.
       - Use <b>Bold</b> for key terms.
    3. **CONCISENESS:** Keep it under 50 words unless explaining a technical step.
    `;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: "llama-3.1-8b-instant", 
                messages: [{ role: "user", content: systemPrompt }],
                temperature: 0.3 
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Chat Error:", error);
        return "<b>Error:</b> <u>Connection failed.</u> Please check internet.";
    }
}

export async function identifyFoodFromImage(base64Image) {
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.2-11b-vision-preview",
                messages: [
                    { role: "user", content: [
                        { type: "text", text: "Identify food. " + BASE_PROMPT },
                        { type: "image_url", image_url: { url: base64Image } }
                    ]}
                ],
                temperature: 0.1, max_tokens: 300
            })
        });
        const data = await response.json();
        let text = data.choices[0].message.content.replace(/```json|```/g, '').trim();
        return JSON.parse(text);
    } catch (error) { console.error("Vision Error:", error); throw error; }
}

export async function searchFoodText(query) {
    try {
        const prompt = `Return JSON array of 3 items for "${query}". Format: [{"name":"Name", "calories":0, "protein":0, "carbs":0, "fat":0}]. No markdown.`;
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }] })
        });
        const data = await response.json();
        let text = data.choices[0].message.content;
        text = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
        return JSON.parse(text);
    } catch (error) { console.error("Text Search Error:", error); return []; }
}

// NEW: Meal Tinder Logic
export async function generateMealIdeas(caloriesLeft, proteinLeft, preferences = {}) {
    try {
        const isVeg = preferences.isVegetarian;
        // Clamp values to ensure AI gets reasonable targets (e.g. if user is over limit, give them a light snack option)
        const targetCals = Math.max(150, caloriesLeft); 
        const targetProt = Math.max(10, proteinLeft);

        const prompt = `
        You are a chef. The user has exactly ${targetCals} calories and ${targetProt}g of protein remaining for the day.
        Diet: ${isVeg ? "Vegetarian (No meat)" : "Flexible"}.
        
        Generate 5 DISTINCT meal ideas that fit these nutritional constraints closely.
        Focus on easy-to-make, realistic meals.
        
        Return ONLY a JSON array. Format:
        [
            {
                "name": "Meal Name",
                "description": "Short appetizing description (10 words)",
                "calories": 0,
                "protein": 0,
                "carbs": 0,
                "fat": 0,
                "emoji": "🥗"
            }
        ]
        DO NOT include markdown or intro text. JUST THE JSON.
        `;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                model: "llama-3.1-8b-instant", 
                messages: [{ role: "user", content: prompt }],
                temperature: 0.5
            })
        });

        const data = await response.json();
        let text = data.choices[0].message.content.replace(/```json|```/g, '').trim();
        // Fallback for messy AI output
        if(text.includes('[')) text = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
        
        return JSON.parse(text);
    } catch (error) {
        console.error("Meal Gen Error:", error);
        return [];
    }
}
