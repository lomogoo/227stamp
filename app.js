// Route227Cafe Application

// Data
const appData = {
  articles: [
    {
      id: 1,
      title: "仙台の新しいカフェ文化",
      category: "お店",
      date: "2025-06-05",
      excerpt: "仙台市内で注目を集める新しいカフェスタイルについて紹介します。",
      content: "仙台の街角に新しいカフェ文化が根付いています..."
    },
    {
      id: 2,
      title: "Route227キッチンカー始動",
      category: "ニュース",
      date: "2025-06-04",
      excerpt: "Route227がキッチンカーでの営業を開始しました。",
      content: "東北227市町村の魅力を乗せたキッチンカーが..."
    },
    {
      id: 3,
      title: "夏のカレーフェスティバル",
      category: "イベント",
      date: "2025-06-03",
      excerpt: "7月に開催予定の夏のカレーフェスティバルの詳細が決定しました。",
      content: "今年の夏も盛大にカレーフェスティバルを開催..."
    },
    {
      id: 4,
      title: "東北食材の魅力",
      category: "お店",
      date: "2025-06-02",
      excerpt: "Route227で使用している東北各地の食材について。",
      content: "東北6県の豊かな食材を使用したメニュー..."
    },
    {
      id: 5,
      title: "地域コミュニティとの連携",
      category: "ニュース",
      date: "2025-06-01",
      excerpt: "地域コミュニティとの新しい取り組みを発表。",
      content: "地域の皆様との連携を深めるプロジェクト..."
    },
    {
      id: 6,
      title: "ワークショップ開催のお知らせ",
      category: "イベント",
      date: "2025-05-30",
      excerpt: "6月に開催されるワークショップの参加者を募集中です。",
      content: "東北の文化を体験できるワークショップ..."
    }
  ],
  rewards: [
    {
      type: "coffee",
      stampsRequired: 3,
      name: "コーヒー1杯無料"
    },
    {
      type: "curry",
      stampsRequired: 6,
      name: "カレー1杯無料"
    }
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

  // 🔽 ここからMachico記事の読み込み処理を追加！
  const externalArticles = [
    { url: "https://machico.mu/special/detail/2691", category: "イベント" },
    { url: "https://machico.mu/special/detail/2704", category: "イベント" },
    { url: "https://machico.mu/jump/ad/102236", category: "ニュース" },
    { url: "https://machico.mu/special/detail/2926", category: "ニュース" },
  ];

  const feedSection = document.getElementById("feed-section");

  if (feedSection) {
    externalArticles.forEach(({ url, category }) => {
      fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
        .then(res => res.json())
        .then(data => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(data.contents, "text/html");

          const title = doc.querySelector("meta[property='og:title']")?.content || "タイトルなし";
          const description = doc.querySelector("meta[property='og:description']")?.content || "説明なし";
          const image = doc.querySelector("meta[property='og:image']")?.content || "";

          const card = document.createElement("div");
          card.className = "article-card";
          card.innerHTML = `
            <a href="${url}" target="_blank" rel="noopener noreferrer">
              <img src="${image}" alt="${title}">
              <div class="article-content">
                <div class="article-category">${category}</div>
                <div class="article-title">${title}</div>
                <div class="article-summary">${description}</div>
              </div>
            </a>
          `;
          feedSection.appendChild(card);
        })
        .catch(err => {
          console.error("記事取得エラー:", err);
        });
    });
  }
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
    if (index < stampCount) {
      stamp.classList.add('active');
    } else {
      stamp.classList.remove('active');
    }
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
    
    // Animate the newly added stamp
    const newStamp = document.querySelector(`.stamp[data-stamp-id="${stampCount}"]`);
    newStamp.classList.add('stamp-added');
    
    // Remove animation class after animation completes
    setTimeout(() => {
      newStamp.classList.remove('stamp-added');
    }, 500);
    
    updateStampDisplay();
    updateRewardButtons();
    
    // Show notification for rewards eligibility
    if (stampCount === 3) {
      showNotification('おめでとうございます！', 'コーヒー1杯無料の特典が利用できるようになりました！');
    } else if (stampCount === 6) {
      showNotification('おめでとうございます！', 'カレー1杯無料の特典が利用できるようになりました！');
    } else {
      showNotification('スタンプを獲得しました！', `現在のスタンプ数: ${stampCount}個`);
    }
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
  
  // Clear previous content
  qrReader.innerHTML = '';
  qrResult.innerHTML = '';
  
  const html5QrCode = new Html5Qrcode("qr-reader");
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  
  html5QrCode.start(
    { facingMode: "environment" },
    config,
    onScanSuccess,
    onScanFailure
  ).catch(error => {
    qrResult.innerHTML = `
      <div class="status status--error">
        カメラへのアクセスに失敗しました。カメラの使用を許可してください。
      </div>
    `;
    console.error("QR Code Scanner error:", error);
  });
  
  // Success callback
  function onScanSuccess(decodedText) {
    html5QrCode.stop().then(() => {
      if (decodedText === appData.qrString) {
        qrResult.innerHTML = `
          <div class="status status--success">
            スタンプを獲得しました！
          </div>
        `;
        
        // Add stamp and close modal after a short delay
        setTimeout(() => {
          closeModal(qrModal);
          addStamp();
        }, 1000);
      } else {
        qrResult.innerHTML = `
          <div class="status status--error">
            無効なQRコードです。Route227のスタンプQRコードをスキャンしてください。
          </div>
        `;
      }
    }).catch(error => {
      console.error("Failed to stop QR Code scanner:", error);
    });
  }
  
  // Error callback
  function onScanFailure(error) {
    // This is called continuously, so we don't need to do anything here
    // console.error("QR Code scanning failed:", error);
  }
}

// Render articles based on selected category
function renderArticles(category) {
  articlesContainer.innerHTML = '';
  
  const filteredArticles = category === 'all' 
    ? appData.articles 
    : appData.articles.filter(article => article.category === category);
  
  filteredArticles.forEach(article => {
    const articleElement = document.createElement('div');
    articleElement.className = 'card article-card';
    
    const formattedDate = formatDate(article.date);
    
    articleElement.innerHTML = `
      <div class="card__body">
        <span class="article-category">${article.category}</span>
        <h3 class="article-title">${article.title}</h3>
        <div class="article-date">${formattedDate}</div>
        <p class="article-excerpt">${article.excerpt}</p>
      </div>
    `;
    
    articlesContainer.appendChild(articleElement);
  });
}

// Format date to Japanese style
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${year}年${month}月${day}日`;
}

// Close modal
function closeModal(modal) {
  modal.classList.remove('active');
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation tabs
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      const targetSection = link.getAttribute('data-section');
      
      // Update active nav link
      navLinks.forEach(navLink => navLink.classList.remove('active'));
      link.classList.add('active');
      
      // Show target section
      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === targetSection) {
          section.classList.add('active');
        }
      });
    });
  });
  
  // Category tabs
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const category = tab.getAttribute('data-category');
      
      // Update active category tab
      categoryTabs.forEach(categoryTab => categoryTab.classList.remove('active'));
      tab.classList.add('active');
      
      // Render articles for selected category
      renderArticles(category);
    });
  });
  
  // QR Scanner button
  scanQrButton.addEventListener('click', () => {
    qrModal.classList.add('active');
    initQRScanner();
  });
  
  // Close modal buttons
  closeModalButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      closeModal(modal);
    });
  });
  
  // Close notification button
  closeNotificationButton.addEventListener('click', () => {
    closeModal(notificationModal);
  });
  
  // Reward redemption buttons
  coffeeRewardButton.addEventListener('click', () => {
    redeemReward('coffee');
  });
  
  curryRewardButton.addEventListener('click', () => {
    redeemReward('curry');
  });
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
