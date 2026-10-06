/* ============================================================
 * i18n.js —— 中 / 英双语
 *
 * 用法：show.js / main.js 里 t('key') 取文案；i18n.cardName(card)
 * 取牌名；i18n.applyStatic() 刷新 overlay / 标题等静态 DOM。
 * 偏好存 localStorage('magic-lang')，默认跟随浏览器语言。
 * ============================================================ */

const i18n = (() => {
  const dict = {
    zh: {
      title: '午夜剧场 · 纸牌魔术秀',
      overlayTitle: '午夜剧场',
      enter: '入 场',
      act: { prologue: '序幕', reader: '读心术', curtain: '谢幕' },
      btn: { gather: '收起', gotIt: '记好了', again: '再来一次' },
      lines: {
        closer: '请坐近一点。',
        ordinary: '一副最普通的牌。',
        shuffle: '洗牌，切牌。',
        fan: '五十二张，没有任何秘密。',
        enough: '二十七张牌，足够了。',
        pick: '这二十七张里，挑一张记住。',
        col1: '它在哪一列？',
        colNext: '现在，它在哪一列？',
        sense: '……让我感应。',
        mid1: '你的列，夹进正中间。',
        mid2: '再一次。',
        mid3: '最后一次。',
        noEyes: '接下来，我不需要眼睛。',
        think: '心里，默念你的牌。',
        notThis: '不是这张……不是这张……',
        andYours: '而你心里那张——',
        stepOut: '它自己会走出来。',
        miracle: '见证奇迹的时刻',
        closing: '我没看过任何一张牌面。可它，就在这里。',
      },
      suits: { '♠': '黑桃', '♥': '红心', '♦': '方块', '♣': '梅花' },
      of: '',
      toast: '语言已切换，演出重新开始。',
    },
    en: {
      title: 'The Card Room · A Card Magic Show',
      overlayTitle: 'The Card Room',
      enter: 'ENTER',
      act: { prologue: 'Prologue', reader: 'The Mind Reader', curtain: 'Curtain Call' },
      btn: { gather: 'Gather', gotIt: 'Got it', again: 'Play again' },
      lines: {
        closer: 'Come a little closer.',
        ordinary: 'A perfectly ordinary deck.',
        shuffle: 'Shuffled. Cut.',
        fan: 'Fifty-two cards. No secrets.',
        enough: 'Twenty-seven will do.',
        pick: 'Pick one. Memorize it.',
        col1: 'Which column is it in?',
        colNext: 'And now?',
        sense: 'Let me feel it…',
        mid1: 'Your column, back in the middle.',
        mid2: 'Once more.',
        mid3: 'One last time.',
        noEyes: 'Now I need no eyes.',
        think: 'Think of your card.',
        notThis: 'Not this one… not this one…',
        andYours: 'And the one in your mind—',
        stepOut: 'It will step forward on its own.',
        miracle: 'Witness the impossible',
        closing: 'I never saw a single face. Yet here it is.',
      },
      suits: { '♠': 'Spades', '♥': 'Hearts', '♦': 'Diamonds', '♣': 'Clubs' },
      of: ' of ',
      toast: 'Language switched — restarting the show.',
    },
  };

  let lang = localStorage.getItem('magic-lang')
    || (navigator.language && navigator.language.startsWith('zh') ? 'zh' : 'en');
  if (!dict[lang]) lang = 'zh';

  function t(key) {
    return dict[lang].lines[key] ?? dict.zh.lines[key] ?? key;
  }

  function cardName(card) {
    const d = dict[lang];
    const suit = d.suits[card.suit] ?? dict.zh.suits[card.suit];
    return d.of ? `${card.rank} of ${suit}` : `${suit}${card.rank}`;
  }

  /* 刷新静态 DOM（overlay、标题、按钮文字） */
  function applyStatic() {
    document.documentElement.lang = lang;
    document.title = dict[lang].title;
    const h1 = document.getElementById('overlay-title');
    if (h1) h1.textContent = dict[lang].overlayTitle;
    const enter = document.getElementById('btn-start');
    if (enter) enter.textContent = dict[lang].enter;
  }

  function setLang(l) {
    if (!dict[l] || l === lang) return;
    lang = l;
    localStorage.setItem('magic-lang', l);
    applyStatic();
  }

  applyStatic();

  return { t, cardName, setLang, get lang() { return lang; } };
})();
