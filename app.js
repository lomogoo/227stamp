/**
 * ───── 1) 端末ID を localStorage で管理 ─────
 *    - 初回アクセス時に randomUUID() で生成して localStorage に保存
 *    - 2回目以降は同じ ID を使う
 */
function getOrCreateDeviceId() {
  const KEY = "deviceId";
  let deviceId = localStorage.getItem(KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(KEY, deviceId);
  }
  return deviceId;
}
const DEVICE_ID = getOrCreateDeviceId();

/**
 * ───── 2) GAS の Web アプリ URL ─────
 *    - デプロイ済みのウェブアプリ URL を貼り付けてください
 */
const API_URL = "https://script.google.com/macros/s/AKfycbwECGkHxVUwvgxd4rpUtSSwtV-dpco0NannYvpEKXunV1okJXeVyctbxUppyQp_rDxq/exec";

class Route227App {
  constructor() {
    this.currentSection = "227";

    // ローカルにも念のためキャッシュしておく
    this.totalStamps   = parseInt(localStorage.getItem("totalStamps")   || "0", 10);
    this.currentStamps = parseInt(localStorage.getItem("currentStamps") || "0", 10);
    this.usedCount     = parseInt(localStorage.getItem("usedCount")     || "0", 10);

    this.profile = { gender: "", age: "", job: "", region: "" };

    // QR スキャン用
    this.qrCode = "ROUTE227_STAMP_2025";
    this.isScanning = false;
    this.videoStream = null;
    this.scanCanvas = null;
    this.scanCanvasCtx = null;

    this.init();
  }

  init() {
    this.createParticles();
    this.setupNavigation();
    this.setupQRScanner();
    this.setupArticleCards();
    this.setupCategoryFiltering();
    this.setupSearchInterface();
    this.checkUserProfileAndInitialize();
  }

  // ─────────────────────────────────────────────
  // 3-1) プロフィール登録済みかどうかをサーバーから取得し、
  //      新規ユーザーなら最初にモーダルを出す
  async checkUserProfileAndInitialize() {
    try {
      // キャッシュ回避のために適当な timestamp を追加
      const noCacheUrl = `${API_URL}?id=${encodeURIComponent(DEVICE_ID)}&t=${Date.now()}`;
      const res = await fetch(noCacheUrl, { method: "GET" });
      if (!res.ok) throw new Error("ネットワークエラー: " + res.status);
      const json = await res.json();
      if (json.newUser) {
        // プロフィール未登録 → モーダルを出す
        this.showProfileModal();
      } else {
        // 既存ユーザー → データを読み込んで画面に反映
        const d = json.data;
        this.profile = {
          gender: d.gender,
          age:    d.age,
          job:    d.job,
          region: d.region
        };
        this.currentStamps = d.currentStamps;
        this.totalStamps   = d.totalStamps;
        this.usedCount     = d.usedCount;
        this.updateStampDisplay();
        this.updateRewardButtons();
      }
    } catch (err) {
      console.error("ユーザーデータ取得エラー:", err);
      // エラー時はとりあえず空の状態で表示しておく
      this.currentStamps = 0;
      this.totalStamps   = 0;
      this.usedCount     = 0;
      this.updateStampDisplay();
      this.updateRewardButtons();
      // 必要ならモーダルを強制表示してもいい
      this.showProfileModal();
    }
  }

  // ─────────────────────────────────────────────
  // 3-2) プロフィール入力モーダルを表示し、完了後に GET で登録する
  showProfileModal() {
    const modal = document.getElementById("profile-modal");
    modal.style.display = "flex";

    const form = document.getElementById("profile-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const gender = document.getElementById("gender-select").value;
      const age    = document.getElementById("age-select").value;
      const job    = document.getElementById("job-select").value;
      const region = document.getElementById("region-select").value;

      if (!gender || !age || !job || !region) {
        alert("すべての項目を選択してください。");
        return;
      }

      // GET のクエリパラメータにすべて詰め込む
      const params = new URLSearchParams({
        id: DEVICE_ID,
        currentStamps: "0",
        totalStamps: "0",
        usedCount: "0",
        gender: gender,
        age:    age,
        job:    job,
        region: region,
        t: String(Date.now()) // キャッシュ回避
      });
      const url = `${API_URL}?${params.toString()}`;

      try {
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error("ネットワークエラー: " + res.status);
        const json = await res.json();
        // 登録に成功したら modal を閉じ、スタンプ表示を更新
        this.profile = { gender, age, job, region };
        this.currentStamps = 0;
        this.totalStamps   = 0;
        this.usedCount     = 0;
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
  // 3-3) スタンプ情報をサーバーに GET で送信する（QRコード成功時に呼び出す）
  async updateStampDataToSheet(newCurrent, newTotal, newUsed) {
    const p = new URLSearchParams({
      id: DEVICE_ID,
      currentStamps: String(newCurrent),
      totalStamps:   String(newTotal),
      usedCount:     String(newUsed),
      gender: this.profile.gender,
      age:    this.profile.age,
      job:    this.profile.job,
      region: this.profile.region,
      t: String(Date.now())
    });
    const url = `${API_URL}?${p.toString()}`;
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error("ネットワークエラー: " + res.status);
      const json = await res.json();
      console.log("シート更新結果:", json);
    } catch (err) {
      console.error("スタンプ更新エラー:", err);
    }
  }

  // ─────────────────────────────────────────────
  // 以下、省略せずに既存コードをそのまま – パーティクル背景など
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
    const target = document.getElementById(`section-${sectionName}`);
    if (target) target.classList.add("active");
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    const activeTab = document.querySelector(`[data-section="${sectionName}"]`);
    if (activeTab) activeTab.classList.add("active");
    this.currentSection = sectionName;
  }

  setupQRScanner() {
    const scanBtn = document.getElementById("scan-qr-btn");
    const closeBtn = document.getElementById("qr-close-btn");
    const modal = document.getElementById("qr-modal");
    scanBtn.addEventListener("click", () => this.openQRScanner());
    closeBtn.addEventListener("click", () => this.closeQRScanner());
    modal.addEventListener("click", (e) => {
      if (e.target === modal) this.closeQRScanner();
    });
    this.scanCanvas = document.createElement("canvas");
    this.scanCanvasCtx = this.scanCanvas.getContext("2d");
  }

  async openQRScanner() {
    const modal = document.getElementById("qr-modal");
    const video = document.getElementById("qr-video");
    const errorDiv = document.getElementById("qr-error");
    try {
      modal.classList.add("active");
      errorDiv.textContent = "";
      this.isScanning = true;
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = this.videoStream;
      requestAnimationFrame(() => this.tickQRCode());
    } catch (error) {
      console.error("カメラアクセスエラー:", error);
      errorDiv.textContent = "カメラにアクセスできません。設定を確認してください。";
    }
  }

  tickQRCode() {
    if (!this.isScanning) return;
    const video = document.getElementById("qr-video");
    const errorDiv = document.getElementById("qr-error");
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      this.scanCanvas.width = video.videoWidth;
      this.scanCanvas.height = video.videoHeight;
      this.scanCanvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const imageData = this.scanCanvasCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        if (code.data === this.qrCode) {
          this.addStamp();
          this.closeQRScanner();
          return;
        } else {
          errorDiv.textContent = "無効なQRコードです。正しい Route227 のQRをかざしてください。";
        }
      }
    }
    requestAnimationFrame(() => this.tickQRCode());
  }

  closeQRScanner() {
    const modal = document.getElementById("qr-modal");
    const video = document.getElementById("qr-video");
    this.isScanning = false;
    modal.classList.remove("active");
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((t) => t.stop());
      this.videoStream = null;
    }
    video.srcObject = null;
    const errorDiv = document.getElementById("qr-error");
    if (errorDiv) errorDiv.textContent = "";
  }

  addStamp() {
    let curr = parseInt(localStorage.getItem("currentStamps") || "0", 10);
    curr += 1;
    if (curr >= 6) {
      curr = 0;
      this.usedCount = parseInt(localStorage.getItem("usedCount") || "0", 10) + 1;
      localStorage.setItem("usedCount", this.usedCount);
    }
    localStorage.setItem("currentStamps", curr.toString());
    this.currentStamps = curr;
    this.totalStamps = parseInt(localStorage.getItem("totalStamps") || "0", 10) + 1;
    localStorage.setItem("totalStamps", this.totalStamps.toString());
    this.updateStampDisplay();
    this.updateRewardButtons();
    const hole = document.querySelector(`[data-index="${this.currentStamps - 1}"]`);
    if (hole) {
      hole.classList.add("filled", "stamp-success");
      setTimeout(() => hole.classList.remove("stamp-success"), 600);
    }
    this.showSuccessMessage();
    this.updateStampDataToSheet(this.currentStamps, this.totalStamps, this.usedCount);
  }

  updateStampDisplay() {
    const countEl = document.getElementById("stamp-count");
    if (countEl) countEl.textContent = this.currentStamps;
    document.querySelectorAll(".stamp-hole").forEach((hole, idx) => {
      if (idx < this.currentStamps) hole.classList.add("filled");
      else hole.classList.remove("filled");
    });
  }

  updateRewardButtons() {
    document.querySelectorAll(".reward-card").forEach((card) => {
      const pts = parseInt(card.dataset.points, 10);
      const btn = card.querySelector(".reward-claim-btn");
      if (this.currentStamps >= pts) {
        card.classList.add("available");
        btn.classList.add("enabled");
        btn.disabled = false;
        btn.onclick = () => this.claimReward(pts);
      } else {
        card.classList.remove("available");
        btn.classList.remove("enabled");
        btn.disabled = true;
        btn.onclick = null;
      }
    });
  }

  claimReward(pts) {
    if (this.currentStamps >= pts) {
      this.currentStamps -= pts;
      localStorage.setItem("currentStamps", this.currentStamps.toString());
      this.usedCount = parseInt(localStorage.getItem("usedCount") || "0", 10) + 1;
      localStorage.setItem("usedCount", this.usedCount.toString());
      this.updateStampDisplay();
      this.updateRewardButtons();
      alert(`おめでとうございます！報酬と交換しました。残りスタンプ数: ${this.currentStamps}`);
      this.updateStampDataToSheet(this.currentStamps, this.totalStamps, this.usedCount);
    }
  }

  showSuccessMessage() {
    const msg = document.createElement("div");
    msg.textContent = `スタンプ獲得！ (${this.currentStamps}/6)`;
    msg.style.cssText = `
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
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      animation: fadeInOut 2s ease;
    `;
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20%, 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `;
    document.head.appendChild(styleEl);
    document.body.appendChild(msg);
    setTimeout(() => {
      document.body.removeChild(msg);
      document.head.removeChild(styleEl);
    }, 2000);
  }

  setupArticleCards() {
    document.querySelectorAll(".article-card").forEach((card) => {
      card.addEventListener("click", () => {
        const url = card.dataset.url;
        if (url) window.open(url, "_blank");
      });
    });
  }

  setupCategoryFiltering() {
    const tabs = document.querySelectorAll(".category-tab");
    const articles = document.querySelectorAll(".article-card");
    tabs.forEach((tab) => {
      const handler = () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const sel = tab.dataset.category;
        articles.forEach((art) => {
          const cat = art.dataset.category;
          if (sel === "all" || cat === sel) art.classList.remove("hidden");
          else art.classList.add("hidden");
        });
      };
      tab.addEventListener("click", handler);
      tab.addEventListener("touchend", handler);
    });
  }

  setupSearchInterface() {
    const input = document.getElementById("search-input");
    const btn = document.getElementById("search-btn");
    const tags = document.querySelectorAll(".search-tag");
    if (btn) {
      btn.addEventListener("click", () => this.performSearch(input.value));
    }
    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") this.performSearch(input.value);
      });
    }
    tags.forEach((tag) => {
      tag.addEventListener("click", () => {
        input.value = tag.textContent;
        this.performSearch(tag.textContent);
      });
    });
  }

  performSearch(query) {
    if (query.trim()) {
      alert(`「${query}」で検索しました。\n\n※この機能はデモ版です。`);
    }
  }
}


// ─────────────────────────────────────────────
// DOM 準備が終わってからアプリを起動
document.addEventListener("DOMContentLoaded", () => {
  window.route227App = new Route227App();
});

// サービスワーカー関係（未使用）
// if ("serviceWorker" in navigator) {
//   window.addEventListener("load", () => {
//     navigator.serviceWorker.register('/sw.js')
//       .then(reg => console.log('SW registered'))
//       .catch(err => console.log('SW registration failed'));
//   });
// }
