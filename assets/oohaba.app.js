// ===== Supabase設定 =====
const db = window.supabase.createClient(
  'https://hccairtzksnnqdujalgv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2FpcnR6a3NubnFkdWphbGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjI2MTYsImV4cCI6MjA2NDgzODYxNn0.TVDucIs5ClTWuykg_fy4yv65Rg-xbSIPFIfvIYawy_k'
);

// ===== グローバル変数 =====
let globalUID = null;
let stampCount = 0;
let html5QrCode = null;
let isAppInitialized = false;

// ===== アプリケーションエントリーポイント =====
document.addEventListener('DOMContentLoaded', () => {
  // 認証状態の監視開始
  db.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user || null;
    
    if (!isAppInitialized) {
      // 初回のみアプリ全体を初期化
      await initializeApp(user);
      isAppInitialized = true;
    } else {
      // 2回目以降は認証状態のみ更新
      await updateUserStatus(user);
    }
  });
});

// ===== メイン初期化関数 =====
async function initializeApp(user) {
  try {
    console.log('アプリケーション初期化開始...');
    
    // ユーザー状態の更新
    await updateUserStatus(user);
    
    // 記事フィードの描画
    await renderArticles('all');
    
    // イベントリスナーの設定
    setupEventListeners();
    
    console.log('アプリケーション初期化完了');
  } catch (error) {
    console.error('初期化エラー:', error);
  }
}

// ===== ユーザー状態管理 =====
async function updateUserStatus(user) {
  if (user) {
    globalUID = user.id;
    stampCount = await fetchOrCreateUserRow(globalUID);
    closeModal('login-modal');
    
    // ログインフォームを非表示
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.style.display = 'none';
    }
  } else {
    globalUID = null;
    stampCount = 0;
  }
  
  updateStampDisplay();
  updateRewardButtons();
}

// ===== データベース操作 =====
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
        .select('stamp_count')
        .single();
      if (iErr) throw iErr;
      return inserted.stamp_count;
    }
    if (error) throw error;
    return data.stamp_count;
  } catch (error) {
    console.error('ユーザーデータ取得エラー:', error);
    return 0;
  }
}

async function updateStampCount(newCount) {
  if (!globalUID) return false;
  
  try {
    const { error } = await db
      .from('users')
      .update({ stamp_count: newCount, updated_at: new Date().toISOString() })
      .eq('supabase_uid', globalUID);
    
    if (error) throw error;
    
    stampCount = newCount;
    localStorage.setItem('route227_stamps', stampCount);
    updateStampDisplay();
    updateRewardButtons();
    return true;
  } catch (error) {
    console.error('スタンプ数更新エラー:', error);
    return false;
  }
}

// ===== UI更新関数 =====
async function renderArticles(category) {
  const container = document.getElementById('articles-container');
  if (!container) return;
  
  try {
    container.innerHTML = '<div class="loading-spinner"></div>';
    
    // 過去のコードから取り上げていた記事5つを反映
    const list = [
      { url: 'https://machico.mu/special/detail/2691', category: 'イベント', title: 'Machico 2691', summary: 'イベント記事' },
      { url: 'https://machico.mu/special/detail/2704', category: 'イベント', title: 'Machico 2704', summary: 'イベント記事' },
      { url: 'https://machico.mu/jump/ad/102236', category: 'ニュース', title: 'Machico 102236', summary: 'ニュース記事' },
      { url: 'https://machico.mu/special/detail/2926', category: 'ニュース', title: 'Machico 2926', summary: 'ニュース記事' },
      { url: 'https://machico.mu/special/detail/1234', category: 'お店', title: 'Machico 1234', summary: 'お店記事' }
    ];
    
    const targets = list.filter(a => category === 'all' || a.category === category);
    
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
    console.error('記事描画エラー:', error);
    container.innerHTML = '<div class="error">記事の読み込みに失敗しました</div>';
  }
}

function updateStampDisplay() {
  const stamps = document.querySelectorAll('.stamp');
  stamps.forEach((el, i) => {
    if (i < stampCount) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

function updateRewardButtons() {
  const coffeeButton = document.getElementById('coffee-reward');
  const curryButton = document.getElementById('curry-reward');
  
  if (coffeeButton) {
    coffeeButton.disabled = stampCount < 3;
  }
  
  if (curryButton) {
    curryButton.disabled = stampCount < 6;
  }
}

// ===== イベントリスナー設定 =====
function setupEventListeners() {
  // カテゴリタブ
  const categoryTabs = document.querySelectorAll('.category-tab');
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderArticles(tab.dataset.category);
    }, { passive: true });
  });
  
  // ナビゲーション
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', async () => {
      navLinks.forEach(n => n.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      const target = document.getElementById(link.dataset.section);
      target.classList.add('active');
      
      // スタンプカードページで未ログインの場合、ログインモーダルを表示
      if (link.dataset.section === 'foodtruck-section' && !globalUID) {
        openModal('login-modal');
      } else if (link.dataset.section === 'foodtruck-section' && globalUID) {
        const spinner = document.getElementById('stamp-spinner');
        spinner?.classList.remove('hidden');
        try {
          await syncStampFromDB(globalUID);
        } finally {
          spinner?.classList.add('hidden');
        }
        updateStampDisplay();
        updateRewardButtons();
      }
    }, { passive: true });
  });
  
  // QRスキャンボタン
  const scanButton = document.getElementById('scan-qr');
  if (scanButton) {
    scanButton.addEventListener('click', () => {
      if (!globalUID) {
        showNotification('QRコードをスキャンするにはログインが必要です', 'ログインが必要');
        openModal('login-modal');
        return;
      }
      openModal('qr-modal');
      initQRScanner();
    });
  }
  
  // 報酬交換ボタン
  const coffeeButton = document.getElementById('coffee-reward');
  const curryButton = document.getElementById('curry-reward');
  
  if (coffeeButton) {
    coffeeButton.addEventListener('click', () => redeemReward('coffee'));
  }
  
  if (curryButton) {
    curryButton.addEventListener('click', () => redeemReward('curry'));
  }
  
  // ログインフォーム
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const msg = document.getElementById('login-message');
      try {
        msg.textContent = '送信中...';
        const { data, error } = await db.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: 'https://lomogoo.github.io/227stamp/',
            shouldCreateUser: true
          }
        });
        console.log('[Auth] signInWithOtp →', { data, error });
        if (error) {
          msg.textContent = '❌ メール送信に失敗しました';
          console.error(error);
        } else {
          msg.textContent = '✅ メールを確認してください！';
        }
      } catch (error) {
        msg.textContent = '❌ メール送信に失敗しました';
        console.error('ログインエラー:', error);
      }
    });
  }
  
  // モーダル関連
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', closeAllModals, { passive: true });
  });
  
  document.querySelector('.close-notification')?.addEventListener('click', () => closeModal('notification-modal'), { passive: true });
}

// ===== QRコード関連 =====
function initQRScanner() {
  const qrReader = document.getElementById('qr-reader');
  qrReader.innerHTML = '';
  html5QrCode = new Html5Qrcode('qr-reader');
  
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    async text => {
      await html5QrCode.stop();
      html5QrCode.clear();
      if (text === 'ROUTE227_STAMP_2025') {
        await addStamp();
      } else {
        showNotification('無効なQR', '読み取れませんでした');
      }
      closeModal('qr-modal');
    },
    () => {}
  ).catch(() => {
    qrReader.innerHTML = '<div class="status status--error">カメラエラー</div>';
  });
}

async function syncStampFromDB(uid) {
  if (!uid) return;
  
  try {
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
  } catch (error) {
    console.error('スタンプ同期エラー:', error);
  }
}

async function addStamp() {
  if (!globalUID) {
    showNotification('要ログイン', '先にログインしてください');
    return;
  }
  if (stampCount >= 6) {
    showNotification('スタンプ満杯', 'スタンプカードが満杯です');
    return;
  }
  stampCount++;
  await updateStampCount(stampCount);
  
  if (stampCount === 3) {
    showNotification('🎉', 'コーヒー1杯無料ゲット！');
  } else if (stampCount === 6) {
    showNotification('🎉', 'カレー1杯無料ゲット！');
  } else {
    showNotification('スタンプ獲得', `現在 ${stampCount} 個`);
  }
}

async function redeemReward(type) {
  if (!globalUID) {
    showNotification('要ログイン', '先にログインしてください');
    return;
  }
  
  if (type === 'coffee' && stampCount >= 3) {
    stampCount -= 3;
  } else if (type === 'curry' && stampCount >= 6) {
    stampCount -= 6;
  } else {
    showNotification('スタンプ不足', `${type === 'coffee' ? 'コーヒー' : 'カレー'}の交換に必要なスタンプが足りません`);
    return;
  }
  
  await updateStampCount(stampCount);
  showNotification('交換完了', type === 'coffee' ? 'コーヒー交換！' : 'カレー交換！');
}

// ===== モーダル操作 =====
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    if (modalId === 'qr-modal' && html5QrCode) {
      html5QrCode.stop().catch(console.error);
      html5QrCode = null;
    }
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.body.style.overflow = '';
  if (html5QrCode) {
    html5QrCode.stop().catch(console.error);
    html5QrCode = null;
  }
}

function showNotification(title, msg) {
  const titleElement = document.getElementById('notification-title');
  const messageElement = document.getElementById('notification-message');
  
  if (titleElement) titleElement.textContent = title;
  if (messageElement) messageElement.textContent = msg;
  
  openModal('notification-modal');
}
