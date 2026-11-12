/* 前端唯一的伺服器網址設定入口（GAME_SERVER_URL）。
 * 本機（localhost／區域網路 IP）預設連同源伺服器；正式環境必須由建置注入 HTTPS 網址，不回退到 localhost。 */
(function () {
  'use strict';
  const injected = String(window.GAME_SERVER_URL || '').trim().replace(/\/+$/, '');
  const h = location.hostname;
  const isLocal = h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);
  let http = '';
  if (injected) {
    try { const u = new URL(injected); http = u.origin; } catch (e) { http = ''; }
  } else if (isLocal) {
    http = location.origin;
  }
  const ws = http ? http.replace(/^http/, 'ws') : '';
  // 遊戲大廳（遊戲小小島）網址：首頁左上角「回遊戲大廳」與首頁按上一頁都回到這裡
  window.AS_CONFIG = { httpUrl: http, wsUrl: ws, configured: !!http, lobbyUrl: 'https://pjh-eric.github.io/game-lobby/' };
})();
