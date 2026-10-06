/* ============================================================
 * audio.js —— Web Audio 合成音效
 *
 * 零音频文件依赖（离线可玩），首次用户手势后初始化。
 * 触发时机由 animator 的动作模板与 show 的流程控制：
 *   落桌 tick / 整叠 thud / 洗牌连续 swish / 翻面 / 感应上扫 /
 *   逐张排除 tick / 揭晓琶音。
 * ============================================================ */

const audio = (() => {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = localStorage.getItem('magic-muted') === '1';

  function init() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.6;
      master.connect(ctx.destination);
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function setMuted(m) {
    muted = m;
    localStorage.setItem('magic-muted', m ? '1' : '0');
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.02);
  }
  const isMuted = () => muted;

  function out(vol = 1, at = 0) {
    const g = ctx.createGain();
    g.gain.value = vol;
    g.connect(master);
    return { node: g, t: ctx.currentTime + at };
  }

  /* 噪声脉冲 + 带通扫频（纸牌摩擦的骨架声） */
  function swish(vol = 1, at = 0, dur = 0.16, f0 = 700, f1 = 2400) {
    if (!ctx || muted) return;
    const { node, t } = out(vol * 0.5, at);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    bp.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + dur * 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(env).connect(node);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /* 单张落桌：极短高频 tick + 低频小 thump */
  function tick(vol = 1, at = 0) {
    if (!ctx || muted) return;
    const { node, t } = out(vol * 0.5, at);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.9, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    src.connect(hp).connect(env).connect(node);
    src.start(t);
    src.stop(t + 0.06);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(72, t + 0.05);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vol * 0.25, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g2).connect(node);
    o.start(t);
    o.stop(t + 0.09);
  }

  /* ---------- 公开音效 ---------- */
  function clickSfx() { tick(0.7); }

  /* 发牌/落桌逐张预排：gap 单位毫秒，与动画 delay 对齐 */
  function dealSfx(n, gapMs, flightMs = 300) {
    if (!ctx || muted) return;
    for (let i = 0; i < n; i++) tick(0.55, (i * gapMs + flightMs) / 1000);
  }

  /* 逐张排除：间隔递增（与 discardCards 的 delay 曲线一致） */
  function discardSfx(n) {
    if (!ctx || muted) return;
    let t = 0;
    for (let i = 0; i < n; i++) {
      t += (150 + i * 14) / 1000 + 0.3;
      tick(0.5, t);
    }
  }

  function thud() {
    if (!ctx || muted) return;
    const { node, t } = out(1);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(node);
    o.start(t);
    o.stop(t + 0.34);
    swish(0.6, 0, 0.1, 300, 900);
  }

  function shuffleSfx() {
    for (let i = 0; i < 9; i++) swish(0.8, i * 0.055, 0.13, 600 + i * 90, 2100 + i * 60);
  }

  function flipSfx() { swish(0.9, 0, 0.2, 900, 2600); }

  /* 感应/施法：柔和上扫 + 微 shimmer */
  function magicSfx(pitch = 1) {
    if (!ctx || muted) return;
    const { node, t } = out(0.7);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(280 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(880 * pitch, t + 0.42);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(node);
    o.start(t);
    o.stop(t + 0.55);
    swish(0.5, 0.05, 0.3, 1200, 3200);
  }

  /* 揭晓琶音：C 宫五声，上行收束 */
  function revealSfx() {
    if (!ctx || muted) return;
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    notes.forEach((f, i) => {
      const { node, t } = out(0.8, i * 0.13);
      const o = ctx.createOscillator();
      o.type = i === notes.length - 1 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(i === notes.length - 1 ? 0.3 : 0.18, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(node);
      o.start(t);
      o.stop(t + 1.2);
    });
  }

  return { init, setMuted, isMuted, clickSfx, dealSfx, discardSfx, thud, shuffleSfx, swishSfx: swish, flipSfx, magicSfx, revealSfx };
})();
