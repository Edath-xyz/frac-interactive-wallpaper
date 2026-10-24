/* Typography preferences are independent of media, favorites and layout position. */
(() => {
  'use strict';
  const KEY = '__PURPLE_READING_KEY__';
  const body = document.body, wardrobe = document.querySelector('.wardrobe');
  const footer = document.querySelector('.bottom-bar');
  const status = document.querySelector('.now-playing'), credit = document.querySelector('.credit');
  const statusContent = status.querySelector('div'), statusText = status.querySelector('p');
  const immersion = document.querySelector('#immerseButton span');
  const wake = document.getElementById('wakeButton'), wakeText = wake.querySelector('span:not(.wake-line)');
  const root = document.documentElement;
  const choices = ['standard', 'comfortable', 'larger', 'large'];
  let size = 'standard', frame = 0;
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}').size;
    if (choices.includes(value)) size = value;
  } catch (_) {}
  function setLength(name, value) {
    const previous = parseFloat(root.style.getPropertyValue(name));
    if (!Number.isFinite(previous) || Math.abs(previous - value) > .05) root.style.setProperty(name, value + 'px');
  }
  function alignFooter() {
    if (getComputedStyle(status).display !== 'none') {
      // Keep the footer's original single-line geometry. Longer dialogue can grow
      // upward inside its own slot without lifting the playback/immersion controls.
      const lineHeight = parseFloat(getComputedStyle(statusText).lineHeight);
      setLength('--companion-height', statusContent.getBoundingClientRect().height - statusText.getBoundingClientRect().height + lineHeight);
    }
    const textRect = element => {
      const range = document.createRange(); range.selectNodeContents(element);
      return range.getBoundingClientRect();
    };
    const textBottom = element => textRect(element).bottom;
    // Match the real immersion control across font sizes and wrapped footers.
    // Its parent may be mid-hide; remove that animation's translation first.
    const footerShift = footer.getBoundingClientRect().bottom - (innerHeight - parseFloat(getComputedStyle(footer).bottom));
    const button = immersion.closest('button'), box = button.getBoundingClientRect(), style = getComputedStyle(button);
    setLength('--wake-right', innerWidth - box.right);
    setLength('--wake-bottom', innerHeight - box.bottom + footerShift);
    setLength('--wake-font-size', parseFloat(style.fontSize));
    setLength('--wake-letter-spacing', parseFloat(style.letterSpacing) || 0);
    wake.classList.remove('is-edge-tight');
    if (getComputedStyle(immersion).display !== 'none') {
      // Align the final two characters with the immersion label.
      // Keep the optional trailing arrow inside the viewport at large text sizes.
      const textRight = immersion.getBoundingClientRect().right;
      const trailingWidth = () => wake.getBoundingClientRect().right - wakeText.getBoundingClientRect().right;
      if (textRight + trailingWidth() > innerWidth - 8) wake.classList.add('is-edge-tight');
      setLength('--wake-right', innerWidth - textRight - trailingWidth());
      setLength('--wake-bottom', innerHeight - textBottom(immersion) + footerShift + textBottom(wakeText) - wake.getBoundingClientRect().bottom);
    }
    // Anchor the classic-layout credit under the right-hand label, independently of the left column.
    // Narrow layouts hide that label; use the remaining button as the anchor there.
    const anchor = getComputedStyle(immersion).display === 'none' ? box : textRect(immersion);
    const target = anchor.bottom - footerShift;
    const creditBox = credit.getBoundingClientRect(), creditText = textRect(credit);
    const gap = Math.max(12, parseFloat(getComputedStyle(credit).fontSize) * 4 / 3);
    const creditBottom = parseFloat(getComputedStyle(credit).bottom);
    setLength('--creator-right', innerWidth - anchor.right - (creditBox.right - creditText.right));
    setLength('--creator-bottom', creditBottom + creditText.top - target - gap);
    if (getComputedStyle(status).display === 'none') {
      root.style.removeProperty('--companion-top');
      return;
    }
    // Align the last dialogue line with immersion without moving the footer controls.
    const currentTop = parseFloat(getComputedStyle(status).top) || 0;
    const naturalBottom = textBottom(statusText) - footerShift - currentTop;
    setLength('--companion-top', target - naturalBottom);
  }
  function fitWardrobe() {
    if (body.dataset.layout === 'island') return;
    alignFooter();
    wardrobe.style.removeProperty('top'); wardrobe.style.removeProperty('bottom');
    wardrobe.style.removeProperty('max-height'); wardrobe.classList.remove('is-reading-constrained', 'is-wardrobe-compact');
    let box = wardrobe.getBoundingClientRect();
    const top = document.querySelector('.topbar').getBoundingClientRect().bottom + 24;
    const footerShift = footer.getBoundingClientRect().bottom - (innerHeight - parseFloat(getComputedStyle(footer).bottom));
    // Reserve two dialogue lines even for a short sentence, so changing wardrobes
    // or replies cannot toggle the wardrobe's position/compact layout. Longer
    // content still receives enough space instead of being clipped.
    const spareLine = Math.max(0, 2 * parseFloat(getComputedStyle(statusText).lineHeight) - statusText.getBoundingClientRect().height);
    const footerTop = (getComputedStyle(status).display === 'none' ? footer.getBoundingClientRect().top : statusContent.getBoundingClientRect().top - spareLine) - footerShift;
    const bottom = footerTop - 28;
    if (box.height > bottom - top) {
      wardrobe.classList.add('is-wardrobe-compact');
      box = wardrobe.getBoundingClientRect();
    }
    if (box.top < top || box.bottom > bottom) {
      const y = Math.max(top, Math.min(box.top, bottom - box.height));
      wardrobe.style.top = (y - parseFloat(getComputedStyle(wardrobe).marginTop)) + 'px'; wardrobe.style.bottom = 'auto';
      if (box.height > bottom - y) {
        wardrobe.style.maxHeight = Math.max(100, bottom - y) + 'px';
        wardrobe.classList.add('is-reading-constrained');
      }
    }
    if (!wardrobe.classList.contains('is-reading-constrained')) wardrobe.scrollTop = 0;
  }
  function scheduleFit() { cancelAnimationFrame(frame); frame = requestAnimationFrame(fitWardrobe); }
  function apply() {
    body.dataset.textSize = size;
    const screenRatio = Math.min(innerWidth / 2560, innerHeight / 1440);
    const landscape = innerWidth / innerHeight >= 4 / 3;
    const compact = landscape && innerHeight > 850 ? Math.max(0, Math.min(1, (1 - screenRatio) / .25)) : 0;
    const highResolution = landscape ? Math.max(0, Math.min(1, (screenRatio - 1) / .5)) : 0;
    wardrobe.style.setProperty('--wardrobe-composition-scale', 1 - .05 * compact + .08 * highResolution);
    wardrobe.style.setProperty('--wardrobe-lift', (18 * compact) + 'px');
    // QHD cover/name proportion, plus the final approved 10% increase at 4K.
    wardrobe.style.setProperty('--wardrobe-name-factor', 1 - (1 - 1.15 * 1.1 / 1.8) * highResolution);
    const beyondQHD = Math.min(innerWidth / 2560, innerHeight / 1440) > 1;
    body.classList.toggle('is-reading-gentle', size === 'comfortable' || (size === 'standard' && beyondQHD));
    body.classList.toggle('is-reading-enlarged', size === 'larger' || size === 'large');
    document.querySelectorAll('[data-text-size]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.textSize === size));
    });
    scheduleFit();
    window.dispatchEvent(new Event('purple:typography-change'));
  }
  document.getElementById('textSizeOptions').addEventListener('click', event => {
    const button = event.target.closest('[data-text-size]');
    if (!button || !choices.includes(button.dataset.textSize)) return;
    size = button.dataset.textSize;
    try { localStorage.setItem(KEY, JSON.stringify({size})); } catch (_) {}
    apply();
    button.scrollIntoView({block:'nearest', behavior:'instant'});
  });
  window.addEventListener('resize', apply);
  window.addEventListener('purple:layout-change', scheduleFit);
  window.addEventListener('purple:reset-settings', () => { size = 'standard'; apply(); });
  const observer = new ResizeObserver(scheduleFit);
  [wardrobe, status, statusContent, credit, footer, document.querySelector('.topbar')].forEach(element => observer.observe(element));
  document.fonts.ready.then(scheduleFit);
  apply();
})();
