/* Layout composition only. Playback, catalog, dialogue and preferences remain in app.js. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const body = document.body, root = document.documentElement;
  const footer = document.querySelector('.bottom-bar');
  const wardrobe = document.querySelector('.wardrobe');
  const status = document.querySelector('.now-playing');
  const KEY = '__PURPLE_INTERFACE_KEY__';
  const svg = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const element = (tag, className, html) => {
    const node = document.createElement(tag); node.className = className;
    if (html) node.innerHTML = html;
    return node;
  };
  const toggle = element('button', 'layout-switch text-button', `${svg('frame')}<span>Compact layout</span>`);
  toggle.id = 'layoutSwitch'; toggle.type = 'button';
  toggle.title = 'Switch layout while keeping current playback';
  document.querySelector('.top-right').prepend(toggle);
  const header = element('div', 'island-drawer-heading', '<span class="island-drawer-title">Her Wardrobe</span><div class="island-drawer-actions"></div>');
  header.querySelector('.island-drawer-title').textContent = window.PURPLE_PROJECT.wardrobeTitle;
  const close = element('button', 'icon-button', svg('close'));
  close.type = 'button'; close.setAttribute('aria-label', 'Collapse wardrobe');
  header.querySelector('div').append(close);
  wardrobe.prepend(header); wardrobe.id = 'wardrobePanel';
  const bar = element('div', 'island-bar');
  const opener = element('button', 'island-opener', `<img id="islandThumb" alt=""><span><strong id="islandName"></strong><small><span id="islandWardrobeHint">Expand wardrobe</span>${svg('chevron')}</small></span>`);
  opener.type = 'button'; opener.id = 'islandWardrobe';
  opener.setAttribute('aria-controls', wardrobe.id); opener.setAttribute('aria-expanded', 'false');
  const actions = element('div', 'island-actions');
  const favorite = element('button', 'icon-button island-favorite', svg('heart'));
  favorite.type = 'button'; favorite.id = 'islandFavorite';
  const shuffle = element('button', 'icon-button', svg('shuffle'));
  shuffle.type = 'button'; shuffle.id = 'islandShuffle';
  bar.append(opener, actions); footer.insertBefore(bar, document.querySelector('.playback'));
  const reply = element('p', 'island-reply'); reply.id = 'islandReply';
  reply.setAttribute('role', 'status'); reply.setAttribute('aria-live', 'polite');
  status.querySelector('div').append(reply);
  const settingsLayout = element('section', 'layout-preference', '<div class="setting-line"><label>Interface layout</label><output id="layoutValueLabel">Compact layout</output></div><div class="setting-options" id="layoutChoices"><button type="button" data-interface="normal">Classic layout</button><button type="button" data-interface="island">Compact layout</button></div>');
  $('settingsBody').querySelector('.panel-subtitle').after(settingsLayout);
  const positionNote = element('p', 'island-position-note', 'Compact layout is fixed in the bottom-right corner, with the wardrobe expanding upward. After switching back to classic layout, you can continue adjusting the position of the left column and playback bar.');
  $('layoutControls').after(positionNote);
  // Wallpaper hosts may forward clicks but not wheel/drag gestures. Keep page
  // navigation outside the scrolling content so every setting stays reachable.
  function installPager(container, scrollers, prefix, hint, enabled = () => true) {
    const pager = element('nav', 'overflow-pager', `<button id="${prefix}PageUp" type="button">${svg('chevron')}<span>Up</span></button><span id="${prefix}PageHint">${hint}</span><button id="${prefix}PageDown" type="button"><span>Down</span>${svg('chevron')}</button>`);
    pager.id = prefix + 'Pager'; pager.hidden = true;
    pager.setAttribute('aria-label', hint + ' pagination'); container.append(pager);
    let frame = 0;
    const active = () => scrollers.find(node => !node.hidden);
    function update() {
      if (!enabled()) { pager.hidden = true; return; }
      if (container.hidden) return;
      const scroller = active();
      const occupied = pager.hidden ? 0 : pager.getBoundingClientRect().height + parseFloat(getComputedStyle(pager).marginTop);
      // Compare with the space without the pager to avoid a visibility loop.
      pager.hidden = scroller.scrollHeight <= scroller.clientHeight + occupied + 1;
      if (pager.hidden) return;
      const atStart = scroller.scrollTop <= 1, atEnd = scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1;
      $(prefix + 'PageUp').disabled = atStart; $(prefix + 'PageDown').disabled = atEnd;
      for (const suffix of ['PageUp', 'PageDown']) $(prefix + suffix).setAttribute('aria-controls', scroller.id);
      $(prefix + 'PageHint').textContent = atEnd ? 'End of content' : atStart ? (scroller.id === 'helpBody' ? 'More information' : hint) : 'Click to turn page';
    }
    function queue() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    for (const [suffix, direction] of [['PageUp', -1], ['PageDown', 1]]) {
      $(prefix + suffix).addEventListener('click', () => {
        const scroller = active();
        scroller.scrollBy({top: direction * Math.max(60, scroller.clientHeight * .75), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
        queue();
      });
    }
    const resize = new ResizeObserver(queue), changes = new MutationObserver(queue);
    for (const node of scrollers) {
      node.addEventListener('scroll', queue, {passive:true}); resize.observe(node);
      changes.observe(node, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['hidden','open']});
    }
    changes.observe(container, {attributes:true, attributeFilter:['hidden']});
    for (const event of ['purple:typography-change', 'purple:layout-change', 'resize']) window.addEventListener(event, queue);
    return queue;
  }
  installPager($('settingsPanel'), [$('settingsBody'), $('helpBody')], 'settings', 'More settings');
  const wardrobeBody = document.querySelector('.wardrobe-content'); wardrobeBody.id = 'wardrobeBody';
  installPager(wardrobe, [wardrobeBody], 'wardrobe', 'More options', () => body.dataset.layout === 'island');
  const modeMenu = $('modeMenu'), modeBody = element('div', 'mode-scroll'); modeBody.id = 'modeBody';
  for (const node of [...modeMenu.children]) if (!node.matches('.mode-heading, .mode-order')) modeBody.append(node);
  modeMenu.append(modeBody);
  installPager(modeMenu, [modeBody], 'mode', 'More modes');
  const homes = new Map();
  function move(node, parent, before = null) {
    if (!homes.has(node)) { const anchor = document.createComment('normal-layout'); node.before(anchor); homes.set(node, anchor); }
    parent.insertBefore(node, before);
  }
  function restore(node) { const anchor = homes.get(node); if (anchor) anchor.after(node); }
  let layout = 'normal', frame = 0, openAfterPanel = false;
  function updateOpener() {
    const action = body.classList.contains('is-wardrobe-open') ? 'Collapse wardrobe' : 'Expand wardrobe';
    const hint = body.classList.contains('is-spinning') ? 'Choosing…' : action;
    if ($('islandWardrobeHint').textContent !== hint) $('islandWardrobeHint').textContent = hint;
    opener.setAttribute('aria-label', `${$('islandName').textContent}, ${action}`);
  }
  function setDrawer(open, focus = false) {
    const visible = layout === 'island' && open;
    if (body.classList.contains('is-wardrobe-open') !== visible) body.classList.toggle('is-wardrobe-open', visible);
    if (visible && !$('firstUseHint').hidden) $('closeFirstUse').click();
    opener.setAttribute('aria-expanded', String(layout === 'island' && open));
    updateOpener();
    wardrobe.inert = layout === 'island' && !open;
    if (focus) (open ? close : opener).focus({preventScroll:true});
    measure();
  }
  function measure() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (layout !== 'island') return;
      body.style.setProperty('--island-unit', Math.max(1, Math.min(1.5, innerWidth / 2560, innerHeight / 1440)) + 'px');
      const box = footer.getBoundingClientRect();
      body.style.setProperty('--island-height', box.height + 'px');
      body.style.setProperty('--island-menu-rise', (document.querySelector('.playback-mode').getBoundingClientRect().top - box.top + 14) + 'px');
      root.style.setProperty('--island-name-font', getComputedStyle($('lookName')).fontSize);
      root.style.setProperty('--island-note-font', getComputedStyle($('chapterName')).fontSize);
      root.style.setProperty('--island-control-font', getComputedStyle($('momentButton')).fontSize);
      root.style.setProperty('--island-dialogue-font', getComputedStyle($('statusText')).fontSize);
    });
  }
  function sync() {
    const state = window.purpleLayoutBridge.current();
    if ($('islandName').textContent !== state.name) $('islandName').textContent = state.name;
    const src = `images/thumb-${state.id}.jpg`;
    if ($('islandThumb').getAttribute('src') !== src) $('islandThumb').src = src;
    updateOpener();
    favorite.setAttribute('aria-pressed', String(state.favorite));
    favorite.setAttribute('aria-label', `${state.favorite ? 'Remove favorite' : 'Favorite'} ${state.name}`);
    favorite.title = favorite.getAttribute('aria-label');
    const hasPanel = body.classList.contains('has-panel');
    $('settingsButton').setAttribute('aria-expanded', String(!$('settingsPanel').hidden));
    favorite.disabled = hasPanel;
    shuffle.disabled = $('randomButton').disabled || hasPanel;
    opener.disabled = hasPanel;
    const choosing = body.classList.contains('is-spinning');
    shuffle.setAttribute('aria-busy', String(choosing));
    shuffle.setAttribute('aria-label', choosing ? 'Choosing an outfit' : $('randomButton').getAttribute('aria-label'));
    shuffle.title = shuffle.getAttribute('aria-label') || '';
    const showReply = layout === 'island' && $('toast').classList.contains('show') && $('toastSpeaker').textContent.startsWith('她说');
    body.classList.toggle('is-island-reply', showReply);
    if (reply.textContent !== $('toastText').textContent) reply.textContent = $('toastText').textContent;
    $('toast').classList.toggle('is-dialogue-toast', $('toastSpeaker').textContent.startsWith('她说'));
    const editing = state.phase === 'editing';
    toggle.disabled = editing;
    $('layoutChoices').querySelectorAll('button').forEach(button => { button.disabled = editing; });
    measure();
  }
  function apply(next, save = true) {
    if (!['normal', 'island'].includes(next) || window.purpleLayoutBridge.current().phase === 'editing') return;
    if (!$('modeMenu').hidden) $('modeButton').click();
    layout = next; body.dataset.layout = next;
    if (next === 'island') {
      move($('playButton'), actions);
      actions.append(favorite, shuffle);
      for (const id of ['soundButton', 'immerseButton', 'settingsButton']) move($(id), actions);
      move(toggle, header.querySelector('.island-drawer-actions'), close);
      move($('wardrobeOrder'), header.querySelector('.island-drawer-actions'), toggle);
      wardrobe.style.removeProperty('top'); wardrobe.style.removeProperty('bottom'); wardrobe.style.removeProperty('max-height');
      wardrobe.classList.remove('is-reading-constrained', 'is-wardrobe-compact');
    } else {
      for (const id of ['playButton', 'soundButton', 'immerseButton', 'settingsButton']) restore($(id));
      restore(toggle);
      restore($('wardrobeOrder'));
    }
    toggle.querySelector('span').textContent = next === 'island' ? 'Classic layout' : 'Compact layout';
    toggle.setAttribute('aria-label', `Switch to ${next === 'island' ? 'Classic layout' : 'Compact layout'}`);
    $('layoutValueLabel').textContent = next === 'island' ? 'Compact layout' : 'Classic layout';
    $('layoutChoices').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.interface === next)));
    // Show the wardrobe when entering this layout, including from Settings.
    // An open settings panel takes priority; reveal the wardrobe when it closes.
    openAfterPanel = next === 'island' && body.classList.contains('has-panel');
    setDrawer(next === 'island' && !openAfterPanel);
    window.dispatchEvent(new Event('purple:layout-change'));
    sync();
    if (save) { try { localStorage.setItem(KEY, next); } catch (_) {} }
  }
  toggle.addEventListener('click', () => apply(layout === 'island' ? 'normal' : 'island'));
  $('layoutChoices').addEventListener('click', event => { const button = event.target.closest('[data-interface]'); if (button) apply(button.dataset.interface); });
  opener.addEventListener('click', () => { setDrawer(!body.classList.contains('is-wardrobe-open')); sync(); });
  close.addEventListener('click', () => setDrawer(false, true));
  $('wakeButton').addEventListener('click', () => { if (layout === 'island') setDrawer(true); });
  favorite.addEventListener('click', () => { window.purpleLayoutBridge.favorite(); sync(); });
  shuffle.addEventListener('click', () => { $('randomButton').click(); sync(); });
  // Every existing button retains its listener; only its DOM position changes.
  for (const id of ['settingsButton', 'momentButton', 'modeButton']) $(id).addEventListener('click', () => setDrawer(false));
  document.addEventListener('pointerdown', event => {
    if (layout === 'island' && !event.target.closest('.wardrobe,.bottom-bar')) setDrawer(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && body.classList.contains('is-wardrobe-open')) { event.stopImmediatePropagation(); event.preventDefault(); setDrawer(false, true); }
  }, true);
  const observer = new MutationObserver(sync);
  for (const id of ['lookName', 'looks', 'randomButton', 'statusText', 'toast', 'modeLabel', 'momentPanel']) {
    observer.observe($(id), {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','hidden','disabled','aria-pressed']});
  }
  observer.observe($('settingsPanel'), {attributes:true, attributeFilter:['hidden']});
  new MutationObserver(() => {
    if (body.classList.contains('is-idle') || body.classList.contains('is-immersed')) {
      openAfterPanel = false; setDrawer(false);
    } else if (body.classList.contains('has-panel')) {
      setDrawer(false);
    } else if (openAfterPanel) {
      openAfterPanel = false; setDrawer(layout === 'island'); sync();
    }
  }).observe(body, {attributes:true, attributeFilter:['class']});
  new ResizeObserver(measure).observe(footer);
  window.addEventListener('purple:typography-change', measure);
  window.addEventListener('resize', measure);
  window.addEventListener('purple:reset-settings', () => apply('normal', false));
  let initial = 'normal';
  try { initial = localStorage.getItem(KEY) || initial; } catch (_) {}
  const requested = new URLSearchParams(location.search).get('layout');
  if (['normal', 'island'].includes(requested)) initial = requested;
  apply(initial);
})();
