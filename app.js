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
    const { articlesContainer, loginModal, appLoader, userStatus } = getElements();
    
    try {
      if (session && session.user) {
        globalUID = session.user.id;
        loginModal?.classList.remove('active');
        
        const [fetchedStampCount] = await Promise.all([
          fetchOrCreateUserRow(globalUID),
          renderArticles('all')
        ]);
        stampCount = fetchedStampCount;
        localStorage.setItem('route227_stamps', stampCount.toString());

      } else {
        globalUID = null;
        stampCount = 0;
        localStorage.removeItem('route227_stamps');
        await renderArticles('all');
      }
    } catch (error) {
      console.error("認証状態の処理中にエラーが発生しました:", error);
      showNotification('エラー', 'データの読み込みに失敗しました。');
    }

    // すべてのデータ取得が終わった後にUIを更新
    updateStampDisplay();
    updateRewardButtons();
    getElements().categoryTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.category === 'all');
    });

    // ★ログイン状態を表示
    if (userStatus) {
      if (session && session.user) {
        userStatus.innerHTML = '<button id="logout-button" class="btn btn--sm btn--outline">ログアウト</button>';
        document.getElementById('logout-button').addEventListener('click', async () => {
          appLoader?.classList.add('active'); // ログアウト中もローダー表示
          await db.auth.signOut();
          // onAuthStateChangeが再度呼ばれるのでローダーはそこで消える
        });
      } else {
        userStatus.innerHTML = '';
      }
    }

    // ★最後にアプリ全体のローディングを解除
    appLoader?.classList.remove('active');
  });
});

/* ==================================================================== */
/* ヘルパー関数群                                                      */
/* ==================================================================== */

async function fetchOrCreateUserRow(uid) {
  try {
    const { data, error } = await db.from('users').select('stamp_count').eq('supabase_uid', uid).single();
    if (error) {
      if (error.code === 'PGRST116') {
        const { data: inserted, error: iErr } = await db.from('users').insert([{ supabase_uid: uid, stamp_count: 0 }]).select().single();
        if (iErr) throw iErr;
        return inserted.stamp_count;
      }
      throw error;
    }
    return data ? data.stamp_count : 0;
  } catch (err) {
    console.error('[fetchOrCreateUserRow] Error:', err);
    showNotification('エラー', 'スタンプ情報の取得に失敗しました。');
    return 0;
  }
}

async function updateStampCount(newCount) {
  if (!globalUID) return;
  const { data, error } = await db.from('users').update({ stamp_count: newCount, updated_at: new Date().toISOString() }).eq('supabase_uid', globalUID).select().single();
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
