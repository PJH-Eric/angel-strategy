/* 自訂 UI 元件庫：所有玩家可見的控制項都由這裡產生，外觀完全由 style.css 封裝。
 * 內部仍使用必要的語意標籤（button、input），但不顯示任何瀏覽器預設外觀；
 * 保留 ARIA、鍵盤、觸控與可見焦點。 */
(function () {
  'use strict';
  const t = function (k, v) { return I18N.t(k, v); };

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  /* 按鈕 */
  const COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  // iOS 需要有 touchstart 監聽 :active 按壓樣式才會即時出現
  document.addEventListener('touchstart', function () {}, { passive: true });
  function button(label, opts) {
    opts = opts || {};
    const b = el('button', { type: 'button', class: 'btn ' + (opts.cls || ''), 'aria-label': opts.aria || null, title: opts.title || null });
    if (opts.html) b.innerHTML = opts.html; else b.textContent = label;
    if (opts.icon && window.Icon) { b.insertBefore(Icon.el(opts.icon), b.firstChild); if (!label && !opts.html) b.classList.add('only-ic'); }
    b.addEventListener('click', function (e) {
      if (b.disabled || b.classList.contains('is-disabled')) return;
      Audio2.sfx('click');
      if (COARSE) Audio2.vibrate(6);        // 觸控裝置：輕觸回饋
      if (opts.onClick) opts.onClick(e);
    });
    if (opts.disabled) b.disabled = true;
    return b;
  }

  /* 自訂捲動區：隱藏原生捲軸，繪製自訂軌道與滑塊（可拖曳、可觸控） */
  function scrollArea(content, opts) {
    opts = opts || {};
    const view = el('div', { class: 'sa-view', tabindex: '0', role: 'region', 'aria-label': opts.label || null }, [content]);
    const thumb = el('div', { class: 'sa-thumb' });
    const track = el('div', { class: 'sa-track', 'aria-hidden': 'true' }, [thumb]);
    const wrap = el('div', { class: 'sa' }, [view, track]);
    function sync() {
      const vh = view.clientHeight, sh = view.scrollHeight;
      const can = sh > vh + 2;
      wrap.classList.toggle('is-scrollable', can);
      if (!can) return;
      const th = Math.max(36, vh * vh / sh);
      const max = vh - th;
      thumb.style.height = th + 'px';
      thumb.style.top = (view.scrollTop / (sh - vh)) * max + 'px';
    }
    view.addEventListener('scroll', function () { wrap.classList.add('is-active'); sync(); clearTimeout(wrap._t); wrap._t = setTimeout(function () { wrap.classList.remove('is-active'); }, 900); });
    let dragY = null, dragTop = 0;
    thumb.addEventListener('pointerdown', function (e) { dragY = e.clientY; dragTop = view.scrollTop; wrap.classList.add('is-dragging'); thumb.setPointerCapture(e.pointerId); e.preventDefault(); });
    thumb.addEventListener('pointermove', function (e) {
      if (dragY == null) return;
      const vh = view.clientHeight, sh = view.scrollHeight, th = Math.max(36, vh * vh / sh);
      view.scrollTop = dragTop + (e.clientY - dragY) * (sh - vh) / (vh - th);
    });
    const end = function () { dragY = null; wrap.classList.remove('is-dragging'); };
    thumb.addEventListener('pointerup', end); thumb.addEventListener('pointercancel', end);
    track.addEventListener('pointerdown', function (e) {
      if (e.target !== track) return;
      const r = track.getBoundingClientRect();
      view.scrollTop = (e.clientY - r.top) / r.height * (view.scrollHeight - view.clientHeight);
    });
    if (window.ResizeObserver) { const ro = new ResizeObserver(sync); ro.observe(view); ro.observe(content); }
    setTimeout(sync, 0);
    wrap.view = view; wrap.sync = sync;
    return wrap;
  }

  /* 開關 */
  function toggle(on, onChange, label) {
    const s = el('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label || null });
    s.addEventListener('click', function () {
      const v = s.getAttribute('aria-checked') !== 'true';
      s.setAttribute('aria-checked', String(v));
      Audio2.sfx('click');
      onChange(v);
    });
    s.set = function (v) { s.setAttribute('aria-checked', String(!!v)); };
    return s;
  }

  /* 滑桿 0..1 */
  function slider(val, onChange, label) {
    const fill = el('div', { class: 'fill' }), knob = el('div', { class: 'knob' });
    const s = el('button', { type: 'button', class: 'slider', role: 'slider', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': label || null }, [fill, knob]);
    function draw(v) { fill.style.width = v * 100 + '%'; knob.style.left = v * 100 + '%'; s.setAttribute('aria-valuenow', String(Math.round(v * 100))); }
    function at(e) { const r = s.getBoundingClientRect(); return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); }
    let dragging = false;
    s.addEventListener('pointerdown', function (e) { dragging = true; s.setPointerCapture(e.pointerId); val = at(e); draw(val); onChange(val); });
    s.addEventListener('pointermove', function (e) { if (dragging) { val = at(e); draw(val); onChange(val); } });
    s.addEventListener('pointerup', function () { dragging = false; Audio2.sfx('click'); });
    s.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') val = Math.max(0, val - 0.05);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') val = Math.min(1, val + 0.05);
      else return;
      e.preventDefault(); draw(val); onChange(val);
    });
    s.set = function (v) { val = v; draw(v); };
    draw(val);
    return s;
  }

  /* 文字輸入（完全自訂外觀） */
  function input(opts) {
    opts = opts || {};
    const i = el('input', { type: 'text', maxlength: opts.max || 40, placeholder: opts.placeholder || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': opts.label || opts.placeholder || null, value: opts.value || '' });
    i.value = opts.value || '';
    const f = el('label', { class: 'field' }, [opts.label && !opts.hideLabel ? el('span', { class: 'label', text: opts.label }) : null, i]);
    f.input = i;
    return f;
  }

  /* 彈出選單（取代原生 select） */
  function menu(anchor, items, onPick, selected) {
    closeMenus();
    const pop = el('div', { class: 'menu-pop', role: 'listbox' });
    items.forEach(function (it) {
      const b = el('button', { type: 'button', role: 'option', 'aria-selected': String(it.id === selected), text: it.label });
      b.addEventListener('click', function () { Audio2.sfx('click'); closeMenus(); onPick(it.id); });
      pop.appendChild(b);
    });
    const host = document.getElementById('app');
    host.appendChild(pop);
    const r = anchor.getBoundingClientRect(), hr = host.getBoundingClientRect();
    let left = r.left - hr.left, top = r.bottom - hr.top + 4;
    pop.style.left = Math.max(6, Math.min(left, hr.width - pop.offsetWidth - 6)) + 'px';
    if (top + pop.offsetHeight > hr.height - 6) top = r.top - hr.top - pop.offsetHeight - 4;
    pop.style.top = Math.max(6, top) + 'px';
    const first = pop.querySelector('[aria-selected="true"]') || pop.firstChild; if (first) first.focus();
    setTimeout(function () {
      const off = function (e) { if (!pop.contains(e.target)) { closeMenus(); document.removeEventListener('pointerdown', off, true); } };
      document.addEventListener('pointerdown', off, true);
    }, 0);
    pop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeMenus(); anchor.focus(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const bs = Array.prototype.slice.call(pop.children), k = bs.indexOf(document.activeElement);
        bs[(k + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus(); e.preventDefault();
      }
    });
  }
  function closeMenus() { document.querySelectorAll('.menu-pop').forEach(function (n) { n.remove(); }); }

  /* 彈窗：焦點鎖定、Escape 關閉、關閉後回到原焦點、遮罩 */
  function modal(opts) {
    const prev = document.activeElement;
    const body = el('div', { class: 'stack', style: 'width:100%;padding-bottom:6px' });
    (opts.body || []).forEach(function (n) { if (n) body.appendChild(n); });   // 允許條件式內容傳 null
    const sa = scrollArea(body, { label: opts.title });
    const head = el('header', null, [el('h2', { text: opts.title || '' })]);
    const dlg = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || null }, [head, el('div', { class: 'body' }, [sa])]);
    const ov = el('div', { class: 'overlay ' + (opts.top ? 'top' : '') }, [dlg]);
    function close() { ov.remove(); document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) { try { prev.focus(); } catch (e) { /* ignore */ } } if (opts.onClose) opts.onClose(); }
    if (opts.closable !== false) head.appendChild(button('', { cls: 'small icon ghost', icon: 'close', aria: t('common.close'), onClick: close }));
    if (opts.footer && opts.footer.length) { const f = el('footer', null, opts.footer); dlg.appendChild(f); }
    function onKey(e) {
      if (e.key === 'Escape' && opts.closable !== false) { e.stopPropagation(); close(); return; }
      if (e.key === 'Tab') {
        const f = dlg.querySelectorAll('button, input, [tabindex="0"]');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    (opts.host || document.getElementById('app')).appendChild(ov);
    const fb = dlg.querySelector('footer .btn') || dlg.querySelector('header .btn');
    if (fb) fb.focus();
    ov.close = close; ov.dialog = dlg; ov.sa = sa;
    return ov;
  }

  function confirmBox(msg, onYes, yesLabel) {
    const m = modal({
      title: t('app.name'), top: true, body: [el('p', { text: msg })],
      footer: [button(t('common.cancel'), { cls: 'ghost', onClick: function () { m.close(); } }), button(yesLabel || t('common.ok'), { cls: 'primary', onClick: function () { m.close(); onYes(); } })]
    });
    return m;
  }

  function toast(msg, err) {
    let host = document.querySelector('.toast-host');
    if (!host) { host = el('div', { class: 'toast-host', 'aria-live': 'polite' }); document.getElementById('app').appendChild(host); }
    const n = el('div', { class: 'toast' + (err ? ' err' : ''), text: msg });
    host.appendChild(n);
    setTimeout(function () { n.remove(); }, 2400);
  }

  function stars(n) { return n ? '★'.repeat(n) + '☆'.repeat(3 - n) : ''; }
  function fmtSec(ms) { return (ms / 1000).toFixed(2); }

  window.UI = { el: el, button: button, scrollArea: scrollArea, toggle: toggle, slider: slider, input: input, menu: menu, closeMenus: closeMenus, modal: modal, confirm: confirmBox, toast: toast, stars: stars, fmtSec: fmtSec };
})();
