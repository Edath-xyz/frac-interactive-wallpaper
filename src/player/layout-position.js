/* Self-contained optional layout feature; no writes to wardrobe/playback preferences. */
(() => {
  'use strict';
  const KEY = '__PURPLE_LAYOUT_KEY__';
  const $ = id => document.getElementById(id);
  const root = document.documentElement, body = document.body;
  const wardrobe = document.querySelector('.wardrobe');
  const status = document.querySelector('.now-playing');
  const range = $('layoutRange'), settings = $('settingsPanel');
  const playback = document.querySelector('.playback'), verticalRange = $('playbackPositionRange'), menu = $('modeMenu');
  const guide = document.createElement('div');
  guide.className = 'layout-guide'; guide.hidden = true;
  guide.setAttribute('aria-hidden', 'true');
  guide.innerHTML = '<span>Left-side interface alignment guide</span>';
  body.append(guide);
  let savedRatio = 0, draftRatio = 0, offset = 0, editing = false, resizeFrame = 0;
  let savedVertical = 0, draftVertical = 0, verticalOffset = 0;
  try {
    const record = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (Number.isFinite(record.playbackOffsetRatio)) savedVertical = Math.max(-.9, Math.min(.9, record.playbackOffsetRatio));
    const value = record.offsetRatio;
    if (Number.isFinite(value)) savedRatio = Math.max(-.25, Math.min(.25, value));
  } catch (_) {}
  const label = pixels => Math.abs(pixels) < 1 ? 'Default position' : `${pixels > 0 ? 'Move right' : 'Move left'} ${Math.abs(pixels)} px`;
  function bounds() {
    const width = root.clientWidth;
    const card = wardrobe.getBoundingClientRect();
    const brand = $('brand').getBoundingClientRect();
    const topRight = document.querySelector('.top-right').getBoundingClientRect();
    const playback = document.querySelector('.playback').getBoundingClientRect();
    const bottom = status.getBoundingClientRect();
    const baseLeft = card.left - offset, baseRight = card.right - offset;
    // A modest horizontal allowance keeps the column in the existing left composition.
    let max = Math.min(width * .12, Math.max(0, width * .52 - baseRight), topRight.left - (brand.right - offset) - 24);
    if (bottom.width) {
      const textWidth = Math.min(bottom.width, 15 + parseFloat(getComputedStyle(status.querySelector('p')).maxWidth));
      max = Math.min(max, playback.left - (bottom.left - offset + textWidth) - 24);
    }
    return {min:Math.min(0, Math.ceil(16 - baseLeft)), max:Math.max(0, Math.floor(max))};
  }
  const verticalLabel = pixels => Math.abs(pixels) < 1 ? 'Default position' : `${pixels > 0 ? 'Move down' : 'Move up'} ${Math.abs(pixels)} px`;
  function syncGuides() {
    const visible = !settings.hidden && !$('settingsBody').hidden && $('resetConfirm').hidden && $('personalizationOptions').open;
    guide.hidden = !visible;
    body.classList.toggle('is-layout-adjusting', visible);
  }
  function placeMenu() {
    if (menu.hidden) return;
    const anchor = document.querySelector('.playback-mode').getBoundingClientRect();
    const above = Math.max(0, anchor.top - 33), below = Math.max(0, root.clientHeight - anchor.bottom - 33);
    // Follow the controls, then choose the side with enough space. Overflow is
    // scrollable even at the largest text setting; the controls never jump.
    const desired = menu.scrollHeight + 2;
    const down = above < desired && below > above;
    menu.classList.toggle('is-below', down);
    menu.style.setProperty('--mode-menu-height', Math.floor(down ? below : above) + 'px');
  }
  function renderVertical() {
    const height = root.clientHeight, rect = playback.getBoundingClientRect();
    const top = rect.top - verticalOffset, bottom = rect.bottom - verticalOffset;
    // The title is the upper alignment stop, including its current text size.
    const titleTop = document.querySelector('#brand .brand-type').getBoundingClientRect().top;
    const min = Math.min(0, Math.ceil(Math.max(16, titleTop) - top));
    const max = Math.max(0, Math.floor(height - 16 - bottom));
    verticalOffset = Math.max(min, Math.min(max, Math.round((editing ? draftVertical : savedVertical) * height)));
    root.style.setProperty('--playback-offset', verticalOffset + 'px');
    verticalRange.min = min; verticalRange.max = max; verticalRange.value = verticalOffset;
    verticalRange.disabled = min === max;
    verticalRange.setAttribute('aria-valuetext', verticalLabel(verticalOffset));
    $('playbackPositionValue').textContent = verticalLabel(verticalOffset);
    $('playbackPositionUp').disabled = verticalOffset <= min;
    $('playbackPositionDown').disabled = verticalOffset >= max;
    placeMenu();
  }
  function render() {
    if (body.dataset.layout === 'island') { guide.hidden = true; body.classList.remove('is-layout-adjusting'); return; }
    syncGuides();
    const {min, max} = bounds();
    const requested = Math.round((editing ? draftRatio : savedRatio) * root.clientWidth);
    offset = Math.max(min, Math.min(max, requested));
    root.style.setProperty('--left-offset', offset + 'px');
    range.min = min; range.max = max; range.value = offset;
    range.disabled = min === max;
    range.setAttribute('aria-valuetext', label(offset));
    $('layoutValue').textContent = label(offset);
    renderVertical();
    $('layoutCancel').disabled = $('layoutDone').disabled = !editing;
    $('layoutLeft').disabled = offset <= min;
    $('layoutRight').disabled = offset >= max;
    $('layoutNote').textContent = max - min < 40
      ? 'The available space on the current screen is narrow, so the movable range has been reduced.'
      : 'Move the entire left column together to leave space for desktop icons.';
  }
  function finish(save, focus = true) {
    if (!editing) { syncGuides(); return; }
    if (save) {
      savedRatio = offset / root.clientWidth;
      savedVertical = verticalOffset / root.clientHeight;
      try { localStorage.setItem(KEY, JSON.stringify({offsetRatio:savedRatio, playbackOffsetRatio:savedVertical})); } catch (_) {}
    }
    editing = false;
    render();
    if (focus && !settings.hidden) range.focus({preventScroll:true});
  }
  function beginEditing() {
    if (editing) return;
    editing = true; draftRatio = savedRatio; draftVertical = savedVertical;
    syncGuides();
  }
  function preview(pixels) {
    beginEditing();
    draftRatio = pixels / root.clientWidth;
    render();
  }
  range.addEventListener('input', () => preview(Number(range.value)));
  $('layoutLeft').addEventListener('click', () => preview(offset - 8));
  $('layoutRight').addEventListener('click', () => preview(offset + 8));
  const previewVertical = pixels => { beginEditing(); draftVertical = pixels / root.clientHeight; render(); };
  verticalRange.addEventListener('input', () => previewVertical(Number(verticalRange.value)));
  $('playbackPositionUp').addEventListener('click', () => previewVertical(verticalOffset - 8));
  $('playbackPositionDown').addEventListener('click', () => previewVertical(verticalOffset + 8));
  $('layoutReset').addEventListener('click', () => { beginEditing(); draftVertical = 0; preview(0); });
  $('layoutCancel').addEventListener('click', () => finish(false));
  $('personalizationOptions').addEventListener('toggle', event => {
    if (!event.target.open) finish(false, false); else render();
  });
  $('layoutDone').addEventListener('click', () => finish(true));
  settings.addEventListener('keydown', event => {
    if (editing && event.key === 'Escape' && event.target.closest('#layoutControls')) {
      event.preventDefault(); event.stopPropagation(); finish(false);
    }
  });
  new MutationObserver(() => { if (settings.hidden) finish(false, false); }).observe(settings, {attributes:true, attributeFilter:['hidden']});
  const guideObserver = new MutationObserver(syncGuides);
  for (const element of [settings, $('settingsBody'), $('resetConfirm'), $('personalizationOptions')]) {
    guideObserver.observe(element, {attributes:true, attributeFilter:['hidden', 'open']});
  }
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(render);
  });
  window.addEventListener('purple:typography-change', render);
  window.addEventListener('purple:layout-change', render);
  window.addEventListener('purple:playback-layout', placeMenu);
  window.addEventListener('purple:reset-prompt', () => finish(false, false));
  window.addEventListener('purple:help-open', () => finish(false, false));
  window.addEventListener('purple:reset-settings', () => {
    savedRatio = draftRatio = savedVertical = draftVertical = 0;
    finish(false, false); render();
  });
  render();
})();
