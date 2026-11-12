/*
 * 天使的策略 — 規則核心
 * 瀏覽器與伺服器共用，純函式、無副作用，隨機一律走可注入的種子亂數。
 * 玩法：邏輯推理（線索數字鎖）、限時算式（湊數）、數字博弈（多人）、混合關卡（魔王關）。
 * 本專案全程沒有電腦對手；單機只有單人解題，博弈類只存在於線上真人對局。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); require('./kinds.js').install(module.exports); }
  else root.AngelRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIFFS = ['baby', 'easy', 'normal', 'hard', 'myth'];
  const LEVELS_PER_DIFF = 50;
  const BOSS_EVERY = 10;
  const FORMATS = ['chips', 'elimination', 'points'];
  const NUM_MODES = ['avg', 'lowunique', 'highunique'];

  /* ---------- 種子亂數 ---------- */
  function hashSeed(str) {
    let h = 1779033703 ^ String(str).length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function makeRng(seed) {
    let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(String(seed));
    const next = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = function (min, max) { return min + Math.floor(next() * (max - min + 1)); };
    next.pick = function (arr) { return arr[Math.floor(next() * arr.length)]; };
    next.shuffle = function (arr) {
      const r = arr.slice();
      for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = r[i]; r[i] = r[j]; r[j] = t;
      }
      return r;
    };
    return next;
  }

  /* ---------- 邏輯推理：線索數字鎖 ---------- */
  const DEDUCE_CFG = {
    baby:   { n: 3, pool: 7,  kinds: ['sum', 'gt', 'par'] },
    easy:   { n: 3, pool: 10, kinds: ['sum', 'gt', 'par', 'diff', 'big'] },
    normal: { n: 4, pool: 10, kinds: ['sum', 'gt', 'par', 'diff', 'big', 'mul'] },
    hard:   { n: 4, pool: 10, kinds: ['sum', 'gt', 'par', 'diff', 'big', 'mul', 'has'] },
    myth:   { n: 5, pool: 10, kinds: ['sum', 'gt', 'par', 'diff', 'big', 'mul', 'has'] }
  };

  const permCache = {};
  function allCodes(n, pool) {
    const key = n + ':' + pool;
    if (permCache[key]) return permCache[key];
    const out = [];
    const cur = [];
    const used = new Array(pool).fill(false);
    (function rec() {
      if (cur.length === n) { out.push(cur.slice()); return; }
      for (let d = 0; d < pool; d++) {
        if (used[d]) continue;
        used[d] = true; cur.push(d);
        rec();
        cur.pop(); used[d] = false;
      }
    })();
    permCache[key] = out;
    return out;
  }

  function clueHolds(c, d) {
    switch (c.t) {
      case 'sum': return c.p.reduce(function (s, i) { return s + d[i]; }, 0) === c.v;
      case 'gt': return d[c.a] > d[c.b];
      case 'par': return (d[c.i] % 2 === 0) === c.even;
      case 'diff': return Math.abs(d[c.a] - d[c.b]) === c.v;
      case 'big': return (d[c.i] >= 5) === c.big;
      case 'mul': return ((d[c.i] % c.k === 0) !== !!c.no);
      case 'has': return (d.indexOf(c.v) !== -1) === c.yes;
      default: return false;
    }
  }

  function makeClue(rand, kind, secret) {
    const n = secret.length;
    const pickPos = function () { return rand.int(0, n - 1); };
    let a, b;
    switch (kind) {
      case 'sum': {
        const size = rand.int(2, Math.min(n, 3));
        const idx = rand.shuffle(secret.map(function (_, i) { return i; })).slice(0, size).sort();
        return { t: 'sum', p: idx, v: idx.reduce(function (s, i) { return s + secret[i]; }, 0) };
      }
      case 'gt':
        a = pickPos(); do { b = pickPos(); } while (b === a);
        return secret[a] > secret[b] ? { t: 'gt', a: a, b: b } : { t: 'gt', a: b, b: a };
      case 'par': { const i = pickPos(); return { t: 'par', i: i, even: secret[i] % 2 === 0 }; }
      case 'diff':
        a = pickPos(); do { b = pickPos(); } while (b === a);
        return { t: 'diff', a: Math.min(a, b), b: Math.max(a, b), v: Math.abs(secret[a] - secret[b]) };
      case 'big': { const i = pickPos(); return { t: 'big', i: i, big: secret[i] >= 5 }; }
      case 'mul': {
        const i = pickPos(); const k = rand.pick([2, 3, 4]);
        return { t: 'mul', i: i, k: k, no: secret[i] % k !== 0 };
      }
      case 'has': {
        const v = rand.int(0, 9);
        return { t: 'has', v: v, yes: secret.indexOf(v) !== -1 };
      }
    }
    return null;
  }

  function countSolutions(codes, clues) {
    let n = 0;
    for (let i = 0; i < codes.length; i++) {
      let ok = true;
      for (let j = 0; j < clues.length; j++) if (!clueHolds(clues[j], codes[i])) { ok = false; break; }
      if (ok && ++n > 1) return n;
    }
    return n;
  }

  function genDeduce(rand, diff, tier) {
    const cfg = DEDUCE_CFG[diff];
    const codes = allCodes(cfg.n, cfg.pool);
    const secret = codes[rand.int(0, codes.length - 1)].slice();
    const kinds = cfg.kinds;
    let clues = [];
    let guard = 0;
    while (countSolutions(codes, clues) !== 1 && guard++ < 80) {
      const c = makeClue(rand, rand.pick(kinds), secret);
      if (c && !clues.some(function (x) { return JSON.stringify(x) === JSON.stringify(c); })) clues.push(c);
    }
    // 剪掉多餘線索，保留唯一解
    for (let i = clues.length - 1; i >= 0; i--) {
      const rest = clues.slice(0, i).concat(clues.slice(i + 1));
      if (countSolutions(codes, rest) === 1) clues = rest;
    }
    // 魔王關／高階層：線索再打散順序即可，不加雜訊線索
    void tier;
    return { type: 'deduce', diff: diff, n: cfg.n, pool: cfg.pool, clues: clues, solution: secret };
  }

  function checkDeduce(puzzle, answer) {
    if (!Array.isArray(answer) || answer.length !== puzzle.n) return false;
    for (let i = 0; i < puzzle.n; i++) if (answer[i] !== puzzle.solution[i]) return false;
    return true;
  }

  function deduceHint(puzzle, revealed) {
    const rest = [];
    for (let i = 0; i < puzzle.n; i++) if (revealed.indexOf(i) === -1) rest.push(i);
    if (!rest.length) return null;
    const pos = rest[0];
    return { pos: pos, digit: puzzle.solution[pos] };
  }

  const POS_ZH = ['第一位', '第二位', '第三位', '第四位', '第五位'];
  const POS_EN = ['1st', '2nd', '3rd', '4th', '5th'];
  function clueText(c, lang) {
    const en = lang === 'en';
    const P = function (i) { return en ? POS_EN[i] : POS_ZH[i]; };
    switch (c.t) {
      case 'sum':
        return en ? 'Digits ' + c.p.map(P).join(' + ') + ' add up to ' + c.v
                  : c.p.map(P).join('、') + '相加等於 ' + c.v;
      case 'gt': return en ? 'The ' + P(c.a) + ' digit is greater than the ' + P(c.b)
                           : P(c.a) + '比' + P(c.b) + '大';
      case 'par': return en ? 'The ' + P(c.i) + ' digit is ' + (c.even ? 'even' : 'odd')
                            : P(c.i) + '是' + (c.even ? '偶數' : '奇數');
      case 'diff': return en ? 'The ' + P(c.a) + ' and ' + P(c.b) + ' digits differ by ' + c.v
                             : P(c.a) + '與' + P(c.b) + '相差 ' + c.v;
      case 'big': return en ? 'The ' + P(c.i) + ' digit is ' + (c.big ? '5 or more' : '4 or less')
                            : P(c.i) + (c.big ? '至少是 5' : '不超過 4');
      case 'mul':
        return en ? 'The ' + P(c.i) + ' digit is ' + (c.no ? 'not ' : '') + 'a multiple of ' + c.k
                  : P(c.i) + (c.no ? '不是 ' : '是 ') + c.k + ' 的倍數';
      case 'has': return en ? 'The code ' + (c.yes ? 'contains' : 'does not contain') + ' the digit ' + c.v
                            : '密碼' + (c.yes ? '含有' : '不含') + '數字 ' + c.v;
    }
    return '';
  }

  /* ---------- 限時算式：湊數 ---------- */
  const ARITH_CFG = {
    baby:   { k: 3, max: 9,  ops: ['+', '-', '*'],      tmax: 40 },
    easy:   { k: 4, max: 9,  ops: ['+', '-', '*'],      tmax: 60 },
    normal: { k: 4, max: 13, ops: ['+', '-', '*', '/'], tmax: 100 },
    hard:   { k: 5, max: 13, ops: ['+', '-', '*', '/'], tmax: 150 },
    myth:   { k: 5, max: 20, ops: ['+', '-', '*', '/'], tmax: 250 }
  };

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
  function frac(n, d) {
    if (d === 0) throw new Error('div0');
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    n /= g; d /= g;
    if (Math.abs(n) > 1e9 || d > 1e9) throw new Error('big');
    return { n: n, d: d };
  }

  function parseArith(input) {
    const s = String(input == null ? '' : input)
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); })
      .replace(/[＋]/g, '+').replace(/[－−–—]/g, '-').replace(/[×✕✖xX＊]/g, '*')
      .replace(/[÷／]/g, '/').replace(/[（]/g, '(').replace(/[）]/g, ')')
      .replace(/\s+/g, '');
    if (!s) throw new Error('empty');
    if (s.length > 80) throw new Error('long');
    let i = 0;
    const used = [];
    const steps = [];
    const show = function (f) { return f.d === 1 ? String(f.n) : f.n + '/' + f.d; };
    function number() {
      const m = /^\d+/.exec(s.slice(i));
      if (!m) throw new Error('syntax');
      i += m[0].length;
      const v = parseInt(m[0], 10);
      used.push(v);
      return frac(v, 1);
    }
    function factor() {
      if (s[i] === '(') {
        i++;
        const v = expr();
        if (s[i] !== ')') throw new Error('syntax');
        i++;
        return v;
      }
      return number();
    }
    function term() {
      let v = factor();
      while (s[i] === '*' || s[i] === '/') {
        const op = s[i++];
        const r = factor();
        const res = op === '*' ? frac(v.n * r.n, v.d * r.d) : frac(v.n * r.d, v.d * r.n);
        steps.push(show(v) + (op === '*' ? ' × ' : ' ÷ ') + show(r) + ' = ' + show(res));
        v = res;
      }
      return v;
    }
    function expr() {
      let v = term();
      while (s[i] === '+' || s[i] === '-') {
        const op = s[i++];
        const r = term();
        const res = op === '+' ? frac(v.n * r.d + r.n * v.d, v.d * r.d) : frac(v.n * r.d - r.n * v.d, v.d * r.d);
        steps.push(show(v) + (op === '+' ? ' + ' : ' − ') + show(r) + ' = ' + show(res));
        v = res;
      }
      return v;
    }
    const value = expr();
    if (i !== s.length) throw new Error('syntax');
    return { value: value, used: used, steps: steps };
  }

  /* ---------- 每一題都附解法 ---------- */
  // 算式題：回傳 { expression, steps[] }，steps 依運算順序逐步列出
  function explainArith(puzzle) {
    const r = parseArith(puzzle.solution);
    return {
      expression: puzzle.solution.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−') + ' = ' + puzzle.target,
      steps: r.steps
    };
  }

  // 推理題：依線索順序逐條縮小可能範圍，最後得到唯一解
  function explainDeduce(puzzle, lang) {
    const codes = allCodes(puzzle.n, puzzle.pool);
    let remain = codes;
    const steps = [];
    puzzle.clues.forEach(function (c) {
      remain = remain.filter(function (d) { return clueHolds(c, d); });
      steps.push({ clue: clueText(c, lang), remain: remain.length });
    });
    return { steps: steps, answer: puzzle.solution.slice() };
  }

  // 數字博弈：說明本回合怎麼分出勝負
  function explainNumGame(params, result, lang) {
    const en = lang === 'en';
    const info = result.info || {};
    if (info.void) return en ? 'No valid winner this round: everyone collided or nobody picked.' : '本回合無人勝出：全員撞號或沒有人出數字。';
    if (params.mode === 'avg') {
      const f = Math.round(params.factor * 100) / 100;
      return en
        ? 'Average ' + info.mean + ' × ' + f + ' = target ' + info.target + '. The closest pick wins.'
        : '平均數 ' + info.mean + ' × ' + f + ' = 目標 ' + info.target + '，最接近目標者勝。';
    }
    return params.mode === 'lowunique'
      ? (en ? 'Among numbers picked by exactly one player, the lowest wins; duplicated numbers all lose.' : '只有一人選的數字才算數，其中最小者勝；撞號者全部墊底。')
      : (en ? 'Among numbers picked by exactly one player, the highest wins; duplicated numbers all lose.' : '只有一人選的數字才算數，其中最大者勝；撞號者全部墊底。');
  }

  function sameMultiset(a, b) {
    if (a.length !== b.length) return false;
    const x = a.slice().sort(function (p, q) { return p - q; });
    const y = b.slice().sort(function (p, q) { return p - q; });
    return x.every(function (v, k) { return v === y[k]; });
  }

  // 回傳 { ok, reason }；reason: syntax | numbers | value
  function checkArith(puzzle, expression) {
    let r;
    try { r = parseArith(expression); } catch (e) { return { ok: false, reason: 'syntax' }; }
    if (!sameMultiset(r.used, puzzle.numbers)) return { ok: false, reason: 'numbers' };
    if (r.value.d !== 1 || r.value.n !== puzzle.target) return { ok: false, reason: 'value' };
    return { ok: true };
  }

  function genArith(rand, diff, tier) {
    const cfg = ARITH_CFG[diff];
    const max = cfg.max + Math.min(tier || 0, 4);
    for (let attempt = 0; attempt < 400; attempt++) {
      const nums = [];
      for (let i = 0; i < cfg.k; i++) nums.push(rand.int(1, max));
      let pool = nums.map(function (v) { return { v: v, e: String(v) }; });
      let fail = false;
      while (pool.length > 1 && !fail) {
        const ia = rand.int(0, pool.length - 1);
        let ib; do { ib = rand.int(0, pool.length - 1); } while (ib === ia);
        const A = pool[ia], B = pool[ib];
        const ops = rand.shuffle(cfg.ops);
        let made = null;
        for (let o = 0; o < ops.length && !made; o++) {
          const op = ops[o];
          if (op === '+') made = { v: A.v + B.v, e: '(' + A.e + '+' + B.e + ')' };
          else if (op === '*') made = { v: A.v * B.v, e: '(' + A.e + '*' + B.e + ')' };
          else if (op === '-' && A.v > B.v) made = { v: A.v - B.v, e: '(' + A.e + '-' + B.e + ')' };
          else if (op === '/' && B.v !== 0 && A.v % B.v === 0 && B.v !== 1) made = { v: A.v / B.v, e: '(' + A.e + '/' + B.e + ')' };
        }
        if (!made || made.v > 999) { fail = true; break; }
        pool = pool.filter(function (_, idx) { return idx !== ia && idx !== ib; });
        pool.push(made);
      }
      if (fail) continue;
      const fin = pool[0];
      if (fin.v < 2 || fin.v > cfg.tmax || nums.indexOf(fin.v) !== -1) continue;
      const solution = fin.e.replace(/^\((.*)\)$/, '$1');
      return { type: 'arith', diff: diff, numbers: rand.shuffle(nums), target: fin.v, solution: solution };
    }
    // 極少見的保底題
    return { type: 'arith', diff: diff, numbers: [2, 3, 4].slice(0, cfg.k).concat(new Array(Math.max(0, cfg.k - 3)).fill(1)), target: 14, solution: '2+3*4' };
  }

  /* ---------- 題型登錄表（kinds.js 會補上其餘題型） ---------- */
  const registry = {
    deduce: {
      gen: function (rand, diff, tier) { return genDeduce(rand, diff, tier); },
      check: function (p, a) { return { ok: checkDeduce(p, a) }; },
      explain: function (p, lang) { return explainDeduce(p, lang); },
      hint: function (p, n, lang) { const h = deduceHint(p, []); void n; return h ? (lang === 'en' ? 'Position ' : '第 ') + (h.pos + 1) + (lang === 'en' ? ' is ' : ' 位是 ') + h.digit : ''; }
    },
    arith: {
      gen: function (rand, diff, tier) { return genArith(rand, diff, tier); },
      check: function (p, a) { return checkArith(p, a); },
      explain: function () { return null; },
      hint: function (p, n) { const s = parseArith(p.solution).steps; return s[Math.min(n, s.length - 1)]; }
    }
  };
  const PUZZLE_KINDS = ['deduce', 'arith', 'near', 'rule', 'scale', 'pyramid'];
  function checkPuzzle(p, answer) { return registry[p.type].check(p, answer); }
  function explainPuzzle(p, lang) { return p.type === 'arith' ? explainArith(p) : registry[p.type].explain(p, lang); }
  function hintPuzzle(p, n, lang) { return registry[p.type].hint(p, n, lang); }

  /* ---------- 關卡、時限、星等 ---------- */
  function isBoss(level) { return level % BOSS_EVERY === 0; }
  const KIND_CYCLE = ['deduce', 'arith', 'pyramid', 'rule', 'near', 'scale', 'deduce', 'arith'];
  const BOSS_SETS = [['deduce', 'arith', 'deduce'], ['rule', 'pyramid', 'near'], ['scale', 'deduce', 'arith'], ['near', 'rule', 'scale'], ['pyramid', 'scale', 'arith']];
  function levelKind(level) { return isBoss(level) ? 'boss' : KIND_CYCLE[(level - 1) % KIND_CYCLE.length]; }
  function tierOf(level) { return Math.floor((level - 1) / BOSS_EVERY); }

  const TIME_BASE = { baby: null, easy: 150, normal: 120, hard: 100, myth: 80 };
  function timeLimitSec(diff, level) {
    const base = TIME_BASE[diff];
    if (base == null) return null;
    const t = base - tierOf(level) * 6;
    const boss = isBoss(level) ? 2.6 : 1;
    return Math.round(Math.max(30, t) * boss);
  }
  const HINTS = { baby: Infinity, easy: 3, normal: 2, hard: 1, myth: 0 };
  function hintLimit(diff) { return HINTS[diff]; }

  function buildPuzzle(kind, rand, diff, tier) {
    return registry[kind].gen(rand, diff, tier);
  }

  // 單人關卡題目：boss 為三題連解（推理、算式、推理）
  function levelPuzzles(diff, level) {
    const rand = makeRng('lv:' + diff + ':' + level);
    const tier = tierOf(level);
    const kind = levelKind(level);
    if (kind === 'boss') {
      return BOSS_SETS[tier % BOSS_SETS.length].map(function (k) { return buildPuzzle(k, rand, diff, tier); });
    }
    return [buildPuzzle(kind, rand, diff, tier)];
  }

  function starsFor(diff, level, usedSec, hints) {
    const limit = timeLimitSec(diff, level);
    const cap = HINTS[diff];
    if (limit == null) return hints === 0 ? 3 : (hints <= 2 ? 2 : 1);
    const ratio = usedSec / limit;
    if (hints === 0 && ratio <= 0.5) return 3;
    if (hints <= (cap === Infinity ? 1 : 1) && ratio <= 0.8) return 2;
    return 1;
  }

  /* ---------- 每日挑戰（台北時間切日） ---------- */
  function taipeiDate(nowMs) {
    const t = new Date((nowMs == null ? Date.now() : nowMs) + 8 * 3600 * 1000);
    return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(t.getUTCDate()).padStart(2, '0');
  }
  function dailyPuzzles(dateStr, diff) {
    const rand = makeRng('daily:' + dateStr + ':' + diff);
    // 每天從六種題型中抽 4 種不重複的題
    return rand.shuffle(PUZZLE_KINDS).slice(0, 4).map(function (k, i) { return buildPuzzle(k, rand, diff, 1 + (i > 2 ? 1 : 0)); });
  }
  function dailyTimeLimitSec(diff) {
    const base = TIME_BASE[diff];
    return base == null ? null : base * 4;   // 每日四題
  }

  /* ---------- 多人：數字博弈 ---------- */
  function pointsForRank(rank, n) {
    if (n <= 2) return rank === 1 ? 2 : 0;
    return Math.max(0, 4 - rank);
  }

  // 以「分數相同者並列名次」(1,1,3) 排名，items: [{id, key}]，key 越小越前面
  function rankByKey(items) {
    const sorted = items.slice().sort(function (a, b) { return a.key - b.key; });
    const out = {};
    let rank = 0, prev = null;
    sorted.forEach(function (it, idx) {
      if (prev === null || it.key !== prev) { rank = idx + 1; prev = it.key; }
      out[it.id] = rank;
    });
    return out;
  }

  function numGameParams(mode, nPlayers, rand) {
    if (mode === 'avg') return { mode: mode, min: 0, max: 100, factor: rand.pick([0.8, 2 / 3, 0.5]) };
    return { mode: mode, min: 1, max: Math.max(5, nPlayers + 2) };
  }

  // picks: { id: number|null }；回傳 { ranks, points, winners, info }
  function resolveNumGame(params, picks) {
    const ids = Object.keys(picks);
    const n = ids.length;
    const valid = ids.filter(function (id) { return typeof picks[id] === 'number' && isFinite(picks[id]); });
    const items = [];
    const info = { mode: params.mode };
    if (params.mode === 'avg') {
      const mean = valid.reduce(function (s, id) { return s + picks[id]; }, 0) / (valid.length || 1);
      const target = Math.round(mean * params.factor * 100) / 100;
      info.mean = Math.round(mean * 100) / 100;
      info.target = target;
      info.factor = params.factor;
      ids.forEach(function (id) {
        items.push({ id: id, key: valid.indexOf(id) === -1 ? 1e9 : Math.round(Math.abs(picks[id] - target) * 100) });
      });
    } else {
      const count = {};
      valid.forEach(function (id) { count[picks[id]] = (count[picks[id]] || 0) + 1; });
      const dir = params.mode === 'lowunique' ? 1 : -1;
      info.counts = count;
      ids.forEach(function (id) {
        let key;
        if (valid.indexOf(id) === -1) key = 1e9;
        else if (count[picks[id]] === 1) key = dir * picks[id];
        else key = 1e6; // 撞號者全部並列墊底
        items.push({ id: id, key: key });
      });
    }
    const ranks = rankByKey(items);
    const points = {};
    const winners = [];
    ids.forEach(function (id) {
      points[id] = pointsForRank(ranks[id], n);
      if (ranks[id] === 1) winners.push(id);
    });
    // 全員撞號或全員缺席時沒有真正的勝者
    if (params.mode !== 'avg') {
      const anyUnique = valid.some(function (id) { return info.counts[picks[id]] === 1; });
      if (!anyUnique) { winners.length = 0; ids.forEach(function (id) { points[id] = 0; ranks[id] = 1; }); info.void = true; }
    }
    if (!valid.length) { winners.length = 0; ids.forEach(function (id) { points[id] = 0; }); info.void = true; }
    return { ranks: ranks, points: points, winners: winners, info: info };
  }

  // 競速題：times { id: ms|null }；答對越快名次越前
  function resolveRace(times) {
    const ids = Object.keys(times);
    const items = ids.map(function (id) { return { id: id, key: times[id] == null ? 1e12 : times[id] }; });
    const ranks = rankByKey(items);
    const points = {};
    const winners = [];
    ids.forEach(function (id) {
      points[id] = times[id] == null ? 0 : pointsForRank(ranks[id], ids.length);
      if (times[id] != null && ranks[id] === 1) winners.push(id);
    });
    return { ranks: ranks, points: points, winners: winners };
  }

  // 對局回合計畫：深度優先交錯三種題型
  function buildRoundPlan(seed, rounds, nPlayers) {
    const rand = makeRng('plan:' + seed);
    const cycle = ['num', 'deduce', 'auction', 'hilo', 'arith', 'remove', 'num', 'rule', 'auction', 'pyramid', 'hilo', 'scale', 'near', 'remove'];
    const plan = [];
    for (let i = 0; i < rounds; i++) {
      const kind = cycle[i % cycle.length];
      if (kind === 'num') {
        const mode = NUM_MODES[Math.floor(i / 2) % NUM_MODES.length];
        plan.push({ kind: 'num', params: numGameParams(mode, nPlayers, rand) });
      } else if (kind === 'auction') {
        plan.push({ kind: 'auction', params: { prize: rand.int(1, 3) }, seed: rand.int(1, 1e9) });
      } else if (kind === 'hilo' || kind === 'remove') {
        plan.push({ kind: kind, params: {}, seed: rand.int(1, 1e9) });
      } else {
        const diff = i < 3 ? 'easy' : (i < 8 ? 'normal' : 'hard');
        const puzzle = buildPuzzle(kind, rand, diff, Math.floor(i / 3));
        plan.push({ kind: kind, puzzle: puzzle });
      }
    }
    return plan;
  }
  function publicPuzzle(p) {
    if (!p) return p;
    const copy = JSON.parse(JSON.stringify(p));
    delete copy.solution; delete copy.secret; delete copy.solutions;
    return copy;
  }

  /* ---------- 對局賽制 ---------- */
  const CHIP_START = 6;
  const BANK_START = 30;
  function newMatch(ids, format, rounds) {
    if (FORMATS.indexOf(format) === -1) throw new Error('bad format');
    const players = {};
    ids.forEach(function (id) { players[id] = { score: 0, chips: format === 'chips' ? CHIP_START : 0, bank: BANK_START, alive: true, out: null }; });
    return { format: format, rounds: rounds, round: 0, players: players, finished: false, winners: [] };
  }
  function aliveIds(m) { return Object.keys(m.players).filter(function (id) { return m.players[id].alive; }); }

  // points: { id: 這回合得分 }（只含存活者）。回傳 { eliminated, finished, winners }
  function applyRound(m, points) {
    if (m.finished) return { eliminated: [], finished: true, winners: m.winners };
    m.round++;
    const alive = aliveIds(m);
    alive.forEach(function (id) {
      const p = points[id] || 0;
      m.players[id].score += p;
      if (m.format === 'chips') m.players[id].chips += p - 1;
    });
    let eliminated = [];
    if (m.format === 'chips') {
      eliminated = alive.filter(function (id) { return m.players[id].chips <= 0; });
    } else if (m.format === 'elimination' && alive.length > 1) {
      const low = Math.min.apply(null, alive.map(function (id) { return points[id] || 0; }));
      const high = Math.max.apply(null, alive.map(function (id) { return points[id] || 0; }));
      if (low !== high) {
        let cand = alive.filter(function (id) { return (points[id] || 0) === low; });
        if (cand.length > 1) {
          const minScore = Math.min.apply(null, cand.map(function (id) { return m.players[id].score; }));
          cand = cand.filter(function (id) { return m.players[id].score === minScore; });
        }
        if (cand.length === 1) eliminated = cand;
      }
    }
    // 籌碼制若全員同時歸零，保留籌碼最高者（皆為 0 時全員存活再下一回合不會發生：以分數決勝）
    if (eliminated.length === alive.length) {
      const best = Math.max.apply(null, alive.map(function (id) { return m.players[id].score; }));
      const keep = alive.filter(function (id) { return m.players[id].score === best; });
      eliminated = alive.filter(function (id) { return keep.indexOf(id) === -1; });
      if (!eliminated.length) eliminated = [];
    }
    eliminated.forEach(function (id) { m.players[id].alive = false; m.players[id].out = m.round; });
    const left = aliveIds(m);
    let finished = false;
    if (m.format !== 'points' && left.length <= 1) finished = true;
    if (m.round >= m.rounds) finished = true;
    if (finished) {
      const key = m.format === 'chips' ? 'chips' : 'score';
      const best = Math.max.apply(null, left.map(function (id) { return m.players[id][key]; }));
      let ws = left.filter(function (id) { return m.players[id][key] === best; });
      if (m.format === 'chips' && ws.length > 1) {
        const bs = Math.max.apply(null, ws.map(function (id) { return m.players[id].score; }));
        ws = ws.filter(function (id) { return m.players[id].score === bs; });
      }
      m.winners = ws;
      m.finished = true;
    }
    return { eliminated: eliminated, finished: m.finished, winners: m.winners };
  }

  /* ---------- 粗略不雅字過濾（大廳聊天室共用） ---------- */
  const BAD_WORDS = ['幹你', '靠北', '白痴', '智障', '操你', '去死', '三小', '雞掰', '他媽的', '妈的', '傻逼', '婊子', 'fuck', 'shit', 'bitch', 'asshole', 'dick', 'slut'];
  function cleanText(s) {
    let out = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
    BAD_WORDS.forEach(function (w) {
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      out = out.replace(re, function (m) { return '＊'.repeat(m.length); });
    });
    return out;
  }

  return {
    DIFFS: DIFFS, LEVELS_PER_DIFF: LEVELS_PER_DIFF, BOSS_EVERY: BOSS_EVERY, FORMATS: FORMATS, NUM_MODES: NUM_MODES, CHIP_START: CHIP_START,
    hashSeed: hashSeed, makeRng: makeRng,
    genDeduce: genDeduce, checkDeduce: checkDeduce, deduceHint: deduceHint, clueText: clueText, clueHolds: clueHolds, countSolutions: countSolutions, allCodes: allCodes,
    genArith: genArith, checkArith: checkArith, parseArith: parseArith,
    explainArith: explainArith, explainDeduce: explainDeduce, explainNumGame: explainNumGame,
    isBoss: isBoss, levelKind: levelKind, tierOf: tierOf, timeLimitSec: timeLimitSec, hintLimit: hintLimit,
    levelPuzzles: levelPuzzles, starsFor: starsFor,
    taipeiDate: taipeiDate, dailyPuzzles: dailyPuzzles, dailyTimeLimitSec: dailyTimeLimitSec,
    pointsForRank: pointsForRank, rankByKey: rankByKey, numGameParams: numGameParams, resolveNumGame: resolveNumGame, resolveRace: resolveRace,
    registry: registry, PUZZLE_KINDS: PUZZLE_KINDS, checkPuzzle: checkPuzzle, explainPuzzle: explainPuzzle, hintPuzzle: hintPuzzle, BANK_START: BANK_START,
    buildRoundPlan: buildRoundPlan, publicPuzzle: publicPuzzle,
    newMatch: newMatch, applyRound: applyRound, aliveIds: aliveIds,
    cleanText: cleanText
  };
});
