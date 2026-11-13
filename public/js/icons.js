/*
 * 天使的策略 — 圖示集（原創線條圖示，24×24，鋼灰描邊＋琥珀重點）
 * Icon.html(name) -> SVG 字串；Icon.el(name, cls) -> <span class="ic">。
 * 描邊用 currentColor，重點色用 .ic-a（琥珀），所以同一個圖示在主按鈕、次按鈕上都清楚。
 */
(function () {
  'use strict';
  const P = {
    back: '<path d="M14.5 5 7.5 12l7 7"/><path class="ic-a" d="M8 12h10"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z"/><circle class="ic-f" cx="18.5" cy="5.5" r="1.6"/>',
    gear: '<path d="M12 2.8l1.6 2.3 2.7-.6.6 2.7 2.3 1.6-1.2 2.5 1.2 2.5-2.3 1.6-.6 2.7-2.7-.6L12 21.2l-1.6-2.3-2.7.6-.6-2.7-2.3-1.6L6 12.7 4.8 10.2l2.3-1.6.6-2.7 2.7.6z"/><circle class="ic-a" cx="12" cy="12" r="3"/>',
    chat: '<path d="M4 5.5h16v10H10l-4.5 3.5v-3.5H4z"/><path class="ic-a" d="M8 9.5h8M8 12.5h5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    backspace: '<path d="M9 5.5h11v13H9l-5.5-6.5z"/><path class="ic-a" d="m12.5 9.5 5 5m0-5-5 5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="1"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path class="ic-a" d="M12 14v2.5"/>',
    star: '<path class="ic-f" d="m12 3.5 2.5 5.3 5.8.7-4.3 4 1.1 5.7L12 16.4l-5.1 2.8L8 13.5l-4.3-4 5.8-.7z"/>',
    clock: '<circle cx="12" cy="12.5" r="8"/><path class="ic-a" d="M12 8v4.8l3 1.8"/><path d="M9.5 2.8h5"/>',
    bulb: '<path d="M8.5 15.5c-1.8-1.2-3-3.2-3-5.5a6.5 6.5 0 0 1 13 0c0 2.3-1.2 4.3-3 5.5v2h-7z"/><path class="ic-a" d="M9.5 20.5h5M12 8v4"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle class="ic-f" cx="12" cy="12" r="1.4"/>',
    flag: '<path d="M6 21V4"/><path class="ic-a" d="M6 4.5h11l-2.5 4 2.5 4H6"/>',
    stack: '<path d="m12 4 8 4-8 4-8-4z"/><path class="ic-a" d="m4 12 8 4 8-4"/><path d="m4 16 8 4 8-4"/>',
    // 題型
    deduce: '<rect x="4.5" y="9.5" width="15" height="10.5" rx="1"/><path d="M8 9.5V7a4 4 0 0 1 8 0v2.5"/><path class="ic-a" d="M8 15h1.5M11.3 15h1.5M14.5 15H16"/>',
    arith: '<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M4 9h16"/><path class="ic-a" d="M7 6.3h3M8.5 13v4M6.5 15h4M14 13.5l3 3m0-3-3 3"/>',
    pyramid: '<rect x="9.5" y="3.5" width="5" height="4" rx=".5"/><rect x="6.5" y="10" width="5" height="4" rx=".5"/><rect x="12.5" y="10" width="5" height="4" rx=".5"/><rect class="ic-a" x="3.5" y="16.5" width="5" height="4" rx=".5"/><rect class="ic-a" x="9.5" y="16.5" width="5" height="4" rx=".5"/><rect class="ic-a" x="15.5" y="16.5" width="5" height="4" rx=".5"/>',
    rule: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/><path class="ic-a" d="M7.5 10.5h1.2M10 10.5h1.2M12.5 10.5h1.2M10.5 7.5v1"/>',
    near: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path class="ic-a" d="M17 7l3.5-3.5M17 7h3M17 7V4"/><circle class="ic-f" cx="13.6" cy="10.4" r="1.2"/>',
    scale: '<path d="M12 4v16M8 20h8M4 7.5h16"/><path class="ic-a" d="M4 7.5 1.8 13a3 3 0 0 0 4.4 0zM20 7.5 17.8 13a3 3 0 0 0 4.4 0z"/><circle class="ic-f" cx="12" cy="4" r="1.3"/>',
    num: '<rect x="4" y="4" width="16" height="16" rx="2"/><path class="ic-a" d="M9.5 7.5 8.5 16.5M15.5 7.5l-1 9M6.8 10.3h10.6M6.6 13.7h10.6"/>',
    auction: '<path d="m13.5 4.5 6 6"/><path d="m11 7 6 6"/><path d="m12.2 5.8 6 6"/><path class="ic-a" d="m14 9.5-8.5 8.5"/><path d="M3.5 20.5h9"/>',
    hilo: '<path d="M8 19V5m0 0L4.5 8.5M8 5l3.5 3.5"/><path class="ic-a" d="M16 5v14m0 0 3.5-3.5M16 19l-3.5-3.5"/>',
    remove: '<rect x="3.5" y="6" width="9" height="13" rx="1" transform="rotate(-8 8 12.5)"/><rect x="10.5" y="5" width="9" height="13" rx="1" transform="rotate(8 15 11.5)"/><path class="ic-a" d="m12.8 9.4 4.4 4.4m0-4.4-4.4 4.4"/>',
    // 模式與頁面
    solo: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-6 7-6s6.2 2.4 7 6"/><path class="ic-a" d="M17.5 3.5l1.2 1.2 2.3-2.2"/>',
    daily: '<rect x="4" y="5.5" width="16" height="14.5" rx="1"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path class="ic-a" d="m9 15 2 2 4-4"/>',
    online: '<circle cx="12" cy="5.5" r="2.2"/><circle cx="5" cy="17.5" r="2.2"/><circle cx="19" cy="17.5" r="2.2"/><path class="ic-a" d="M11 7.5 6 15.5M13 7.5l5 8M7.2 17.5h9.6"/>',
    book: '<path d="M4 5.5c2.7-1 5.4-1 8 .8 2.6-1.8 5.3-1.8 8-.8V19c-2.7-1-5.4-1-8 .8-2.6-1.8-5.3-1.8-8-.8z"/><path class="ic-a" d="M12 6.3v13.5"/>',
    trophy: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4"/><path class="ic-a" d="M12 13.5V17M8.5 20h7l-1-3h-5z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle class="ic-a" cx="12" cy="12" r="3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path class="ic-a" d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path class="ic-a" d="M16 8V4H4v12h4"/>',
    crown: '<path d="m4 8 4 4 4-6 4 6 4-4-1.5 10h-13z"/><path class="ic-a" d="M5.5 20.5h13"/>',
    play: '<path class="ic-f" d="M8 5.5v13l10-6.5z"/>',
    home: '<path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/><path class="ic-a" d="M10 20v-5h4v5"/>',
    retry: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path class="ic-a" d="M19 4v4.5h-4.5"/>',
    room: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16"/><path class="ic-a" d="M8 13h3M8 16h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path class="ic-a" d="m13.5 6.5 4 4"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle class="ic-f" cx="8.2" cy="8.2" r="1.5"/><circle class="ic-f" cx="15.8" cy="8.2" r="1.5"/><circle class="ic-f" cx="12" cy="12" r="1.5"/><circle class="ic-f" cx="8.2" cy="15.8" r="1.5"/><circle class="ic-f" cx="15.8" cy="15.8" r="1.5"/>',
    download: '<path d="M12 4v11"/><path class="ic-a" d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
    share: '<circle cx="17.5" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path class="ic-a" d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6"/>',
    medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.5 6 3.5h4l2 5M15.5 10.5 18 3.5h-4l-2 5"/><path class="ic-a" d="m12 12.5.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path class="ic-a" d="M8 16v-4M12 16V8M16 16v-6"/>',
    bolt: '<path d="M13.5 3 5 13.5h6.5L10.5 21 19 10.5h-6.5z"/><path class="ic-a" d="M11.5 13.5 10.5 21"/>',
    send: '<path d="m4 12 16-7-6 16-2.5-6.5z"/><path class="ic-a" d="m11.5 14.5 3.5-3.5"/>',
    hint: '<circle cx="12" cy="12" r="8.5"/><path class="ic-a" d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7v.5"/><circle class="ic-f" cx="12" cy="17" r="1"/>',
    flagWhite: '<path d="M6 21V4"/><path d="M6 4.5h11v8H6"/><path class="ic-a" d="M9 7.5h5"/>',
    exit: '<path d="M14 4H5v16h9"/><path class="ic-a" d="M10 12h10m-3-3.5 3.5 3.5-3.5 3.5"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="ic-a" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    music: '<path d="M9 17.5V5.5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle class="ic-a" cx="16.5" cy="15.5" r="2.5"/>',
    timer: '<circle cx="12" cy="13" r="7.5"/><path d="M10 2.8h4M12 2.8v2.7"/><path class="ic-a" d="M12 13V9"/>'
  };
  function html(name, extra) {
    const body = P[name] || P.target;
    return '<svg class="ic-svg' + (extra ? ' ' + extra : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }
  function el(name, cls) {
    const s = document.createElement('span');
    s.className = 'ic' + (cls ? ' ' + cls : '');
    s.innerHTML = html(name);
    return s;
  }
  // 題型與玩法 → 圖示
  const KIND = { deduce: 'deduce', arith: 'arith', pyramid: 'pyramid', rule: 'rule', near: 'near', scale: 'scale', num: 'num', auction: 'auction', hilo: 'hilo', remove: 'remove', boss: 'trophy' };
  // 遊戲標誌：光環＋雙翼＋菱形核心（∴ 三點代表推理）；首頁與分享圖共用
  const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" aria-hidden="true"><defs><linearGradient id="lg-w" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#5cb7cf" stop-opacity=".04"/><stop offset="1" stop-color="#8fe3f5" stop-opacity=".4"/></linearGradient><radialGradient id="lg-g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f2a81d" stop-opacity=".38"/><stop offset="1" stop-color="#f2a81d" stop-opacity="0"/></radialGradient><linearGradient id="lg-c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173540"/><stop offset="1" stop-color="#0a1115"/></linearGradient><path id="lg-f" d="M0 0 C20 -10 54 -13 84 -4 C56 3 22 6 0 0Z"/><g id="lg-wing"><g fill="url(#lg-w)" stroke="#5cb7cf" stroke-width="1.8" stroke-linejoin="round"><use href="#lg-f" transform="rotate(-52)"/><use href="#lg-f" transform="rotate(-34) scale(.9)"/><use href="#lg-f" transform="rotate(-16) scale(.78)"/><use href="#lg-f" transform="rotate(2) scale(.62)"/></g><g stroke="#8fe3f5" stroke-width=".9" opacity=".55" fill="none"><path d="M4 -5 L48 -62"/><path d="M4 -3 L60 -40"/><path d="M4 -1 L58 -17"/></g></g></defs><ellipse cx="100" cy="28" rx="60" ry="22" fill="url(#lg-g)"/><g class="ring" fill="none" stroke="#f2a81d"><ellipse cx="100" cy="28" rx="40" ry="11" stroke-width="4"/><ellipse cx="100" cy="28" rx="29" ry="6.5" stroke-width="1.5" opacity=".55"/></g><use href="#lg-wing" transform="translate(114 96)"/><use href="#lg-wing" transform="translate(86 96) scale(-1 1)"/><path d="M100 58 L126 96 L100 140 L74 96 Z" fill="url(#lg-c)" stroke="#5cb7cf" stroke-width="3" stroke-linejoin="round"/><path d="M100 58 L126 96" stroke="#bdf1fb" stroke-width="1.4" opacity=".7"/><path d="M100 70 L117 96 L100 126 L83 96 Z" fill="none" stroke="#5cb7cf" stroke-width="1.2" opacity=".45"/><g fill="#f2a81d"><circle cx="100" cy="87" r="4.4"/><circle cx="91" cy="103" r="4.4"/><circle cx="109" cy="103" r="4.4"/></g></svg>';
  window.Icon = { logo: LOGO, html: html, el: el, kind: function (k) { return KIND[k] || 'target'; }, names: Object.keys(P) };
})();
