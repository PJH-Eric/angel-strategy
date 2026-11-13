/* 音訊：全部由 WebAudio 即時合成（無外部素材、無授權問題，可整組替換）。
 * 首次使用者手勢後才解鎖；背景音樂與音效各自獨立開關／音量。 */
(function () {
  'use strict';
  let ctx = null, master = null, bgmGain = null, sfxGain = null, bgmNodes = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    apply();
    return ctx;
  }
  function apply() {
    if (!ctx) return;
    const s = Store.settings;
    bgmGain.gain.value = s.bgm ? s.bgmVol * 0.35 : 0;
    sfxGain.gain.value = s.sfx ? s.sfxVol : 0;
    if (s.bgm) startBgm(); else stopBgm();
  }
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
    if (c) apply();
  }
  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx || !Store.settings.sfx) return;
    const t0 = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  const SFX = {
    click: function () { tone(520, 0.05, 'square', 0.12); },
    key: function () { tone(740, 0.04, 'square', 0.1); },
    ok: function () { tone(523, 0.12, 'triangle', 0.25); tone(784, 0.18, 'triangle', 0.25, 0.1); },
    wrong: function () { tone(180, 0.22, 'sawtooth', 0.22, 0, 90); },
    tick: function () { tone(1000, 0.03, 'square', 0.08); },
    count: function () { tone(660, 0.12, 'square', 0.14); },
    go: function () { tone(988, 0.1, 'square', 0.16); tone(1318, 0.22, 'triangle', 0.22, 0.09); },
    alarm: function () { tone(880, 0.08, 'square', 0.15); tone(880, 0.08, 'square', 0.15, 0.14); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.25, i * 0.12); }); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.28, 'sawtooth', 0.18, i * 0.16); }); },
    reveal: function () { tone(300, 0.3, 'sine', 0.25, 0, 900); }
  };
  function sfx(name) { try { if (!ctx) return; if (SFX[name]) SFX[name](); } catch (e) { /* ignore */ } }

  // 背景：低頻持續音＋緩慢脈動的高頻「設備運轉聲」
  function startBgm() {
    if (!ctx || bgmNodes) return;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
    const g1 = ctx.createGain(), g2 = ctx.createGain(), lg = ctx.createGain(), f = ctx.createBiquadFilter();
    o1.type = 'sawtooth'; o1.frequency.value = 55;
    o2.type = 'sine'; o2.frequency.value = 82.5;
    f.type = 'lowpass'; f.frequency.value = 420;
    lfo.frequency.value = 0.12; lg.gain.value = 120;
    lfo.connect(lg); lg.connect(f.frequency);
    g1.gain.value = 0.5; g2.gain.value = 0.4;
    o1.connect(g1); o2.connect(g2); g1.connect(f); g2.connect(f); f.connect(bgmGain);
    o1.start(); o2.start(); lfo.start();
    bgmNodes = [o1, o2, lfo];
  }
  function stopBgm() {
    if (!bgmNodes) return;
    bgmNodes.forEach(function (n) { try { n.stop(); } catch (e) { /* ignore */ } });
    bgmNodes = null;
  }
  function vibrate(ms) { if (Store.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, unlock, { once: false, passive: true }); });
  window.Audio2 = { sfx: sfx, apply: apply, vibrate: vibrate };
})();
