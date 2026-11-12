/*
 * 天使的策略 — 紀錄與成就（只存在本機，瀏覽器與測試共用的純邏輯）
 * Records.apply(state, event) 依事件更新統計並回傳本次新解鎖的成就 id。
 * 事件：
 *   { t: 'solve', type, diff, sec, tries, hints }               單一題目答對
 *   { t: 'finish', mode, diff, level, win, why, sec, hints, boss, date, kinds }   一局結束（單機／每日／隨機）
 *   { t: 'online', win, players, rounds: [{ kind, won, right }] } 線上對局結束
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Records = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KINDS = ['deduce', 'arith', 'near', 'rule', 'scale', 'pyramid'];
  const DIFF_RANK = { baby: 0, easy: 1, normal: 2, hard: 3, myth: 4 };

  function blank() {
    return {
      v: 1, solved: {}, best: {}, perfect: 0, fast: 0, giveups: 0, totalSec: 0,
      clears: 0, noHint: 0, boss: 0, maxLevel: {}, mythClears: 0,
      daily: [], random: { runs: 0, wins: 0, mythWins: 0 },
      online: { matches: 0, wins: 0, auction: 0, hilo: 0, remove: 0, races: 0 },
      history: [], unlocked: {}
    };
  }

  // 每日挑戰連續天數（日期字串 YYYY-MM-DD，已排序去重）
  function dayNum(s) { const p = s.split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }
  function streaks(days) {
    const ns = days.map(dayNum).sort(function (a, b) { return a - b; });
    let best = 0, run = 0, prev = null;
    ns.forEach(function (n) { run = prev !== null && n === prev + 1 ? run + 1 : (prev === n ? run : 1); prev = n; if (run > best) best = run; });
    return { best: best, last: ns.length ? ns[ns.length - 1] : null, run: run };
  }
  function currentStreak(st, today) {
    const s = streaks(st.daily);
    if (s.last === null) return 0;
    const t = today ? dayNum(today) : s.last;
    return t - s.last <= 1 ? s.run : 0;
  }
  function kindsSolved(st) { return KINDS.filter(function (k) { return (st.solved[k] || 0) > 0; }).length; }
  function totalSolved(st) { return KINDS.reduce(function (a, k) { return a + (st.solved[k] || 0); }, 0); }

  // tier：bronze 銅／silver 銀／gold 金；p(st) 回傳 [目前, 目標]
  const LIST = [
    { id: 'first',     icon: 'flag',     tier: 'bronze', p: function (s) { return [s.clears, 1]; } },
    { id: 'clear50',   icon: 'stack',    tier: 'silver', p: function (s) { return [s.clears, 50]; } },
    { id: 'clear300',  icon: 'stack',    tier: 'gold',   p: function (s) { return [s.clears, 300]; } },
    { id: 'allKinds',  icon: 'book',     tier: 'bronze', p: function (s) { return [kindsSolved(s), 6]; } },
    { id: 'solve100',  icon: 'target',   tier: 'silver', p: function (s) { return [totalSolved(s), 100]; } },
    { id: 'solve500',  icon: 'target',   tier: 'gold',   p: function (s) { return [totalSolved(s), 500]; } },
    { id: 'boss1',     icon: 'trophy',   tier: 'bronze', p: function (s) { return [s.boss, 1]; } },
    { id: 'boss10',    icon: 'trophy',   tier: 'gold',   p: function (s) { return [s.boss, 10]; } },
    { id: 'noHint20',  icon: 'hint',     tier: 'silver', p: function (s) { return [s.noHint, 20]; } },
    { id: 'fast',      icon: 'timer',    tier: 'bronze', p: function (s) { return [s.fast, 1]; } },
    { id: 'fast25',    icon: 'timer',    tier: 'silver', p: function (s) { return [s.fast, 25]; } },
    { id: 'perfect10', icon: 'deduce',   tier: 'silver', p: function (s) { return [s.perfect, 10]; } },
    { id: 'myth1',     icon: 'crown',    tier: 'silver', p: function (s) { return [s.mythClears, 1]; } },
    { id: 'myth50',    icon: 'crown',    tier: 'gold',   p: function (s) { return [s.mythClears, 50]; } },
    { id: 'daily1',    icon: 'daily',    tier: 'bronze', p: function (s) { return [s.daily.length, 1]; } },
    { id: 'streak3',   icon: 'daily',    tier: 'silver', p: function (s) { return [streaks(s.daily).best, 3]; } },
    { id: 'streak7',   icon: 'daily',    tier: 'gold',   p: function (s) { return [streaks(s.daily).best, 7]; } },
    { id: 'random10',  icon: 'dice',     tier: 'silver', p: function (s) { return [s.random.wins, 10]; } },
    { id: 'randomMyth', icon: 'dice',    tier: 'gold',   p: function (s) { return [s.random.mythWins, 1]; } },
    { id: 'online1',   icon: 'online',   tier: 'bronze', p: function (s) { return [s.online.matches, 1]; } },
    { id: 'onlineWin', icon: 'online',   tier: 'silver', p: function (s) { return [s.online.wins, 1]; } },
    { id: 'onlineWin10', icon: 'online', tier: 'gold',   p: function (s) { return [s.online.wins, 10]; } },
    { id: 'auction',   icon: 'auction',  tier: 'bronze', p: function (s) { return [s.online.auction, 1]; } },
    { id: 'hilo5',     icon: 'hilo',     tier: 'silver', p: function (s) { return [s.online.hilo, 5]; } },
    { id: 'remove3',   icon: 'remove',   tier: 'silver', p: function (s) { return [s.online.remove, 3]; } },
    { id: 'races10',   icon: 'bolt',     tier: 'silver', p: function (s) { return [s.online.races, 10]; } },
    { id: 'hours1',    icon: 'clock',    tier: 'bronze', p: function (s) { return [Math.floor(s.totalSec / 60), 60]; } }
  ];

  function progress(st, a) { const r = a.p(st); return { cur: Math.min(r[0], r[1]), max: r[1], done: r[0] >= r[1] }; }

  function normalize(st) {
    const b = blank();
    if (!st || typeof st !== 'object') return b;
    Object.keys(b).forEach(function (k) {
      if (st[k] == null || typeof st[k] !== typeof b[k] || Array.isArray(b[k]) !== Array.isArray(st[k])) st[k] = b[k];
    });
    ['random', 'online'].forEach(function (k) { Object.keys(b[k]).forEach(function (q) { if (typeof st[k][q] !== 'number') st[k][q] = 0; }); });
    return st;
  }

  function apply(st, ev, now) {
    st = normalize(st);
    now = now || Date.now();
    if (!ev || typeof ev !== 'object') return [];
    if (ev.t === 'solve' && KINDS.indexOf(ev.type) !== -1) {
      st.solved[ev.type] = (st.solved[ev.type] || 0) + 1;
      const sec = Number(ev.sec);
      if (isFinite(sec) && sec > 0 && (st.best[ev.type] == null || sec < st.best[ev.type])) st.best[ev.type] = Math.round(sec * 100) / 100;
      // 快手：簡單以上 15 秒內答對；完美推理：困難以上一次就答對推理題
      if (DIFF_RANK[ev.diff] >= 1 && sec > 0 && sec <= 15) st.fast++;
      if (ev.type === 'deduce' && DIFF_RANK[ev.diff] >= 3 && (ev.tries || 0) === 0 && !ev.hints) st.perfect++;
    } else if (ev.t === 'finish') {
      const sec = Math.max(0, Number(ev.sec) || 0);
      st.totalSec += Math.round(sec);
      if (!ev.win && ev.why === 'gaveup') st.giveups++;
      if (ev.win) {
        if (ev.mode === 'campaign') {
          st.clears++;
          if (!ev.hints) st.noHint++;
          if (ev.boss) st.boss++;
          if (ev.diff === 'myth') st.mythClears++;
          if (!st.maxLevel[ev.diff] || ev.level > st.maxLevel[ev.diff]) st.maxLevel[ev.diff] = ev.level;
        } else if (ev.mode === 'daily' && ev.date && st.daily.indexOf(ev.date) === -1) {
          st.daily.push(ev.date); st.daily.sort();
          while (st.daily.length > 400) st.daily.shift();
        }
      }
      if (ev.mode === 'random') { st.random.runs++; if (ev.win) { st.random.wins++; if (ev.diff === 'myth') st.random.mythWins++; } }
      st.history.unshift({ at: now, mode: ev.mode, diff: ev.diff, level: ev.level || null, win: !!ev.win, why: ev.why || '', sec: Math.round(sec * 100) / 100, kinds: (ev.kinds || []).slice(0, 6) });
      st.history.length = Math.min(st.history.length, 30);
    } else if (ev.t === 'online') {
      st.online.matches++;
      if (ev.win) st.online.wins++;
      (ev.rounds || []).forEach(function (r) {
        if (!r || !r.won) return;
        if (r.kind === 'auction') st.online.auction++;
        else if (r.kind === 'hilo') st.online.hilo++;
        else if (r.kind === 'remove') st.online.remove++;
        else if (KINDS.indexOf(r.kind) !== -1) st.online.races++;
      });
      st.history.unshift({ at: now, mode: 'online', diff: null, level: null, win: !!ev.win, why: '', sec: 0, kinds: [], players: ev.players || 0 });
      st.history.length = Math.min(st.history.length, 30);
    } else return [];
    const fresh = [];
    LIST.forEach(function (a) { if (!st.unlocked[a.id] && progress(st, a).done) { st.unlocked[a.id] = now; fresh.push(a.id); } });
    return fresh;
  }

  return { KINDS: KINDS, LIST: LIST, blank: blank, normalize: normalize, apply: apply, progress: progress, streaks: streaks, currentStreak: currentStreak, totalSolved: totalSolved, kindsSolved: kindsSolved, byId: function (id) { return LIST.filter(function (a) { return a.id === id; })[0] || null; } };
});
