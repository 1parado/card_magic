/* ============================================================
 * face.js —— SVG 矢量牌面生成器
 *
 * 设计规格（统一材质参数，与 cards.css 的 tokens 一致）：
 *   牌面 viewBox 0 0 90 126；暖白纸色由 cards.css 提供，
 *   此处只负责印刷层：角标、花色、数字点阵、A 与人物牌。
 *   所有花色使用内置 path，不依赖字体渲染。
 * ============================================================ */

const face = (() => {
  /* ---------- 花色 path（归一化 100×100） ---------- */
  const SUIT_PATH = {
    '♠': 'M50 5 C31 28 13 39 13 57 C13 70 24 77 34 74 C39 72 43 69 45 65 C44 76 41 84 34 92 L66 92 C59 84 56 76 55 65 C57 69 61 72 66 74 C76 77 87 70 87 57 C87 39 69 28 50 5 Z',
    '♥': 'M50 91 C24 67 9 51 9 33 C9 19 20 9 33 9 C41 9 47 13 50 21 C53 13 59 9 67 9 C80 9 91 19 91 33 C91 51 76 67 50 91 Z',
    '♦': 'M50 4 L85 50 L50 96 L15 50 Z',
    '♣': 'M50 7 A15 15 0 0 1 65 22 A15 15 0 0 1 62 31 A15 15 0 1 1 55 55 C55 68 58 80 65 90 L35 90 C42 80 45 68 45 55 A15 15 0 1 1 38 31 A15 15 0 0 1 35 22 A15 15 0 0 1 50 7 Z',
  };

  const isRed = (suit) => suit === '♥' || suit === '♦';

  /* ---------- 数字牌点阵布局（x: 左27/中45/右63；rot=倒置） ---------- */
  const L = 27, C = 45, R = 63;
  const PIPS = {
    '2':  [[C, 24], [C, 102, 1]],
    '3':  [[C, 24], [C, 63], [C, 102, 1]],
    '4':  [[L, 24], [R, 24], [L, 102, 1], [R, 102, 1]],
    '5':  [[L, 24], [R, 24], [C, 63], [L, 102, 1], [R, 102, 1]],
    '6':  [[L, 24], [R, 24], [L, 63], [R, 63], [L, 102, 1], [R, 102, 1]],
    '7':  [[L, 24], [R, 24], [C, 43], [L, 63], [R, 63], [L, 102, 1], [R, 102, 1]],
    '8':  [[L, 24], [R, 24], [C, 43], [L, 63], [R, 63], [C, 83, 1], [L, 102, 1], [R, 102, 1]],
    '9':  [[L, 24], [R, 24], [L, 50], [R, 50], [C, 63], [L, 76, 1], [R, 76, 1], [L, 102, 1], [R, 102, 1]],
    '10': [[L, 24], [R, 24], [C, 36], [L, 50], [R, 50], [L, 76, 1], [R, 76, 1], [C, 90, 1], [L, 102, 1], [R, 102, 1]],
  };
  const PIP_SIZE = { num: 13.5, ace: 42 };

  /* ---------- 角标（实体牌比例：rank 为主视觉层级，花色紧随） ---------- */
  function corner(card, x, y, rotate) {
    const t = rotate ? `transform="rotate(180 ${x} ${y})"` : '';
    const rankSize = card.rank.length > 1 ? 12.5 : 17;
    return `<g ${t}>
      <text x="${x}" y="${y + 9}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="${rankSize}" font-weight="700" fill="currentColor">${card.rank}</text>
      <use href="#suit-${card.suit}" x="${x - 6.5}" y="${y + 12}" width="13" height="13"/>
    </g>`;
  }

  /* ---------- 人物牌（对称纹章式剪影，墨印风格） ---------- */
  function courtSVG(card) {
    const s = card.suit;
    const frame = `
      <rect x="15" y="14" width="60" height="98" rx="3" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".55"/>
      <rect x="18.5" y="17.5" width="53" height="91" rx="2" fill="none" stroke="currentColor" stroke-width=".45" opacity=".5"/>`;
    const cornerPips = `
      <use href="#suit-${s}" x="21" y="21" width="11" height="11"/>
      <use href="#suit-${s}" x="58" y="94" width="11" height="11" transform="rotate(180 63.5 99.5)"/>`;

    let figure = '';
    if (card.rank === 'K') {
      figure = `
        <path d="M37 31 L41 21 L45.5 28 L50 19 L54.5 28 L59 21 L63 31 Z" fill="currentColor"/>
        <circle cx="50" cy="40" r="7.2" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M33 95 L37 60 Q50 50 63 60 L67 95 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M50 55 L50 90 M44 60 L56 60" stroke="currentColor" stroke-width="1.6" fill="none"/>
        <path d="M46 90 L50 96 L54 90 Z" fill="currentColor"/>`;
    } else if (card.rank === 'Q') {
      figure = `
        <path d="M36 31 Q43 20 50 21 Q57 20 64 31 L60 33 Q55 26 50 27 Q45 26 40 33 Z" fill="currentColor"/>
        <circle cx="41" cy="22" r="2"/><circle cx="50" cy="18.5" r="2"/><circle cx="59" cy="22" r="2"/>
        <circle cx="50" cy="40" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M34 95 Q31 64 41 57 Q50 51 59 57 Q69 64 66 95 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <circle cx="38" cy="70" r="2.6" fill="none" stroke="currentColor" stroke-width="1.1"/>
        <circle cx="62" cy="70" r="2.6" fill="none" stroke="currentColor" stroke-width="1.1"/>`;
    } else {
      figure = `
        <path d="M39 31 Q39 19 50 18 Q61 19 61 31 L61 34 L39 34 Z" fill="currentColor"/>
        <path d="M61 24 Q68 20 70 14 Q66 22 60 26 Z" fill="currentColor" opacity=".8"/>
        <circle cx="50" cy="40" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M36 95 L38 62 Q50 52 62 62 L64 95 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
        <path d="M40 88 L58 48" stroke="currentColor" stroke-width="1.5"/>
        <path d="M55 45 L61 51 L64 44 Z" fill="currentColor"/>`;
    }
    return frame + cornerPips + figure;
  }

  /* ---------- 完整牌面 ---------- */
  function cardFaceSVG(card) {
    const ink = isRed(card.suit) ? 'var(--card-ink-red)' : 'var(--card-ink)';
    let center = '';
    if (card.rank === 'A') {
      center = `<use href="#suit-${card.suit}" x="${45 - PIP_SIZE.ace / 2}" y="${63 - PIP_SIZE.ace / 2}"
        width="${PIP_SIZE.ace}" height="${PIP_SIZE.ace}"/>`;
    } else if (PIPS[card.rank]) {
      center = PIPS[card.rank].map(([px, py, rot]) => {
        const t = rot ? ` transform="rotate(180 ${px} ${py})"` : '';
        return `<use href="#suit-${card.suit}" x="${px - PIP_SIZE.num / 2}" y="${py - PIP_SIZE.num / 2}"
          width="${PIP_SIZE.num}" height="${PIP_SIZE.num}"${t}/>`;
      }).join('');
    } else {
      center = courtSVG(card);
    }
    return `<svg viewBox="0 0 90 126" xmlns="http://www.w3.org/2000/svg" style="color:${ink}">
      ${corner(card, 12, 6, false)}
      ${corner(card, 78, 120, true)}
      ${center}
    </svg>`;
  }

  /* ---------- 牌背：经典白墨蓝背（斜线菱格 + 交点碎花 + 对称卷草角花） ---------- */
  let uid = 0;
  function cardBackSVG() {
    const id = 'bk' + (++uid);
    const INK = '#dcd7c6';       /* 米白印刷墨 */
    const BASE = '#1c3568';      /* 深蓝纸底 */
    /* 卷草角花：左上一枚，其余三个由 use 旋转得到（严格对称） */
    const cornerFlourish =
      `<g id="${id}-cf" fill="none" stroke="${INK}" stroke-linecap="round">
         <path d="M9 30 Q9 9 30 9" stroke-width="1.1" opacity=".9"/>
         <path d="M9 24 Q12 12 24 9" stroke-width=".5" opacity=".6"/>
         <path d="M9 18 Q14 14 18 9" stroke-width=".5" opacity=".5"/>
         <circle cx="9" cy="30" r="1.1" fill="${INK}" stroke="none" opacity=".9"/>
         <circle cx="30" cy="9" r="1.1" fill="${INK}" stroke="none" opacity=".9"/>
       </g>`;
    /* 菱格交点的四瓣碎花（pattern 内复用） */
    const bloom = `<path d="M4.5 2.4 L5.2 3.8 L6.6 4.5 L5.2 5.2 L4.5 6.6 L3.8 5.2 L2.4 4.5 L3.8 3.8 Z" fill="${INK}" opacity=".9"/>`;
    return `<svg viewBox="0 0 90 126" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45 45 63)">
          <rect width="9" height="9" fill="${BASE}"/>
          <path d="M0 4.5 H9 M4.5 0 V9" stroke="${INK}" stroke-width=".5" opacity=".75"/>
          ${bloom}
        </pattern>
        ${cornerFlourish}
      </defs>
      <rect width="90" height="126" fill="#12244a"/>
      <rect x="1" y="1" width="88" height="124" rx="7" fill="${BASE}"/>
      <rect x="10" y="10" width="70" height="106" fill="url(#${id})"/>
      <rect x="5.5" y="5.5" width="79" height="115" rx="4.5" fill="none" stroke="${INK}" stroke-width="1" opacity=".9"/>
      <rect x="8" y="8" width="74" height="110" rx="3.5" fill="none" stroke="${INK}" stroke-width=".4" opacity=".5"/>
      <use href="#${id}-cf"/>
      <use href="#${id}-cf" transform="rotate(90 45 63)"/>
      <use href="#${id}-cf" transform="rotate(180 45 63)"/>
      <use href="#${id}-cf" transform="rotate(270 45 63)"/>
      <g transform="translate(45 63)">
        <circle r="16.5" fill="${BASE}" stroke="${INK}" stroke-width="1.1"/>
        <circle r="13" fill="none" stroke="${INK}" stroke-width=".4" opacity=".65"/>
        <path d="M0 -9.5 L2.2 -4.8 L7 -4 L3.5 -0.6 L4.4 4.2 L0 1.8 L-4.4 4.2 L-3.5 -0.6 L-7 -4 L-2.2 -4.8 Z"
          fill="none" stroke="${INK}" stroke-width=".7" opacity=".95"/>
        <circle r="1.6" fill="${INK}" opacity=".95"/>
        <circle cx="0" cy="-10.8" r=".9" fill="${INK}" opacity=".6"/>
        <circle cx="10.8" cy="0" r=".9" fill="${INK}" opacity=".6"/>
        <circle cx="0" cy="10.8" r=".9" fill="${INK}" opacity=".6"/>
        <circle cx="-10.8" cy="0" r=".9" fill="${INK}" opacity=".6"/>
      </g>
    </svg>`;
  }

  /* ---------- 花色符号 defs（注入一次，全页共用） ---------- */
  function installSuitDefs() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.setAttribute('width', '0');
    defs.setAttribute('height', '0');
    defs.style.position = 'absolute';
    defs.innerHTML = `<defs>${Object.entries(SUIT_PATH).map(([s, d]) =>
      `<symbol id="suit-${s}" viewBox="0 0 100 100"><path d="${d}" fill="currentColor"/></symbol>`).join('')}
    </defs>`;
    document.body.appendChild(defs);
  }

  return { cardFaceSVG, cardBackSVG, installSuitDefs };
})();
