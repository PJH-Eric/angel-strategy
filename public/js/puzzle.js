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
      UI.button(t('play.back'), { cls: 'ghost', onClick: back }),
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
      el('div', { class: 'label', text: t('play.target') }),
      el('div', { class: 'target', text: String(puzzle.target) }),
      el('p', { class: 'muted center', style: 'font-size:.85em', text: t('play.arithHelp') })
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
    opsEl.appendChild(UI.button('⌫', { cls: 'ghost', aria: t('play.back'), onClick: function () { commit(); back(); } }));
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
      st.tokens.forEach(function (x) { expr.appendChild(el('span', { text: x.s })); });
      if (buf) expr.appendChild(el('span', { style: 'opacity:.55', text: buf }));
      if (!st.tokens.length && !buf) expr.appendChild(el('span', { class: 'muted', style: 'font-size:.6em', text: '…' }));
      chips.forEach(function (c, i) { c.classList.toggle('used', st.used.indexOf(i) !== -1); });
      if (opts.onChange) opts.onChange(st);
    }
    function submit() {
      const s = text();
      const r = R.checkArith(puzzle, s);
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

  /* ---------- 解法 ---------- */
  function solutionView(puzzle, label) {
    const box = el('div', { class: 'sol' });
    box.appendChild(el('h4', { text: (label ? label + '　' : '') + t('res.solution') }));
    if (puzzle.type === 'deduce') {
      const ex = R.explainDeduce(puzzle, I18N.lang);
      box.appendChild(el('div', { class: 'muted', style: 'font-size:.85em', text: t('res.cluesWalk') }));
      const ol = el('ol');
      ex.steps.forEach(function (s) { ol.appendChild(el('li', null, [s.clue + '　→　', el('b', { text: t('res.remain', { n: s.remain }) })])); });
      box.appendChild(ol);
      box.appendChild(el('div', null, [t('res.theAnswer') + '：', el('span', { class: 'ans', text: ex.answer.join(' ') })]));
    } else {
      const ex = R.explainArith(puzzle);
      box.appendChild(el('div', { class: 'muted', style: 'font-size:.85em', text: t('play.target') + ' ' + puzzle.target + '　／　' + puzzle.numbers.join('、') }));
      box.appendChild(el('div', { class: 'muted', style: 'font-size:.85em', text: t('res.steps') }));
      const ol = el('ol', { class: 'mono' });
      ex.steps.forEach(function (s) { ol.appendChild(el('li', { text: s })); });
      box.appendChild(ol);
      box.appendChild(el('div', null, [t('res.answer') + '：', el('span', { class: 'ans', text: ex.expression })]));
    }
    return box;
  }

  function hintText(puzzle) {
    if (puzzle.type !== 'arith') return '';
    const ex = R.explainArith(puzzle);
    return ex.steps[0];
  }

  window.Puzzle = { mountDeduce: mountDeduce, mountArith: mountArith, solutionView: solutionView, hintText: hintText };
})();
