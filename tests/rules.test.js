'use strict';
// 規則核心單元測試：node tests/rules.test.js
const assert = require('assert');
const R = require('../public/js/rules.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n      ' + (e && e.stack || e)); process.exitCode = 1; }
}

t('種子亂數可重現', () => {
  const a = R.makeRng('x'), b = R.makeRng('x');
  for (let i = 0; i < 20; i++) assert.strictEqual(a(), b());
});

t('五段難度 × 50 關：每題可產生、推理題唯一解、算式題解法正確、且都有解法說明', () => {
  R.DIFFS.forEach((diff) => {
    for (let lv = 1; lv <= R.LEVELS_PER_DIFF; lv++) {
      const ps = R.levelPuzzles(diff, lv);
      assert.strictEqual(ps.length, R.isBoss(lv) ? 3 : 1, diff + ' ' + lv);
      ps.forEach((p) => {
        if (p.type === 'deduce') {
          const codes = R.allCodes(p.n, p.pool);
          assert.strictEqual(R.countSolutions(codes, p.clues), 1, '推理題須唯一解 ' + diff + lv);
          assert.ok(R.checkDeduce(p, p.solution));
          const ex = R.explainDeduce(p, 'zh');
          assert.ok(ex.steps.length >= 1);
          assert.strictEqual(ex.steps[ex.steps.length - 1].remain, 1, '最後一條線索後只剩一個可能');
        } else if (p.type === 'arith') {
          assert.ok(R.checkArith(p, p.solution).ok, '算式題解法須成立 ' + diff + lv + ' ' + p.solution);
          const ex = R.explainArith(p);
          assert.ok(ex.steps.length === p.numbers.length - 1, '逐步運算數 = 數字數 − 1');
        } else {
          assert.ok(R.checkPuzzle(p, p.solution).ok, p.type + ' 解法須成立 ' + diff + lv);
          assert.ok(R.explainPuzzle(p, 'zh'), p.type + ' 須有解法說明');
        }
      });
    }
  });
});

t('每日挑戰同一天同難度結果相同、不同天不同', () => {
  const a = R.dailyPuzzles('2026-11-12', 'normal'), b = R.dailyPuzzles('2026-11-12', 'normal'), c = R.dailyPuzzles('2026-11-13', 'normal');
  assert.deepStrictEqual(a, b);
  assert.notDeepStrictEqual(a, c);
  assert.strictEqual(a.length, 4);
  assert.strictEqual(new Set(a.map((p) => p.type)).size, 4, '每日四題型別不重複');
});

t('台北時間切日', () => {
  assert.strictEqual(R.taipeiDate(Date.UTC(2026, 10, 12, 15, 59, 59)), '2026-11-12');
  assert.strictEqual(R.taipeiDate(Date.UTC(2026, 10, 12, 16, 0, 0)), '2026-11-13');
});

t('算式解析：括號、全形、除法、數字必須恰好用一次', () => {
  const p = { numbers: [2, 3, 4], target: 14 };
  assert.ok(R.checkArith(p, '2+3*4').ok);
  assert.ok(R.checkArith(p, '２＋３×４').ok);
  assert.strictEqual(R.checkArith(p, '(2+3)*4').ok, false);
  assert.strictEqual(R.checkArith(p, '2+3*4+0').reason, 'numbers');
  assert.strictEqual(R.checkArith(p, '2+3*').reason, 'syntax');
  assert.strictEqual(R.checkArith({ numbers: [8, 3], target: 3 }, '8/3*3').reason, 'numbers');
  assert.ok(R.checkArith({ numbers: [8, 3, 3], target: 8 }, '8/3*3').ok, '中間可為分數');
  assert.strictEqual(R.checkArith(p, '2/0+3*4').ok, false);
});

t('算式不接受 eval 注入', () => {
  const p = { numbers: [1], target: 1 };
  assert.strictEqual(R.checkArith(p, 'process.exit()').ok, false);
  assert.strictEqual(R.checkArith(p, '1;alert(1)').ok, false);
});

t('數字博弈：平均數×係數', () => {
  const params = { mode: 'avg', factor: 0.8 };
  const r = R.resolveNumGame(params, { a: 50, b: 30, c: 10 });
  assert.strictEqual(r.info.target, 24);
  assert.deepStrictEqual(r.winners, ['b']);
  assert.strictEqual(r.points.b, 3);
  assert.strictEqual(r.points.c, 2);
  assert.strictEqual(r.points.a, 1);
  assert.ok(R.explainNumGame(params, r, 'zh').length > 0);
});

t('數字博弈：最小不重複', () => {
  const r = R.resolveNumGame({ mode: 'lowunique' }, { a: 1, b: 1, c: 2, d: 3 });
  assert.deepStrictEqual(r.winners, ['c']);
  assert.strictEqual(r.ranks.a, 3);
  assert.strictEqual(r.ranks.b, 3);
});

t('數字博弈：最大不重複、全撞號作廢、缺席墊底', () => {
  const r = R.resolveNumGame({ mode: 'highunique' }, { a: 5, b: 4, c: 5, d: null });
  assert.deepStrictEqual(r.winners, ['b']);
  assert.strictEqual(r.points.d, 0);
  const v = R.resolveNumGame({ mode: 'lowunique' }, { a: 2, b: 2 });
  assert.strictEqual(v.winners.length, 0);
  assert.ok(v.info.void);
});

t('競速題：最快答對者第一，沒答對 0 分', () => {
  const r = R.resolveRace({ a: 3000, b: 1500, c: null });
  assert.deepStrictEqual(r.winners, ['b']);
  assert.strictEqual(r.points.b, 3);
  assert.strictEqual(r.points.a, 2);
  assert.strictEqual(r.points.c, 0);
});

t('籌碼制：歸零出局，剩一人結束', () => {
  const m = R.newMatch(['a', 'b'], 'chips', 20);
  let res;
  for (let i = 0; i < 20 && !m.finished; i++) res = R.applyRound(m, { a: 2, b: 0 });
  assert.ok(m.finished);
  assert.deepStrictEqual(m.winners, ['a']);
  assert.strictEqual(m.players.b.alive, false);
  assert.ok(res.finished);
});

t('逐關淘汰：每回合淘汰最低分者，同分不淘汰', () => {
  const m = R.newMatch(['a', 'b', 'c'], 'elimination', 10);
  let r = R.applyRound(m, { a: 3, b: 2, c: 1 });
  assert.deepStrictEqual(r.eliminated, ['c']);
  r = R.applyRound(m, { a: 1, b: 1 });
  assert.deepStrictEqual(r.eliminated, []);
  r = R.applyRound(m, { a: 3, b: 0 });
  assert.deepStrictEqual(r.eliminated, ['b']);
  assert.ok(m.finished);
  assert.deepStrictEqual(m.winners, ['a']);
});

t('積分制：打滿回合，總分最高者勝，同分並列', () => {
  const m = R.newMatch(['a', 'b'], 'points', 2);
  R.applyRound(m, { a: 2, b: 0 });
  const r = R.applyRound(m, { a: 0, b: 2 });
  assert.ok(r.finished);
  assert.deepStrictEqual(m.winners.sort(), ['a', 'b']);
});

t('回合計畫：型別交錯、推理題唯一解、公開版本不含解答', () => {
  const plan = R.buildRoundPlan('seed1', 12, 4);
  assert.strictEqual(plan.length, 12);
  plan.forEach((rd) => {
    if (rd.kind === 'num') assert.ok(R.NUM_MODES.indexOf(rd.params.mode) !== -1);
    else if (['auction', 'hilo', 'remove'].indexOf(rd.kind) !== -1) assert.ok(!rd.puzzle);
    else {
      const pub = R.publicPuzzle(rd.puzzle);
      assert.strictEqual(pub.solution, undefined);
      assert.strictEqual(pub.secret, undefined);
      assert.ok(rd.puzzle.solution);
    }
  });
  assert.deepStrictEqual(R.buildRoundPlan('seed1', 12, 4), plan);
});

t('星等與時限', () => {
  assert.strictEqual(R.timeLimitSec('baby', 1), null);
  assert.ok(R.timeLimitSec('myth', 10) > R.timeLimitSec('myth', 9));
  assert.strictEqual(R.starsFor('normal', 1, 30, 0), 3);
  assert.strictEqual(R.starsFor('normal', 1, 110, 2), 1);
});

t('聊天字詞過濾', () => {
  assert.strictEqual(R.cleanText('你好 <b>fuck</b>'), '你好 b＊＊＊＊/b');
});

console.log('\n' + passed + ' 項通過' + (process.exitCode ? '（有失敗）' : ''));
