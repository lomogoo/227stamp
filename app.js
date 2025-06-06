// app.js

const DEVICE_ID = getOrCreateDeviceId();
let currentTab = "all";
let currentSection = "227";

function getOrCreateDeviceId() {
  const KEY = "deviceId";
  let deviceId = localStorage.getItem(KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(KEY, deviceId);
  }
  return deviceId;
}

// カテゴリ切替
function setupCategoryTabs() {
  const tabs = document.querySelectorAll(".category-tab");
  const cards = document.querySelectorAll(".article-card");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const category = tab.dataset.category;
      currentTab = category;
      cards.forEach(card => {
        if (category === "all" || card.dataset.category === category) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });
    });
  });
}

// セクション切替（下部メニュー）
function setupNavMenu() {
  const navTabs = document.querySelectorAll(".nav-tab");
  navTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.section;
      document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
      document.getElementById(`section-${target}`).classList.add("active");
      currentSection = target;
    });
  });
}

// QRコード読み取り
let isScanning = false;
let videoStream = null;
let scanCanvas = null;
let scanCanvasCtx = null;
const QR_CODE = "ROUTE227_STAMP_2025";

function setupQRScanner() {
  const scanBtn = document.getElementById("scan-qr-btn");
  const closeBtn = document.getElementById("qr-close-btn");
  const modal = document.getElementById("qr-modal");

  scanBtn.addEventListener("click", () => openQRScanner());
  closeBtn.addEventListener("click", () => closeQRScanner());

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeQRScanner();
  });

  scanCanvas = document.createElement("canvas");
  scanCanvasCtx = scanCanvas.getContext("2d");
}

function openQRScanner() {
  const modal = document.getElementById("qr-modal");
  const video = document.getElementById("qr-video");
  const errorDiv = document.getElementById("qr-error");
  modal.classList.add("active");
  errorDiv.textContent = "";

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      videoStream = stream;
      video.srcObject = stream;
      isScanning = true;
      requestAnimationFrame(tickQRCode);
    })
    .catch(err => {
      console.error("カメラアクセスエラー:", err);
      errorDiv.textContent = "カメラにアクセスできません。";
    });
}

function closeQRScanner() {
  const modal = document.getElementById("qr-modal");
  const video = document.getElementById("qr-video");
  modal.classList.remove("active");
  isScanning = false;
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
}

function tickQRCode() {
  if (!isScanning) return;
  const video = document.getElementById("qr-video");
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    scanCanvas.width = video.videoWidth;
    scanCanvas.height = video.videoHeight;
    scanCanvasCtx.drawImage(video, 0, 0);
    const imageData = scanCanvasCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.data === QR_CODE) {
      addStamp();
      closeQRScanner();
      return;
    }
  }
  requestAnimationFrame(tickQRCode);
}

// スタンプの管理
function addStamp() {
  let current = parseInt(localStorage.getItem("currentStamps") || "0", 10);
  current = (current + 1) % 6;
  localStorage.setItem("currentStamps", current);
  updateStampDisplay();
}

function updateStampDisplay() {
  const count = parseInt(localStorage.getItem("currentStamps") || "0", 10);
  document.getElementById("stamp-count").textContent = count;
  document.querySelectorAll(".stamp-hole").forEach((el, i) => {
    el.classList.toggle("filled", i < count);
  });
}

// 起動処理
window.addEventListener("DOMContentLoaded", () => {
  setupCategoryTabs();
  setupNavMenu();
  setupQRScanner();
  updateStampDisplay();
});
