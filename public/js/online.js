/* 線上模組：連線、大廳（含大廳聊天室）、房間、對局、觀戰、邀請連結。
 * 只有進入此畫面才會連線；離開（回首頁／返回）立即關閉連線與計時器。沒有 presence API。 */
(function () {
  'use strict';
  const R = AngelRules, el = UI.el, t = function (k, v) { return I18N.t(k, v); };
  const QUICK = ['chat.q1', 'chat.q2', 'chat.q3', 'chat.q4', 'chat.q5', 'chat.q6', 'chat.q7'];

  function errText(code) { const k = 'err.' + code; const s = t(k); return s === k ? t('err.generic') : s; }
  function narrow() { return window.matchMedia('(max-width: 700px), (max-height: 520px)').matches; }

  /* ---------- 聊天面板（大廳與房間共用） ---------- */
  function ChatPanel(o) {
    const host = document.getElementById('app');
    const wrap = el('div');
    host.appendChild(wrap);
    let open = o.persist ? Store.getChatOpen() : false;
    let unread = 0, atBottom = true, previewT = null, bubbleEl = null;
    const msgsEl = el('div', { class: 'lc-msgs' });
    const sa = UI.scrollArea(msgsEl, { label: o.title() });
    let onlineN = null, disabledText = '';
    const me = Store.getPid();

    function line(m) {
      if (m.sys) {
        const row = el('div', { class: 'lc-msg sys' }, [el('span', { text: t('chat.sys.room', { n: m.name, r: m.room.name }) })]);
        if (o.onJoin) row.appendChild(UI.button(t('on.join'), { cls: 'small primary', onClick: function () { setOpen(false); o.onJoin(m.room.id); } }));
        return row;
      }
      const mine = m.pid === me;
      return el('div', { class: 'lc-msg' + (mine ? ' me' : '') }, [el('span', { class: 'who', text: m.name + (mine ? t('chat.me') : '') }), el('time', { text: m.hhmm || '' }), el('div', { text: m.text })]);
    }
    function redraw() {
      msgsEl.textContent = '';
      const list = o.msgs();
      list.forEach(function (m) { msgsEl.appendChild(line(m)); });
      // 沒有訊息時：提示＋一排快捷短語，手指一點就能打招呼
      if (!list.length) {
        msgsEl.appendChild(el('div', { class: 'lc-empty' }, [Icon.el('chat'), el('p', { text: t('chat.empty') }),
          el('div', { class: 'lc-qrow' }, QUICK.slice(0, 4).map(function (k) { return UI.button(t(k), { cls: 'small ghost', onClick: function () { if (!disabledText) o.onSend(t(k)); } }); }))]));
      }
      sa.sync();
      if (atBottom) sa.view.scrollTop = sa.view.scrollHeight;
    }
    sa.view.addEventListener('scroll', function () {
      atBottom = sa.view.scrollTop + sa.view.clientHeight >= sa.view.scrollHeight - 24;
      if (atBottom) { unread = 0; newBtn.style.display = 'none'; }
    });
    const newBtn = UI.button('', { cls: 'small primary lc-new', onClick: function () { atBottom = true; sa.view.scrollTop = sa.view.scrollHeight; unread = 0; newBtn.style.display = 'none'; } });
    newBtn.style.display = 'none';

    const input = UI.input({ placeholder: t('chat.ph'), max: 60, label: t('chat.ph'), hideLabel: true });
    function submit() {
      const v = input.input.value.trim();
      if (!v || disabledText) return;
      o.onSend(v); input.input.value = '';
    }
    input.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } e.stopPropagation(); });
    const quickBtn = UI.button('', { cls: 'small ghost icon', icon: 'bolt', aria: t('chat.quick'), onClick: function () {
      UI.menu(quickBtn, QUICK.map(function (k) { return { id: k, label: t(k) }; }), function (k) { if (!disabledText) o.onSend(t(k)); });
    } });
    const title = el('b');
    const closeBtn = UI.button('', { cls: 'small ghost icon', icon: 'close', aria: t('common.close'), onClick: function () { setOpen(false); } });
    const head = el('header', null, [title, o.onRename ? UI.button('', { cls: 'small ghost icon', icon: 'edit', aria: t('chat.rename'), onClick: o.onRename }) : null, closeBtn]);
    const panel = el('div', { class: 'lc-panel', role: 'dialog', 'aria-label': t('chat.title') }, [
      head, el('div', { class: 'lc-body' }, [sa, newBtn]),
      el('div', { class: 'lc-input' }, [quickBtn, input, UI.button(t('chat.send'), { cls: 'small primary', onClick: submit })])
    ]);
    let sy = null;
    head.addEventListener('touchstart', function (e) { sy = e.touches[0].clientY; }, { passive: true });
    head.addEventListener('touchend', function (e) { if (sy != null && e.changedTouches[0].clientY - sy > 60) setOpen(false); sy = null; });

    function drawTitle() {
      title.textContent = onlineN != null ? t('chat.title.n', { n: onlineN }) : o.title();
      input.input.disabled = !!disabledText;
      input.input.placeholder = disabledText || t('chat.ph');
    }
    function popped() { if (open && narrow()) setOpen(false, true); }
    window.addEventListener('popstate', popped);
    function setOpen(v, fromPop) {
      open = v; if (o.persist) Store.setChatOpen(v);
      if (v && narrow() && !fromPop) { try { history.pushState({ lc: 1 }, ''); } catch (e) { /* ignore */ } }
      if (!v && narrow() && !fromPop && history.state && history.state.lc) { try { history.back(); } catch (e) { /* ignore */ } }
      if (v) { unread = 0; atBottom = true; }
      draw();
    }
    function draw() {
      wrap.textContent = '';
      if (o.hidden && o.hidden()) return;
      if (open) {
        wrap.appendChild(panel); drawTitle(); redraw();
        setTimeout(function () { sa.sync(); sa.view.scrollTop = sa.view.scrollHeight; }, 0);
      } else {
        bubbleEl = el('div', { class: 'lc-bubble' }, [UI.button('', { cls: 'icon', icon: 'chat', aria: t('chat.title'), onClick: function () { setOpen(true); } })]);
        wrap.appendChild(bubbleEl);
      }
    }
    draw();
    return {
      refresh: function () { drawTitle(); if (open) redraw(); },
      redraw: draw,
      push: function (m) {
        if (open) {
          const empty = msgsEl.querySelector('.lc-empty'); if (empty) empty.remove();
          msgsEl.appendChild(line(m)); sa.sync();
          if (atBottom) sa.view.scrollTop = sa.view.scrollHeight;
          else { unread++; newBtn.textContent = t('chat.new', { n: unread }); newBtn.style.display = ''; }
        } else if (!(o.hidden && o.hidden()) && bubbleEl) {
          bubbleEl.classList.remove('bounce'); void bubbleEl.offsetWidth; bubbleEl.classList.add('bounce');
          const old = bubbleEl.querySelector('.lc-preview'); if (old) old.remove();
          bubbleEl.appendChild(el('div', { class: 'lc-preview', text: m.sys ? t('chat.sys.room', { n: m.name, r: m.room.name }) : m.name + '：' + m.text }));
          clearTimeout(previewT);
          previewT = setTimeout(function () { const p = bubbleEl && bubbleEl.querySelector('.lc-preview'); if (p) p.remove(); }, 3000);
        }
      },
      setOnline: function (n) { onlineN = n; drawTitle(); },
      setDisabled: function (txt) { disabledText = txt || ''; drawTitle(); },
      destroy: function () { window.removeEventListener('popstate', popped); clearTimeout(previewT); wrap.remove(); }
    };
  }

  /* ---------- 畫面 ---------- */
  App.screens.online = function (ctx, params) {
    const S = {
      conn: 'connecting', view: 'connecting', name: Store.getName(), rooms: [], room: null, role: null,
      lobbyMsgs: [], lobbyOnline: null, roomMsgs: [], match: null, offset: 0, picked: false, solved: false, done: [],
      invite: params && params.invite ? params.invite : null, inviteBad: false, leftMatch: false, dead: false, retry: 0
    };
    let ws = null, retryT = null, tick = null, widget = null, chat = null, finalDlg = null, M = null;
    const pid = Store.getPid();

    ctx.setTitle(t('on.title'));
    ctx.setBack(leaveToHome);
    ctx.onDestroy(shutdown);
    ctx.onRerender(function () { render(); });
    document.addEventListener('as:prefs', onPrefs);

    function onPrefs() { if (chat) chat.redraw(); }
    // 連線狀態橫幅：房間／對局中斷線時顯示「重新連線中」，恢復後自動消失
    const netBanner = el('div', { class: 'net-banner', role: 'status', 'aria-live': 'polite' }, [Icon.el('online'), el('span', { text: t('on.reconnecting') })]);
    netBanner.hidden = true; document.body.appendChild(netBanner);
    function showNet(v) { netBanner.hidden = !v || (S.view !== 'room' && S.view !== 'match'); }
    function onOffline() { showNet(true); }
    function onOnline() { if (S.dead) return; S.retry = 0; clearTimeout(retryT); if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* ignore */ } ws = null; } connect(); }
    window.addEventListener('offline', onOffline); window.addEventListener('online', onOnline);
    function shutdown() {
      S.dead = true; clearTimeout(retryT); clearInterval(tick);
      window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline); netBanner.remove();
      document.removeEventListener('as:prefs', onPrefs);
      cleanupView();
      if (ws) { try { ws.onclose = null; ws.close(); } catch (e) { /* ignore */ } ws = null; }
    }
    function leaveToHome() {
      if (S.room) send({ t: 'room:leave' });
      App.go('home');
    }

    /* ----- 連線 ----- */
    function ga(fn) { try { if (window.GameAnalytics) fn(window.GameAnalytics); } catch (e) { /* 統計失敗不影響遊戲 */ } }
    function send(o) {
      if (o.t === 'room:create' || o.t === 'room:join') S.gaPending = { action: o.t === 'room:create' ? 'create' : 'join', via: o.inv ? 'invite_link' : 'lobby', spec: o.role === 'spec' };
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(o));
    }
    function connect() {
      if (S.dead) return;
      if (!AS_CONFIG.configured) { S.conn = 'noserver'; S.view = 'status'; render(); return; }
      S.conn = 'connecting'; if (S.view !== 'room' && S.view !== 'match') { S.view = 'status'; render(); }
      try { ws = new WebSocket(AS_CONFIG.wsUrl + '/ws'); } catch (e) { scheduleRetry(); return; }
      ws.onopen = function () { S.retry = 0; showNet(false); send({ t: 'hello', pid: pid, name: S.name }); };
      ws.onmessage = function (ev) { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } handle(m); };
      ws.onclose = function () { if (S.dead) return; S.conn = 'closed'; showNet(true); if (chat) chat.setDisabled(t('chat.connecting')); scheduleRetry(); };
      ws.onerror = function () { /* onclose 會處理 */ };
    }
    function scheduleRetry() {
      if (S.dead) return;
      S.conn = 'closed';
      if (S.view === 'status') render();
      clearTimeout(retryT);
      retryT = setTimeout(connect, Math.min(8000, 1000 * Math.pow(2, S.retry++)));
    }

    /* ----- 訊息處理 ----- */
    function handle(m) {
      switch (m.t) {
        case 'hello':
          S.conn = 'open'; S.name = m.name;
          if (S.room) break;                                   // 重連：等伺服器回傳房間快照
          if (S.invite) { S.view = 'invite'; render(); } else { S.view = 'lobby'; render(); send({ t: 'lobbychat', op: 'join' }); }
          break;
        case 'lobby': S.rooms = m.rooms; if (S.view === 'lobby') drawRooms(); break;
        case 'lobbychat':
          if (m.op === 'history') { S.lobbyMsgs = m.msgs; if (chat && S.view === 'lobby') chat.refresh(); }
          else if (m.op === 'msg') { S.lobbyMsgs.push(m.msg); if (S.lobbyMsgs.length > 50) S.lobbyMsgs.shift(); if (chat && S.view === 'lobby') chat.push(m.msg); }
          else if (m.op === 'online') { S.lobbyOnline = m.n; if (chat && S.view === 'lobby') chat.setOnline(m.n); }
          break;
        case 'joined': S.role = m.role; if (S.gaPending && !S.gaPending.spec && m.role === 'play') { const g = S.gaPending; ga(function (A) { A.track('room_' + g.action, { mode: 'online', via: g.via }); }); } S.gaPending = null; break;
        case 'room': onRoom(m.room); break;
        case 'roomchat': S.roomMsgs.push(m.msg); if (S.roomMsgs.length > 50) S.roomMsgs.shift(); if (chat && (S.view === 'room' || S.view === 'match')) chat.push(m.msg); break;
        case 'left': case 'closed':
          if (m.t === 'closed') UI.toast(t('on.roomClosed'), true);
          else if (m.reason === 'kicked') UI.toast(t('room.kick'), true);
          resetRoomState(); S.invite = null; S.view = 'lobby'; render(); send({ t: 'lobbychat', op: 'join' });
          break;
        case 'matchStart': if (!isSpec()) ga(function (A) { A.start({ mode: 'online', players: S.room ? S.room.players.length : 2 }, 'm:' + Date.now()); });
          S.leftMatch = false; S.myRounds = []; if (S.match) { S.match.last = null; S.match.cur = null; S.match.finished = false; } if (finalDlg) { finalDlg.close(); finalDlg = null; } break;
        case 'round': onRound(m); break;
        case 'progress': S.done = m.done; drawBoard(); break;
        case 'picked': S.picked = true; drawRoundStatus(); break;
        case 'solved': S.solved = true; Audio2.sfx('ok'); drawRoundStatus(); break;
        case 'wrong': if (widget) widget.bad(); Audio2.sfx('wrong'); Audio2.vibrate(80); UI.toast(t('play.wrong'), true); break;
        case 'roundEnd': onRoundEnd(m); break;
        case 'matchEnd': if (!isSpec()) { ga(function (A) { A.end({ result: m.winners.indexOf(pid) !== -1 ? 'win' : 'lose' }); }); S.fresh = Store.track({ t: 'online', win: m.winners.indexOf(pid) !== -1, players: Object.keys(m.players || {}).length, rounds: S.myRounds || [] }); } else S.fresh = []; onMatchEnd(m); break;
        case 'error': onError(m); break;
        default: break;
      }
    }
    function onError(m) {
      if (m.code === 'chat_rate' || m.code === 'chat_dup') { UI.toast(errText(m.code), true); return; }
      if (m.code === 'invite_invalid' || m.code === 'room_closed') {
        if (S.view === 'invite') { S.inviteBad = true; render(); return; }
      }
      UI.toast(errText(m.code), true);
    }
    function resetRoomState() { S.room = null; S.role = null; S.match = null; S.roomMsgs = []; S.picked = false; S.solved = false; S.leftMatch = false; if (finalDlg) { finalDlg.close(); finalDlg = null; } }

    function offsetFrom(now) { if (now) S.offset = now - Date.now(); }
    function onRoom(room) {
      const first = !S.room;
      S.room = room;
      S.roomMsgs = first && room.chat ? room.chat.slice() : S.roomMsgs;
      if (room.match) {
        const pm = room.match;
        S.match = Object.assign(S.match || {}, { format: pm.format, rounds: pm.rounds, round: pm.round, finished: pm.finished, winners: pm.winners, players: pm.players, chipStart: pm.chipStart });
        if (pm.cur) { S.match.cur = pm.cur; offsetFrom(pm.cur.now); S.done = pm.cur.done || []; }
        if (!pm.cur && pm.last && !S.match.last) S.match.last = pm.last;
        if (first && pm.cur) { S.picked = (pm.cur.done || []).indexOf(pid) !== -1; S.solved = S.picked; }
      } else S.match = null;
      const want = room.state === 'match' && !S.leftMatch ? 'match' : 'room';
      if (S.view !== want || first) { if (finalDlg && want === 'room') { finalDlg.close(); finalDlg = null; } S.view = want; render(); if (want === 'match') resumeMatchUI(); }
      else if (S.view === 'room') render();
      else if (S.view === 'match') drawBoard();
    }

    /* ----- 共用小元件 ----- */
    function nameOf(id) {
      if (!S.room) return '?';
      const p = S.room.players.concat(S.room.spectators).filter(function (x) { return x.pid === id; })[0];
      return p ? p.name : '?';
    }
    // 以房間名單判斷是否為觀戰者（中途改角色時不會再收到 joined）
    function isSpec() { return !!(S.room && !S.room.players.some(function (p) { return p.pid === pid; })); }
    function isHost() { return S.room && S.room.hostPid === pid; }
    function cleanupView() {
      if (widget) { widget.destroy(); widget = null; }
      if (chat) { chat.destroy(); chat = null; }
      clearInterval(tick); tick = null; M = null;
    }
    function mountChat(kind) {
      if (kind === 'lobby') {
        chat = ChatPanel({
          persist: true, title: function () { return t('chat.title'); }, msgs: function () { return S.lobbyMsgs; },
          hidden: function () { return !Store.settings.lobbyChat; },
          onSend: function (text) { send({ t: 'lobbychat', op: 'send', text: text }); },
          onJoin: function (id) { joinPublic(id); }, onRename: renameModal
        });
        if (S.lobbyOnline != null) chat.setOnline(S.lobbyOnline);
        if (S.conn !== 'open') chat.setDisabled(t('chat.connecting'));
      } else {
        chat = ChatPanel({ title: function () { return t('room.chat'); }, msgs: function () { return S.roomMsgs; }, onSend: function (text) { send({ t: 'room:chat', text: text }); } });
      }
    }
    function renameModal() {
      const f = UI.input({ value: S.name, max: 12, label: t('set.name') });
      const m = UI.modal({ title: t('set.name'), top: true, body: [f], footer: [
        UI.button(t('common.cancel'), { cls: 'ghost', onClick: function () { m.close(); } }),
        UI.button(t('common.ok'), { cls: 'primary', onClick: function () { const v = f.input.value.trim(); if (v) { S.name = v.slice(0, 12); Store.setName(S.name); send({ t: 'rename', name: S.name }); if (S.view === 'lobby') render(); } m.close(); } })
      ] });
    }

    /* ----- 渲染 ----- */
    function render() {
      cleanupView();
      ctx.screen.textContent = '';
      ctx.setTitle(t('on.title'));
      if (S.view === 'status') return renderStatus();
      if (S.view === 'invite') return renderInvite();
      if (S.view === 'lobby') return renderLobby();
      if (S.view === 'room') return renderRoom();
      if (S.view === 'match') return renderMatch();
    }
    function page(children) { const c = el('div', { class: 'stack pad bubble-safe' }, children); ctx.screen.appendChild(UI.scrollArea(c)); return c; }

    function renderStatus() {
      const noSrv = S.conn === 'noserver';
      page([el('div', { class: 'panel stack center' }, [
        el('p', { text: noSrv ? t('on.noServer') : (S.conn === 'closed' ? t('on.offline') : t('on.connecting')) }),
        noSrv ? null : UI.button(t('on.retry'), { cls: 'primary', onClick: function () { S.retry = 0; clearTimeout(retryT); connect(); } })
      ])]);
    }

    function renderInvite() {
      const f = UI.input({ value: S.name, max: 12, label: t('on.inviteName') });
      if (S.inviteBad) {
        page([el('div', { class: 'panel stack center' }, [el('p', { text: t('on.inviteBad') }), UI.button(t('common.home'), { cls: 'primary', onClick: function () { S.invite = null; S.inviteBad = false; S.view = 'lobby'; render(); send({ t: 'lobbychat', op: 'join' }); } })])]);
        return;
      }
      page([el('div', { class: 'panel stack' }, [
        el('h3', { text: t('on.inviteTitle') }), el('div', { class: 'mono', text: '#' + S.invite.room }), f,
        UI.button(t('on.join'), { cls: 'primary big block', onClick: function () {
          S.name = f.input.value.trim().slice(0, 12) || S.name; Store.setName(S.name);
          send({ t: 'room:join', id: S.invite.room, inv: S.invite.inv, name: S.name });
        } })
      ])]);
    }

    /* 大廳 */
    let roomsHost = null;
    function renderLobby() {
      const nameBtn = UI.button(S.name, { cls: 'ghost small', icon: 'edit', onClick: renameModal });
      roomsHost = el('div', { class: 'room-list' });
      const top = el('div', { class: 'row lobby-top' }, [
        el('div', { class: 'grow lobby-name' }, [el('div', { class: 'label', text: t('on.name') }), nameBtn]),
        UI.button(t('on.quick'), { cls: '', onClick: quickJoin }),
        UI.button(t('on.create'), { cls: 'primary', icon: 'plus', onClick: createModal })
      ]);
      ctx.screen.appendChild(el('div', { class: 'stack pad', style: 'flex:1;min-height:0' }, [top, el('div', { class: 'label', text: t('on.rooms') }), UI.scrollArea(roomsHost, { label: t('on.rooms') })]));
      drawRooms();
      mountChat('lobby');
    }
    function drawRooms() {
      if (!roomsHost) return;
      roomsHost.textContent = '';
      if (!S.rooms.length) { roomsHost.appendChild(el('p', { class: 'muted center', text: t('on.none') })); return; }
      S.rooms.forEach(function (r) {
        const full = r.players >= r.max, playing = r.state !== 'room';
        const row = el('div', { class: 'room-card' }, [
          el('div', { class: 'grow' }, [el('b', { text: r.name }), el('span', { class: 'muted', style: 'font-size:.85em', text: r.host + ' ・ ' + t('room.fmt.' + r.format) + ' ・ ' + t('on.players', { n: r.players, m: r.max }) + (r.spectators ? ' ・ ' + t('on.spec', { n: r.spectators }) : '') })]),
          el('span', { class: 'badge', text: playing ? t('on.playing') : t('on.waiting') })
        ]);
        row.appendChild(UI.button(full || playing ? t('on.watch') : t('on.join'), { cls: 'small ' + (full || playing ? '' : 'primary'), onClick: function () { send({ t: 'room:join', id: r.id, role: full || playing ? 'spec' : 'play', name: S.name }); } }));
        roomsHost.appendChild(row);
      });
    }
    function joinPublic(id) {
      const r = S.rooms.filter(function (x) { return x.id === id; })[0];
      const spec = !r || r.players >= r.max || r.state !== 'room';
      send({ t: 'room:join', id: id, role: spec ? 'spec' : 'play', name: S.name });
    }
    function quickJoin() {
      const r = S.rooms.filter(function (x) { return x.state === 'room' && x.players < x.max; })[0];
      if (r) send({ t: 'room:join', id: r.id, role: 'play', name: S.name });
      else send({ t: 'room:create', name: t('room.defaultName', { n: S.name }), format: 'chips', rounds: 10, timeSec: 30 });
    }
    function createModal() {
      const c = { format: 'chips', rounds: 10, timeSec: 30 };
      const nameF = UI.input({ placeholder: t('room.name'), max: 16, label: t('room.name') });
      const fmtBtn = UI.button('', { cls: 'ghost', onClick: function () {
        UI.menu(fmtBtn, R.FORMATS.map(function (f) { return { id: f, label: t('room.fmt.' + f) }; }), function (f) { c.format = f; draw(); }, c.format);
      } });
      const help = el('p', { class: 'muted', style: 'font-size:.85em;margin:0' });
      const rounds = el('b'), secs = el('b');
      const mkStep = function (get, set, lo, hi, step) {
        return [UI.button('−', { cls: 'small icon', onClick: function () { set(Math.max(lo, get() - step)); draw(); } }), UI.button('+', { cls: 'small icon', onClick: function () { set(Math.min(hi, get() + step)); draw(); } })];
      };
      function draw() { fmtBtn.textContent = t('room.fmt.' + c.format) + ' ▾'; help.textContent = t('room.fmtHelp.' + c.format, { c: R.CHIP_START }); rounds.textContent = c.rounds; secs.textContent = c.timeSec; }
      const m = UI.modal({
        title: t('on.create'), top: true,
        body: [
          nameF,
          el('div', { class: 'set-row' }, [el('div', { class: 'grow', text: t('room.format') }), fmtBtn]), help,
          el('div', { class: 'set-row' }, [el('div', { class: 'grow', text: t('room.rounds') }), el('div', { class: 'stepper' }, [mkStep(function () { return c.rounds; }, function (v) { c.rounds = v; }, 3, 20, 1)[0], rounds, mkStep(function () { return c.rounds; }, function (v) { c.rounds = v; }, 3, 20, 1)[1]])]),
          el('div', { class: 'set-row' }, [el('div', { class: 'grow', text: t('room.timer') }), el('div', { class: 'stepper' }, [mkStep(function () { return c.timeSec; }, function (v) { c.timeSec = v; }, 10, 90, 5)[0], secs, mkStep(function () { return c.timeSec; }, function (v) { c.timeSec = v; }, 10, 90, 5)[1]])])
        ],
        footer: [UI.button(t('common.cancel'), { cls: 'ghost', onClick: function () { m.close(); } }), UI.button(t('room.create'), { cls: 'primary', onClick: function () { m.close(); send({ t: 'room:create', name: nameF.input.value.trim() || t('room.defaultName', { n: S.name }), format: c.format, rounds: c.rounds, timeSec: c.timeSec }); } })]
      });
      draw();
    }

    /* 房間 */
    // 房主選回合內容（至少保留一種）與搶答題難度
    function kindsEditor(s) {
      const on = R.cleanOnlineKinds(s.kinds);
      const group = function (title, list) {
        return el('div', { class: 'stack', style: 'gap:6px' }, [el('div', { class: 'muted', style: 'font-size:.82em', text: title }), el('div', { class: 'kind-pick' }, list.map(function (k) {
          const isOn = on.indexOf(k) !== -1;
          return UI.button(t('m.k.' + k), { cls: 'small kind-btn' + (isOn ? ' is-on' : ''), icon: Icon.kind(k), aria: t('m.k.' + k) + (isOn ? ' ✓' : ''), onClick: function () {
            const next = isOn ? on.filter(function (x) { return x !== k; }) : on.concat([k]);
            if (!next.length) { UI.toast(t('room.kindsMin'), true); return; }
            send({ t: 'room:settings', kinds: next });
          } });
        }))]);
      };
      return el('div', { class: 'stack set-block' }, [
        el('div', { class: 'set-row' }, [el('div', { class: 'grow', text: t('room.kinds') }), UI.button(t('room.kindsAll'), { cls: 'small ghost', onClick: function () { send({ t: 'room:settings', kinds: R.ONLINE_KINDS }); } })]),
        group(t('room.kindsMind'), R.ONLINE_MIND), group(t('room.kindsPuzzle'), R.PUZZLE_KINDS)
      ]);
    }
    function levelEditor(s) {
      const cur = s.level || 'ramp';
      return el('div', { class: 'set-row' }, [el('div', { class: 'grow', text: t('room.level') }), el('div', { class: 'seg' }, R.ONLINE_LEVELS.map(function (lv) {
        return UI.button(t('room.level.' + lv), { cls: 'small' + (lv === cur ? ' is-on' : ''), onClick: function () { send({ t: 'room:settings', level: lv }); } });
      }))]);
    }
    function inviteUrl(tok, role) { return location.origin + location.pathname + '?room=' + S.room.id + '&inv=' + encodeURIComponent(tok) + '&role=' + role; }
    function copy(text) {
      const done = function () { UI.toast(t('common.copied')); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { UI.toast(text); });
      else UI.toast(text);
    }
    function renderRoom() {
      const rm = S.room; if (!rm) return;
      ctx.setTitle(rm.name, '#' + rm.id);
      const host = isHost();
      const players = el('div');
      rm.players.forEach(function (p) {
        const row = el('div', { class: 'player-row' + (p.connected ? '' : ' off') }, [
          el('span', { class: 'nm', text: p.name + (p.pid === pid ? '（' + t('room.you') + '）' : '') }),
          p.pid === rm.hostPid ? el('span', { class: 'badge host' }, [Icon.el('crown'), el('span', { text: t('room.host') })]) : null,
          !p.connected ? el('span', { class: 'badge', style: 'border-color:var(--red);color:var(--red)', text: t('m.discon') }) : null
        ]);
        if (host && p.pid !== pid) row.appendChild(UI.button(t('room.kick'), { cls: 'small ghost danger', onClick: function () { send({ t: 'room:kick', pid: p.pid }); } }));
        players.appendChild(row);
      });
      const specs = el('div');
      rm.spectators.forEach(function (p) { specs.appendChild(el('div', { class: 'player-row', style: 'border-left-color:var(--dim)' }, [el('span', { class: 'nm', text: p.name + (p.pid === pid ? '（' + t('room.you') + '）' : '') })])); });

      const s = rm.settings;
      let settings;
      if (host) {
        const fmtBtn = UI.button(t('room.fmt.' + s.format) + ' ▾', { cls: 'ghost', onClick: function () {
          UI.menu(fmtBtn, R.FORMATS.map(function (f) { return { id: f, label: t('room.fmt.' + f) }; }), function (f) { send({ t: 'room:settings', format: f }); }, s.format);
        } });
        const step = function (key, lo, hi, st, val) {
          return el('div', { class: 'stepper' }, [UI.button('−', { cls: 'small icon', onClick: function () { const o = { t: 'room:settings' }; o[key] = Math.max(lo, val - st); send(o); } }), el('b', { text: String(val) }), UI.button('+', { cls: 'small icon', onClick: function () { const o = { t: 'room:settings' }; o[key] = Math.min(hi, val + st); send(o); } })]);
        };
        settings = el('div', null, [
          el('div', { class: 'set-row' }, [el('div', { class: 'grow', text: t('room.format') }), fmtBtn]),
          el('p', { class: 'muted', style: 'font-size:.85em', text: t('room.fmtHelp.' + s.format, { c: R.CHIP_START }) }),
          el('div', { class: 'set-row' }, [el('div', { class: 'grow', text: t('room.rounds') }), step('rounds', 3, 20, 1, s.rounds)]),
          el('div', { class: 'set-row' }, [el('div', { class: 'grow', text: t('room.timer') }), step('timeSec', 10, 90, 5, s.timeSec)]),
          kindsEditor(s), levelEditor(s)
        ]);
      } else {
        settings = el('div', null, [
          el('div', { class: 'row' }, [el('span', { class: 'badge', text: t('room.fmt.' + s.format) }), el('span', { class: 'badge', text: t('room.rounds') + ' ' + s.rounds }), el('span', { class: 'badge', text: s.timeSec + 's' })]),
          el('p', { class: 'muted', style: 'font-size:.85em', text: t('room.fmtHelp.' + s.format, { c: R.CHIP_START }) }),
          el('div', { class: 'label', text: t('room.kinds') + ' ・ ' + t('room.level.' + (s.level || 'ramp')) }),
          el('div', { class: 'kind-strip left' }, R.cleanOnlineKinds(s.kinds).map(function (k) { return el('span', { class: 'kind-tag' }, [Icon.el(Icon.kind(k)), el('span', { text: t('m.k.' + k) })]); }))
        ]);
      }
      const playUrl = inviteUrl(rm.inv.play, 'play'), specUrl = inviteUrl(rm.inv.spec, 'spec');
      const invite = el('div', { class: 'stack' }, [
        el('div', { class: 'label', text: t('room.invite') }),
        el('div', { class: 'link-box', text: playUrl }),
        el('div', { class: 'row' }, [UI.button(t('common.copy') + ' ' + t('on.join'), { cls: 'small', icon: 'link', onClick: function () { copy(playUrl); } }), UI.button(t('common.copy') + ' ' + t('on.watch'), { cls: 'small ghost', icon: 'eye', onClick: function () { copy(specUrl); } }), host ? UI.button(t('room.revoke'), { cls: 'small ghost danger', onClick: function () { send({ t: 'room:revoke' }); } }) : null])
      ]);
      const mine = rm.players.some(function (p) { return p.pid === pid; });
      const actions = el('div', { class: 'row room-actions' });
      if (host && rm.state === 'room') actions.appendChild(UI.button(t('room.start'), { cls: 'primary big grow', disabled: rm.players.length < 2, onClick: function () { send({ t: 'room:start' }); } }));
      else if (rm.state === 'room') actions.appendChild(el('span', { class: 'muted', text: t('room.waitStart') }));
      else actions.appendChild(el('span', { class: 'muted', text: t('m.waitHost') }));
      if (!mine && rm.state === 'room') actions.appendChild(UI.button(t('room.joinPlay'), { cls: 'small', onClick: function () { send({ t: 'room:role', role: 'play' }); } }));
      if (mine && rm.players.length > 1 && rm.state === 'room') actions.appendChild(UI.button(t('room.toSpectate'), { cls: 'small ghost', onClick: function () { send({ t: 'room:role', role: 'spec' }); } }));
      actions.appendChild(UI.button(t('room.leave'), { cls: 'small ghost danger', onClick: function () { send({ t: 'room:leave' }); } }));
      if (host && rm.players.length < 2) actions.appendChild(el('div', { class: 'muted', style: 'width:100%;font-size:.85em', text: t('room.needTwo') }));
      page([
        el('div', { class: 'panel' }, [el('h3', { text: t('room.title') + ' ・ ' + rm.players.length + '/6' }), players, rm.spectators.length ? el('div', { class: 'label', style: 'margin-top:10px', text: t('room.spectators') }) : null, rm.spectators.length ? specs : null]),
        el('div', { class: 'panel' }, [settings]), el('div', { class: 'panel' }, [invite]), actions, el('div', { style: 'height:70px' })
      ]);
      mountChat('room');
    }

    /* 對局 */
    function kindLabel(k) { return t('m.k.' + k); }
    function isPick(k) { return k === 'num' || k === 'auction' || k === 'hilo' || k === 'remove'; }
    function numHelp(params) {
      return t('m.num.' + params.mode, { f: params.factor ? Math.round(params.factor * 100) / 100 : '', max: params.max });
    }
    function canAct() {
      if (!S.room || !S.match) return false;
      const mine = S.room.players.some(function (p) { return p.pid === pid; });
      const me2 = S.match.players && S.match.players[pid];
      return mine && me2 && me2.alive && !S.match.finished;
    }
    function renderMatch() {
      const rm = S.room; if (!rm || !S.match) return;
      ctx.setTitle(rm.name, '#' + rm.id);
      M = { board: el('div', { class: 'board' }), chips: el('div', { class: 'hud' }), status: el('div', { class: 'muted center', style: 'min-height:1.4em' }), content: el('div', { class: 'stack' }) };
      const left = el('div', { class: 'panel' }, [el('h3', { text: t('m.score') + ' ・ ' + (S.match.format === 'chips' ? t('m.chips') : '') }), M.board]);
      const right = el('div', { class: 'stack' }, [M.chips, M.status, M.content]);
      const main = el('div', { class: 'match', style: 'padding-bottom:80px' }, [left, right]);
      ctx.screen.appendChild(el('div', { class: 'pad', style: 'flex:1;min-height:0;display:flex' }, [UI.scrollArea(main, { label: rm.name })]));
      mountChat('room');
      tick = setInterval(onTick, 250);
      drawBoard();
    }
    function resumeMatchUI() {
      const m = S.match; if (!m) return;
      if (m.cur) buildRoundUI(); else if (m.last) showReveal(m.last);
      if (m.finished && m.last && !finalDlg) setTimeout(function () { onMatchEnd({ winners: m.winners, players: m.players, format: m.format }, true); }, 0);
    }
    function drawBoard() {
      if (!M || !S.match || !S.match.players) return;
      const order = Object.keys(S.match.players).sort(function (a, b) {
        const A = S.match.players[a], B = S.match.players[b];
        if (A.alive !== B.alive) return A.alive ? -1 : 1;
        const ka = S.match.format === 'chips' ? A.chips : A.score, kb = S.match.format === 'chips' ? B.chips : B.score;
        return kb - ka || B.score - A.score;
      });
      M.board.textContent = '';
      order.forEach(function (id) {
        const p = S.match.players[id];
        const done = S.match.cur && S.done.indexOf(id) !== -1;
        const row = el('div', { class: 'p' + (id === pid ? ' me' : '') + (p.alive ? '' : ' out') + (done ? ' done' : '') }, [
          el('span', { class: 'nm', text: nameOf(id) }),
          el('span', { class: 'bk', title: t('m.bank', { n: p.bank }), text: '⏱' + p.bank }),
          el('span', { class: 'sc', text: S.match.format === 'chips' ? p.chips + '⛁ ' + p.score : String(p.score) }),
          !p.alive ? el('span', { class: 'badge', text: t('m.out') }) : null
        ]);
        M.board.appendChild(row);
      });
      M.chips.textContent = '';
      const r = S.match.cur ? S.match.cur.index : S.match.round;
      // 手機上題型標籤佔整列，回合與時間並排在下一列
      if (S.match.cur) M.chips.appendChild(el('div', { class: 'chip kind' }, [Icon.el(Icon.kind(S.match.cur.kind), 'chip-ic'), el('div', { class: 'chip-tx' }, [el('b', { text: kindLabel(S.match.cur.kind) }), el('span', { text: t('m.thisRound') })])]));
      M.chips.appendChild(el('div', { class: 'chip' }, [Icon.el('flag', 'chip-ic'), el('div', { class: 'chip-tx' }, [el('b', { text: r + '/' + S.match.rounds }), el('span', { text: t('m.round', { a: '', b: '' }).replace(/[\d/\s]+/g, ' ').trim() || 'ROUND' })])]));
      M.chips.appendChild(el('div', { class: 'chip', id: 'tmchip' }, [Icon.el('clock', 'chip-ic'), el('div', { class: 'chip-tx' }, [el('b', { class: 'tm', text: '—' }), el('span', { text: t('play.time') })])]));
      drawRoundStatus();
    }
    function drawRoundStatus() {
      if (!M) return;
      let txt = '';
      const mine = S.room && S.room.players.some(function (p) { return p.pid === pid; });
      if (!mine) txt = t('m.spectating');
      else if (S.match && S.match.players[pid] && !S.match.players[pid].alive && !S.match.finished) txt = t('m.eliminated');
      else if (S.match && S.match.cur && (S.picked || S.solved)) txt = S.solved ? t('m.solved') : t('m.picked');
      M.status.textContent = txt;
    }
    function onTick() {
      const m = S.match; if (!m || !M) return;
      const tmEl = M.chips.querySelector('.tm'); if (!tmEl) return;
      const nowS = Date.now() + S.offset;
      if (m.cur) {
        const rem = Math.max(0, Math.ceil((m.cur.deadline - nowS) / 1000));
        tmEl.textContent = rem + 's'; tmEl.closest('.chip').classList.toggle('warn', rem <= 5);
        if (rem <= 5 && rem !== M.lastBeep && rem > 0) { M.lastBeep = rem; Audio2.sfx('tick'); }
      } else if (m.last && m.last.nextAt && !m.finished) {
        tmEl.textContent = Math.max(0, Math.ceil((m.last.nextAt - nowS) / 1000)) + 's';
        tmEl.closest('.chip').classList.remove('warn');
      } else tmEl.textContent = '—';
    }

    function onRound(m) {
      S.match = S.match || { players: {} };
      S.match.cur = m.cur; S.match.last = null; S.match.round = m.cur.index - 1; S.match.rounds = m.cur.total;
      offsetFrom(m.cur.now); S.picked = false; S.solved = false; S.done = [];
      if (S.view === 'match' && M) buildRoundUI();
    }
    function buildRoundUI() {
      if (!M || !S.match || !S.match.cur) return;
      if (widget) { widget.destroy(); widget = null; }
      const cur = S.match.cur;
      M.content.textContent = '';
      drawBoard();
      const act = canAct() && !(S.picked || S.solved);
      // 搶答題不需要標題框（上方已有題型標籤），只有心理戰顯示規則說明
      if (isPick(cur.kind)) M.content.appendChild(el('div', { class: 'panel' }, [el('h3', { class: 'kind-h' }, [Icon.el(Icon.kind(cur.kind)), el('span', { text: kindLabel(cur.kind) })]), cur.kind === 'num' ? el('p', { style: 'margin:0', text: numHelp(cur.params) }) : (isPick(cur.kind) ? el('p', { style: 'margin:0', text: t('m.help.' + cur.kind, { prize: cur.params && cur.params.prize }) }) : null)]));
      if (cur.kind === 'num') {
        const p = cur.params; let val = Math.round((p.min + p.max) / 2);
        const panel = el('div', { class: 'panel stack' });
        if (p.mode === 'avg') {
          const big = el('div', { class: 'bigpick', text: String(val) });
          const sl = UI.slider((val - p.min) / (p.max - p.min), function (v) { val = Math.round(p.min + v * (p.max - p.min)); big.textContent = String(val); }, t('m.pick'));
          sl.style.width = '100%';
          const adj = function (d) { val = Math.min(p.max, Math.max(p.min, val + d)); big.textContent = String(val); sl.set((val - p.min) / (p.max - p.min)); };
          panel.appendChild(big); panel.appendChild(sl);
          panel.appendChild(el('div', { class: 'row', style: 'justify-content:center' }, [-10, -1, 1, 10].map(function (d) { return UI.button((d > 0 ? '+' : '−') + Math.abs(d), { cls: 'small', onClick: function () { adj(d); } }); })));
        } else {
          const grid = el('div', { class: 'pick-grid' });
          for (let n = p.min; n <= p.max; n++) grid.appendChild(UI.button(String(n), {}));   // 點選由下方的監聽處理
          val = null;
          Array.prototype.forEach.call(grid.children, function (b, i) { b.addEventListener('click', function () { val = p.min + i; Array.prototype.forEach.call(grid.children, function (x) { x.classList.remove('is-on'); }); b.classList.add('is-on'); }); });
          panel.appendChild(grid);
        }
        panel.appendChild(UI.button(t('m.pick'), { cls: 'primary big block', disabled: !act, onClick: function () { if (val == null) { UI.toast(t('err.bad_pick'), true); return; } send({ t: 'm:pick', v: val }); } }));
        if (isSpec()) panel.style.display = 'none';
        M.content.appendChild(panel);
      } else if (cur.kind === 'auction') {
        const me = S.match.players[pid] || { bank: 0 };
        const bank = me.bank; let bid = 0;
        const panel = el('div', { class: 'panel stack' });
        panel.appendChild(el('div', { class: 'row', style: 'justify-content:center;gap:18px' }, [el('span', { class: 'badge', text: t('m.prize', { n: cur.params.prize }) }), el('span', { class: 'badge', text: t('m.bank', { n: bank }) })]));
        const big = el('div', { class: 'bigpick', text: '0' });
        const sl = UI.slider(0, function (v) { bid = Math.round(v * bank); big.textContent = String(bid); }, t('m.bid'));
        sl.style.width = '100%';
        const adj = function (d) { bid = Math.min(bank, Math.max(0, bid + d)); big.textContent = String(bid); sl.set(bank ? bid / bank : 0); };
        panel.appendChild(big); panel.appendChild(sl);
        panel.appendChild(el('div', { class: 'row', style: 'justify-content:center' }, [-5, -1, 1, 5].map(function (d) { return UI.button((d > 0 ? '+' : '−') + Math.abs(d), { cls: 'small', onClick: function () { adj(d); } }); })));
        panel.appendChild(UI.button(t('m.bidGo'), { cls: 'primary big block', disabled: !act, onClick: function () { send({ t: 'm:pick', v: bid }); } }));
        if (isSpec()) panel.style.display = 'none';
        M.content.appendChild(panel);
      } else if (cur.kind === 'hilo') {
        const others = (cur.view && cur.view.others) || {};
        const panel = el('div', { class: 'panel stack' });
        panel.appendChild(el('div', { class: 'label', text: t('m.others') }));
        const row = el('div', { class: 'cards' });
        Object.keys(others).forEach(function (id) { row.appendChild(el('div', { class: 'card' }, [el('b', { class: 'cv', text: String(others[id]) }), el('span', { class: 'cn', text: nameOf(id) })])); });
        row.appendChild(el('div', { class: 'card me' }, [el('b', { class: 'cv', text: '?' }), el('span', { class: 'cn', text: t('room.you') })]));
        panel.appendChild(row);
        let call = null; const btns = {};
        const group = el('div', { class: 'row', style: 'justify-content:center' });
        // 只有兩人時一定有一人最大、一人最小，「都不是」不可能成立 → 不顯示
        (Object.keys(others).length >= 2 ? ['H', 'L', 'M'] : ['H', 'L']).forEach(function (k) { const b = UI.button(t('m.call.' + k), { cls: 'ghost', onClick: function () { call = k; Object.keys(btns).forEach(function (x) { btns[x].classList.toggle('is-on', x === k); }); } }); btns[k] = b; group.appendChild(b); });
        panel.appendChild(group);
        panel.appendChild(UI.button(t('play.submit'), { cls: 'primary big block', disabled: !act, onClick: function () { if (!call) { UI.toast(t('m.pickOne'), true); return; } send({ t: 'm:pick', v: call }); } }));
        if (isSpec() || !cur.view) panel.style.display = 'none';
        M.content.appendChild(panel);
      } else if (cur.kind === 'remove') {
        const hand = (cur.view && cur.view.hand) || [];
        const panel = el('div', { class: 'panel stack' });
        panel.appendChild(el('div', { class: 'label', text: t('m.hand') }));
        const sel = [];
        const row = el('div', { class: 'cards' });
        hand.forEach(function (v, i) {
          const c = el('button', { type: 'button', class: 'card pick' }, [el('b', { class: 'cv', text: String(v) })]);
          c.addEventListener('click', function () {
            const at = sel.indexOf(i);
            if (at !== -1) sel.splice(at, 1); else { if (sel.length >= 2) sel.shift(); sel.push(i); }
            Array.prototype.forEach.call(row.children, function (x, k) { x.classList.toggle('is-on', sel.indexOf(k) !== -1); });
          });
          row.appendChild(c);
        });
        panel.appendChild(row);
        panel.appendChild(UI.button(t('play.submit'), { cls: 'primary big block', disabled: !act, onClick: function () { if (sel.length !== 2) { UI.toast(t('m.pickTwo'), true); return; } send({ t: 'm:pick', v: sel.slice().sort() }); } }));
        if (isSpec() || !cur.view) panel.style.display = 'none';
        M.content.appendChild(panel);
      } else {
        const puzzle = cur.puzzle;
        const o = { onSubmit: function (ans) { if (canAct() && !S.solved) send({ t: 'm:solve', answer: ans }); } };
        widget = Puzzle.mount(puzzle, o);
        const grid = el('div', { class: 'play' + (puzzle.type === 'scale' || puzzle.type === 'pyramid' ? ' fig-main' : '') }, [el('div', { class: 'panel' }, [widget.cluesEl]), el('div', { class: 'panel' }, [widget.entryEl])]);
        if (!act) grid.style.opacity = '.55';
        M.content.appendChild(grid);
        const stopFit = Puzzle.autoFit(grid, grid.closest('.sa-view')), d0 = widget.destroy;
        widget.destroy = function () { stopFit(); d0(); };
      }
      Audio2.sfx('reveal');
      drawRoundStatus();
    }
    function onRoundEnd(re) {
      S.match = S.match || {};
      S.match.last = re; S.match.cur = null; S.match.players = re.players; S.match.round = re.index; offsetFrom(re.now);
      // 紀錄：本局每回合是否拿到第一（大或小以猜中為準）
      if (!isSpec() && re.points && re.points[pid] != null) (S.myRounds = S.myRounds || []).push({ kind: re.kind, won: re.kind === 'hilo' ? re.points[pid] > 0 : re.winners.indexOf(pid) !== -1 });
      if (widget) { widget.destroy(); widget = null; }
      if (S.view === 'match' && M) showReveal(re);
    }
    function pickText(re, id) {
      const v = re.picks[id];
      if (v == null) return t('m.noPick');
      if (re.kind === 'auction') return String(v) + (re.info.spend && re.info.spend[id] ? '（−' + re.info.spend[id] + '⏱）' : '');
      if (re.kind === 'hilo') return t('m.card', { n: re.info.cards[id] }) + ' / ' + t('m.call.' + v);
      if (re.kind === 'remove') return re.info.played[id] ? re.info.played[id].map(function (c, i) { return re.info.removed[id][i] ? '✗' + c : String(c); }).join(' ') + ' = ' + re.info.score[id] : t('m.noPick');
      return String(v);
    }
    // 暗標玩法的圖解：把所有人的牌／出價攤開並標註怎麼判定
    function sealedExplain(re) {
      const i = re.info, box = el('div', { class: 'sol' }, [el('h4', { text: t('res.solution') })]);
      const ids = Object.keys(re.points);
      if (re.kind === 'auction') {
        const mx = Math.max.apply(null, ids.map(function (id) { return i.bids[id] || 0; }).concat([1]));
        ids.forEach(function (id) {
          const b = i.bids[id] || 0;
          box.appendChild(el('div', { class: 'bidbar' + (i.winner === id ? ' win' : '') + (i.tie && b === i.top ? ' tie' : '') }, [el('span', { class: 'nm', text: nameOf(id) }), el('span', { class: 'bar' }, [el('i', { style: 'width:' + Math.round(b / mx * 100) + '%' })]), el('b', { class: 'mono', text: String(b) })]));
        });
        box.appendChild(el('div', { text: i.winner ? t('m.ex.auctionWin', { name: nameOf(i.winner), bid: i.top, prize: i.prize }) : (i.tie ? t('m.ex.auctionTie', { bid: i.top }) : t('m.ex.auctionNone')) }));
      } else if (re.kind === 'hilo') {
        const row = el('div', { class: 'cards' });
        ids.forEach(function (id) {
          const tr = i.truth[id], ok = i.calls[id] === tr;
          row.appendChild(el('div', { class: 'card ' + (ok ? 'good' : 'badc') }, [el('b', { class: 'cv', text: String(i.cards[id]) }), el('span', { class: 'cn', text: nameOf(id) }), el('span', { class: 'cn', text: t('m.actual') + '：' + t('m.call.' + tr) }), el('span', { class: 'cn', text: t('m.guess') + '：' + (i.calls[id] ? (ok ? '✓ ' : '✗ ') + t('m.call.' + i.calls[id]) : t('m.noPick')) })]));
        });
        box.appendChild(row);
        box.appendChild(el('div', { text: t('m.ex.hilo') }));
      } else {
        ids.forEach(function (id) {
          const pl = i.played[id];
          const row = el('div', { class: 'cards inline' }, [el('span', { class: 'nm', text: nameOf(id) })]);
          if (!pl) row.appendChild(el('span', { class: 'muted', text: t('m.noPick') }));
          else pl.forEach(function (c, k) { row.appendChild(el('div', { class: 'card sm' + (i.removed[id][k] ? ' gone' : '') }, [el('b', { class: 'cv', text: String(c) })])); });
          row.appendChild(el('b', { class: 'mono', text: '= ' + i.score[id] }));
          box.appendChild(row);
        });
        box.appendChild(el('div', { text: t('m.ex.remove', { max: i.max, min: i.min }) }));
      }
      return box;
    }
    function showReveal(re) {
      if (!M) return;
      M.content.textContent = '';
      drawBoard();
      const rows = Object.keys(re.points).sort(function (a, b) { return re.ranks[a] - re.ranks[b]; });
      const tbl = el('table', { class: 'rtable' }, [el('tr', null, [el('th', { text: '#' }), el('th', { text: '' }), el('th', { text: isPick(re.kind) ? t('m.revealed') : t('play.time') }), el('th', { text: t('m.score') })])]);
      rows.forEach(function (id) {
        const v = isPick(re.kind) ? pickText(re, id) : (re.times[id] == null ? t('m.noPick') : UI.fmtSec(re.times[id]) + 's');
        tbl.appendChild(el('tr', { class: re.winners.indexOf(id) !== -1 ? 'win' : '' }, [el('td', { text: String(re.ranks[id]) }), el('td', { text: nameOf(id) + (id === pid ? '（' + t('room.you') + '）' : '') }), el('td', { class: 'mono', text: v }), el('td', { class: 'mono', text: t('m.pts', { n: re.points[id] }) })]));
      });
      const box = el('div', { class: 'panel stack' }, [el('h3', { class: 'kind-h' }, [Icon.el(Icon.kind(re.kind)), el('span', { text: t('m.roundEnd') + ' ・ ' + kindLabel(re.kind) })]), tbl]);
      if (re.kind === 'num') box.appendChild(el('div', { class: 'sol' }, [el('h4', { text: t('res.solution') }), el('div', { text: R.explainNumGame(re.params, { info: re.info }, I18N.lang) })]));
      if (re.kind === 'auction' || re.kind === 'hilo' || re.kind === 'remove') box.appendChild(sealedExplain(re));
      if (re.eliminated && re.eliminated.length) box.appendChild(el('div', { class: 'badge', style: 'border-color:var(--red);color:var(--red);width:fit-content', text: t('m.out') + '：' + re.eliminated.map(nameOf).join('、') }));
      M.content.appendChild(box);
      if (re.puzzle) M.content.appendChild(Puzzle.solutionView(re.puzzle, kindLabel(re.kind)));
      Audio2.sfx(re.winners.indexOf(pid) !== -1 ? 'win' : 'reveal');
    }
    function onMatchEnd(m, silent) {
      S.match = S.match || {}; S.match.finished = true; S.match.winners = m.winners; S.match.players = m.players;
      if (S.view !== 'match' || finalDlg) return;
      drawBoard();
      const order = Object.keys(m.players).sort(function (a, b) {
        const A = m.players[a], B = m.players[b], ka = m.format === 'chips' ? A.chips : A.score, kb = m.format === 'chips' ? B.chips : B.score;
        return (B.alive - A.alive) || (kb - ka) || (B.score - A.score);
      });
      const tbl = el('table', { class: 'rtable' }, [el('tr', null, [el('th', { text: '#' }), el('th', { text: '' }), el('th', { text: t('m.score') }), el('th', { text: m.format === 'chips' ? t('m.chips') : '' })])]);
      // 同分同名次（1、1、3）
      const keyOf = function (id) { const P = m.players[id]; return (P.alive ? 1 : 0) + ':' + (m.format === 'chips' ? P.chips : P.score) + ':' + P.score; };
      const rankOf = {}; order.forEach(function (id, i) { rankOf[id] = i > 0 && keyOf(id) === keyOf(order[i - 1]) ? rankOf[order[i - 1]] : i + 1; });
      order.forEach(function (id, i) {
        const win = m.winners.indexOf(id) !== -1;
        tbl.appendChild(el('tr', { class: win ? 'win' : '' }, [el('td', { text: String(rankOf[id]) }), el('td', { text: nameOf(id) + (win ? ' ★' : '') }), el('td', { class: 'mono', text: String(m.players[id].score) }), el('td', { class: 'mono', text: m.format === 'chips' ? String(m.players[id].chips) : '' })]));
      });
      const iWon = m.winners.indexOf(pid) !== -1;
      const host = isHost();
      if (!silent) Audio2.sfx(iWon ? 'win' : 'lose');
      const dlg = UI.modal({
        title: t('m.final'), closable: false,
        body: [el('h3', { class: 'result-title ' + (iWon ? 'win' : ''), text: t('m.champion') + '：' + m.winners.map(nameOf).join('、') }), tbl,
          S.fresh && S.fresh.length ? el('div', { class: 'ach-strip' }, [el('div', { class: 'label', text: t('ach.unlockedNow') }), el('div', { class: 'row' }, S.fresh.map(function (id) { const a = Records.byId(id); return el('div', { class: 'ach-badge tier-' + (a ? a.tier : 'bronze') }, [Icon.el(a ? a.icon : 'medal'), el('span', { text: t('ach.' + id) })]); }))]) : null,
          UI.button(t('share.open'), { cls: 'small ghost share-open', icon: 'share', onClick: function () {
            Share.open({ title: S.room ? S.room.name : t('home.online'), sub: t('room.fmt.' + m.format), win: iWon, result: t('m.champion') + '：' + m.winners.map(nameOf).join('、'),
              stats: [[t('m.final'), (rankOf[pid] || '—') + ' / ' + order.length]],
              lines: order.map(function (id) { return [rankOf[id] + '. ' + nameOf(id) + (id === pid ? t('chat.me') : ''), String(m.format === 'chips' ? m.players[id].chips + '⛁' : m.players[id].score)]; }),
              badges: (S.fresh || []).map(function (id) { const a = Records.byId(id); return { name: t('ach.' + id), tier: a ? a.tier : 'bronze' }; }) });
          } })],
        footer: [
          UI.button(host ? t('common.again') : t('m.waitHost'), { cls: 'primary', icon: 'retry', disabled: !host, onClick: function () { send({ t: 'm:again' }); } }),
          UI.button(t('common.room'), { cls: 'ghost', icon: 'room', onClick: function () {
            if (host) send({ t: 'm:toRoom' });
            else { dlg.close(); finalDlg = null; S.leftMatch = true; S.view = 'room'; render(); }
          } }),
          UI.button(t('common.home'), { cls: 'ghost', icon: 'home', onClick: function () { dlg.close(); finalDlg = null; leaveToHome(); } })
        ]
      });
      finalDlg = dlg;
    }

    connect();
  };
})();
