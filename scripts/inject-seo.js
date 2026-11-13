'use strict';
/*
 * 建置時注入 GA4 與 SEO（沿用 shoot-balloon 的做法）：
 *   node scripts/inject-seo.js [輸出資料夾，預設 public]
 * 讀 seo.config.json，改寫 <!--SEO:HEAD--> … <!--SEO:END--> 區塊、title 與 description，並產生 sitemap.xml。
 * GA4 衡量 ID 由環境變數 GA_MEASUREMENT_ID 提供（未提供時用全遊戲共用 ID）；正式網址以外不會載入 Google tag。
 */
const fs = require('fs');
const path = require('path');
const MARK = '<!--SEO:HEAD-->';
const END = '<!--SEO:END-->';
const SHARED_GA = 'G-PG79WZK8QY';
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

function validate(cfg, gaId) {
  for (const key of ['id', 'siteUrl', 'title', 'description', 'lobbyUrl', 'genre', 'players']) {
    if (typeof cfg[key] !== 'string' || !cfg[key].trim()) throw new Error('seo.config.json 缺少欄位：' + key);
  }
  if (!/^[a-z0-9-]+$/.test(cfg.id) || cfg.siteUrl !== 'https://pjh-eric.github.io/' + cfg.id + '/') throw new Error('siteUrl 必須是遊戲自己的 HTTPS 網址，並以 / 結尾');
  if (cfg.lobbyUrl !== 'https://pjh-eric.github.io/game-lobby/') throw new Error('lobbyUrl 格式錯誤');
  if (cfg.title.length > 40 || cfg.description.length < 40 || cfg.description.length > 120) throw new Error('SEO 文案長度錯誤');
  if (!/^G-[A-Z0-9]+$/.test(gaId)) throw new Error('GA_MEASUREMENT_ID 格式錯誤');
  if (cfg.ogImage && !/^https:\/\/.+\/assets\/images\/(?:cover|seo)\.webp$/.test(cfg.ogImage)) throw new Error('ogImage 必須是 HTTPS 的 WebP 封面');
}

function headFor(cfg, gaId) {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'WebApplication',
    name: cfg.title.split('｜')[0], alternateName: 'Angel Strategy', url: cfg.siteUrl, description: cfg.description,
    applicationCategory: 'GameApplication', operatingSystem: 'Any', inLanguage: ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'],
    genre: cfg.genre, numberOfPlayers: cfg.players, offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
    image: cfg.ogImage || undefined, thumbnailUrl: cfg.ogImage || undefined,
    isPartOf: { '@type': 'WebSite', url: cfg.lobbyUrl }
  };
  return [
    MARK,
    '<script>window.GAME_ANALYTICS_CONFIG=' + safeJson({ measurement_id: gaId, game_id: cfg.id, page_location: cfg.siteUrl }) + ';</script>',
    cfg.googleSiteVerification && '<meta name="google-site-verification" content="' + esc(cfg.googleSiteVerification) + '">',
    '<meta name="description" content="' + esc(cfg.description) + '">',
    '<link rel="canonical" href="' + esc(cfg.siteUrl) + '">',
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="zh_TW">',
    '<meta property="og:locale:alternate" content="en_US">',
    '<meta property="og:locale:alternate" content="zh_CN">',
    '<meta property="og:locale:alternate" content="ja_JP">',
    '<meta property="og:locale:alternate" content="ko_KR">',
    '<meta property="og:site_name" content="遊戲小小島">',
    '<meta property="og:title" content="' + esc(cfg.title) + '">',
    '<meta property="og:description" content="' + esc(cfg.description) + '">',
    '<meta property="og:url" content="' + esc(cfg.siteUrl) + '">',
    cfg.ogImage && '<meta property="og:image" content="' + esc(cfg.ogImage) + '">',
    cfg.ogImage && '<meta property="og:image:type" content="image/webp">',
    cfg.ogImage && '<meta property="og:image:width" content="1200">',
    cfg.ogImage && '<meta property="og:image:height" content="675">',
    cfg.ogImage && '<meta property="og:image:alt" content="' + esc(cfg.ogImageAlt || cfg.title) + '">',
    '<meta name="twitter:card" content="' + (cfg.ogImage ? 'summary_large_image' : 'summary') + '">',
    '<meta name="twitter:title" content="' + esc(cfg.title) + '">',
    '<meta name="twitter:description" content="' + esc(cfg.description) + '">',
    cfg.ogImage && '<meta name="twitter:image" content="' + esc(cfg.ogImage) + '">',
    '<script type="application/ld+json">' + safeJson(jsonLd) + '</script>',
    END
  ].filter(Boolean).join('\n');
}

function inject(outDir, env) {
  env = env || process.env;
  const root = path.join(__dirname, '..');
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'seo.config.json'), 'utf8'));
  const gaId = env.GA_MEASUREMENT_ID || SHARED_GA;
  validate(cfg, gaId);
  const indexPath = path.join(outDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  if (html.split(MARK).length !== 2) throw new Error('index.html 必須恰有一個 ' + MARK);
  if (!/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) throw new Error('index.html 缺少 title');
  // 保留界線：重複建置不會累積標籤
  html = html.replace(/<!--SEO:HEAD-->[\s\S]*?<!--SEO:END-->/, MARK)
    .replace(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*>\s*/gi, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, () => '<title>' + esc(cfg.title) + '</title>')
    .replace(MARK, () => headFor(cfg, gaId));
  fs.writeFileSync(indexPath, html, 'utf8');
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>' + esc(cfg.siteUrl) + '</loc></url>\n</urlset>\n', 'utf8');
  return cfg;
}

module.exports = { inject: inject, validate: validate, headFor: headFor };
if (require.main === module) {
  try { console.log('✓ SEO 與 GA4 已注入：' + inject(path.resolve(process.argv[2] || path.join(__dirname, '..', 'public'))).id); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
