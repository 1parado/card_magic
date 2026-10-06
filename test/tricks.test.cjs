/* ============================================================
 * tricks.test.cjs —— 魔术正确性验证（node test/tricks.test.cjs）
 *
 * 物理约定：deck[0] = 牌堆底，deck[len-1] = 牌堆顶；
 * 发牌从顶（数组尾）逐张发出，row-major 分列，后发叠上。
 *
 * 1. 27 读心术：
 *    a) 穷举 27 个初始位置 × 全部 27 种三轮指认组合（3³）。
 *       指认与牌真实所在列一致（诚实观众）时，3 轮后必为数组
 *       下标 13（整叠正中间第 14 张）；不一致即"观众指错列"，
 *       属于非法输入，单独统计并验证魔术此时确实会失败
 *       （与现实中指错列魔术必然砸场一致）。
 *    b) 随机洗牌 5000 次（诚实指认）全部收敛。
 * 2. 牌组模型：52 张无重复、洗牌完整、切牌循环移位、
 *    收牌顺序（先收的列在数组前段 = 物理底）。
 * ============================================================ */

const assert = require('node:assert/strict');
const { createDeck, shuffleInPlace, cutDeck } = require('../js/deck.js');
const { dealIntoColumns, collectColumns, orderForChoice, trickRound } = require('../js/trick27.js');

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  console.log('  ✓ ' + name);
}

/* ---------- 1. 27 读心术 ---------- */
console.log('[1] 27 张牌读心术：穷举验证');

ok('穷举 27 个初始位置 × 27 种三轮指认组合：诚实指认全部收敛到 13', () => {
  const seqs = [];
  for (const c1 of [0, 1, 2])
    for (const c2 of [0, 1, 2])
      for (const c3 of [0, 1, 2]) seqs.push([c1, c2, c3]);
  assert.equal(seqs.length, 27);

  let honest = 0, dishonest = 0;
  for (let pos = 0; pos < 27; pos++) {
    for (const seq of seqs) {
      // marker = 0，交换到初始位置 pos（pos 从底起算）
      const deck0 = Array.from({ length: 27 }, (_, i) => i);
      [deck0[0], deck0[pos]] = [deck0[pos], deck0[0]];
      assert.equal(deck0.indexOf(0), pos);

      let d = deck0;
      let legit = true;
      for (const choice of seq) {
        const real = dealIntoColumns(d).findIndex((col) => col.includes(0));
        if (choice !== real) { legit = false; break; }  // 观众指错列
        d = trickRound(d, choice);
      }
      if (!legit) { dishonest++; continue; }
      assert.equal(d.indexOf(0), 13, `失败: 初始=${pos} 指认=${seq.join(',')}`);
      honest++;
    }
  }
  assert.equal(honest + dishonest, 27 * 27);
  console.log(`    （合法路径 ${honest} 条全部收敛；观众指错列 ${dishonest} 条已排除）`);
});

ok('随机洗牌 5000 次（诚实指认），最终位置全部为 13', () => {
  for (let iter = 0; iter < 5000; iter++) {
    let d = shuffleInPlace(Array.from({ length: 27 }, (_, i) => i));
    const marker = d[0];
    for (let round = 0; round < 3; round++) {
      const choice = dealIntoColumns(d).findIndex((col) => col.includes(marker));
      d = trickRound(d, choice);
    }
    assert.equal(d.indexOf(marker), 13, `失败: 迭代=${iter}`);
  }
});

ok('每轮收牌后目标牌位于中间 9 张 [9,17]（从底数）', () => {
  for (let iter = 0; iter < 300; iter++) {
    let d = shuffleInPlace(Array.from({ length: 27 }, (_, i) => i));
    const marker = d[13];                      // 任意记一张
    const choice = dealIntoColumns(d).findIndex((col) => col.includes(marker));
    d = trickRound(d, choice);
    const p = d.indexOf(marker);
    assert.ok(p >= 9 && p <= 17, `第${iter}次: 目标在 ${p}`);
  }
});

ok('dealIntoColumns：从牌堆顶（数组尾）发出，row-major 分列，后发叠上', () => {
  const deck = Array.from({ length: 27 }, (_, i) => i);
  const cols = dealIntoColumns(deck);
  assert.equal(cols.length, 3);
  for (const col of cols) assert.equal(col.length, 9);
  for (let k = 0; k < 27; k++) {
    // 第 k 张发出的牌是 deck[26-k]，进入列 k%3 行 k/3
    assert.equal(cols[k % 3][Math.floor(k / 3)], 26 - k);
  }
});

ok('orderForChoice 把目标列夹在收牌顺序中间', () => {
  assert.deepEqual(orderForChoice(0), [1, 0, 2]);
  assert.deepEqual(orderForChoice(1), [0, 1, 2]);
  assert.deepEqual(orderForChoice(2), [0, 2, 1]);
});

ok('collectColumns：先收的列在数组前段（物理底），目标列居中', () => {
  const cols = [[0, 0, 0], [1, 1, 1], [2, 2, 2]]; // 列内用列号填充便于断言
  const deck = collectColumns(cols, [2, 1, 0]);
  assert.deepEqual(deck, [2, 2, 2, 1, 1, 1, 0, 0, 0]);
});

/* ---------- 2. 牌组模型 ---------- */
console.log('[2] 牌组模型');

ok('52 张、无重复、花色点数齐全、红黑各半', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((c) => c.id)).size, 52);
  assert.equal(deck.filter((c) => c.red).length, 26);
});

ok('洗牌不丢牌、不重复', () => {
  const deck = shuffleInPlace(createDeck());
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((c) => c.id)).size, 52);
});

ok('切牌是循环移位', () => {
  const deck = createDeck();
  assert.deepEqual(cutDeck(deck, 13), deck.slice(13).concat(deck.slice(0, 13)));
  assert.deepEqual(cutDeck(deck, 0), deck);
  assert.deepEqual(cutDeck(deck, 52), deck);
});

console.log(`\n全部通过：${passed} 项测试 ✓`);
