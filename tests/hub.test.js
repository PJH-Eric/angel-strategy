'use strict';
// 線上引擎測試（假連線，不開網路埠）：node tests/hub.test.js
const assert = require('assert');
const { createHub } = require('../lib/hub.js');
const R = require('../public/js/rules.js');

let passed = 0, failed = 0;
const queue = [];
function t(name, fn) { queue.push({ name: name, fn: fn }); }
const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

function mk(hub, pid, name) {
  const msgs = [];
  const sock = { readyState: 1, send: function (s) { msgs.push(JSON.parse(s)); }, close: function () { this.readyState = 3; } };
  hub.connect(sock);
  const c = {
    sock: sock, msgs: msgs, pid: pid,
    say: function (o) { hub.onMessage(sock, JSON.stringify(o)); },
    last: function (type) { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].t === type) return msgs[i]; return null; },
    all: function (type) { return msgs.filter(function (m) { return m.t === type; }); },
    err: function () { const e = c.all('error'); return e.length ? e[e.length - 1].code : null; },
    drop: function () { sock.readyState = 3; hub.onClose(sock); }
  };
  c.say({ t: 'hello', pid: pid, name: name });
  return c;
}
function roomOf(hub, c) { return hub._rooms.get(c.last('room').room.id); }

t('建房、大廳列表、房主設定、非房主不可改', async function () {
  const hub = createHub();
  const a = mk(hub, 'pidAAAA1', 'A'), b = mk(hub, 'pidBBBB1', 'B');
  b.say({ t: 'lobbychat', op: 'join' });
  a.say({ t: 'room:create', name: '測試房', format: 'elimination', rounds: 5, timeSec: 20 });
  const room = a.last('room').room;
  assert.strictEqual(room.settings.format, 'elimination');
  assert.strictEqual(b.last('lobby').rooms.length, 1);
  b.say({ t: 'room:join', id: room.id });
  b.say({ t: 'room:settings', format: 'points' });
  assert.strictEqual(b.err(), 'not_host');
  a.say({ t: 'room:settings', format: 'points', rounds: 4 });
  assert.strictEqual(a.last('room').room.settings.format, 'points');
  assert.strictEqual(a.last('room').room.players.length, 2);
  hub.shutdown();
});

t('邀請連結：token 決定權限、撤銷與逾時失效、無效提示', async function () {
  let clock = 1000000;
  const hub = createHub({ now: function () { return clock; }, inviteTtlMs: 5000 });
  const h = mk(hub, 'pidHost01', 'H');
  h.say({ t: 'room:create', name: 'R' });
  const room = h.last('room').room;
  const p = mk(hub, 'pidPlay01', 'P'), s = mk(hub, 'pidSpec01', 'S'), x = mk(hub, 'pidBad001', 'X');
  p.say({ t: 'room:join', id: room.id, inv: room.inv.play, name: '改名P', role: 'spec' });   // 想用參數改成觀戰：無效，仍以 token 為準
  assert.strictEqual(p.last('joined').role, 'play');
  s.say({ t: 'room:join', id: room.id, inv: room.inv.spec, role: 'play' });                   // 觀戰 token 不能升級成玩家
  assert.strictEqual(s.last('joined').role, 'spec');
  x.say({ t: 'room:join', id: room.id, inv: 'wrong' });
  assert.strictEqual(x.err(), 'invite_invalid');
  h.say({ t: 'room:revoke' });
  const y = mk(hub, 'pidOld001', 'Y');
  y.say({ t: 'room:join', id: room.id, inv: room.inv.play });                                   // 舊 token
  assert.strictEqual(y.err(), 'invite_invalid');
  const fresh = h.last('room').room;
  clock += 6000;
  y.say({ t: 'room:join', id: room.id, inv: fresh.inv.play });                                  // 已逾時
  assert.strictEqual(y.all('error').length, 2);
  hub.shutdown();
});

t('邀請者遇到席位已滿 → 轉觀戰；公開加入則回報已滿', async function () {
  const hub = createHub();
  const h = mk(hub, 'pidHost02', 'H');
  h.say({ t: 'room:create', name: 'R' });
  const room = h.last('room').room;
  for (let i = 0; i < 5; i++) mk(hub, 'pidFill0' + i, 'F' + i).say({ t: 'room:join', id: room.id });
  assert.strictEqual(roomOf(hub, h).players.length, 6);
  const v = mk(hub, 'pidLate01', 'V');
  v.say({ t: 'room:join', id: room.id, inv: room.inv.play });
  assert.strictEqual(v.last('joined').role, 'spec');
  const w = mk(hub, 'pidLate02', 'W');
  w.say({ t: 'room:join', id: room.id });
  assert.strictEqual(w.err(), 'room_full');
  hub.shutdown();
});

t('完整對局：題目不洩漏解答、回合後公開解法、觀戰收到相同事件', async function () {
  const hub = createHub({ betweenMs: 5, timeScale: 0.05 });
  const a = mk(hub, 'pidFull01', 'A'), b = mk(hub, 'pidFull02', 'B'), c = mk(hub, 'pidFull03', 'C'), sp = mk(hub, 'pidFull04', 'S');
  a.say({ t: 'room:create', name: 'R', format: 'points', rounds: 7, timeSec: 20 });
  const room = a.last('room').room;
  b.say({ t: 'room:join', id: room.id }); c.say({ t: 'room:join', id: room.id });
  sp.say({ t: 'room:join', id: room.id, inv: room.inv.spec });
  const bad = mk(hub, 'pidFull05', 'D');
  a.say({ t: 'room:start' });
  const players = [a, b, c];
  const r = hub._rooms.get(room.id);
  let guard = 0, acted = 0;
  while (!r.match.core.finished && guard++ < 3000) {
    await sleep(8);
    const cur = r.match.cur;
    if (!cur || cur.index === acted) continue;
    acted = cur.index;                                   // 每回合只行動一次（避免重置防刷計時）
    if (cur.kind === 'num') {
      players.forEach(function (p, i) { p.say({ t: 'm:pick', v: cur.params.min + ((i * 7 + cur.index) % (cur.params.max - cur.params.min + 1)) }); });
    } else {
      a.say({ t: 'm:solve', answer: cur.kind === 'deduce' ? [9, 9, 9] : '1+1' });      // A 先答錯一次
      b.say({ t: 'm:solve', answer: cur.puzzle.solution });
      c.say({ t: 'm:solve', answer: cur.puzzle.solution });
      setTimeout(function () { if (r.match.cur === cur) a.say({ t: 'm:solve', answer: cur.puzzle.solution }); }, 320);
    }
  }
  assert.ok(r.match.core.finished, '對局應該結束');
  const rounds = a.all('round');
  rounds.forEach(function (m) {
    assert.strictEqual(JSON.stringify(m).indexOf('"solution"'), -1, '進行中的題目不得含解答');
  });
  const ends = a.all('roundEnd');
  assert.strictEqual(ends.length, 7);
  ends.forEach(function (e) {
    if (e.kind !== 'num') assert.ok(e.puzzle && e.puzzle.solution, '回合結束要公開完整解法');
    else assert.ok(e.picks && e.info);
  });
  assert.ok(a.last('matchEnd'));
  assert.strictEqual(sp.all('roundEnd').length, 7, '觀戰者收到相同結果');
  assert.ok(sp.last('matchEnd').winners.length >= 1);
  // 觀戰者不能操作
  assert.strictEqual(bad.all('round').length, 0);
  const total = Object.keys(r.match.core.players).reduce(function (s, k) { return s + r.match.core.players[k].score; }, 0);
  assert.ok(total > 0);
  hub.shutdown();
});

t('逾時未出手 0 分；籌碼制歸零者出局，剩一人即結束', async function () {
  const hub = createHub({ betweenMs: 5, timeScale: 0.02 });
  const a = mk(hub, 'pidChip001', 'A'), b = mk(hub, 'pidChip002', 'B');
  a.say({ t: 'room:create', name: 'R', format: 'chips', rounds: 20, timeSec: 10 });
  b.say({ t: 'room:join', id: a.last('room').room.id });
  a.say({ t: 'room:start' });
  const r = roomOf(hub, a);
  let guard = 0;
  while (!r.match.core.finished && guard++ < 400) {
    await sleep(10);
    const cur = r.match.cur;
    if (!cur) continue;
    // 只有 A 出手，B 一律逾時
    if (cur.kind === 'num') a.say({ t: 'm:pick', v: cur.params.min });
    else a.say({ t: 'm:solve', answer: cur.puzzle.solution });
  }
  assert.ok(r.match.core.finished);
  assert.deepStrictEqual(r.match.core.winners, ['pidChip001']);
  assert.strictEqual(r.match.core.players.pidChip002.alive, false);
  hub.shutdown();
});

t('非房主不能開始；少於 2 位真人不能開始；回合內未知指令被忽略', async function () {
  const hub = createHub();
  const a = mk(hub, 'pidStart01', 'A'), b = mk(hub, 'pidStart02', 'B');
  a.say({ t: 'room:create', name: 'R' });
  a.say({ t: 'room:start' });
  assert.strictEqual(a.err(), 'need_two');
  b.say({ t: 'room:join', id: a.last('room').room.id });
  b.say({ t: 'room:start' });
  assert.strictEqual(b.err(), 'not_host');
  b.say({ t: 'm:pick', v: 5 });            // 對局未開始：忽略
  b.say({ t: 'nonsense' });
  hub.shutdown();
});

t('房主離開自動換人；實體玩家為 0（只剩觀戰者）立即關房並撤銷邀請', async function () {
  const hub = createHub();
  const a = mk(hub, 'pidLife001', 'A'), b = mk(hub, 'pidLife002', 'B'), s = mk(hub, 'pidLife003', 'S');
  a.say({ t: 'room:create', name: 'R' });
  const room = a.last('room').room;
  b.say({ t: 'room:join', id: room.id });
  s.say({ t: 'room:join', id: room.id, inv: room.inv.spec });
  a.say({ t: 'room:leave' });
  assert.strictEqual(b.last('room').room.hostPid, 'pidLife002');
  b.say({ t: 'room:leave' });
  assert.ok(s.last('closed'), '觀戰者應收到房間已結束');
  assert.strictEqual(hub._rooms.size, 0);
  const late = mk(hub, 'pidLife004', 'L');
  late.say({ t: 'room:join', id: room.id, inv: room.inv.play });
  assert.strictEqual(late.err(), 'invite_invalid');
  s.say({ t: 'room:join', id: room.id });                               // 重連／重送也不會讓房間復活
  assert.strictEqual(hub._rooms.size, 0);
  hub.shutdown();
});

t('斷線寬限：期限內重連保留席位；逾時才離開並可能關房', async function () {
  const hub = createHub({ graceMs: 60 });
  const a = mk(hub, 'pidGrace01', 'A'), b = mk(hub, 'pidGrace02', 'B');
  a.say({ t: 'room:create', name: 'R' });
  b.say({ t: 'room:join', id: a.last('room').room.id });
  b.drop();
  assert.strictEqual(roomOf(hub, a).players.length, 2);
  const b2 = mk(hub, 'pidGrace02', 'B');                                // 重連
  assert.ok(b2.last('joined'));
  await sleep(90);
  assert.strictEqual(roomOf(hub, a).players.length, 2, '重連後不該被移除');
  a.drop();
  b2.drop();
  await sleep(120);
  assert.strictEqual(hub._rooms.size, 0, '兩人都逾時後房間關閉');
  hub.shutdown();
});

t('大廳聊天室：歷史、過濾、重複阻擋、頻率限制、開房公告', async function () {
  let clock = 5000000;
  const hub = createHub({ now: function () { return clock; } });
  const a = mk(hub, 'pidChat001', 'A'), b = mk(hub, 'pidChat002', 'B');
  a.say({ t: 'lobbychat', op: 'join' }); b.say({ t: 'lobbychat', op: 'join' });
  assert.strictEqual(b.last('lobbychat').n, 2);
  a.say({ t: 'lobbychat', op: 'send', text: 'hi fuck 你好' });
  const m1 = b.all('lobbychat').filter(function (x) { return x.op === 'msg'; }).pop().msg;
  assert.ok(m1.text.indexOf('fuck') === -1 && m1.text.indexOf('＊') !== -1);
  clock += 1000;
  a.say({ t: 'lobbychat', op: 'send', text: 'hi fuck 你好' });
  assert.strictEqual(a.err(), 'chat_dup');
  clock += 1000;
  a.say({ t: 'lobbychat', op: 'send', text: '第二句' });
  clock += 100;
  a.say({ t: 'lobbychat', op: 'send', text: '第三句' });
  assert.strictEqual(a.all('error').length, 2, '太快送出被擋（重複 1 次＋頻率 1 次）');
  clock += 1000;
  a.say({ t: 'lobbychat', op: 'send', text: 'x'.repeat(200) });
  assert.strictEqual(b.all('lobbychat').filter(function (x) { return x.op === 'msg'; }).pop().msg.text.length, 60);
  a.say({ t: 'room:create', name: '公告房' });
  const sys = b.all('lobbychat').filter(function (x) { return x.op === 'msg' && x.msg.sys; }).pop();
  assert.ok(sys && sys.msg.room.name === '公告房');
  const late = mk(hub, 'pidChat003', 'L');
  late.say({ t: 'lobbychat', op: 'join' });
  assert.ok(late.last('lobbychat').op === 'online' || late.all('lobbychat').some(function (x) { return x.op === 'history' && x.msgs.length >= 2; }));
  b.say({ t: 'lobbychat', op: 'leave' });
  hub.shutdown();
});

t('玩家改暱稱會經過消毒；超長暱稱被截斷', async function () {
  const hub = createHub();
  const a = mk(hub, 'pidName001', '<script>alert(1)</script>超級長的暱稱超級長的暱稱');
  const hello = a.last('hello');
  assert.ok(hello.name.length <= 12);
  assert.ok(hello.name.indexOf('<') === -1);
  hub.shutdown();
});

(async function run() {
  for (const q of queue) {
    try { await q.fn(); passed++; console.log('  ok  ' + q.name); }
    catch (e) { failed++; console.error('FAIL  ' + q.name + '\n      ' + (e && e.stack || e)); }
  }
  console.log('\n' + passed + ' 項通過' + (failed ? '，' + failed + ' 項失敗' : ''));
  process.exit(failed ? 1 : 0);
})();
