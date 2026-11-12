/* 天使的策略 — 前端主程式：路由、首頁、選關、每日挑戰、設定、單機遊玩 */
(function () {
  'use strict';
  const R = AngelRules, el = UI.el, t = function (k, v) { return I18N.t(k, v); };
  const root = document.getElementById('app');

  const App = { screens: {}, cur: null, params: null, destroy: null, rerender: null, pauseFn: null, resumeFn: null };
  window.App = App;

  /* ---------- 全域設定套用 ---------- */
  function applyPrefs() {
    document.body.classList.toggle('reduce-motion', !!Store.settings.reduce);
    Audio2.apply();
    document.dispatchEvent(new CustomEvent('as:prefs'));
  }

  /* ---------- 路由與外框 ---------- */
  function go(name, params) {
    UI.closeMenus();
    if (App.destroy) { try { App.destroy(); } catch (e) { console.error(e); } }
    App.destroy = null; App.rerender = null; App.pauseFn = null; App.resumeFn = null;
    App.cur = name; App.params = params || {};
    root.textContent = '';
    root.appendChild(el('div', { class: 'hazard' }));
    const title = el('div', { class: 'title' });
    const left = el('div', { class: 'row', style: 'gap:6px' });
    const langBtn = UI.button('', { cls: 'small ghost', aria: t('common.language'), onClick: function () {
      UI.menu(langBtn, I18N.LANGS.map(function (l) { return { id: l.id, label: l.label }; }), function (id) { I18N.setLang(id); }, I18N.lang);
    } });
    langBtn.textContent = I18N.lang === 'en' ? 'EN' : '中文'; langBtn.insertBefore(Icon.el('globe'), langBtn.firstChild);
    const setBtn = UI.button('', { cls: 'small ghost icon', icon: 'gear', aria: t('common.settings'), onClick: openSettings });
    // 語言按鈕緊鄰設定按鈕（右上角）
    const right = el('div', { class: 'row', style: 'gap:8px;flex-wrap:nowrap' }, [langBtn, setBtn]);
    const bar = el('div', { class: 'topbar' }, [left, title, right]);
    const screen = el('div', { class: 'screen' });
    root.appendChild(bar); root.appendChild(screen);
    const ctx = {
      screen: screen,
      setTitle: function (main, sub) { title.textContent = main; if (sub) title.appendChild(el('small', { text: sub })); },
      setLobby: function () {
        bar.classList.add('is-home');
        const a = el('a', { class: 'btn small ghost lobby-link', href: AS_CONFIG.lobbyUrl, 'aria-label': t('home.lobby') }, [Icon.el('back'), el('span', { class: 'll-tx', text: t('home.lobby') })]);
        a.addEventListener('click', function () { Audio2.sfx('click'); });
        left.textContent = ''; left.appendChild(a);
      },
      setBack: function (fn, label) { left.textContent = ''; if (fn) left.appendChild(UI.button('', { cls: 'small ghost icon', icon: 'back', aria: label || t('common.back'), onClick: fn })); },
      onDestroy: function (f) { App.destroy = f; },
      onRerender: function (f) { App.rerender = f; },
      onPause: function (p, r) { App.pauseFn = p; App.resumeFn = r; }
    };
    try { if (window.GameAnalytics) GameAnalytics.pageView(name); } catch (e) { /* ignore */ }
    App.screens[name](ctx, App.params);
  }
  App.go = go;

  /* ---------- 上一頁：其他畫面回首頁，首頁再按上一頁回遊戲大廳 ---------- */
  function armHistory() { try { history.replaceState({ as: 'root' }, ''); history.pushState({ as: 'app' }, ''); } catch (e) { /* ignore */ } }
  window.addEventListener('popstate', function (e) {
    const st = e.state || {};
    if (st.lc || st.as === 'app') return;                 // 聊天面板自己處理
    if (App.cur === 'home' || !App.cur) { location.href = AS_CONFIG.lobbyUrl; return; }
    try { history.pushState({ as: 'app' }, ''); } catch (err) { /* ignore */ }
    go('home');
  });
  I18N.onChange(function () { if (App.rerender) App.rerender(); else if (App.cur) go(App.cur, App.params); });

  /* ---------- 設定彈窗（Modal，非路由、非抽屜） ---------- */
  function openSettings() {
    if (App.pauseFn) App.pauseFn();
    const S = Store.settings;
    const row = function (label, ctrl, sub) {
      return el('div', { class: 'set-row' }, [el('div', { class: 'grow' }, [el('div', { text: label }), sub ? el('div', { class: 'muted', style: 'font-size:.8em', text: sub }) : null]), ctrl]);
    };
    const ctrls = {};
    const mk = function () {
      ctrls.bgm = UI.toggle(S.bgm, function (v) { S.bgm = v; Store.saveSettings(); applyPrefs(); }, t('set.bgm'));
      ctrls.bgmVol = UI.slider(S.bgmVol, function (v) { S.bgmVol = v; Store.saveSettings(); Audio2.apply(); }, t('set.bgmVol'));
      ctrls.sfx = UI.toggle(S.sfx, function (v) { S.sfx = v; Store.saveSettings(); applyPrefs(); }, t('set.sfx'));
      ctrls.sfxVol = UI.slider(S.sfxVol, function (v) { S.sfxVol = v; Store.saveSettings(); Audio2.apply(); }, t('set.sfxVol'));
      ctrls.vib = UI.toggle(S.vibrate, function (v) { S.vibrate = v; Store.saveSettings(); }, t('set.vibrate'));
      ctrls.red = UI.toggle(S.reduce, function (v) { S.reduce = v; Store.saveSettings(); applyPrefs(); }, t('set.reduce'));
      ctrls.chat = UI.toggle(S.lobbyChat, function (v) { S.lobbyChat = v; Store.saveSettings(); applyPrefs(); }, t('set.lobbyChat'));
    };
    mk();
    const m = UI.modal({
      title: t('set.title'), top: true,
      body: [
        row(t('set.bgm'), ctrls.bgm), row(t('set.bgmVol'), ctrls.bgmVol),
        row(t('set.sfx'), ctrls.sfx), row(t('set.sfxVol'), ctrls.sfxVol),
        row(t('set.vibrate'), ctrls.vib), row(t('set.reduce'), ctrls.red), row(t('set.lobbyChat'), ctrls.chat)
      ],
      footer: [UI.button(t('set.reset'), { cls: 'ghost', onClick: function () {
        Store.resetSettings(); applyPrefs();
        const d = Store.settings;
        ctrls.bgm.set(d.bgm); ctrls.bgmVol.set(d.bgmVol); ctrls.sfx.set(d.sfx); ctrls.sfxVol.set(d.sfxVol); ctrls.vib.set(d.vibrate); ctrls.red.set(d.reduce); ctrls.chat.set(d.lobbyChat);
      } }), UI.button(t('common.close'), { cls: 'primary', onClick: function () { m.close(); } })],
      onClose: function () { if (App.resumeFn) App.resumeFn(); }
    });
  }

  function openHow() {
    // 圖示＋一句話的卡片清單，觸控裝置也好掃讀
    const item = function (ic, title, desc) { return el('div', { class: 'how-item' }, [Icon.el(ic), el('div', null, [el('b', { text: title }), el('p', { text: desc })])]); };
    const sec = function (title, items) { return el('section', { class: 'how-sec' }, [el('h4', { text: title }), el('div', { class: 'how-grid' }, items)]); };
    const body = [
      sec(t('how.modes'), [
        item('solo', t('home.campaign'), t('howm.campaign')), item('daily', t('home.daily'), t('howm.daily')),
        item('dice', t('home.random'), t('howm.random')), item('online', t('home.online'), t('howm.online'))
      ]),
      sec(t('how.kinds'), R.PUZZLE_KINDS.map(function (k) { return item(Icon.kind(k), t('kind.' + k), t('howk.' + k)); })),
      sec(t('how.onlineGames'), ['num', 'auction', 'hilo', 'remove'].map(function (k) { return item(Icon.kind(k), t('m.k.' + k), t('howo.' + k)); })),
      el('p', { class: 'muted', text: t('how.5') }),
      el('p', { class: 'muted', text: t('how.kb') })
    ];
    const m = UI.modal({ title: t('how.title'), top: true,
      body: body,
      footer: [UI.button(t('common.close'), { cls: 'primary', onClick: function () { m.close(); } })] });
  }

  /* ---------- 首頁 ---------- */
  App.screens.home = function (ctx) {
    ctx.setTitle(t('app.name'));
    ctx.setLobby();
    const halo = '<svg viewBox="0 0 120 120" aria-hidden="true"><g class="ring" fill="none" stroke="#f2a81d" stroke-width="3"><ellipse cx="60" cy="26" rx="34" ry="10"/><ellipse cx="60" cy="26" rx="24" ry="6" stroke-width="1.5" opacity=".6"/></g>' +
      '<g fill="none" stroke="#5cb7cf" stroke-width="2.5" stroke-linejoin="round"><path d="M60 40 L38 64 L14 52 L30 84 L60 104 L90 84 L106 52 L82 64 Z" fill="rgba(92,183,207,.08)"/><path d="M60 40 V104 M38 64 L60 84 L82 64" opacity=".6"/></g></svg>';
    const col = el('div', { class: 'home' }, [
      el('div', { class: 'halo', html: halo }),
      el('h1', { class: 'logo', text: t('app.name') }),
      el('p', { class: 'tagline', text: t('app.tag') }),
      el('div', { class: 'menu' }, [
        UI.button(t('home.campaign'), { cls: 'primary big block', icon: 'solo', onClick: function () { go('campaign'); } }),
        UI.button(t('home.daily'), { cls: 'big block', icon: 'daily', onClick: function () { go('daily'); } }),
        UI.button(t('home.random'), { cls: 'big block', icon: 'dice', onClick: function () { go('random'); } }),
        UI.button(t('home.online'), { cls: 'big block', icon: 'online', onClick: function () { go('online'); } }),
        UI.button(t('home.how'), { cls: 'ghost block', icon: 'book', onClick: openHow })
      ]),
      el('div', { class: 'kind-strip', 'aria-label': t('home.foot') }, R.PUZZLE_KINDS.map(function (k) { return el('span', { class: 'kind-tag' }, [Icon.el(Icon.kind(k)), el('span', { text: t('kind.' + k) })]); })),
      el('p', { class: 'home-foot', text: t('home.foot') })
    ]);
    ctx.screen.appendChild(UI.scrollArea(col));
  };

  /* ---------- 單機選關 ---------- */
  App.screens.campaign = function (ctx, p) {
    let diff = p.diff || 'baby';
    ctx.setTitle(t('camp.title'));
    ctx.setBack(function () { go('home'); });
    const tabs = el('div', { class: 'tabs' });
    const sub = el('p', { class: 'muted', style: 'margin:0' });
    const gridHost = el('div', { style: 'display:flex;flex:1;min-height:0' });
    function draw() {
      tabs.textContent = '';
      R.DIFFS.forEach(function (d) {
        const b = UI.button(t('diff.' + d) + ' ' + Store.cleared(d) + '/' + R.LEVELS_PER_DIFF, { cls: 'tab small' + (d === diff ? ' is-on' : ''), onClick: function () { diff = d; draw(); } });
        tabs.appendChild(b);
      });
      sub.textContent = t('camp.sub');
      const grid = el('div', { class: 'lv-grid' });
      for (let lv = 1; lv <= R.LEVELS_PER_DIFF; lv++) {
        const ok = Store.unlocked(diff, lv), boss = R.isBoss(lv);
        const b = UI.button('', { cls: 'lv' + (boss ? ' boss' : '') + (ok ? '' : ' locked'), aria: t('camp.level', { n: lv }), onClick: function () {
          if (!ok) { UI.toast(t('camp.locked'), true); return; }
          go('play', { mode: 'campaign', diff: diff, level: lv });
        } });
        const kind = R.levelKind(lv);
        b.appendChild(ok ? el('span', { class: 'no', text: String(lv) }) : Icon.el('lock', 'lk'));
        b.appendChild(el('span', { class: 'stars', text: UI.stars(Store.stars(diff, lv)) }));
        b.appendChild(Icon.el(Icon.kind(kind), 'kd'));
        b.title = (boss ? t('camp.boss') : t('kind.' + kind));
        if (boss) b.appendChild(el('span', { class: 'bosstag', text: t('camp.boss') }));
        grid.appendChild(b);
      }
      gridHost.textContent = '';
      gridHost.appendChild(UI.scrollArea(grid, { label: t('camp.title') }));
      // 跳到區段／目前進度（200 關不用一直往下滑）
      let cur = 1;
      while (cur < R.LEVELS_PER_DIFF && Store.stars(diff, cur) > 0) cur++;
      const toLv = function (lv, smooth) { const tile = grid.children[lv - 1]; if (tile) tile.scrollIntoView({ block: lv === 1 ? 'start' : 'center', behavior: smooth ? 'smooth' : 'auto' }); };
      jump.textContent = '';
      jump.appendChild(UI.button(t('camp.current') + ' ' + cur, { cls: 'small primary', icon: 'flag', onClick: function () { toLv(cur, true); } }));
      for (let a = 1; a <= R.LEVELS_PER_DIFF; a += 50) (function (a) { jump.appendChild(UI.button(a + '–' + Math.min(R.LEVELS_PER_DIFF, a + 49), { cls: 'small ghost', onClick: function () { toLv(a, true); } })); })(a);
      requestAnimationFrame(function () { toLv(cur, false); });
    }
    const jump = el('div', { class: 'row jump-row', role: 'group', 'aria-label': t('camp.jump') });
    ctx.screen.appendChild(el('div', { class: 'stack pad', style: 'flex:1;min-height:0' }, [tabs, sub, jump, gridHost]));
    draw();
  };

  /* ---------- 每日挑戰 ---------- */
  App.screens.daily = function (ctx, p) {
    let diff = p.diff || 'easy';
    const date = R.taipeiDate();
    ctx.setTitle(t('daily.title'));
    ctx.setBack(function () { go('home'); });
    const tabs = el('div', { class: 'tabs' });
    const info = el('div', { class: 'panel stack' });
    function draw() {
      tabs.textContent = '';
      R.DIFFS.forEach(function (d) { tabs.appendChild(UI.button(t('diff.' + d), { cls: 'tab small' + (d === diff ? ' is-on' : ''), onClick: function () { diff = d; draw(); } })); });
      const best = Store.dailyBest(date, diff);
      const lim = R.dailyTimeLimitSec(diff);
      const today = R.dailyPuzzles(date, diff);
      info.textContent = '';
      info.appendChild(el('h3', { text: t('daily.today', { d: date }) }));
      info.appendChild(el('p', { class: 'muted', style: 'margin:0', text: t('daily.sub') }));
      info.appendChild(el('div', { class: 'row' }, [
        el('span', { class: 'badge', text: t('diff.' + diff) }),
        el('span', { class: 'badge', text: lim ? lim + 's' : '∞' }),
        el('span', { class: 'badge', text: t('daily.count', { n: today.length }) }),
        best != null ? el('span', { class: 'badge', style: 'border-color:var(--green);color:var(--green)', text: t('daily.best', { s: best.toFixed(2) }) }) : null
      ]));
      info.appendChild(el('div', { class: 'kind-strip left' }, today.map(function (pz, i) { return el('span', { class: 'kind-tag' }, [el('b', { class: 'mono', text: String(i + 1) }), Icon.el(Icon.kind(pz.type)), el('span', { text: t('kind.' + pz.type) })]); })));
      info.appendChild(UI.button(t('daily.start'), { cls: 'primary big block', icon: 'play', onClick: function () { go('play', { mode: 'daily', diff: diff, date: date }); } }));
    }
    ctx.screen.appendChild(UI.scrollArea(el('div', { class: 'stack pad' }, [tabs, info])));
    draw();
  };

  /* ---------- 隨機挑戰 ---------- */
  function newSeed() {
    try { const a = new Uint32Array(2); crypto.getRandomValues(a); return a[0].toString(36) + a[1].toString(36); }
    catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
  }
  App.newSeed = newSeed;
  App.screens.random = function (ctx, p) {
    let diff = p.diff || 'normal';
    ctx.setTitle(t('rand.title'));
    ctx.setBack(function () { go('home'); });
    const tabs = el('div', { class: 'tabs' });
    const info = el('div', { class: 'panel stack' });
    function draw() {
      tabs.textContent = '';
      R.DIFFS.forEach(function (d) { tabs.appendChild(UI.button(t('diff.' + d), { cls: 'tab small' + (d === diff ? ' is-on' : ''), onClick: function () { diff = d; draw(); } })); });
      const st = Store.randomStat(diff), lim = R.randomTimeLimitSec(diff), hc = R.hintLimit(diff);
      info.textContent = '';
      info.appendChild(el('h3', { class: 'kind-h' }, [Icon.el('dice'), el('span', { text: t('rand.title') + ' ・ ' + t('diff.' + diff) })]));
      info.appendChild(el('p', { class: 'muted', style: 'margin:0', text: t('rand.sub', { n: R.RANDOM_COUNT }) }));
      info.appendChild(el('div', { class: 'row' }, [
        el('span', { class: 'badge', text: t('daily.count', { n: R.RANDOM_COUNT }) }),
        el('span', { class: 'badge', text: lim ? lim + 's' : '∞' }),
        el('span', { class: 'badge', text: t('play.hints') + ' ' + (hc === Infinity ? '∞' : hc) }),
        el('span', { class: 'badge', text: t('rand.runs', { n: st.runs, w: st.wins }) }),
        st.best != null ? el('span', { class: 'badge', style: 'border-color:var(--green);color:var(--green)', text: t('daily.best', { s: st.best.toFixed(2) }) }) : null
      ]));
      info.appendChild(el('div', { class: 'kind-strip left' }, R.PUZZLE_KINDS.map(function (k) { return el('span', { class: 'kind-tag' }, [Icon.el(Icon.kind(k)), el('span', { text: t('kind.' + k) })]); })));
      info.appendChild(UI.button(t('rand.start'), { cls: 'primary big block', icon: 'dice', onClick: function () { go('play', { mode: 'random', diff: diff, seed: newSeed() }); } }));
    }
    ctx.screen.appendChild(UI.scrollArea(el('div', { class: 'stack pad' }, [tabs, info])));
    draw();
  };

  /* ---------- 單機遊玩（闖關、每日、隨機共用） ---------- */
  App.screens.play = function (ctx, p) {
    const daily = p.mode === 'daily', rnd = p.mode === 'random', camp = !daily && !rnd;
    const diff = p.diff;
    const puzzles = daily ? R.dailyPuzzles(p.date, diff) : (rnd ? R.randomPuzzles(p.seed, diff) : R.levelPuzzles(diff, p.level));
    const limit = daily ? R.dailyTimeLimitSec(diff) : (rnd ? R.randomTimeLimitSec(diff) : R.timeLimitSec(diff, p.level));
    const modeTitle = daily ? t('daily.title') : (rnd ? t('rand.title') : t('camp.level', { n: p.level }));
    const backTo = daily ? 'daily' : (rnd ? 'random' : 'campaign');
    const hintCap = R.hintLimit(diff);
    const S = { idx: 0, hints: 0, ph: 0, tries: 0, elapsed: 0, last: performance.now(), paused: false, ended: false, hintMsgs: [], widget: null, wstate: null };
    const gaKey = 'solo:' + Date.now();
    try { if (window.GameAnalytics) GameAnalytics.start({ mode: 'solo', difficulty: diff, variant: daily ? 'daily' : (rnd ? 'random' : 'campaign') }, gaKey); } catch (e) { /* ignore */ }
    let timer = null;
    ctx.setTitle(modeTitle, t('diff.' + diff));

    const hud = el('div', { class: 'hud' });
    const body = el('div', { class: 'play' });
    const hintBox = el('div', { class: 'sol', style: 'display:none;border-left-color:var(--cyan)' });
    const actions = el('div', { class: 'row' });
    const main = el('div', { class: 'stack', style: 'padding:0 2px 14px' }, [hud, body, hintBox, actions]);
    ctx.screen.appendChild(el('div', { class: 'pad', style: 'flex:1;min-height:0;display:flex' }, [UI.scrollArea(main, { label: t('app.name') })]));

    function remainSec() { return limit == null ? null : Math.max(0, limit - S.elapsed / 1000); }
    function drawHud() {
      const rem = remainSec();
      hud.textContent = '';
      const chip = function (k, v, ic, cls, vcls) { return el('div', { class: 'chip ' + (cls || '') }, [Icon.el(ic, 'chip-ic'), el('div', { class: 'chip-tx' }, [el('b', { class: vcls || '', text: v }), el('span', { text: t(k) })])]); };
      const pz0 = puzzles[S.idx];
      hud.appendChild(el('div', { class: 'chip kind' }, [Icon.el(Icon.kind(pz0.type), 'chip-ic'), el('div', { class: 'chip-tx' }, [el('b', { text: t('kind.' + pz0.type) }), el('span', { text: modeTitle })])]));
      hud.appendChild(chip('play.step', (S.idx + 1) + '/' + puzzles.length, 'stack'));
      hud.appendChild(chip('play.time', rem == null ? (S.elapsed / 1000).toFixed(0) + 's' : Math.ceil(rem) + 's', 'clock', rem != null && rem <= 10 ? 'warn' : '', 'tm'));
      hud.appendChild(chip('play.hints', hintCap === Infinity ? '∞' : String(Math.max(0, hintCap - S.hints)), 'bulb'));
      hud.appendChild(chip('play.tries', String(S.tries), 'target'));
    }
    function tick() {
      if (S.ended || S.paused) { S.last = performance.now(); return; }
      const now = performance.now();
      S.elapsed += now - S.last; S.last = now;
      const tm = hud.querySelector('.tm');
      const rem = remainSec();
      if (tm) tm.textContent = rem == null ? (S.elapsed / 1000).toFixed(0) + 's' : Math.ceil(rem) + 's';
      if (tm && rem != null) {
        const w = rem <= 10; tm.closest('.chip').classList.toggle('warn', w);
        if (w && Math.ceil(rem) !== S.lastBeep) { S.lastBeep = Math.ceil(rem); Audio2.sfx('tick'); }
      }
      if (rem === 0) finish('timeup');
    }

    function mountPuzzle() {
      if (S.widget) S.widget.destroy();
      const pz = puzzles[S.idx];
      body.textContent = '';
      const o = { state: S.wstate, onChange: function (st) { S.wstate = st; }, onSubmit: function (ans) { submit(ans); } };
      S.widget = Puzzle.mount(pz, o);
      const left = el('div', { class: 'panel' }, [S.widget.cluesEl]);
      const right = el('div', { class: 'panel' }, [S.widget.entryEl]);
      body.appendChild(left); body.appendChild(right);
      drawHintBox();
      drawActions();
    }
    function drawHintBox() {
      hintBox.textContent = '';
      if (!S.hintMsgs.length) { hintBox.style.display = 'none'; return; }
      hintBox.style.display = '';
      hintBox.appendChild(el('h4', { text: t('play.hint') }));
      S.hintMsgs.forEach(function (m) { hintBox.appendChild(el('div', { class: 'mono', text: m })); });
    }
    function drawActions() {
      actions.textContent = '';
      const left = hintCap === Infinity ? Infinity : hintCap - S.hints;
      const hb = UI.button(t('play.hint') + ' (' + (hintCap === 0 ? '—' : (left === Infinity ? t('play.hintInf') : t('play.hintLeft', { n: left }))) + ')', {
        cls: 'ghost small', icon: 'hint', title: hintCap === 0 ? t('play.hintNone') : null, disabled: hintCap === 0 || left <= 0, onClick: useHint
      });
      actions.appendChild(hb);
      actions.appendChild(UI.button(t('play.giveup'), { cls: 'ghost small', icon: 'flagWhite', onClick: function () { finish('gaveup'); } }));
      actions.appendChild(UI.button(t('play.exit'), { cls: 'ghost small danger', icon: 'exit', onClick: function () {
        S.paused = true;
        const m = UI.confirm(t('play.leaveAsk'), function () { exit(); });
        const closeOld = m.close; m.close = function () { closeOld(); S.paused = false; S.last = performance.now(); };
      } }));
    }
    function useHint() {
      const pz = puzzles[S.idx];
      if (pz.type === 'deduce') {
        const h = R.deduceHint(pz, Object.keys(S.widget.state.locked).map(Number));
        if (!h) return;
        S.widget.lockHint(h.pos, h.digit);
      } else {
        S.hintMsgs.push(R.hintPuzzle(pz, S.ph, I18N.lang));
        if (S.widget.applyHint) S.widget.applyHint(S.ph);
      }
      S.hints++; S.ph++; Audio2.sfx('ok');
      drawHintBox(); drawHud(); drawActions();
    }

    function submit(ans) {
      if (S.ended) return;
      const pz = puzzles[S.idx];
      const ok = !!R.checkPuzzle(pz, ans).ok;
      if (!ok) { S.tries++; S.widget.bad(); Audio2.sfx('wrong'); Audio2.vibrate(80); UI.toast(t('play.wrong'), true); drawHud(); return; }
      Audio2.sfx('ok'); Audio2.vibrate(30);
      if (S.idx + 1 >= puzzles.length) { finish('win'); return; }
      UI.toast(t('play.right'));
      S.idx++; S.ph = 0; S.hintMsgs = []; S.wstate = null;
      drawHud(); mountPuzzle();
    }

    function exit() {
      stop();
      go(backTo, { diff: diff });
    }
    function stop() { S.ended = true; clearInterval(timer); if (S.widget) { S.widget.destroy(); S.widget = null; } }

    function finish(why) {
      if (S.ended) return;
      S.ended = true; clearInterval(timer);
      if (S.widget) { S.widget.destroy(); S.widget = null; }
      const usedSec = Math.round(S.elapsed / 10) / 100;
      const win = why === 'win';
      try { if (window.GameAnalytics) GameAnalytics.end({ result: win ? 'win' : (why === 'gaveup' ? 'dnf' : 'lose') }, gaKey); } catch (e) { /* ignore */ }
      let stars = 0;
      if (win) {
        if (daily) Store.setDaily(p.date, diff, usedSec);
        else if (rnd) { /* 隨機挑戰統計在下方 */ }
        else { stars = R.starsFor(diff, p.level, usedSec, S.hints); Store.setStars(diff, p.level, stars); }
      }
      if (rnd) Store.addRandomRun(diff, win ? usedSec : null);
      Audio2.sfx(win ? 'win' : 'lose'); Audio2.vibrate(win ? [40, 40, 40] : 200);
      const body2 = [
        el('h3', { class: 'result-title ' + (win ? 'win' : 'lose'), text: win ? t('res.clear') : (why === 'timeup' ? t('res.timeup') : t('res.gaveup')) }),
        el('div', { class: 'row' }, [
          el('span', { class: 'badge', text: t('res.time', { s: usedSec.toFixed(2) }) }),
          el('span', { class: 'badge', text: t('res.hintsUsed', { n: S.hints }) }),
          win && camp ? el('span', { class: 'badge', style: 'color:var(--amber)', text: UI.stars(stars) }) : null
        ])
      ];
      puzzles.forEach(function (pz, i) { body2.push(Puzzle.solutionView(pz, puzzles.length > 1 ? t('res.puzzleN', { n: i + 1 }) : '')); });
      const foot = [];
      foot.push(UI.button(rnd ? t('rand.again') : t('common.again'), { cls: 'primary', icon: rnd ? 'dice' : 'retry', onClick: function () { m.close(); go('play', rnd ? { mode: 'random', diff: diff, seed: newSeed() } : p); } }));
      if (win && camp && p.level < R.LEVELS_PER_DIFF) foot.push(UI.button(t('common.next'), { cls: 'primary', icon: 'play', onClick: function () { m.close(); go('play', { mode: 'campaign', diff: diff, level: p.level + 1 }); } }));
      foot.push(UI.button(camp ? t('common.levelList') : t('common.back'), { cls: 'ghost', icon: daily ? 'daily' : (rnd ? 'dice' : 'stack'), onClick: function () { m.close(); go(backTo, { diff: diff }); } }));
      foot.push(UI.button(t('common.home'), { cls: 'ghost', icon: 'home', onClick: function () { m.close(); go('home'); } }));
      const m = UI.modal({ title: modeTitle, body: body2, footer: foot, closable: false });
    }

    ctx.setBack(function () {
      S.paused = true;
      const m = UI.confirm(t('play.leaveAsk'), function () { exit(); });
      const closeOld = m.close; m.close = function () { closeOld(); S.paused = false; S.last = performance.now(); };
    });
    ctx.onDestroy(stop);
    ctx.onPause(function () { S.paused = true; }, function () { S.paused = false; S.last = performance.now(); });
    ctx.onRerender(function () {
      // 語言切換：保留進度，只重畫整個遊玩畫面
      const keep = { idx: S.idx, hints: S.hints, ph: S.ph, tries: S.tries, elapsed: S.elapsed, hintMsgs: S.hintMsgs, wstate: S.wstate, ended: S.ended };
      if (keep.ended) { go('play', p); return; }
      stop();
      go('play', Object.assign({}, p, { _resume: keep }));
    });
    if (p._resume) Object.assign(S, p._resume, { ended: false, last: performance.now() });
    drawHud(); mountPuzzle();
    timer = setInterval(tick, 100);
  };

  /* ---------- 啟動 ---------- */
  // 等所有腳本（含 online.js）載入後再啟動；邀請連結（?room=..&inv=..）交給線上模組處理
  window.addEventListener('load', function () {
    applyPrefs();
    armHistory();
    const q = new URLSearchParams(location.search);
    if (q.get('room') && q.get('inv') && App.screens.online) go('online', { invite: { room: q.get('room'), inv: q.get('inv'), role: q.get('role') || 'play' } });
    else go('home');
  });
})();
