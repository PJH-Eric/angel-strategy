/*
 * 天使的策略 — 解法圖（SVG）
 * 每一種題型都畫出「題目本身」並標註解法：步驟編號、逐步算式、驗證打勾。
 * Figure.solution(puzzle, lang) -> SVGElement
 * Figure.scale(puzzle, assign, lang) / Figure.pyramid(puzzle, ops, lang, onLevel)：互動題目與解法共用
 */
(function () {
  'use strict';
  const R = AngelRules;
  const NS = 'http://www.w3.org/2000/svg';

  function s(tag, attrs, kids) {
    const e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function tx(x, y, text, cls, anchor) { return s('text', { x: x, y: y, class: 'fg-t ' + (cls || ''), 'text-anchor': anchor || 'middle' }, [String(text)]); }
  function svgRoot(w, h, label) {
    return s('svg', { viewBox: '0 0 ' + w + ' ' + h, class: 'figure', role: 'img', 'aria-label': label || '', preserveAspectRatio: 'xMidYMid meet', style: 'max-width:' + Math.max(w, 300) + 'px' });
  }
  const T = function (lang) { return function (zh, en) { return lang === 'en' ? en : zh; }; };
  const neg = function (x) { return String(x).replace(/-(\d)/g, '−$1'); };
  const CIRC = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
  const prettyOps = function (x) { return String(x).replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−'); };

  /* ---------- 算式樹（算式題與湊近值） ---------- */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
  function fr(n, d) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
  function showF(f) { return f.d === 1 ? String(f.n) : f.n + '/' + f.d; }
  function parseTree(str) {
    const src = String(str).replace(/\s+/g, ''); let i = 0;
    function num() { const m = /^\d+/.exec(src.slice(i)); i += m[0].length; return { leaf: true, v: fr(parseInt(m[0], 10), 1) }; }
    function fac() { if (src[i] === '(') { i++; const e = expr(); i++; return e; } return num(); }
    function mk(op, l, r) {
      const v = op === '+' ? fr(l.v.n * r.v.d + r.v.n * l.v.d, l.v.d * r.v.d) : op === '-' ? fr(l.v.n * r.v.d - r.v.n * l.v.d, l.v.d * r.v.d) : op === '*' ? fr(l.v.n * r.v.n, l.v.d * r.v.d) : fr(l.v.n * r.v.d, l.v.d * r.v.n);
      return { op: op, l: l, r: r, v: v };
    }
    function term() { let v = fac(); while (src[i] === '*' || src[i] === '/') { const op = src[i++]; v = mk(op, v, fac()); } return v; }
    function expr() { let v = term(); while (src[i] === '+' || src[i] === '-') { const op = src[i++]; v = mk(op, v, term()); } return v; }
    return expr();
  }

  function exprFigure(pz, lang) {
    const t = T(lang);
    const tree = parseTree(pz.solution);
    let leaves = 0, order = 0;
    (function walk(n) { if (n.leaf) { n.x = leaves++; n.h = 0; return; } walk(n.l); walk(n.r); n.h = 1 + Math.max(n.l.h, n.r.h); n.x = (n.l.x + n.r.x) / 2; n.step = ++order; })(tree);
    const CW = 70, RH = 62, PADX = 34, TOP = 70;
    const W = Math.max(320, leaves * CW + PADX), H = tree.h * RH + TOP + 44 + order * 22 + 40;
    const root = svgRoot(W, H, t('算式解法圖', 'Expression solution diagram'));
    const px = function (n) { return PADX / 2 + CW / 2 + n.x * CW + (W - leaves * CW - PADX) / 2; };
    const py = function (n) { return TOP + (tree.h - n.h) * RH; };
    const near = pz.type === 'near';
    root.appendChild(tx(W / 2, 22, near ? t('目標 ' + pz.goal + '，盡量接近（最接近的差距：' + R.explainPuzzle(pz, lang).dist + '）', 'Goal ' + pz.goal + ' — get as close as possible (best gap: ' + R.explainPuzzle(pz, lang).dist + ')') : t('目標 ' + pz.target, 'Target ' + pz.target), 'fg-title'));
    root.appendChild(tx(W / 2, 42, t('每個數字恰好用一次；圓圈編號 = 運算先後順序', 'Each number is used once; circled numbers = order of operations'), 'fg-sub'));
    (function lines(n) { if (n.leaf) return; [n.l, n.r].forEach(function (c) { root.appendChild(s('line', { x1: px(c), y1: py(c) - (c.leaf ? 16 : 18), x2: px(n), y2: py(n) + 18, class: 'fg-edge' })); lines(c); }); })(tree);
    (function nodes(n) {
      if (n.leaf) {
        root.appendChild(s('rect', { x: px(n) - 20, y: py(n) - 16, width: 40, height: 32, rx: 4, class: 'fg-leaf' }));
        root.appendChild(tx(px(n), py(n) + 6, showF(n.v), 'fg-num'));
        return;
      }
      nodes(n.l); nodes(n.r);
      root.appendChild(s('rect', { x: px(n) - 27, y: py(n) - 18, width: 54, height: 36, rx: 6, class: 'fg-op' + (n === tree ? ' fg-final' : '') }));
      root.appendChild(tx(px(n) - 13, py(n) + 6, prettyOps(n.op), 'fg-opch'));
      root.appendChild(tx(px(n) + 10, py(n) + 6, showF(n.v), 'fg-num'));
      root.appendChild(s('circle', { cx: px(n) - 27, cy: py(n) - 18, r: 9, class: 'fg-badge' }));
      root.appendChild(tx(px(n) - 27, py(n) - 14.5, n.step, 'fg-badget'));
    })(tree);
    // 逐步算式
    let y = TOP + tree.h * RH + 46;
    root.appendChild(s('line', { x1: 14, y1: y - 14, x2: W - 14, y2: y - 14, class: 'fg-rule' }));
    const steps = [];
    (function post(n) { if (n.leaf) return; post(n.l); post(n.r); steps.push(CIRC[n.step - 1] + '  ' + showF(n.l.v) + ' ' + prettyOps(n.op) + ' ' + showF(n.r.v) + ' = ' + showF(n.v)); })(tree);
    steps.forEach(function (line) { root.appendChild(tx(20, y, line, 'fg-line', 'start')); y += 22; });
    const final = prettyOps(pz.solution) + ' = ' + showF(tree.v) + (near ? '' : '  ✓');
    root.appendChild(tx(W / 2, y + 12, final, 'fg-final-eq'));
    return root;
  }

  /* ---------- 推理：逐條線索驗證 ---------- */
  function clueCols(c, d) {
    switch (c.t) {
      case 'sum': return c.p;
      case 'gt': case 'diff': return [c.a, c.b];
      case 'par': case 'big': case 'mul': return [c.i];
      case 'has': return c.yes ? [d.indexOf(c.v)] : [];
    }
    return [];
  }
  function clueCheck(c, d, lang) {
    const en = lang === 'en';
    switch (c.t) {
      case 'sum': return c.p.map(function (i) { return d[i]; }).join(' + ') + ' = ' + c.v;
      case 'gt': return d[c.a] + ' > ' + d[c.b];
      case 'par': return d[c.i] + (en ? (c.even ? ' is even' : ' is odd') : (c.even ? ' 是偶數' : ' 是奇數'));
      case 'diff': return '|' + d[c.a] + ' − ' + d[c.b] + '| = ' + c.v;
      case 'big': return d[c.i] + (c.big ? ' ≥ 5' : ' ≤ 4');
      case 'mul': return c.no ? d[c.i] + ' ÷ ' + c.k + (en ? ' has a remainder' : ' 有餘數') : d[c.i] + ' ÷ ' + c.k + ' = ' + (d[c.i] / c.k);
      case 'has': return c.yes ? (en ? 'contains ' : '含有 ') + c.v : (en ? 'no ' : '沒有 ') + c.v + (en ? ' in code' : ' 出現');
    }
    return '';
  }
  function deduceFigure(pz, lang) {
    const t = T(lang);
    const n = pz.n, CW = 64, W = Math.max(340, n * CW + 20), x0 = (W - n * CW) / 2;
    const RH = 80, TOP = 104;
    const H = TOP + pz.clues.length * RH + 46;
    const root = svgRoot(W, H, t('推理解法圖', 'Deduction solution diagram'));
    const cx = function (i) { return x0 + CW * i + CW / 2; };
    root.appendChild(tx(W / 2, 20, t('每條線索都用答案驗證一次', 'Every clue is checked against the answer'), 'fg-title'));
    for (let i = 0; i < n; i++) {
      root.appendChild(s('rect', { x: cx(i) - 22, y: 32, width: 44, height: 46, rx: 4, class: 'fg-slot' }));
      root.appendChild(tx(cx(i), 66, pz.solution[i], 'fg-bignum'));
      root.appendChild(tx(cx(i), 94, t('第' + (i + 1) + '位', '#' + (i + 1)), 'fg-sub'));
      root.appendChild(s('line', { x1: cx(i), y1: 100, x2: cx(i), y2: H - 40, class: 'fg-col' }));
    }
    pz.clues.forEach(function (c, k) {
      const y = TOP + 14 + k * RH;
      const cols = clueCols(c, pz.solution);
      if (cols.length > 1) root.appendChild(s('line', { x1: cx(Math.min.apply(null, cols)), y1: y, x2: cx(Math.max.apply(null, cols)), y2: y, class: 'fg-link' }));
      cols.forEach(function (i) { root.appendChild(s('circle', { cx: cx(i), cy: y, r: 9, class: 'fg-dot' })); root.appendChild(tx(cx(i), y + 4, pz.solution[i], 'fg-dott')); });
      root.appendChild(s('circle', { cx: 14, cy: y, r: 9, class: 'fg-badge' }));
      root.appendChild(tx(14, y + 3.5, k + 1, 'fg-badget'));
      root.appendChild(tx(30, y + 26, R.clueText(c, lang), 'fg-line', 'start'));
      root.appendChild(tx(30, y + 46, '→ ' + clueCheck(c, pz.solution, lang) + '  ✓', 'fg-ok', 'start'));
    });
    root.appendChild(tx(W / 2, H - 14, t('唯一答案：', 'The only answer: ') + pz.solution.join(' '), 'fg-final-eq'));
    return root;
  }

  /* ---------- 找規則 ---------- */
  function ruleFigure(pz, lang) {
    const t = T(lang);
    const ex = R.explainPuzzle(pz, lang);
    const W = 380, RH = 30, rejected = ex.rejected.slice(0, 3);
    const H = 78 + (ex.rows.length + ex.tests.length) * RH + 40 + rejected.length * 20 + 40;
    const root = svgRoot(W, H, t('找規則解法圖', 'Rule-finding solution diagram'));
    root.appendChild(tx(W / 2, 20, t('規則：', 'Rule: ') + ex.rule, 'fg-title'));
    const cols = [18, 120, 262];
    [t('輸入', 'Input'), t('用規則計算', 'Apply the rule'), t('輸出', 'Output')].forEach(function (h, i) { root.appendChild(tx(cols[i], 48, h, 'fg-sub', 'start')); });
    root.appendChild(s('line', { x1: 10, y1: 54, x2: W - 10, y2: 54, class: 'fg-rule' }));
    let y = 78;
    ex.rows.forEach(function (r, i) {
      root.appendChild(tx(cols[0], y, r.in.join(', '), 'fg-line', 'start'));
      root.appendChild(tx(cols[1], y, r.work.replace(/ = \d+$/, ''), 'fg-line', 'start'));
      root.appendChild(tx(cols[2], y, '= ' + r.out + '  ✓', 'fg-ok', 'start'));
      void i; y += RH;
    });
    root.appendChild(s('line', { x1: 10, y1: y - 16, x2: W - 10, y2: y - 16, class: 'fg-rule fg-dash' }));
    root.appendChild(tx(10, y - 3, t('預測題', 'Predictions'), 'fg-sub', 'start')); y += 24;
    ex.tests.forEach(function (r) {
      root.appendChild(s('rect', { x: 8, y: y - 19, width: W - 16, height: 26, rx: 3, class: 'fg-hl' }));
      root.appendChild(tx(cols[0], y, r.in.join(', '), 'fg-line', 'start'));
      root.appendChild(tx(cols[1], y, r.work.replace(/ = -?\d+$/, ''), 'fg-line', 'start'));
      root.appendChild(tx(cols[2], y, '= ' + r.out, 'fg-final-eq', 'start'));
      y += RH;
    });
    y += 6;
    root.appendChild(tx(10, y, t('為什麼不是別的規則？', 'Why not the other rules?'), 'fg-sub', 'start')); y += 18;
    rejected.forEach(function (r) {
      root.appendChild(tx(14, y, '✗ ' + r.rule + t('：例 ' + (r.example + 1) + ' 會得 ' + r.got + '，不是 ' + r.want, ': example ' + (r.example + 1) + ' would give ' + r.got + ', not ' + r.want), 'fg-bad', 'start'));
      y += 20;
    });
    return root;
  }

  /* ---------- 天平配重 ---------- */
  const SH_CLS = ['fg-s0', 'fg-s1', 'fg-s2', 'fg-s3', 'fg-s4'];
  // assign: 每個圖形的重量或 null（解法時全部給）
  function scaleFigure(pz, assign, lang, opts) {
    opts = opts || {};
    const t = T(lang);
    const W = 460, RH = 128, TOP = 30;
    const sol = !!opts.solution;
    const H = TOP + pz.scales.length * RH + (sol ? 56 : 8);
    const root = svgRoot(W, H, t('天平配重圖', 'Balance diagram'));
    const SH = R.SHAPES;
    if (sol) root.appendChild(tx(W / 2, 18, t('每座天平左右兩邊的重量相等', 'Both sides of every scale weigh the same'), 'fg-title'));
    pz.scales.forEach(function (sc, k) {
      const y0 = TOP + k * RH + 24, cx = W / 2;
      const items = function (counts, c0) {
        const a = [];
        counts.forEach(function (c, i) { for (let q = 0; q < c; q++) a.push({ i: i, w: assign ? assign[i] : null }); });
        if (c0) a.push({ i: -1, w: c0 });
        return a;
      };
      const L = items(sc.L, sc.l0), Rr = items(sc.R, sc.r0);
      const known = function (a) { return a.every(function (x) { return x.w != null; }); };
      const sum = function (a) { return a.reduce(function (z, x) { return z + (x.w || 0); }, 0); };
      const full = known(L) && known(Rr);
      const ls = sum(L), rs = sum(Rr);
      const ang = full ? Math.max(-9, Math.min(9, (rs - ls) * 1.6)) : 0;   // 左重則左端下沉（角度為正 = 左低）
      const a = (-ang) * Math.PI / 180;
      const arm = 150, ex1 = cx - arm * Math.cos(a), ey1 = y0 + arm * Math.sin(a), ex2 = cx + arm * Math.cos(a), ey2 = y0 - arm * Math.sin(a);
      root.appendChild(s('polygon', { points: (cx - 10) + ',' + (y0 + 52) + ' ' + (cx + 10) + ',' + (y0 + 52) + ' ' + cx + ',' + y0, class: 'fg-stand' }));
      root.appendChild(s('line', { x1: ex1, y1: ey1, x2: ex2, y2: ey2, class: 'fg-beam' + (full && ls === rs ? ' fg-balanced' : '') }));
      root.appendChild(s('circle', { cx: cx, cy: y0, r: 5, class: 'fg-pivot' }));
      [[L, ex1, ey1, ls], [Rr, ex2, ey2, rs]].forEach(function (side) {
        const arr = side[0], ex = side[1], ey = side[2], total = side[3];
        const bw = 34, gap = 3, tw = arr.length * (bw + gap) - gap;
        root.appendChild(s('line', { x1: ex, y1: ey, x2: ex - tw / 2, y2: ey + 26, class: 'fg-rope' }));
        root.appendChild(s('line', { x1: ex, y1: ey, x2: ex + tw / 2, y2: ey + 26, class: 'fg-rope' }));
        root.appendChild(s('line', { x1: ex - tw / 2 - 4, y1: ey + 26, x2: ex + tw / 2 + 4, y2: ey + 26, class: 'fg-pan' }));
        arr.forEach(function (it, q) {
          const bx = ex - tw / 2 + q * (bw + gap);
          root.appendChild(s('rect', { x: bx, y: ey + 28, width: bw, height: 30, rx: 3, class: 'fg-item ' + (it.i >= 0 ? SH_CLS[it.i] : 'fg-const') }));
          root.appendChild(tx(bx + bw / 2, ey + 48, it.i < 0 ? it.w : (it.w != null ? SH[it.i] + it.w : SH[it.i]), 'fg-itemt'));
        });
        if (full) root.appendChild(tx(ex, ey - 8, total, 'fg-sum'));
      });
      if (sol) root.appendChild(tx(cx, y0 + 66, L.map(function (x) { return x.w; }).join('+') + ' = ' + ls + ' = ' + Rr.map(function (x) { return x.w; }).join('+') + '  ✓', 'fg-line'));
      root.appendChild(s('circle', { cx: 14, cy: y0 - 6, r: 9, class: 'fg-badge' }));
      root.appendChild(tx(14, y0 - 2.5, k + 1, 'fg-badget'));
    });
    if (sol) {
      const y = H - 18;
      root.appendChild(tx(W / 2, y, pz.solution.map(function (w, i) { return SH[i] + ' = ' + w; }).join('    '), 'fg-final-eq'));
    }
    return root;
  }

  /* ---------- 算式金字塔 ---------- */
  function pyramidFigure(pz, ops, lang, onLevel, opts) {
    opts = opts || {};
    const t = T(lang);
    const n = pz.n, CW = 56, RH = 56, W = Math.max(340, n * CW + 90), TOP = 40;
    const sol = !!opts.solution;
    const lines = sol ? pz.n - 1 : 0;
    const H = TOP + n * RH + 20 + lines * 20 + (sol ? 30 : 0);
    const root = svgRoot(W, H, t('算式金字塔圖', 'Number pyramid diagram'));
    root.appendChild(tx(W / 2, 20, t('頂端目標：', 'Top target: ') + neg(pz.target), 'fg-title'));
    // 逐層計算（運算子未選完的層以後都是 ?）
    const rows = [pz.bottom.slice()];
    let okTo = true;
    for (let l = 0; l < n - 1; l++) {
      if (!okTo || !ops || !ops[l]) { okTo = false; rows.push(null); continue; }
      const prev = rows[l]; const nx = [];
      for (let i = 0; i < prev.length - 1; i++) nx.push(ops[l] === '+' ? prev[i] + prev[i + 1] : (ops[l] === '-' ? prev[i] - prev[i + 1] : prev[i] * prev[i + 1]));
      rows.push(nx);
    }
    const cx = W / 2 + 22;
    const pos = function (r, i) { const cnt = n - r; return { x: cx + (i - (cnt - 1) / 2) * CW, y: TOP + (n - 1 - r) * RH + 18 }; };
    for (let r = 0; r < n - 1; r++) {
      const cnt = n - r - 1;
      for (let i = 0; i < cnt; i++) {
        const p = pos(r + 1, i);
        [pos(r, i), pos(r, i + 1)].forEach(function (c) { root.appendChild(s('line', { x1: c.x, y1: c.y - 14, x2: p.x, y2: p.y + 14, class: 'fg-edge' })); });
      }
    }
    for (let r = 0; r < n; r++) {
      const cnt = n - r;
      for (let i = 0; i < cnt; i++) {
        const p = pos(r, i);
        const top = r === n - 1;
        const val = rows[r] ? rows[r][i] : null;
        const hit = top && val === pz.target;
        root.appendChild(s('rect', { x: p.x - 22, y: p.y - 15, width: 44, height: 30, rx: 4, class: r === 0 ? 'fg-leaf' : 'fg-op' + (hit ? ' fg-final' : '') }));
        root.appendChild(tx(p.x, p.y + 6, val == null ? '?' : neg(val), 'fg-num'));
      }
      if (r < n - 1) {
        const op = ops && ops[r];
        const y = pos(r + 1, 0).y;
        const g = s('g', { class: 'fg-oplevel' + (onLevel ? ' is-click' : ''), 'data-level': r });
        g.appendChild(s('rect', { x: 8, y: y - 16, width: 62, height: 32, rx: 4, class: 'fg-lvl' }));
        g.appendChild(tx(39, y - 3, t('第' + (r + 1) + '層', 'L' + (r + 1)), 'fg-sub'));
        g.appendChild(tx(39, y + 12, op ? prettyOps(op) : '?', 'fg-opch'));
        if (onLevel) { g.addEventListener('click', function () { onLevel(r); }); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLevel(r); } }); }
        root.appendChild(g);
      }
    }
    if (sol) {
      const ex = R.explainPuzzle(pz, lang);
      let y = TOP + n * RH + 14;
      ex.lines.forEach(function (ln) { root.appendChild(tx(12, y, t('第' + ln.level + '層（' + prettyOps(ln.op) + '）：', 'L' + ln.level + ' (' + prettyOps(ln.op) + '): ') + neg(ln.items.join('  ；  ')), 'fg-line', 'start')); y += 20; });
      root.appendChild(tx(W / 2, y + 8, t('頂端 ', 'Top ') + neg(pz.target) + '  ✓', 'fg-final-eq'));
    }
    return root;
  }

  /* ---------- 入口 ---------- */
  function solution(pz, lang) {
    switch (pz.type) {
      case 'arith': case 'near': return exprFigure(pz, lang);
      case 'deduce': return deduceFigure(pz, lang);
      case 'rule': return ruleFigure(pz, lang);
      case 'scale': return scaleFigure(pz, pz.solution, lang, { solution: true });
      case 'pyramid': return pyramidFigure(pz, pz.solution, lang, null, { solution: true });
    }
    return s('svg');
  }

  window.Figure = {
    solution: solution,
    scale: function (pz, assign, lang) { return scaleFigure(pz, assign, lang); },
    pyramid: function (pz, ops, lang, onLevel) { return pyramidFigure(pz, ops, lang, onLevel); },
    parseTree: parseTree, clueCheck: clueCheck
  };
})();
