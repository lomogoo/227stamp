// Route227Cafe Application with Supabase integration

// ① HTML に次のタグを入れておく（head 内）
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>

// ② SDK 初期化（db オブジェクトを作成）
const db = window.supabase.createClient(
  'https://hccairtzksnnqdujalgv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2FpcnR6a3NubnFkdWphbGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjI2MTYsImV4cCI6MjA2NDgzODYxNn0.TVDucIs5ClTWuykg_fy4yv65Rg-xbSIPFIfvIYawy_k'
);

// ③ Supabase を使ったユーザー取得＆作成
async function getOrCreateUser(deviceId) {
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  // 「データが存在しない」＝エラーでかつ status code に関係なく null なら insert
  if (error && data === null) {
    const { data: newUser, error: insertError } = await db
      .from('users')
      .insert([{ device_id: deviceId, stamp_count: 0 }])
      .select()
      .single();

    if (insertError) {
      console.error('INSERTエラー:', insertError);
      return null;
    }

    return newUser;
  }

  if (error) {
    console.error('SELECTエラー:', error);
    return null;
  }

  return data;
}

// ✅ Supabaseから読み込んだstampCountだけを使う
async function syncStampFromDB() {
  let deviceId = localStorage.getItem('deviceId');

  // ← 初回起動時に deviceId を発行して保存
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }

  const user = await getOrCreateUser(deviceId);
  if (user) {
    stampCount = user.stamp_count || 0;
    updateStampDisplay();
    updateRewardButtons();
  }
}

async function updateStampCount(deviceId, newCount) {
  const { error } = await db
    .from('users')
    .update({ stamp_count: newCount, updated_at: new Date().toISOString() })
    .eq('device_id', deviceId);
  if (error) console.error('スタンプ更新エラー:', error);
}

// ④ ページ遷移時にユーザーを読み込む
document.getElementById('foodtruck-section').addEventListener('click', async () => {
  const deviceId = localStorage.getItem('deviceId') || crypto.randomUUID();
  localStorage.setItem('deviceId', deviceId);
  const userData = await getOrCreateUser(deviceId);
  stampCount = userData?.stamp_count || 0;
  updateStampDisplay();
  updateRewardButtons();
});

// ⑤ 以降は既存のスタンプカード・QR・フィード処理

const appData = {
  rewards: [
    { type: "coffee", stampsRequired: 3, name: "コーヒー1杯無料" },
    { type: "curry", stampsRequired: 6, name: "カレー1杯無料" }
  ],
  qrString: "ROUTE227_STAMP_2025"
};

const navLinks              = document.querySelectorAll('.nav-link');
const sections              = document.querySelectorAll('.section');
const categoryTabs          = document.querySelectorAll('.category-tab');
const articlesContainer     = document.getElementById('articles-container');
const scanQrButton          = document.getElementById('scan-qr');
const qrModal               = document.getElementById('qr-modal');
const notificationModal     = document.getElementById('notification-modal');
const closeModalButtons     = document.querySelectorAll('.close-modal');
const closeNotificationButton = document.querySelector('.close-notification');
const coffeeRewardButton    = document.getElementById('coffee-reward');
const curryRewardButton     = document.getElementById('curry-reward');
const stamps                = document.querySelectorAll('.stamp');
const notificationTitle     = document.getElementById('notification-title');
const notificationMessage   = document.getElementById('notification-message');

let stampCount = 0;

async function initApp() {
  await syncStampFromDB(); // ← これ追加（必ず一番上で）
  renderArticles('all');
  updateStampDisplay();
  updateRewardButtons();
  setupEventListeners();
}

function loadStampCount() {
  const saved = localStorage.getItem('route227_stamps');
  if (saved !== null) stampCount = parseInt(saved, 10);
}

async function saveStampCount() {
  localStorage.setItem('route227_stamps', stampCount.toString());
  const deviceId = localStorage.getItem('deviceId');
  if (deviceId) await updateStampCount(deviceId, stampCount);
}

function updateStampDisplay() {
  stamps.forEach((el, i) => i < stampCount ? el.classList.add('active') : el.classList.remove('active'));
}

function updateRewardButtons() {
  coffeeRewardButton.disabled = stampCount < 3;
  curryRewardButton.disabled  = stampCount < 6;
}

async function addStamp() {
  if (stampCount < 6) {
    stampCount++;
    await saveStampCount();
    const el = document.querySelector(`.stamp[data-stamp-id="${stampCount}"]`);
    el.classList.add('stamp-added');
    setTimeout(() => el.classList.remove('stamp-added'), 500);
    updateStampDisplay();
    updateRewardButtons();
    if (stampCount === 3) showNotification('🎉', 'コーヒー1杯無料ゲット！');
    else if (stampCount === 6) showNotification('🎉', 'カレー1杯無料ゲット！');
    else showNotification('スタンプ獲得', `現在 ${stampCount} 個`);
  }
}

function redeemReward(type) {
  if (type === 'coffee' && stampCount >= 3) { stampCount -= 3; showNotification('交換完了','コーヒー交換！'); }
  if (type === 'curry'  && stampCount >= 6) { stampCount -= 6; showNotification('交換完了','カレー交換！'); }
  saveStampCount();
  updateStampDisplay();
  updateRewardButtons();
}

function showNotification(title, msg) {
  notificationTitle.textContent   = title;
  notificationMessage.textContent = msg;
  notificationModal.classList.add('active');
}

function initQRScanner() {
  const qrReader = document.getElementById('qr-reader');
  const qrResult = document.getElementById('qr-result');
  qrReader.innerHTML = ''; qrResult.innerHTML = '';
  const html5QrCode = new Html5Qrcode('qr-reader');
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onScanSuccess, onScanFailure
  ).catch(e => qrResult.innerHTML = '<div class="status status--error">カメラエラー</div>');
  function onScanSuccess(text) {
    html5QrCode.stop().then(() => {
      if (text === appData.qrString) {
        qrResult.innerHTML = '<div class="status status--success">スタンプ獲得！</div>';
        setTimeout(() => { qrModal.classList.remove('active'); addStamp(); }, 800);
      } else {
        qrResult.innerHTML = '<div class="status status--error">無効なQR</div>';
      }
    });
  }
  function onScanFailure() {}
}

async function renderArticles(category) {
  const list = [
    { url:'https://machico.mu/special/detail/2691',category:'イベント',title:'…',summary:'…' },
    { url:'https://machico.mu/special/detail/2704',category:'イベント',title:'…',summary:'…' },
    { url:'https://machico.mu/jump/ad/102236',category:'ニュース',title:'…',summary:'…' },
    { url:'https://machico.mu/special/detail/2926',category:'ニュース',title:'…',summary:'…' }
  ];

  articlesContainer.innerHTML = '<div class="loading-spinner"></div>';
  const targets = list.filter(a=>category==='all'||a.category===category);
  try {
    const res = await Promise.all(targets.map(a=>
      fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(a.url)}`)
        .then(r=>r.json()).then(d=>({a,d}))
    ));
    articlesContainer.innerHTML = '';
    res.forEach(({a,d})=>{
      const img = new DOMParser().parseFromString(d.contents,'text/html')
                  .querySelector("meta[property='og:image']")?.content||'';
      const card = document.createElement('div');
      card.className = 'card article-card';
      card.innerHTML = `
        <a href="${a.url}" target="_blank">
          <img src="${img}" alt="${a.title}"/>
          <div class="card__body">
            <span class="article-category">${a.category}</span>
            <h3 class="article-title">${a.title}</h3>
            <p class="article-excerpt">${a.summary}</p>
          </div>
        </a>`;
      articlesContainer.appendChild(card);
    });
  } catch(e) {
    articlesContainer.innerHTML = '<p>読み込み失敗</p>';
  }
}

function closeModal(m) { m.classList.remove('active'); }

function setupEventListeners() {
  navLinks.forEach(link=>link.addEventListener('click',()=>{
    navLinks.forEach(n=>n.classList.remove('active'));
    link.classList.add('active');
    sections.forEach(s=>s.classList.remove('active'));
    document.getElementById(link.dataset.section).classList.add('active');
  }));

  categoryTabs.forEach(tab=>tab.addEventListener('click',()=>{
    categoryTabs.forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    renderArticles(tab.dataset.category);
  }));

  scanQrButton.addEventListener('click',()=>{ qrModal.classList.add('active'); initQRScanner(); });

  document.querySelector('.footer-nav .nav-item:first-child .nav-link')
    .addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

  closeModalButtons.forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.closest('.modal'))));
  // app.js の setupEventListeners 関数内
closeNotificationButton.addEventListener('click', (event) => {
  event.stopPropagation(); // これを追加！イベントが親要素へ伝わるのを防ぎます
  closeModal(notificationModal);
});

  coffeeRewardButton.addEventListener('click',()=>redeemReward('coffee'));
  curryRewardButton.addEventListener('click',()=>redeemReward('curry'));
}

document.addEventListener('DOMContentLoaded', () => {
  (async () => {
    await initApp();
  })();
});
