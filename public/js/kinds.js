/*
 * 天使的策略 — 題型擴充（瀏覽器與伺服器共用）
 * 湊近值算式、找規則、天平配重、算式金字塔；每一種題型都包含：
 *   gen(rand, diff, tier) 產生題目（保證有解；能驗證唯一者皆已驗證）
 *   check(puzzle, answer) -> { ok, reason }
 *   explain(puzzle, lang) -> 結構化解法（供文字與圖片共用）
 *   hint(puzzle, n, lang) -> 第 n 次提示的文字
 * 另外提供線上限定的三種暗標玩法：時間拍賣、大或小、移除一個（皆為真人對真人）。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AngelKinds = api;
  if (typeof module !== 'object' && root.AngelRules) api.install(root.AngelRules);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- 分數與算式小工具 ---------- */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
  function fr(n, d) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
  function fkey(f) { return f.n + '/' + f.d; }
  function fle(a, b) { return a.n * b.d <= b.n * a.d; }
  function fabsDiff(v, goal) { return fr(Math.abs(v.n - goal * v.d), v.d); }
  function showF(f) { return f.d === 1 ? String(f.n) : f.n + '/' + f.d; }

  // 子集合動態規劃：每個子集合可湊出的值 -> 一個算式
  function reachable(nums) {
    const k = nums.length, full = (1 << k) - 1;
    const sets = new Array(full + 1);
    for (let m = 1; m <= full; m++) {
      const mp = new Map();
      if ((m & (m - 1)) === 0) {
        const i = Math.log2(m);
        mp.set(nums[i] + '/1', { v: fr(nums[i], 1), e: String(nums[i]) });
      } else {
        for (let a = (m - 1) & m; a > 0; a = (a - 1) & m) {
          const b = m ^ a;
          if (a < b) continue; // 每對只處理一次，運算時雙向考慮
          sets[a].forEach(function (A) {
            sets[b].forEach(function (B) {
              const add = function (v, e) { const key = fkey(v); if (!mp.has(key)) mp.set(key, { v: v, e: e }); };
              add(fr(A.v.n * B.v.d + B.v.n * A.v.d, A.v.d * B.v.d), '(' + A.e + '+' + B.e + ')');
              add(fr(A.v.n * B.v.d - B.v.n * A.v.d, A.v.d * B.v.d), '(' + A.e + '-' + B.e + ')');
              add(fr(B.v.n * A.v.d - A.v.n * B.v.d, A.v.d * B.v.d), '(' + B.e + '-' + A.e + ')');
              add(fr(A.v.n * B.v.n, A.v.d * B.v.d), '(' + A.e + '*' + B.e + ')');
              if (B.v.n !== 0) add(fr(A.v.n * B.v.d, A.v.d * B.v.n), '(' + A.e + '/' + B.e + ')');
              if (A.v.n !== 0) add(fr(B.v.n * A.v.d, B.v.d * A.v.n), '(' + B.e + '/' + A.e + ')');
            });
          });
        }
      }
      sets[m] = mp;
    }
    return sets[full];
  }

  function install(R) {
    const parseArith = R.parseArith;
    const PH = (typeof module === 'object' && module.exports) ? require('./phrases.js') : self.AngelPhrase;
    const reg = R.registry;

    function sameMultiset(a, b) {
      if (a.length !== b.length) return false;
      const x = a.slice().sort(function (p, q) { return p - q; });
      const y = b.slice().sort(function (p, q) { return p - q; });
      return x.every(function (v, i) { return v === y[i]; });
    }
    const prettyOps = function (s) { return s.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−'); };
    const stripOuter = function (e) { return e.replace(/^\((.*)\)$/, '$1'); };

    /* ================= 湊近值算式 ================= */
    const NEAR_CFG = {
      baby:   { k: 3, max: 9,  goals: [20] },
      easy:   { k: 3, max: 13, goals: [20, 1] },
      normal: { k: 4, max: 13, goals: [20, 1] },
      hard:   { k: 4, max: 13, goals: [20, 1, 24] },
      myth:   { k: 5, max: 13, goals: [20, 1, 24] }
    };
    function bestNear(nums, goal) {
      let best = null;
      reachable(nums).forEach(function (o) {
        const d = fabsDiff(o.v, goal);
        if (!best || !fle(best.dist, d)) best = { dist: d, v: o.v, e: stripOuter(o.e) };
      });
      return best;
    }
    reg.near = {
      gen: function (rand, diff) {
        const cfg = NEAR_CFG[diff];
        for (let a = 0; a < 8; a++) {
          const nums = [];
          for (let i = 0; i < cfg.k; i++) nums.push(rand.int(1, cfg.max));
          const goal = rand.pick(cfg.goals);
          const b = bestNear(nums, goal);
          // 偏好「不能剛好等於目標」的題，才真的需要「湊近」；偶爾放行讓精準解也會出現
          if (b.dist.n === 0 && a < 5) continue;
          return { type: 'near', diff: diff, numbers: nums, goal: goal, bestDist: b.dist, solution: b.e };
        }
        const fb = bestNear([3, 4, 5], 20);
        return { type: 'near', diff: diff, numbers: [3, 4, 5], goal: 20, bestDist: fb.dist, solution: fb.e };
      },
      check: function (p, expr) {
        let r;
        try { r = parseArith(expr); } catch (e) { return { ok: false, reason: 'syntax' }; }
        if (!sameMultiset(r.used, p.numbers)) return { ok: false, reason: 'numbers' };
        if (!fle(fabsDiff(r.value, p.goal), p.bestDist)) return { ok: false, reason: 'far' };
        return { ok: true };
      },
      explain: function (p) {
        const r = parseArith(p.solution);
        return { expression: prettyOps(p.solution) + ' = ' + showF(r.value), steps: r.steps, value: showF(r.value), goal: p.goal, dist: showF(p.bestDist), exact: p.bestDist.n === 0 };
      },
      hint: function (p, n, lang) {
        const r = parseArith(p.solution);
        const s = r.steps[Math.min(n, r.steps.length - 1)];
        return PH.p(lang, 'hint.step', { s: s });
      }
    };

    /* ================= 找規則 ================= */
    const RULES = [
      { id: 'sum',   f: function (x) { return x[0] + x[1] + x[2]; },                         zh: '三個數全部相加', en: 'add all three numbers', hz: '只用到加法', he: 'It only uses addition.' },
      { id: 'range', f: function (x) { return Math.max.apply(null, x) - Math.min.apply(null, x); }, zh: '最大數 − 最小數', en: 'largest − smallest', hz: '和「最大」與「最小」有關', he: 'It involves the largest and smallest numbers.' },
      { id: 'odds',  f: function (x) { return x.filter(function (v) { return v % 2; }).reduce(function (s, v) { return s + v; }, 0); }, zh: '只把奇數相加（偶數當 0）', en: 'add only the odd numbers (evens count as 0)', hz: '奇數與偶數被區別對待', he: 'Odd and even numbers are treated differently.' },
      { id: 'evens', f: function (x) { return x.filter(function (v) { return v % 2 === 0; }).reduce(function (s, v) { return s + v; }, 0); }, zh: '只把偶數相加（奇數當 0）', en: 'add only the even numbers (odds count as 0)', hz: '奇數與偶數被區別對待', he: 'Odd and even numbers are treated differently.' },
      { id: 'abc',   f: function (x) { return x[0] * x[1] - x[2]; },                         zh: '第一個 × 第二個 − 第三個', en: '1st × 2nd − 3rd', hz: '三個位置的角色各不相同', he: 'Each position plays a different role.' },
      { id: 'abc2',  f: function (x) { return x[0] + x[1] * x[2]; },                         zh: '第一個 + 第二個 × 第三個', en: '1st + 2nd × 3rd', hz: '三個位置的角色各不相同', he: 'Each position plays a different role.' },
      { id: 'maxmin', f: function (x) { return Math.max.apply(null, x) * Math.min.apply(null, x); }, zh: '最大數 × 最小數', en: 'largest × smallest', hz: '和「最大」與「最小」有關', he: 'It involves the largest and smallest numbers.' },
      { id: 'zig',   f: function (x) { return Math.abs(x[0] - x[1]) + Math.abs(x[1] - x[2]); }, zh: '相鄰兩數的差（取正）加總', en: 'sum of the gaps between neighbours', hz: '看的是「相鄰」數字之間的距離', he: 'It looks at the distance between neighbours.' }
    ];
    const RULE_POOL = {
      baby: ['sum', 'range'], easy: ['sum', 'range', 'odds', 'evens'],
      normal: ['range', 'odds', 'evens', 'abc', 'abc2', 'maxmin'],
      hard: RULES.map(function (r) { return r.id; }), myth: RULES.map(function (r) { return r.id; })
    };
    const RULE_EX = { baby: 3, easy: 4, normal: 4, hard: 5, myth: 5 };
    const ruleById = function (id) { return RULES.filter(function (r) { return r.id === id; })[0]; };
    function triple(rand) { return [rand.int(1, 9), rand.int(1, 9), rand.int(1, 9)]; }
    function consistent(exs, cand) { return exs.every(function (e) { return cand.f(e.in) === e.out; }); }
    reg.rule = {
      gen: function (rand, diff) {
        const pool = RULE_POOL[diff];
        const truth = ruleById(rand.pick(pool));
        for (let extra = 0; extra < 4; extra++) {
          for (let a = 0; a < 300; a++) {
            const ins = [];
            const seen = {};
            while (ins.length < RULE_EX[diff] + extra) { const t = triple(rand); const k = t.join(','); if (!seen[k]) { seen[k] = 1; ins.push(t); } }
            const exs = ins.map(function (t) { return { in: t, out: truth.f(t) }; });
            const cands = RULES.filter(function (c) { return consistent(exs, c); });
            if (cands.length !== 1) continue;
            const tests = [];
            while (tests.length < 2) { const t = triple(rand); const k = t.join(','); if (!seen[k]) { seen[k] = 1; tests.push(t); } }
            return { type: 'rule', diff: diff, examples: exs, tests: tests, secret: { rule: truth.id }, solution: tests.map(truth.f) };
          }
        }
        const t = ruleById('sum');
        return { type: 'rule', diff: diff, examples: [[1, 2, 3], [4, 5, 6], [2, 2, 9], [7, 1, 1]].map(function (x) { return { in: x, out: t.f(x) }; }), tests: [[3, 3, 3], [9, 8, 1]], secret: { rule: 'sum' }, solution: [9, 18] };
      },
      check: function (p, ans) {
        if (!Array.isArray(ans) || ans.length !== p.tests.length) return { ok: false, reason: 'shape' };
        for (let i = 0; i < p.tests.length; i++) if (Number(ans[i]) !== p.solution[i]) return { ok: false, reason: 'wrong' };
        return { ok: true };
      },
      explain: function (p, lang) {
        const truth = ruleById(p.secret.rule);
        const work = function (rule, x) {
          switch (rule.id) {
            case 'sum': return x.join(' + ') + ' = ' + rule.f(x);
            case 'range': { const mx = Math.max.apply(null, x), mn = Math.min.apply(null, x); return mx + ' − ' + mn + ' = ' + (mx - mn); }
            case 'odds': { const o = x.filter(function (v) { return v % 2; }); return (o.length ? o.join(' + ') : '0') + ' = ' + rule.f(x); }
            case 'evens': { const o = x.filter(function (v) { return v % 2 === 0; }); return (o.length ? o.join(' + ') : '0') + ' = ' + rule.f(x); }
            case 'abc': return x[0] + ' × ' + x[1] + ' − ' + x[2] + ' = ' + rule.f(x);
            case 'abc2': return x[0] + ' + ' + x[1] + ' × ' + x[2] + ' = ' + rule.f(x);
            case 'maxmin': return Math.max.apply(null, x) + ' × ' + Math.min.apply(null, x) + ' = ' + rule.f(x);
            default: return '|' + x[0] + ' − ' + x[1] + '| + |' + x[1] + ' − ' + x[2] + '| = ' + rule.f(x);
          }
        };
        // 為什麼其他規則不行：每個排除對象找出第一個不符的例子
        const rejected = [];
        RULES.forEach(function (c) {
          if (c.id === truth.id) return;
          for (let i = 0; i < p.examples.length; i++) {
            const e = p.examples[i];
            if (c.f(e.in) !== e.out) { rejected.push({ rule: PH.p(lang, 'rule.' + c.id), example: i, got: c.f(e.in), want: e.out }); return; }
          }
        });
        return {
          rule: PH.p(lang, 'rule.' + truth.id),
          rows: p.examples.map(function (e) { return { in: e.in, out: e.out, work: work(truth, e.in) }; }),
          tests: p.tests.map(function (x, i) { return { in: x, out: p.solution[i], work: work(truth, x) }; }),
          rejected: rejected
        };
      },
      hint: function (p, n, lang) {
        const truth = ruleById(p.secret.rule);
        if (n === 0) return PH.p(lang, 'rhint.' + truth.id);
        const e = p.examples[0];
        return PH.p(lang, 'hint.rule', { ex: e.in.join(', ') + ' → ' + e.out, r: PH.p(lang, 'rule.' + truth.id) });
      }
    };

    /* ================= 天平配重 ================= */
    const SHAPES = ['▲', '●', '■', '◆', '★'];
    const SCALE_CFG = {
      baby:   { m: 2, bag: 4, w: 6,  side: 3 },
      easy:   { m: 3, bag: 5, w: 8,  side: 3 },
      normal: { m: 3, bag: 6, w: 10, side: 4 },
      hard:   { m: 4, bag: 7, w: 12, side: 4 },
      myth:   { m: 5, bag: 8, w: 14, side: 4 }
    };
    function sideSum(counts, c0, w) { return counts.reduce(function (s, c, i) { return s + c * w[i]; }, 0) + c0; }
    function balanced(sc, w) { return sideSum(sc.L, sc.l0, w) === sideSum(sc.R, sc.r0, w); }
    // 在 bag 中取 m 個不重複排列，計算滿足所有天平的組合數（超過 1 個就停）
    function scaleSolutions(bag, m, scales, stopAt) {
      const out = [];
      const cur = []; const used = new Array(bag.length).fill(false);
      (function rec() {
        if (out.length >= stopAt) return;
        if (cur.length === m) { if (scales.every(function (s) { return balanced(s, cur); })) out.push(cur.slice()); return; }
        for (let i = 0; i < bag.length; i++) { if (used[i]) continue; used[i] = true; cur.push(bag[i]); rec(); cur.pop(); used[i] = false; }
      })();
      return out;
    }
    reg.scale = {
      gen: function (rand, diff) {
        const cfg = SCALE_CFG[diff];
        for (let attempt = 0; attempt < 200; attempt++) {
          const all = []; for (let v = 1; v <= cfg.w; v++) all.push(v);
          const bag = rand.shuffle(all).slice(0, cfg.bag).sort(function (a, b) { return a - b; });
          const w = rand.shuffle(bag).slice(0, cfg.m);
          const scales = [];
          let guard = 0;
          while (guard++ < 40) {
            const L = new Array(cfg.m).fill(0), Rr = new Array(cfg.m).fill(0);
            const nl = rand.int(1, cfg.side), nr = rand.int(0, cfg.side - 1);
            for (let i = 0; i < nl; i++) L[rand.int(0, cfg.m - 1)]++;
            for (let i = 0; i < nr; i++) Rr[rand.int(0, cfg.m - 1)]++;
            const diffV = sideSum(L, 0, w) - sideSum(Rr, 0, w);
            let l0 = 0, r0 = 0;
            if (diffV > 0) r0 = diffV; else l0 = -diffV;
            if (l0 > 24 || r0 > 24) continue;
            const net = L.map(function (c, i) { return c - Rr[i]; });
            if (net.every(function (x) { return x === 0; })) continue;
            const sc = { L: L, R: Rr, l0: l0, r0: r0 };
            if (scales.some(function (o) { return JSON.stringify(o) === JSON.stringify(sc); })) continue;
            scales.push(sc);
            if (scales.length >= 2 && scaleSolutions(bag, cfg.m, scales, 2).length === 1) break;
            if (scales.length >= cfg.m + 1) break;
          }
          if (scales.length < 2 || scaleSolutions(bag, cfg.m, scales, 2).length !== 1) continue;
          // 剪掉多餘的天平
          for (let i = scales.length - 1; i >= 0 && scales.length > 2; i--) {
            const rest = scales.slice(0, i).concat(scales.slice(i + 1));
            if (scaleSolutions(bag, cfg.m, rest, 2).length === 1) scales.splice(i, 1);
          }
          return { type: 'scale', diff: diff, m: cfg.m, bag: bag, scales: scales, solution: w };
        }
        return { type: 'scale', diff: diff, m: 2, bag: [1, 2, 3, 4], scales: [{ L: [1, 0], R: [0, 1], l0: 1, r0: 0 }, { L: [2, 0], R: [0, 1], l0: 0, r0: 2 }], solution: [3, 4] };
      },
      check: function (p, ans) {
        if (!Array.isArray(ans) || ans.length !== p.m) return { ok: false, reason: 'shape' };
        const w = ans.map(Number);
        if (w.some(function (v) { return !isFinite(v); })) return { ok: false, reason: 'shape' };
        if (w.some(function (v) { return p.bag.indexOf(v) === -1; })) return { ok: false, reason: 'bag' };
        if (new Set(w).size !== w.length) return { ok: false, reason: 'distinct' };
        if (!p.scales.every(function (s) { return balanced(s, w); })) return { ok: false, reason: 'unbalanced' };
        return { ok: true };
      },
      explain: function (p) {
        const w = p.solution;
        return {
          weights: w.slice(),
          rows: p.scales.map(function (s) {
            const part = function (counts, c0) {
              const t = [];
              counts.forEach(function (c, i) { for (let k = 0; k < c; k++) t.push({ shape: SHAPES[i], w: w[i] }); });
              if (c0) t.push({ shape: '', w: c0 });
              return t;
            };
            const L = part(s.L, s.l0), Rr = part(s.R, s.r0);
            const sum = function (a) { return a.reduce(function (x, y) { return x + y.w; }, 0); };
            return { left: L, right: Rr, lsum: sum(L), rsum: sum(Rr) };
          })
        };
      },
      hint: function (p, n, lang) {
        const i = Math.min(n, p.m - 1);
        return PH.p(lang, 'hint.scale', { s: SHAPES[i], w: p.solution[i] });
      }
    };

    /* ================= 算式金字塔 ================= */
    const PYR_CFG = {
      baby:   { n: 3, max: 9, ops: ['+', '-'] },
      easy:   { n: 4, max: 9, ops: ['+', '-', '*'] },
      normal: { n: 4, max: 12, ops: ['+', '-', '*'] },
      hard:   { n: 5, max: 9, ops: ['+', '-', '*'] },
      myth:   { n: 6, max: 9, ops: ['+', '-', '*'] }
    };
    function applyOp(op, a, b) { return op === '+' ? a + b : (op === '-' ? a - b : a * b); }
    function pyramidRows(bottom, ops) {
      const rows = [bottom.slice()];
      for (let l = 0; l < ops.length; l++) {
        const prev = rows[l]; const next = [];
        for (let i = 0; i < prev.length - 1; i++) next.push(applyOp(ops[l], prev[i], prev[i + 1]));
        rows.push(next);
      }
      return rows;
    }
    function allOps(levels, set) {
      let out = [[]];
      for (let i = 0; i < levels; i++) { const nx = []; out.forEach(function (o) { set.forEach(function (s) { nx.push(o.concat([s])); }); }); out = nx; }
      return out;
    }
    reg.pyramid = {
      gen: function (rand, diff) {
        const cfg = PYR_CFG[diff];
        const combos = allOps(cfg.n - 1, ['+', '-', '*']);
        let fallback = null;
        for (let a = 0; a < 120; a++) {
          const bottom = []; for (let i = 0; i < cfg.n; i++) bottom.push(rand.int(1, cfg.max));
          const ops = []; for (let i = 0; i < cfg.n - 1; i++) ops.push(rand.pick(cfg.ops));
          const rows = pyramidRows(bottom, ops);
          const target = rows[rows.length - 1][0];
          if (Math.abs(target) > 999 || target === 0) continue;
          const sols = combos.filter(function (o) { const r = pyramidRows(bottom, o); return r[r.length - 1][0] === target; });
          const pz = { type: 'pyramid', diff: diff, n: cfg.n, bottom: bottom, target: target, ops: cfg.ops.slice(), solution: ops, solutions: sols.length };
          if (sols.length === 1) return pz;
          if (!fallback || sols.length < fallback.solutions) fallback = pz;
        }
        return fallback || { type: 'pyramid', diff: diff, n: 3, bottom: [2, 3, 4], target: 14, ops: ['+', '-', '*'], solution: ['+', '*'], solutions: 1 };
      },
      check: function (p, ans) {
        if (!Array.isArray(ans) || ans.length !== p.n - 1) return { ok: false, reason: 'shape' };
        if (ans.some(function (o) { return p.ops.indexOf(o) === -1; })) return { ok: false, reason: 'shape' };
        const rows = pyramidRows(p.bottom, ans);
        return rows[rows.length - 1][0] === p.target ? { ok: true } : { ok: false, reason: 'value' };
      },
      explain: function (p) {
        const rows = pyramidRows(p.bottom, p.solution);
        const lines = [];
        for (let l = 0; l < p.solution.length; l++) {
          const parts = [];
          for (let i = 0; i < rows[l].length - 1; i++) parts.push(rows[l][i] + ' ' + prettyOps(p.solution[l]) + ' ' + rows[l][i + 1] + ' = ' + rows[l + 1][i]);
          lines.push({ level: l + 1, op: p.solution[l], items: parts });
        }
        return { rows: rows, ops: p.solution.slice(), lines: lines };
      },
      hint: function (p, n, lang) {
        const l = Math.min(n, p.n - 2);
        const names = { '+': '＋', '-': '−', '*': '×' };
        return PH.p(lang, 'hint.pyr', { l: l + 1, op: names[p.solution[l]] });
      }
    };

    /* ================= 線上暗標玩法（真人對真人） ================= */
    // ---- 時間拍賣：每人有「時間」存量；出價最高且唯一者拿下獎勵並付出該時間；最高價並列者各自燒掉出價，無人得標 ----
    const BANK_START = 30;
    function auctionParams(rand) { return { prize: rand.int(1, 3) }; }
    // bids { id: int|null }；banks { id: int }
    function resolveAuction(params, bids, banks) {
      const ids = Object.keys(bids);
      const eff = {};
      ids.forEach(function (id) {
        let b = Math.floor(Number(bids[id]));
        if (!isFinite(b) || b < 0) b = 0;
        eff[id] = Math.min(b, banks[id] || 0);
      });
      const top = Math.max.apply(null, ids.map(function (id) { return eff[id]; }).concat([-1]));
      const topIds = ids.filter(function (id) { return eff[id] === top; });
      const points = {}, spend = {}, ranks = {};
      ids.forEach(function (id) { points[id] = 0; spend[id] = 0; });
      let winner = null, tie = false;
      if (top <= 0) { /* 全員 0：流標 */ }
      else if (topIds.length === 1) { winner = topIds[0]; points[winner] = params.prize; spend[winner] = top; }
      else { tie = true; topIds.forEach(function (id) { spend[id] = top; }); }
      const sorted = ids.slice().sort(function (a, b) { return points[b] - points[a] || eff[b] - eff[a]; });
      let rk = 0, prev = null;
      sorted.forEach(function (id, i) { const key = points[id] + ':' + (winner === id ? 1 : 0); if (prev !== key) { rk = i + 1; prev = key; } ranks[id] = rk; });
      return { points: points, spend: spend, ranks: ranks, winners: winner ? [winner] : [], info: { bids: eff, top: top, winner: winner, tie: tie, prize: params.prize } };
    }

    // ---- 大或小：每人看得到「別人」的牌，看不到自己的；猜自己的牌是全場最大(H)、最小(L)或都不是(M) ----
    function dealHilo(rand, ids) {
      const deck = []; for (let v = 1; v <= 13; v++) deck.push(v);
      const d = rand.shuffle(deck).slice(0, ids.length);
      const cards = {}; ids.forEach(function (id, i) { cards[id] = d[i]; });
      return cards;
    }
    function hiloTruth(cards, id) {
      const vals = Object.keys(cards).map(function (k) { return cards[k]; });
      const mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
      return cards[id] === mx ? 'H' : (cards[id] === mn ? 'L' : 'M');
    }
    function resolveHilo(cards, calls) {
      const ids = Object.keys(cards);
      const points = {}, ranks = {}, truth = {};
      ids.forEach(function (id) {
        truth[id] = hiloTruth(cards, id);
        points[id] = (calls[id] === truth[id]) ? 2 : 0;
      });
      const anyRight = ids.some(function (id) { return points[id] > 0; });
      ids.forEach(function (id) { ranks[id] = points[id] > 0 || !anyRight ? 1 : 2; });
      const winners = ids.filter(function (id) { return points[id] > 0; });
      return { points: points, ranks: ranks, winners: winners, info: { cards: cards, truth: truth, calls: calls } };
    }

    // ---- 移除一個：每人從 4 張手牌挑 2 張打出；場上最大與最小的牌（同點全部）被移除，剩下的牌點數總和最高者勝 ----
    function dealRemove(rand, ids) {
      const hands = {};
      ids.forEach(function (id) { const h = []; for (let i = 0; i < 4; i++) h.push(rand.int(1, 12)); hands[id] = h; });
      return hands;
    }
    function resolveRemove(hands, plays) {
      const ids = Object.keys(hands);
      const played = {};
      ids.forEach(function (id) {
        const p = plays[id];
        const ok = Array.isArray(p) && p.length === 2 && p[0] !== p[1] && p.every(function (i) { return Number.isInteger(i) && i >= 0 && i < 4; });
        played[id] = ok ? p.map(function (i) { return hands[id][i]; }) : null;
      });
      const all = []; ids.forEach(function (id) { if (played[id]) played[id].forEach(function (v) { all.push(v); }); });
      const mx = Math.max.apply(null, all.concat([-1])), mn = Math.min.apply(null, all.concat([99]));
      const score = {}, removed = {};
      ids.forEach(function (id) {
        const cs = played[id] || [];
        removed[id] = cs.map(function (v) { return all.length > 0 && (v === mx || v === mn); });
        score[id] = cs.reduce(function (s, v, i) { return s + (removed[id][i] ? 0 : v); }, 0);
      });
      const items = ids.map(function (id) { return { id: id, key: played[id] ? -score[id] : 1e9 }; });
      const ranks = R.rankByKey(items);
      const points = {}, winners = [];
      ids.forEach(function (id) { points[id] = played[id] ? R.pointsForRank(ranks[id], ids.length) : 0; if (played[id] && ranks[id] === 1) winners.push(id); });
      return { points: points, ranks: ranks, winners: winners, info: { hands: hands, played: played, removed: removed, score: score, max: mx, min: mn } };
    }

    Object.assign(R, {
      SHAPES: SHAPES, RULES: RULES, BANK_START: BANK_START,
      bestNear: bestNear, pyramidRows: pyramidRows, scaleBalanced: balanced, scaleSideSum: sideSum, scaleSolutions: scaleSolutions,
      auctionParams: auctionParams, resolveAuction: resolveAuction,
      dealHilo: dealHilo, hiloTruth: hiloTruth, resolveHilo: resolveHilo,
      dealRemove: dealRemove, resolveRemove: resolveRemove
    });
    return R;
  }

  return { install: install };
});
