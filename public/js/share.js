/*
 * 天使的策略 — 結算分享（參考 shoot-balloon 的結算分享：圖片在本機產生，可直接分享或下載 PNG）
 * Share.open({ title, sub, result, win, stats:[[label, value]], figures:[SVGElement], badges:[{name, tier}], lines:[[a, b]] })
 * 產生 1080 寬的地下設施風格結算圖：標題、結果、數據、解法圖（附標註）、本局解鎖的成就、遊戲網址。
 * 分享網址只保留遊戲本身（去掉查詢字串與邀請碼）。
 */
(function () {
  'use strict';
  const el = UI.el, t = function (k, v) { return I18N.t(k, v); };
  const C = { bg: '#0a0e11', panel: '#151c22', line: '#34434f', text: '#dbe4ea', dim: '#8396a4', amber: '#f2a81d', red: '#e0463d', green: '#3fbf90', cyan: '#5cb7cf' };
  // 依語言挑字型，日文／韓文／简体用各自的字型才不會缺字或字形不對
  const FONTS = { ja: '"Noto Sans JP","Hiragino Sans","Yu Gothic UI",Meiryo,', ko: '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",', 'zh-CN': '"Noto Sans SC","PingFang SC","Microsoft YaHei",' };
  let FONT = '';
  function pickFont() { FONT = (FONTS[I18N.lang] || '') + '"Noto Sans TC","PingFang TC","Microsoft JhengHei","Noto Sans CJK TC",system-ui,sans-serif'; }

  function cleanUrl() {
    const u = new URL(location.href);
    u.search = ''; u.hash = ''; u.username = ''; u.password = '';
    return u.href.replace(/index\.html$/, '');
  }

  // SVG 解法圖 → 圖片：把計算後的樣式寫進複製品，離開頁面 CSS 也能正確顯示
  const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'letter-spacing'];
  function svgToImage(svg) {
    // 圖必須在文件裡才算得出套用 CSS 後的樣式：暫時放到畫面外
    let host = null;
    if (!svg.isConnected) { host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1000px;visibility:hidden'; host.appendChild(svg); document.body.appendChild(host); }
    const clone = svg.cloneNode(true);
    const src = svg.querySelectorAll('*'), dst = clone.querySelectorAll('*');
    for (let i = 0; i < src.length; i++) {
      const cs = getComputedStyle(src[i]);
      PROPS.forEach(function (p) { const v = cs.getPropertyValue(p); if (v) dst[i].style.setProperty(p, v); });
    }
    const vb = svg.viewBox.baseVal;
    if (host) host.remove();
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', vb.width); clone.setAttribute('height', vb.height);
    clone.removeAttribute('style');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', vb.width); bg.setAttribute('height', vb.height); bg.setAttribute('fill', '#0b1014');
    clone.insertBefore(bg, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve({ img: img, w: vb.width, h: vb.height }); };
      img.onerror = function () { reject(new Error('svg')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    });
  }

  function cut(ctx, x, y, w, h, c) {
    ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + c); ctx.closePath();
  }
  function hazard(ctx, y, W) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, y, W, 14); ctx.clip();
    ctx.fillStyle = '#14181c'; ctx.fillRect(0, y, W, 14);
    ctx.fillStyle = C.amber;
    for (let x = -30; x < W + 30; x += 36) { ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x + 14, y); ctx.lineTo(x + 32, y); ctx.lineTo(x + 18, y + 14); ctx.fill(); }
    ctx.restore();
  }
  function fit(ctx, s, max) { while (ctx.measureText(s).width > max && s.length > 4) s = s.slice(0, -2) + '…'; return s; }

  async function render(o) {
    pickFont();
    const W = 1080, P = 64, CW = W - P * 2;
    const figs = [];
    for (const f of (o.figures || []).slice(0, 2)) { try { figs.push(await svgToImage(f)); } catch (e) { /* 單張失敗就略過 */ } }
    const figH = figs.map(function (f) { return Math.round(f.h * Math.min(1.8, (CW - 40) / f.w)); });
    const badges = (o.badges || []).slice(0, 6), lines = (o.lines || []).slice(0, 6);
    let H = 300 + 90 + (lines.length ? lines.length * 52 + 40 : 0) + figH.reduce(function (a, h) { return a + h + 90; }, 0) + (badges.length ? 70 + Math.ceil(badges.length / 2) * 62 : 0) + 170;
    H = Math.min(H, 8000);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    // 背景：深色＋格線＋光暈
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.2, 160, 10, W * 0.2, 160, 700); g.addColorStop(0, 'rgba(92,183,207,.18)'); g.addColorStop(1, 'rgba(92,183,207,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.035)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 44) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
    hazard(ctx, 0, W); hazard(ctx, H - 14, W);
    // 標誌與標題
    try {
      const lg = await new Promise(function (resolve, reject) {
        const img = new Image(); img.onload = function () { resolve(img); }; img.onerror = reject;
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(Icon.logo.replace('<svg ', '<svg width="200" height="160" '));
      });
      ctx.drawImage(lg, P - 10, 40, 125, 100);
    } catch (e) { /* 標誌載入失敗就只留文字 */ }
    ctx.fillStyle = '#eaf2f7'; ctx.font = '900 64px ' + FONT; ctx.textBaseline = 'alphabetic';
    ctx.fillText(t('app.name'), P + 124, 128);
    ctx.fillStyle = C.cyan; ctx.font = '700 24px ' + FONT; ctx.fillText('ANGEL STRATEGY', P + 128, 166);
    ctx.fillStyle = C.amber; ctx.font = '700 30px ' + FONT; ctx.fillText(fit(ctx, o.title + (o.sub ? '　' + o.sub : ''), CW), P, 236);
    ctx.fillStyle = C.line; ctx.fillRect(P, 258, CW, 2);
    let y = 330;
    ctx.fillStyle = o.win ? C.green : C.red; ctx.font = '900 58px ' + FONT; ctx.fillText(fit(ctx, o.result, CW), P, y);
    // 數據
    y += 30; let x = P;
    ctx.font = '700 26px ' + FONT;
    (o.stats || []).forEach(function (s) {
      const txt = s[0] + ' ' + s[1], w = ctx.measureText(txt).width + 36;
      if (x + w > W - P) { x = P; y += 62; }
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; cut(ctx, x, y, w, 46, 8); ctx.stroke();
      ctx.fillStyle = C.amber; ctx.fillText(txt, x + 18, y + 32); x += w + 14;
    });
    y += 90;
    // 名次或其他列表
    if (lines.length) {
      lines.forEach(function (ln, i) {
        ctx.fillStyle = i === 0 ? 'rgba(63,191,144,.12)' : C.panel; ctx.fillRect(P, y - 36, CW, 46);
        ctx.fillStyle = i === 0 ? C.green : C.text; ctx.font = '700 28px ' + FONT;
        ctx.fillText(fit(ctx, ln[0], CW * 0.65), P + 20, y);
        ctx.textAlign = 'right'; ctx.fillText(ln[1], W - P - 20, y); ctx.textAlign = 'left';
        y += 52;
      });
      y += 40;
    }
    // 解法圖
    figs.forEach(function (f, i) {
      ctx.fillStyle = C.green; ctx.font = '700 26px ' + FONT; ctx.fillText(o.figLabels && o.figLabels[i] ? o.figLabels[i] : t('res.solution'), P, y);
      y += 22;
      const w = Math.round(f.w * Math.min(1.8, (CW - 40) / f.w)), h = figH[i], fx = Math.round((W - w) / 2);
      ctx.fillStyle = '#0b1014'; ctx.strokeStyle = C.line; ctx.lineWidth = 2; cut(ctx, P, y, CW, h + 40, 14); ctx.fill(); ctx.stroke();
      ctx.drawImage(f.img, fx, y + 20, w, h);
      y += h + 68;
    });
    // 成就
    if (badges.length) {
      ctx.fillStyle = C.amber; ctx.font = '700 26px ' + FONT; ctx.fillText(t('ach.unlockedNow'), P, y); y += 22;
      badges.forEach(function (b, i) {
        const bx = P + (i % 2) * (CW / 2 + 6), by = y + Math.floor(i / 2) * 62, bw = CW / 2 - 6;
        const col = b.tier === 'gold' ? '#f2c14e' : (b.tier === 'silver' ? '#c8d3db' : '#d08b54');
        ctx.fillStyle = C.panel; ctx.strokeStyle = col; ctx.lineWidth = 2; cut(ctx, bx, by, bw, 50, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx + 26, by + 25, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.text; ctx.font = '700 24px ' + FONT; ctx.fillText(fit(ctx, b.name, bw - 60), bx + 46, by + 33);
      });
      y += Math.ceil(badges.length / 2) * 62 + 30;
    }
    // 頁尾：網址與標語
    const fy = H - 120;
    ctx.fillStyle = '#8a5f0c'; cut(ctx, P, fy, CW, 64, 12); ctx.fill();
    ctx.strokeStyle = C.amber; ctx.lineWidth = 2; cut(ctx, P, fy, CW, 64, 12); ctx.stroke();
    ctx.fillStyle = '#fff3d4'; ctx.font = '700 26px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText(fit(ctx, cleanUrl(), CW - 40), W / 2, fy + 41);
    ctx.fillStyle = C.dim; ctx.font = '500 22px ' + FONT; ctx.fillText(t('share.tag'), W / 2, fy - 18);
    ctx.textAlign = 'left';
    return new Promise(function (resolve, reject) { cv.toBlob(function (b) { cv.width = cv.height = 0; b ? resolve(b) : reject(new Error('png')); }, 'image/png'); });
  }

  /* 分享對話框：預覽＋「分享圖片」＋「下載 PNG」 */
  function open(o) {
    const status = el('p', { class: 'muted share-status', role: 'status', 'aria-live': 'polite', text: t('share.making') });
    const img = el('img', { class: 'share-img', alt: t('share.alt') });
    img.hidden = true;
    let file = null, url = null;
    const shareBtn = UI.button(t('share.send'), { cls: 'primary', icon: 'share', disabled: true, onClick: async function () {
      if (!file) return;
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: t('app.name') }); status.textContent = t('share.done'); }
        else { download(); status.textContent = t('share.noShare'); }
      } catch (e) { status.textContent = e && e.name === 'AbortError' ? t('share.cancel') : t('share.noShare'); }
    } });
    const dlBtn = UI.button(t('share.download'), { cls: 'ghost', icon: 'download', disabled: true, onClick: download });
    function download() {
      if (!url) return;
      const a = document.createElement('a'); a.href = url; a.download = 'angel-strategy-' + Date.now() + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    }
    const m = UI.modal({ title: t('share.title'), top: true, body: [status, el('div', { class: 'share-preview' }, [img])], footer: [shareBtn, dlBtn] });
    const oldClose = m.close; m.close = function () { if (url) URL.revokeObjectURL(url); oldClose(); };
    render(o).then(function (blob) {
      file = new File([blob], 'angel-strategy.png', { type: 'image/png' });
      url = URL.createObjectURL(blob); img.src = url; img.hidden = false;
      status.textContent = t('share.ready'); shareBtn.disabled = false; dlBtn.disabled = false;
    }).catch(function () { status.textContent = t('share.fail'); });
    return m;
  }

  window.Share = { open: open, render: render, cleanUrl: cleanUrl };
})();
