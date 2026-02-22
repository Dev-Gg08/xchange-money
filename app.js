
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
document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-goto-register')) switchView('register');
    if (e.target.classList.contains('btn-goto-login')) switchView('login');

    const navBtn = e.target.closest('.nav-btn');
    if (navBtn) switchView(navBtn.dataset.view);

    // Top-up Channel Selection
    const paymentCard = e.target.closest('.payment-card');
    if (paymentCard) {
        const channel = paymentCard.dataset.channel;
        openTopupModal(channel);
    }

    // Close Modal
    if (e.target.classList.contains('close-modal') || e.target.id === 'topup-modal') {
        document.getElementById('topup-modal').classList.remove('active');
    }
});

// --- Top-up Logic ---
let activeChannel = null;

function openTopupModal(channel) {
    activeChannel = channel;
    const modal = document.getElementById('topup-modal');
    const title = document.getElementById('topup-modal-title');
    const icon = document.getElementById('topup-channel-icon');

    const channelData = {
        qr: { title: 'เติมเงินผ่านการสแกน QR', icon: 'https://media.discordapp.net/attachments/1110000000000000000/1342759972323885066/image.png' },
        truemoney: { title: 'เติมเงินผ่าน TrueMoney', icon: 'https://media.discordapp.net/attachments/1110000000000000000/1342759972827074570/image.png' },
        angpao: { title: 'เติมเงินผ่านโค้ด', icon: 'https://media.discordapp.net/attachments/1110000000000000000/1342759973271732314/image.png' }
    };

    const data = channelData[channel] || { title: 'เติมเงิน', icon: '' };
    title.textContent = data.title;

    if (data.icon) {
        icon.src = data.icon;
        icon.style.display = 'block';
    } else {
        icon.style.display = 'none';
    }


    // Reset steps
    document.getElementById('topup-step-1').classList.add('active');
    document.getElementById('topup-step-2').classList.remove('active');
    modal.classList.add('active');
}

document.getElementById('btn-topup-next').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    if (isNaN(amount) || amount <= 0) {
        alert("กรุณาระบุจำนวนเงินที่ถูกต้อง");
        return;
    }

    document.getElementById('display-amount').textContent = amount.toLocaleString();
    generateQR(amount);

    document.getElementById('topup-step-1').classList.remove('active');
    document.getElementById('topup-step-2').classList.add('active');
});

async function generateQR(amount) {
    const container = document.getElementById('qrcode-container');
    container.innerHTML = '<div style="padding:20px;">กำลังสร้าง QR Code...</div>';

    // Generate simple PromptPay payload (mocked for demo as per user screenshots logic)
    const payload = `00020101021129370016A0000006770101110113006694XXXXXX5802TH53037645405${amount.toFixed(2).length}${amount.toFixed(2)}6304`;

    QRCode.toCanvas(payload, {
        width: 250,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' }
    }, (err, canvas) => {
        container.innerHTML = '';
        if (err) container.innerHTML = "QR Error";
        else container.appendChild(canvas);
    });
}

document.getElementById('btn-confirm-payment').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('display-amount').textContent.replace(/,/g, ''));
    const btn = document.getElementById('btn-confirm-payment');

    btn.disabled = true;
    btn.textContent = "กำลังตรวจสอบ...";

    try {
        // 1. Update Balance in Supabase (Increment)
        // Note: Real apps should use an RPC function or careful atomic updates
        const { data: currentProfile } = await supabase.from('profiles').select('balance').eq('id', currentUser.id).single();
        const newBalance = (currentProfile?.balance || 0) + amount;

        const { error: balError } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', currentUser.id);

        if (balError) throw balError;

        // 2. Record Transaction
        const { error: txError } = await supabase.from('transactions').insert({
            user_id: currentUser.id,
            amount: amount,
            type: 'topup',
            memo: `เติมเงินผ่าน ${activeChannel}`
        });

        if (txError) throw txError;

        alert("เติมเงินสำเร็จ! ยอดเงินจะอัปเดตทันที");
        document.getElementById('topup-modal').classList.remove('active');

        // 3. Update Sync
        document.getElementById('display-balance').textContent = newBalance.toLocaleString(undefined, { minimumFractionDigits: 2 });
        if (document.getElementById('main-content').style.display === 'block') fetchHistory();

    } catch (err) {
        alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "ยืนยันการชำระเงิน";
    }
});

async function fetchHistory() {
    const container = document.getElementById('history-list-container');
    if (!container) return;

    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = '<div style="color:red; padding:20px;">โหลดประวัติไม่สำเร็จ</div>';
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-sub); padding: 40px 0;">ยังไม่มีประวัติการทำรายการ</div>';
        return;
    }

    container.innerHTML = '';
    data.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:white; padding:20px; border-radius:24px; margin-bottom:12px; box-shadow:var(--shadow-soft);";
        const date = new Date(item.created_at).toLocaleString('th-TH');
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:40px; height:40px; background:#FEE2E2; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#EF4444;"><i class="fas fa-plus"></i></div>
                <div style="text-align:left;">
                    <div style="font-weight:700; font-size:14px;">${item.memo}</div>
                    <div style="font-size:12px; color:var(--text-sub);">${date}</div>
                </div>
            </div>
            <div style="font-weight:700; color:#10B981;">+฿${item.amount.toLocaleString()}</div>
        `;
        container.appendChild(div);
    });
}

// Update switchView to fetch history when needed
const _switchView = switchView;
switchView = function (viewName) {
    _switchView(viewName);
    if (viewName === 'history') fetchHistory();
};

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
            bar.style.background = "#EF4444";
            bar.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
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
const dateEl = document.getElementById('display-date');
if (dateEl) dateEl.innerHTML = `${now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })} <i class="fas fa-chevron-down"></i>`;
