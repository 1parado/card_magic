/* ============================================================
 * main.js —— 入口装配：开场、设置（音效/速度/重开）、
 * 快速连点保护由 show.js 的 token 机制与二次确认承担。
 * ============================================================ */

const main = (() => {
  const overlay = document.getElementById('overlay');
  const spotlight = document.getElementById('spotlight');
  const btnStart = document.getElementById('btn-start');
  const btnSound = document.getElementById('btn-sound');
  const btnSpeed = document.getElementById('btn-speed');
  const btnRestart = document.getElementById('btn-restart');

  const SPEEDS = [
    { label: '悠闲', v: 0.75 },
    { label: '标准', v: 1 },
    { label: '快速', v: 1.55 },
  ];
  let speedIdx = 1;

  function refreshSoundBtn() {
    btnSound.textContent = '♪';
    btnSound.title = audio.isMuted() ? '音效：关' : '音效：开';
    btnSound.style.opacity = audio.isMuted() ? '0.3' : '';
  }

  function refreshSpeedBtn() {
    animator.setSpeed(SPEEDS[speedIdx].v);
    btnSpeed.title = `速度：${SPEEDS[speedIdx].label}`;
  }

  /* 重新开始：3 秒内二次点击才生效，防止误触打断演出 */
  function armRestart() {
    if (btnRestart.dataset.armed) {
      delete btnRestart.dataset.armed;
      btnRestart.textContent = '↻';
      show.restart();
      return;
    }
    btnRestart.dataset.armed = '1';
    btnRestart.textContent = '确认？';
    setTimeout(() => {
      if (btnRestart.dataset.armed) {
        delete btnRestart.dataset.armed;
        btnRestart.textContent = '↻';
      }
    }, 3000);
  }

  function bind() {
    btnStart.addEventListener('click', () => {
      audio.init();                    // 用户手势内初始化（自动播放策略）
      particles.start();
      overlay.classList.add('hidden');
      spotlight.classList.remove('off');
      show.start();
    }, { once: true });

    btnSound.addEventListener('click', () => {
      audio.init();
      audio.setMuted(!audio.isMuted());
      refreshSoundBtn();
    });

    btnSpeed.addEventListener('click', () => {
      speedIdx = (speedIdx + 1) % SPEEDS.length;
      refreshSpeedBtn();
    });

    btnRestart.addEventListener('click', armRestart);
  }

  function boot() {
    refreshSoundBtn();
    refreshSpeedBtn();
    bind();
  }

  boot();
  return {};
})();
