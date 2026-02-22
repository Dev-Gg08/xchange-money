
// Import Firebase dependencies
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, push, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
    databaseURL: "https://math-50c44-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- State & Constants ---
let currentUser = null;
let currentHistoryTab = 'topup';

const views = {
    login: document.getElementById('login-view'),
    home: document.getElementById('home-view'),
    topup: document.getElementById('topup-view'),
    history: document.getElementById('history-view')
};

// --- Core Navigation ---
function switchView(viewName) {
    if (viewName === 'login') {
        views.login.style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
        return;
    }

    views.login.style.display = 'none';
    document.getElementById('main-content').style.display = 'block';

    Object.keys(views).forEach(v => {
        if (v === 'login') return;
        if (v === viewName) {
            views[v].classList.add('active');
        } else {
            views[v].classList.remove('active');
        }
    });

    // Update nav icons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (viewName === 'home') generateChart();
    if (viewName === 'history') fetchHistory();
}

// --- Authentication ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const pin = document.getElementById('login-pin').value;

    if (!username || pin.length !== 4) {
        alert("Please enter a valid Username and 4-digit PIN");
        return;
    }

    // Attempt Login / Auto-Registration for this demo
    // In a real app, you'd check a users/ path
    const userRef = ref(db, `users/${username}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
        const userData = snapshot.val();
        if (userData.pin === pin) {
            loginSession(username, userData);
        } else {
            alert("Incorrect PIN");
        }
    } else {
        // Register new user (Simplified)
        const newUser = {
            username: username,
            pin: pin,
            balance: 0,
            created_at: serverTimestamp()
        };
        await set(userRef, newUser);
        loginSession(username, newUser);
    }
});

function loginSession(username, data) {
    currentUser = username;
    document.getElementById('display-username').textContent = username;
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${username}&background=e6ff55&color=121212`;

    // Listen for balance updates
    onValue(ref(db, `users/${currentUser}/balance`), (snapshot) => {
        const balance = snapshot.val() || 0;
        document.getElementById('display-balance').textContent = balance.toLocaleString(undefined, { minimumFractionDigits: 2 });
    });

    switchView('home');
    localStorage.setItem('school_exchange_user', username);
}

document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('school_exchange_user');
    location.reload();
});

// --- History Logic ---
document.querySelectorAll('.tab-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-sub-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentHistoryTab = btn.dataset.history;
        fetchHistory();
    });
});

async function fetchHistory() {
    const container = document.getElementById('history-list-container');
    container.innerHTML = '<div class="spinner"></div>';

    const historyRef = ref(db, `users/${currentUser}/history/${currentHistoryTab}`);
    onValue(historyRef, (snapshot) => {
        container.innerHTML = '';
        const data = snapshot.val();

        if (!data) {
            container.innerHTML = '<div class="empty-history">No history found</div>';
            return;
        }

        const items = Object.values(data).reverse();
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            const isPlus = currentHistoryTab === 'topup';
            div.innerHTML = `
                <div class="history-info">
                    <div class="history-icon"><i class="fas ${isPlus ? 'fa-arrow-up' : 'fa-exchange-alt'}"></i></div>
                    <div>
                        <span class="history-title">${item.memo || (isPlus ? 'Top-up' : 'Exchange')}</span>
                        <span class="history-date">${new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                </div>
                <span class="history-amount ${isPlus ? 'plus' : 'minus'}">${isPlus ? '+' : '-'}฿${item.amount.toLocaleString()}</span>
            `;
            container.appendChild(div);
        });
    }, { onlyOnce: false });
}

// --- Top-up Logic ---
const topupModal = document.getElementById('topup-modal');
const qrDisplayModal = document.getElementById('qr-display-view');
let activeChannel = '';

document.querySelectorAll('.payment-card').forEach(card => {
    card.addEventListener('click', () => {
        activeChannel = card.dataset.channel;
        topupModal.classList.add('active');
    });
});

document.querySelector('.close-modal').addEventListener('click', () => topupModal.classList.remove('active'));
document.querySelector('.close-qr-modal').addEventListener('click', () => qrDisplayModal.classList.remove('active'));

document.getElementById('btn-topup-confirm').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    if (isNaN(amount) || amount <= 0) return;

    generateQR(amount);
    topupModal.classList.remove('active');
    qrDisplayModal.classList.add('active');
    document.getElementById('display-amount').textContent = amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
});

async function generateQR(amount) {
    const container = document.getElementById('qrcode-container');
    container.innerHTML = '<div class="spinner"></div>';

    try {
        if (!window.QRCode) {
            await loadScript("https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js");
        }

        // Mock PromptPay Payload
        const payload = `00020101021129370016A0000006770101110113006694XXXXXX5802TH53037645405${amount.toFixed(2).length}${amount.toFixed(2)}6304`;

        QRCode.toCanvas(payload, { width: 250, margin: 2, color: { dark: '#121212', light: '#ffffff' } }, (err, canvas) => {
            container.innerHTML = '';
            if (err) container.innerHTML = "QR Error";
            else container.appendChild(canvas);
        });
    } catch (err) {
        container.innerHTML = "QR Load Error";
    }
}

document.getElementById('btn-cancel-topup').addEventListener('click', async () => {
    // Simulate top-up completion for the demo
    const amount = parseFloat(document.getElementById('display-amount').textContent.replace(/,/g, ''));

    // 1. Update Balance
    const balanceRef = ref(db, `users/${currentUser}/balance`);
    const currentSnap = await get(balanceRef);
    const currentBalance = currentSnap.val() || 0;
    await set(balanceRef, currentBalance + amount);

    // 2. Add to History
    const historyRef = push(ref(db, `users/${currentUser}/history/topup`));
    await set(historyRef, {
        amount: amount,
        timestamp: Date.now(),
        memo: `Top-up via ${activeChannel}`
    });

    qrDisplayModal.classList.remove('active');
    alert("Payment detected! Balance updated.");
});

// --- Navigation setup ---
document.querySelectorAll('.nav-btn, .action-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// --- Utility Chart ---
function generateChart() {
    const container = document.getElementById('chart-container');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 30; i++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = `${Math.random() * 80 + 20}%`;
        if (i === 22) bar.classList.add('active');
        container.appendChild(bar);
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

// --- Init Session ---
const savedUser = localStorage.getItem('school_exchange_user');
if (savedUser) {
    get(ref(db, `users/${savedUser}`)).then(snap => {
        if (snap.exists()) loginSession(savedUser, snap.val());
        else switchView('login');
    });
} else {
    switchView('login');
}
