/* Brief, delayed hints for icon controls; never take focus or intercept a click. */
(() => {
  'use strict';
  const selector = '#playButton,#soundButton,#immerseButton,#settingsButton,#islandFavorite,#islandShuffle,.favorite-button,#closeSettings,#cancelMoment,.island-drawer-actions>.icon-button,#prevPage,#nextPage,#prevFrame,#nextFrame';
  const tip = document.createElement('div');
  tip.id = 'interactionTip'; tip.className = 'interaction-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.append(tip);
  document.getElementById('immerseButton').setAttribute('aria-label', 'Hide interface and enter immersive mode');
  let active = null, timer = 0;
  function label(button) {
    if (button.id === 'islandShuffle') return 'Randomly switch outfits';
    if (button.id === 'immerseButton') return 'Hide interface and enter immersive mode';
    if (button.id === 'settingsButton') return button.getAttribute('aria-expanded') === 'true' ? 'Close settings' : 'Open settings';
    return button.getAttribute('aria-label') || button.dataset.controlHint || '';
  }
  function suppressNativeTitle(button) {
    if (button.hasAttribute('title')) {
      if (button.title) button.dataset.controlHint = button.title;
      button.removeAttribute('title');
    }
  }
  function hide() {
    clearTimeout(timer); timer = 0; tip.hidden = true;
    if (active) {
      const ids = (active.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== tip.id);
      if (ids.length) active.setAttribute('aria-describedby', ids.join(' '));
      else active.removeAttribute('aria-describedby');
    }
    active = null;
  }
  function available(button) {
    return button.isConnected && !button.disabled && button.getAttribute('aria-disabled') !== 'true' &&
      !document.body.matches('.is-idle,.is-immersed') && button.getBoundingClientRect().width > 0 &&
      getComputedStyle(button).visibility !== 'hidden' && !button.closest('[inert],[hidden]');
  }
  function show() {
    timer = 0;
    if (!active || !available(active)) { hide(); return; }
    const words = label(active); if (!words) { hide(); return; }
    tip.textContent = words;
    tip.style.fontSize = Math.max(12, parseFloat(getComputedStyle(document.getElementById('momentButton')).fontSize)) + 'px';
    tip.hidden = false;
    const box = active.getBoundingClientRect(), bounds = tip.getBoundingClientRect();
    const above = box.top - bounds.height - 10;
    const top = box.top > innerHeight / 2 && above >= 12 ? above : Math.min(innerHeight - bounds.height - 12, box.bottom + 10);
    tip.style.left = Math.max(12, Math.min(innerWidth - bounds.width - 12, box.left + (box.width - bounds.width) / 2)) + 'px';
    tip.style.top = Math.max(12, top) + 'px';
    const ids = new Set((active.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add(tip.id); active.setAttribute('aria-describedby', [...ids].join(' '));
  }
  function schedule(button) {
    if (active === button) return;
    hide(); if (!available(button)) return;
    suppressNativeTitle(button); active = button; timer = setTimeout(show, 550);
  }
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const button = event.target.closest(selector); if (button) schedule(button);
  });
  document.addEventListener('pointerout', event => {
    if (active && active.contains(event.target) && !active.contains(event.relatedTarget)) hide();
  });
  document.addEventListener('focusin', event => {
    const button = event.target.closest(selector); if (button?.matches(':focus-visible')) schedule(button);
  });
  document.addEventListener('focusout', event => { if (active === event.target) hide(); });
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', event => { if (['Escape', 'Enter', ' '].includes(event.key)) hide(); }, true);
  document.addEventListener('scroll', hide, true);
  for (const event of ['resize','blur','purple:layout-change','purple:typography-change']) window.addEventListener(event, hide);
  document.querySelectorAll(selector).forEach(suppressNativeTitle);
  const changes = new MutationObserver(records => {
    for (const record of records) if (record.attributeName === 'title' && record.target.matches(selector)) suppressNativeTitle(record.target);
    if (active && !available(active)) hide();
    else if (active && !tip.hidden) show();
  });
  for (const region of document.querySelectorAll('.interface,.panel')) changes.observe(region, {subtree:true,attributes:true,attributeFilter:['title','aria-label','aria-expanded','disabled','hidden']});
  new MutationObserver(() => { if (document.body.matches('.is-idle,.is-immersed,.has-panel')) hide(); }).observe(document.body, {attributes:true,attributeFilter:['class']});
})();
