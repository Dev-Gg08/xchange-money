
// --- Supabase Config ---
const SUPABASE_URL = "https://xhoiouzraqoyvevbxefj.supabase.co";
const SUPABASE_KEY = "sb_publishable_K3hyy5i7tZ5J9Z4WtTop1g_ZFAW06R5";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- State ---
let currentUser = null;
let profile = null;

// --- Views Management ---
function switchView(viewName) {
    const views = {
        login: document.getElementById('login-view'),
        register: document.getElementById('register-view'),
        home: document.getElementById('home-view'),
        topup: document.getElementById('topup-view'),
        history: document.getElementById('history-view')
    };
    const mainContent = document.getElementById('main-content');

    // 1. Reset everything
    Object.keys(views).forEach(v => {
        if (views[v]) {
            views[v].style.display = 'none';
            views[v].classList.remove('active');
        }
    });

    // 2. Auth screens are flex full-screen
    if (viewName === 'login' || viewName === 'register') {
        if (mainContent) mainContent.style.display = 'none';
        const target = views[viewName];
        if (target) {
            target.style.display = 'flex';
            setTimeout(() => target.classList.add('active'), 10);
        }
    } else {
        // 3. Dashboard views
        if (mainContent) mainContent.style.display = 'block';
        const target = views[viewName];
        if (target) {
            target.style.display = 'block';
            setTimeout(() => target.classList.add('active'), 10);
        }
    }

    // Nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.dataset.view === viewName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    if (viewName === 'home') generateChart();
}

// --- Auth Logic ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Login failed: " + error.message);
    } else {
        initSession(data.user);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (password !== confirmPassword) {
        alert("รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
        return;
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName }
        }
    });

    if (error) {
        alert("Registration failed: " + error.message);
    } else {
        alert("สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยัน (ถ้ามี) หรือเข้าสู่ระบบ");
        switchView('login');
    }
}

async function initSession(user) {
    currentUser = user;

    // Fetch user profile from public.profiles (assuming it exists or using user metadata)
    const displayName = user.user_metadata.full_name || user.email;
    document.getElementById('display-username').textContent = displayName;
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?background=4F46E5&color=fff&name=${encodeURIComponent(displayName)}`;

    // Get balance (or simulate if no profile table yet)
    // For demo, we check a 'profiles' table or set default
    const { data: profileData } = await supabase.from('profiles').select('balance').eq('id', user.id).single();
    const balance = profileData ? profileData.balance : 0;
    document.getElementById('display-balance').textContent = balance.toLocaleString(undefined, { minimumFractionDigits: 2 });

    switchView('home');
}

// --- Navigation ---
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-goto-register')) switchView('register');
    if (e.target.classList.contains('btn-goto-login')) switchView('login');

    const navBtn = e.target.closest('.nav-btn');
    if (navBtn) switchView(navBtn.dataset.view);
});

// Logout
const logoutBtn = document.getElementById('btn-logout');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        location.reload();
    });
}

// --- Initialization ---
const loginForm = document.getElementById('login-form');
if (loginForm) loginForm.addEventListener('submit', handleLogin);

const regForm = document.getElementById('register-form');
if (regForm) regForm.addEventListener('submit', handleRegister);

// Check current session
async function checkCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        initSession(session.user);
    } else {
        switchView('login');
    }
}

// --- Chart Mock ---
function generateChart() {
    const container = document.getElementById('chart-container');
    if (!container) return;
    container.innerHTML = '';
    container.style.cssText = "height: 120px; display: flex; align-items: flex-end; gap: 8px;";
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.style.cssText = `flex: 1; background: #EEF2FF; border-radius: 6px; height: ${Math.random() * 80 + 20}%; transition: 0.3s;`;
        if (i === 15) {
            bar.style.background = "#4F46E5";
            bar.style.boxShadow = "0 4px 12px rgba(79, 70, 229, 0.3)";
        }
        container.appendChild(bar);
    }
}

async function handleGoogleLogin() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + window.location.pathname
        }
    });
    if (error) alert("Google Login error: " + error.message);
}

document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleLogin);

checkCurrentSession();
generateChart();
const now = new Date();
document.getElementById('display-date').innerHTML = `${now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })} <i class="fas fa-chevron-down"></i>`;
