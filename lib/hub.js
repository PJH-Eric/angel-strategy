'use strict';
/*
 * 線上房間／對局／大廳聊天室引擎（與傳輸層無關）。
 * - 傳輸層只需提供 socket：{ send(str), close(), readyState }，由 server.js 以 ws 套件接上。
 * - 只有真人玩家：沒有電腦席位。房間生命週期以「實體玩家」為準，觀戰者不算；
 *   實體玩家降為 0 立刻關房、撤銷邀請並通知所有人，已關閉的房間不會復活。
 * - 解答只存在伺服器；對局中傳給用戶端的題目一律是 publicPuzzle，回合結束後才公開完整解法。
 */
const crypto = require('crypto');
const R = require('../public/js/rules.js');

const MAX_PLAYERS = 6;
const MAX_SPECTATORS = 20;
const MAX_ROOMS = 200;
const LOBBY_HISTORY = 50;
const CHAT_MAX = 60;

function createHub(opts) {
  opts = opts || {};
  const betweenMs = opts.betweenMs != null ? opts.betweenMs : 9000;
  const graceMs = opts.graceMs != null ? opts.graceMs : 20000;
  const inviteTtlMs = opts.inviteTtlMs != null ? opts.inviteTtlMs : 12 * 3600 * 1000;
  const now = opts.now || Date.now;
  const timeScale = opts.timeScale != null ? opts.timeScale : 1;     // 測試用：縮短每回合秒數

  const clients = new Map();   // pid -> client
  const rooms = new Map();     // id -> room
  const lobby = new Set();     // pid（只有在大廳畫面的人）
  const lobbyChat = [];
  let roomSeq = 0;

  /* ---------- 小工具 ---------- */
  function rid() { return crypto.randomBytes(3).toString('hex').toUpperCase(); }
  function token() { return crypto.randomBytes(9).toString('base64url'); }
  function send(c, obj) {
    if (!c || !c.sock || c.sock.readyState !== 1) return;
    try { c.sock.send(JSON.stringify(obj)); } catch (e) { /* 對方已斷線 */ }
  }
  function cleanName(s, fallback) {
    let n = R.cleanText(String(s == null ? '' : s)).replace(/\s+/g, ' ').slice(0, 12).trim();
    if (!n) n = fallback || ('玩家' + Math.floor(1000 + Math.random() * 9000));
    return n;
  }
  function err(c, code, extra) { send(c, Object.assign({ t: 'error', code: code }, extra || {})); }

  /* ---------- 大廳 ---------- */
  function roomSummary(r) {
    return {
      id: r.id, name: r.name, state: r.state, format: r.settings.format,
      players: r.players.length, max: MAX_PLAYERS, spectators: r.spectators.length, host: nameOf(r.hostPid)
    };
  }
  function nameOf(pid) { const c = clients.get(pid); return c ? c.name : ''; }
  function lobbySnapshot() { return Array.from(rooms.values()).map(roomSummary); }
  function broadcastLobby() {
    const list = lobbySnapshot();
    lobby.forEach(function (pid) { send(clients.get(pid), { t: 'lobby', rooms: list }); });
  }
  function lobbyOnline() { lobby.forEach(function (pid) { send(clients.get(pid), { t: 'lobbychat', op: 'online', n: lobby.size }); }); }
  function lobbyJoin(c) {
    lobby.add(c.pid);
    send(c, { t: 'lobby', rooms: lobbySnapshot() });
    send(c, { t: 'lobbychat', op: 'history', msgs: lobbyChat.slice() });
    lobbyOnline();
  }
  function lobbyLeave(c) { if (lobby.delete(c.pid)) lobbyOnline(); }
  function pushLobbyChat(m) {
    lobbyChat.push(m);
    while (lobbyChat.length > LOBBY_HISTORY) lobbyChat.shift();
    lobby.forEach(function (pid) { send(clients.get(pid), { t: 'lobbychat', op: 'msg', msg: m }); });
  }
  function lobbyChatSend(c, text) {
    if (!lobby.has(c.pid)) return;
    const tm = now();
    if (c.lastChatAt && tm - c.lastChatAt < 800) return err(c, 'chat_rate');
    let s = R.cleanText(String(text || '')).slice(0, CHAT_MAX);
    if (!s) return;
    if (c.lastChatText === s) return err(c, 'chat_dup');
    c.lastChatAt = tm; c.lastChatText = s;
    const d = new Date(tm + 8 * 3600 * 1000);
    const hhmm = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
    pushLobbyChat({ pid: c.pid, name: c.name, text: s, ts: tm, hhmm: hhmm });
  }

  /* ---------- 房間 ---------- */
  function snapshot(r) {
    const m = r.match;
    return {
      id: r.id, name: r.name, state: r.state, hostPid: r.hostPid, settings: r.settings,
      players: r.players.map(function (pid) { const c = clients.get(pid); return { pid: pid, name: c ? c.name : '?', connected: !!(c && c.connected) }; }),
      spectators: r.spectators.map(function (pid) { const c = clients.get(pid); return { pid: pid, name: c ? c.name : '?' }; }),
      inv: { play: r.inv.play.tok, spec: r.inv.spec.tok, exp: r.inv.exp },
      chat: r.chat.slice(),
      match: m ? matchPublic(r) : null
    };
  }
  function members(r) { return r.players.concat(r.spectators); }
  function broadcastRoom(r) {
    const s = snapshot(r);
    members(r).forEach(function (pid) { send(clients.get(pid), { t: 'room', room: s }); });
    broadcastLobby();
  }
  function emit(r, obj) { members(r).forEach(function (pid) { send(clients.get(pid), obj); }); }
  function issueInvites(r) {
    const exp = now() + inviteTtlMs;
    r.inv = { play: { tok: token() }, spec: { tok: token() }, exp: exp };
  }
  function validInvite(r, tok, wanted) {
    if (!r.inv || now() > r.inv.exp) return null;
    if (tok === r.inv.play.tok) return 'play';
    if (tok === r.inv.spec.tok) return 'spec';
    void wanted;
    return null;
  }

  function createRoom(c, msg) {
    if (c.roomId) return err(c, 'already_in_room');
    if (rooms.size >= MAX_ROOMS) return err(c, 'too_many_rooms');
    const fmt = R.FORMATS.indexOf(msg.format) !== -1 ? msg.format : 'chips';
    const rounds = Math.min(20, Math.max(3, parseInt(msg.rounds, 10) || 10));
    const timeSec = Math.min(90, Math.max(10, parseInt(msg.timeSec, 10) || 30));
    const r = {
      id: rid(), name: cleanName(msg.name, c.name + '的房間').slice(0, 16), hostPid: c.pid, players: [c.pid], spectators: [],
      settings: { format: fmt, rounds: rounds, timeSec: timeSec }, state: 'room', match: null, chat: [], createdAt: now(), seq: ++roomSeq,
      timers: {}
    };
    while (rooms.has(r.id)) r.id = rid();
    issueInvites(r);
    rooms.set(r.id, r);
    c.roomId = r.id; c.role = 'play';
    lobbyLeave(c);
    pushLobbyChat({ sys: true, name: c.name, room: { id: r.id, name: r.name }, ts: now() });
    broadcastRoom(r);
  }

  function joinRoom(c, msg) {
    if (c.roomId) return err(c, 'already_in_room');
    const r = rooms.get(String(msg.id || '').toUpperCase());
    if (!r) return err(c, msg.inv ? 'invite_invalid' : 'room_closed');
    let role = msg.role === 'spec' ? 'spec' : 'play';
    if (msg.inv) {
      const scope = validInvite(r, msg.inv);
      if (!scope) return err(c, 'invite_invalid');
      role = scope;                     // 權限完全由 token 決定，與暱稱、參數無關
    }
    if (msg.name != null) c.name = cleanName(msg.name, c.name);
    if (role === 'play' && (r.state !== 'room' || r.players.length >= MAX_PLAYERS)) {
      if (msg.inv || msg.fallbackSpec) role = 'spec';              // 席位滿或已開局：邀請者轉為觀戰
      else return err(c, r.state !== 'room' ? 'started' : 'room_full');
    }
    if (role === 'spec' && r.spectators.length >= MAX_SPECTATORS) return err(c, 'spec_full');
    if (role === 'play') r.players.push(c.pid); else r.spectators.push(c.pid);
    c.roomId = r.id; c.role = role;
    lobbyLeave(c);
    send(c, { t: 'joined', id: r.id, role: role });
    broadcastRoom(r);
  }

  function removeFrom(arr, pid) { const i = arr.indexOf(pid); if (i !== -1) arr.splice(i, 1); return i !== -1; }

  function leaveRoom(c, reason) {
    const r = rooms.get(c.roomId);
    c.roomId = null; c.role = null;
    clearTimeout(c.graceTimer); c.graceTimer = null;
    if (!r) return;
    const wasPlayer = removeFrom(r.players, c.pid);
    removeFrom(r.spectators, c.pid);
    send(c, { t: 'left', reason: reason || 'leave' });
    if (!r.players.length) { closeRoom(r, 'empty'); return; }
    if (r.hostPid === c.pid) r.hostPid = r.players[0];
    if (wasPlayer && r.match && r.state === 'match') dropFromMatch(r, c.pid);
    if (rooms.has(r.id)) broadcastRoom(r);
  }

  function closeRoom(r, why) {
    if (!rooms.has(r.id)) return;
    Object.keys(r.timers).forEach(function (k) { clearTimeout(r.timers[k]); });
    r.timers = {};
    r.inv = { play: { tok: null }, spec: { tok: null }, exp: 0 };     // 邀請立即失效
    rooms.delete(r.id);
    members(r).forEach(function (pid) {
      const c = clients.get(pid);
      if (c) { c.roomId = null; c.role = null; send(c, { t: 'closed', reason: why }); }
    });
    r.players = []; r.spectators = [];
    broadcastLobby();
  }

  function setSettings(c, r, msg) {
    if (r.hostPid !== c.pid) return err(c, 'not_host');
    if (r.state !== 'room') return err(c, 'started');
    if (R.FORMATS.indexOf(msg.format) !== -1) r.settings.format = msg.format;
    if (msg.rounds != null) r.settings.rounds = Math.min(20, Math.max(3, parseInt(msg.rounds, 10) || r.settings.rounds));
    if (msg.timeSec != null) r.settings.timeSec = Math.min(90, Math.max(10, parseInt(msg.timeSec, 10) || r.settings.timeSec));
    broadcastRoom(r);
  }

  function switchRole(c, r, role) {
    if (r.state !== 'room') return err(c, 'started');
    if (role === 'play' && c.role === 'spec') {
      if (r.players.length >= MAX_PLAYERS) return err(c, 'room_full');
      removeFrom(r.spectators, c.pid); r.players.push(c.pid); c.role = 'play';
    } else if (role === 'spec' && c.role === 'play') {
      if (r.players.length <= 1) return err(c, 'last_player');
      removeFrom(r.players, c.pid); r.spectators.push(c.pid); c.role = 'spec';
      if (r.hostPid === c.pid) r.hostPid = r.players[0];
    }
    broadcastRoom(r);
  }

  function roomChat(c, r, text) {
    const tm = now();
    if (c.lastRoomChat && tm - c.lastRoomChat < 500) return;
    const s = R.cleanText(String(text || '')).slice(0, CHAT_MAX);
    if (!s) return;
    c.lastRoomChat = tm;
    const d = new Date(tm + 8 * 3600 * 1000);
    const m = { pid: c.pid, name: c.name, text: s, ts: tm, hhmm: String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') };
    r.chat.push(m); while (r.chat.length > 50) r.chat.shift();
    emit(r, { t: 'roomchat', msg: m });
  }

  /* ---------- 對局 ---------- */
  function matchPublic(r) {
    const m = r.match;
    return {
      format: m.core.format, rounds: m.core.rounds, round: m.core.round, finished: m.core.finished, winners: m.core.winners,
      players: m.core.players, cur: m.cur ? curPublic(m) : null, last: m.last, chipStart: R.CHIP_START
    };
  }
  function curPublic(m) {
    const c = m.cur;
    return { index: c.index, total: m.core.rounds, kind: c.kind, params: c.params, puzzle: c.puzzle ? R.publicPuzzle(c.puzzle) : null, deadline: c.deadline, now: now(), done: Object.keys(c.picks).concat(Object.keys(c.solved)) };
  }

  function startMatch(r) {
    const ids = r.players.slice();
    const seed = crypto.randomBytes(6).toString('hex');
    const core = R.newMatch(ids, r.settings.format, r.settings.rounds);
    r.match = { core: core, plan: R.buildRoundPlan(seed, r.settings.rounds, ids.length), cur: null, last: null, idx: -1 };
    r.state = 'match';
    broadcastRoom(r);
    emit(r, { t: 'matchStart' });
    nextRound(r);
  }

  function alivePlayers(r) { return R.aliveIds(r.match.core).filter(function (pid) { return r.players.indexOf(pid) !== -1; }); }
  function connectedAlive(r) { return alivePlayers(r).filter(function (pid) { const c = clients.get(pid); return c && c.connected; }); }

  function nextRound(r) {
    const m = r.match;
    if (!m || m.core.finished) return;
    m.idx++;
    if (m.idx >= m.plan.length) return;
    const spec = m.plan[m.idx];
    const secs = (spec.kind === 'num' ? r.settings.timeSec : Math.round(r.settings.timeSec * 2)) * timeScale;
    const alive = alivePlayers(r);
    let params = spec.params;
    if (spec.kind === 'num' && params.mode !== 'avg') params = Object.assign({}, params, { max: Math.max(5, alive.length + 2) });
    m.cur = { index: m.idx + 1, kind: spec.kind, params: params || null, puzzle: spec.puzzle || null, picks: {}, solved: {}, tries: {}, startMs: now(), deadline: now() + secs * 1000 };
    m.last = null;
    r.timers.round = setTimeout(function () { endRound(r); }, secs * 1000 + 150);
    emit(r, { t: 'round', cur: curPublic(m), alive: alive });
  }

  function onPick(c, r, v) {
    const m = r.match; if (!m || !m.cur || m.cur.kind !== 'num' || c.role !== 'play') return;
    if (alivePlayers(r).indexOf(c.pid) === -1 || m.cur.picks[c.pid] != null) return;
    const p = m.cur.params;
    const n = Math.round(Number(v));
    if (!isFinite(n) || n < p.min || n > p.max) return err(c, 'bad_pick');
    m.cur.picks[c.pid] = n;
    send(c, { t: 'picked' });
    emit(r, { t: 'progress', done: Object.keys(m.cur.picks) });
    checkAllDone(r);
  }
  function onSolve(c, r, ans) {
    const m = r.match; if (!m || !m.cur || (m.cur.kind !== 'deduce' && m.cur.kind !== 'arith') || c.role !== 'play') return;
    const cur = m.cur;
    if (alivePlayers(r).indexOf(c.pid) === -1 || cur.solved[c.pid] != null) return;
    const tm = now();
    if (cur.tries[c.pid] && tm - cur.tries[c.pid] < 300) return;
    cur.tries[c.pid] = tm;
    const ok = cur.kind === 'deduce' ? R.checkDeduce(cur.puzzle, ans) : R.checkArith(cur.puzzle, String(ans || '').slice(0, 80)).ok;
    if (!ok) { send(c, { t: 'wrong' }); return; }
    cur.solved[c.pid] = tm - cur.startMs;
    send(c, { t: 'solved', ms: cur.solved[c.pid] });
    emit(r, { t: 'progress', done: Object.keys(cur.solved) });
    checkAllDone(r);
  }
  function checkAllDone(r) {
    const m = r.match; const cur = m.cur; if (!cur) return;
    const need = connectedAlive(r);
    const done = cur.kind === 'num' ? cur.picks : cur.solved;
    if (need.length && need.every(function (pid) { return done[pid] != null; })) endRound(r);
  }

  function endRound(r) {
    const m = r.match; if (!m || !m.cur) return;
    clearTimeout(r.timers.round);
    const cur = m.cur; m.cur = null;
    const alive = alivePlayers(r);
    let res, extra = {};
    if (cur.kind === 'num') {
      const picks = {}; alive.forEach(function (pid) { picks[pid] = cur.picks[pid] != null ? cur.picks[pid] : null; });
      res = R.resolveNumGame(cur.params, picks);
      extra = { picks: picks, info: res.info };
    } else {
      const times = {}; alive.forEach(function (pid) { times[pid] = cur.solved[pid] != null ? cur.solved[pid] : null; });
      res = R.resolveRace(times);
      extra = { times: times, puzzle: cur.puzzle };         // 回合結束才公開完整解答
    }
    const out = R.applyRound(m.core, res.points);
    const payload = Object.assign({
      t: 'roundEnd', index: cur.index, total: m.core.rounds, kind: cur.kind, params: cur.params, points: res.points, ranks: res.ranks, winners: res.winners,
      eliminated: out.eliminated, finished: out.finished, players: m.core.players, now: now(), nextAt: out.finished ? null : now() + betweenMs
    }, extra);
    m.last = payload;
    emit(r, payload);
    if (out.finished) { finishMatch(r); return; }
    r.timers.next = setTimeout(function () { if (rooms.has(r.id) && r.match === m) nextRound(r); }, betweenMs);
  }

  function finishMatch(r) {
    const m = r.match;
    emit(r, { t: 'matchEnd', winners: m.core.winners, players: m.core.players, format: m.core.format });
    broadcastRoom(r);
  }

  // 玩家在對局中離開／逾時斷線：視為出局；剩不到兩位真人就結束
  function dropFromMatch(r, pid) {
    const m = r.match; if (!m || m.core.finished) return;
    const p = m.core.players[pid];
    if (p && p.alive) { p.alive = false; p.out = m.core.round; }
    const left = alivePlayers(r);
    if (left.length <= 1) {
      clearTimeout(r.timers.next); clearTimeout(r.timers.round);
      m.cur = null; m.core.finished = true; m.core.winners = left.slice();
      finishMatch(r);
    } else if (m.cur) checkAllDone(r);
  }

  function backToRoom(c, r) {
    if (r.hostPid !== c.pid) return err(c, 'not_host');
    if (r.state !== 'match' || !r.match || !r.match.core.finished) return;
    Object.keys(r.timers).forEach(function (k) { clearTimeout(r.timers[k]); });
    r.match = null; r.state = 'room';
    broadcastRoom(r);
  }

  /* ---------- 連線與訊息 ---------- */
  function connect(sock) {
    const tmp = { pid: null, sock: sock, connected: true };
    sock._tmp = tmp;
    return tmp;
  }

  function hello(sock, msg) {
    const pid = String(msg.pid || '').slice(0, 40);
    if (!/^[A-Za-z0-9_-]{6,40}$/.test(pid)) { try { sock.close(); } catch (e) { /* ignore */ } return null; }
    let c = clients.get(pid);
    if (c) {
      if (c.sock && c.sock !== sock) { try { c.sock.close(); } catch (e) { /* ignore */ } }
      c.sock = sock; c.connected = true;
      clearTimeout(c.graceTimer); c.graceTimer = null;
    } else {
      c = { pid: pid, sock: sock, connected: true, name: '', roomId: null, role: null };
      clients.set(pid, c);
    }
    c.name = cleanName(msg.name, c.name || undefined);
    sock._client = c;
    send(c, { t: 'hello', pid: pid, name: c.name });
    const r = rooms.get(c.roomId);
    if (r) { send(c, { t: 'joined', id: r.id, role: c.role }); broadcastRoom(r); }
    else c.roomId = null;
    return c;
  }

  function onMessage(sock, raw) {
    if (typeof raw !== 'string' && raw && raw.toString) raw = raw.toString();
    if (!raw || raw.length > 4096) return;
    let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'hello') { hello(sock, msg); return; }
    const c = sock._client;
    if (!c) return;
    const r = c.roomId ? rooms.get(c.roomId) : null;
    switch (msg.t) {
      case 'lobbychat':
        if (msg.op === 'join') lobbyJoin(c);
        else if (msg.op === 'leave') lobbyLeave(c);
        else if (msg.op === 'send') lobbyChatSend(c, msg.text);
        break;
      case 'rename':
        c.name = cleanName(msg.name, c.name);
        if (r) broadcastRoom(r);
        break;
      case 'room:create': createRoom(c, msg); break;
      case 'room:join': joinRoom(c, msg); break;
      case 'room:leave': if (c.roomId) leaveRoom(c, 'leave'); break;
      case 'room:settings': if (r) setSettings(c, r, msg); break;
      case 'room:role': if (r) switchRole(c, r, msg.role); break;
      case 'room:chat': if (r) roomChat(c, r, msg.text); break;
      case 'room:revoke':
        if (r && r.hostPid === c.pid) { issueInvites(r); broadcastRoom(r); } else if (r) err(c, 'not_host');
        break;
      case 'room:kick':
        if (r && r.hostPid === c.pid && msg.pid !== c.pid) {
          const k = clients.get(msg.pid);
          if (k && k.roomId === r.id) leaveRoom(k, 'kicked');
        } else if (r) err(c, 'not_host');
        break;
      case 'room:start':
        if (!r) break;
        if (r.hostPid !== c.pid) { err(c, 'not_host'); break; }
        if (r.state !== 'room') { err(c, 'started'); break; }
        if (r.players.length < 2) { err(c, 'need_two'); break; }
        startMatch(r);
        break;
      case 'm:pick': if (r) onPick(c, r, msg.v); break;
      case 'm:solve': if (r) onSolve(c, r, msg.answer); break;
      case 'm:again':
        if (r && r.hostPid === c.pid && r.match && r.match.core.finished) {
          if (r.players.length < 2) { err(c, 'need_two'); break; }
          Object.keys(r.timers).forEach(function (k) { clearTimeout(r.timers[k]); });
          r.state = 'room'; r.match = null; startMatch(r);
        } else if (r) err(c, 'not_host');
        break;
      case 'm:toRoom': if (r) backToRoom(c, r); break;
      default: break;
    }
  }

  function onClose(sock) {
    const c = sock._client;
    if (!c || c.sock !== sock) return;
    c.connected = false;
    lobbyLeave(c);
    const r = c.roomId ? rooms.get(c.roomId) : null;
    if (!r) { clients.delete(c.pid); return; }
    if (r.match && r.state === 'match' && r.match.cur) checkAllDone(r);
    broadcastRoom(r);
    c.graceTimer = setTimeout(function () {
      if (c.connected) return;
      if (c.roomId) leaveRoom(c, 'timeout');
      clients.delete(c.pid);
    }, graceMs);
  }

  function stats() { return { rooms: rooms.size, clients: clients.size, lobby: lobby.size }; }
  function shutdown() {
    rooms.forEach(function (r) { Object.keys(r.timers).forEach(function (k) { clearTimeout(r.timers[k]); }); });
    clients.forEach(function (c) { clearTimeout(c.graceTimer); });
  }

  return { connect: connect, onMessage: onMessage, onClose: onClose, stats: stats, shutdown: shutdown, _rooms: rooms, _clients: clients, MAX_PLAYERS: MAX_PLAYERS };
}

module.exports = { createHub: createHub, MAX_PLAYERS: MAX_PLAYERS, MAX_SPECTATORS: MAX_SPECTATORS };
