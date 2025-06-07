/* app.js（2025-06-07-1655） */

/* 1) Supabase 初期化 */
const db = window.supabase.createClient(
  'https://hccairtzksnnqdujalgv.supabase.co',        // ★あなたのプロジェクト URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2FpcnR6a3NubnFkdWphbGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjI2MTYsImV4cCI6MjA2NDgzODYxNn0.TVDucIs5ClTWuykg_fy4yv65Rg-xbSIPFIfvIYawy_k' // ★正しい anon 公開キー
);

// 認証状態変更リスナーを独立して設定
db.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth state changed:', event, !!session);
  
  if (event === 'SIGNED_IN' && session) {
    globalUID = session.user.id;
    stampCount = await fetchOrCreateUserRow(globalUID);
    updateStampDisplay();
    updateRewardButtons();
    document.getElementById('login-modal')?.classList.remove('active');
  } else if (event === 'SIGNED_OUT') {
    globalUID = null;
    stampCount = 0;
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
    const { data, error, status } = await db
      .from('users')
      .select('stamp_count')
      .eq('supabase_uid', uid)
      .single();                // ここがポイント

    if (status === 404) {
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
    .single();

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
  try {
    const list = [
      { url:'https://machico.mu/special/detail/2691',category:'イベント',title:'Machico 2691',summary:'イベント記事' },
      { url:'https://machico.mu/special/detail/2704',category:'イベント',title:'Machico 2704',summary:'イベント記事' },
      { url:'https://machico.mu/jump/ad/102236',      category:'ニュース', title:'Machico 102236',summary:'ニュース記事' },
      { url:'https://machico.mu/special/detail/2926', category:'ニュース', title:'Machico 2926',summary:'ニュース記事' }
    ];

    const targets = list.filter(a => category === 'all' || a.category === category);
    
    // コンテナが存在することを確認
    const container = document.getElementById('articles-container');
    if (!container) {
      console.error('Articles container not found');
      return;
    }
    
    container.innerHTML = '<div class="loading-spinner"></div>';

    // 記事カードを生成
    const cards = await Promise.all(targets.map(async a => {
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(a.url)}`);
        const d = await res.json();
        const doc = new DOMParser().parseFromString(d.contents, 'text/html');
        return { ...a, img: doc.querySelector("meta[property='og:image']")?.content || 'assets/placeholder.jpg' };
      } catch {
        return { ...a, img: 'assets/placeholder.jpg' };
      }
    }));

    container.innerHTML = '';
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
      container.appendChild(div);
    });
  } catch (error) {
    console.error('Render articles error:', error);
    const container = document.getElementById('articles-container');
    if (container) {
      container.innerHTML = '<div class="status status--error">記事の読み込みに失敗しました</div>';
    }
  }
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
  const navLinksElements = document.querySelectorAll('.nav-link');
  const sectionsElements = document.querySelectorAll('.section');
  const categoryTabsElements = document.querySelectorAll('.category-tab');
  
  if (!navLinksElements.length || !sectionsElements.length) {
    console.error('Required DOM elements not found');
    return;
  }
  
  eventBound = true;

  // nav リスナー
  navLinksElements.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // アクティブ状態を更新
      navLinks.forEach(n => n.classList.remove('active'));
      link.classList.add('active');
      sections.forEach(s => s.classList.remove('active'));
      
      const targetId = link.dataset.section;
      const target = document.getElementById(targetId);
      
      if (target) {
        target.classList.add('active');
        
        // フードトラックセクションの場合の特別処理
        if (targetId === 'foodtruck-section') {
          if (!globalUID) {
            const loginModal = document.getElementById('login-modal');
            if (loginModal) loginModal.classList.add('active');
            return;
          }
          
          try {
            await syncStampFromDB(globalUID);
            updateStampDisplay();
            updateRewardButtons();
          } catch (error) {
            console.error('Sync error:', error);
          }
        }
      }
    }, { passive: false }); // passive: false でpreventDefaultを有効に
  });

  categoryTabsElements.forEach(tab => {
    tab.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // アクティブ状態更新
      categoryTabsElements.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const category = tab.dataset.category;
      await renderArticles(category);
    });
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
  console.log('Initializing app...');
  
  try {
    // Supabaseの初期化確認
    if (!db || !db.auth) {
      throw new Error('Supabase not properly initialized');
    }
    
    // 認証状態の取得（タイムアウト付き）
    const sessionPromise = db.auth.getSession();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Session timeout')), 5000)
    );
    
    const { data: { session }, error } = await Promise.race([
      sessionPromise, 
      timeoutPromise
    ]);
    
    if (error && error.message !== 'Session timeout') {
      console.error('Session error:', error);
    }
    
    globalUID = session?.user?.id || null;
    console.log('Session loaded:', { globalUID, session: !!session });

    // 基本機能の初期化（エラーがあっても実行）
    setupEventListeners();
    await renderArticles('all');
    
    // 認証関連の初期化
    if (globalUID) {
      stampCount = await fetchOrCreateUserRow(globalUID);
      updateStampDisplay();
      updateRewardButtons();
      
      const loginModal = document.getElementById('login-modal');
      if (loginModal) {
        loginModal.classList.remove('active');
      }
    } else {
      stampCount = 0;
      updateStampDisplay();
      updateRewardButtons();
    }
    
    console.log('App initialized successfully');
    
  } catch (error) {
    console.error('Init error:', error);
    
    // エラー時のフォールバック処理
    try {
      setupEventListeners();
      await renderArticles('all');
      console.log('Fallback initialization completed');
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError);
    }
  }
}


/* ---------- 起動 ---------- */
// 現在の initApp() の呼び出しを削除し、以下に置き換え
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM Content Loaded');
  
  // 少し待ってから初期化（CSSとSupabaseの読み込み完了を待つ）
  setTimeout(async () => {
    try {
      await initApp();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      // フォールバック処理
      setupEventListeners();
      renderArticles('all');
    }
  }, 100);
});

// Supabaseが確実に読み込まれているかチェック
if (typeof supabase === 'undefined') {
  console.error('Supabase not loaded');
}
