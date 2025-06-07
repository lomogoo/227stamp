// Route227Cafe Application

// Data (自社記事を削除し、報酬とQRのみ保持)
const appData = {
  rewards: [
    { type: "coffee", stampsRequired: 3, name: "コーヒー1杯無料" },
    { type: "curry", stampsRequired: 6, name: "カレー1杯無料" }
  ],
  qrString: "ROUTE227_STAMP_2025"
};

// DOM Elements
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');
const categoryTabs = document.querySelectorAll('.category-tab');
const articlesContainer = document.getElementById('articles-container');
const scanQrButton = document.getElementById('scan-qr');
const qrModal = document.getElementById('qr-modal');
const notificationModal = document.getElementById('notification-modal');
const closeModalButtons = document.querySelectorAll('.close-modal');
const closeNotificationButton = document.querySelector('.close-notification');
const coffeeRewardButton = document.getElementById('coffee-reward');
const curryRewardButton = document.getElementById('curry-reward');
const stamps = document.querySelectorAll('.stamp');
const notificationTitle = document.getElementById('notification-title');
const notificationMessage = document.getElementById('notification-message');

// Stamp Card Management
let stampCount = 0;

// Initialize the application
function initApp() {
  loadStampCount();
  renderArticles('all');
  updateStampDisplay();
  updateRewardButtons();
  setupEventListeners();
}

// Load stamp count from localStorage
function loadStampCount() {
  const savedStamps = localStorage.getItem('route227_stamps');
  if (savedStamps !== null) {
    stampCount = parseInt(savedStamps, 10);
  }
}

// Save stamp count to localStorage
function saveStampCount() {
  localStorage.setItem('route227_stamps', stampCount.toString());
}

// Update the visual display of stamps
function updateStampDisplay() {
  stamps.forEach((stamp, index) => {
    if (index < stampCount) stamp.classList.add('active');
    else stamp.classList.remove('active');
  });
}

// Update reward buttons based on stamp count
function updateRewardButtons() {
  coffeeRewardButton.disabled = stampCount < 3;
  curryRewardButton.disabled = stampCount < 6;
}

// Add a stamp
function addStamp() {
  if (stampCount < 6) {
    stampCount++;
    saveStampCount();
    const newStamp = document.querySelector(`.stamp[data-stamp-id="${stampCount}"]`);
    newStamp.classList.add('stamp-added');
    setTimeout(() => newStamp.classList.remove('stamp-added'), 500);
    updateStampDisplay();
    updateRewardButtons();
    if (stampCount === 3) showNotification('おめでとうございます！', 'コーヒー1杯無料の特典が利用できるようになりました！');
    else if (stampCount === 6) showNotification('おめでとうございます！', 'カレー1杯無料の特典が利用できるようになりました！');
    else showNotification('スタンプを獲得しました！', `現在のスタンプ数: ${stampCount}個`);
  }
}

// Redeem a reward
function redeemReward(type) {
  if (type === 'coffee' && stampCount >= 3) {
    stampCount -= 3;
    showNotification('交換完了', 'コーヒー1杯無料の特典を交換しました！');
  } else if (type === 'curry' && stampCount >= 6) {
    stampCount -= 6;
    showNotification('交換完了', 'カレー1杯無料の特典を交換しました！');
  }
  saveStampCount();
  updateStampDisplay();
  updateRewardButtons();
}

// Show notification modal
function showNotification(title, message) {
  notificationTitle.textContent = title;
  notificationMessage.textContent = message;
  notificationModal.classList.add('active');
}

// Initialize QR Scanner
function initQRScanner() {
  const qrReader = document.getElementById('qr-reader');
  const qrResult = document.getElementById('qr-result');
  qrReader.innerHTML = '';
  qrResult.innerHTML = '';
  const html5QrCode = new Html5Qrcode('qr-reader');
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onScanSuccess,
    onScanFailure
  ).catch(error => {
    qrResult.innerHTML = '<div class="status status--error">カメラへのアクセスに失敗しました。カメラの使用を許可してください。</div>';
    console.error('QR Code Scanner error:', error);
  });

  function onScanSuccess(decodedText) {
    html5QrCode.stop().then(() => {
      if (decodedText === appData.qrString) {
        qrResult.innerHTML = '<div class="status status--success">スタンプを獲得しました！</div>';
        setTimeout(() => { closeModal(qrModal); addStamp(); }, 1000);
      } else {
        qrResult.innerHTML = '<div class="status status--error">無効なQRコードです。Route227のスタンプQRコードをスキャンしてください。</div>';
      }
    }).catch(console.error);
  }

  function onScanFailure(error) {
    // 継続的に呼ばれるので何もしない
  }
}

// Render external Machico articles with controlled order and loading spinner
async function renderArticles(category) {
  // 記事定義の順番で確実に表示
  const externalArticles = [
    { url: 'https://machico.mu/special/detail/2691', category: 'イベント', title: '「仙臺横丁フェス」6月13日（金）～15日（日）開催', summary: '【会場で使えるお食事券をゲットしよう！】「仙臺横丁フェス」6月13日（金）～15日（日）開催' },
    { url: 'https://machico.mu/special/detail/2704', category: 'イベント', title: 'Kappo presents 杜の都のワイン祭り 「バル仙台2025」 開催！', summary: 'machicoタイアップ企画に参加してイベントをもっと楽しもう♪' },
    { url: 'https://machico.mu/jump/ad/102236', category: 'ニュース', title: '[COLORweb]学生編集部が、仙台・宮城の話題を中心に、気になるトピックをお届け♪', summary: '' },
    { url: 'https://machico.mu/special/detail/2926', category: 'ニュース', title: 'DoFree！Vol.311～本間ちゃんのここだけの話～', summary: '『北の湖…輪島 魁傑 富士桜』' }
  ];

  // ローディングスピナー表示
  articlesContainer.innerHTML = '<div class="loading-spinner"></div>';

  // カテゴリフィルタ
  const targets = externalArticles.filter(a => category === 'all' || a.category === category);

  // 全ての fetch を順序どおりに実行しつつ、Promise.all で順序保証
  try {
    const results = await Promise.all(
      targets.map(article =>
        fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(article.url)}`)
          .then(res => res.json())
          .then(data => ({ article, data }))
      )
    );

    // スピナー削除
    articlesContainer.innerHTML = '';

    // 取得順（元配列順）で描画
    results.forEach(({ article, data }) => {
      const img = new DOMParser()
        .parseFromString(data.contents, 'text/html')
        .querySelector("meta[property='og:image']")?.content || '';

      const card = document.createElement('div');
      card.className = 'card article-card';
      card.innerHTML = `
        <a href="${article.url}" target="_blank" rel="noopener noreferrer">
          <img src="${img}" alt="${article.title}" />
          <div class="card__body">
            <span class="article-category">${article.category}</span>
            <h3 class="article-title">${article.title}</h3>
            <p class="article-excerpt">${article.summary}</p>
          </div>
        </a>`;
      articlesContainer.appendChild(card);
    });
  } catch (err) {
    console.error('記事取得中にエラー:', err);
    articlesContainer.innerHTML = '<p>記事の読み込みに失敗しました。</p>';
  }
}

// Close modal
function closeModal(modal) {
  modal.classList.remove('active');
}

// Setup Event Listeners
function setupEventListeners() {
  navLinks.forEach(link => link.addEventListener('click', () => {
    navLinks.forEach(n => n.classList.remove('active'));
    link.classList.add('active');
    sections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(link.dataset.section).classList.add('active');
  }));

  categoryTabs.forEach(tab => tab.addEventListener('click', () => {
    categoryTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderArticles(tab.dataset.category);
  }));

  scanQrButton.addEventListener('click', () => {
    qrModal.classList.add('active');
    initQRScanner();
  });

  closeModalButtons.forEach(btn => btn.addEventListener('click', () =>
    closeModal(btn.closest('.modal'))
  ));

  closeNotificationButton.addEventListener('click', () =>
    closeModal(notificationModal)
  );

  coffeeRewardButton.addEventListener('click', () => redeemReward('coffee'));
  curryRewardButton.addEventListener('click', () => redeemReward('curry'));
}

document.addEventListener('DOMContentLoaded', initApp);
