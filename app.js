// app.js (type="module")

/* ===========================================
   1) Firebase SDK の読み込み
   =========================================== */
// （1）Firebase App と Firestore を CDN 経由でインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// （2）Firebase の設定情報
const firebaseConfig = {
  apiKey: "AIzaSyDTx4xQfVYQpEBLYKs-yc-9QfZj5Xhq-4M",
  authDomain: "stamp-b905f.firebaseapp.com",
  projectId: "stamp-b905f",
  storageBucket: "stamp-b905f.appspot.com",
  messagingSenderId: "938526053758",
  appId: "1:938526053758:web:e2b91c39677fd70e43cf2f",
  measurementId: "G-KMLVMMXMQE"
};

// （3）Firebase 初期化および Firestore インスタンス取得
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ===========================================
   2) 端末ID を localStorage で管理
   =========================================== */
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

// Firestore 上のドキュメントパスを返す関数
function userDocRef() {
  return doc(db, "users", `device_${DEVICE_ID}`);
}

/* ===========================================
   3) メインアプリクラス
   =========================================== */
class Route227App {
  constructor() {
    this.currentSection = "227";

    // localStorage にキャッシュしておく
    this.totalStamps   = parseInt(localStorage.getItem("totalStamps")   || "0", 10);
    this.currentStamps = parseInt(localStorage.getItem("currentStamps") || "0", 10);
    this.usedCount     = parseInt(localStorage.getItem("usedCount")     || "0", 10);

    this.profile = { gender: "", age: "", job: "", region: "" };

    // QR コード文字列
    this.qrCode = "ROUTE227_STAMP_2025";
    this.isScanning = false;
    this.videoStream = null;
    this.scanCanvas = null;
    this.scanCanvasCtx = null;

    this.init();
  }

  init() {
    // 1) パーティクル背景
    this.createParticles();
    // 2) ナビゲーション切り替え
    this.setupNavigation();
    // 3) QR スキャナー
    this.setupQRScanner();
    // 4) 記事カードのクリックイベント
    this.setupArticleCards();
    // 5) カテゴリフィルタ
    this.setupCategoryFiltering();
    // 6) 検索インターフェース
    this.setupSearchInterface();
    // 7) Firestore からユーザー情報取得 ＆ 初回チェック
    this.checkUserProfileAndInitialize();
  }

  /* ===========================================
     3-1) Firestore からユーザー情報を取得
           ────────────────────────────
     - 存在しなければ “新規ユーザー” としてモーダルを表示
     - 存在すれば currentStamps, totalStamps, usedCount, プロフィールをセット
  =========================================== */
  async checkUserProfileAndInitialize() {
    try {
      const ref = userDocRef();
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        // Firestore にまだドキュメントがない → 新規ユーザー扱い
        this.showProfileModal();
      } else {
        // 既存ユーザー
        const data = snapshot.data();
        this.profile = {
          gender: data.gender || "",
          age:    data.age    || "",
          job:    data.job    || "",
          region: data.region || ""
        };
        this.currentStamps = data.currentStamps  || 0;
        this.totalStamps   = data.totalStamps    || 0;
        this.usedCount     = data.usedCount      || 0;

        // localStorage にバックアップしておく
        localStorage.setItem("currentStamps", this.currentStamps);
        localStorage.setItem("totalStamps",   this.totalStamps);
        localStorage.setItem("usedCount",     this.usedCount);

        // 画面に反映
        this.updateStampDisplay();
        this.updateRewardButtons();
      }
    } catch (err) {
      console.error("Firestore からの取得エラー:", err);
      // エラー時はモーダルを強制表示してプロフィール登録させる
      this.showProfileModal();
    }
  }

  /* ===========================================
     3-2) プロフィール入力モーダルを表示 → 入力後 Firestore に保存
  =========================================== */
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

      // Firestore にドキュメントを新規作成
      try {
        const ref = userDocRef();
        await setDoc(ref, {
          currentStamps: 0,
          totalStamps:   0,
          usedCount:     0,
          gender: gender,
          age:    age,
          job:    job,
          region: region,
          createdAt: serverTimestamp()
        });

        // プロフィールとスタンプ数をローカル変数・localStorage にセット
        this.profile = { gender, age, job, region };
        this.currentStamps = 0;
        this.totalStamps   = 0;
        this.usedCount     = 0;
        localStorage.setItem("currentStamps", this.currentStamps);
        localStorage.setItem("totalStamps",   this.totalStamps);
        localStorage.setItem("usedCount",     this.usedCount);

        // モーダルを閉じて画面に反映
        modal.style.display = "none";
        this.updateStampDisplay();
        this.updateRewardButtons();
      } catch (err) {
        console.error("Firestore への登録エラー:", err);
        alert("プロフィール登録に失敗しました。もう一度お試しください。");
      }
    });
  }

  /* ===========================================
     3-3) スタンプ情報を Firestore に更新する
           ────────────────────────────
     - QR コードスキャン成功時に呼び出し
     - Firestore 上のドキュメントを updateDoc
  =========================================== */
  async updateStampDataToFirestore(newCurrent, newTotal, newUsed) {
    try {
      const ref = userDocRef();
      await updateDoc(ref, {
        currentStamps: newCurrent,
        totalStamps:   newTotal,
        usedCount:     newUsed,
        updatedAt: serverTimestamp()
      });
      console.log("Firestore 更新完了:", { currentStamps: newCurrent, totalStamps: newTotal, usedCount: newUsed });
    } catch (err) {
      console.error("Firestore 更新エラー:", err);
    }
  }

  /* ===========================================
     以下は、もともとあったままのコード
     パーティクル背景、QR読み取りなど
  =========================================== */
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
    // カンバスを動的に作成
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
    // localStorage から currentStamps を +1
    let curr = parseInt(localStorage.getItem("currentStamps") || "0", 10);
    curr += 1;

    // 6個たまったら usedCount +1, curr=0 に戻す
    if (curr >= 6) {
      curr = 0;
      this.usedCount = parseInt(localStorage.getItem("usedCount") || "0", 10) + 1;
      localStorage.setItem("usedCount", this.usedCount);
    }
    localStorage.setItem("currentStamps", curr.toString());
    this.currentStamps = curr;

    // totalStamps を +1
    this.totalStamps = parseInt(localStorage.getItem("totalStamps") || "0", 10) + 1;
    localStorage.setItem("totalStamps", this.totalStamps.toString());

    // 画面反映
    this.updateStampDisplay();
    this.updateRewardButtons();

    // 成功アニメーション
    const hole = document.querySelector(`[data-index="${this.currentStamps - 1}"]`);
    if (hole) {
      hole.classList.add("filled", "stamp-success");
      setTimeout(() => hole.classList.remove("stamp-success"), 600);
    }
    this.showSuccessMessage();

    // Firestore に更新を送る
    this.updateStampDataToFirestore(this.currentStamps, this.totalStamps, this.usedCount);
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
      this.usedCount     = parseInt(localStorage.getItem("usedCount") || "0", 10) + 1;
      localStorage.setItem("usedCount", this.usedCount.toString());
      this.updateStampDisplay();
      this.updateRewardButtons();
      alert(`おめでとうございます！報酬と交換しました。残りスタンプ数: ${this.currentStamps}`);
      this.updateStampDataToFirestore(this.currentStamps, this.totalStamps, this.usedCount);
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

/* ===========================================
   4) DOM 準備が終わってから Route227App を起動
=========================================== */
document.addEventListener("DOMContentLoaded", () => {
  window.route227App = new Route227App();
});