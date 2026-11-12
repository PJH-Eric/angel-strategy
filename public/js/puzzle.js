/* 題目元件：推理（線索數字鎖）與算式（湊數），單機與線上共用；另含「解法」顯示。 */
(function () {
  'use strict';
  const R = AngelRules, el = UI.el, t = function (k, v) { return I18N.t(k, v); };

  function modalOpen() { return !!document.querySelector('.overlay'); }

  /* ---------- 推理 ---------- */
  // opts: { state:{digits[], cur, locked{pos:digit}}, onSubmit(digits), onChange(state) }
  function mountDeduce(puzzle, opts) {
    const st = opts.state || { digits: new Array(puzzle.n).fill(null), cur: 0, locked: {}, order: [] };
    st.order = st.order || [];
    const clueList = el('ul', { class: 'clues' });
    puzzle.clues.forEach(function (c) { clueList.appendChild(el('li', { text: R.clueText(c, I18N.lang) })); });
    const cluesEl = el('div', null, [el('div', { class: 'label', text: t('play.clues') }), clueList, el('p', { class: 'muted', style: 'font-size:.85em', text: t('play.cluesHelp') })]);

    const slotsEl = el('div', { class: 'slots', role: 'group', 'aria-label': t('res.answer') });
    const slots = [];
    for (let i = 0; i < puzzle.n; i++) {
      const s = el('button', { type: 'button', class: 'slot', 'aria-label': '#' + (i + 1) });
      s.addEventListener('click', function () {
        if (st.locked[i] != null) return;
        st.digits[i] = null; st.order = st.order.filter(function (x) { return x !== i; }); st.cur = i; draw();
      });
      slots.push(s); slotsEl.appendChild(s);
    }
    const pad = el('div', { class: 'pad-grid' });
    for (let d = 0; d < puzzle.pool; d++) pad.appendChild(UI.button(String(d), { onClick: function () { put(d); } }));
    const act = el('div', { class: 'row', style: 'justify-content:center' }, [
      UI.button('', { cls: 'ghost', icon: 'backspace', aria: t('play.back'), onClick: back }),
      UI.button(t('play.clear'), { cls: 'ghost', onClick: clear }),
      UI.button(t('play.submit'), { cls: 'primary', onClick: submit })
    ]);
    const entryEl = el('div', { class: 'stack' }, [slotsEl, pad, act]);

    function draw() {
      slots.forEach(function (s, i) {
        const v = st.locked[i] != null ? st.locked[i] : st.digits[i];
        s.textContent = v == null ? '' : String(v);
        s.classList.toggle('is-cur', st.cur === i);
        s.classList.toggle('is-hint', st.locked[i] != null);
      });
      if (opts.onChange) opts.onChange(st);
    }
    function nextFree(from) {
      for (let k = 0; k < puzzle.n; k++) { const i = (from + k) % puzzle.n; if (st.locked[i] == null) return i; }
      return from;
    }
    function put(d) {
      if (st.locked[st.cur] != null) st.cur = nextFree(st.cur);
      st.digits[st.cur] = d; Audio2.sfx('key');
      st.order = st.order.filter(function (x) { return x !== st.cur; }); st.order.push(st.cur);
      st.cur = nextFree((st.cur + 1) % puzzle.n);
      draw();
    }
    function back() {
      // 刪除「最後填入」的那一格；沒有可刪的就不動
      const i = st.order.pop();
      if (i == null) return;
      st.digits[i] = null; st.cur = i;
      draw();
    }
    function clear() { for (let i = 0; i < puzzle.n; i++) if (st.locked[i] == null) st.digits[i] = null; st.order = []; st.cur = nextFree(0); draw(); }
    function full() {
      const out = [];
      for (let i = 0; i < puzzle.n; i++) { const v = st.locked[i] != null ? st.locked[i] : st.digits[i]; if (v == null) return null; out.push(v); }
      return out;
    }
    function submit() {
      const a = full();
      if (!a) { UI.toast(t('play.wrong'), true); return; }
      opts.onSubmit(a);
    }
    function onKey(e) {
      if (modalOpen()) return;
      if (e.key >= '0' && e.key <= '9' && +e.key < puzzle.pool) put(+e.key);
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Enter') submit();
      else if (e.key === 'ArrowLeft') { st.cur = (st.cur - 1 + puzzle.n) % puzzle.n; draw(); }
      else if (e.key === 'ArrowRight') { st.cur = (st.cur + 1) % puzzle.n; draw(); }
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    draw();
    return {
      cluesEl: cluesEl, entryEl: entryEl, state: st,
      bad: function () { slots.forEach(function (s) { s.classList.remove('bad'); void s.offsetWidth; s.classList.add('bad'); }); },
      lockHint: function (pos, digit) { st.locked[pos] = digit; st.digits[pos] = digit; st.cur = nextFree(st.cur); draw(); },
      lockedCount: function () { return Object.keys(st.locked).length; },
      destroy: function () { document.removeEventListener('keydown', onKey); }
    };
  }

  /* ---------- 算式 ---------- */
  // opts: { state:{tokens[], used[]}, onSubmit(expr), onChange }
  function mountArith(puzzle, opts) {
    const st = opts.state || { tokens: [], used: [] };           // tokens: {s, chip|null}
    let buf = '';
    const info = el('div', null, [
      el('div', { class: 'label', text: puzzle.type === 'near' ? t('play.goal') : t('play.target') }),
      el('div', { class: 'target', text: String(puzzle.type === 'near' ? puzzle.goal : puzzle.target) }),
      el('p', { class: 'muted center', style: 'font-size:.85em', text: puzzle.type === 'near' ? t('play.nearHelp') : t('play.arithHelp') })
    ]);
    const expr = el('div', { class: 'expr', 'aria-live': 'polite' });
    const numsEl = el('div', { class: 'nums' });
    const chips = puzzle.numbers.map(function (n, i) {
      const b = UI.button(String(n), { cls: 'num', onClick: function () { commit(); addNum(i); } });
      numsEl.appendChild(b); return b;
    });
    const opsEl = el('div', { class: 'ops' });
    [['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['(', '('], [')', ')']].forEach(function (o) {
      opsEl.appendChild(UI.button(o[0], { cls: 'ghost', onClick: function () { commit(); st.tokens.push({ s: o[0] }); Audio2.sfx('key'); draw(); } }));
    });
    opsEl.appendChild(UI.button('', { cls: 'ghost', icon: 'backspace', aria: t('play.back'), onClick: function () { commit(); back(); } }));
    const act = el('div', { class: 'row', style: 'justify-content:center' }, [
      UI.button(t('play.clear'), { cls: 'ghost', onClick: function () { buf = ''; st.tokens = []; st.used = []; draw(); } }),
      UI.button(t('play.submit'), { cls: 'primary', onClick: function () { commit(); submit(); } })
    ]);
    const entryEl = el('div', { class: 'stack' }, [expr, numsEl, opsEl, act]);

    function addNum(i) {
      if (st.used.indexOf(i) !== -1) return;
      st.used.push(i); st.tokens.push({ s: String(puzzle.numbers[i]), chip: i }); Audio2.sfx('key'); draw();
    }
    function commit() {
      if (!buf) return;
      const v = parseInt(buf, 10); buf = '';
      for (let i = 0; i < puzzle.numbers.length; i++) if (puzzle.numbers[i] === v && st.used.indexOf(i) === -1) { addNum(i); return; }
      UI.toast(t('play.err.numbers'), true); draw();
    }
    function back() {
      const tk = st.tokens.pop();
      if (tk && tk.chip != null) st.used = st.used.filter(function (x) { return x !== tk.chip; });
      draw();
    }
    function text() { return st.tokens.map(function (x) { return x.s; }).join(''); }
    function draw() {
      expr.textContent = '';
      // 觸控：直接點算式中的任一項即可刪除它（數字會回到下方）
      st.tokens.forEach(function (x, k) {
        const sp = el('button', { type: 'button', class: 'tok', 'aria-label': t('play.back') + ' ' + x.s, text: x.s });
        sp.addEventListener('click', function () { commit(); const rm = st.tokens.splice(k, 1)[0]; if (rm && rm.chip != null) st.used = st.used.filter(function (c) { return c !== rm.chip; }); Audio2.sfx('key'); draw(); });
        expr.appendChild(sp);
      });
      if (buf) expr.appendChild(el('span', { style: 'opacity:.55', text: buf }));
      if (!st.tokens.length && !buf) expr.appendChild(el('span', { class: 'muted', style: 'font-size:.6em', text: '…' }));
      chips.forEach(function (c, i) { c.classList.toggle('used', st.used.indexOf(i) !== -1); });
      if (opts.onChange) opts.onChange(st);
    }
    function submit() {
      const s = text();
      const r = puzzle.type === 'near' ? R.checkPuzzle(puzzle, s) : R.checkArith(puzzle, s);
      if (!r.ok) { expr.classList.remove('bad'); void expr.offsetWidth; expr.classList.add('bad'); UI.toast(t('play.err.' + r.reason), true); Audio2.sfx('wrong'); return; }
      opts.onSubmit(s);
    }
    function onKey(e) {
      if (modalOpen()) return;
      const k = e.key;
      if (k >= '0' && k <= '9') { buf += k; draw(); }
      else if ('+-*/()'.indexOf(k) !== -1 && k.length === 1) { commit(); st.tokens.push({ s: k === '-' ? '−' : (k === '*' ? '×' : (k === '/' ? '÷' : k)) }); draw(); }
      else if (k === 'x' || k === 'X') { commit(); st.tokens.push({ s: '×' }); draw(); }
      else if (k === 'Backspace') { if (buf) { buf = buf.slice(0, -1); draw(); } else back(); }
      else if (k === 'Enter') { commit(); submit(); }
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    draw();
    return {
      cluesEl: info, entryEl: entryEl, state: st,
      bad: function () { expr.classList.remove('bad'); void expr.offsetWidth; expr.classList.add('bad'); },
      destroy: function () { document.removeEventListener('keydown', onKey); }
    };
  }


  /* ---------- 共用：數字鍵盤小元件 ---------- */
  function padOf(labels, onKey, cols) {
    const g = el('div', { class: 'pad-grid', style: cols ? 'grid-template-columns:repeat(' + cols + ',1fr)' : '' });
    labels.forEach(function (l) { g.appendChild(UI.button(l.t, { cls: l.cls || '', icon: l.icon, aria: l.icon ? t('play.back') : null, onClick: function () { onKey(l.k); } })); });
    return g;
  }

  /* ---------- 找規則 ---------- */
  function mountRule(puzzle, opts) {
    const st = opts.state || { vals: puzzle.tests.map(function () { return ''; }), cur: 0 };
    const tbl = el('div', { class: 'rule-table' });
    tbl.appendChild(el('div', { class: 'label', text: t('play.examples') }));
    puzzle.examples.forEach(function (e) { tbl.appendChild(el('div', { class: 'rule-row' }, [el('span', { class: 'mono', text: e.in.join('  ,  ') }), el('span', { class: 'arrow', text: '→' }), el('b', { class: 'mono out', text: String(e.out) })])); });
    const cluesEl = el('div', null, [tbl, el('p', { class: 'muted', style: 'font-size:.85em', text: t('play.ruleHelp') })]);
    const rows = puzzle.tests.map(function (x, i) {
      const val = el('span', { class: 'ans-box mono' });
      const row = el('button', { type: 'button', class: 'rule-row test', 'aria-label': '#' + (i + 1) }, [el('span', { class: 'mono', text: x.join('  ,  ') }), el('span', { class: 'arrow', text: '→' }), val]);
      row.addEventListener('click', function () { st.cur = i; draw(); });
      return { row: row, val: val };
    });
    const list = el('div', { class: 'stack' }, rows.map(function (r) { return r.row; }));
    const pad = padOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(function (d) { return { t: String(d), k: String(d) }; }).concat([{ t: '−', k: '-', cls: 'ghost' }, { t: '', k: 'b', cls: 'ghost', icon: 'backspace' }]), key, 6);
    const act = el('div', { class: 'row', style: 'justify-content:center' }, [UI.button(t('play.clear'), { cls: 'ghost', onClick: function () { st.vals = st.vals.map(function () { return ''; }); st.cur = 0; draw(); } }), UI.button(t('play.submit'), { cls: 'primary', onClick: submit })]);
    const entryEl = el('div', { class: 'stack' }, [el('div', { class: 'label', text: t('play.predict') }), list, pad, act]);
    function key(k) {
      let v = st.vals[st.cur];
      if (k === 'b') v = v.slice(0, -1);
      else if (k === '-') v = v.charAt(0) === '-' ? v.slice(1) : '-' + v;
      else if (v.replace('-', '').length < 3) v += k;
      st.vals[st.cur] = v; Audio2.sfx('key'); draw();
    }
    function draw() {
      rows.forEach(function (r, i) { r.val.textContent = st.vals[i] === '' ? '?' : st.vals[i]; r.row.classList.toggle('is-cur', st.cur === i); });
      if (opts.onChange) opts.onChange(st);
    }
    function submit() {
      if (st.vals.some(function (v) { return v === '' || v === '-'; })) { UI.toast(t('play.fillAll'), true); return; }
      opts.onSubmit(st.vals.map(Number));
    }
    function onKey(e) {
      if (modalOpen()) return;
      if (e.key >= '0' && e.key <= '9') key(e.key);
      else if (e.key === '-') key('-');
      else if (e.key === 'Backspace') key('b');
      else if (e.key === 'Tab' || e.key === 'ArrowDown') { st.cur = (st.cur + 1) % rows.length; draw(); }
      else if (e.key === 'ArrowUp') { st.cur = (st.cur - 1 + rows.length) % rows.length; draw(); }
      else if (e.key === 'Enter') submit();
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    draw();
    return { cluesEl: cluesEl, entryEl: entryEl, state: st,
      bad: function () { rows.forEach(function (r) { r.row.classList.remove('bad'); void r.row.offsetWidth; r.row.classList.add('bad'); }); },
      destroy: function () { document.removeEventListener('keydown', onKey); } };
  }

  /* ---------- 天平配重 ---------- */
  function mountScale(puzzle, opts) {
    const st = opts.state || { assign: new Array(puzzle.m).fill(null), cur: 0 };
    const fig = el('div', { class: 'fig-wrap' });
    const cluesEl = el('div', null, [fig, el('p', { class: 'muted', style: 'font-size:.85em', text: t('play.scaleHelp') })]);
    const slotsEl = el('div', { class: 'slots' });
    const slots = [];
    for (let i = 0; i < puzzle.m; i++) {
      const b = el('button', { type: 'button', class: 'slot wide', 'aria-label': R.SHAPES[i] });
      b.addEventListener('click', function () { if (st.cur === i && st.assign[i] != null) st.assign[i] = null; st.cur = i; Audio2.sfx('key'); draw(); });
      slots.push(b); slotsEl.appendChild(b);
    }
    const bagBtns = puzzle.bag.map(function (w) { return UI.button(String(w), { cls: 'num', onClick: function () { put(w); } }); });
    const pad = el('div', { class: 'pad-grid' }, bagBtns);
    const act = el('div', { class: 'row', style: 'justify-content:center' }, [
      UI.button('', { cls: 'ghost', icon: 'backspace', aria: t('play.back'), onClick: function () { st.assign[st.cur] = null; draw(); } }),
      UI.button(t('play.clear'), { cls: 'ghost', onClick: function () { st.assign = new Array(puzzle.m).fill(null); st.cur = 0; draw(); } }),
      UI.button(t('play.submit'), { cls: 'primary', onClick: submit })
    ]);
    const entryEl = el('div', { class: 'stack' }, [el('div', { class: 'label', text: t('play.weights') }), slotsEl, pad, act]);
    function put(w) {
      const at = st.assign.indexOf(w);
      if (at !== -1) st.assign[at] = null;
      st.assign[st.cur] = w; Audio2.sfx('key');
      for (let k = 1; k <= puzzle.m; k++) { const j = (st.cur + k) % puzzle.m; if (st.assign[j] == null) { st.cur = j; break; } }
      draw();
    }
    function draw() {
      fig.textContent = ''; fig.appendChild(Figure.scale(puzzle, st.assign.some(function (v) { return v == null; }) ? partial() : st.assign, I18N.lang));
      slots.forEach(function (b, i) {
        // 圖形顏色與天平圖一致，一眼對得上
        b.textContent = ''; b.appendChild(el('span', { class: 'shp shp' + i, text: R.SHAPES[i] })); b.appendChild(el('span', { text: ' ' + (st.assign[i] == null ? '?' : st.assign[i]) }));
        b.classList.toggle('is-cur', st.cur === i);
      });
      bagBtns.forEach(function (b, i) { b.classList.toggle('used', st.assign.indexOf(puzzle.bag[i]) !== -1); });
      if (opts.onChange) opts.onChange(st);
    }
    // 尚未填滿：未知的圖形顯示成 null，天平只顯示形狀（不倾斜）
    function partial() { return st.assign.map(function (v) { return v == null ? null : v; }); }
    // 鍵盤：←→ 換圖形、輸入數字指定重量（兩位數自動判斷）、Backspace 清除、Enter 送出
    let kbuf = '', kt = null;
    function onKey(e) {
      if (modalOpen()) return;
      const k = e.key;
      if (k >= '0' && k <= '9') {
        kbuf += k; clearTimeout(kt);
        const exact = puzzle.bag.indexOf(Number(kbuf)) !== -1, longer = puzzle.bag.some(function (w) { return String(w).indexOf(kbuf) === 0 && String(w) !== kbuf; });
        if (exact && !longer) { put(Number(kbuf)); kbuf = ''; }
        else if (!exact && !longer) kbuf = '';
        else kt = setTimeout(function () { if (puzzle.bag.indexOf(Number(kbuf)) !== -1) put(Number(kbuf)); kbuf = ''; }, 700);
      } else if (k === 'ArrowRight' || k === 'Tab' && !e.shiftKey) { st.cur = (st.cur + 1) % puzzle.m; draw(); }
      else if (k === 'ArrowLeft') { st.cur = (st.cur - 1 + puzzle.m) % puzzle.m; draw(); }
      else if (k === 'Backspace') { st.assign[st.cur] = null; draw(); }
      else if (k === 'Enter') submit();
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    function submit() {
      if (st.assign.some(function (v) { return v == null; })) { UI.toast(t('play.fillAll'), true); return; }
      opts.onSubmit(st.assign.slice());
    }
    draw();
    return { cluesEl: cluesEl, entryEl: entryEl, state: st,
      bad: function () { slots.forEach(function (b) { b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); }); },
      // 提示直接幫你填上那個圖形的重量（原本佔用該重量的圖形會清空）
      applyHint: function (n) { const i = Math.min(n, puzzle.m - 1), w = puzzle.solution && puzzle.solution[i]; if (w == null) return; const at = st.assign.indexOf(w); if (at !== -1) st.assign[at] = null; st.assign[i] = w; draw(); },
      destroy: function () { clearTimeout(kt); document.removeEventListener('keydown', onKey); } };
  }

  /* ---------- 算式金字塔 ---------- */
  function mountPyramid(puzzle, opts) {
    const st = opts.state || { ops: new Array(puzzle.n - 1).fill(null) };
    const fig = el('div', { class: 'fig-wrap' });
    const cluesEl = el('div', null, [fig, el('p', { class: 'muted', style: 'font-size:.85em', text: t('play.pyrHelp') })]);
    const glyph = { '+': '＋', '-': '−', '*': '×' };
    const rowsEl = el('div', { class: 'stack' });
    const btns = [];
    for (let l = 0; l < puzzle.n - 1; l++) (function (l) {
      const row = el('div', { class: 'row', style: 'justify-content:center;align-items:center' }, [el('span', { class: 'label', style: 'min-width:4.5em', text: t('play.pyrLevel', { n: l + 1 }) })]);
      const group = [];
      puzzle.ops.forEach(function (o) {
        const b = UI.button(glyph[o], { cls: 'num', onClick: function () { st.ops[l] = o; Audio2.sfx('key'); draw(); } });
        group.push({ o: o, b: b }); row.appendChild(b);
      });
      btns.push(group); rowsEl.appendChild(row);
    })(l);
    const act = el('div', { class: 'row', style: 'justify-content:center' }, [
      UI.button(t('play.clear'), { cls: 'ghost', onClick: function () { st.ops = new Array(puzzle.n - 1).fill(null); draw(); } }),
      UI.button(t('play.submit'), { cls: 'primary', onClick: submit })
    ]);
    const entryEl = el('div', { class: 'stack' }, [rowsEl, act]);
    // 鍵盤：↑↓ 選層（從第 1 層開始）、+ − × 設定運算、Enter 送出
    let kl = 0;
    function onKey(e) {
      if (modalOpen()) return;
      const k = e.key, map = { '+': '+', '-': '-', '*': '*', 'x': '*', 'X': '*' };
      if (map[k] && puzzle.ops.indexOf(map[k]) !== -1) { st.ops[kl] = map[k]; kl = Math.min(puzzle.n - 2, kl + 1); Audio2.sfx('key'); draw(); }
      else if (k === 'ArrowUp') { kl = Math.min(puzzle.n - 2, kl + 1); draw(); }
      else if (k === 'ArrowDown') { kl = Math.max(0, kl - 1); draw(); }
      else if (k === 'Backspace') { st.ops[kl] = null; kl = Math.max(0, kl - 1); draw(); }
      else if (k === 'Enter') submit();
      else return;
      e.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    function cycle(l) { const i = puzzle.ops.indexOf(st.ops[l]); st.ops[l] = puzzle.ops[(i + 1) % puzzle.ops.length]; Audio2.sfx('key'); draw(); }
    function draw() {
      fig.textContent = ''; fig.appendChild(Figure.pyramid(puzzle, st.ops, I18N.lang, cycle));
      btns.forEach(function (g, l) { g.forEach(function (x) { x.b.classList.toggle('is-on', st.ops[l] === x.o); }); rowsEl.children[l].classList.toggle('is-cur', kl === l); });
      if (opts.onChange) opts.onChange(st);
    }
    function submit() {
      if (st.ops.some(function (o) { return !o; })) { UI.toast(t('play.fillAll'), true); return; }
      opts.onSubmit(st.ops.slice());
    }
    draw();
    return { cluesEl: cluesEl, entryEl: entryEl, state: st,
      bad: function () { fig.classList.remove('bad'); void fig.offsetWidth; fig.classList.add('bad'); },
      applyHint: function (n) { const l = Math.min(n, puzzle.n - 2); if (puzzle.solution) { st.ops[l] = puzzle.solution[l]; draw(); } },
      destroy: function () { document.removeEventListener('keydown', onKey); } };
  }

  function mount(pz, o) {
    switch (pz.type) {
      case 'deduce': return mountDeduce(pz, o);
      case 'rule': return mountRule(pz, o);
      case 'scale': return mountScale(pz, o);
      case 'pyramid': return mountPyramid(pz, o);
      default: return mountArith(pz, o);
    }
  }

  /* ---------- 解法 ---------- */
  function solutionView(puzzle, label) {
    const box = el('div', { class: 'sol' });
    box.appendChild(el('h4', { class: 'sol-h' }, [Icon.el(Icon.kind(puzzle.type)), el('span', { text: (label ? label + '　' : t('kind.' + puzzle.type) + '　') + t('res.solution') })]));
    box.appendChild(el('div', { class: 'fig-wrap' }, [Figure.solution(puzzle, I18N.lang)]));
    if (puzzle.type === 'deduce') {
      const ex = R.explainDeduce(puzzle, I18N.lang);
      box.appendChild(el('div', { class: 'muted', style: 'font-size:.85em', text: t('res.cluesWalk') }));
      const ol = el('ol');
      ex.steps.forEach(function (s) { ol.appendChild(el('li', null, [s.clue + '　→　', el('b', { text: t('res.remain', { n: s.remain }) })])); });
      box.appendChild(ol);
      box.appendChild(el('div', null, [t('res.theAnswer') + '：', el('span', { class: 'ans', text: ex.answer.join(' ') })]));
    } else if (puzzle.type === 'arith' || puzzle.type === 'near') {
      const ex = R.explainPuzzle(puzzle, I18N.lang);
      box.appendChild(el('div', null, [t('res.answer') + '：', el('span', { class: 'ans', text: ex.expression })]));
    } else if (puzzle.type === 'rule') {
      const ex = R.explainPuzzle(puzzle, I18N.lang);
      box.appendChild(el('div', null, [t('res.theRule') + '：', el('span', { class: 'ans', text: ex.rule })]));
      box.appendChild(el('div', null, [t('res.answer') + '：', el('span', { class: 'ans', text: puzzle.solution.join('、') })]));
    } else if (puzzle.type === 'scale') {
      box.appendChild(el('div', null, [t('res.answer') + '：', el('span', { class: 'ans', text: puzzle.solution.map(function (w, i) { return R.SHAPES[i] + '=' + w; }).join('　') })]));
    } else {
      box.appendChild(el('div', null, [t('res.answer') + '：', el('span', { class: 'ans', text: puzzle.solution.map(function (o) { return o === '-' ? '−' : (o === '*' ? '×' : o); }).join(' ') })]));
    }
    return box;
  }

  function hintText(puzzle) {
    if (puzzle.type !== 'arith') return '';
    const ex = R.explainArith(puzzle);
    return ex.steps[0];
  }

  window.Puzzle = { mount: mount, mountDeduce: mountDeduce, mountArith: mountArith, solutionView: solutionView, hintText: hintText };
})();
