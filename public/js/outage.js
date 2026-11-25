/* 線上伺服器暫停提示：只在線上狀態／大廳／房間，連續 30 秒連不上伺服器才跳出；連上或離開就取消，同一次故障只提示一次。 */
(function (w) {
  'use strict';
  var WAIT_MS = 30000;
  var timer = null, active = false, shown = false, mask = null, previousFocus = null;
  var eligible = false, attempted = false;

  var SPONSOR_URL = 'https://portaly.cc/pjh-eric/support';
  var SPONSOR_WORD = { 'zh-TW': '贊助', 'zh-CN': '赞助', en: 'Sponsorships', ja: 'ご支援', ko: '후원' };

  function fillMessage(el, text) {
    var lang = (w.I18N && w.I18N.lang) || 'zh-TW';
    var word = SPONSOR_WORD[lang] || SPONSOR_WORD['zh-TW'];
    var at = text.indexOf(word);
    if (at < 0) { el.textContent = text; return; }
    var link = document.createElement('a');
    link.href = SPONSOR_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = word;
    el.append(document.createTextNode(text.slice(0, at)), link, document.createTextNode(text.slice(at + word.length)));
  }

  function T(key, fallback) { return (w.I18N && w.I18N.t) ? w.I18N.t(key) : fallback; }

  function close() {
    if (!mask) return;
    mask.remove();
    mask = null;
    document.removeEventListener('keydown', onKey, true);
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); var link = mask.querySelector('a'), btn = mask.querySelector('button'); (link && document.activeElement === btn ? link : btn).focus(); }
  }
  function show() {
    if (shown || !active || !eligible) return;
    shown = true;
    previousFocus = document.activeElement;
    mask = document.createElement('div');
    mask.className = 'outage-mask';
    var panel = document.createElement('section');
    panel.className = 'outage-panel';
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'outage-title');
    panel.setAttribute('aria-describedby', 'outage-message');
    var title = document.createElement('h2');
    title.id = 'outage-title';
    title.textContent = T('outage.title', '目前伺服器過載休息中');
    var message = document.createElement('p');
    message.id = 'outage-message';
    fillMessage(message, T('outage.body', '歡迎贊助升級'));
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn primary';
    button.textContent = T('outage.ok', '知道了');
    button.addEventListener('click', close);
    panel.append(title, message, button);
    mask.appendChild(panel);
    document.body.appendChild(mask);
    document.addEventListener('keydown', onKey, true);
    button.focus();
  }
  function reset() {
    clearTimeout(timer);
    timer = null; active = false; shown = false;
    close();
  }
  function setScreen(view) {
    var next = /^(status|invite|lobby|room)$/.test(view || '');
    if (eligible === next) return;
    eligible = next;
    if (!eligible) reset();
  }
  function state(value) {
    if (/^(open|idle|noserver)$/.test(value)) { attempted = false; reset(); return; }
    if (value === 'connecting') attempted = true;
    if (!attempted || !eligible || active) return;
    active = true;
    timer = setTimeout(show, WAIT_MS);
  }
  w.AngelOutage = { state: state, setScreen: setScreen };
})(window);
