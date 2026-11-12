'use strict';
/*
 * 天使的策略 — 伺服器：靜態檔案、/health、WebSocket（/ws）。
 * 環境變數：PORT（預設 3110）、GAME_ALLOWED_ORIGIN（逗號分隔的前端網址；未設定時不限制，僅適合本機）。
 * 注意：不提供 /api/presence；前端只有進入線上流程才會連線。
 */
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const { createHub } = require('./lib/hub.js');

const PORT = parseInt(process.env.PORT, 10) || 3110;
const ALLOWED = String(process.env.GAME_ALLOWED_ORIGIN || '').split(',').map(function (s) { return s.trim().replace(/\/+$/, ''); }).filter(Boolean);

function originAllowed(origin, host) {
  if (!ALLOWED.length || !origin) return true;
  const o = origin.replace(/\/+$/, '');
  if (ALLOWED.indexOf(o) !== -1) return true;
  try { return new URL(o).host === host; } catch (e) { return false; }
}

const app = express();
app.disable('x-powered-by');
app.use(function (req, res, next) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin, req.headers.host)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  next();
});
app.get('/health', function (req, res) { res.json({ ok: true, name: 'angel-strategy', uptime: Math.round(process.uptime()) }); });
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: 0 }));

const server = http.createServer(app);
const hub = createHub();
const wss = new WebSocketServer({
  server: server, path: '/ws', maxPayload: 4096,
  verifyClient: function (info) { return originAllowed(info.origin, info.req.headers.host); }
});

wss.on('connection', function (ws) {
  ws.isAlive = true;
  hub.connect(ws);
  ws.on('pong', function () { ws.isAlive = true; });
  ws.on('message', function (data) { try { hub.onMessage(ws, data.toString()); } catch (e) { console.error('message error', e); } });
  ws.on('close', function () { hub.onClose(ws); });
  ws.on('error', function () { /* close 事件會處理 */ });
});

const beat = setInterval(function () {
  wss.clients.forEach(function (ws) {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { /* ignore */ }
  });
}, 30000);
wss.on('close', function () { clearInterval(beat); });

function lanIps() {
  const out = [];
  const ifs = os.networkInterfaces();
  Object.keys(ifs).forEach(function (k) { ifs[k].forEach(function (a) { if (a.family === 'IPv4' && !a.internal) out.push(a.address); }); });
  return out;
}

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', function () {
    console.log('天使的策略 已啟動：http://localhost:' + PORT);
    lanIps().forEach(function (ip) { console.log('  同一個 Wi-Fi 的裝置可連：http://' + ip + ':' + PORT); });
  });
  const stop = function () { hub.shutdown(); clearInterval(beat); server.close(function () { process.exit(0); }); setTimeout(function () { process.exit(0); }, 2000).unref(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

module.exports = { server: server, hub: hub };
