'use strict';
/*
 * 建置時把環境變數 GAME_SERVER_URL 寫進 public/js/server-url.js（前端唯一的伺服器網址入口）。
 * 用法：GAME_SERVER_URL=https://xxx.onrender.com node scripts/inject-config.js [輸出資料夾，預設 dist]
 * 只允許 https 網址（本機開發不需要注入，前端會自動連同源伺服器）。
 */
const fs = require('fs');
const path = require('path');

const url = String(process.env.GAME_SERVER_URL || '').trim().replace(/\/+$/, '');
const out = path.resolve(process.argv[2] || 'dist');
if (!url) { console.error('缺少環境變數 GAME_SERVER_URL'); process.exit(1); }
let u;
try { u = new URL(url); } catch (e) { console.error('GAME_SERVER_URL 不是有效網址：' + url); process.exit(1); }
if (u.protocol !== 'https:') { console.error('正式環境必須使用 https：' + url); process.exit(1); }

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(__dirname, '..', 'public'), out, { recursive: true });
fs.writeFileSync(path.join(out, 'js', 'server-url.js'),
  "/* 由 scripts/inject-config.js 於建置時產生 */\nwindow.GAME_SERVER_URL = " + JSON.stringify(u.origin) + ";\n");
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('已輸出 ' + out + '，伺服器網址：' + u.origin);
