'use strict';
// 紀錄與成就：node tests/records.test.js
const assert = require('assert');
const Rec = require('../public/js/records.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('FAIL  ' + name + '\n      ' + (e.stack || e).split('\n').slice(0, 3).join('\n      ')); } }

t('第一次過關解鎖「初入設施」，同一成就不會重複解鎖', () => {
  const s = Rec.blank();
  assert.deepStrictEqual(Rec.apply(s, { t: 'finish', mode: 'campaign', diff: 'baby', level: 1, win: true, sec: 20, hints: 1 }), ['first']);
  assert.deepStrictEqual(Rec.apply(s, { t: 'finish', mode: 'campaign', diff: 'baby', level: 2, win: true, sec: 20, hints: 1 }), []);
  assert.strictEqual(s.clears, 2); assert.strictEqual(s.maxLevel.baby, 2);
});
t('六種題型各答對一次才解鎖「六藝」；最快時間只保留更快的', () => {
  const s = Rec.blank();
  ['deduce', 'arith', 'near', 'rule', 'scale'].forEach((k) => Rec.apply(s, { t: 'solve', type: k, diff: 'easy', sec: 30 }));
  assert.ok(!s.unlocked.allKinds);
  assert.ok(Rec.apply(s, { t: 'solve', type: 'pyramid', diff: 'easy', sec: 30 }).indexOf('allKinds') !== -1);
  Rec.apply(s, { t: 'solve', type: 'arith', diff: 'easy', sec: 12.345 }); Rec.apply(s, { t: 'solve', type: 'arith', diff: 'easy', sec: 50 });
  assert.strictEqual(s.best.arith, 12.35);
  Rec.apply(s, { t: 'solve', type: 'bogus', diff: 'easy', sec: 1 }); assert.strictEqual(s.solved.bogus, undefined);
});
t('快手只算簡單以上 15 秒內；完美推理需困難以上、零錯誤、無提示', () => {
  const s = Rec.blank();
  Rec.apply(s, { t: 'solve', type: 'arith', diff: 'baby', sec: 3 }); assert.strictEqual(s.fast, 0);
  assert.ok(Rec.apply(s, { t: 'solve', type: 'arith', diff: 'easy', sec: 14 }).indexOf('fast') !== -1);
  Rec.apply(s, { t: 'solve', type: 'deduce', diff: 'hard', sec: 40, tries: 1 }); assert.strictEqual(s.perfect, 0);
  Rec.apply(s, { t: 'solve', type: 'deduce', diff: 'myth', sec: 40, tries: 0, hints: 0 }); assert.strictEqual(s.perfect, 1);
});
t('每日挑戰：同一天只算一次，連續天數計算正確（跨月）', () => {
  const s = Rec.blank();
  ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-01', '2026-11-03'].forEach((d) => Rec.apply(s, { t: 'finish', mode: 'daily', diff: 'normal', win: true, sec: 99, date: d }));
  assert.strictEqual(s.daily.length, 4);
  assert.strictEqual(Rec.streaks(s.daily).best, 3);
  assert.ok(s.unlocked.streak3 && !s.unlocked.streak7);
  assert.strictEqual(Rec.currentStreak(s, '2026-11-04'), 1);
  assert.strictEqual(Rec.currentStreak(s, '2026-11-06'), 0);
});
t('魔王、神話、隨機神話、線上回合成就；紀錄最多保留 30 筆', () => {
  const s = Rec.blank();
  const f = Rec.apply(s, { t: 'finish', mode: 'campaign', diff: 'myth', level: 10, win: true, boss: true, sec: 300, hints: 0 });
  ['boss1', 'myth1', 'first'].forEach((id) => assert.ok(f.indexOf(id) !== -1, id));
  assert.ok(Rec.apply(s, { t: 'finish', mode: 'random', diff: 'myth', win: true, sec: 400 }).indexOf('randomMyth') !== -1);
  const o = Rec.apply(s, { t: 'online', win: true, players: 3, rounds: [{ kind: 'auction', won: true }, { kind: 'hilo', won: false }, { kind: 'scale', won: true }] });
  ['online1', 'onlineWin', 'auction'].forEach((id) => assert.ok(o.indexOf(id) !== -1, id));
  assert.strictEqual(s.online.races, 1); assert.strictEqual(s.online.hilo, 0);
  for (let i = 0; i < 40; i++) Rec.apply(s, { t: 'finish', mode: 'random', diff: 'easy', win: false, why: 'gaveup', sec: 5 });
  assert.strictEqual(s.history.length, 30); assert.strictEqual(s.giveups, 40);
});
t('壞掉或舊版存檔會被修復，不會丟錯', () => {
  const s = Rec.normalize({ solved: 'x', online: { matches: 'a' }, history: {} });
  assert.deepStrictEqual(s.solved, {}); assert.strictEqual(s.online.matches, 0); assert.ok(Array.isArray(s.history));
  assert.deepStrictEqual(Rec.apply(Rec.blank(), null), []);
  Rec.LIST.forEach((a) => { const p = Rec.progress(Rec.blank(), a); assert.ok(p.max > 0 && p.cur === 0 && !p.done, a.id); });
  assert.strictEqual(new Set(Rec.LIST.map((a) => a.id)).size, Rec.LIST.length, '成就 id 不重複');
});
console.log('\n' + (fail ? fail + ' 項失敗' : pass + ' 項通過'));
process.exit(fail ? 1 : 0);
