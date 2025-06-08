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
    appLoader: document.getElementById('app-loader'), // ★追加
    userStatus: document.getElementById('user-status'), // ★追加
  };
}

/* ★デバッグ用：致命的なエラーを画面に表示する関数 */
function showFatalError(title, error) {
  const appLoader = document.getElementById('app-loader');
  const appRoot = document.getElementById('app-root');
  const errorDisplay = document.getElementById('error-display');

  if (appLoader) appLoader.classList.remove('active');
  if (appRoot) appRoot.style.display = 'none';
  if (errorDisplay) {
    errorDisplay.style.display = 'block';
    errorDisplay.innerHTML = `
      <h2>${title}</h2>
      <p>問題の解決には、以下のエラー情報が必要です。</p>
      <pre>${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}</pre>
    `;
  }
}

/* ==================================================================== */
/* アプリケーションのメイン処理                                        */
/* ==================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();

  const { loginForm } = getElements();
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const { data, error } = await db.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: 'https://lomogoo.github.io/227stamp/', shouldCreateUser: true }
      });
      const msg = document.getElementById('login-message');
      if (error) {
        msg.textContent = '❌ メール送信に失敗しました';
      } else {
        msg.textContent = '✅ メールを確認してください！';
      }
    });
  }

  db.auth.onAuthStateChange(async (event, session) => {
    const appLoader = document.getElementById('app-loader');
    const userStatus = document.getElementById('user-status');
    appLoader?.classList.add('active'); // 処理開始時に必ずローダーを表示

    try {
      if (session && session.user) {
        globalUID = session.user.id;
        
        // ★処理を一つずつ順番に実行して原因を特定
        stampCount = await fetchOrCreateUserRow(globalUID);
        updateStampDisplay();
        updateRewardButtons();
        await renderArticles('all');

        localStorage.setItem('route227_stamps', stampCount.toString());
        document.getElementById('login-modal')?.classList.remove('active');

      } else {
        globalUID = null;
        stampCount = 0;
        localStorage.removeItem('route227_stamps');
        updateStampDisplay();
        updateRewardButtons();
        await renderArticles('all');
      }

      // ログイン状態を表示
      if (userStatus) {
        if (session && session.user) {
          userStatus.innerHTML = '<button id="logout-button" class="btn btn--sm btn--outline">ログアウト</button>';
          document.getElementById('logout-button').addEventListener('click', () => db.auth.signOut());
        } else {
          userStatus.innerHTML = '';
        }
      }

      // すべて成功した場合のみローダーを解除
      appLoader?.classList.remove('active');

    } catch (error) {
      // ★何らかのエラーが発生した場合、ここで捕捉して画面に表示
      showFatalError('アプリケーションの起動中にエラーが発生しました', error);
    }
  });
});

/* ==================================================================== */
/* ヘルパー関数群                                                      */
/* ==================================================================== */

async function fetchOrCreateUserRow(uid) {
  // ★ロジックを簡素化してエラーの原因を特定しやすくする
  try {
    // maybeSingle() を使い、0件でもエラーにならないようにする
    const { data, error } = await db.from('users').select('stamp_count').eq('supabase_uid', uid).maybeSingle();

    // 通信エラーやRLS以外の予期せぬエラーを捕捉
    if (error) {
      throw error;
    }

    // データがあればその数を返す
    if (data) {
      return data.stamp_count;
    }

    // データがなければ新規作成
    const { data: inserted, error: insertError } = await db.from('users').insert([{ supabase_uid: uid, stamp_count: 0 }]).select().single();
    if (insertError) {
      throw insertError;
    }
    return inserted.stamp_count;

  } catch (err) {
    // この関数で発生したすべてのエラーを上位に投げて、メイン処理で表示させる
    console.error('[fetchOrCreateUserRow] が失敗しました:', err);
    throw err;
  }
}

// ... (他のヘルパー関数は前回と同じものでOKですが、念のため全文掲載します) ...
async function updateStampCount(newCount) {
  if (!globalUID) throw new Error("Not logged in");
  const { data, error } = await db.from('users').update({ stamp_count: newCount }).eq('supabase_uid', globalUID).select().single();
  if (error) {
    console.error('スタンプ更新エラー:', error);
    showNotification('エラー', 'スタンプの保存に失敗しました。');
    throw error;
  }
  return data;
}

function updateStampDisplay() {
  getElements().stamps.forEach((el, i) => el.classList.toggle('active', i < stampCount));
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
  if (!globalUID) {
    showNotification('要ログイン', 'スタンプにはログインが必要です。');
    getElements().loginModal?.classList.add('active');
    return;
  }
  try {
    const currentCount = await fetchOrCreateUserRow(globalUID);
    if (currentCount >= 6) {
      showNotification('コンプリート！', 'スタンプが6個たまりました！');
      return;
    }
    const newCount = currentCount + 1;
    const updatedData = await updateStampCount(newCount);
    
    stampCount = updatedData.stamp_count;
    updateStampDisplay();
    updateRewardButtons();

    if (stampCount === 3) showNotification('🎉', 'コーヒー1杯無料！');
    else if (stampCount === 6) showNotification('🎉', 'カレー1杯無料！');
    else showNotification('スタンプ獲得', `現在 ${stampCount} 個`);
  } catch (error) {
    // 内部で通知しているのでここでは不要
  }
}

async function redeemReward(type) {
  if (!globalUID) return;
  try {
    const currentCount = await fetchOrCreateUserRow(globalUID);
    const required = type === 'coffee' ? 3 : 6;
    if (currentCount < required) return;

    const newCount = currentCount - required;
    const updatedData = await updateStampCount(newCount);
    
    stampCount = updatedData.stamp_count;
    updateStampDisplay();
    updateRewardButtons();

    showNotification('交換完了', `${type === 'coffee' ? 'コーヒー' : 'カレー'}と交換しました！`);
  } catch (error) {
    showNotification('エラー', '特典の交換に失敗しました。');
  }
}

function initQRScanner() {
  let isProcessing = false;
  const qrReader = document.getElementById('qr-reader');
  if (!qrReader) return;

  html5QrCode = new Html5Qrcode('qr-reader');
  html5QrCode.start({ facingMode:'environment' }, { fps:10, qrbox:{ width:250, height:250 } },
    async (text) => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        if ("ROUTE227_STAMP_2025" === text) {
          await addStamp();
        } else {
          showNotification('無効なQR', 'お店のQRコードではありません。');
        }
      } finally {
        closeAllModals();
      }
    },
    () => {}
  ).catch(() => qrReader.innerHTML='<div class="status status--error">カメラの起動に失敗しました。</div>');
}

const appData = {
  rewards: [{ type: "coffee", stampsRequired: 3, name: "コーヒー1杯無料" }, { type: "curry",  stampsRequired: 6, name: "カレー1杯無料" }],
  qrString: "ROUTE227_STAMP_2025"
};

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
        if (!res.ok) throw new Error(`API failed: ${res.status}`);
        const d = await res.json();
        const doc = new DOMParser().parseFromString(d.contents, 'text/html');
        return { ...a, img: doc.querySelector("meta[property='og:image']")?.content || 'assets/placeholder.jpg' };
      } catch (e) {
        return { ...a, img: 'assets/placeholder.jpg' };
      }
    }));
    articlesContainer.innerHTML = '';
    cards.forEach(a => {
      const div = document.createElement('div');
      div.className = 'card article-card';
      div.innerHTML = `<a href="${a.url}" target="_blank" rel="noopener noreferrer"><img src="${a.img}" alt="${a.title}のサムネイル" loading="lazy"><div class="card__body"><span class="article-category">${a.category}</span><h3 class="article-title">${a.title}</h3><p class="article-excerpt">${a.summary}</p></div></a>`;
      articlesContainer.appendChild(div);
    });
  } catch (error) {
    articlesContainer.innerHTML = '<div class="status status--error">記事の読み込みに失敗しました。</div>';
    throw error;
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  if (html5QrCode && html5QrCode.getState() === 2) {
    html5QrCode.stop().catch(err => console.error(err));
  }
}

function closeModal(m) {
  if (m) m.classList.remove('active');
}

function setupEventListeners() {
  if (eventBound) return;
  eventBound = true;
  const elements = getElements();
  elements.navLinks.forEach(link => {
    link.addEventListener('click', () => {
      elements.navLinks.forEach(n => n.classList.remove('active'));
      link.classList.add('active');
      elements.sections.forEach(s => s.classList.remove('active'));
      document.getElementById(link.dataset.section)?.classList.add('active');
      if (link.dataset.section === 'foodtruck-section' && !globalUID) {
        elements.loginModal?.classList.add('active');
      }
    });
  });
  elements.categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const { articlesContainer } = getElements();
      if(articlesContainer) articlesContainer.innerHTML = '<div class="loading-spinner"></div>';
      renderArticles(tab.dataset.category);
    });
  });
  elements.scanQrButton?.addEventListener('click', () => {
    if (!globalUID) {
      showNotification('要ログイン', 'QRスキャンにはログインが必要です。');
      elements.loginModal?.classList.add('active');
      return;
    }
    document.getElementById('qr-modal')?.classList.add('active');
    initQRScanner();
  });
  document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeAllModals));
  document.querySelector('.close-notification')?.addEventListener('click', () => closeModal(elements.notificationModal));
  elements.coffeeRewardButton?.addEventListener('click', () => redeemReward('coffee'));
  elements.curryRewardButton?.addEventListener('click', () => redeemReward('curry'));
}
