/* 本機存檔：設定、闖關進度、每日挑戰紀錄、暱稱。所有讀寫都包 try/catch。 */
(function () {
  'use strict';
  const K = { settings: 'as.settings.v1', progress: 'as.progress.v1', daily: 'as.daily.v1', name: 'as.name.v1', chatOpen: 'as.chatopen.v1', pid: 'as.pid.v1', random: 'as.random.v1', records: 'as.records.v1' };
  const DEFAULT_SETTINGS = { bgm: true, sfx: true, bgmVol: 0.5, sfxVol: 0.8, vibrate: true, reduce: false, lobbyChat: true };
  function read(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  // 隨機暱稱「形容詞＋小動物」，依目前語言產生
  const NAMES = {
    'zh-TW': [['冷靜的', '沉默的', '機警的', '好奇的', '安靜的', '勇敢的', '謹慎的', '快速的'], ['貓頭鷹', '狐狸', '烏鴉', '水獺', '刺蝟', '浣熊', '企鵝', '松鼠'], ''],
    'zh-CN': [['冷静的', '沉默的', '机警的', '好奇的', '安静的', '勇敢的', '谨慎的', '快速的'], ['猫头鹰', '狐狸', '乌鸦', '水獭', '刺猬', '浣熊', '企鹅', '松鼠'], ''],
    en: [['Calm', 'Silent', 'Sharp', 'Curious', 'Quiet', 'Brave', 'Careful', 'Quick'], ['Owl', 'Fox', 'Crow', 'Otter', 'Hedgehog', 'Raccoon', 'Penguin', 'Squirrel'], ' '],
    ja: [['冷静な', '無口な', '鋭い', '好奇心旺盛な', '静かな', '勇敢な', '慎重な', '素早い'], ['フクロウ', 'キツネ', 'カラス', 'カワウソ', 'ハリネズミ', 'アライグマ', 'ペンギン', 'リス'], ''],
    ko: [['침착한', '조용한', '날쌘', '호기심 많은', '고요한', '용감한', '신중한', '재빠른'], ['부엉이', '여우', '까마귀', '수달', '고슴도치', '너구리', '펭귄', '다람쥐'], ' ']
  };
  function randomName() {
    const L = NAMES[(window.I18N && I18N.lang) || 'zh-TW'] || NAMES['zh-TW'];
    const pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
    return pick(L[0]) + L[2] + pick(L[1]);
  }

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

    /* 紀錄與成就：Records.apply 更新統計，回傳本次新解鎖的成就 id */
    records: null,
    rec: function () { if (!Store.records) Store.records = window.Records ? Records.normalize(read(K.records, null)) : {}; return Store.records; },
    track: function (ev) {
      if (!window.Records) return [];
      let fresh = [];
      try { fresh = Records.apply(Store.rec(), ev); write(K.records, Store.records); } catch (e) { fresh = []; }
      if (fresh.length && window.App && App.onAchieve) App.onAchieve(fresh);
      return fresh;
    },
    resetRecords: function () { Store.records = Records.blank(); write(K.records, Store.records); },

    /* 隨機挑戰：{ diff: { best, runs, wins } } */
    random: read(K.random, {}),
    randomStat: function (diff) { return Store.random[diff] || { best: null, runs: 0, wins: 0 }; },
    addRandomRun: function (diff, winSec) {
      const r = Store.randomStat(diff);
      r.runs++;
      if (winSec != null) { r.wins++; if (r.best == null || winSec < r.best) r.best = winSec; }
      Store.random[diff] = r; write(K.random, Store.random);
    },

    /* 暱稱：沒有就用「形容詞＋小動物」 */
    randomName: randomName,
    getName: function () {
      let n = read(K.name, '');
      if (!n) {
        n = randomName();
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
      if (!p) p = newPid();
      return p;
    }
  };
  function newPid() {
    const p = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    try { sessionStorage.setItem(K.pid, p); } catch (e) { /* ignore */ }
    return p;
  }
  // 複製分頁會連 sessionStorage 一起複製，兩個分頁共用同一個 pid 會被伺服器互踢、無限重連。
  // 每個存活的分頁用 Web Locks 佔住自己的 pid；已被其他分頁佔用就換一個新的。
  function claimPid() {
    if (!navigator.locks || !navigator.locks.request) return;
    let p; try { p = sessionStorage.getItem(K.pid); } catch (e) { return; }
    if (!p) return;
    navigator.locks.request('as-pid-' + p, { ifAvailable: true }, function (lock) {
      if (lock) return new Promise(function () { /* 分頁存活期間一直持有 */ });
      newPid(); claimPid();
    }).catch(function () { /* ignore */ });
  }
  claimPid();
  window.Store = Store;
})();
