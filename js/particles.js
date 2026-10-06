/* ============================================================
 * particles.js —— 克制的粒子层
 *
 * 背景：低密度金色微尘（常驻、缓慢漂移）。
 * 前景：施法上升粒子 / 谢幕烟花（暖金与祖母绿同色系，短促收敛，
 *       不做满屏覆盖）。API 均接收屏幕坐标（由 animator 换算）。
 * ============================================================ */

const particles = (() => {
  const bg = document.getElementById('fx-bg');
  const fg = document.getElementById('fx-fg');
  const bctx = bg.getContext('2d');
  const fctx = fg.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);

  let motes = [];
  let sparks = [];          // 前景活跃粒子
  let rafId = 0;
  let running = false;

  function resize() {
    for (const c of [bg, fg]) {
      c.width = innerWidth * DPR;
      c.height = innerHeight * DPR;
    }
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    motes = Array.from({ length: 42 }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: 0.6 + Math.random() * 1.4,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -0.04 - Math.random() * 0.1,
      a: 0.05 + Math.random() * 0.16,
      ph: Math.random() * Math.PI * 2,
    }));
  }
  addEventListener('resize', resize);
  resize();

  function frame(t) {
    /* ---- 背景：微尘 ---- */
    bctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const m of motes) {
      m.x += m.vx; m.y += m.vy;
      if (m.y < -6) { m.y = innerHeight + 6; m.x = Math.random() * innerWidth; }
      if (m.x < -6) m.x = innerWidth + 6;
      if (m.x > innerWidth + 6) m.x = -6;
      const tw = 0.6 + 0.4 * Math.sin(t / 1400 + m.ph);
      bctx.beginPath();
      bctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      bctx.fillStyle = `rgba(216, 182, 120, ${(m.a * tw).toFixed(3)})`;
      bctx.fill();
    }

    /* ---- 前景：粒子 ---- */
    fctx.clearRect(0, 0, innerWidth, innerHeight);
    if (sparks.length) {
      sparks = sparks.filter((p) => p.life > 0);
      for (const p of sparks) {
        p.x += p.vx; p.y += p.vy;
        p.vy += p.g;
        p.vx *= p.f; p.vy *= p.f;
        p.life -= p.decay;
        const a = Math.max(0, p.life);
        fctx.beginPath();
        fctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, Math.PI * 2);
        fctx.fillStyle = p.color.replace('$', a.toFixed(3));
        fctx.fill();
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  function emit(x, y, n, opt) {
    for (let i = 0; i < n; i++) {
      const ang = opt.spread ? opt.spread() : Math.random() * Math.PI * 2;
      const sp = opt.speed[0] + Math.random() * (opt.speed[1] - opt.speed[0]);
      sparks.push({
        x, y,
        vx: Math.cos(ang) * sp + (opt.vx || 0),
        vy: Math.sin(ang) * sp + (opt.vy || 0),
        g: opt.g ?? 0.01,
        f: opt.f ?? 0.985,
        r: opt.r[0] + Math.random() * (opt.r[1] - opt.r[0]),
        life: 1,
        decay: opt.decay ?? 0.012,
        color: opt.colors[(Math.random() * opt.colors.length) | 0],
      });
    }
    start();
  }

  /* 谢幕烟花：三束，短促收敛 */
  function fireworks() {
    const cx = innerWidth / 2, cy = innerHeight * 0.36;
    const colors = ['rgba(226, 192, 122, $)', 'rgba(168, 216, 180, $)', 'rgba(255, 240, 210, $)'];
    const bursts = [
      { x: cx - innerWidth * 0.22, y: cy, d: 0 },
      { x: cx + innerWidth * 0.22, y: cy, d: 320 },
      { x: cx, y: cy - 60, d: 640 },
    ];
    for (const b of bursts) {
      setTimeout(() => emit(b.x, b.y, 44, {
        speed: [1.5, 4.2],
        g: 0.028,
        f: 0.975,
        r: [1.0, 2.4],
        decay: 0.011,
        colors,
      }), b.d);
    }
  }

  return { start, fireworks };
})();
