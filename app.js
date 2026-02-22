// --- Firebase Config ---
const firebaseConfig = {
    databaseURL: "https://math-50c44-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- Supabase Config (Keep for Auth) ---
const SUPABASE_URL = "https://xhoiouzraqoyvevbxefj.supabase.co";
const SUPABASE_KEY = "sb_publishable_K3hyy5i7tZ5J9Z4WtTop1g_ZFAW06R5";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- State ---
let currentUser = null;
let profile = { full_name: 'Guest', balance: 0 };

// --- Views Management ---
function switchView(viewName) {
    const views = {
        login: document.getElementById('login-view'),
        register: document.getElementById('register-view'),
        home: document.getElementById('home-view'),
        topup: document.getElementById('topup-view'),
        scanner: document.getElementById('scanner-view'),
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
    if (viewName === 'scanner') startScanner();
    else stopScanner();
    if (viewName === 'history') fetchHistory();
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
        alert("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ");
        switchView('login');
    }
}

async function initSession(user) {
    currentUser = user;

    const displayName = user.user_metadata.full_name || user.email;
    document.getElementById('display-username').textContent = displayName;
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?background=4F46E5&color=fff&name=${encodeURIComponent(displayName)}`;

    // Fetch user profile
    const { data: profileData } = await supabase.from('profiles').select('full_name, balance').eq('id', user.id).single();
    if (profileData) {
        profile = profileData;
    } else {
        profile = { full_name: displayName, balance: 0 };
    }

    document.getElementById('display-balance').textContent = profile.balance.toLocaleString('th-TH', { minimumFractionDigits: 2 });
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
        qr: { title: 'เติมเงินผ่านการสแกน QR', icon: 'https://media.discordapp.net/attachments/1110000000000000000/1342784535359164478/image.png' },
        truemoney: { title: 'เติมเงินผ่าน TrueMoney', icon: 'https://media.discordapp.net/attachments/1110000000000000000/1342784535803920424/image.png' },
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

// --- Scanner Logic ---
let html5QrCode = null;

async function startScanner() {
    if (html5QrCode) return;
    html5QrCode = new Html5Qrcode("reader");
    const scanResult = document.getElementById('scan-result');
    const scanText = document.getElementById('scan-text');

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
            (decodedText) => {
                scanResult.style.display = 'block';
                scanText.textContent = `Scanned: ${decodedText}`;
                if (navigator.vibrate) navigator.vibrate(100);
            },
            (errorMessage) => { }
        );
    } catch (err) {
        console.error("Scanner error:", err);
    }
}

async function stopScanner() {
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
            html5QrCode = null;
        } catch (err) {
            console.error("Stop scanner error:", err);
        }
    }
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
    const templateImg = document.getElementById('qr-template-img');

    templateImg.style.display = 'block';

    // If it's the QR channel, we show the static PromptPay image provided by the user
    if (activeChannel === 'qr') {
        templateImg.src = "https://media.discordapp.net/attachments/1110000000000000000/1342811400811806771/image.png";
        container.innerHTML = ''; // No overlay needed for this static image
        return;
    }

    // Default template for other channels if any
    templateImg.src = "https://media.discordapp.net/attachments/1110000000000000000/1342784536294375484/image.png";
    container.innerHTML = '<div style="padding:20px;">กำลังสร้าง QR Code...</div>';

    // Fallback for other channels
    const payload = `00020101021129370016A0000006770101110113006694XXXXXX5802TH53037645405${amount.toFixed(2).length}${amount.toFixed(2)}6304`;

    QRCode.toCanvas(payload, {
        width: 180,
        margin: 0,
        color: { dark: '#002d5d', light: '#ffffff00' }
    }, (err, canvas) => {
        container.innerHTML = '';
        if (err) container.innerHTML = "QR Error";
        else {
            canvas.style.width = "100%";
            canvas.style.height = "auto";
            container.appendChild(canvas);
        }
    });
}

// Slip Preview Logic
document.getElementById('slip-upload').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const preview = document.getElementById('slip-preview');
            preview.querySelector('img').src = event.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('btn-confirm-payment').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('topup-amount').value);
    const slipFile = document.getElementById('slip-upload').files[0];

    if (!slipFile) {
        alert("กรุณาแนบสลิปเพื่อยืนยันการชำระเงิน");
        return;
    }

    const btn = document.getElementById('btn-confirm-payment');
    btn.disabled = true;
    btn.textContent = "กำลังส่งข้อมูล...";

    const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    try {
        await db.ref('orders/' + orderId).set({
            orderId: orderId,
            userId: currentUser.id,
            userName: profile.full_name,
            amount: amount,
            channel: activeChannel,
            status: 'pending',
            timestamp: Date.now(),
            memo: `Top-up via ${activeChannel}`
        });

        alert(`บันทึกข้อมูลเรียบร้อย! รหัสรายการ: ${orderId}\nกรุณารอแอดมินตรวจสอบสลิปของคุณ`);
        document.getElementById('topup-modal').classList.remove('active');
        switchView('history');
    } catch (error) {
        console.error("Firebase error:", error);
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
        btn.disabled = false;
        btn.textContent = "ยืนยันการชำระเงิน";
        document.getElementById('slip-upload').value = '';
        document.getElementById('slip-preview').style.display = 'none';
    }
});

async function fetchHistory() {
    const container = document.getElementById('history-list-container');
    if (!currentUser) return;

    try {
        const snapshot = await db.ref('orders').orderByChild('userId').equalTo(currentUser.id).once('value');
        const data = snapshot.val();

        if (!data) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-sub); padding: 40px 0;">No history yet</div>';
            return;
        }

        const historyArray = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
        container.innerHTML = '';
        historyArray.forEach(item => {
            const date = new Date(item.timestamp).toLocaleDateString('th-TH', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const statusColor = item.status === 'pending' ? '#F59E0B' : (item.status === 'success' ? '#10B981' : '#EF4444');
            const statusText = item.status === 'pending' ? 'รอตรวจสอบ' : (item.status === 'success' ? 'สำเร็จ' : 'ถูกปฏิเสธ');

            const card = document.createElement('div');
            card.style = "background: white; padding: 20px; border-radius: 24px; box-shadow: var(--shadow-soft); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;";
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 48px; height: 48px; background: #FFF1F2; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary);">
                        <i class="fas ${item.channel === 'qr' ? 'fa-qrcode' : 'fa-wallet'}"></i>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-weight: 700; font-size: 15px;">${item.memo}</div>
                        <div style="font-size: 12px; color: var(--text-sub);">${date} | ID: ${item.orderId}</div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 700; color: var(--primary);">+฿${item.amount.toLocaleString()}</div>
                    <div style="font-size: 11px; font-weight: 600; color: ${statusColor};">${statusText}</div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Fetch history error:", error);
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

async function checkCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) initSession(session.user);
    else switchView('login');
}

// Initialization
document.getElementById('login-form')?.addEventListener('submit', handleLogin);
document.getElementById('register-form')?.addEventListener('submit', handleRegister);
document.getElementById('btn-google-login')?.addEventListener('click', async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
});

document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
});

checkCurrentSession();
const now = new Date();
const dateEl = document.getElementById('display-date');
if (dateEl) dateEl.innerHTML = `${now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })} <i class="fas fa-chevron-down"></i>`;
document.getElementById('btn-download-qr')?.addEventListener('click', () => {
    const templateImg = document.getElementById('qr-template-img');
    if (templateImg && templateImg.src) {
        const link = document.createElement('a');
        link.href = templateImg.src;
        link.download = `PromptPay_QR_${activeChannel}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert("ไม่พบรูปภาพ QR สำหรับดาวน์โหลด");
    }
});
