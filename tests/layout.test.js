'use strict';
/*
 * 版面巡檢（需要 playwright 與 Chrome／Chromium）：npm run verify:ui
 * 在手機／平板直橫向與桌機、中英文下開啟每個畫面，檢查：
 *   1. 沒有橫向捲動、沒有元素超出視窗（被自訂捲軸或遮罩裁切者除外）
 *   2. 沒有原生表單控制項（select、checkbox、radio、range、number）與原生捲軸
 *   3. 沒有 console 錯誤
 * 螢幕截圖只在傳入 --shots <資料夾> 時輸出，預設不留任何檔案。
 */
const path = require('path');
const fs = require('fs');
let chromium;
try { chromium = require('playwright').chromium; } catch (e) { console.log('略過：沒有安裝 playwright'); process.exit(0); }
const { server } = require('../server.js');

const VIEWS = [
  ['phone-s', 360, 640, true], ['phone-p', 390, 844, true], ['phone-l', 844, 390, true], ['tablet-p', 820, 1180, true], ['tablet-l', 1180, 820, true],
  ['ipad-pro-l', 1366, 1024, true], ['desktop', 1440, 900, false]
];
// --quick 只跑代表性的三種螢幕（開發時用）；預設跑全部
const QUICK = process.argv.indexOf('--quick') !== -1;
const shotsDir = process.argv.indexOf('--shots') !== -1 ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const exe = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(fs.existsSync)[0];

const CHECK = function () {
  const vw = window.innerWidth, vh = window.innerHeight, out = [];
  const clipped = function (el) {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(hidden|auto|scroll|clip)/.test(cs.overflowX)) return true;
    }
    return false;
  };
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) out.push('文件橫向捲動 ' + de.scrollWidth + '>' + vw);
  document.querySelectorAll('body *').forEach(function (el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if ((r.right > vw + 1 || r.left < -1) && !clipped(el) && !el.closest('svg') && !el.closest('.hazard,.toast,.menu-pop')) out.push('超出視窗：' + el.tagName + '.' + String(el.className).slice(0, 30) + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']');
    const tag = el.tagName;
    if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && /^(checkbox|radio|range|number|date|file|color)$/.test(el.type))) out.push('原生控制項：' + tag + (el.type ? '[' + el.type + ']' : ''));
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && !el.classList.contains('sa-view') && cs.scrollbarWidth !== 'none') out.push('原生捲軸：' + el.tagName + '.' + String(el.className).slice(0, 30));
    if ((tag === 'BUTTON' || tag === 'A') && !el.textContent.trim() && !el.getAttribute('aria-label') && !el.closest('[aria-hidden="true"]')) out.push('按鈕沒有可讀名稱：' + tag + '.' + String(el.className).slice(0, 30));
    if ((tag === 'BUTTON' || tag === 'A') && r.width < 32 && r.height < 32 && !el.closest('svg')) out.push('按鈕太小（' + Math.round(r.width) + '×' + Math.round(r.height) + '）：' + String(el.className).slice(0, 30));
    if (el.classList.contains('overlay') || el.classList.contains('dialog')) { if (r.bottom > vh + 1 && !clipped(el)) out.push('對話框超出高度'); }
  });
  return out;
};

(async function main() {
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const prog = {}; for (let i = 1; i <= 12; i++) prog[i] = 3;
  const problems = []; const errors = []; let scenes = 0;
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  for (const v of (QUICK ? VIEWS.filter(function (x) { return ['phone-s', 'tablet-p', 'desktop'].indexOf(x[0]) !== -1; }) : VIEWS)) {
    for (const lang of ['zh-TW', 'en']) {
      const ctx = await browser.newContext({ viewport: { width: v[1], height: v[2] }, hasTouch: v[3] });
      await ctx.addInitScript('localStorage.setItem("as.progress.v1", JSON.stringify({baby:' + JSON.stringify(prog) + '}))');
      const pg = await ctx.newPage();
      pg.on('pageerror', function (e) { errors.push(v[0] + '/' + lang + ' pageerror ' + e.message); });
      pg.on('console', function (m) { if (m.type() === 'error') errors.push(v[0] + '/' + lang + ' console ' + m.text()); });
      await pg.goto(base); await pg.waitForSelector('.home');
      await pg.evaluate(function (l) { I18N.setLang(l); }, lang);
      const scene = async function (name, fn) {
        await fn(); await pg.waitForTimeout(250); scenes++;
        const res = await pg.evaluate(CHECK);
        res.forEach(function (m) { problems.push(v[0] + '/' + lang + '/' + name + '：' + m); });
        if (shotsDir) await pg.screenshot({ path: path.join(shotsDir, v[0] + '_' + lang + '_' + name + '.png') });
      };
      await scene('home', async function () { await pg.evaluate(function () { App.go('home'); }); });
      // 「回遊戲大廳」只在首頁左上角出現，且完整落在視窗內
      const lob = await pg.evaluate(function () { const a = document.querySelector('.topbar .lobby-link'); if (!a) return null; const r = a.getBoundingClientRect(); return { href: a.getAttribute('href'), x: r.left, r: r.right, top: r.top, vw: innerWidth }; });
      if (!lob || lob.href !== 'https://pjh-eric.github.io/game-lobby/' || lob.x < 0 || lob.r > lob.vw / 2 || lob.top > 60) problems.push(v[0] + '/' + lang + '/home：回遊戲大廳按鈕缺少或位置不對 ' + JSON.stringify(lob));
      await scene('howto', async function () { await pg.click('.home .btn.ghost >> nth=0').catch(function () {}); });
      await pg.evaluate(function () { document.querySelectorAll('.overlay').forEach(function (o) { o.remove(); }); });
      await scene('settings', async function () { await pg.evaluate(function () { App.go('home'); }); await pg.click('.topbar .btn.icon'); await pg.waitForSelector('.overlay'); });
      await pg.evaluate(function () { document.querySelectorAll('.overlay').forEach(function (o) { o.remove(); }); });
      await scene('campaign', async function () { await pg.evaluate(function () { App.go('campaign', { diff: 'baby' }); }); });
      if (await pg.evaluate(function () { return !!document.querySelector('.lobby-link'); })) problems.push(v[0] + '/' + lang + '/campaign：回遊戲大廳按鈕只應出現在首頁');
      await scene('daily', async function () { await pg.evaluate(function () { App.go('daily', { diff: 'normal' }); }); });
      await scene('random', async function () { await pg.evaluate(function () { App.go('random', { diff: 'hard' }); }); });
      await scene('play-random', async function () { await pg.evaluate(function () { App.go('play', { mode: 'random', diff: 'hard', seed: 'audit' }); }); await pg.waitForSelector('.panel'); });
      const kinds = ['deduce', 'arith', 'pyramid', 'rule', 'near', 'scale'];
      for (let lv = 1; lv <= 6; lv++) {
        await scene('play-' + kinds[lv - 1], async function () { await pg.evaluate(function (n) { App.go('play', { diff: 'baby', level: n }); }, lv); await pg.waitForSelector('.panel'); });
        await scene('solution-' + kinds[lv - 1], async function () { await pg.click('text=' + (lang === 'en' ? 'Show Solution' : '看解法')); await pg.waitForSelector('.overlay svg.figure'); });
      }
      // 神話難度：題目最大（5 位密碼、6 層金字塔、5 個圖形），檢查大題的版面與解法圖
      for (let lv = 1; lv <= 6; lv++) {
        await scene('myth-' + kinds[lv - 1], async function () { await pg.evaluate(function (n) { App.go('play', { diff: 'myth', level: n }); }, lv); await pg.waitForSelector('.panel'); });
        await scene('myth-sol-' + kinds[lv - 1], async function () { await pg.click('text=' + (lang === 'en' ? 'Show Solution' : '看解法')); await pg.waitForSelector('.overlay svg.figure'); });
      }
      // 長結算：魔王關三題、隨機挑戰五題
      await scene('boss-result', async function () { await pg.evaluate(function () { App.go('play', { diff: 'hard', level: 10 }); }); await pg.waitForSelector('.panel'); await pg.click('text=' + (lang === 'en' ? 'Show Solution' : '看解法')); await pg.waitForSelector('.overlay svg.figure'); });
      await scene('random-result', async function () { await pg.evaluate(function () { App.go('play', { mode: 'random', diff: 'myth', seed: 'audit2' }); }); await pg.waitForSelector('.panel'); await pg.click('text=' + (lang === 'en' ? 'Show Solution' : '看解法')); await pg.waitForSelector('.overlay svg.figure'); });
      await scene('online-lobby', async function () { await pg.evaluate(function () { App.go('online', {}); }); await pg.waitForSelector('.room-card, text=' + (lang === 'en' ? 'New room' : '開新房間'), { timeout: 8000 }).catch(function () {}); });
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  console.log('巡檢 ' + scenes + ' 個畫面');
  errors.concat(problems).slice(0, 60).forEach(function (m) { console.log('  ✗ ' + m); });
  const bad = errors.length + problems.length;
  console.log(bad ? bad + ' 個問題' : '全部通過');
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
