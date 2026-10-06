/* ============================================================
 * deck.js —— 牌组数据模型（纯数据，不涉及 DOM）
 *
 * 约定：deck 是数组，索引 0 为"牌堆顶"。
 * 每张牌：{ id, suit, rank, red }
 *   - id 形如 "♠A"，同时作为 DOM 元素的 data-cid
 * 兼容 Node 测试：文件末尾按 UMD 方式导出。
 * ============================================================ */

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = { '♠': '黑桃', '♥': '红心', '♦': '方块', '♣': '梅花' };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** 创建一副按花色、点数排序的 52 张牌 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: suit + rank,
        suit,
        rank,
        red: suit === '♥' || suit === '♦',
      });
    }
  }
  return deck;
}

/** Fisher-Yates 原地洗牌，返回同一数组引用 */
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 切牌：把顶部 n 张移到底部（循环移位），返回新数组 */
function cutDeck(deck, n) {
  n = ((n % deck.length) + deck.length) % deck.length;
  return deck.slice(n).concat(deck.slice(0, n));
}

/** 牌的中文名，如 "黑桃A" */
function cardName(card) {
  return SUIT_NAMES[card.suit] + card.rank;
}

/* ---- Node 测试支持（浏览器里 typeof module 为 undefined，无影响） ---- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUITS, SUIT_NAMES, RANKS, createDeck, shuffleInPlace, cutDeck, cardName };
}
