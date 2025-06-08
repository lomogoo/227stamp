/* app.js（2025-06-07-1655） */

/* 1) Supabase 初期化 */
const db = window.supabase.createClient(
  'https://hccairtzksnnqdujalgv.supabase.co',        // ★あなたのプロジェクト URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2FpcnR6a3NubnFkdWphbGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjI2MTYsImV4cCI6MjA2NDgzODYxNn0.TVDucIs5ClTWuykg_fy4yv65Rg-xbSIPFIfvIYawy_k' // ★正しい anon 公開キー
);

// app.js

db.auth.onAuthStateChange(async (event, session) => {
  // 変更前: if (event !== 'SIGNED_IN') return;
  // 変更後: sessionオブジェクトの有無でログイン状態を一元管理する
  if (session && session.user) {
    // ログイン状態の場合 (初回ログイン、リロード後の復元を含む)
    globalUID = session.user.id;
    stampCount = await fetchOrCreateUserRow(globalUID); // DBから最新情報を取得

    // UIを更新
    updateStampDisplay();
    updateRewardButtons();
    document.getElementById('login-modal')?.classList.remove('active');

    // ログインフォームが不要になるため削除
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.remove();
    }
  } else {
    // ログアウト状態の場合
    globalUID = null;
    stampCount = 0;
    // ログアウト状態に合わせてUIを更新
    updateStampDisplay();
    updateRewardButtons();
  }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const { data, error } = await db.auth.signInWithOtp({
  email: email.trim(), // 空白文字を除去
  options: { 
    emailRedirectTo: 'https://lomogoo.github.io/227stamp/',
    shouldCreateUser: true // 新規ユーザー作成を明示的に許可
  }
});

console.log('[Auth] signInWithOtp →', { data, error });
  
  const msg = document.getElementById('login-message');
  if (error) {
    msg.textContent = '❌ メール送信に失敗しました';
    console.error(error);
  } else {
    msg.textContent = '✅ メールを確認してください！';
  }
});

/* 2) グローバル変数 */
let deviceId = localStorage.getItem('deviceId') || (() => {
  const id = crypto.randomUUID();
  localStorage.setItem('deviceId', id);
  return id;
})();
let stampCount  = 0;
let html5QrCode = null;
let eventBound  = false;
let globalUID   = null;

/**
 * supabase_uid で必ず 1行読む
 * 404 → 行が無いので作成
 * 200 → 行あり
 */
async function fetchOrCreateUserRow(uid) {
  try {
    // 1) supabase_uid だけで取得（deviceId 無視）
    const { data, error } = await db
      .from('users')
      .select('stamp_count')
      .eq('supabase_uid', uid)
      .maybeSingle();                // ここがポイント

      if (!data) {
      // 2) 行が無ければ 0 で作成
      const { data: inserted, error: iErr } = await db
        .from('users')
        .insert([{ supabase_uid: uid, stamp_count: 0 }])
        .select()
        .single();
      if (iErr) throw iErr;
      return inserted.stamp_count;        // ← 0
    }
    if (error) throw error;

    return data.stamp_count;              // ← 既存値
  } catch (err) {
    console.error('[fetchOrCreateUserRow]', err);
    return 0; // フォールバック
  }
}

/* 3) アプリ固有データ */
const appData = {
  rewards: [
    { type: "coffee", stampsRequired: 3, name: "コーヒー1杯無料" },
    { type: "curry",  stampsRequired: 6, name: "カレー1杯無料" }
  ],
  qrString: "ROUTE227_STAMP_2025"
};

/* 4) DOM キャッシュ */
const navLinks              = document.querySelectorAll('.nav-link');
const sections              = document.querySelectorAll('.section');
const categoryTabs          = document.querySelectorAll('.category-tab');
const articlesContainer     = document.getElementById('articles-container');
const coffeeRewardButton    = document.getElementById('coffee-reward');
const curryRewardButton     = document.getElementById('curry-reward');
const notificationTitle     = document.getElementById('notification-title');
const notificationMessage   = document.getElementById('notification-message');
const notificationModal     = document.getElementById('notification-modal');
const scanQrButton          = document.getElementById('scan-qr');
const stamps                = document.querySelectorAll('.stamp');

/* ---------- 共通ユーティリティ ---------- */

// Supabase UPDATE
async function updateStampCount(newCount) {
  const { data: { session } } = await db.auth.getSession();
  const uid = session?.user?.id || null;          // すでに取得済み

  const { error } = await db
    .from('users')
    .update({ stamp_count: newCount, updated_at: new Date().toISOString() })
    .eq('supabase_uid', globalUID);
  if (error) console.error('スタンプ更新エラー:', error);
}

async function syncStampFromDB(uid) {
  if (!uid) return;                // 未ログインなら何もしない

  const { data, error, status } = await db
    .from('users')
    .select('stamp_count')
    .eq('supabase_uid', uid)       // ★ UID だけ
    .maybeSingle();

  let remote = 0;

  /* ▼▼ ここを修正 ▼▼ */
  if (!data) {
  const row = { supabase_uid: uid, stamp_count: stampCount };
  const { error: insertError } = await db.from('users').insert([row]);
  if (insertError) {
    console.error('INSERT error', insertError);
  }
  remote = stampCount;
  } else {
    remote = data?.stamp_count ?? 0;
  }
  /* ▲▲ 修正ここまで ▲▲ */

  // 差分マージ
  if (remote > stampCount) {
    stampCount = remote;
    localStorage.setItem('route227_stamps', stampCount);
  } else if (remote < stampCount) {
    await updateStampCount(stampCount);
  }
}

// スタンプ表示
function updateStampDisplay() {
  stamps.forEach((el, i) =>
    i < stampCount ? el.classList.add('active') : el.classList.remove('active'));
}

function saveLocalStamp() { 
  if (!globalUID) return; localStorage.setItem('route227_stamps', stampCount);
}


// 報酬ボタン
function updateRewardButtons() {
  coffeeRewardButton.disabled = stampCount < 3;
  curryRewardButton.disabled  = stampCount < 6;
}

// 通知モーダル
function showNotification(title, msg) {
  notificationTitle.textContent   = title;
  notificationMessage.textContent = msg;
  notificationModal.classList.add('active');
}

// スタンプ＋1
async function addStamp() {
  if (!globalUID) {
  showNotification('要ログイン', '先にログインしてください');
  return;
}
  if (stampCount >= 6) return;
  stampCount++;
  saveLocalStamp();
  await updateStampCount(stampCount);

  updateStampDisplay();
  updateRewardButtons();

  if (stampCount === 3) showNotification('🎉', 'コーヒー1杯無料ゲット！');
  else if (stampCount === 6) showNotification('🎉', 'カレー1杯無料ゲット！');
  else showNotification('スタンプ獲得', `現在 ${stampCount} 個`);
}

// 報酬交換
async function redeemReward(type) {
  if (type === 'coffee' && stampCount >= 3) stampCount -= 3;
  if (type === 'curry'  && stampCount >= 6) stampCount -= 6;

  localStorage.setItem('route227_stamps', stampCount);
  await updateStampCount(stampCount);
  updateStampDisplay();
  updateRewardButtons();
  showNotification('交換完了', type === 'coffee' ? 'コーヒー交換！' : 'カレー交換！');
}

/* ---------- フィード記事 ---------- */
async function renderArticles(category) {
  const list = [
    { url:'https://machico.mu/special/detail/2691',category:'イベント',title:'Machico 2691',summary:'イベント記事' },
    { url:'https://machico.mu/special/detail/2704',category:'イベント',title:'Machico 2704',summary:'イベント記事' },
    { url:'https://machico.mu/jump/ad/102236',      category:'ニュース', title:'Machico 102236',summary:'ニュース記事' },
    { url:'https://machico.mu/special/detail/2926', category:'ニュース', title:'Machico 2926',summary:'ニュース記事' }
  ];

  const targets = list.filter(a => category === 'all' || a.category === category);
  articlesContainer.innerHTML = '<div class="loading-spinner"></div>';

  const cards = await Promise.all(targets.map(async a => {
    try {
      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(a.url)}`);
      const d   = await res.json();
      const doc = new DOMParser().parseFromString(d.contents, 'text/html');
      return { ...a, img: doc.querySelector("meta[property='og:image']")?.content || 'assets/placeholder.jpg' };
    } catch {
      return { ...a, img: 'assets/placeholder.jpg' };
    }
  }));

  articlesContainer.innerHTML = '';
  cards.forEach(a => {
    const div = document.createElement('div');
    div.className = 'card article-card';
    div.innerHTML = `
      <a href="${a.url}" target="_blank" rel="noopener noreferrer">
        <img src="${a.img}" alt="${a.title}のサムネイル">
        <div class="card__body" aria-label="記事: ${a.title}">
          <span class="article-category">${a.category}</span>
          <h3 class="article-title">${a.title}</h3>
          <p class="article-excerpt">${a.summary}</p>
        </div>
      </a>`;
    articlesContainer.appendChild(div);
  });
}

/* ---------- QR スキャナ ---------- */
function initQRScanner() {
  const qrReader = document.getElementById('qr-reader');
  qrReader.innerHTML = '';
  html5QrCode = new Html5Qrcode('qr-reader');

  html5QrCode.start(
    { facingMode:'environment' },
    { fps:10, qrbox:{ width:250, height:250 } },
    async text => {
      await html5QrCode.stop(); html5QrCode.clear();
      if (text === appData.qrString) addStamp();
      else showNotification('無効なQR', '読み取れませんでした');
      closeModal(document.getElementById('qr-modal'));
    },
    () => {}
  ).catch(()=>{qrReader.innerHTML='<div class="status status--error">カメラエラー</div>';});
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  if (html5QrCode) html5QrCode.stop().catch(()=>{}).then(()=>html5QrCode.clear());
}
function closeModal(m){ m.classList.remove('active'); }

/* ---------- イベントバインド ---------- */
function setupEventListeners() {
  if (eventBound) return;
  eventBound = true;

  /* nav */
  navLinks.forEach(link => {
    link.addEventListener('click', async () => {
      navLinks.forEach(n => n.classList.remove('active'));
      link.classList.add('active');
      sections.forEach(s => s.classList.remove('active'));
      const target = document.getElementById(link.dataset.section);
      target.classList.add('active');

      if (link.dataset.section === 'foodtruck-section') {
        if (!globalUID) {
          document.getElementById('login-modal')?.classList.add('active');
          return;
        }
    // ---- ① スピナー出す
        const s = document.getElementById('stamp-spinner');
        s?.classList.remove('hidden');

        try {
          await syncStampFromDB(globalUID);   // ★←必ず DB 最新を取得
        } finally {
          s?.classList.add('hidden');        // ---- ④ スピナー隠す
        }
        updateStampDisplay();
        updateRewardButtons();
      }
    
    }, { passive:true });
  });

  

  /* カテゴリタブ */
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderArticles(tab.dataset.category);
    }, { passive:true });
  });

  /* QR */
  scanQrButton.addEventListener('click', () => {
    document.getElementById('qr-modal').classList.add('active');
    initQRScanner();
  });

  /* 閉じる系 */
  document.querySelectorAll('.close-modal').forEach(btn =>
    btn.addEventListener('click', closeAllModals, { passive:true })
  );
  document.querySelector('.close-notification')
    .addEventListener('click', () => closeModal(notificationModal), { passive:true });

  /* 報酬 */
  coffeeRewardButton.addEventListener('click', () => redeemReward('coffee'));
  curryRewardButton .addEventListener('click', () => redeemReward('curry'));
}

function loadStampCount() {
  if (!globalUID) {            // ログイン必須
    stampCount = 0;
    return;
  }
  const saved = localStorage.getItem('route227_stamps');
  stampCount = saved ? parseInt(saved, 10) : 0;
}

async function initApp() {
  // 1) セッション取得
  const { data: { session } } = await db.auth.getSession();
  globalUID = session?.user?.id || null;

  if (globalUID) {
    // ログイン済みならモーダルを閉じる
    document.getElementById('login-modal')?.classList.remove('active');

    // 2) 【DB優先】スタンプ数を取得
    //    fetchOrCreateUserRow が「DBからスタンプ数を返す」ユーティリティ関数
    stampCount = await fetchOrCreateUserRow(globalUID);

    // 3) 念のためローカルにもキャッシュ
    localStorage.setItem('route227_stamps', stampCount.toString());
  } else {
    stampCount = 0;
  }

  // 4) UI更新
  updateStampDisplay();
  updateRewardButtons();

  // 5) 既存のレンダリング／イベントバインド
  renderArticles('all');
  setupEventListeners();
}

/* ---------- 起動 ---------- */
document.addEventListener('DOMContentLoaded', initApp);
