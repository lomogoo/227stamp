class StampApp {
  constructor() {
    this.currentSection = "227";
    this.stamps227 = parseInt(localStorage.getItem("stamps227") || "0", 10);
    this.stampsFood = parseInt(localStorage.getItem("stampsFood") || "0", 10);
    this.qrCode = "ROUTE227_STAMP_2025"; // 正解のQRコード
    this.scanCanvas = document.createElement("canvas");
    this.scanCanvasCtx = this.scanCanvas.getContext("2d");
    this.isScanning = false;
    this.videoStream = null;

    this.init();
  }

  init() {
    this.setupNavigation();
    this.setupStampDisplay();
    this.setupQRScanner();
    this.setupCategoryFiltering();
  }

  setupNavigation() {
    document.querySelectorAll(".nav-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-tab").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
        btn.classList.add("active");
        const sec = document.getElementById(`section-${btn.dataset.section}`);
        if (sec) sec.classList.add("active");
        this.currentSection = btn.dataset.section;
        this.updateStampDisplay();
      });
    });
  }

  setupStampDisplay() {
    this.updateStampDisplay();
    document.querySelectorAll("#scan-qr-btn").forEach(btn => {
      btn.addEventListener("click", () => this.openQRScanner());
    });
  }

  updateStampDisplay() {
    const count = this.currentSection === "227" ? this.stamps227 : this.stampsFood;
    document.querySelectorAll(`#section-${this.currentSection} #stamp-count`).forEach(el => {
      el.textContent = count;
    });

    document.querySelectorAll(`#section-${this.currentSection} .stamp-hole`).forEach((el, i) => {
      el.classList.toggle("filled", i < count);
    });
  }

  setupCategoryFiltering() {
    const tabs = document.querySelectorAll(".category-tab");
    const articles = document.querySelectorAll(".article-card");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const cat = tab.dataset.category;
        articles.forEach(card => {
          const cardCat = card.dataset.category;
          card.classList.toggle("hidden", cat !== "all" && cat !== cardCat);
        });
      });
    });
  }

  setupQRScanner() {
    const modal = document.getElementById("qr-modal");
    const video = document.getElementById("qr-video");
    const closeBtn = document.getElementById("qr-close-btn");
    const errorDiv = document.getElementById("qr-error");

    closeBtn.addEventListener("click", () => this.closeQRScanner());

    modal.addEventListener("click", e => {
      if (e.target === modal) this.closeQRScanner();
    });
  }

  async openQRScanner() {
    const modal = document.getElementById("qr-modal");
    const video = document.getElementById("qr-video");
    const errorDiv = document.getElementById("qr-error");

    try {
      modal.classList.add("active");
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      this.isScanning = true;
      video.srcObject = this.videoStream;
      video.setAttribute("playsinline", true);
      video.play();
      requestAnimationFrame(() => this.tickQRCode());
    } catch (err) {
      errorDiv.textContent = "カメラにアクセスできません";
    }
  }

  tickQRCode() {
    if (!this.isScanning) return;
    const video = document.getElementById("qr-video");
    const errorDiv = document.getElementById("qr-error");

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      this.scanCanvas.width = video.videoWidth;
      this.scanCanvas.height = video.videoHeight;
      this.scanCanvasCtx.drawImage(video, 0, 0);
      const imageData = this.scanCanvasCtx.getImageData(0, 0, this.scanCanvas.width, this.scanCanvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data === this.qrCode) {
        this.addStamp();
        this.closeQRScanner();
        return;
      } else if (code) {
        errorDiv.textContent = "無効なQRコードです";
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
      this.videoStream.getTracks().forEach(track => track.stop());
    }
    video.srcObject = null;
    document.getElementById("qr-error").textContent = "";
  }

  addStamp() {
    if (this.currentSection === "227") {
      this.stamps227 = Math.min(this.stamps227 + 1, 6);
      localStorage.setItem("stamps227", this.stamps227);
    } else {
      this.stampsFood = Math.min(this.stampsFood + 1, 6);
      localStorage.setItem("stampsFood", this.stampsFood);
    }
    this.updateStampDisplay();
    alert("スタンプが追加されました！");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new StampApp();
});
