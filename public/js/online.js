/* 線上模組（階段三實作中）。目前僅提供佔位畫面，避免首頁按鈕報錯。 */
(function () {
  'use strict';
  const el = UI.el, t = function (k, v) { return I18N.t(k, v); };
  App.screens.online = function (ctx) {
    ctx.setTitle(t('on.title'));
    ctx.setBack(function () { App.go('home'); });
    ctx.screen.appendChild(el('div', { class: 'pad' }, [el('p', { class: 'muted', text: t('on.connecting') })]));
  };
})();
