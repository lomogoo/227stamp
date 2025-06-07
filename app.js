// ===== Supabase設定 =====
const SUPABASE_URL = 'https://hccairtzksnnqdujalgv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2FpcnR6a3NubnFkdWphbGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjI2MTYsImV4cCI6MjA2NDgzODYxNn0.TVDucIs5ClTWuykg_fy4yv65Rg-xbSIPFIfvIYawy_k';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
    
    // ログインフォームを削除
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
async function fetchOrCreateUserRow(userId) {
  try {
    const { data, error } = await db
      .from('users')
      .select('stamp_count')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // ユーザーが存在しない場合は新規作成
      const { data: newUser, error: insertError } = await db
        .from('users')
        .insert({ id: userId, stamp_count: 0 })
        .select('stamp_count')
        .single();
      
      if (insertError) throw insertError;
      return newUser.stamp_count;
    }
    
    if (error) throw error;
    return data.stamp_count;
  } catch (error) {
    console.error('ユーザーデータ取得エラー:', error);
    return 0;
  }
}

async function fetchArticles(category = 'all') {
  try {
    let query = db.from('articles').select('*').order('created_at', { ascending: false });
    
    if (category !== 'all') {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('記事取得エラー:', error);
    return [];
  }
}

async function updateStampCount(newCount) {
  if (!globalUID) return false;
  
  try {
    const { error } = await db
      .from('users')
      .update({ stamp_count: newCount })
      .eq('id', globalUID);
    
    if (error) throw error;
    
    stampCount = newCount;
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
    container.innerHTML = '<div class="loading">記事を読み込み中...</div>';
    
    const articles = await fetchArticles(category);
    
    if (articles.length === 0) {
      container.innerHTML = '<div class="no-articles">記事がありません</div>';
      return;
    }
    
    container.innerHTML = articles.map(article => `
      <article class="article-card">
        <div class="article-header">
          <span class="article-category">${article.category || 'その他'}</span>
          <time class="article-date">${formatDate(article.created_at)}</time>
        </div>
        <h3 class="article-title">${escapeHtml(article.title)}</h3>
        <p class="article-content">${escapeHtml(article.content?.substring(0, 100) || '')}...</p>
      </article>
    `).join('');
  } catch (error) {
    console.error('記事描画エラー:', error);
    container.innerHTML = '<div class="error">記事の読み込みに失敗しました</div>';
  }
}

function updateStampDisplay() {
  const stamps = document.querySelectorAll('.stamp');
  stamps.forEach((stamp, index) => {
    const stampId = index + 1;
    if (stampId <= stampCount) {
      stamp.classList.add('collected');
      stamp.innerHTML = '⭐';
    } else {
      stamp.classList.remove('collected');
      stamp.innerHTML = '';
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
  const categoryTabs = document.querySelector('.category-tabs');
  if (categoryTabs) {
    categoryTabs.addEventListener('click', async (e) => {
      if (e.target.classList.contains('category-tab')) {
        // アクティブタブの更新
        document.querySelectorAll('.category-tab').forEach(tab => 
          tab.classList.remove('active')
        );
        e.target.classList.add('active');
        
        // 記事の再描画
        const category = e.target.dataset.category;
        await renderArticles(category);
      }
    });
  }
  
  // ナビゲーション
  const navTabs = document.querySelectorAll('.nav-link');
  navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetSection = e.currentTarget.dataset.section;
      
      // アクティブナビの更新
      navTabs.forEach(nav => nav.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      // セクションの切り替え
      document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
      });
      document.getElementById(targetSection)?.classList.add('active');
    });
  });
  
  // QRスキャンボタン
  const scanButton = document.getElementById('scan-qr');
  if (scanButton) {
    scanButton.addEventListener('click', openQRScanner);
  }
  
  // 報酬交換ボタン
  const coffeeButton = document.getElementById('coffee-reward');
  const curryButton = document.getElementById('curry-reward');
  
  if (coffeeButton) {
    coffeeButton.addEventListener('click', () => exchangeReward(3, 'コーヒー'));
  }
  
  if (curryButton) {
    curryButton.addEventListener('click', () => exchangeReward(6, 'カレー'));
  }
  
  // ログインフォーム
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // モーダル関連
  document.querySelectorAll('.close-modal').forEach(button => {
    button.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });
  
  const closeNotificationButton = document.querySelector('.close-notification');
  if (closeNotificationButton) {
    closeNotificationButton.addEventListener('click', () => closeModal('notification-modal'));
  }
}

// ===== QRコード関連 =====
async function openQRScanner() {
  if (!globalUID) {
    showNotification('QRコードをスキャンするにはログインが必要です', 'ログインが必要');
    openModal('login-modal');
    return;
  }
  
  openModal('qr-modal');
  
  try {
    html5QrCode = new Html5Qrcode("qr-reader");
    
    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      onQRCodeScanned,
      onQRCodeError
    );
  } catch (error) {
    console.error('QRスキャナー開始エラー:', error);
    showNotification('QRスキャナーの開始に失敗しました', 'エラー');
    closeModal('qr-modal');
  }
}

async function onQRCodeScanned(decodedText) {
  try {
    // QRコードを停止
    if (html5QrCode) {
      await html5QrCode.stop();
      html5QrCode = null;
    }
    
    closeModal('qr-modal');
    
    // スタンプを追加（最大6個まで）
    if (stampCount < 6) {
      const success = await updateStampCount(stampCount + 1);
      if (success) {
        showNotification(`スタンプを獲得しました！(${stampCount}/6)`, 'スタンプ獲得');
      } else {
        showNotification('スタンプの保存に失敗しました', 'エラー');
      }
    } else {
      showNotification('スタンプカードが満杯です！', 'お知らせ');
    }
  } catch (error) {
    console.error('QRコード処理エラー:', error);
    showNotification('QRコードの処理に失敗しました', 'エラー');
  }
}

function onQRCodeError(error) {
  // QRコードが見つからない場合のエラーは無視
  if (error.includes('QR code parse error')) return;
  console.error('QRスキャンエラー:', error);
}

// ===== 報酬交換 =====
async function exchangeReward(requiredStamps, rewardName) {
  if (!globalUID) {
    showNotification('報酬を交換するにはログインが必要です', 'ログインが必要');
    return;
  }
  
  if (stampCount < requiredStamps) {
    showNotification(`${rewardName}の交換には${requiredStamps}個のスタンプが必要です`, 'スタンプ不足');
    return;
  }
  
  const success = await updateStampCount(stampCount - requiredStamps);
  if (success) {
    showNotification(`${rewardName}と交換しました！お店でご提示ください`, '交換完了');
  } else {
    showNotification('交換処理に失敗しました', 'エラー');
  }
}

// ===== ログイン処理 =====
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const messageElement = document.getElementById('login-message');
  
  if (!email) {
    messageElement.textContent = 'メールアドレスを入力してください';
    return;
  }
  
  try {
    messageElement.textContent = '送信中...';
    
    const { error } = await db.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    
    if (error) throw error;
    
    messageElement.textContent = 'マジックリンクを送信しました！メールをご確認ください';
    messageElement.style.color = 'green';
  } catch (error) {
    console.error('ログインエラー:', error);
    messageElement.textContent = 'ログインに失敗しました: ' + error.message;
    messageElement.style.color = 'red';
  }
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
    
    // QRスキャナーが動作中の場合は停止
    if (modalId === 'qr-modal' && html5QrCode) {
      html5QrCode.stop().catch(console.error);
      html5QrCode = null;
    }
  }
}

function showNotification(message, title = 'お知らせ') {
  const titleElement = document.getElementById('notification-title');
  const messageElement = document.getElementById('notification-message');
  
  if (titleElement) titleElement.textContent = title;
  if (messageElement) messageElement.textContent = message;
  
  openModal('notification-modal');
}

// ===== ユーティリティ関数 =====
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
