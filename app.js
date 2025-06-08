/* 1) Supabase 初期化 */
const db = window.supabase.createClient(
  'https://hccairtzksnnqdujalgv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2FpcnR6a3NubnFkdWphbGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjI2MTYsImV4cCI6MjA2NDgzODYxNn0.TVDucIs5ClTWuykg_fy4yv65Rg-xbSIPFIfvIYawy_k'
);

/* 2) グローバル変数 */
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
    stamps: document.querySelectorAll('.stamp'),
    loginModal: document.getElementById('login-modal'),
    loginForm: document.getElementById('login-form'),
    stampSpinner: document.getElementById('stamp-spinner'),
  };
}

/* ==================================================================== */
/* アプリケーションのメイン処理 (ここから)                               */
/* ==================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /**
   * STEP 1: イベントリスナーを最初に一度だけ設定する
   * これにより、ボタンが機能しなくなる問題を完全に防ぎます。
   */
  setupEventListeners();

  /**
   * STEP 2: ログインフォームの送信処理を設定する
   */
  const { loginForm } = getElements();
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

      const msg = document.getElementById('login-message');
      if (error) {
        msg.textContent = '❌ メール送信に失敗しました';
        console.error(error);
      } else {
        msg.textContent = '✅ メールを確認してください！';
      }
    });
  }

  /**
   * STEP 3: 認証状態の変更を監視し、UIを更新する
   * ページ読み込み時、ログイン時、ログアウト時に実行され、
   * 常に正しい状態を画面に描画します。
   */
  db.auth.onAuthStateChange(async (event, session) => {
    const { articlesContainer, loginModal } = getElements();

    // 処理中にローディング表示
    if (articlesContainer) {
      articlesContainer.innerHTML = '<div class="loading-spinner"></div>';
    }

    if (session && session.user) {
      // --- ログイン状態の処理 ---
      globalUID = session.user.id;
      stampCount = await fetchOrCreateUserRow(globalUID);
      localStorage.setItem('route227_stamps', stampCount.toString());
      loginModal?.classList.remove('active');
    } else {
      // --- ログアウト状態の処理 ---
      globalUID = null;
      stampCount = 0;
      localStorage.removeItem('route227_stamps');
    }

    // 状態に基づいてUI全体を更新
    updateStampDisplay();
    updateRewardButtons();
    
    // 記事フィードを描画
    await renderArticles('all');
    
    // カテゴリタブをリセット
    getElements().categoryTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.category === 'all');
    });
  });
});


/* ==================================================================== */
/* ヘルパー関数群 (ここから)                                           */
/* ==================================================================== */

/* ユーザー行の取得/作成 */
async function fetchOrCreateUserRow(uid) {
  try {
    const { data, error } = await db
      .from('users')
      .select('stamp_count')
      .eq('supabase_uid', uid)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // 'PGRST116' (range not satisfiable) は無視してOK
        throw error;
    }
      
    if (!data) {
      const { data: inserted, error: iErr } = await db
        .from('users')
        .insert([{ supabase_uid: uid, stamp_count: 0 }])
        .select()
        .single();
      if (iErr) throw iErr;
      return inserted.stamp_count;
    }
    
    return data.stamp_count;
  } catch (err) {
    console.error('[fetchOrCreateUserRow]', err);
    showNotification('エラー', 'ユーザー情報の取得に失敗しました。');
    return 0;
  }
}

/* アプリデータ */
const appData = {
  rewards: [
    { type: "coffee", stampsRequired: 3, name: "コーヒー1杯無料" },
    { type: "curry",  stampsRequired: 6, name: "カレー1杯無料" }
  ],
  qrString: "ROUTE227_STAMP_2025"
};

/* 共通ユーティリティ関数 */
async function updateStampCount(newCount) {
  if (!globalUID) return;

  const { error } = await db
    .from('users')
    .update({ stamp_count: newCount, updated_at: new Date().toISOString() })
    .eq('supabase_uid', globalUID);
  if (error) console.error('スタンプ更新エラー:', error);
}

async function syncStampFromDB(uid) {
  if (!uid) return;

  const { stampSpinner } = getElements();
  if(stampSpinner) stampSpinner.classList.remove('hidden');

  try {
    const remoteCount = await fetchOrCreateUserRow(uid);
    if (remoteCount > stampCount) {
        stampCount = remoteCount;
    } else if (remoteCount < stampCount) {
        await updateStampCount(stampCount);
    }
    localStorage.setItem('route227_stamps', stampCount.toString());
    updateStampDisplay();
    updateRewardButtons();
  } finally {
    if(stampSpinner) stampSpinner.classList.add('hidden');
  }
}

function updateStampDisplay() {
  getElements().stamps.forEach((el, i) =>
    el.classList.toggle('active', i < stampCount));
}

function updateRewardButtons() {
  const { coffeeRewardButton, curryRewardButton } = getElements();
  if (coffeeRewardButton) coffeeRewardButton.disabled = stampCount < 3;
  if (curryRewardButton) curryRewardButton.disabled = stampCount < 6;
}

function showNotification(title, msg) {
  const { notificationTitle, notificationMessage, notificationModal } = getElements();
  if (notificationTitle) notificationTitle.textContent = title;
  if (notificationMessage) notificationMessage.textContent = msg;
  if (notificationModal) notificationModal.classList.add('active');
}

async function addStamp() {
  const { loginModal } = getElements();
  if (!globalUID) {
    showNotification('要ログイン', 'スタンプを押すにはログインが必要です。');
    loginModal?.classList.add('active');
    return;
  }
  if (stampCount >= 6) {
    showNotification('スタンプカード満杯', '既にスタンプが6個たなっています！');
    return;
  }
  
  stampCount++;
  updateStampDisplay();
  updateRewardButtons();
  await updateStampCount(stampCount);

  if (stampCount === 3) showNotification('🎉', 'コーヒー1杯無料ゲット！');
  else if (stampCount === 6) showNotification('🎉', 'カレー1杯無料ゲット！');
  else showNotification('スタンプ獲得', `現在 ${stampCount} 個`);
}

async function redeemReward(type) {
  const required = type === 'coffee' ? 3 : 6;
  if (stampCount < required) return;

  stampCount -= required;
  updateStampDisplay();
  updateRewardButtons();
  await updateStampCount(stampCount);
  showNotification('交換完了', type === 'coffee' ? 'コーヒーと交換しました！' : 'カレーと交換しました！');
}

/* フィード記事表示 */
async function renderArticles(category) {
  const { articlesContainer } = getElements();
  if (!articlesContainer) return;

  const list = [
    { url:'https://machico.mu/special/detail/2691',category:'イベント',title:'Machico 2691',summary:'イベント記事' },
    { url:'https://machico.mu/special/detail/2704',category:'イベント',title:'Machico 2704',summary:'イベント記事' },
    { url:'https://machico.mu/jump/ad/102236',      category:'ニュース', title:'Machico 102236',summary:'ニュース記事' },
    { url:'https://machico.mu/special/detail/2926', category:'ニュース', title:'Machico 2926',summary:'ニュース記事' }
  ];
  const targets = list.filter(a => category === 'all' || a.category === category);

  try {
    const cards = await Promise.all(targets.map(async a => {
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(a.url)}`);
        if (!res.ok) throw new Error(`API request failed with status ${res.status}`);
        const d = await res.json();
        const doc = new DOMParser().parseFromString(d.contents, 'text/html');
        return { ...a, img: doc.querySelector("meta[property='og:image']")?.content || 'assets/placeholder.jpg' };
      } catch (e) {
        console.warn(`記事データの取得に失敗: ${a.url}`, e);
        return { ...a, img: 'assets/placeholder.jpg' }; // フォールバック
      }
    }));
  
    articlesContainer.innerHTML = ''; // 既存の内容をクリア
    cards.forEach(a => {
      const div = document.createElement('div');
      div.className = 'card article-card';
      div.innerHTML = `
        <a href="${a.url}" target="_blank" rel="noopener noreferrer">
          <img src="${a.img}" alt="${a.title}のサムネイル" loading="lazy">
          <div class="card__body" aria-label="記事: ${a.title}">
            <span class="article-category">${a.category}</span>
            <h3 class="article-title">${a.title}</h3>
            <p class="article-excerpt">${a.summary}</p>
          </div>
        </a>`;
      articlesContainer.appendChild(div);
    });
  } catch (error) {
    articlesContainer.innerHTML = '<div class="status status--error">記事の読み込みに失敗しました。</div>';
    console.error('Failed to render articles:', error);
  }
}

/* QRスキャナー */
function initQRScanner() {
  const qrReader = document.getElementById('qr-reader');
  if (!qrReader) return;
  qrReader.innerHTML = '';
  html5QrCode = new Html5Qrcode('qr-reader');

  html5QrCode.start(
    { facingMode:'environment' },
    { fps:10, qrbox:{ width:250, height:250 } },
    async (text) => {
      if (text === appData.qrString) {
        await addStamp();
      } else {
        showNotification('無効なQRコード', 'お店のQRコードをスキャンしてください。');
      }
      closeAllModals();
    },
    (errorMessage) => { /* パーシングエラーは無視 */ }
  ).catch(() => {
    qrReader.innerHTML='<div class="status status--error">カメラの起動に失敗しました。</div>';
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  if (html5QrCode && html5QrCode.getState() === 2) { // 2: SCANNING
    html5QrCode.stop().catch(err => console.error("QR Scanner stop failed", err));
  }
}

function closeModal(m){ 
  if (m) m.classList.remove('active'); 
}

/* イベントリスナー設定 */
function setupEventListeners() {
  if (eventBound) return;
  eventBound = true;

  const elements = getElements();

  elements.navLinks.forEach(link => {
    link.addEventListener('click', () => {
      elements.navLinks.forEach(n => n.classList.remove('active'));
      link.classList.add('active');
      elements.sections.forEach(s => s.classList.remove('active'));
      const target = document.getElementById(link.dataset.section);
      if(target) target.classList.add('active');

      if (link.dataset.section === 'foodtruck-section' && !globalUID) {
          elements.loginModal?.classList.add('active');
      }
    });
  });

  elements.categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderArticles(tab.dataset.category);
    });
  });

  if (elements.scanQrButton) {
    elements.scanQrButton.addEventListener('click', () => {
      if (!globalUID) {
        showNotification('要ログイン', 'QRスキャンにはログインが必要です。');
        elements.loginModal?.classList.add('active');
        return;
      }
      document.getElementById('qr-modal')?.classList.add('active');
      initQRScanner();
    });
  }

  document.querySelectorAll('.close-modal').forEach(btn =>
    btn.addEventListener('click', closeAllModals)
  );
  
  document.querySelector('.close-notification')?.addEventListener('click', () => 
    closeModal(elements.notificationModal)
  );

  elements.coffeeRewardButton?.addEventListener('click', () => redeemReward('coffee'));
  elements.curryRewardButton?.addEventListener('click', () => redeemReward('curry'));
}
