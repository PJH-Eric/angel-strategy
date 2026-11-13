'use strict';
// 多語系完整性：五種語言的介面字典與題目片語都要齊全、佔位符一致：node tests/i18n.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('FAIL  ' + name + '\n      ' + e.message.split('\n').slice(0, 6).join('\n      ')); } }
const LANGS = ['zh-TW', 'zh-CN', 'en', 'ja', 'ko'];
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'i18n.js'), 'utf8');
const D = eval('(' + src.match(/const D = (\{[\s\S]*?\n  \});/)[1] + ')');
const PH = require('../public/js/phrases.js');
const holes = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');

t('介面字典：五種語言鍵值完全一致、沒有空字串', () => {
  const base = Object.keys(D['zh-TW']);
  LANGS.forEach((l) => {
    assert.ok(D[l], '缺少語言 ' + l);
    const miss = base.filter((k) => !(k in D[l])), extra = Object.keys(D[l]).filter((k) => !(k in D['zh-TW']));
    assert.deepStrictEqual([miss, extra], [[], []], l + ' 缺少或多出：' + JSON.stringify([miss, extra]));
    base.forEach((k) => assert.ok(String(D[l][k]).length > 0 || D['zh-TW'][k] === '', l + ' 空字串：' + k));
  });
});
t('介面字典：佔位符 {n} 等在各語言一致', () => {
  const bad = [];
  Object.keys(D['zh-TW']).forEach((k) => LANGS.forEach((l) => { if (holes(D[l][k]) !== holes(D['zh-TW'][k])) bad.push(l + ':' + k); }));
  assert.deepStrictEqual(bad, []);
});
t('简体中文沒有殘留繁體字（常見字抽查）', () => {
  const trad = /[這個們說時會對與數題關麼還點邊進開選擇設網連線線續發現難應機戰勝]/;
  const bad = Object.keys(D['zh-CN']).filter((k) => trad.test(D['zh-CN'][k]));
  assert.deepStrictEqual(bad, []);
});
t('題目片語：五種語言齊全、佔位符一致', () => {
  const base = Object.keys(PH.D['zh-TW']);
  LANGS.forEach((l) => base.forEach((k) => {
    assert.ok(k in PH.D[l], l + ' 缺少片語 ' + k);
    assert.strictEqual(holes(PH.D[l][k]), holes(PH.D['zh-TW'][k]), l + ' 片語佔位符不同 ' + k);
  }));
});
t('線索、規則、提示在五種語言都產生得出來，且不會出現未替換的 {佔位符}', () => {
  const R = require('../public/js/rules.js');
  R.PUZZLE_KINDS.forEach((k) => R.DIFFS.forEach((d) => {
    const p = R.registry[k].gen(R.makeRng('i18n' + k + d), d, 2);
    LANGS.forEach((l) => {
      const all = [];
      if (p.type === 'deduce') p.clues.forEach((c) => all.push(R.clueText(c, l)));
      all.push(String(R.hintPuzzle(p, 0, l)), String(R.hintPuzzle(p, 1, l)), JSON.stringify(R.explainPuzzle(p, l)));
      all.forEach((s) => assert.ok(!/\{[a-z]+\}/.test(s) && s.length > 0, l + ' ' + k + '：' + s));
    });
  }));
});
console.log('\n' + (fail ? fail + ' 項失敗' : pass + ' 項通過'));
process.exit(fail ? 1 : 0);
