export function renderDashboard(dailyData, goals) {
    const entries = dailyData?.entries || [];
    const userGoals = goals || { calories: 2500, protein: 60 };
    
    // 1. Calculate Totals
    const totals = entries.reduce((acc, item) => ({
        calories: acc.calories + (item.calories || 0),
        protein: acc.protein + (item.protein || 0),
    }), { calories: 0, protein: 0 });

    // 2. Update Text
    safeTextUpdate('total-calories', Math.round(totals.calories));
    safeTextUpdate('goal-calories', userGoals.calories);
    safeTextUpdate('total-protein', Math.round(totals.protein));

    // 3. Update Bars
    updateProgressBar('progress-calories', totals.calories, userGoals.calories);
    updateProgressBar('progress-protein', totals.protein, userGoals.protein);

    // 4. Render List
    const listEl = document.getElementById('food-list');
    if (listEl) {
        listEl.innerHTML = '';
        if (entries.length === 0) {
            listEl.innerHTML = '<div class="text-center py-8 text-slate-400 text-sm">No food logged today.</div>';
        } else {
            entries.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = "flex justify-between items-center p-3 bg-white rounded-xl shadow-sm border border-slate-100";
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-lg">🍎</div>
                        <div>
                            <p class="font-bold text-slate-700 text-sm">${item.name}</p>
                            <p class="text-xs text-slate-500">${Math.round(item.calories)} cal • ${Math.round(item.protein)}g Prot</p>
                        </div>
                    </div>
                `;
                listEl.appendChild(div);
            });
        }
    }
    
    if (window.lucide) lucide.createIcons();
}

function safeTextUpdate(id, text) {
    const el = document.getElementById(id);
    if(el) el.textContent = text;
}

function updateProgressBar(id, val, max) {
    const el = document.getElementById(id);
    if(el) {
        const percentage = (val / max) * 100;
        el.style.width = `${Math.min(percentage, 100)}%`;
        
        // Change color to indicate progress toward weight gain
        if (percentage > 90 && percentage <= 110) {
            el.style.backgroundColor = "#10b981"; // Success Green
        } else if (percentage > 110) {
            el.style.backgroundColor = "#f59e0b"; // Warning Orange (Too much surplus)
        }
    }
}

// Export for use in HTML buttons if needed
export function switchTab(tab) {
    // Logic handled in app.js listener now for cleaner separation
}