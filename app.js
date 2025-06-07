/* app.js – B 修正版（≈290 行：A＋追加改善）*/
const db = window.supabase.createClient(
  'https://hccairtzksnnqdujalgv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjY2FpcnR6a3NubnFkdWphbGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNjI2MTYsImV4cCI6MjA2NDgzODYxNn0.TVDucIs5ClTWuykg_fy4yv65Rg-xbSIPFIfvIYawy_k'
);

/* ===== A と同じ同期セットアップ省略（ここまで同一） ===== */

let eventBound = false;   // ★ 多重登録ガード

function setupEventListeners() {
  if (eventBound) return; // ← ２回目以降は無視
  eventBound = true;

  /* ★ nav-link クリック */
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', async () => {
      document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
      link.classList.add('active');

      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      const target = document.getElementById(link.dataset.section);
      target.classList.add('active');

      if (link.dataset.section === 'foodtruck-section') {
        await syncStampFromDB();
        updateStampDisplay();
        updateRewardButtons();
      }
    }, { passive: true });
  });

  /* ★ カテゴリタブ */
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderArticles(tab.dataset.category);
    }, { passive: true });
  });

  /* ★ QR モーダル */
  document.getElementById('scan-qr').addEventListener('click', () => {
    document.getElementById('qr-modal').classList.add('active');
    initQRScanner();
  });

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', closeAllModals, { passive: true });
  });

  document.querySelector('.close-notification').addEventListener('click', () => {
    closeModal(document.getElementById('notification-modal'));
    updateStampDisplay();
  }, { passive: true });

  document.getElementById('coffee-reward').addEventListener('click', () => redeemReward('coffee'));
  document.getElementById('curry-reward').addEventListener('click', () => redeemReward('curry'));
}

/* ====== QR スキャナ改善 ====== */
function initQRScanner() {
  const qrReader = document.getElementById('qr-reader');
  qrReader.innerHTML = '';
  html5QrCode = new Html5Qrcode('qr-reader');

  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    async text => {
      await html5QrCode.stop();  // ★ すぐ停止
      html5QrCode.clear();
      if (text === appData.qrString) {
        addStamp();
        showNotification('🎉', 'スタンプ獲得！');
      } else {
        showNotification('無効なQR', '読み取れませんでした');
      }
      closeModal(document.getElementById('qr-modal'));
    },
    () => {}
  ).catch(() => {
    qrReader.innerHTML = '<div class="status status--error">カメラエラー</div>';
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => {
    if (m.classList.contains('active')) {
      m.classList.remove('active');
    }
  });
  if (html5QrCode) {      // ★ 念のため解放
    html5QrCode.stop().catch(()=>{}).then(()=>html5QrCode.clear());
  }
}

/* ====== renderArticles() フォールバック＆アクセシビリティ ====== */
async function renderArticles(category) {
  const list = [
    { url:'https://machico.mu/special/detail/2691',category:'イベント',title:'Machico 2691',summary:'イベント記事' },
    { url:'https://machico.mu/special/detail/2704',category:'イベント',title:'Machico 2704',summary:'イベント記事' },
    { url:'https://machico.mu/jump/ad/102236',      category:'ニュース', title:'Machico 102236',summary:'ニュース記事' },
    { url:'https://machico.mu/special/detail/2926', category:'ニュース', title:'Machico 2926',summary:'ニュース記事' }
  ];

  const targets = list.filter(a => category === 'all' || a.category === category);
  const cards = await Promise.all(targets.map(async a => {
    try {
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(a.url)}`);
      const d = await r.json();
      const doc = new DOMParser().parseFromString(d.contents, 'text/html');
      return {
        ...a,
        img: doc.querySelector("meta[property='og:image']")?.content || 'assets/placeholder.jpg'
      };
    } catch {
      return { ...a, img: 'assets/placeholder.jpg' }; // ← フォールバック
    }
  }));

  const c = document.getElementById('articles-container');
  c.innerHTML = '';
  cards.forEach(a => {
    const div = document.createElement('div');
    div.className = 'card article-card';
    div.innerHTML = `
      <a href="${a.url}" target="_blank" rel="noopener noreferrer">
        <img src="${a.img}" alt="${a.title}のサムネイル画像">
        <div class="card__body" aria-label="記事: ${a.title}">
          <span class="article-category" aria-label="カテゴリ">${a.category}</span>
          <h3 class="article-title">${a.title}</h3>
          <p class="article-excerpt">${a.summary}</p>
        </div>
      </a>`;
    c.appendChild(div);
  });
}

/* ====== その他の関数は A 版と同じ ====== */
document.addEventListener('DOMContentLoaded', initApp);
