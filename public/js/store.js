/* 本機存檔：設定、闖關進度、每日挑戰紀錄、暱稱。所有讀寫都包 try/catch。 */
(function () {
  'use strict';
  const K = { settings: 'as.settings.v1', progress: 'as.progress.v1', daily: 'as.daily.v1', name: 'as.name.v1', chatOpen: 'as.chatopen.v1', pid: 'as.pid.v1' };
  const DEFAULT_SETTINGS = { bgm: true, sfx: true, bgmVol: 0.5, sfxVol: 0.8, vibrate: true, reduce: false, lobbyChat: true };
  function read(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  const ADJ = ['冷靜的', '沉默的', '機警的', '好奇的', '安靜的', '勇敢的', '謹慎的', '快速的'];
  const ANI = ['貓頭鷹', '狐狸', '烏鴉', '水獺', '刺蝟', '浣熊', '企鵝', '松鼠'];
  const ADJ_EN = ['Calm', 'Silent', 'Sharp', 'Curious', 'Quiet', 'Brave', 'Careful', 'Quick'];
  const ANI_EN = ['Owl', 'Fox', 'Crow', 'Otter', 'Hedgehog', 'Raccoon', 'Penguin', 'Squirrel'];

  const Store = {
    settings: Object.assign({}, DEFAULT_SETTINGS, read(K.settings, {})),
    saveSettings: function () { write(K.settings, Store.settings); },
    resetSettings: function () { Store.settings = Object.assign({}, DEFAULT_SETTINGS); Store.saveSettings(); },

    /* 進度：{ diff: { level: stars } } */
    progress: read(K.progress, {}),
    stars: function (diff, lv) { return (Store.progress[diff] && Store.progress[diff][lv]) || 0; },
    unlocked: function (diff, lv) { return lv === 1 || Store.stars(diff, lv - 1) > 0; },
    setStars: function (diff, lv, s) {
      Store.progress[diff] = Store.progress[diff] || {};
      if ((Store.progress[diff][lv] || 0) < s) Store.progress[diff][lv] = s;
      write(K.progress, Store.progress);
    },
    cleared: function (diff) { return Object.keys(Store.progress[diff] || {}).length; },

    /* 每日：{ 'YYYY-MM-DD|diff': bestSeconds } */
    daily: read(K.daily, {}),
    dailyBest: function (date, diff) { return Store.daily[date + '|' + diff]; },
    setDaily: function (date, diff, sec) {
      const k = date + '|' + diff;
      if (Store.daily[k] == null || sec < Store.daily[k]) Store.daily[k] = sec;
      // 只保留最近 60 筆
      const keys = Object.keys(Store.daily).sort();
      while (keys.length > 60) delete Store.daily[keys.shift()];
      write(K.daily, Store.daily);
    },

    /* 暱稱：沒有就用「形容詞＋小動物」 */
    getName: function () {
      let n = read(K.name, '');
      if (!n) {
        const en = window.I18N && I18N.lang === 'en';
        n = en ? ADJ_EN[Math.floor(Math.random() * 8)] + ' ' + ANI_EN[Math.floor(Math.random() * 8)] : ADJ[Math.floor(Math.random() * 8)] + ANI[Math.floor(Math.random() * 8)];
        write(K.name, n);
      }
      return n;
    },
    setName: function (n) { write(K.name, String(n || '').slice(0, 12)); },
    getChatOpen: function () { return read(K.chatOpen, true); },
    setChatOpen: function (v) { write(K.chatOpen, !!v); },
    getPid: function () {
      let p = null;
      try { p = sessionStorage.getItem(K.pid); } catch (e) { /* ignore */ }
      if (!p) {
        p = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        try { sessionStorage.setItem(K.pid, p); } catch (e) { /* ignore */ }
      }
      return p;
    }
  };
  window.Store = Store;
})();
