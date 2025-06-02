// Route227 Cafe スタンプカードアプリ

class Route227App {
    constructor() {
        this.currentSection = '227';
        this.stampCount = 0;
        this.maxStamps = 6;
        this.qrCode = 'ROUTE227_STAMP_2025'; // 期待する QR データ
        this.isScanning = false;
        this.videoStream = null;
        this.scanCanvas = null;       // 追加：QR の読み取り用に使う canvas
        this.scanCanvasCtx = null;    // 追加：canvas のコンテキスト
        
        this.init();
    }
    
    init() {
        this.createParticles();
        this.setupNavigation();
        this.setupQRScanner();
        this.setupArticleCards();
        this.setupSearchInterface();
        this.updateStampDisplay();
        this.updateRewardButtons();
    }
    
    // パーティクル背景の作成
    createParticles() {
        const particlesContainer = document.getElementById('particles');
        const particleCount = 20;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // ランダムなサイズと位置
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
    
    // ナビゲーション設定
    setupNavigation() {
        const navTabs = document.querySelectorAll('.nav-tab');
        
        navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const section = tab.dataset.section;
                this.switchSection(section);
            });
        });
    }
    
    // セクション切り替え
    switchSection(sectionName) {
        // 現在のセクションを非表示
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // 新しいセクションを表示
        const targetSection = document.getElementById(`section-${sectionName}`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // ナビタブのアクティブ状態更新
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        this.currentSection = sectionName;
    }
    
    // QRスキャナー設定
    setupQRScanner() {
        const scanBtn = document.getElementById('scan-qr-btn');
        const modal = document.getElementById('qr-modal');
        const closeBtn = document.getElementById('qr-close-btn');
        const video = document.getElementById('qr-video');
        const errorDiv = document.getElementById('qr-error');
        
        scanBtn.addEventListener('click', () => {
            this.openQRScanner();
        });
        
        closeBtn.addEventListener('click', () => {
            this.closeQRScanner();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeQRScanner();
            }
        });
    　　 // 追加：QR スキャン用の canvas を動的に作成
        this.scanCanvas = document.createElement('canvas');
        this.scanCanvasCtx = this.scanCanvas.getContext('2d');
    }
    
    // QRスキャナーを開く
    async openQRScanner() {
        const modal = document.getElementById('qr-modal');
        const video = document.getElementById('qr-video');
        const errorDiv = document.getElementById('qr-error');
        
        try {
            modal.classList.add('active');
            errorDiv.textContent = '';
            
            this.isScanning = true;
            
            // カメラストリームを取得
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            video.srcObject = this.videoStream;
            
             // QR 読み取りをループで実行
            requestAnimationFrame(() => this.tickQRCode());
            
        } catch (error) {
            console.error('カメラアクセスエラー:', error);
            errorDiv.textContent = 'カメラにアクセスできません。ブラウザの設定を確認してください。';
        }
    }
    
      // QR コードを連続スキャンするループ
    tickQRCode() {
        if (!this.isScanning) return;

        const video = document.getElementById('qr-video');
        const errorDiv = document.getElementById('qr-error');

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // canvas を映像サイズに合わせる
            this.scanCanvas.width = video.videoWidth;
            this.scanCanvas.height = video.videoHeight;
            // ビデオフレームを canvas に描画
            this.scanCanvasCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

            // 画像データを取得して jsQR に渡す
            const imageData = this.scanCanvasCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
                // デコードに成功した場合
                if (code.data === this.qrCode) {
                    // 期待する QR コード文字列と一致したときだけスタンプ付与
                    this.addStamp();
                    this.closeQRScanner();
                    return;
                } else {
                    // 一致しなければエラーメッセージを出して継続
                    errorDiv.textContent = '無効な QR コードです。正しい Route227 の QR をかざしてください。';
                }
            }
        }

        // 次のフレームでもう一度チェック
        requestAnimationFrame(() => this.tickQRCode());
    }

    
    // QRスキャナーを閉じる
    closeQRScanner() {
        const modal = document.getElementById('qr-modal');
        const video = document.getElementById('qr-video');
        
        this.isScanning = false;
        modal.classList.remove('active');
        
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        
        video.srcObject = null;
        
    　　 // エラーメッセージをリセットしておく
        const errorDiv = document.getElementById('qr-error');
        if (errorDiv) errorDiv.textContent = '';
    }
    
    
    // スタンプを追加
    addStamp() {
        if (this.stampCount < this.maxStamps) {
            this.stampCount++;
            this.updateStampDisplay();
            this.updateRewardButtons();
            
            // 成功アニメーション
            const stampHole = document.querySelector(`[data-index="${this.stampCount - 1}"]`);
            if (stampHole) {
                stampHole.classList.add('filled', 'stamp-success');
                
                // アニメーション完了後にクラスを削除
                setTimeout(() => {
                    stampHole.classList.remove('stamp-success');
                }, 600);
            }
            
            // 成功メッセージ（簡易的なアラート）
            this.showSuccessMessage();
        }
    }
    
    // スタンプ表示を更新
    updateStampDisplay() {
        const countElement = document.getElementById('stamp-count');
        if (countElement) {
            countElement.textContent = this.stampCount;
        }
        
        // スタンプ穴の表示更新
        const stampHoles = document.querySelectorAll('.stamp-hole');
        stampHoles.forEach((hole, index) => {
            if (index < this.stampCount) {
                hole.classList.add('filled');
            } else {
                hole.classList.remove('filled');
            }
        });
    }
    
    // 報酬ボタンの状態更新
    updateRewardButtons() {
        const rewardCards = document.querySelectorAll('.reward-card');
        
        rewardCards.forEach(card => {
            const requiredPoints = parseInt(card.dataset.points);
            const claimBtn = card.querySelector('.reward-claim-btn');
            
            if (this.stampCount >= requiredPoints) {
                card.classList.add('available');
                claimBtn.classList.add('enabled');
                claimBtn.disabled = false;
                claimBtn.textContent = '交換する';
                
                // 交換ボタンのイベントリスナー
                claimBtn.onclick = () => this.claimReward(requiredPoints);
            } else {
                card.classList.remove('available');
                claimBtn.classList.remove('enabled');
                claimBtn.disabled = true;
                claimBtn.textContent = '交換する';
            }
        });
    }
    
    // 報酬を交換
    claimReward(requiredPoints) {
        if (this.stampCount >= requiredPoints) {
            this.stampCount -= requiredPoints;
            this.updateStampDisplay();
            this.updateRewardButtons();
            
            // 交換成功メッセージ
            alert(`おめでとうございます！報酬と交換しました。残りスタンプ数: ${this.stampCount}`);
        }
    }
    
    // 成功メッセージを表示
    showSuccessMessage() {
        // 簡易的な成功メッセージ
        const message = document.createElement('div');
        message.textContent = `スタンプ獲得！ (${this.stampCount}/${this.maxStamps})`;
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
        
        // フェードインアウトアニメーション
        const style = document.createElement('style');
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
    
    // 記事カードの設定
    setupArticleCards() {
        const articleCards = document.querySelectorAll('.article-card');
        
        articleCards.forEach(card => {
            card.addEventListener('click', () => {
                const url = card.dataset.url;
                if (url) {
                    window.open(url, '_blank');
                }
            });
        });
    }
    
    // 検索インターフェース設定
    setupSearchInterface() {
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        const searchTags = document.querySelectorAll('.search-tag');
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch(searchInput.value);
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(searchInput.value);
                }
            });
        }
        
        searchTags.forEach(tag => {
            tag.addEventListener('click', () => {
                searchInput.value = tag.textContent;
                this.performSearch(tag.textContent);
            });
        });
    }
    
    // 検索実行（UIのみ）
    performSearch(query) {
        if (query.trim()) {
            // 実際の検索機能はサーバーサイドが必要
            alert(`「${query}」で検索しました。\n\n※この機能は現在デモ版です。実際の検索結果は今後実装予定です。`);
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    window.route227App = new Route227App();
});

// サービスワーカーの登録（PWA対応の準備）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 現在はサービスワーカーファイルなしなのでコメントアウト
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered'))
        //     .catch(error => console.log('SW registration failed'));
    });
}