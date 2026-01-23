import { CONFIG } from './config.js';
import { loginUser, logoutUser, subscribeToAuthChanges } from './auth.js';
import { initializeUserProfile, getDailyLog, getDateId, addFoodItem, updateDailyLog, updateUserGoals, getWeeklyHistory, updateWaterLog, updateDailyGoals, getHistory, updateUserStats, updateUserPreferences } from './db.js';
import { updateAICoach, identifyFoodFromImage, searchFoodText, chatWithCoach, generateMealIdeas } from './analytics.js';

let currentUser = null;
let globalGoals = { calories: 2500, protein: 120, carbs: 250, fat: 70, water: 3000 };
let userStats = { currentStreak: 0, bestStreak: 0, freezeCount: 0, lastLogDate: null };
let userPrefs = { isVegetarian: false };

let currentDayGoals = null; 
let currentLog = null;
let currentViewDate = new Date();
let searchTimeout = null;
let pendingFoodItem = null;
let weeklyChartInstance = null;
let dailyDonutInstance = null;
let chartMetric = 'calories';
let chartDays = 7;
let pendingExportType = 'csv';

// NEW: Meal Stack Data
let mealStack = [];

// --- PURPOSEFUL COMPANION DATA ---
const COMPANION_DATA = {
    IDLE: [
        "Hydration check required?",
        "Protein goal status: Pending.",
        "Awaiting next meal log.",
        "Consistency is efficient.",
        "Don't forget to track snacks."
    ],
    FOOD_LOGGED: [
        "Meal recorded.",
        "Nutrients tracking...",
        "Data updated.",
        "Log successful."
    ],
    STREAK: [
        "Streak incremented.",
        "Consistency detected.",
        "Momentum building.",
        "Daily target: Met."
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const getEl = (id) => document.getElementById(id);
    const views = { auth: getEl('auth-container'), app: getEl('app-container'), modal: getEl('add-food-modal'), goalsModal: getEl('edit-goals-modal'), exportModal: getEl('export-modal') };
    const btns = { 
        login: getEl('google-signin-btn'), logout: getEl('logout-btn'), 
        addFood: getEl('add-food-btn'), closeModal: getEl('close-modal-btn'),
        editGoals: getEl('edit-goals-btn'), closeGoals: getEl('close-goals-btn'), saveGoals: getEl('save-goals-btn'),
        textInput: getEl('text-search-input'), snapInput: getEl('snap-input'),
        manualAdd: getEl('manual-add-btn'), barcodeAdd: getEl('add-barcode-btn'),
        snapConfirm: getEl('confirm-snap-btn'), popupAdd: getEl('popup-add-btn'),
        refreshAI: getEl('btn-refresh-ai'),
        exportCSV: getEl('export-csv-btn'),
        exportPDF: getEl('export-pdf-btn'),
        chatBtn: getEl('chat-btn'), closeChat: getEl('close-chat-btn'), sendChat: getEl('send-chat-btn'), chatInput: getEl('chat-input')
    };

    // --- INPUT GUARDS ---
    const nutrientInputs = ['manual-cals', 'manual-prot', 'manual-carb', 'manual-fat', 'edit-goal-cals', 'edit-goal-prot', 'edit-goal-carb', 'edit-goal-fat', 'edit-goal-water'];
    nutrientInputs.forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener('input', (e) => { if(e.target.value < 0) e.target.value = 0; }); });
    const servingInputs = ['manual-servings', 'popup-servings', 'barcode-servings', 'snap-servings'];
    servingInputs.forEach(id => { const el = document.getElementById(id); if(el) { el.addEventListener('input', (e) => { if(e.target.value <= 0) e.target.value = 1; }); el.addEventListener('change', (e) => { if(e.target.value <= 0) e.target.value = 1; }); } });

    // --- AUTH LISTENER ---
    subscribeToAuthChanges(async (user) => {
        if (user) {
            currentUser = user;
            views.auth.classList.add('hidden');
            views.app.classList.remove('hidden');
            if(btns.addFood) { btns.addFood.classList.remove('hidden'); btns.addFood.style.display = 'flex'; }
            document.getElementById('chat-widget').classList.remove('hidden');
            
            // Initial Data Load
            const userProfile = await initializeUserProfile(currentUser);
            globalGoals = userProfile.goals;
            userStats = userProfile.stats; 
            userPrefs = userProfile.preferences; 

            updateGreeting();
            await loadAppData(new Date()); 
            
            checkStreakOnInit(); 
            updateStreakUI();
            
            renderRecentMeals(); 
            if(currentLog && isToday(new Date())) updateAICoach(currentLog, currentDayGoals, currentUser, userPrefs);

            // Initialize Live2D
            initLive2D();
        } else {
            currentUser = null;
            views.auth.classList.remove('hidden');
            views.app.classList.add('hidden');
            if(btns.addFood) { btns.addFood.classList.add('hidden'); btns.addFood.style.display = 'none'; }
            document.getElementById('chat-widget').classList.add('hidden');
            document.getElementById('chat-modal').classList.remove('open');
            document.getElementById('chat-modal').classList.add('closed');
        }
    });

    // --- CHAT LOGIC ---
    if(btns.chatBtn) { btns.chatBtn.addEventListener('click', () => { const modal = document.getElementById('chat-modal'); if(modal.classList.contains('closed')) { modal.classList.remove('closed'); modal.classList.add('open'); document.getElementById('chat-bubble-msg').style.display = 'none'; } else { modal.classList.add('closed'); modal.classList.remove('open'); document.getElementById('chat-bubble-msg').style.display = 'block'; } }); }
    if(btns.closeChat) { btns.closeChat.addEventListener('click', () => { const modal = document.getElementById('chat-modal'); modal.classList.add('closed'); modal.classList.remove('open'); document.getElementById('chat-bubble-msg').style.display = 'block'; }); }

    const appendMessage = (text, sender) => {
        const history = document.getElementById('chat-history');
        const div = document.createElement('div');
        div.className = sender === 'user' ? "flex justify-end" : "flex justify-start";
        const bubble = document.createElement('div');
        bubble.className = sender === 'user' ? "bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-none shadow-md text-sm max-w-[85%]" : "bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-xs text-slate-600 border border-slate-100 max-w-[85%] prose prose-sm prose-p:my-1 prose-headings:text-indigo-600 prose-headings:text-xs prose-headings:font-bold prose-ul:list-disc prose-ul:pl-4 prose-li:my-0";
        bubble.innerHTML = text; 
        div.appendChild(bubble);
        history.appendChild(div);
        history.scrollTop = history.scrollHeight;
    };

    const handleSendChat = async () => {
        const text = btns.chatInput.value.trim();
        if(!text) return;
        appendMessage(text, 'user');
        btns.chatInput.value = '';
        
        const historyDiv = document.getElementById('chat-history');
        const loaderDiv = document.createElement('div');
        loaderDiv.className = "flex justify-start";
        loaderDiv.innerHTML = `<div class="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100"><div class="flex gap-1"><span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span><span class="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span></div></div>`;
        loaderDiv.id = "chat-loader";
        historyDiv.appendChild(loaderDiv);
        historyDiv.scrollTop = historyDiv.scrollHeight;

        let pastData = [];
        try { pastData = await getHistory(currentUser.uid, 7, new Date()); } catch(e) { console.error("History Error", e); }

        const response = await chatWithCoach(text, currentLog, currentDayGoals, currentUser, userPrefs, pastData, userStats);
        
        document.getElementById('chat-loader').remove();
        appendMessage(response, 'ai');
    };

    if(btns.sendChat) btns.sendChat.addEventListener('click', handleSendChat);
    if(btns.chatInput) btns.chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendChat(); });

    // --- EXPORT LOGIC ---
    const openExportModal = (type) => { pendingExportType = type; views.exportModal.classList.remove('hidden'); views.exportModal.classList.add('flex'); };
    if(btns.exportCSV) btns.exportCSV.addEventListener('click', () => openExportModal('csv'));
    if(btns.exportPDF) btns.exportPDF.addEventListener('click', () => openExportModal('pdf'));
    document.addEventListener('confirm-export-data', async (e) => {
        const days = e.detail; 
        const titleText = days === 365 ? "Yearly" : (days === 30 ? "Monthly" : "Weekly");
        if (pendingExportType === 'csv') {
            try {
                const csvRows = ["Date,Food Item,Calories,Protein (g),Carbs (g),Fat (g),Daily Cal Goal"];
                for (let i = 0; i < days; i++) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    const log = await getDailyLog(currentUser.uid, getDateId(d));
                    const dateStr = d.toLocaleDateString();
                    const goals = log.dailyGoals || globalGoals;
                    if (log.entries && log.entries.length > 0) {
                        log.entries.forEach(entry => {
                            const safeName = (entry.name || "Unknown").replace(/,/g, " ");
                            csvRows.push(`${dateStr},${safeName},${entry.calories},${entry.protein},${entry.carbs},${entry.fat},${goals.calories}`);
                        });
                    }
                }
                const link = document.createElement("a");
                link.href = encodeURI("data:text/csv;charset=utf-8," + csvRows.join("\n"));
                link.download = `trackmyplate_${titleText.toLowerCase()}_log.csv`;
                document.body.appendChild(link); link.click(); document.body.removeChild(link);
            } catch (e) { console.error(e); alert("Export Error"); }
        } else if (pendingExportType === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const canvas = document.getElementById('pdfChartCanvas');
            const history = await getHistory(currentUser.uid, days > 14 ? 14 : days, new Date());
            const labels = history.map(d => d.date);
            const dataCals = history.map(d => d.calories);
            const chart = new Chart(canvas, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Calories', data: dataCals, backgroundColor: '#4f46e5' }] }, options: { animation: false, responsive: false } });
            doc.setFontSize(22); doc.setTextColor(79, 70, 229); doc.text(`TrackMyPlate ${titleText} Report`, 14, 20);
            doc.setFontSize(12); doc.setTextColor(100); doc.text(`User: ${currentUser.displayName || 'Guest'}`, 14, 30); doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 36);
            setTimeout(() => {
                const imgData = canvas.toDataURL("image/png");
                doc.text("Calorie Trend (Last 14 Days):", 14, 50);
                doc.addImage(imgData, 'PNG', 14, 55, 180, 90);
                doc.text(`Meal Log (Last ${days} Days):`, 14, 160);
                let tableRows = [];
                (async () => {
                    for (let i = 0; i < days; i++) {
                        const d = new Date(); d.setDate(d.getDate() - i);
                        const log = await getDailyLog(currentUser.uid, getDateId(d));
                        const dateStr = d.toLocaleDateString();
                        if(log.entries) { log.entries.forEach(e => { tableRows.push([dateStr, e.name, `${e.calories} kcal`, `${e.protein}g`]); }); }
                    }
                    doc.autoTable({ startY: 165, head: [['Date', 'Food Item', 'Calories', 'Protein']], body: tableRows, theme: 'grid', headStyles: { fillColor: [79, 70, 229] } });
                    doc.save(`TrackMyPlate_${titleText}_Report.pdf`);
                    chart.destroy();
                })();
            }, 500);
        }
    });

    document.addEventListener('load-weekly-chart', refreshChart);
    document.addEventListener('change-chart-metric', (e) => { chartMetric = e.detail; ['calories', 'protein', 'carbs', 'fat', 'all'].forEach(m => { const card = document.getElementById(`trend-${m}`); if(m === chartMetric) { card.classList.add('active'); card.classList.remove('inactive'); } else { card.classList.add('inactive'); card.classList.remove('active'); } }); refreshChart(); });
    document.addEventListener('change-chart-time', (e) => { chartDays = e.detail; [7, 30, 365].forEach(d => { const btn = document.getElementById(`time-${d}`); btn.className = d === chartDays ? "px-4 py-2 bg-slate-900 text-white shadow-md rounded-lg text-xs font-bold transition-all" : "px-4 py-2 text-slate-400 rounded-lg text-xs font-bold transition hover:text-slate-900"; }); refreshChart(); });
    async function refreshChart() { const history = await getHistory(currentUser.uid, chartDays, currentViewDate); if (chartMetric === 'all') renderMultiAxisChart(history); else renderChart(history, chartMetric); }
    document.addEventListener('change-dashboard-date', async (e) => { const delta = e.detail; const proposedDate = new Date(currentViewDate); proposedDate.setDate(currentViewDate.getDate() + delta); const today = new Date(); today.setHours(0,0,0,0); const checkDate = new Date(proposedDate); checkDate.setHours(0,0,0,0); if (checkDate > today) return; currentViewDate = proposedDate; const isTrendView = document.getElementById('tab-weekly').classList.contains('expanded'); if(isTrendView) getEl('view-dashboard-weekly').classList.add('hidden'); else getEl('view-dashboard-daily').classList.add('hidden'); getEl('dashboard-skeleton').classList.remove('hidden'); await loadAppData(currentViewDate); if(isTrendView) await refreshChart(); setTimeout(() => { getEl('dashboard-skeleton').classList.add('hidden'); if(isTrendView) getEl('view-dashboard-weekly').classList.remove('hidden'); else getEl('view-dashboard-daily').classList.remove('hidden'); }, 300); });

    // --- GOALS & SETTINGS ---
    if(btns.editGoals) btns.editGoals.addEventListener('click', () => { if(!isToday(currentViewDate)) return; getEl('edit-goal-cals').value = currentDayGoals.calories; getEl('edit-goal-prot').value = currentDayGoals.protein; getEl('edit-goal-carb').value = currentDayGoals.carbs; getEl('edit-goal-fat').value = currentDayGoals.fat; getEl('edit-goal-water').value = currentDayGoals.water; getEl('edit-goal-veg').checked = userPrefs.isVegetarian; views.goalsModal.classList.remove('hidden'); views.goalsModal.classList.add('flex'); });
    if(btns.closeGoals) btns.closeGoals.addEventListener('click', () => { views.goalsModal.classList.add('hidden'); views.goalsModal.classList.remove('flex'); });
    if(btns.saveGoals) btns.saveGoals.addEventListener('click', async () => { 
        const newGoals = { calories: Math.max(500, Number(getEl('edit-goal-cals').value)), protein: Math.max(0, Number(getEl('edit-goal-prot').value)), carbs: Math.max(0, Number(getEl('edit-goal-carb').value)), fat: Math.max(0, Number(getEl('edit-goal-fat').value)), water: Math.max(0, Number(getEl('edit-goal-water').value)) }; 
        const newPrefs = { isVegetarian: getEl('edit-goal-veg').checked };
        btns.saveGoals.textContent = "Saving..."; 
        currentDayGoals = newGoals; globalGoals = newGoals; userPrefs = newPrefs;
        renderDashboard(currentLog, currentDayGoals); 
        views.goalsModal.classList.add('hidden'); views.goalsModal.classList.remove('flex'); 
        try { 
            const dateId = getDateId(currentViewDate); 
            await updateDailyGoals(currentUser.uid, dateId, newGoals); 
            await updateUserGoals(currentUser.uid, newGoals); 
            await updateUserPreferences(currentUser.uid, newPrefs); 
            updateAICoach(currentLog, currentDayGoals, currentUser, userPrefs); 
        } catch(e) { console.error(e); } finally { btns.saveGoals.textContent = "Save"; } 
    });
    
    window.addWater = async (amount) => { if(!isToday(currentViewDate)) { alert("Viewing history mode."); return; } if(!currentLog) return; const newWater = Math.max(0, (currentLog.water || 0) + amount); currentLog.water = newWater; getEl('water-val').textContent = newWater; const pct = Math.min((newWater / (currentDayGoals.water || 3000)) * 100, 100); getEl('water-fill').style.height = `${pct}%`; await updateWaterLog(currentUser.uid, getDateId(currentViewDate), newWater); };
    if(btns.login) btns.login.addEventListener('click', loginUser);
    if(btns.logout) btns.logout.addEventListener('click', async () => { if(confirm("Logout?")) { if(btns.addFood) { btns.addFood.style.display = 'none'; btns.addFood.classList.add('hidden'); } document.getElementById('chat-widget').classList.add('hidden'); views.app.classList.add('hidden'); views.auth.classList.remove('hidden'); currentUser = null; currentLog = null; await logoutUser(); } });
    if(btns.addFood) btns.addFood.addEventListener('click', () => { views.modal.classList.remove('hidden'); views.modal.classList.add('flex'); window.switchAddView('text'); }); 
    if(btns.closeModal) btns.closeModal.addEventListener('click', () => { views.modal.classList.add('hidden'); views.modal.classList.remove('flex'); if(window.html5QrCode){window.html5QrCode.stop().catch(()=>{});window.html5QrCode=null;} });
    if(btns.refreshAI) { btns.refreshAI.addEventListener('click', () => { updateAICoach(currentLog, currentDayGoals, currentUser, userPrefs); }); }
    
    // --- ADD FOOD HANDLERS ---
    if(btns.manualAdd) { btns.manualAdd.addEventListener('click', () => { const name = getEl('manual-name').value; const s = Math.max(0.1, Number(getEl('manual-servings').value)||1); const item = { name: name, calories: Math.max(0, Math.round(Number(getEl('manual-cals').value)*s)), protein: Math.max(0, Math.round(Number(getEl('manual-prot').value)*s)), carbs: Math.max(0, Math.round(Number(getEl('manual-carb').value)*s)), fat: Math.max(0, Math.round(Number(getEl('manual-fat').value)*s)) }; if(item.name && item.calories>=0) { saveFood(item); saveToRecents(item); ['manual-name','manual-cals','manual-prot','manual-carb','manual-fat'].forEach(id=>getEl(id).value=''); getEl('manual-servings').value=1; } else { alert("Enter Valid Details"); } }); }
    if(btns.textInput) { btns.textInput.addEventListener('keyup', (e) => { const query = e.target.value.trim(); if(searchTimeout) clearTimeout(searchTimeout); if(!query || query.length<2) return; searchTimeout = setTimeout(async () => { const resDiv = getEl('text-results'); resDiv.innerHTML = '<p class="text-center text-indigo-500 animate-pulse mt-4">Searching...</p>'; const items = await searchFoodText(query); resDiv.innerHTML = ''; items.forEach(item => { const btn = document.createElement('button'); btn.className = "w-full text-left p-4 bg-gray-50 rounded-2xl flex justify-between mb-2 hover:bg-indigo-50 transition"; btn.innerHTML = `<span class="font-bold text-gray-800">${item.name}</span> <span class="text-sm text-gray-500">${item.calories} kcal</span>`; btn.onclick = () => { pendingFoodItem = item; getEl('popup-food-name').textContent = item.name; getEl('popup-food-cals').textContent = `${item.calories} kcal`; getEl('popup-servings').value = 1; getEl('text-selection-popup').classList.remove('hidden'); getEl('text-selection-popup').classList.add('flex'); }; resDiv.appendChild(btn); }); }, 600); }); }
    if(btns.popupAdd) { btns.popupAdd.addEventListener('click', () => { if(pendingFoodItem) { const s = Math.max(0.1, Number(getEl('popup-servings').value)||1); const final = { name: pendingFoodItem.name, calories: Math.max(0, Math.round(pendingFoodItem.calories*s)), protein: Math.max(0, Math.round((pendingFoodItem.protein||0)*s)), carbs: Math.max(0, Math.round((pendingFoodItem.carbs||0)*s)), fat: Math.max(0, Math.round((pendingFoodItem.fat||0)*s)) }; saveFood(final); getEl('text-selection-popup').classList.add('hidden'); getEl('text-selection-popup').classList.remove('flex'); getEl('text-search-input').value = ""; getEl('text-results').innerHTML = ""; } }); }
    if(btns.snapInput) { btns.snapInput.addEventListener('change', async (e) => { const file = e.target.files[0]; if(!file) return; const status = getEl('snap-status'); btns.snapInput.disabled = true; if(status) status.textContent = "Analyzing..."; const reader = new FileReader(); reader.readAsDataURL(file); reader.onloadend = async () => { try { const item = await identifyFoodFromImage(reader.result); pendingFoodItem = item; getEl('snap-upload-area').classList.add('hidden'); getEl('snap-result-area').classList.remove('hidden'); getEl('snap-preview-img').src = reader.result; getEl('snap-food-name').textContent = item.name; getEl('snap-food-cals').textContent = `${item.calories} kcal`; } catch(e){ console.log(e); } finally { btns.snapInput.disabled = false; } }; }); }
    if(btns.snapConfirm) { btns.snapConfirm.addEventListener('click', () => { if(pendingFoodItem) { const s = Math.max(0.1, Number(getEl('snap-servings').value)||1); const final = { name: pendingFoodItem.name, calories: Math.max(0, Math.round(pendingFoodItem.calories*s)), protein: Math.max(0, Math.round((pendingFoodItem.protein||0)*s)), carbs: Math.max(0, Math.round((pendingFoodItem.carbs||0)*s)), fat: Math.max(0, Math.round((pendingFoodItem.fat||0)*s)) }; saveFood(final, false); window.resetSnapView(); } }); }
    if(btns.barcodeAdd) { btns.barcodeAdd.addEventListener('click', () => { if(pendingFoodItem) { const servings = Number(getEl('barcode-servings').value) || 1; const finalFood = { name: pendingFoodItem.name, calories: Math.round(pendingFoodItem.calories * servings), protein: Math.round(pendingFoodItem.protein * servings) }; saveFood(finalFood, false); alert(`Added ${servings} serving(s)!`); window.resetBarcodeScanner(); } }); }

    // Barcode Listener
    document.addEventListener('barcode-scanned', async (e) => { const barcode = e.detail; const status = getEl('barcode-status'); getEl('scanner-container').classList.add('hidden'); if(status) status.textContent = "Fetching product details..."; try { const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`); const data = await response.json(); if (data.status === 1) { const product = data.product; const name = product.product_name || "Unknown Product"; const cals = product.nutriments['energy-kcal_100g'] || product.nutriments['energy-kcal'] || 0; const prot = product.nutriments['proteins_100g'] || 0; pendingFoodItem = { name: name, calories: Math.round(cals), protein: Math.round(prot) }; getEl('barcode-result').classList.remove('hidden'); getEl('barcode-product-name').textContent = `${name} (${Math.round(cals)} cal/100g)`; getEl('barcode-servings').value = 1; if(status) status.textContent = ""; } else { if(status) status.textContent = "Product not found. Try again."; getEl('scanner-container').classList.remove('hidden'); } } catch (err) { if(status) status.textContent = "API Error. Try again."; getEl('scanner-container').classList.remove('hidden'); } });

    // --- ENERGY / MOOD LOGGING ---
    document.addEventListener('energy-logged', async (e) => {
        const energyLevel = e.detail;
        if(currentLog && currentLog.entries && currentLog.entries.length > 0) {
            const lastIdx = currentLog.entries.length - 1;
            currentLog.entries[lastIdx].energy = energyLevel;
            const dateId = getDateId(currentViewDate);
            await updateDailyLog(currentUser.uid, dateId, currentLog.entries);
            alert(`Energy logged: ${energyLevel}!`);
            window.skipEnergy(); 
        }
    });

    // --- MEAL MATCH (TINDER) LOGIC ---
    document.addEventListener('start-meal-match', async () => {
        const modal = getEl('meal-match-modal');
        const loader = getEl('card-loader');
        const stack = getEl('card-stack');
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        loader.classList.remove('hidden');
        
        // Clear previous stack
        Array.from(stack.children).forEach(child => {
            if(child.id !== 'card-loader') child.remove();
        });

        // Calculate remaining macros
        const entries = currentLog?.entries || [];
        const totals = entries.reduce((a, b) => ({
            cals: a.cals + (b.calories || 0),
            prot: a.prot + (b.protein || 0)
        }), { cals: 0, prot: 0 });

        const calsLeft = Math.round(currentDayGoals.calories - totals.cals);
        const protLeft = Math.round(currentDayGoals.protein - totals.prot);

        // Fetch AI Ideas
        mealStack = await generateMealIdeas(calsLeft, protLeft, userPrefs);
        
        loader.classList.add('hidden');
        renderMealStack();
    });

    // NEW: Helper to reveal cards underneath
    function updateStackVisibility() {
        const stack = getEl('card-stack');
        const cards = Array.from(stack.children).filter(c => c.classList.contains('meal-card'));
        
        // Loop backwards (top of stack is last index)
        const total = cards.length;
        cards.forEach((card, index) => {
            // Index 0 is bottom. Index (total-1) is top.
            // We want (total-1) and (total-2) to be visible.
            if(index >= total - 2) {
                card.style.opacity = '1';
            } else {
                card.style.opacity = '0';
            }
        });
    }

    document.addEventListener('meal-swipe', (e) => {
        const dir = e.detail; // 'left' or 'right'
        const stack = getEl('card-stack');
        const topCard = stack.lastElementChild; // Last element is visually on top

        if(!topCard || topCard.id === 'card-loader') return;

        // Animate
        if(dir === 'left') topCard.classList.add('swipe-left');
        else topCard.classList.add('swipe-right');

        const meal = mealStack[mealStack.length - 1]; // Current meal data

        setTimeout(() => {
            topCard.remove();
            mealStack.pop(); // Remove from data array
            
            // KEY FIX: Make the next card visible
            updateStackVisibility();

            if(dir === 'right') {
                // SAVE MEAL
                const s = 1;
                const final = { 
                    name: meal.name, 
                    calories: meal.calories, 
                    protein: meal.protein, 
                    carbs: meal.carbs, 
                    fat: meal.fat 
                };
                saveFood(final);
                getEl('meal-match-modal').classList.add('hidden');
                getEl('meal-match-modal').classList.remove('flex');
                
                // Close the add food modal too since we are done
                getEl('add-food-modal').classList.add('hidden');
                getEl('add-food-modal').classList.remove('flex');
            } else {
                // LEFT SWIPE (PASS)
                if(mealStack.length === 0) {
                    // Empty Stack
                    getEl('meal-match-modal').classList.add('hidden');
                    getEl('meal-match-modal').classList.remove('flex');
                    alert("No more ideas! Try adjusting your filters.");
                }
            }
        }, 300);
    });

    function renderMealStack() {
        const stack = getEl('card-stack');
        
        mealStack.forEach((meal, index) => {
            const card = document.createElement('div');
            card.className = "meal-card p-6 flex flex-col justify-between";
            // Z-index trick: index 0 is at bottom, last index is at top
            card.style.zIndex = index + 10;
            // Slight rotation for realism
            if(index < mealStack.length - 1) {
                const randomRot = (Math.random() * 4) - 2;
                card.style.transform = `scale(${1 - ((mealStack.length - 1 - index) * 0.05)}) translateY(${(mealStack.length - 1 - index) * 10}px) rotate(${randomRot}deg)`;
            }

            // Init visibility using the same logic
            card.style.opacity = index > mealStack.length - 3 ? '1' : '0';

            card.innerHTML = `
                <div class="flex-1 flex flex-col items-center justify-center text-center">
                    <div class="text-[5rem] mb-4 drop-shadow-md animate-bounce">${meal.emoji || '🥘'}</div>
                    <h3 class="text-3xl font-black text-slate-900 leading-tight mb-2">${meal.name}</h3>
                    <p class="text-slate-500 font-medium leading-relaxed px-2">${meal.description}</p>
                </div>
                
                <div class="mt-8">
                    <div class="flex justify-between items-center mb-4 px-2">
                        <div class="text-center">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Calories</p>
                            <p class="text-2xl font-black text-indigo-600">${meal.calories}</p>
                        </div>
                        <div class="h-8 w-px bg-slate-100"></div>
                        <div class="text-center">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Protein</p>
                            <p class="text-2xl font-black text-emerald-500">${meal.protein}g</p>
                        </div>
                        <div class="h-8 w-px bg-slate-100"></div>
                        <div class="text-center">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Carbs</p>
                            <p class="text-2xl font-black text-amber-500">${meal.carbs}g</p>
                        </div>
                    </div>
                </div>
            `;
            stack.appendChild(card);
        });
    }
});

// --- LIVE2D FUNCTIONS ---
function initLive2D() {
    if (typeof L2Dwidget === "undefined") {
        console.warn("Live2D widget not loaded properly.");
        return;
    }

    try {
        // Init the widget hidden first so it renders to DOM
        L2Dwidget.init({
            model: { 
                // UPDATED: Using local path with Cache Busting
                jsonPath: "./assets/shizuku/shizuku.model.json?v=" + new Date().getTime(),
                scale: 1 
            },
            display: { 
                position: "right", 
                width: 200, 
                height: 400, 
                hOffset: 0, 
                vOffset: 0 
            },
            mobile: { show: true, scale: 1 },
            react: { opacityDefault: 1, opacityOnHover: 1 },
            // UPDATED: Explicitly disabling dialogue logic
            dialog: { 
                enable: false,
                script: { 'tap body': [], 'tap face': [] } 
            }
        });

        // MOVE WIDGET INTO CARD
        const checkWidget = setInterval(() => {
            const widget = document.getElementById('live2d-widget');
            const container = document.getElementById('waifu-container');
            const card = document.getElementById('ai-companion-card');
            
            if (widget && container && card) {
                // FORCE POINTER EVENTS NONE ON CANVAS
                widget.style.pointerEvents = 'none'; 
                
                // Clear the fixed positioning styles set by the library
                widget.style.position = 'absolute';
                widget.style.bottom = '-40px'; 
                widget.style.right = 'unset';
                widget.style.left = '50%';
                widget.style.top = 'unset';
                widget.style.transform = 'translateX(-50%)'; 
                
                // Move it into our card container
                container.appendChild(widget);
                
                // NOTE: We do NOT need to manually set opacity here.
                // The CSS rule 'body > #live2d-widget' stops applying automatically
                // once the element is moved out of body and into #waifu-container.
                
                clearInterval(checkWidget);
                console.log("Live2D Widget moved to dashboard card.");

                // Add interactions to the CARD CONTAINER
                card.addEventListener('click', () => {
                   triggerCompanionReaction('idle');
                });
            }
        }, 500);

        // Idle Timer
        setInterval(() => {
            if(!document.hidden) {
                triggerCompanionReaction('idle');
            }
        }, 20000);

    } catch(e) {
        console.error("Live2D Init Error:", e);
    }
}

// NEW: TRIGGER FUNCTION FOR ANIMATION & TEXT
function triggerCompanionReaction(type) {
    const widget = document.getElementById('live2d-widget');
    if(!widget) return;

    let textOptions = COMPANION_DATA.IDLE;
    let animClass = '';

    if (type === 'food') {
        textOptions = COMPANION_DATA.FOOD_LOGGED;
        animClass = 'live2d-jump';
    } else if (type === 'streak') {
        textOptions = COMPANION_DATA.STREAK;
        animClass = 'live2d-shake';
    } else {
        // Idle
        animClass = 'live2d-breath';
    }

    // 1. Show Text
    const text = textOptions[Math.floor(Math.random() * textOptions.length)];
    const finalMsg = type === 'streak' ? `${text} Streak: ${userStats.currentStreak}!` : text;
    showWaifuMessage(finalMsg);

    // 2. Trigger Animation on Container
    widget.classList.remove('live2d-jump', 'live2d-shake', 'live2d-breath');
    // Force Reflow
    void widget.offsetWidth;
    if(animClass) widget.classList.add(animClass);
}

let waifuTimeout;
function showWaifuMessage(text) {
    const dialog = document.getElementById('waifu-dialogue');
    const txt = document.getElementById('waifu-text');
    if(dialog && txt) {
        txt.textContent = text;
        dialog.classList.remove('hidden');
        dialog.classList.remove('fade-exit');
        dialog.classList.add('animate-enter');
        
        if(waifuTimeout) clearTimeout(waifuTimeout);
        waifuTimeout = setTimeout(() => {
            dialog.classList.add('fade-exit');
            setTimeout(() => dialog.classList.add('hidden'), 500);
        }, 4000);
    }
}

// --- CORE FUNCTIONS ---
async function saveFood(item, closeModal = true) { 
    if(!isToday(currentViewDate)) { alert("You can only add meals to today's log."); return; } 
    if(!currentLog.entries) currentLog.entries = []; 
    currentLog.entries.push(item); 
    renderDashboard(currentLog, currentDayGoals); 
    window.switchAddView('energy'); 
    await addFoodItem(currentUser.uid, getDateId(currentViewDate), item); 
    updateAICoach(currentLog, currentDayGoals, currentUser, userPrefs); 
    
    // TRIGGER REACTION: FOOD
    triggerCompanionReaction('food');
    
    await checkStreakOnLog();
}

function checkStreakOnInit() {
    const today = getDateId(new Date());
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayId = getDateId(yesterday);
    
    if (userStats.lastLogDate !== today && userStats.lastLogDate !== yesterdayId) {
        if (userStats.freezeCount > 0) {
            const last = new Date(userStats.lastLogDate);
            const diffTime = Math.abs(new Date() - last);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if(diffDays > 1) {
                if(userStats.freezeCount > 0) {
                   userStats.freezeCount--;
                   if(diffDays > 2) userStats.currentStreak = 0;
                   updateUserStats(currentUser.uid, userStats);
                } else {
                   userStats.currentStreak = 0;
                   updateUserStats(currentUser.uid, userStats);
                }
            }
        } else if (userStats.lastLogDate) {
             const last = new Date(userStats.lastLogDate);
             const now = new Date();
             if (getDateId(last) !== getDateId(now) && getDateId(last) !== yesterdayId) {
                 userStats.currentStreak = 0;
                 updateUserStats(currentUser.uid, userStats);
             }
        }
    }
}

async function checkStreakOnLog() {
    const todayId = getDateId(new Date());
    if (userStats.lastLogDate !== todayId) {
        userStats.currentStreak++;
        if (userStats.currentStreak > userStats.bestStreak) userStats.bestStreak = userStats.currentStreak;
        userStats.lastLogDate = todayId;
        if (userStats.currentStreak % 7 === 0) {
            userStats.freezeCount++;
            showWaifuMessage("Streak Freeze acquired.");
        }
        updateStreakUI();
        await updateUserStats(currentUser.uid, userStats);
        
        // TRIGGER REACTION: STREAK
        triggerCompanionReaction('streak');
    }
}

function updateStreakUI() {
    const streakEl = document.getElementById('streak-count');
    const freezeEl = document.getElementById('freeze-count');
    const container = document.getElementById('streak-container');
    const companionCard = document.getElementById('ai-companion-card'); 

    if(streakEl) streakEl.textContent = userStats.currentStreak;
    if(freezeEl) freezeEl.textContent = userStats.freezeCount;
    if(container) container.classList.remove('hidden');
    
    const dash = document.getElementById('main-dashboard-container');
    if(dash) {
        dash.classList.remove('streak-warm', 'streak-fire', 'streak-legendary');
        if(companionCard) companionCard.classList.remove('card-glow-gold', 'card-glow-ice');

        if(userStats.currentStreak >= 14) {
            dash.classList.add('streak-legendary');
            if(companionCard) companionCard.classList.add('card-glow-gold');
        } else if(userStats.currentStreak >= 7) {
            dash.classList.add('streak-fire');
            if(companionCard) companionCard.classList.add('card-glow-gold');
        } else if(userStats.currentStreak >= 3) {
            dash.classList.add('streak-warm');
        }

        if (userStats.freezeCount > 0) {
             const today = getDateId(new Date());
             const last = new Date(userStats.lastLogDate);
             const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
             if (userStats.lastLogDate !== today && getDateId(last) !== getDateId(yesterday)) {
                 if(companionCard) {
                     companionCard.classList.remove('card-glow-gold');
                     companionCard.classList.add('card-glow-ice');
                 }
             }
        }
    }
}

async function loadAppData(dateObj) {
    const getEl = (id) => document.getElementById(id); const isTodayDate = isToday(dateObj);
    getEl('current-date-display').textContent = isTodayDate ? "TODAY" : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    const arrowRight = document.getElementById('date-next-btn'); const editBtn = getEl('edit-goals-btn'); const addBtn = getEl('add-food-btn');

    if(isTodayDate) { 
        arrowRight.classList.add('opacity-30', 'pointer-events-none'); 
        editBtn.style.opacity = '1'; editBtn.style.pointerEvents = 'auto'; 
        addBtn.classList.remove('hidden'); addBtn.style.display = 'flex';
    } else { 
        arrowRight.classList.remove('opacity-30', 'pointer-events-none'); 
        editBtn.style.opacity = '0.3'; editBtn.style.pointerEvents = 'none'; 
        addBtn.classList.add('hidden'); addBtn.style.display = 'none';
    }
    
    currentLog = await getDailyLog(currentUser.uid, getDateId(dateObj)); 
    currentDayGoals = currentLog.dailyGoals || globalGoals; 
    renderDashboard(currentLog, currentDayGoals);
}

function renderDashboard(log, goals) {
    const getEl = (id) => document.getElementById(id); const list = getEl('food-list'); list.innerHTML = '';
    if (!log.entries || log.entries.length === 0) { list.innerHTML = `<div class="flex flex-col items-center justify-center py-10 opacity-60"><div class="bg-gray-100 p-4 rounded-full mb-3"><i data-lucide="coffee" class="w-8 h-8 text-gray-400"></i></div><p class="text-sm font-bold text-slate-500">No meals logged.</p></div>`; }
    let t = { cals: 0, prot: 0, carb: 0, fat: 0 };
    (log.entries || []).forEach((item, idx) => { t.cals += item.calories || 0; t.prot += item.protein || 0; t.carb += item.carbs || 0; t.fat += item.fat || 0; const div = document.createElement('div'); div.className = "flex justify-between items-center p-4 bg-white border border-slate-100 shadow-sm rounded-2xl mb-2 group transition-all hover:border-indigo-200"; div.innerHTML = `<div><span class="font-bold text-slate-800 block text-sm">${item.name}</span><div class="flex gap-3 text-[10px] font-bold uppercase tracking-wide mt-1"><span class="text-indigo-600">${Math.round(item.calories)} Cal</span><span class="text-emerald-600">${Math.round(item.protein||0)}P</span><span class="text-amber-600">${Math.round(item.carbs||0)}C</span><span class="text-rose-600">${Math.round(item.fat||0)}F</span></div></div> ${isToday(currentViewDate) ? `<button onclick="deleteItem(${idx})" class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition opacity-100 lg:opacity-0 lg:group-hover:opacity-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}`; list.appendChild(div); });
    getEl('cals-eaten').textContent = Math.round(t.cals); getEl('cals-goal').textContent = goals.calories; getEl('cals-remaining').textContent = Math.max(0, goals.calories - t.cals); getEl('cals-progress').style.width = `${Math.min((t.cals/goals.calories)*100, 100)}%`;
    const updateMacro = (key, val, goal) => { getEl(`val-${key}`).textContent = Math.round(val); getEl(`goal-val-${key}`).textContent = goal || 100; getEl(`prog-${key}`).style.width = `${Math.max(0, Math.min((val/(goal||100))*100, 100))}%`; };
    updateMacro('prot', t.prot, goals.protein); updateMacro('carb', t.carb, goals.carbs || 250); updateMacro('fat', t.fat, goals.fat || 70);
    getEl('water-val').textContent = log.water || 0; getEl('water-goal').textContent = goals.water || 3000; getEl('water-fill').style.height = `${Math.min(((log.water||0)/(goals.water||3000))*100, 100)}%`;
    document.getElementById('water-controls').style.display = isToday(currentViewDate) ? 'flex' : 'none';
    document.getElementById('ai-passive-container').style.display = isToday(currentViewDate) ? 'block' : 'none';
    renderDonut(t, goals);
    if(window.lucide) lucide.createIcons();
}

function renderDonut(totals, goals) {
    const canvas = document.getElementById('dailyDonut');
    if(!canvas) return;
    const pPct = Math.min((totals.prot / goals.protein) * 100, 100);
    const cPct = Math.min((totals.carb / (goals.carbs || 250)) * 100, 100);
    const fPct = Math.min((totals.fat / (goals.fat || 70)) * 100, 100);
    const ctx = canvas.getContext('2d');
    if(dailyDonutInstance) dailyDonutInstance.destroy();
    dailyDonutInstance = new Chart(ctx, { type: 'doughnut', data: { datasets: [ { data: [pPct, 100 - pPct], backgroundColor: ['#10b981', '#ecfdf5'], borderWidth: 0, borderRadius: 20, cutout: '90%', circumference: 360, rotation: 0 }, { data: [cPct, 100 - cPct], backgroundColor: ['#f59e0b', '#fffbeb'], borderWidth: 0, borderRadius: 20, cutout: '80%', circumference: 360, rotation: 0, weight: 0.8 }, { data: [fPct, 100 - fPct], backgroundColor: ['#f43f5e', '#fff1f2'], borderWidth: 0, borderRadius: 20, cutout: '70%', circumference: 360, rotation: 0, weight: 0.6 } ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { animateScale: true, animateRotate: true, duration: 1500, easing: 'easeOutQuart' }, onClick: () => handleRingClick(totals) } });
}

let ringState = 0;
function handleRingClick(totals) {
    const centerText = document.getElementById('ring-center-text'); ringState = (ringState + 1) % 4; let html = '';
    switch(ringState) { case 0: html = `<span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest pop-in">MACROS</span>`; break; case 1: html = `<span class="text-[10px] font-bold text-emerald-500 uppercase pop-in">PROT</span><span class="text-sm font-black text-slate-700 pop-in">${Math.round(totals.prot)}g</span>`; break; case 2: html = `<span class="text-[10px] font-bold text-amber-500 uppercase pop-in">CARB</span><span class="text-sm font-black text-slate-700 pop-in">${Math.round(totals.carb)}g</span>`; break; case 3: html = `<span class="text-[10px] font-bold text-rose-500 uppercase pop-in">FAT</span><span class="text-sm font-black text-slate-700 pop-in">${Math.round(totals.fat)}g</span>`; break; }
    centerText.innerHTML = html;
}

function renderChart(historyData, metric) {
    const canvas = document.getElementById('weeklyChart'); const ctx = canvas.getContext('2d'); if(weeklyChartInstance) weeklyChartInstance.destroy();
    const colors = { calories: ['#6366f1', '#a855f7'], protein: ['#10b981', '#34d399'], carbs: ['#f59e0b', '#fbbf24'], fat: ['#f43f5e', '#fb7185'] };
    const c = colors[metric] || colors.calories; const gradient = ctx.createLinearGradient(0, 0, 0, 400); gradient.addColorStop(0, c[0]); gradient.addColorStop(1, c[1]);
    const labels = historyData.map(d => d.date); const data = historyData.map(d => d[metric]); const avg = Math.round(data.reduce((a,b)=>a+b,0) / data.length) || 0;
    document.getElementById('chart-title').textContent = `${metric.charAt(0).toUpperCase() + metric.slice(1)} Trend`; document.getElementById('chart-avg').textContent = avg;
    weeklyChartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: metric, data: data, backgroundColor: gradient, borderRadius: 4, barThickness: 'flex', hoverBackgroundColor: c[0] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display:false}, tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 8, displayColors: false, callbacks: { label: (c) => c.raw } } }, scales: { y: { beginAtZero: true, grid: { display: true, color: '#f1f5f9', drawBorder: false }, ticks: { color: '#94a3b8', font: { family: "'Plus Jakarta Sans', sans-serif", size: 10 } }, border: { display: false } }, x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold', size: 10 } }, border: { display: false } } }, animation: { duration: 1000, easing: 'easeOutQuart' } } });
}

function renderMultiAxisChart(historyData) {
    const canvas = document.getElementById('weeklyChart'); const ctx = canvas.getContext('2d'); if(weeklyChartInstance) weeklyChartInstance.destroy();
    const labels = historyData.map(d => d.date); document.getElementById('chart-title').textContent = "Combined Overview"; document.getElementById('chart-avg').textContent = "All";
    weeklyChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [ { label: 'Cals', data: historyData.map(d => d.calories), borderColor: '#6366f1', backgroundColor: '#6366f1', yAxisID: 'y', tension: 0.4, pointRadius: 0 }, { label: 'Prot', data: historyData.map(d => d.protein), borderColor: '#10b981', backgroundColor: '#10b981', yAxisID: 'y1', tension: 0.4, pointRadius: 0 }, { label: 'Carb', data: historyData.map(d => d.carbs), borderColor: '#f59e0b', backgroundColor: '#f59e0b', yAxisID: 'y1', tension: 0.4, pointRadius: 0 }, { label: 'Fat', data: historyData.map(d => d.fat), borderColor: '#f43f5e', backgroundColor: '#f43f5e', yAxisID: 'y1', tension: 0.4, pointRadius: 0 } ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 6 } } }, scales: { y: { type: 'linear', display: true, position: 'left', grid: { display: false } }, y1: { type: 'linear', display: true, position: 'right', grid: { display: false } }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } } } });
}

window.deleteItem = async function(idx) { if(confirm("Delete item?")) { currentLog.entries.splice(idx, 1); renderDashboard(currentLog, currentDayGoals); await updateDailyLog(currentUser.uid, getDateId(currentViewDate), currentLog.entries); updateAICoach(currentLog, currentDayGoals, currentUser, userPrefs); } }
function updateGreeting() { const h = new Date().getHours(); const user = currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'Friend'; let g = "GOOD EVENING", i = "🌙"; if (h < 5) { g = "LATE NIGHT"; i = "✨"; } else if (h < 12) { g = "GOOD MORNING"; i = "☀️"; } else if (h < 17) { g = "GOOD AFTERNOON"; i = "🌤️"; } document.getElementById('greeting-sub').innerHTML = `${g} <span id="greeting-icon">${i}</span>`; document.getElementById('greeting-name').textContent = user; }
function isToday(date) { const today = new Date(); return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); }
window.deleteRecent = function(index, event) { if(event) event.stopPropagation(); let recents = JSON.parse(localStorage.getItem('trackMyPlate_recents') || '[]'); if(confirm(`Remove "${recents[index].name}"?`)) { recents.splice(index, 1); localStorage.setItem('trackMyPlate_recents', JSON.stringify(recents)); renderRecentMeals(); } }
function saveToRecents(food) { let recents = JSON.parse(localStorage.getItem('trackMyPlate_recents') || '[]'); if(!recents.some(r => r.name.toLowerCase() === food.name.toLowerCase())) { recents.unshift(food); if(recents.length > 8) recents.pop(); localStorage.setItem('trackMyPlate_recents', JSON.stringify(recents)); renderRecentMeals(); } }
window.renderRecentMeals = function() { const list = document.getElementById('recent-meals-list'); if(!list) return; const recents = JSON.parse(localStorage.getItem('trackMyPlate_recents') || '[]'); list.innerHTML = ''; if(recents.length === 0) { list.innerHTML = '<p class="text-center text-xs text-gray-400 py-4">No recent meals saved.</p>'; return; } recents.forEach((food, index) => { const div = document.createElement('div'); div.className = "flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 cursor-pointer group mb-2"; div.innerHTML = ` <div class="flex-1" onclick="fillManualForm('${food.name}', ${food.calories}, ${food.protein}, ${food.carbs}, ${food.fat})"> <span class="text-sm font-bold text-slate-800 block">${food.name}</span> <span class="text-xs text-slate-400">${food.calories} cal</span> </div> <button onclick="deleteRecent(${index}, event)" class="p-2 text-slate-300 hover:text-red-500 rounded-full transition opacity-0 group-hover:opacity-100"> <i data-lucide=\"trash-2\" class=\"w-4 h-4\"></i> </button> `; list.appendChild(div); }); if(window.lucide) lucide.createIcons(); }
window.fillManualForm = (n,c,p,cb,f) => { ['manual-name','manual-cals','manual-prot','manual-carb','manual-fat'].forEach(id => document.getElementById(id).value=''); document.getElementById('manual-name').value=n; document.getElementById('manual-cals').value=c; document.getElementById('manual-prot').value=p; document.getElementById('manual-carb').value=cb||0; document.getElementById('manual-fat').value=f||0; document.getElementById('manual-servings').value="1"; }
