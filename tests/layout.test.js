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
const exe = process.env.CHROME_PATH || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].filter(function (p) { return fs.existsSync(p); })[0];

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
    if ((el.classList.contains('btn') || el.classList.contains('slot')) && !el.closest('svg')) {
      const pan = el.closest('.panel, .dialog');
      if (pan) { const pr = pan.getBoundingClientRect(); if (r.right > pr.right + 1 || r.left < pr.left - 1) out.push('元素超出面板：' + el.tagName + '.' + String(el.className).slice(0, 30) + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + '] 面板 [' + Math.round(pr.left) + ',' + Math.round(pr.right) + ']'); }
    }
    // 被捲動區或 overflow:hidden 的容器「裁掉」的內容也算破版（橫向捲動容器 .h 與 SVG 除外）
    if (!el.closest('svg,.hazard,.toast,.menu-pop,.sa-view.h') && r.width < vw * 3) {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs2 = getComputedStyle(p);
        if (/(hidden|auto|scroll|clip)/.test(cs2.overflowX)) {
          if (cs2.textOverflow === 'ellipsis' || p.classList.contains('sa-view') && p.classList.contains('h')) break;
          const pr2 = p.getBoundingClientRect();
          if (r.right > pr2.right + 2 && pr2.width > 40) out.push('內容被裁切：' + el.tagName + '.' + String(el.className).slice(0, 30) + ' 右緣 ' + Math.round(r.right) + ' > 容器 ' + Math.round(pr2.right));
          break;
        }
      }
    }
    if ((el.classList.contains('btn') || el.classList.contains('badge') || el.classList.contains('kind-tag')) && el.scrollWidth > el.clientWidth + 2 && !el.closest('svg')) out.push('文字被截斷：' + String(el.className).slice(0, 24) + '「' + el.textContent.trim().slice(0, 16) + '」');
    const tag = el.tagName;
    if (tag === 'SELECT' || tag === 'TEXTAREA' || (tag === 'INPUT' && /^(checkbox|radio|range|number|date|file|color)$/.test(el.type))) out.push('原生控制項：' + tag + (el.type ? '[' + el.type + ']' : ''));
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && !el.classList.contains('sa-view') && cs.scrollbarWidth !== 'none') out.push('原生捲軸：' + el.tagName + '.' + String(el.className).slice(0, 30));
    if ((tag === 'BUTTON' || tag === 'A') && !el.textContent.trim() && !el.getAttribute('aria-label') && !el.closest('[aria-hidden="true"]')) out.push('按鈕沒有可讀名稱：' + tag + '.' + String(el.className).slice(0, 30));
    if ((tag === 'BUTTON' || tag === 'A') && r.width < 32 && r.height < 32 && !el.closest('svg')) out.push('按鈕太小（' + Math.round(r.width) + '×' + Math.round(r.height) + '）：' + String(el.className).slice(0, 30));
    if (el.classList.contains('overlay') || el.classList.contains('dialog')) { if (r.bottom > vh + 1 && !clipped(el)) out.push('對話框超出高度'); }
  });
  // 互相重疊的按鈕／標籤／輸入框（浮動聊天氣泡與 SVG 除外；有對話框時只檢查對話框內）
  // 只比較「真的看得到」的部分：與所有會裁切的祖先容器取交集
  const visRect = function (e) {
    const r = e.getBoundingClientRect(); let L = r.left, T = r.top, R = r.right, B = r.bottom;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const q = p.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); B = Math.min(B, q.bottom); }
    }
    return { left: L, top: T, right: R, bottom: B };
  };
  const ovs = document.querySelectorAll('.overlay'); const scope = ovs.length ? ovs[ovs.length - 1] : document;   // 最上層的對話框
  const items = [].slice.call(scope.querySelectorAll('.btn, .label, .field input, h3, .chip, .kind-tag, .badge')).filter(function (e) {
    if (e.closest('svg,.lc-bubble,.toast,.menu-pop,.lc-panel')) return false;
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < vh;
  });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const A = items[i], B = items[j];
    if (A.contains(B) || B.contains(A)) continue;
    const a = visRect(A), b = visRect(B);
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 3 && h > 3) out.push('重疊：' + (A.className || A.tagName).toString().slice(0, 24) + '「' + A.textContent.trim().slice(0, 10) + '」與 ' + (B.className || B.tagName).toString().slice(0, 24) + '「' + B.textContent.trim().slice(0, 10) + '」');
  }
  return out;
};

(async function main() {
  await new Promise(function (r) { server.listen(0, '127.0.0.1', r); });
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const prog = {}; for (let i = 1; i <= 12; i++) prog[i] = 3;
  const problems = []; const errors = []; let scenes = 0;
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  for (const v of (QUICK ? VIEWS.filter(function (x) { return ['phone-s', 'tablet-p', 'desktop'].indexOf(x[0]) !== -1; }) : VIEWS)) {
    for (const lang of (process.argv.indexOf('--all-langs') !== -1 ? ['zh-TW', 'zh-CN', 'en', 'ja', 'ko'] : ['zh-TW', 'en'])) {
      console.log('巡檢 ' + v[0] + '/' + lang);
      const browser = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
      const ctx = await browser.newContext({ viewport: { width: v[1], height: v[2] }, hasTouch: v[3] });
      // 幼幼與神話 1～12 關、困難第 10 關都算「已通關」，結算才看得到解法圖
      await ctx.addInitScript('Object.defineProperty(window, "GAME_SERVER_URL", { configurable: true, get: function () { return location.origin; }, set: function () {} }); localStorage.setItem("as.progress.v1", JSON.stringify({baby:' + JSON.stringify(prog) + ',myth:' + JSON.stringify(prog) + ',hard:' + JSON.stringify(prog) + '}))');
      await ctx.addInitScript('window.__noCountdown = true');   // 其餘場景略過 3‧2‧1，倒數另有專屬場景
      const pg = await ctx.newPage();
      pg.on('pageerror', function (e) { errors.push(v[0] + '/' + lang + ' pageerror ' + e.message); });
      pg.on('console', function (m) { if (m.type() === 'error') errors.push(v[0] + '/' + lang + ' console ' + m.text()); });
      await pg.goto(base); await pg.waitForSelector('.home');
      await pg.evaluate(function (l) { I18N.setLang(l); }, lang);
      // 依目前語言找按鈕文字（五種語言都適用）
      const clickT = async function (key) { const label = await pg.evaluate(function (k) { return I18N.t(k); }, key); await pg.locator('.btn', { hasText: label }).first().click(); };
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
      await scene('countdown', async function () { await pg.evaluate(function () { window.__noCountdown = false; App.go('play', { diff: 'normal', level: 3 }); }); await pg.waitForSelector('.cd'); await pg.waitForTimeout(900); });
      if (await pg.evaluate(function () { const c = document.querySelector('.cd'); if (!c) return 'missing'; const r = c.getBoundingClientRect(), p = document.querySelector('.screen .sa-view').getBoundingClientRect(); return r.top <= p.top && r.bottom >= p.bottom && r.left <= p.left && r.right >= p.right ? '' : 'leak'; }) !== '') problems.push(v[0] + '/' + lang + '/countdown：倒數遮罩沒有完整蓋住題目');
      const tm0 = await pg.evaluate(function () { return document.querySelector('.hud .tm').textContent; });
      await pg.waitForSelector('.cd', { state: 'detached', timeout: 5000 });
      const tm1 = await pg.evaluate(function () { return document.querySelector('.hud .tm').textContent; });
      if (parseInt(tm0, 10) - parseInt(tm1, 10) > 1) problems.push(v[0] + '/' + lang + '/countdown：倒數期間不應計時（' + tm0 + '→' + tm1 + '）');
      await pg.evaluate(function () { window.__noCountdown = true; });
      await scene('play-random', async function () { await pg.evaluate(function () { App.go('play', { mode: 'random', diff: 'hard', seed: 'audit' }); }); await pg.waitForSelector('.panel'); });
      const kinds = ['deduce', 'arith', 'pyramid', 'rule', 'near', 'scale'];
      for (let lv = 1; lv <= 6; lv++) {
        await scene('play-' + kinds[lv - 1], async function () { await pg.evaluate(function (n) { App.go('play', { diff: 'baby', level: n }); }, lv); await pg.waitForSelector('.panel'); });
        await scene('solution-' + kinds[lv - 1], async function () { await clickT('play.giveup'); await pg.waitForSelector('.overlay svg.figure'); });
      }
      // 神話難度：題目最大（5 位密碼、6 層金字塔、5 個圖形），檢查大題的版面與解法圖
      for (let lv = 1; lv <= 6; lv++) {
        await scene('myth-' + kinds[lv - 1], async function () { await pg.evaluate(function (n) { App.go('play', { diff: 'myth', level: n }); }, lv); await pg.waitForSelector('.panel'); });
        await scene('myth-sol-' + kinds[lv - 1], async function () { await clickT('play.giveup'); await pg.waitForSelector('.overlay svg.figure'); });
      }
      // 長結算：魔王關三題、隨機挑戰五題
      await scene('boss-result', async function () { await pg.evaluate(function () { App.go('play', { diff: 'hard', level: 10 }); }); await pg.waitForSelector('.panel'); await clickT('play.giveup'); await pg.waitForSelector('.overlay svg.figure'); });
      await scene('share-dialog', async function () { await pg.click('.overlay .share-open'); await pg.waitForSelector('.share-img:not([hidden])', { timeout: 15000 }); });
      await pg.evaluate(function () { document.querySelectorAll('.overlay').forEach(function (o) { o.remove(); }); });
      // 隨機挑戰沒過關：解法要鎖住（只顯示「通關後才能看解法」）
      await scene('random-result', async function () { await pg.evaluate(function () { App.go('play', { mode: 'random', diff: 'myth', seed: 'audit2' }); }); await pg.waitForSelector('.panel'); await clickT('play.quit'); await pg.click('.overlay .btn.primary'); await pg.waitForSelector('.overlay .sol-locked'); });
      if (await pg.evaluate(function () { return document.querySelectorAll('.overlay svg.figure').length; })) problems.push(v[0] + '/' + lang + '/random-result：沒過關卻顯示了解法圖');
      await scene('records', async function () { await pg.evaluate(function () { App.go('records', { tab: 'stats' }); }); });
      await scene('achievements', async function () { await pg.evaluate(function () { App.go('records', { tab: 'ach' }); }); });
      await scene('online-lobby', async function () {
        await pg.evaluate(function () { App.go('online', {}); });
        await pg.waitForSelector('.lobby-top .btn.primary', { timeout: 8000 });
        const chatClose = pg.locator('.lc-panel header button[aria-label]').last();
        if (await chatClose.isVisible()) await chatClose.click();
      });
      await scene('online-create-room', async function () {
        await clickT('on.create');
        await pg.waitForSelector('.dialog');
        const fmtBtn = pg.locator('.dialog .set-row .btn').first();
        for (const format of ['chips', 'elimination', 'points']) {
          await fmtBtn.click();
          await pg.waitForSelector('.menu-pop [role="option"]');
          const z = await pg.evaluate(function () {
            return {
              menu: Number(getComputedStyle(document.querySelector('.menu-pop')).zIndex),
              overlay: Number(getComputedStyle(document.querySelector('.overlay.top')).zIndex)
            };
          });
          if (z.menu <= z.overlay) problems.push(v[0] + '/' + lang + '/online-create-room：賽制選單被彈窗遮住 ' + JSON.stringify(z));
          const label = await pg.evaluate(function (f) { return I18N.t('room.fmt.' + f); }, format);
          const option = pg.locator('.menu-pop [role="option"]').filter({ hasText: label }).first();
          const hit = await option.evaluate(function (el) {
            const r = el.getBoundingClientRect();
            const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return target === el || el.contains(target);
          });
          if (!hit) problems.push(v[0] + '/' + lang + '/online-create-room：賽制選項無法點擊「' + label + '」');
          await option.click();
          const selected = await fmtBtn.textContent();
          if (!selected.includes(label)) problems.push(v[0] + '/' + lang + '/online-create-room：賽制選擇未生效「' + label + '」');
        }
      });
      await pg.locator('.dialog footer .btn.ghost').click();
      await pg.waitForSelector('.dialog', { state: 'detached' });
      await ctx.close();
      await browser.close();
    }
  }
  server.close();
  console.log('巡檢 ' + scenes + ' 個畫面');
  errors.concat(problems).slice(0, 60).forEach(function (m) { console.log('  ✗ ' + m); });
  const bad = errors.length + problems.length;
  console.log(bad ? bad + ' 個問題' : '全部通過');
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
