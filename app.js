// app.js

/**
 * ───── 1) 端末ID を localStorageで管理 ─────
 *    - 初回アクセス時に randomUUID() で生成して localStorage に保存
 *    - 2回目以降は同じ ID を使う
 */
function getOrCreateDeviceId() {
  const KEY = "deviceId";
  let deviceId = localStorage.getItem(KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID(); // モダンブラウザならこれで UUID 生成可能
    localStorage.setItem(KEY, deviceId);
  }
  return deviceId;
}
const DEVICE_ID = getOrCreateDeviceId();

/**
 * ───── 2) GAS の Web アプリ URL ─────
 *    - 先ほどデプロイした「StampAPI v2」のウェブアプリ URL を貼り付けてください
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxULiEhYE0JZqQ5p-Tz6lR_XiCSO-4EnoHy56OolO4fzDTEfElw620DZKyfH7mQpUyEhA/exec";

class Route227App {
  constructor() {
    // 画面切り替え用
    this.currentSection = "227";

    // スタンプ管理
    // totalStamps：累計（何回カード押したか）
    // currentStamps：今カード上に残っているスタンプ個数（0～5→6で「特典交換」扱い→0に戻る）
    // usedCount：特典を交換した回数
    this.totalStamps = parseInt(localStorage.getItem("totalStamps") || "0", 10);
    this.currentStamps = parseInt(localStorage.getItem("currentStamps") || "0", 10);
    this.usedCount = parseInt(localStorage.getItem("usedCount") || "0", 10);

    // プロファイル情報
    this.profile = { gender: "", age: "", job: "", region: "" };

    // QR読み取り用
    this.qrCode = "ROUTE227_STAMP_2025"; // 期待する文字列
    this.isScanning = false;
    this.videoStream = null;
    this.scanCanvas = null;
    this.scanCanvasCtx = null;

    this.init();
  }

  init() {
    // 1) パーティクル背景
    this.createParticles();

    // 2) ナビゲーション
    this.setupNavigation();

    // 3) QRスキャナーまわり
    this.setupQRScanner();

    // 4) 記事カード
    this.setupArticleCards();

    // 5) カテゴリフィルタリング
    this.setupCategoryFiltering();

    // 6) 検索インターフェース
    this.setupSearchInterface();

    // 7) プロフィールとスタンプ管理のフローを開始
    this.checkUserProfileAndInitialize();
  }

  // ─────────────────────────────────────────────
  // 3-1) ユーザーがすでに「プロファイル登録済み」かを判定し、
  //      必要なら入力フォームを表示、終わったらスタンプデータを取得して表示
  async checkUserProfileAndInitialize() {
    try {
      const noCacheUrl = API_URL + "?id=" + encodeURIComponent(DEVICE_ID) + "&t=" + Date.now();
      const response = await fetch(noCacheUrl, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error("ネットワークエラー(" + response.status + ")");
      const result = await response.json();
      // result は { newUser: boolean, data: {...} } のはず
      if (result.newUser === true) {
        // 初回アクセス（プロファイル未登録）→ 入力フォームを表示
        this.showProfileModal();
      } else {
        // 既存ユーザー → result.data に プロファイルとスタンプ情報がある
        this.profile = {
          gender: result.data.gender,
          age: result.data.age,
          job: result.data.job,
          region: result.data.region
        };
        this.currentStamps = result.data.currentStamps;
        this.totalStamps = result.data.totalStamps;
        this.usedCount = result.data.usedCount;
        // 画面上にスタンプ数を反映
        this.updateStampDisplay();
        this.updateRewardButtons();
      }
    } catch (err) {
      console.error("ユーザーデータ取得エラー:", err);
      // エラー時はとりあえずスタンプを 0 にして表示しておく
      this.currentStamps = 0;
      this.totalStamps = 0;
      this.usedCount = 0;
      this.updateStampDisplay();
      this.updateRewardButtons();
    }
  }

  // ─────────────────────────────────────────────
  // 3-2) プロフィール入力モーダルを表示し、登録完了で API に送信
  showProfileModal() {
    const modal = document.getElementById("profile-modal");
    modal.style.display = "flex"; // モーダルを画面に表示

    const form = document.getElementById("profile-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); // デフォルトの submit（ページ遷移）をキャンセル

      // 各 select 要素から選択値を取得
      const gender = document.getElementById("gender-select").value;
      const age    = document.getElementById("age-select").value;
      const job    = document.getElementById("job-select").value;
      const region = document.getElementById("region-select").value;

      // すべて埋まっているかを念のためチェック
      if (!gender || !age || !job || !region) {
        alert("すべての項目を選択してください。");
        return;
      }

      // 4) スタンプ情報は初期値 (0,0,0)
      const payload = {
        id: DEVICE_ID,
        currentStamps: 0,
        totalStamps: 0,
        usedCount: 0,
        gender: gender,
        age: age,
        job: job,
        region: region
      };

      try {
        // 5) POST してスプレッドシートにプロファイル＋スタンプ初期値を登録
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store"
        });
        if (!response.ok) throw new Error("POST エラー(" + response.status + ")");
        const result = await response.json();
        // result.newUser は false、result.data に登録後の値が来る
        this.profile = {
          gender: result.data.gender,
          age: result.data.age,
          job: result.data.job,
          region: result.data.region
        };
        this.currentStamps = result.data.currentStamps; // 0
        this.totalStamps   = result.data.totalStamps;   // 0
        this.usedCount     = result.data.usedCount;     // 0

        // 6) モーダルを閉じて、スタンプ表示を更新
        modal.style.display = "none";
        this.updateStampDisplay();
        this.updateRewardButtons();
      } catch (err) {
        console.error("プロフィール登録エラー:", err);
        alert("プロフィール登録に失敗しました。もう一度お試しください。");
      }
    });
  }

  // ─────────────────────────────────────────────
  // 3-3) スタンプ情報を更新する関数（QRコード成功時に呼び出す）
  async updateStampDataToSheet(newCurrent, newTotal, newUsed) {
    const payload = {
      id: DEVICE_ID,
      currentStamps: newCurrent,
      totalStamps: newTotal,
      usedCount: newUsed,
      gender: this.profile.gender,
      age: this.profile.age,
      job: this.profile.job,
      region: this.profile.region
    };
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store"
      });
      if (!response.ok) throw new Error("POST エラー: " + response.status);
      const result = await response.json();
      console.log("スタンプ更新後のデータ:", result);
    } catch (err) {
      console.error("スタンプ更新エラー:", err);
    }
  }

  // ─────────────────────────────────────────────
  // パーティクル背景を作成
  createParticles() {
    const particlesContainer = document.getElementById("particles");
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      particle.className = "particle";

      const size = Math.random() * 8 + 2;
      const x = Math.random() * 100;
      const y = Math.random() * 100;
      const duration = Math.random() * 4 + 4;
      const delay = Math.random() * 2;

      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${x}%`;
      particle.style.top = `${y}%`;
      particle.style.animationDuration = `${duration}s`;
      particle.style.animationDelay = `${delay}s`;

      particlesContainer.appendChild(particle);
    }
  }

  // ─────────────────────────────────────────────
  // ナビゲーション設定（タブ切り替え）
  setupNavigation() {
    const navTabs = document.querySelectorAll(".nav-tab");
    navTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const section = tab.dataset.section;
        this.switchSection(section);
      });
    });
  }

  switchSection(sectionName) {
    document.querySelectorAll(".content-section").forEach((section) => {
      section.classList.remove("active");
    });
    const targetSection = document.getElementById(`section-${sectionName}`);
    if (targetSection) {
      targetSection.classList.add("active");
    }
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    const activeTab = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeTab) {
      activeTab.classList.add("active");
    }
    this.currentSection = sectionName;
  }

  // ─────────────────────────────────────────────
  // QRスキャナー設定 & canvas 準備
  setupQRScanner() {
    const scanBtn = document.getElementById("scan-qr-btn");
    const closeBtn = document.getElementById("qr-close-btn");
    const modal = document.getElementById("qr-modal");

    scanBtn.addEventListener("click", () => {
      this.openQRScanner();
    });
    closeBtn.addEventListener("click", () => {
      this.closeQRScanner();
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.closeQRScanner();
    });

    // QR読み取り用の canvas を動的に作成
    this.scanCanvas = document.createElement("canvas");
    this.scanCanvasCtx = this.scanCanvas.getContext("2d");
  }

  // QRスキャナーを開く
  async openQRScanner() {
    const modal = document.getElementById("qr-modal");
    const video = document.getElementById("qr-video");
    const errorDiv = document.getElementById("qr-error");

    try {
      modal.classList.add("active");
      errorDiv.textContent = "";

      // isScanning を true にしてスキャンループを進行させる
      this.isScanning = true;

      // カメラストリームを取得
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      video.srcObject = this.videoStream;

      // QRコード読み取りループ開始
      requestAnimationFrame(() => this.tickQRCode());
    } catch (error) {
      console.error("カメラアクセスエラー:", error);
      errorDiv.textContent = "カメラにアクセスできません。ブラウザの設定を確認してください。";
    }
  }

  // QRコードを連続スキャンするループ
  tickQRCode() {
    if (!this.isScanning) return;

    const video = document.getElementById("qr-video");
    const errorDiv = document.getElementById("qr-error");

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // canvas を動画サイズに合わせる
      this.scanCanvas.width = video.videoWidth;
      this.scanCanvas.height = video.videoHeight;
      this.scanCanvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      // 画像データを取得して jsQR に渡す
      const imageData = this.scanCanvasCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        // デコード成功
        if (code.data === this.qrCode) {
          // 期待する QR コード文字列と一致 → スタンプ付与処理
          this.addStamp();
          this.closeQRScanner();
          return;
        } else {
          // 一致しない場合はエラー文言を表示してループ継続
          errorDiv.textContent = "無効な QR コードです。正しい Route227 の QR をかざしてください。";
        }
      }
    }

    // 次のフレームでもう一度チェック
    requestAnimationFrame(() => this.tickQRCode());
  }

  // QRスキャナーを閉じる
  closeQRScanner() {
    const modal = document.getElementById("qr-modal");
    const video = document.getElementById("qr-video");

    this.isScanning = false;
    modal.classList.remove("active");

    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      this.videoStream = null;
    }
    video.srcObject = null;

    // エラーメッセージクリア
    const errorDiv = document.getElementById("qr-error");
    if (errorDiv) errorDiv.textContent = "";
  }

  // ─────────────────────────────────────────────
  // スタンプを追加するメソッド（＋ローカル保存・シート送信）
  addStamp() {
    // 1) localStorage 上の currentStamps を +1 して更新
    let curr = parseInt(localStorage.getItem("currentStamps") || "0", 10);
    curr += 1;

    // 2) currentStamps が 6 になったら「特典交換」扱いで 0 に戻す
    if (curr >= 6) {
      curr = 0;
      this.usedCount = parseInt(localStorage.getItem("usedCount") || "0", 10) + 1;
      localStorage.setItem("usedCount", this.usedCount);
    }
    localStorage.setItem("currentStamps", curr.toString());
    this.currentStamps = curr;

    // 3) 累計スタンプ totalStamps を +1 して更新
    this.totalStamps = parseInt(localStorage.getItem("totalStamps") || "0", 10) + 1;
    localStorage.setItem("totalStamps", this.totalStamps.toString());

    // 4) 画面表示を更新
    this.updateStampDisplay();
    this.updateRewardButtons();

    // 5) 成功アニメーション
    const stampHole = document.querySelector(`[data-index="${this.currentStamps - 1}"]`);
    if (stampHole) {
      stampHole.classList.add("filled", "stamp-success");
      setTimeout(() => {
        stampHole.classList.remove("stamp-success");
      }, 600);
    }
    this.showSuccessMessage();

    // 6) シートに更新を送る
    this.updateStampDataToSheet(this.currentStamps, this.totalStamps, this.usedCount);
  }

  // ─────────────────────────────────────────────
  // 画面上のスタンプ表示を更新
  updateStampDisplay() {
    const countElement = document.getElementById("stamp-count");
    if (countElement) {
      countElement.textContent = this.currentStamps;
    }
    const stampHoles = document.querySelectorAll(".stamp-hole");
    stampHoles.forEach((hole, index) => {
      if (index < this.currentStamps) {
        hole.classList.add("filled");
      } else {
        hole.classList.remove("filled");
      }
    });
  }

  // ─────────────────────────────────────────────
  // 報酬（特典交換）ボタンの状態を更新
  updateRewardButtons() {
    const rewardCards = document.querySelectorAll(".reward-card");
    rewardCards.forEach((card) => {
      const requiredPoints = parseInt(card.dataset.points, 10);
      const claimBtn = card.querySelector(".reward-claim-btn");

      if (this.currentStamps >= requiredPoints) {
        card.classList.add("available");
        claimBtn.classList.add("enabled");
        claimBtn.disabled = false;
        claimBtn.textContent = "交換する";
        claimBtn.onclick = () => this.claimReward(requiredPoints);
      } else {
        card.classList.remove("available");
        claimBtn.classList.remove("enabled");
        claimBtn.disabled = true;
        claimBtn.textContent = "交換する";
        claimBtn.onclick = null;
      }
    });
  }

  // ─────────────────────────────────────────────
  // 特典を交換するメソッド（スタンプを消費し、usedCount を +1）
  claimReward(requiredPoints) {
    if (this.currentStamps >= requiredPoints) {
      // currentStamps を減算
      this.currentStamps -= requiredPoints;
      localStorage.setItem("currentStamps", this.currentStamps.toString());

      // 報酬交換回数（usedCount）を +1
      this.usedCount = parseInt(localStorage.getItem("usedCount") || "0", 10) + 1;
      localStorage.setItem("usedCount", this.usedCount.toString());

      // 画面更新
      this.updateStampDisplay();
      this.updateRewardButtons();

      // 成功アラート
      alert(`おめでとうございます！報酬と交換しました。残りスタンプ数: ${this.currentStamps}`);

      // シートにも交換情報を送信
      this.updateStampDataToSheet(this.currentStamps, this.totalStamps, this.usedCount);
    }
  }

  // ─────────────────────────────────────────────
  // 成功メッセージを一時表示
  showSuccessMessage() {
    const message = document.createElement("div");
    message.textContent = `スタンプ獲得！ (${this.currentStamps}/6)`;
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #4CAF50;
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      font-size: 18px;
      font-weight: bold;
      z-index: 3000;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: fadeInOut 2s ease;
    `;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20%, 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(message);
    setTimeout(() => {
      document.body.removeChild(message);
      document.head.removeChild(style);
    }, 2000);
  }

  // ─────────────────────────────────────────────
  // 記事カードをクリックで別タブに飛ばす
  setupArticleCards() {
    const articleCards = document.querySelectorAll(".article-card");
    articleCards.forEach((card) => {
      card.addEventListener("click", () => {
        const url = card.dataset.url;
        if (url) window.open(url, "_blank");
      });
    });
  }

  // ─────────────────────────────────────────────
  // カテゴリフィルタリング設定
  setupCategoryFiltering() {
    const tabs = document.querySelectorAll(".category-tab");
    const articles = document.querySelectorAll(".article-card");

    tabs.forEach((tab) => {
      const handler = () => {
        // タブのアクティブ切り替え
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // 選択カテゴリで記事を表示/非表示
        const selected = tab.dataset.category;
        articles.forEach((article) => {
          const cat = article.dataset.category;
          if (selected === "all" || cat === selected) {
            article.classList.remove("hidden");
          } else {
            article.classList.add("hidden");
          }
        });
      };
      tab.addEventListener("click", handler);
      tab.addEventListener("touchend", handler);
    });
  }

  // ─────────────────────────────────────────────
  // 検索インターフェース設定
  setupSearchInterface() {
    const searchInput = document.getElementById("search-input");
    const searchBtn = document.getElementById("search-btn");
    const searchTags = document.querySelectorAll(".search-tag");

    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        this.performSearch(searchInput.value);
      });
    }
    if (searchInput) {
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.performSearch(searchInput.value);
      });
    }
    searchTags.forEach((tag) => {
      tag.addEventListener("click", () => {
        searchInput.value = tag.textContent;
        this.performSearch(tag.textContent);
      });
    });
  }

  performSearch(query) {
    if (query.trim()) {
      alert(`「${query}」で検索しました。\n\n※この機能はデモ版です。実際の検索は未実装`);
    }
  }
}

// ─────────────────────────────────────────────
// アプリケーション初期化
// （DOMContentLoaded を待ってから new Route227App() を呼ぶ）
document.addEventListener("DOMContentLoaded", () => {
  window.route227App = new Route227App();
});

// PWA 対応のためのサービスワーカー登録（現時点では未使用）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // navigator.serviceWorker.register('/sw.js')
    //   .then(reg => console.log('SW registered'))
    //   .catch(err => console.log('SW registration failed'));
  });
}
