'use strict';
const assert = require('assert');
const R = require('../public/js/rules.js');

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('FAIL  ' + name + '\n      ' + (e.stack || e).split('\n').slice(0, 3).join('\n      ')); } }

t('四種新題型：五段難度各產生 20 題，解法成立且說明完整（中英）', () => {
  ['near', 'rule', 'scale', 'pyramid'].forEach((k) => {
    R.DIFFS.forEach((d) => {
      for (let i = 0; i < 20; i++) {
        const p = R.registry[k].gen(R.makeRng(k + d + i), d, i % 5);
        assert.ok(R.checkPuzzle(p, p.solution).ok, k + ' ' + d + ' ' + i);
        ['zh', 'en'].forEach((lang) => {
          assert.ok(R.explainPuzzle(p, lang));
          assert.ok(String(R.hintPuzzle(p, 0, lang)).length > 0);
        });
      }
    });
  });
});

t('湊近值：標準解為全域最佳，較差的算式不通過；數字須恰好各用一次', () => {
  const p = { type: 'near', numbers: [1, 2, 3], goal: 20, bestDist: R.bestNear([1, 2, 3], 20).dist, solution: R.bestNear([1, 2, 3], 20).e };
  assert.ok(R.checkPuzzle(p, p.solution).ok);
  assert.strictEqual(R.checkPuzzle(p, '1+2+3').ok, false);
  assert.strictEqual(R.checkPuzzle(p, '1+2').reason, 'numbers');
  assert.strictEqual(R.checkPuzzle(p, '1+2+').reason, 'syntax');
});

t('找規則：範例只符合唯一一條規則；預測答錯不通過；公開版本不洩漏規則', () => {
  for (let i = 0; i < 60; i++) {
    const d = R.DIFFS[i % 5];
    const p = R.registry.rule.gen(R.makeRng('r' + i), d, 0);
    const cands = R.RULES.filter((c) => p.examples.every((e) => c.f(e.in) === e.out));
    assert.strictEqual(cands.length, 1, '範例必須只對應一條規則');
    assert.strictEqual(cands[0].id, p.secret.rule);
    const wrong = p.solution.slice(); wrong[0] += 1;
    assert.strictEqual(R.checkPuzzle(p, wrong).ok, false);
    assert.strictEqual(R.checkPuzzle(p, [1]).ok, false);
    const pub = R.publicPuzzle(p);
    assert.strictEqual(pub.secret, undefined); assert.strictEqual(pub.solution, undefined);
    const ex = R.explainPuzzle(p, 'zh');
    assert.ok(ex.rejected.length >= 1 && ex.rows.length === p.examples.length);
  }
});

t('天平配重：唯一解、不重複與背包限制、任何平衡的指派才算對', () => {
  for (let i = 0; i < 40; i++) {
    const d = R.DIFFS[i % 5];
    const p = R.registry.scale.gen(R.makeRng('s' + i), d, 0);
    assert.strictEqual(R.scaleSolutions(p.bag, p.m, p.scales, 3).length, 1, '須唯一解');
    assert.ok(p.scales.length >= 2);
    const bad = p.solution.slice(); bad[0] = bad[1];
    assert.strictEqual(R.checkPuzzle(p, bad).ok, false);
    assert.strictEqual(R.checkPuzzle(p, p.solution.concat([1])).ok, false);
    assert.strictEqual(R.checkPuzzle(p, p.solution.map(() => 99)).reason, 'bag');
  }
});

t('算式金字塔：由下往上逐層運算，頂端等於目標；錯誤運算不通過', () => {
  const p = { type: 'pyramid', n: 3, bottom: [2, 3, 4], target: 14, ops: ['+', '-', '*'], solution: ['+', '*'] };
  assert.deepStrictEqual(R.pyramidRows(p.bottom, ['+', '*']), [[2, 3, 4], [5, 7], [35]]);
  assert.strictEqual(R.checkPuzzle(p, ['+', '*']).ok, false);
  const q = R.registry.pyramid.gen(R.makeRng('pp'), 'hard', 0);
  assert.ok(R.checkPuzzle(q, q.solution).ok);
  assert.strictEqual(R.checkPuzzle(q, ['x', '+', '+', '+']).ok, false);
  assert.strictEqual(R.checkPuzzle(q, ['+']).ok, false);
});

t('時間拍賣：最高且唯一者得標並付出出價；最高價並列者無人得標且各燒掉出價；不能超過存量', () => {
  const banks = { a: 30, b: 30, c: 5 };
  let r = R.resolveAuction({ prize: 3 }, { a: 10, b: 4, c: 5 }, banks);
  assert.deepStrictEqual(r.winners, ['a']); assert.strictEqual(r.points.a, 3); assert.strictEqual(r.spend.a, 10); assert.strictEqual(r.spend.b, 0);
  r = R.resolveAuction({ prize: 2 }, { a: 7, b: 7, c: 1 }, banks);
  assert.deepStrictEqual(r.winners, []); assert.strictEqual(r.spend.a, 7); assert.strictEqual(r.spend.b, 7); assert.ok(r.info.tie);
  r = R.resolveAuction({ prize: 2 }, { a: 0, b: 0, c: 0 }, banks);
  assert.deepStrictEqual(r.winners, []); assert.strictEqual(r.spend.a, 0);
  r = R.resolveAuction({ prize: 1 }, { a: 99, b: 3, c: 99 }, { a: 30, b: 30, c: 5 });
  assert.deepStrictEqual(r.winners, ['a']); assert.strictEqual(r.info.bids.c, 5); assert.strictEqual(r.spend.a, 30);
  r = R.resolveAuction({ prize: 1 }, { a: null, b: 'x', c: -3 }, banks);
  assert.deepStrictEqual(r.winners, []);
});

t('大或小：每個人只看得到別人的牌；猜中（最大/最小/其他）得 2 分', () => {
  const rand = R.makeRng('hl');
  const cards = R.dealHilo(rand, ['a', 'b', 'c', 'd']);
  assert.strictEqual(new Set(Object.values(cards)).size, 4, '牌不重複');
  const truth = {}; Object.keys(cards).forEach((id) => { truth[id] = R.hiloTruth(cards, id); });
  assert.strictEqual(Object.values(truth).filter((x) => x === 'H').length, 1);
  assert.strictEqual(Object.values(truth).filter((x) => x === 'L').length, 1);
  const r = R.resolveHilo(cards, truth);
  Object.keys(cards).forEach((id) => assert.strictEqual(r.points[id], 2));
  const r2 = R.resolveHilo(cards, { a: 'X', b: null, c: 'M', d: 'M' });
  assert.strictEqual(r2.points.a, 0); assert.strictEqual(r2.points.b, 0);
});

t('移除一個：場上最大與最小（同點全部）的牌被移除，剩餘總和最高者勝；未出牌 0 分', () => {
  const hands = { a: [12, 5, 3, 1], b: [11, 6, 6, 2], c: [9, 8, 7, 1] };
  const r = R.resolveRemove(hands, { a: [0, 1], b: [1, 2], c: [1, 2] });   // a:12,5 b:6,6 c:8,7；最大 12 被移除；最小 5 被移除
  assert.strictEqual(r.info.max, 12); assert.strictEqual(r.info.min, 5);
  assert.deepStrictEqual(r.info.score, { a: 0, b: 12, c: 15 });
  assert.deepStrictEqual(r.winners, ['c']);
  const r2 = R.resolveRemove(hands, { a: [0, 1], b: null, c: [1, 1] });     // c 出牌不合法 → 視同未出
  assert.strictEqual(r2.points.c, 0); assert.strictEqual(r2.points.b, 0);
});

t('新對局的玩家帶有時間存量', () => {
  const m = R.newMatch(['a', 'b'], 'points', 4);
  assert.strictEqual(m.players.a.bank, R.BANK_START);
});

console.log('\n' + (fail ? fail + ' 項失敗' : pass + ' 項通過'));
process.exit(fail ? 1 : 0);
