/* 伺服器暫停提示：連續 30 秒連不上才跳出、只在線上畫面、連上即取消、同一次故障只提示一次。 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function setup() {
  let clock = 0, next = 0;
  const timers = new Map();
  function el(tag) {
    return { tag, children: [], attrs: {}, isConnected: true, className: '', textContent: '',
      setAttribute(k, v) { this.attrs[k] = v; }, append(...n) { n.forEach(x => this.appendChild(x)); },
      appendChild(n) { this.children.push(n); n.parent = this; }, addEventListener(k, f) { this[k] = f; },
      remove() { this.parent.children = this.parent.children.filter(x => x !== this); this.isConnected = false; },
      focus() {}, querySelector(t) { return this.children.find(c => c.tag === t) || null; } };
  }
  const document = { activeElement: null, body: el('body'), createElement: el, addEventListener() {}, removeEventListener() {} };
  const window = { I18N: { t: (k) => ({ 'outage.title': '目前伺服器過載休息中', 'outage.body': '歡迎贊助升級', 'outage.ok': '知道了' })[k] } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/outage.js'), 'utf8'), {
    window, document,
    setTimeout(fn, d) { const id = ++next; timers.set(id, { at: clock + d, fn }); return id; },
    clearTimeout(id) { timers.delete(id); } });
  return { api: window.AngelOutage, body: document.body,
    tick(ms) { clock += ms; [...timers].filter(([, t]) => t.at <= clock).forEach(([id, t]) => { timers.delete(id); t.fn(); }); } };
}

let s = setup();
s.api.state('connecting'); s.tick(40000);
assert.equal(s.body.children.length, 0, '不在線上畫面時不提示');
s.api.setScreen('lobby'); s.api.state('connecting'); s.tick(29000);
assert.equal(s.body.children.length, 0, '未滿 30 秒不提示');
s.tick(2000);
assert.equal(s.body.children.length, 1, '連續 30 秒連不上就提示');
const panel = s.body.children[0].children[0];
assert.equal(panel.children[0].textContent, '目前伺服器過載休息中');
assert.equal(panel.children[1].textContent, '歡迎贊助升級');
s.api.state('closed'); s.tick(60000);
assert.equal(s.body.children.length, 1, '同一次故障只提示一次');
s.api.state('open');
assert.equal(s.body.children.length, 0, '連上後關閉提示');
s = setup(); s.api.setScreen('status'); s.api.state('connecting'); s.tick(20000); s.api.state('open'); s.tick(20000);
assert.equal(s.body.children.length, 0, '連上會取消計時');
s = setup(); s.api.setScreen('lobby'); s.api.state('connecting'); s.api.setScreen('match'); s.tick(40000);
assert.equal(s.body.children.length, 0, '對局中不提示');
console.log('✓ 伺服器暫停提示 6 項通過');
