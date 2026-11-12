'use strict';
// GA4 與 SEO：設定檔驗證、注入結果、重複注入不累積、圖檔存在：node tests/seo.test.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { inject, validate } = require('../scripts/inject-seo.js');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('FAIL  ' + name + '\n      ' + e.message); } }
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'seo.config.json'), 'utf8'));

t('seo.config.json 格式正確（網址、文案長度、GA 衡量 ID）', () => {
  validate(cfg, 'G-PG79WZK8QY');
  assert.throws(() => validate(cfg, 'UA-1'));
  assert.throws(() => validate(Object.assign({}, cfg, { siteUrl: 'http://x/' }), 'G-PG79WZK8QY'));
});
t('注入後含 GA4 設定、canonical、og／twitter、JSON-LD，且重複注入不累積', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'as-seo-'));
  fs.copyFileSync(path.join(root, 'public', 'index.html'), path.join(dir, 'index.html'));
  inject(dir, { GA_MEASUREMENT_ID: 'G-TEST123' }); inject(dir, { GA_MEASUREMENT_ID: 'G-TEST123' });
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.strictEqual(html.split('<!--SEO:HEAD-->').length, 2);
  assert.strictEqual((html.match(/name="description"/g) || []).length, 1);
  assert.strictEqual((html.match(/application\/ld\+json/g) || []).length, 1);
  ['G-TEST123', 'rel="canonical"', 'og:image', 'twitter:card', cfg.siteUrl].forEach((s) => assert.ok(html.indexOf(s) !== -1, s));
  assert.ok(html.indexOf('<title>' + cfg.title + '</title>') !== -1);
  assert.ok(fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8').indexOf(cfg.siteUrl) !== -1);
  fs.rmSync(dir, { recursive: true, force: true });
});
t('原始碼中的 index.html 未被改寫（只在建置輸出注入）', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  assert.strictEqual(html.indexOf('GAME_ANALYTICS_CONFIG'), -1);
  assert.ok(html.indexOf('js/analytics.js') !== -1);
});
t('封面、分享圖、圖示、robots、sitemap 都存在', () => {
  ['assets/images/cover.webp', 'assets/images/seo.webp', 'favicon.svg', 'favicon-96.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'].forEach((f) => {
    assert.ok(fs.existsSync(path.join(root, 'public', f)), f);
  });
  assert.ok(fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf8').indexOf(cfg.siteUrl + 'sitemap.xml') !== -1);
});
console.log('\n' + (fail ? fail + ' 項失敗' : pass + ' 項通過'));
process.exit(fail ? 1 : 0);
