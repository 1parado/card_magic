/* ============================================================
 * animator.js —— 3D 动作系统与魔术动作库
 *
 * 坐标系：#table 逻辑桌面（横屏 1200×700 / 竖屏 860×1080，
 * 与 style.css 的媒体查询一一对应），中心为原点，整体等比缩放。
 *
 * 动作模板 MOVES：每个动作独立定义时长、缓动、弧线高度、
 * 落桌回弹与音效时机；函数只负责按模板执行。
 *
 * 防穿帮原则：数据先行、动画如实。收列/发牌顺序严格等于牌堆
 * 数组顺序，动画不得改变魔术的真实结果。
 * ============================================================ */

const animator = (() => {
  const portraitMQ = matchMedia('(max-aspect-ratio: 4/5)');

  const tableEl = document.getElementById('table');
  const hotspotsEl = document.getElementById('hotspots');

  /* ---------- 布局参数（随屏幕方向切换；竖屏放大逻辑牌尺寸保证可读） ---------- */
  let P;
  function computeParams() {
    P = portraitMQ.matches
      ? { W: 860, H: 1080, cw: 124, ch: 174, colGap: 264, rowGap: 52, colTop: -262, stackY: -70,
          fanR: 560, fanHalf: 42, fanBase: -60 }
      : { W: 1200, H: 700, cw: 90, ch: 126, colGap: 352, rowGap: 42, colTop: -168, stackY: -40,
          fanR: 620, fanHalf: 40, fanBase: -40 };
  }
  portraitMQ.addEventListener?.('change', computeParams);
  computeParams();

  /* ---------- 动作模板 ---------- */
  const MOVES = {
    stackIn: { dur: 640, ease: 'cubic-bezier(.3,.7,.25,1)' },
    deal:    { dur: 300, ease: 'cubic-bezier(.25,.6,.3,1)', arc: 14, settle: 2.4 },
    collect: { dur: 260, ease: 'cubic-bezier(.3,.7,.3,1)',  arc: 8 },
    fan:     { dur: 640, ease: 'cubic-bezier(.3,.6,.25,1)' },
    discard: { dur: 380, ease: 'cubic-bezier(.35,.5,.3,1)', arc: 24 },
    aside:   { dur: 430, ease: 'cubic-bezier(.3,.6,.3,1)',  arc: 16 },
    reveal:  { dur: 660, ease: 'cubic-bezier(.3,.6,.25,1)', arc: 36 },
    travel:  { dur: 560, ease: 'cubic-bezier(.3,.6,.3,1)',  arc: 26 },
    lift:    { dur: 380, ease: 'cubic-bezier(.35,.5,.35,1)' },
  };

  /* ---------- 全局速度 ---------- */
  let speed = 1;                          // 0.7 悠闲 / 1 标准 / 1.6 快速
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setSpeed(s) { speed = s; }
  function D(ms) { return REDUCED ? Math.min(ms * 0.3, 280) : ms / speed; }

  const sleep = (ms) => new Promise((r) => setTimeout(r, D(ms)));
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- 牌状态 ---------- */
  // id -> { card, el, inner, pose:{x,y,z,rz,scale}, down, jitter }
  const cardMap = new Map();
  let allCards = [];
  let currentDeck = null;   // 牌堆数据（deck[0]=物理底，len-1=物理顶），show.js 共享引用

  const tf = (p) =>
    `translate3d(${p.x}px, ${p.y}px, ${p.z || 0}px) rotateZ(${p.rz || 0}deg) scale(${p.scale || 1})`;

  function applyPose(st) {
    st.el.style.transform = tf(st.pose);
    st.inner.classList.toggle('down', st.down);
    syncShadow(st);
  }

  /* ---------- 动态影子：贴桌面平面；z 越高影子偏移越大、越扩散、越淡 ---------- */
  function syncShadow(st) {
    if (!st.shadowEl) return;
    const p = st.pose;
    const lift = Math.max(0, p.z || 0);
    st.shadowEl.style.transform =
      `translate3d(${p.x}px, ${(p.y + 4 + lift * 0.3).toFixed(1)}px, 0.1px) ` +
      `rotateZ(${p.rz || 0}deg) scale(${((1 + lift * 0.0016) * (p.scale || 1)).toFixed(3)})`;
    st.shadowEl.style.opacity = Math.max(0.1, 0.55 - lift * 0.0022).toFixed(3);
  }

  /* WAAPI Promise 化；结束后把终态写入 style（fill 不残留）。
     兜底：部分移动设备（合成层预算溢出）会静默丢弃排队靠后的动画，
     finish 事件不触发 → 超时后直接落终态，保证牌数与位置永远正确。 */
  function animateEl(el, frames, { dur = 300, delay = 0, ease } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const a = el.animate(frames, { duration: D(dur), delay: D(delay), easing: ease, fill: 'both' });
      const total = D(dur) + D(delay) + 600;
      const timer = setTimeout(finish, total);
      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const last = frames[frames.length - 1];
        if (last.transform) el.style.transform = last.transform;
        try { a.cancel(); } catch (e) { /* 动画可能已被移除 */ }
        resolve();
      }
      a.addEventListener('finish', finish);
    });
  }

  /* 通用移动：按模板生成轨迹帧（可选弧线、落桌微回弹、起手手腕角 twist；
     delay 附加 ±8% 随机抖动以消除机械同步感） */
  function moveTo(card, pose, { move = 'travel', dur, delay = 0, ease, arc, settle, twist } = {}) {
    const tpl = MOVES[move] || MOVES.travel;
    const st = cardMap.get(card.id);
    const from = { ...st.pose };
    st.pose = { ...st.pose, ...pose };
    const to = { ...st.pose };
    const A = arc ?? tpl.arc ?? 0;
    const S = settle ?? tpl.settle ?? 0;
    const T = twist ?? tpl.twist ?? 0;
    const d = delay > 0 ? delay * (0.92 + Math.random() * 0.16) : 0;

    const frames = [];
    if (A > 0 && S > 0) {
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2,
        z: Math.max(from.z || 0, to.z || 0) + A, rz: ((from.rz || 0) + (to.rz || 0)) / 2 + T, scale: to.scale || 1 };
      const up = { ...to, y: to.y - S };
      frames.push({ transform: tf(from), offset: 0 }, { transform: tf(mid), offset: 0.45 },
        { transform: tf(to), offset: 0.8 }, { transform: tf(up), offset: 0.9 }, { transform: tf(to), offset: 1 });
    } else if (A > 0) {
      const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2,
        z: Math.max(from.z || 0, to.z || 0) + A, rz: ((from.rz || 0) + (to.rz || 0)) / 2 + T, scale: to.scale || 1 };
      frames.push({ transform: tf(from), offset: 0 }, { transform: tf(mid), offset: 0.5 }, { transform: tf(to), offset: 1 });
    } else {
      frames.push({ transform: tf(from) }, { transform: tf(to) });
    }

    st.el.classList.add('airborne');
    const done = animateEl(st.el, frames, { dur: dur ?? tpl.dur, delay: d, ease: ease ?? tpl.ease })
      .then(() => st.el.classList.remove('airborne'));
    syncShadow(st);                          // 影子经 CSS transition 平滑追随到新位
    return done;
  }

  /* 翻面：绕牌面中央垂直轴 rotateY（合理的翻牌旋转轴），结束后同步状态。
     同样带超时兜底（移动端丢动画防护）。 */
  function flipCard(card, down, { dur = 360, delay = 0 } = {}) {
    const st = cardMap.get(card.id);
    if (st.down === down) return sleep(0);
    st.down = down;
    const from = down ? 'rotateY(0deg)' : 'rotateY(180deg)';
    const to = down ? 'rotateY(180deg)' : 'rotateY(0deg)';
    return new Promise((resolve) => {
      let settled = false;
      const a = st.inner.animate([{ transform: from }, { transform: to }],
        { duration: D(dur), delay: D(delay), easing: 'cubic-bezier(.45,.1,.25,1)', fill: 'both' });
      const timer = setTimeout(finish, D(dur) + D(delay) + 600);
      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // 静态 class 切换时禁用 transition，避免与 peek 悬停过渡叠加出二次翻动
        st.inner.style.transition = 'none';
        st.inner.classList.toggle('down', down);
        void st.inner.offsetWidth;
        st.inner.style.transition = '';
        try { a.cancel(); } catch (e) { /* 动画可能已被移除 */ }
        resolve();
      }
      a.addEventListener('finish', finish);
    });
  }

  /* ---------- 布局计算 ---------- */
  const colX = (c) => (c - 1) * P.colGap;

  function columnsPose(c, r) {
    return { x: colX(c), y: P.colTop + r * P.rowGap, z: r * 0.8, rz: 0 };
  }

  function fanPose(i, n) {
    const theta = n === 1 ? 0 : -P.fanHalf + (i / (n - 1)) * P.fanHalf * 2;
    const rad = (theta * Math.PI) / 180;
    return {
      x: P.fanR * Math.sin(rad),
      y: P.fanR * (1 - Math.cos(rad)) + P.fanBase,
      z: i * 0.8,
      rz: theta,
      scale: 0.94,
    };
  }

  function discardPose(i) {
    return { x: P.W / 2 - 190 + rand(-34, 34), y: rand(-140, 40), z: i * 0.8, rz: rand(-20, 20), scale: 0.94 };
  }

  const asidePose = (i) => ({ x: -P.W / 2 + 190, y: -30, z: i * 0.8, rz: -7, scale: 0.94 });

  /* ---------- 舞台缩放（resize 防抖；边距只留必需量，让牌桌尽量充满视口） ---------- */
  function fitStage() {
    computeParams();
    const s = Math.min(innerWidth / (P.W + 30), innerHeight / (P.H + 80));
    const root = document.documentElement.style;
    root.setProperty('--table-scale', s.toFixed(4));
    // 牌尺寸跟随方向参数（cards.css 的 --card-w/h tokens）
    root.setProperty('--card-w', P.cw + 'px');
    root.setProperty('--card-h', P.ch + 'px');
  }
  let fitTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitStage, 120);
  });
  fitStage();

  /* ---------- 数据↔视觉一致性探针（测试用，不参与表演） ----------
   * 验证每张牌的 DOM 位姿与数据数组严格对应：
   * 牌堆态：z 顺序 = 数组顺序；三列态：数据 i 的牌位于列 (n-1-i)%3 的第 floor((n-1-i)/3) 行。 */
  function syncReport(deck, mode) {
    const n = deck.length;
    const errs = [];
    for (let i = 0; i < n; i++) {
      const st = cardMap.get(deck[i].id);
      if (!st) { errs.push(`missing DOM: ${deck[i].id}`); continue; }
      const p = st.pose;
      if (mode === 'columns') {
        const k = n - 1 - i;
        const c = k % 3, r = Math.floor(k / 3);
        const want = columnsPose(c, r);
        if (Math.abs(p.x - want.x) > 2 || Math.abs(p.y - want.y) > 2) {
          errs.push(`${deck[i].id}: pose(${p.x.toFixed(0)},${p.y.toFixed(0)}) ≠ col(${want.x},${want.y})`);
        }
      } else if (mode === 'stack') {
        const wantZ = i * 0.8;
        if (Math.abs(p.z - wantZ) > Math.max(6, n * 0.9)) {
          errs.push(`${deck[i].id}: z=${p.z.toFixed(1)} ≠ ${wantZ.toFixed(1)}(±)`);
        }
        if (Math.abs(p.x - 0) > 3 || Math.abs(p.y - P.stackY) > 3) {
          errs.push(`${deck[i].id}: stack pos (${p.x.toFixed(0)},${p.y.toFixed(0)})`);
        }
      }
    }
    return { ok: errs.length === 0, errs: errs.slice(0, 8) };
  }

  /* 逻辑坐标 → 屏幕坐标（供粒子层使用） */
  function logicalToScreen(x, y) {
    const rect = tableEl.getBoundingClientRect();
    return {
      x: rect.left + rect.width * (0.5 + x / P.W),
      y: rect.top + rect.height * (0.5 + y / P.H),
    };
  }

  /* ---------- DOM 创建 ---------- */
  function createCardEl(card) {
    const el = document.createElement('div');
    el.className = 'card' + (card.red ? ' red' : '');
    el.dataset.cid = card.id;
    el.innerHTML =
      `<div class="card-inner down">` +
      `<div class="face front">${face.cardFaceSVG(card)}</div>` +
      `<div class="face back">${face.cardBackSVG()}</div>` +
      `<div class="edge-r"></div><div class="edge-b"></div>` +
      `</div>`;
    return el;
  }

  /* ---------- 挑牌模式：悬停的牌上浮放大提亮（事件常驻，仅 hoverable 时生效） ---------- */
  function setHoverable(on) {
    for (const st of cardMap.values()) {
      st.el.classList.toggle('hoverable', on);
      if (!on) {
        st.inner.classList.remove('peek');
        st.el.classList.remove('peeking');
      }
    }
  }

  /* ---------- 桌面微震：整叠落定的实体感（配合 thud 音效） ---------- */
  function stageThump() {
    const stage = document.getElementById('stage');
    stage.classList.remove('thump');
    void stage.offsetWidth;                    // 重触发动画
    stage.classList.add('thump');
  }

  function initCards(deck52) {
    face.installSuitDefs();
    currentDeck = deck52;                    // show.js 全程使用同一数组引用
    for (const card of deck52) {
      const el = createCardEl(card);
      const shadowEl = document.createElement('div');
      shadowEl.className = 'card-shadow';
      tableEl.appendChild(shadowEl);         // 影子在牌之前插入（DOM 序更低）
      tableEl.appendChild(el);
      const st = {
        card, el, shadowEl,
        inner: el.querySelector('.card-inner'),
        down: true,
        jitter: { x: rand(-1.2, 1.2), y: rand(-1.2, 1.2), rz: rand(-0.6, 0.6) },
        pose: { x: 0, y: -P.H / 2 - 220, z: 0, rz: 0, scale: 1 },
      };
      // 悬停/点按微交互：桌面鼠标悬停上浮；触屏（hover:none）点按切换，
      // 避免 iOS "tap 触发 mouseenter 却无 mouseleave" 导致的卡浮
      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse' || !el.classList.contains('hoverable')) return;
        st.inner.classList.add('peek');
        el.classList.add('peeking');
        audio.tick(0.2);
      });
      el.addEventListener('pointerleave', (e) => {
        if (e.pointerType !== 'mouse') return;
        st.inner.classList.remove('peek');
        el.classList.remove('peeking');
      });
      el.addEventListener('click', () => {
        if (!el.classList.contains('hoverable')) return;
        if (!matchMedia('(hover: none)').matches) return;   // 桌面由 hover 负责
        const wasPeeking = st.inner.classList.contains('peek');
        for (const other of cardMap.values()) {             // 先复位全部
          other.inner.classList.remove('peek');
          other.el.classList.remove('peeking');
        }
        if (!wasPeeking) {
          st.inner.classList.add('peek');
          el.classList.add('peeking');
          audio.tick(0.2);
        }
      });
      applyPose(st);
      cardMap.set(card.id, st);
      allCards.push(card);
    }
  }

  function resetStage() {
    for (const st of cardMap.values()) { st.el.remove(); st.shadowEl?.remove(); }
    cardMap.clear();
    allCards = [];
    currentDeck = null;
    hotspotsEl.innerHTML = '';
    document.getElementById('reveal-glow')?.classList.remove('show');
  }

  /* ============================================================
   * 动作库（数据与动画同步；执行顺序 = 数组顺序）
   * ============================================================ */

  /* 序幕：整副牌从上方依次落成一叠（轻微错峰 + 落桌音 + 桌面微震） */
  async function dealStackIn(deck) {
    audio.dealSfx(deck.length, 14, 520);
    await Promise.all(deck.map((card, i) =>
      moveTo(card, { x: 0, y: P.stackY, z: i * 0.8 }, { move: 'stackIn', delay: i * 14 })
    ));
    audio.thud();
    stageThump();
    await sleep(140);
  }

  /* 花式洗牌：明确分组（左右两半）→ 交叠重组（按新牌序交替飞回）。
   * 物理一致：左半为牌堆上半（数组尾段，z 更高）。 */
  async function riffleShuffle(deck) {
    const n = deck.length;
    const half = Math.floor(n / 2);
    const leftSet = new Set(deck.slice(n - half).map((c) => c.id)); // 物理上半
    await Promise.all(deck.map((card, i) => {
      const left = leftSet.has(card.id);
      // 半内自顶向下的序（k=0 为该半的物理顶牌），决定两半各自的叠放 z
      const k = left ? (n - 1 - i) : (n - half - 1 - i);
      return moveTo(card, { x: (left ? -1 : 1) * 130, y: P.stackY, z: k * 0.8,
        rz: (left ? -1 : 1) * 3.5 }, { move: 'lift', delay: Math.min(i, 20) * 12 });
    }));
    await sleep(180);
    shuffleInPlace(deck);
    audio.shuffleSfx();
    await Promise.all(deck.map((card, i) =>
      moveTo(card, { x: 0, y: P.stackY, z: i * 0.8, rz: 0 }, { move: 'collect', delay: i * 26 })
    ));
    await sleep(160);
  }

  /* 切牌：拿起物理上半（数组尾段）示于右侧 → 下半叠上（数据循环移位）→ 归位 */
  async function cutDeckAnim(deck, n) {
    const N = deck.length;
    const topPack = deck.slice(N - n);          // 物理上半（z 更高的 n 张）
    await Promise.all(topPack.map((card, i) =>  // i: 0=上半的底牌
      moveTo(card, { x: 300, y: P.stackY - 10, z: i * 0.8 + 20, rz: 4 },
        { move: 'lift', delay: (n - 1 - i) * 7, arc: 30 })
    ));
    await sleep(360);
    // 数据：切牌 = 循环移位（上半沉底，下半成为顶部）
    const cut = cutDeck(deck, N - n);
    deck.length = 0;
    deck.push(...cut);
    const bottom = deck.slice(0, N - n);        // 原下半 = 现在的物理顶部段
    audio.swishSfx(0.8);
    await Promise.all(bottom.map((card, i) =>
      moveTo(card, { x: 300, y: P.stackY - 10, z: n * 0.8 + 20 + i * 0.8, rz: 4 },
        { move: 'lift', delay: (N - n - 1 - i) * 7, arc: 24 })
    ));
    audio.thud();
    stageThump();
    await Promise.all(deck.map((card, i) =>
      moveTo(card, { x: 0, y: P.stackY, z: i * 0.8, rz: 0 },
        { move: 'collect', delay: Math.min(i, 16) * 10 })
    ));
    await sleep(140);
  }

  /* 展扇（观众第一人称视角：扇面亮牌面） */
  async function fanSpread(deck) {
    audio.swishSfx();
    await Promise.all(deck.map((card, i) => (async () => {
      const d = Math.min(i, 30) * 15;
      moveTo(card, fanPose(i, deck.length), { move: 'fan', delay: d });
      await flipCard(card, false, { dur: 280, delay: d + 120 });
    })()));
    await sleep(260);
  }

  async function collectFan(deck) {
    audio.swishSfx(0.8);
    await Promise.all(deck.map((card, i) => (async () => {
      const d = i * 13;
      moveTo(card, { x: 0, y: P.stackY, z: i * 0.8, rz: 0, scale: 1 },
        { move: 'collect', delay: d });
      await flipCard(card, true, { dur: 240, delay: d });
    })()));
    await sleep(180);
  }

  /* 多余的牌离场（飞出画面左下，确保任何缩放下都不可见） */
  async function sendAway(cards) {
    await Promise.all(cards.map((card, i) =>
      moveTo(card, { x: -P.W / 2 - 300, y: P.H / 2 + 180, z: i * 0.8, rz: -16, scale: 0.9 },
        { move: 'travel', delay: Math.min(i, 12) * 18 })
    ));
  }

  /* 发 27 张成 3 列：从物理顶（数组尾）逐张发出，row-major 分列，
   * 与 trick27.dealIntoColumns 的映射完全一致；后发的叠在先发上面。
   * 发牌带起手手腕角（向哪列偏，起手就往哪侧带一点）。 */
  async function dealColumns(deck) {
    const n = deck.length;
    audio.shuffleSfx();
    await Promise.all(Array.from({ length: n }, (_, k) => {
      const card = deck[n - 1 - k];
      const c = k % 3, r = Math.floor(k / 3);
      return (async () => {
        await moveTo(card, columnsPose(c, r),
          { move: 'deal', delay: k * 46, twist: (c - 1) * 5 + rand(-1.5, 1.5) });
        await flipCard(card, false, { dur: 220 });
      })();
    }));
    await sleep(220);
  }

  /* 感应扫光：固定左中右顺序，不泄露任何位置信息 */
  async function senseColumns() {
    for (let c = 0; c < 3; c++) {
      const cards = cardsAtColumn(c);
      cards.forEach((card) => cardMap.get(card.id).el.classList.add('sensing'));
      audio.magicSfx(0.7);
      await sleep(380);
      cards.forEach((card) => cardMap.get(card.id).el.classList.remove('sensing'));
    }
  }

  /* 当前位于列 c 的牌（按牌面 y 排序 = 行序） */
  function cardsAtColumn(c) {
    return allCards
      .filter((card) => {
        const p = cardMap.get(card.id).pose;
        return Math.abs(p.x - colX(c)) < 5 && Math.abs(p.scale - 1) < 0.01;
      })
      .sort((a, b) => cardMap.get(a.id).pose.y - cardMap.get(b.id).pose.y);
  }

  /* 收列：严格按 order 逐列、列内按行序收回牌堆 —— 与 collectColumns 数据一致。
   * 目标列（order[1]）收牌节奏略放慢，是表演重点而非信息隐藏。 */
  async function collectColumnsAnim(order, targetChoice) {
    let emitted = 0;
    for (let oi = 0; oi < order.length; oi++) {
      const col = cardsAtColumn(order[oi]);
      const isTarget = order[oi] === targetChoice;
      audio.swishSfx(isTarget ? 1 : 0.7);
      await Promise.all(col.map((card, r) =>
        moveTo(card, { x: 0, y: P.stackY, z: (emitted + r) * 0.8, rz: 0 },
          { move: 'collect', dur: isTarget ? 290 : 250, delay: r * (isTarget ? 58 : 40) })
      ));
      emitted += col.length;
      if (oi < order.length - 1) await sleep(200);
    }
    await sleep(180);
  }

  /* 整叠翻面（微小错位避免 3D 穿插，错位可复现：来自创建时固定的 jitter；
     翻面时整叠微微抬升再落下，带出"拿起翻个面"的实体感） */
  async function flipAll(deck, down) {
    audio.flipSfx();
    await Promise.all(deck.map((card, i) => {
      const st = cardMap.get(card.id);
      moveTo(card, { x: st.jitter.x * 2.4, y: P.stackY + st.jitter.y * 2.4,
        z: i * 0.9 + 10, rz: st.jitter.rz * 2.2 }, { move: 'lift', delay: i * 8, arc: 12 });
      return flipCard(card, down, { dur: 300, delay: i * 8 });
    }));
    await sleep(220);
    // 归位压平（影子随之收紧）
    await Promise.all(deck.map((card, i) => {
      const st = cardMap.get(card.id);
      return moveTo(card, { x: st.jitter.x * 2.4, y: P.stackY + st.jitter.y * 2.4,
        z: i * 0.9, rz: st.jitter.rz * 2.2 }, { move: 'collect', delay: Math.min(i, 20) * 6 });
    }));
    await sleep(140);
  }

  /* 揭晓·逐张排除：节奏逐渐放慢（delay 递增） */
  async function discardCards(cards) {
    audio.discardSfx(cards.length);
    await Promise.all(cards.map((card, i) =>
      moveTo(card, discardPose(i), { move: 'discard', delay: i * (150 + i * 14) })
    ));
    await sleep(420);
  }

  /* 揭晓·让位：剩余整叠移到左侧 */
  async function setAside(cards) {
    await Promise.all(cards.map((card, i) =>
      moveTo(card, asidePose(i), { move: 'aside', delay: i * 10 })
    ));
    audio.thud();
    stageThump();
    await sleep(220);
  }

  /* 揭晓：目标牌到中央、放大、翻面、地面光斑亮起 */
  async function revealCard(card) {
    document.getElementById('reveal-glow').classList.add('show');
    audio.magicSfx(1.3);
    await Promise.all([
      moveTo(card, { x: 0, y: -30, z: 200, rz: 0, scale: 1.7 }, { move: 'reveal' }),
      flipCard(card, false, { dur: 560, delay: 280 }),
    ]);
    cardMap.get(card.id).el.classList.add('revealed');
    audio.revealSfx();
    await sleep(300);
  }

  /* ---------- 选列热区（1/2/3 键与点击等价；点击后所选列即时提亮反馈） ---------- */
  function showHotspots() {
    return new Promise((resolve) => {
      hotspotsEl.innerHTML = '';
      let done = false;
      const finish = (choice) => {
        if (done) return;
        done = true;
        removeEventListener('keydown', onKey);
        // 点击反馈：所选列的牌亮起，随后热区淡出
        cardsAtColumn(choice).forEach((card) => cardMap.get(card.id).el.classList.add('sensing'));
        setTimeout(() => {
          cardsAtColumn(choice).forEach((card) => cardMap.get(card.id).el.classList.remove('sensing'));
        }, 450);
        [...hotspotsEl.children].forEach((h) => h.classList.add('fading'));
        setTimeout(() => { hotspotsEl.innerHTML = ''; }, 300);
        audio.clickSfx();
        resolve(choice);
      };
      const hh = 8 * P.rowGap + P.ch + 44;
      const top = P.colTop - P.ch / 2 - 22;
      const numerals = ['Ⅰ', 'Ⅱ', 'Ⅲ'];
      for (let c = 0; c < 3; c++) {
        const h = document.createElement('div');
        h.className = 'hotspot active';
        h.setAttribute('role', 'button');
        h.setAttribute('aria-label', `第 ${c + 1} 列`);
        h.style.left = `${colX(c) - (P.colGap - 12) / 2}px`;
        h.style.top = `${top}px`;
        h.style.width = `${P.colGap - 12}px`;
        h.style.height = `${hh}px`;
        h.innerHTML = `<span class="hs-label" aria-hidden="true">${numerals[c]}</span>`;
        h.addEventListener('click', () => finish(c));
        // 悬停联动：光标所在的列即时提亮（选列的直接反馈）
        h.addEventListener('mouseenter', () => {
          cardsAtColumn(c).forEach((card) => cardMap.get(card.id).el.classList.add('sensing'));
        });
        h.addEventListener('mouseleave', () => {
          cardsAtColumn(c).forEach((card) => cardMap.get(card.id).el.classList.remove('sensing'));
        });
        hotspotsEl.appendChild(h);
      }
      const onKey = (e) => {
        if (e.key >= '1' && e.key <= '3') finish(Number(e.key) - 1);
      };
      addEventListener('keydown', onKey);
    });
  }

  return {
    setSpeed, sleep, rand,
    initCards, resetStage,
    dealStackIn, riffleShuffle, cutDeckAnim,
    fanSpread, collectFan, sendAway,
    dealColumns, senseColumns, collectColumnsAnim,
    flipAll, discardCards, setAside, revealCard,
    showHotspots, logicalToScreen,
    setHoverable,
    getCardEl: (id) => cardMap.get(id)?.el,
    params: () => P,
    syncReport,
    get currentDeck() { return currentDeck; },
  };
})();
