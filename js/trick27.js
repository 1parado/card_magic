/* ============================================================
 * trick27.js —— 27 张牌读心术核心（纯函数）
 *
 * 物理约定（与 animator.js 一致）：
 *   deck 数组索引 0 = 牌堆"底"，索引 length-1 = 牌堆"顶"。
 *   发牌从牌堆顶逐张发出（row-major：第 k 张发出的牌进入
 *   列 k%3 的第 floor(k/3) 行，后发的叠在先发的上面）。
 *
 * 数学原理：
 *   每轮把 27 张的牌堆按行发成 3 列，用户指认目标所在列后收牌，
 *   目标列被夹在正中间（牌堆第 9~17 张，从底往上数）。
 *   - 第 1 轮后目标位置 ∈ [9, 17]
 *   - 第 2 轮后 ∈ {12, 13, 14}
 *   - 第 3 轮后必为 13（0-indexed，即整叠正中间第 14 张）
 * ============================================================ */

/** 把牌堆（27 张）按行发成 3 列，每列 9 张。
 *  从物理顶（数组尾）发出：deck[len-1-k] 进入列 k%3，行 floor(k/3)。
 *  列内保持先后顺序（索引小 = 行小 = 物理列底）。 */
function dealIntoColumns(deck) {
  const cols = [[], [], []];
  const n = deck.length;
  for (let k = 0; k < n; k++) cols[k % 3].push(deck[n - 1 - k]);
  return cols;
}

/** 收列：按 order 顺序把三列依次叠入新牌堆（每列从第 0 行开始逐张放入）。
 *  order 中处于中间位置（order[1]）的那列，最终占据牌堆第 9~17 张。 */
function collectColumns(cols, order) {
  const deck = [];
  for (const c of order) deck.push(...cols[c]);
  return deck;
}

/** 根据用户指认的列，生成收牌顺序：目标列夹在中间。 */
function orderForChoice(choice) {
  const others = [0, 1, 2].filter((c) => c !== choice);
  return [others[0], choice, others[1]];
}

/** 完整模拟一轮：发牌 → 指认 → 收牌。返回新牌堆。 */
function trickRound(deck, choice) {
  return collectColumns(dealIntoColumns(deck), orderForChoice(choice));
}

/* ---- Node 测试支持 ---- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { dealIntoColumns, collectColumns, orderForChoice, trickRound };
}
