# 修正版 app.js

以下は、ログイン後のリロード時にフィード記事が表示されなくなる問題を修正したJavaScriptコードです：

```javascript
/* 修正版 app.js */

/* 1) Supabase 初期化 */
const db = window.supabase.createClient(
  'https://hccairtzksnnqdujalgv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2FpcnR6a3NubnFkdWphbGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjI2MTYsImV4cCI6MjA2NDgzODYxNn0.TVDucIs5ClTWuykg_fy4yv65Rg-xbSIPFIfvIYawy_k'
);

/* 2) グローバル変数 */
let deviceId = localStorage.getItem('deviceId') || (() => {
  const id = crypto.randomUUID();
  localStorage.setItem('deviceId', id);
  return id;
})();
let stampCount = 0;
let html5QrCode = null;
let eventBound = false;
let globalUID = null;

/* 3) DOM要素を動的に取得する関数 */
function getElements() {
  return {
    navLinks: document.querySelectorAll('.nav-link'),
    sections: document.querySelectorAll('.section'),
    categoryTabs: document.querySelectorAll('.category-tab'),
    articlesContainer: document.getElementById('articles-container'),
    coffeeRewardButton: document.getElementById('coffee-reward'),
    curryRewardButton: document.getElementById('curry-reward'),
    notificationTitle: document.getElementById('notification-title'),
    notificationMessage: document.getElementById('notification-message'),
    notificationModal: document.getElementById('notification-modal'),
    scanQrButton: document.getElementById('scan-qr'),
    stamps: document.querySelectorAll('.stamp')
  };
}

/* 4) 認証状態変更のハンドラー - ★修正箇所★ */
db.auth.onAuthStateChange(async (event, session) => {
  if (session && session.user) {
    // ログイン状態の場合
    globalUID = session.user.id;
    stampCount = await fetchOrCreateUserRow(globalUID);

    // UIを更新
    updateStampDisplay();
    updateRewardButtons();
    document.getElementById('login-modal')?.classList.remove('active');

    // ★重要な修正：フィード記事を再表示★
    await renderArticles('all');
    
    // ★重要な修正：カテゴリタブのアクティブ状態を復元★
    const elements = getElements();
    elements.categoryTabs.forEach(tab => {
      if (tab.dataset.category === 'all') {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // ログインフォームを削除
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.remove();
    }
  } else {
    // ログアウト状態の場合
    globalUID = null;
    stampCount = 0;
    updateStampDisplay();
    updateRewardButtons();
    
    // ★修正：ログアウト時もフィード記事を表示★
    await renderArticles('all');
  }
});

/* 5) ログインフォームのイベントハンドラー - ★修正箇所★ */
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const { data, error } = await db.auth.signInWithOtp({
        email: email.trim(),
        options: { 
          emailRedirectTo: 'https://lomogoo.github.io/227stamp/',
          shouldCreateUser: true
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
  }
});

/* 6) ユーザー行の取得/作成 */
async function fetchOrCreateUserRow(uid) {
  try {
    const { data, error } = await db
      .from('users')
      .select('stamp_count')
      .eq('supabase_uid', uid)
      .maybeSingle();

    if (!data) {
      const { data: inserted, error: iErr } = await db
        .from('users')
        .insert([{ supabase_uid: uid, stamp_count: 0 }])
        .select()
        .single();
      if (iErr) throw iErr;
      return inserted.stamp_count;
    }
    if (error) throw error;

    return data.stamp_count;
  } catch (err) {
    console.error('[fetchOrCreateUserRow]', err);
    return 0;
  }
}

/* 7) アプリデータ */
const appData = {
  rewards: [
    { type: "coffee", stampsRequired: 3, name: "コーヒー1杯無料" },
    { type: "curry",  stampsRequired: 6, name: "カレー1杯無料" }
  ],
  qrString: "ROUTE227_STAMP_2025"
};

/* 8) 共通ユーティリティ関数 */
async function updateStampCount(newCount) {
  const { data: { session } } = await db.auth.getSession();
  const uid = session?.user?.id || null;

  const { error } = await db
    .from('users')
    .update({ stamp_count: newCount, updated_at: new Date().toISOString() })
    .eq('supabase_uid', globalUID);
  if (error) console.error('スタンプ更新エラー:', error);
}

async function syncStampFromDB(uid) {
  if (!uid) return;

  const { data, error } = await db
    .from('users')
    .select('stamp_count')
    .eq('supabase_uid', uid)
    .maybeSingle();

  let remote = 0;

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

  if (remote > stampCount) {
    stampCount = remote;
    localStorage.setItem('route227_stamps', stampCount);
  } else if (remote < stampCount) {
    await updateStampCount(stampCount);
  }
}

function updateStampDisplay() {
  const elements = getElements();
  elements.stamps.forEach((el, i) =>
    i < stampCount ? el.classList.add('active') : el.classList.remove('active'));
}

function saveLocalStamp() { 
  if (!globalUID) return; 
  localStorage.setItem('route227_stamps', stampCount);
}

function updateRewardButtons() {
  const elements = getElements();
  if (elements.coffeeRewardButton) elements.coffeeRewardButton.disabled = stampCount < 3;
  if (elements.curryRewardButton) elements.curryRewardButton.disabled = stampCount < 6;
}

function showNotification(title, msg) {
  const elements = getElements();
  if (elements.notificationTitle) elements.notificationTitle.textContent = title;
  if (elements.notificationMessage) elements.notificationMessage.textContent = msg;
  if (elements.notificationModal) elements.notificationModal.classList.add('active');
}

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

async function redeemReward(type) {
  if (type === 'coffee' && stampCount >= 3) stampCount -= 3;
  if (type === 'curry'  && stampCount >= 6) stampCount -= 6;

  localStorage.setItem('route227_stamps', stampCount);
  await updateStampCount(stampCount);
  updateStampDisplay();
  updateRewardButtons();
  showNotification('交換完了', type === 'coffee' ? 'コーヒー交換！' : 'カレー交換！');
}

/* 9) フィード記事表示 - ★修正箇所★ */
async function renderArticles(category) {
  const elements = getElements();
  const articlesContainer = elements.articlesContainer;
  
  if (!articlesContainer) {
    console.error('articlesContainer が見つかりません');
    return;
  }

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
      const d = await res.json();
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

/* 10) QRスキャナー */
function initQRScanner() {
  const qrReader = document.getElementById('qr-reader');
  qrReader.innerHTML = '';
  html5QrCode = new Html5Qrcode('qr-reader');

  html5QrCode.start(
    { facingMode:'environment' },
    { fps:10, qrbox:{ width:250, height:250 } },
    async text => {
      await html5QrCode.stop(); 
      html5QrCode.clear();
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

function closeModal(m){ 
  if (m) m.classList.remove('active'); 
}

/* 11) イベントリスナー設定 - ★修正箇所★ */
function setupEventListeners() {
  if (eventBound) return;
  eventBound = true;

  const elements = getElements();

  // ナビゲーションリンク
  elements.navLinks.forEach(link => {
    link.addEventListener('click', async () => {
      elements.navLinks.forEach(n => n.classList.remove('active'));
      link.classList.add('active');
      elements.sections.forEach(s => s.classList.remove('active'));
      const target = document.getElementById(link.dataset.section);
      if (target) target.classList.add('active');

      if (link.dataset.section === 'foodtruck-section') {
        if (!globalUID) {
          document.getElementById('login-modal')?.classList.add('active');
          return;
        }
        const spinner = document.getElementById('stamp-spinner');
        if (spinner) spinner.classList.remove('hidden');

        try {
          await syncStampFromDB(globalUID);
        } finally {
          if (spinner) spinner.classList.add('hidden');
        }
        updateStampDisplay();
        updateRewardButtons();
      }
    }, { passive:true });
  });

  // カテゴリタブ
  elements.categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderArticles(tab.dataset.category);
    }, { passive:true });
  });

  // QRスキャンボタン
  if (elements.scanQrButton) {
    elements.scanQrButton.addEventListener('click', () => {
      document.getElementById('qr-modal')?.classList.add('active');
      initQRScanner();
    });
  }

  // モーダル閉じるボタン
  document.querySelectorAll('.close-modal').forEach(btn =>
    btn.addEventListener('click', closeAllModals, { passive:true })
  );
  
  const closeNotificationBtn = document.querySelector('.close-notification');
  if (closeNotificationBtn) {
    closeNotificationBtn.addEventListener('click', () => closeModal(elements.notificationModal), { passive:true });
  }

  // 報酬ボタン
  if (elements.coffeeRewardButton) {
    elements.coffeeRewardButton.addEventListener('click', () => redeemReward('coffee'));
  }
  if (elements.curryRewardButton) {
    elements.curryRewardButton.addEventListener('click', () => redeemReward('curry'));
  }
}

/* 12) アプリ初期化 - ★修正箇所★ */
async function initApp() {
  // セッション取得
  const { data: { session } } = await db.auth.getSession();
  globalUID = session?.user?.id || null;

  if (globalUID) {
    // ログイン済みの場合
    document.getElementById('login-modal')?.classList.remove('active');
    stampCount = await fetchOrCreateUserRow(globalUID);
    localStorage.setItem('route227_stamps', stampCount.toString());
  } else {
    stampCount = 0;
  }

  // UI更新
  updateStampDisplay();
  updateRewardButtons();

  // ★重要：フィード記事を表示★
  await renderArticles('all');
  
  // イベントリスナー設定
  setupEventListeners();
}

/* 13) アプリ起動 */
document.addEventListener('DOMContentLoaded', initApp);
```

## 主な修正点

1. **onAuthStateChange内でフィード記事を再表示**
   - ログイン状態変更時に `renderArticles('all')` を呼び出し
   - カテゴリタブのアクティブ状態も復元

2. **DOM要素の動的取得**
   - `getElements()` 関数で必要な時に要素を取得
   - null チェックを追加してエラーを防止

3. **ログインフォームのイベントリスナー修正**
   - DOMContentLoaded内で安全にイベントリスナーを設定

4. **initApp内でフィード記事を確実に表示**
   - アプリ初期化時に必ず `renderArticles('all')` を実行

これらの修正により、ログイン後のリロード時にもフィード記事とボタンが正常に動作するようになります。