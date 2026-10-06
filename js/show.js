/* ============================================================
 * show.js —— 魔术秀流程状态机
 *
 * 节奏：每个关键阶段由用户确认后推进，阶段内部动画自动完成。
 * 可中断：restart 使旧流程的所有 alive() 检查失败，挂起的
 * 台词/等待被统一释放，快速连续操作不会破坏状态机。
 * ============================================================ */

const show = (() => {
  const subtitleText = document.getElementById('subtitle-text');
  const controlsEl = document.getElementById('controls');
  const actNameEl = document.getElementById('act-name');

  let token = 0;              // 流程代数：restart 时失效旧流程
  let cleanupFns = [];

  const alive = (t) => t === token;

  function onCleanup(fn) { cleanupFns.push(fn); }

  function release() {
    cleanupFns.forEach((f) => { try { f(); } catch (e) { /* 忽略清理异常 */ } });
    cleanupFns = [];
    controlsEl.innerHTML = '';
    subtitleText.textContent = '';
  }

  /* ---------- 台词打字机（点击/按键可跳过补全；每句带浮现动画） ---------- */
  function say(text) {
    return new Promise((resolve) => {
      subtitleText.style.animation = 'none';
      void subtitleText.offsetWidth;         // 重触发 line-in 浮现
      subtitleText.style.animation = '';
      let i = 0;
      let done = false;
      const iv = setInterval(() => {
        i++;
        subtitleText.textContent = text.slice(0, i);
        if (i >= text.length) finish();
      }, 44);
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(iv);
        removeEventListener('click', finish);
        removeEventListener('keydown', finish);
        subtitleText.textContent = text;
        // 依字数停顿，保证可读
        setTimeout(resolve, 420 + text.length * 62);
      };
      addEventListener('click', finish);
      addEventListener('keydown', finish);
      onCleanup(() => { done = true; clearInterval(iv); resolve(); });
    });
  }

  /* ---------- 继续按钮（空格 / 回车等价） ---------- */
  function waitContinue(label) {
    return new Promise((resolve) => {
      let done = false;
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = label;
      controlsEl.innerHTML = '';
      controlsEl.appendChild(b);
      const finish = () => {
        if (done) return;
        done = true;
        removeEventListener('keydown', onKey);
        controlsEl.innerHTML = '';
        audio.clickSfx();
        resolve();
      };
      const onKey = (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); finish(); }
      };
      b.addEventListener('click', finish);
      addEventListener('keydown', onKey);
      onCleanup(() => { done = true; removeEventListener('keydown', onKey); });
    });
  }

  /* ============================================================
   * 各幕
   * ============================================================ */

  /* 序幕：入席、洗牌、切牌、展扇 */
  async function intro(t, ok) {
    actNameEl.textContent = i18n.t('act.prologue');
    const deck = shuffleInPlace(createDeck());
    animator.initCards(deck);

    await say(i18n.t('closer'));
    if (!ok()) return;
    await animator.dealStackIn(deck);
    await say(i18n.t('ordinary'));
    if (!ok()) return;
    await animator.riffleShuffle(deck);
    await say(i18n.t('shuffle'));
    if (!ok()) return;
    await animator.cutDeckAnim(deck, 16 + ((Math.random() * 14) | 0));
    await animator.fanSpread(deck);
    await say(i18n.t('fan'));
    if (!ok()) return;
    await waitContinue(i18n.t('btn.gather'));
    if (!ok()) return;
    await animator.collectFan(deck);
  }

  /* 压轴：27 张读心术（三轮发牌、指认、真实收牌重排） */
  async function act27(t, ok) {
    actNameEl.textContent = i18n.t('act.reader');
    const deck = animator.currentDeck;
    await say(i18n.t('enough'));
    if (!ok()) return;

    const rest = deck.splice(27);
    if (deck.length !== 27) {
      console.error(`[magic] 牌堆数据异常：期望 27 张，实际 ${deck.length} 张`);
    }
    await animator.sendAway(rest);             // 其余牌退出舞台
    if (!ok()) return;

    let deck27 = deck;
    const lines = [i18n.t('mid1'), i18n.t('mid2'), i18n.t('mid3')];
    for (let round = 1; round <= 3; round++) {
      await animator.dealColumns(deck27);
      if (round === 1) {
        /* 先给足时间挑牌、记住，确认后才进入指认；
           期间牌可悬停——悬停的牌上浮放大，方便看清 */
        await say(i18n.t('pick'));
        if (!ok()) return;
        animator.setHoverable(true);
        await waitContinue(i18n.t('btn.gotIt'));
        animator.setHoverable(false);
        if (!ok()) return;
      }
      await say(round === 1 ? i18n.t('col1') : i18n.t('colNext'));
      if (!ok()) return;
      const choice = await animator.showHotspots();
      if (!ok()) return;
      await animator.senseColumns();
      if (!ok()) return;
      await say(i18n.t('sense'));
      if (!ok()) return;
      await animator.collectColumnsAnim(orderForChoice(choice), choice);
      deck27 = trickRound(deck27, choice);     // 数据同步：与动画完全相同的重排
      if (!ok()) return;
      await say(lines[round - 1]);
      if (!ok()) return;
    }

    /* 揭晓仪式：排除物理顶段（数组尾），让位底段（数组头），目标留正中 */
    await say(i18n.t('noEyes'));
    if (!ok()) return;
    await animator.flipAll(deck27, true);
    await say(i18n.t('think'));
    if (!ok()) return;
    await animator.discardCards(deck27.slice(14));
    await say(i18n.t('notThis'));
    if (!ok()) return;
    await animator.sleep(650);                 // 揭晓前的短暂停顿
    await say(i18n.t('andYours'));
    if (!ok()) return;
    await animator.setAside(deck27.slice(0, 13));
    await say(i18n.t('stepOut'));
    if (!ok()) return;
    await animator.revealCard(deck27[13]);
    if (!ok()) return;
    particles.fireworks();
    await say(i18n.t('miracle'));
    if (!ok()) return;
    await say(`「${i18n.cardName(deck27[13])}」`);
    if (!ok()) return;
    await say(i18n.t('closing'));
  }

  /* 谢幕 */
  async function finale() {
    actNameEl.textContent = i18n.t('act.curtain');
    await waitContinue(i18n.t('btn.again'));
  }

  /* ---------- 流程控制 ---------- */
  async function runShow() {
    const t = ++token;
    const ok = () => alive(t);
    try {
      await intro(t, ok); if (!ok()) return;
      await act27(t, ok); if (!ok()) return;
      await finale();
    } catch (err) {
      if (alive(t)) console.error('show error:', err);
    }
  }

  return {
    start: runShow,
    restart() {
      token++;               // 旧流程全部失效
      release();             // 释放挂起的台词与等待
      animator.resetStage(); // 移除全部牌 DOM 与特效（动画随节点销毁而终止）
      runShow();
    },
  };
})();
