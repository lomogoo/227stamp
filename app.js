// app.js

document.addEventListener(‘DOMContentLoaded’, () => {
let touchStartX = 0;
let touchEndX = 0;
const categories = [‘ALL’, ‘イベント’, ‘お店’, ‘ニュース’];
let currentCategoryIndex = 0;

// ローカルストレージ初期化
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

const menu227 = document.getElementById(‘menu-227’);
const menuFoodtruck = document.getElementById(‘menu-foodtruck’);

const qrScanner = document.getElementById(‘qrScanner’);
const scannerPreview = document.getElementById(‘scannerPreview’);

// サンプル記事データ
const articles = [
{ id: 1, title: ‘記事1’, category: ‘ALL’ },
{ id: 2, title: ‘記事2’, category: ‘イベント’ },
{ id: 3, title: ‘記事3’, category: ‘お店’ },
{ id: 4, title: ‘記事4’, category: ‘ニュース’ }
];

// 記事描画
function renderArticles() {
articlesContainer.innerHTML = ‘’;
const selectedCategory = categories[currentCategoryIndex];
const filtered = articles.filter(
a => selectedCategory === ‘ALL’ || a.category === selectedCategory
);
filtered.forEach(a => {
const div = document.createElement(‘div’);
div.className = ‘article’;
div.innerHTML = <div class="article-title">${a.title}</div> <div class="article-image">📄</div>;
articlesContainer.appendChild(div);
});
}

// スタンプ表示更新
function updateStampDisplay() {
currentStampsEl.textContent = currentStamps;
totalStampsEl.textContent = totalStamps;
}

// QRスキャン開始
function startScanner() {
qrScanner.style.display = ‘flex’;
const codeReader = new ZXing.BrowserQRCodeReader();
codeReader.decodeFromVideoDevice(null, scannerPreview, (result, err) => {
if (result) {
if (result.text === ‘ROUTE227_STAMP_2025’) {
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

// カテゴリタブクリック
categoryTabs.addEventListener(‘click’, e => {
if (e.target.classList.contains(‘tab’)) {
[…categoryTabs.children].forEach(t => t.classList.remove(‘active’));
e.target.classList.add(‘active’);
currentCategoryIndex = categories.indexOf(e.target.dataset.category);
renderArticles();
}
});

// スワイプ切り替え
categoryTabs.addEventListener(‘touchstart’, e => {
touchStartX = e.changedTouches[0].clientX;
});
categoryTabs.addEventListener(‘touchend’, e => {
touchEndX = e.changedTouches[0].clientX;
const diff = touchEndX - touchStartX;
if (Math.abs(diff) > 30) {
if (diff < 0) {
currentCategoryIndex = (currentCategoryIndex + 1) % categories.length;
} else {
currentCategoryIndex =
(currentCategoryIndex - 1 + categories.length) % categories.length;
}
const newTab = categoryTabs.querySelector(
[data-category="${categories[currentCategoryIndex]}"]
);
newTab.click();
}
});

// メニュークリック
menu227.addEventListener(‘click’, () => switchSection(‘227’));
menuFoodtruck.addEventListener(‘click’, () => switchSection(‘FoodTruck’));

// 初期表示
updateStampDisplay();
switchSection(‘227’);

// スタンプカード部分クリックでQRスキャナー起動
document.getElementById(‘stampCard’).addEventListener(‘click’, startScanner);
});
