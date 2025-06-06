// app.js

document.addEventListener(‘DOMContentLoaded’, () => {
const categories = [‘ALL’, ‘イベント’, ‘お店’, ‘ニュース’];
let currentCategoryIndex = 0;

// スタンプデータ初期化
if (localStorage.getItem(‘totalStamps’) === null) {
localStorage.setItem(‘totalStamps’, ‘0’);
localStorage.setItem(‘currentStamps’, ‘0’);
localStorage.setItem(‘usedCount’, ‘0’);
}
let totalStamps = parseInt(localStorage.getItem(‘totalStamps’), 10);
let currentStamps = parseInt(localStorage.getItem(‘currentStamps’), 10);

const categoryTabs = document.getElementById(‘categoryTabs’);
const articlesContainer = document.getElementById(‘articles’);
const currentStampsEl = document.getElementById(‘currentStamps’);
const totalStampsEl = document.getElementById(‘totalStamps’);
const stampCard = document.getElementById(‘stampCard’);
const menu227 = document.getElementById(‘menu-227’);
const menuFoodtruck = document.getElementById(‘menu-foodtruck’);
const qrScanner = document.getElementById(‘qrScanner’);
const scannerPreview = document.getElementById(‘scannerPreview’);

// 交換ボタン生成
const coffeeBtn = document.createElement(‘button’);
coffeeBtn.id = ‘coffeeExchange’;
coffeeBtn.textContent = ‘コーヒーと交換’;
coffeeBtn.disabled = true;
const curryBtn = document.createElement(‘button’);
curryBtn.id = ‘curryExchange’;
curryBtn.textContent = ‘カレーと交換’;
curryBtn.disabled = true;
stampCard.appendChild(coffeeBtn);
stampCard.appendChild(curryBtn);

// 記事データ一覧
const articles = [
{ title: ‘Bang BAR SENDAI 第3弾開催’, category: ‘イベント’, image: ‘🎉’, url: ‘https://machico.mu/special/detail/2727’ },
{ title: ‘仙臺横丁フェス’,           category: ‘イベント’, image: ‘🍻’, url: ‘https://machico.mu/special/detail/2691’ },
{ title: ‘バル仙台2025’,           category: ‘イベント’, image: ‘🍷’, url: ‘https://machico.mu/special/detail/2704’ },
{ title: ‘TOHOKU DE＆I FORUM 2025’, category: ‘イベント’, image: ‘🎤’, url: ‘https://machico.mu/special/detail/2924’ },
{ title: ‘PIZZA＆WINE ESOLA’,      category: ‘お店’,    image: ‘🍕’, url: ‘https://machico.mu/gourmet/detail/2003831’ }
];

// 記事描画
function renderArticles() {
articlesContainer.innerHTML = ‘’;
const selected = categories[currentCategoryIndex];
articles
.filter(a => selected === ‘ALL’ || a.category === selected)
.forEach(a => {
const div = document.createElement(‘div’);
div.className = ‘article’;
div.innerHTML = <div class="article-title"><a href="${a.url}" target="_blank">${a.title}</a></div> <div class="article-image">${a.image}</div>;
articlesContainer.appendChild(div);
});
}

// 交換ボタン活性制御
function updateExchangeButtons() {
coffeeBtn.disabled = currentStamps < 3;
curryBtn.disabled = currentStamps < 6;
}

// スタンプ表示更新
function updateStampDisplay() {
currentStampsEl.textContent = currentStamps;
totalStampsEl.textContent = totalStamps;
updateExchangeButtons();
}

// 交換ボタン処理
coffeeBtn.addEventListener(‘click’, () => {
if (currentStamps >= 3) {
currentStamps -= 3;
totalStamps -= 3;
localStorage.setItem(‘currentStamps’, currentStamps);
localStorage.setItem(‘totalStamps’, totalStamps);
alert(‘コーヒー1杯と交換しました！’);
updateStampDisplay();
}
});
curryBtn.addEventListener(‘click’, () => {
if (currentStamps >= 6) {
currentStamps -= 6;
totalStamps -= 6;
localStorage.setItem(‘currentStamps’, currentStamps);
localStorage.setItem(‘totalStamps’, totalStamps);
alert(‘カレー1杯と交換しました！’);
updateStampDisplay();
}
});

// QRスキャン開始
function startScanner() {
qrScanner.style.display = ‘flex’;
const codeReader = new ZXing.BrowserQRCodeReader();
codeReader.decodeFromVideoDevice(null, scannerPreview, (result, err) => {
if (result) {
if (result.text === ‘ROUTE227_STAMP_2025’ && currentStamps < 6) {
totalStamps++;
currentStamps++;
localStorage.setItem(‘totalStamps’, totalStamps);
localStorage.setItem(‘currentStamps’, currentStamps);
updateStampDisplay();
}
codeReader.reset();
qrScanner.style.display = ‘none’;
}
});
}

// セクション切り替え
function switchSection(section) {
if (section === ‘227’) {
categoryTabs.style.display = ‘flex’;
menu227.classList.add(‘active’);
menuFoodtruck.classList.remove(‘active’);
renderArticles();
} else {
categoryTabs.style.display = ‘none’;
menuFoodtruck.classList.add(‘active’);
menu227.classList.remove(‘active’);
articlesContainer.innerHTML = ‘FoodTruck情報はこちら’;
}
}

// タブクリック
categoryTabs.addEventListener(‘click’, e => {
if (e.target.classList.contains(‘tab’)) {
Array.from(categoryTabs.children).forEach(t => t.classList.remove(‘active’));
e.target.classList.add(‘active’);
currentCategoryIndex = categories.indexOf(e.target.dataset.category);
renderArticles();
}
});

// メニュークリック
menu227.addEventListener(‘click’, () => switchSection(‘227’));
menuFoodtruck.addEventListener(‘click’, () => switchSection(‘FoodTruck’));

// 初期表示
updateStampDisplay();
switchSection(‘227’);

// スタンプカードクリックでQR
stampCard.addEventListener(‘click’, startScanner);
});
