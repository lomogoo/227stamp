// Route227Cafe Application

// Data
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
  if (type === 'coffee' && stampCount >= 3) { stampCount -= 3; showNotification('交換完了', 'コーヒー1杯無料の特典を交換しました！'); }
  else if (type === 'curry' && stampCount >= 6) { stampCount -= 6; showNotification('交換完了', 'カレー1杯無料の特典を交換しました！'); }
  saveStampCount(); updateStampDisplay(); updateRewardButtons();
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
  html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess, onScanFailure)
    .catch(error => {
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
  function onScanFailure(error) {}
}

// Render articles based on selected category
function renderArticles(category) {
  articlesContainer.innerHTML = '';
  const filtered = category === 'all' ? appData.articles : appData.articles.filter(a => a.category === category);
  filtered.forEach(article => {
    const card = document.createElement('div');
    card.className = 'card article-card';
    card.innerHTML = `
      <div class="card__body">
        <span class="article-category">${article.category}</span>
        <h3 class="article-title">${article.title}</h3>
        <div class="article-date">${formatDate(article.date)}</div>
        <p class="article-excerpt">${article.excerpt}</p>
      </div>`;
    articlesContainer.appendChild(card);
  });
  // Machico記事を全カテゴリで表示
  if (category === 'all') {
    const externalArticles = [
      { url: 'https://machico.mu/special/detail/2691', category: 'イベント' },
      { url: 'https://machico.mu/special/detail/2704', category: 'イベント' },
      { url: 'https://machico.mu/jump/ad/102236', category: 'ニュース' },
      { url: 'https://machico.mu/special/detail/2926', category: 'ニュース' }
    ];
    externalArticles.forEach(({ url, category }) => {
      fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
        .then(res => res.json())
        .then(data => {
          const doc = new DOMParser().parseFromString(data.contents, 'text/html');
          const title = doc.querySelector("meta[property='og:title']")?.content || '';
          const desc = doc.querySelector("meta[property='og:description']")?.content || '';
          const img = doc.querySelector("meta[property='og:image']")?.content || '';
          const card = document.createElement('div');
          card.className = 'card article-card';
          card.innerHTML = `
            <a href="${url}" target="_blank" rel="noopener noreferrer">
              <img src="${img}" alt="${title}" />
              <div class="card__body">
                <span class="article-category">${category}</span>
                <h3 class="article-title">${title}</h3>
                <p class="article-excerpt">${desc}</p>
              </div>
            </a>`;
          articlesContainer.appendChild(card);
        })
        .catch(console.error);
    });
  }
}

// Format date to Japanese style
function formatDate(d) {
  const date = new Date(d);
  return `${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日`;
}

// Close modal
function closeModal(modal) { modal.classList.remove('active'); }

// Setup Event Listeners
function setupEventListeners() {
  navLinks.forEach(link => link.addEventListener('click', () => {
    navLinks.forEach(n => n.classList.remove('active')); link.classList.add('active');
    sections.forEach(sec => sec.classList.remove('active'));
    document.getElementById(link.getAttribute('data-section')).classList.add('active');
  }));
  categoryTabs.forEach(tab => tab.addEventListener('click', () => {
    categoryTabs.forEach(t => t.classList.remove('active')); tab.classList.add('active');
    renderArticles(tab.getAttribute('data-category'));
  }));
  scanQrButton.addEventListener('click', () => { qrModal.classList.add('active'); initQRScanner(); });
  closeModalButtons.forEach(btn => btn.addEventListener('click', () => closeModal(btn.closest('.modal'))));
  closeNotificationButton.addEventListener('click', () => closeModal(notificationModal));
  coffeeRewardButton.addEventListener('click', () => redeemReward('coffee'));
  curryRewardButton.addEventListener('click', () => redeemReward('curry'));
}

document.addEventListener('DOMContentLoaded', initApp);
