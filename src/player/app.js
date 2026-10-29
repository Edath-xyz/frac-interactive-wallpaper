/* PURPLE DIY player. Content is compiled by tools/project.py; keep playback scheduling here. */
'use strict';
(() => {
  const LOOKS = window.PURPLE_LOOKS;
  const REPLIES = window.PURPLE_REPLIES || {};
  const WARDROBE_DIALOGUES = window.PURPLE_WARDROBE_DIALOGUES || {};
  const AVAILABLE = LOOKS.map((_, i) => i).filter(i => !LOOKS[i].locked);
  const isPlayable = i => Number.isInteger(i) && AVAILABLE.includes(i);
  // Resolve display chapters without moving the saved catalog indices.
  const indices = ids => ids.map(id => LOOKS.findIndex(look => look.id === id));
  // Build injects the ID-based display data; saved catalog indices stay unchanged.
  const WARDROBES = __PURPLE_WARDROBES__.map(group => ({
    ...group, defaultLook: indices([group.defaultLook])[0],
    chapters: group.chapters.map(chapter => ({...chapter, looks: indices(chapter.looks)}))
  }));
  // Keep relative order within each availability group; closed cards always
  // follow every playable card, even when new outfits are appended later.
  // Only display chapters change, never catalog indices or saved preferences.
  for (const group of WARDROBES) {
    const chapters = group.chapters;
    const listed = chapters.flatMap(chapter => chapter.looks);
    const ordered = [...listed.filter(isPlayable), ...listed.filter(i => !isPlayable(i))];
    group.baseOrder = ordered;
    group.chapterNames = chapters.map(chapter => chapter.name);
    group.chapters = Array.from({length: Math.ceil(ordered.length / 4)}, (_, page) => ({
      name: chapters[page].name, looks: ordered.slice(page * 4, page * 4 + 4)
    }));
  }
  const wardrobeFor = index => WARDROBES.find(group => group.chapters.some(chapter => chapter.looks.includes(index))) || WARDROBES[0];
  const orderFor = group => group.chapters.flatMap(chapter => chapter.looks);
  const displayNumber = index => String(wardrobeFor(index).baseOrder.indexOf(index) + 1).padStart(2, '0');
  const pageFor = i => wardrobeFor(i).chapters.findIndex(chapter => chapter.looks.includes(i));
  function arrangeWardrobe(group) {
    const reversed = prefs.wardrobeOrders[group.id] === 'reverse';
    const open = group.baseOrder.filter(isPlayable);
    const ordered = [...(reversed ? open.reverse() : open), ...group.baseOrder.filter(i => !isPlayable(i))];
    group.chapters = Array.from({length: Math.ceil(ordered.length / 4)}, (_, page) => ({
      name: reversed ? 'Browse Freely' : group.chapterNames[page], looks: ordered.slice(page * 4, page * 4 + 4)
    }));
  }
  const $ = id => document.getElementById(id);
  let video = $('film');
  let spare = $('filmNext');
  const decks = [video, spare];
  const body = document.body;
  const root = document.documentElement;
  // Keep the historic storage identity so existing favorites and frames survive a rename.
  const KEY = '__PURPLE_PREFS_KEY__';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const number = (value, fallback, lo, hi) => Number.isFinite(Number(value)) ? clamp(Number(value), lo, hi) : fallback;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
  const hadSavedPreferences = Object.keys(saved).length > 0;
  const VIDEO_QUALITIES = __VIDEO_QUALITIES__;
  const CATALOG_REVISION = 1;
  const FREEZE_REVISION = 1;
  // Map every index-based preference through stable IDs before reading it.
  // Removing or reordering content cannot move another look's favorite/frame.
  const catalogIds = LOOKS.map(look => look.id);
  if (Array.isArray(saved.catalogIds)) {
    const oldIds = saved.catalogIds;
    const remap = index => Number.isInteger(index) ? catalogIds.indexOf(oldIds[index]) : -1;
    saved = {...saved, current: remap(saved.current),
      favorites: Array.isArray(saved.favorites) ? saved.favorites.map(remap).filter(i => i >= 0) : [],
      freezes: catalogIds.map(id => saved.freezes?.[oldIds.indexOf(id)]),
      wardrobeLooks: Object.fromEntries(Object.entries(saved.wardrobeLooks || {}).map(([id,index]) => [id,remap(index)]))};
  }
  const localPlaybackModes = ['freeze', 'companion', 'single', 'all', 'favorites'];
  const playbackModes = [...localPlaybackModes, 'global-all', 'global-favorites'];
  const globalMode = (mode = prefs.playbackMode) => mode === 'global-all' || mode === 'global-favorites';
  const favoritesMode = () => ['favorites', 'global-favorites'].includes(prefs.playbackMode);
  const globalOrder = () => WARDROBES.flatMap(orderFor).filter(isPlayable);
  const defaults = {
    current: __DEFAULT_INDEX__, catalogIds, favorites: [], freezes: LOOKS.map((look, index) => isPlayable(index) ? look.freeze : null),
    defaultFrames: Object.fromEntries(LOOKS.map(look => [look.id, look.freeze])),
    catalogRevision: CATALOG_REVISION, freezeRevision: FREEZE_REVISION, sound: __DEFAULT_SOUND__, volume: __DEFAULT_VOLUME__, brightness: 100,
    autoHide: true, immersed: false, startupInterface: 'remember', edgeLight: false, edgeLightRevision: 1, quality: '__DEFAULT_QUALITY__', fit: 'contain', interval: 0, intervalMode: 'preset', customInterval: .5, customIntervalUnit: 'seconds', playbackMode: 'freeze',
    wardrobeLooks: Object.fromEntries(WARDROBES.map(group => [group.id, group.defaultLook])),
    wardrobeModes: Object.fromEntries(WARDROBES.map(group => [group.id, 'freeze'])),
    playbackOrder: 'sequence',
    wardrobeOrders: Object.fromEntries(WARDROBES.map(group => [group.id, 'forward'])),
    wardrobeRandomScopes: Object.fromEntries(WARDROBES.map(group => [group.id, 'all'])),
    welcomeSeen: true
  };
  function initialFreeze(look, index) {
    if (!isPlayable(index)) return null;
    const stored = saved.freezes?.[index];
    if (stored == null) return look.freeze;
    // A replacement's new recommendation updates an unchanged old default;
    // an explicitly chosen custom frame remains bounded to the new clip.
    if (Number.isFinite(saved.defaultFrames?.[look.id]) && Math.abs(Number(stored) - saved.defaultFrames[look.id]) < .008) return look.freeze;
    return number(stored, look.freeze, .1, look.duration - .05);
  }
  const savedInterval = normalizeAutoInterval(saved.interval);
  const savedIntervalMode = savedInterval && (saved.intervalMode === 'custom' || !isPresetInterval(savedInterval)) ? 'custom' : 'preset';
  const migratedPreset = savedIntervalMode === 'custom' && saved.intervalMode !== 'custom';
  const savedCustomInterval = migratedPreset ? savedInterval : normalizeAutoInterval(saved.customInterval, savedIntervalMode === 'custom' ? savedInterval : defaults.customInterval);
  const savedCustomUnit = !migratedPreset && ['seconds', 'minutes'].includes(saved.customIntervalUnit)
    ? saved.customIntervalUnit : intervalUnit(savedCustomInterval);
  const prefs = {
    current: isPlayable(saved.current) ? saved.current : LOOKS[saved.current] ? wardrobeFor(saved.current).defaultLook : defaults.current,
    favorites: Array.isArray(saved.favorites) ? [...new Set(saved.favorites.filter(isPlayable))] : [],
    freezes: LOOKS.map(initialFreeze),
    wardrobeLooks: Object.fromEntries(WARDROBES.map(group => {
      const value = saved.wardrobeLooks?.[group.id];
      return [group.id, isPlayable(value) && wardrobeFor(value) === group ? value : group.defaultLook];
    })),
    // Migrate the old shared mode once. Each wardrobe then keeps its own choice.
    wardrobeModes: Object.fromEntries(WARDROBES.map(group => {
      const value = saved.wardrobeModes?.[group.id] ?? saved.playbackMode;
      return [group.id, localPlaybackModes.includes(value) ? value : 'freeze'];
    })),
    wardrobeRandomScopes: Object.fromEntries(WARDROBES.map(group => {
      const value = saved.wardrobeRandomScopes?.[group.id];
      // Existing users keep their former favorites-only random pool on upgrade.
      const hasFavorites = Array.isArray(saved.favorites) && saved.favorites.some(i => isPlayable(i) && wardrobeFor(i) === group);
      return [group.id, value === 'favorites' || (hasFavorites && value == null) ? 'favorites' : 'all'];
    })),
    // Existing users already know the interface. Only a genuinely new visit gets the hint.
    welcomeSeen: saved.welcomeSeen === true || (saved.welcomeSeen == null && Number.isInteger(saved.current) && Boolean(LOOKS[saved.current])),
    catalogRevision: CATALOG_REVISION,
    freezeRevision: FREEZE_REVISION,
    sound: typeof saved.sound === 'boolean' ? saved.sound : defaults.sound,
    volume: number(saved.volume, defaults.volume, 0, 100),
    brightness: number(saved.brightness, defaults.brightness, 65, 115),
    autoHide: saved.autoHide !== false,
    immersed: saved.immersed === true,
    startupInterface: ['remember', 'immersed', 'visible'].includes(saved.startupInterface) ? saved.startupInterface : 'remember',
    // Adopt the quieter default once, then remember any explicit choice.
    edgeLight: saved.edgeLightRevision === 1 && saved.edgeLight === true,
    edgeLightRevision: 1,
    // Existing installations keep their original media until the user chooses.
    quality: VIDEO_QUALITIES.includes(saved.quality) ? saved.quality : hadSavedPreferences ? 'original' : defaults.quality,
    fit: saved.fit === 'cover' ? 'cover' : 'contain',
    interval: savedInterval,
    intervalMode: savedIntervalMode,
    customInterval: savedCustomInterval,
    customIntervalUnit: savedCustomUnit === 'minutes' && !Number.isInteger(savedCustomInterval) ? 'seconds' : savedCustomUnit,
    playbackMode: playbackModes.includes(saved.playbackMode) ? saved.playbackMode : 'freeze',
    playbackOrder: saved.playbackOrder === 'shuffle' ? 'shuffle' : 'sequence',
    wardrobeOrders: Object.fromEntries(WARDROBES.map(group => [group.id,
      saved.wardrobeOrders?.[group.id] === 'reverse' ? 'reverse' : 'forward'])),
    nativeValues: saved.nativeValues && typeof saved.nativeValues === 'object' ? saved.nativeValues : {}
  };
  // The inline bootstrap applies the same policy before any interface is parsed.
  body.classList.toggle('is-immersed', prefs.startupInterface === 'immersed' ||
    (prefs.startupInterface === 'remember' && prefs.immersed));
  prefs.immersed = body.classList.contains('is-immersed');
  let current = prefs.current;
  WARDROBES.forEach(arrangeWardrobe);
  let wardrobe = wardrobeFor(current);
  let CHAPTERS = wardrobe.chapters;
  prefs.playbackMode = globalMode()
    ? prefs.playbackMode === 'global-favorites' && !prefs.favorites.length ? 'freeze' : prefs.playbackMode
    : effectiveWardrobeMode(wardrobe);
  if (prefs.playbackMode === 'companion' && !LOOKS[current].companion) prefs.playbackMode = 'freeze';
  let page = pageFor(current);
  const browsePages = Object.fromEntries(WARDROBES.map(group => [group.id, 0]));
  let dialogue = window.createPurpleDialogue({looks: LOOKS, replies: REPLIES, affection: window.PURPLE_AFFECTION, wardrobes: WARDROBE_DIALOGUES, isPlayable, storage: localStorage, storageKey: KEY + '.companion-dialogue-v1'});
  let privateVisits = 0;
  let lastPrivateReply = -Infinity;
  let lastPrivateAside = -Infinity;
  let baseStatus = { label: '', text: '' };
  let phase = 'held'; // held | loading | playing | paused | transition | editing | error
  let systemPaused = false;
  let documentPaused = document.hidden;
  let operation = 0;
  let automaticOperation = -1;
  const isAutomaticOperation = () => automaticOperation === operation;
  let controller = null;
  let loadedLook = -1;
  let frameWatcher = null;
  let selectionWarm = null;
  let spinId = 0;
  let spinning = false;
  let bag = [];
  let idleTimer, toastTimer, loadingTimer, replyTimer, welcomeTimer;
  let lastChange = Date.now();
  let lastActivity = 0;
  let panel = null;
  let panelReturnFocus = null;
  let editorOriginal = null;
  let audioContext;
  let pendingEntry = null;
  let modeOpen = false;
  let transition = null;
  let prefetch = null;
  let immersionRequest = 0;

  function persist() {
    prefs.catalogIds = catalogIds;
    prefs.defaultFrames = defaults.defaultFrames;
    prefs.current = current;
    prefs.wardrobeLooks[wardrobeFor(current).id] = current;
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) {}
  }
  function icon(button, name) { button.querySelector('use').setAttribute('href', '#i-' + name); }
  function line(index, event) {
    if (LOOKS[index].silent) return '';
    if (event === 'held') return dialogue.held(index, {time: phase === 'held' ? freezeTime() : video.currentTime});
    if (event === 'enter') return dialogue.enter(index);
    return dialogue.reply(index, event, {time: index === current ? phase === 'held' ? freezeTime() : video.currentTime : Infinity}).text;
  }
  function fixedLine(key, fallback) {
    return WARDROBE_DIALOGUES[wardrobeFor(current).id]?.fixed?.[key] ?? fallback;
  }
  function confirmDialogueVisible(text) {
    requestAnimationFrame(() => {
      const inToast = $('toast').classList.contains('show') && $('toastText').textContent === text;
      const inStatus = !body.classList.contains('is-idle') && !body.classList.contains('is-immersed') && $('statusText').getClientRects().length && $('statusText').textContent === text;
      if (!document.hidden && !suspended() && (inToast || inStatus)) dialogue.shown(text);
      else dialogue.discardReply(text);
    });
  }
  function toast(text, speaker = '__CHARACTER_NAME__说') {
    if (!text) return;
    companionReplyUntil = performance.now() + 6500;
    $('toastSpeaker').textContent = speaker;
    $('toastText').textContent = text;
    $('toast').classList.add('show');
    confirmDialogueVisible(text);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4000);
  }
  function writeStatus(label, text, {background = false} = {}) {
    companionReplyUntil = performance.now() + 6500;
    $('statusLabel').textContent = label;
    $('statusText').textContent = text;
    if (background) dialogue.advanceCompanion(text);
    else confirmDialogueVisible(text);
  }
  function setStatus(label, text, options) {
    if (LOOKS[current].silent && !text) { label = wardrobeFor(current).english; text = LOOKS[current].name; }
    clearTimeout(replyTimer);
    baseStatus = { label, text };
    writeStatus(label, text, options);
  }
  function respond(index, event, label = 'HERE, WITH YOU.', central = true) {
    if (LOOKS[index].silent) return '';
    const words = line(index, event);
    if (central) toast(words, !isPlayable(index) ? '__CHARACTER_NAME__说 · 衣橱手记' : '__CHARACTER_NAME__说 · ' + LOOKS[index].short);
    if (index === current || !isPlayable(index)) {
      clearTimeout(replyTimer);
      writeStatus(label, words);
      const token = operation;
      replyTimer = setTimeout(() => {
        if (token === operation) writeStatus(baseStatus.label, baseStatus.text);
      }, 6500);
    }
    return words;
  }
  /* @PURPLE_SAFE_LOCKED_TAP */
  function activeOrder() { return orderFor(wardrobe); }
  function activeAvailable() { return activeOrder().filter(isPlayable); }
  function activeFavorites() { return activeAvailable().filter(i => prefs.favorites.includes(i)); }
  function randomFavoritesOnly(group = wardrobe) { return prefs.wardrobeRandomScopes[group.id] === 'favorites' && (companionMode() || orderFor(group).some(i => isPlayable(i) && prefs.favorites.includes(i))); }
  function randomPool(group = wardrobe) { return orderFor(group).filter(i => isPlayable(i) && (!randomFavoritesOnly(group) || prefs.favorites.includes(i))); }
  function closeWelcome() { clearTimeout(welcomeTimer); $('firstUseHint').hidden = true; }
  function showWelcome(title = '从这里开始') {
    closeWelcome();
    $('firstUseHint').querySelector('strong').textContent = title;
    $('firstUseHint').hidden = false;
    const deadline = performance.now() + 10000;
    const tick = () => {
      const remaining = deadline - performance.now();
      if (remaining <= 0) { closeWelcome(); return; }
      $('closeFirstUse').textContent = `知道了（${Math.ceil(remaining / 1000)}s）`;
      welcomeTimer = setTimeout(tick, Math.min(1000, remaining));
    };
    tick();
    if (!prefs.welcomeSeen) { prefs.welcomeSeen = true; persist(); }
  }
  function effectiveWardrobeMode(group) {
    const mode = prefs.wardrobeModes[group.id];
    return mode === 'favorites' && !prefs.favorites.some(i => wardrobeFor(i) === group) ? 'freeze' : mode;
  }
  function adoptWardrobe(index) {
    const next = wardrobeFor(index);
    if (next !== wardrobe) {
      browsePages[wardrobe.id] = page;
      wardrobe = next; CHAPTERS = next.chapters; page = pageFor(index); bag = [];
    }
    document.querySelector('.wardrobe').dataset.collection = wardrobe.id;
    body.dataset.wardrobe = wardrobe.id;
    $('curtain').style.backgroundImage = `url("images/${wardrobeFor(current).empty}")`;
    document.querySelectorAll('#wardrobeTabs [data-wardrobe]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wardrobe === wardrobe.id)));
    window.dispatchEvent(new Event('purple:typography-change'));
  }
  function selectWardrobe(id) {
    const next = WARDROBES.find(group => group.id === id);
    if (!next || next === wardrobe || phase === 'editing') return;
    cancelSpin();
    adoptWardrobe(next.defaultLook);
    page = Math.min(browsePages[next.id], CHAPTERS.length - 1);
    renderCards(true); activity(true);
  }
  function toggleWardrobeOrder() {
    if (phase === 'editing') return;
    cancelSpin();
    prefs.wardrobeOrders[wardrobe.id] = prefs.wardrobeOrders[wardrobe.id] === 'reverse' ? 'forward' : 'reverse';
    arrangeWardrobe(wardrobe);
    CHAPTERS = wardrobe.chapters; page = 0; browsePages[wardrobe.id] = 0;
    // A visible handoff finishes its chosen target. Refresh only a hidden
    // sequential preload; random rounds and companion loops retain their queue.
    if (carouselMode() && !shuffleCarousel() && (globalMode() || wardrobe === wardrobeFor(current)) && ['playing', 'paused'].includes(phase)) {
      releaseSpare(); primeLoop();
    }
    persist(); renderCards(true); activity(true);
  }
  function renderCards(animate = false) {
    const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const reversed = prefs.wardrobeOrders[wardrobe.id] === 'reverse';
    $('wardrobeOrder').setAttribute('aria-pressed', String(reversed));
    $('wardrobeOrder').setAttribute('aria-label', `${wardrobe.name}排列：${reversed ? '倒序' : '正序'}，点击切换为${reversed ? '正序' : '倒序'}`);
    $('wardrobeOrder').title = `${reversed ? '倒序' : '正序'}排列 · 点击切换，未开放始终置底`;
    $('wardrobeOrderLabel').textContent = reversed ? '倒序' : '正序';
    $('looks').innerHTML = CHAPTERS[page].looks.map(i => {
      const look = {...LOOKS[i], name: escapeHTML(LOOKS[i].name), short: escapeHTML(LOOKS[i].short)};
      const locked = !isPlayable(i);
      const thumb = `thumb-${look.id}`;
      const companionCover = !locked && look.companion ? '<span class="companion-art" aria-hidden="true"><span class="companion-seal"><svg viewBox="0 0 24 12"><path d="M12 6C9 1 6 1 4 2S1 5 2 8s5 3 8-1l4-3c3-4 7-3 8 0s-1 6-4 6-5-3-6-4Z"/></svg></span><span class="companion-sign">Dynamic Companion</span></span>' : '';
      return `<div class="look-card${companionCover ? ' companion-card' : ''}${locked ? ' is-locked' + (look.blurLocked ? ' blur-cover' : '') : ''}" data-look="${i}"><button class="look-select" data-select="${i}" ${companionCover ? 'aria-description="Click to automatically enable Dynamic Companion"' : ''} aria-label="${locked ? look.name + '，私藏，未开放' : '选择' + look.name + '，播放入场'}" ${locked ? 'aria-disabled="true"' : 'aria-pressed="false"'}><div class="look-image"><img src="images/${thumb}.jpg" alt="${look.name}${locked ? '模糊封面' : '穿搭封面'}" draggable="false"><span class="look-index">${displayNumber(i)}</span>${locked ? '<span class="lock-veil"><svg><use href="#i-lock"/></svg><span>' + '未开放' + '</span></span>' : '<span class="look-check"><svg><use href="#i-check"/></svg></span>'}${companionCover}</div></button><div class="look-bottom"><span class="look-short">${look.short}</span>${locked ? '' : '<button class="favorite-button" data-favorite="' + i + '" aria-label="偏爱' + look.name + '" aria-pressed="false"><svg><use href="#i-heart"/></svg></button>'}</div></div>`;
    }).join('');
    $('chapterName').textContent = CHAPTERS[page].name;
    $('pageTabs').innerHTML = CHAPTERS.map((chapter, i) => `<button data-page="${i}" aria-label="第 ${i + 1} 页，${escapeHTML(chapter.name)}">${String(i + 1).padStart(2, '0')}</button>`).join('');
    document.querySelectorAll('[data-page]').forEach(button => {
      if (Number(button.dataset.page) === page) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (animate) {
      $('looks').classList.remove('page-enter'); void $('looks').offsetWidth;
      $('looks').classList.add('page-enter');
    }
    updateCards();
  }
  function setPage(next, manual = true, wakeInterface = true) {
    if (manual) cancelSpin();
    page = (next + CHAPTERS.length) % CHAPTERS.length;
    browsePages[wardrobe.id] = page;
    renderCards(wakeInterface);
    if (wakeInterface) activity(true);
  }
  function freezeTime() { return prefs.freezes[current]; }
  function suspended() { return systemPaused || documentPaused; }
  function readyControls(disabled) {
    $('playButton').disabled = disabled;
    $('momentButton').disabled = disabled || phase === 'transition';
    $('modeButton').disabled = phase === 'editing';
    $('settingsButton').disabled = phase === 'editing';
    $('wardrobeOrder').disabled = phase === 'editing';
    renderTransport();
  }
  function updateProgress(t) {
    // The video watcher still checks every decoded frame, but hidden controls
    // need no text replacement or layout work. Wake refreshes them immediately.
    if (body.classList.contains('is-idle') || body.classList.contains('is-immersed')) return;
    const label = t.toFixed(2), width = clamp(t / LOOKS[current].duration * 100, 0, 100) + '%';
    if ($('timeLabel').textContent !== label) $('timeLabel').textContent = label;
    if ($('timelineFill').style.width !== width) $('timelineFill').style.width = width;
  }
  function updateCards() {
    document.querySelectorAll('.look-card').forEach(card => {
      const i = Number(card.dataset.look);
      if (!isPlayable(i)) return;
      card.classList.toggle('active', i === current);
      card.querySelector('.look-select').setAttribute('aria-pressed', String(i === current));
      card.querySelector('.favorite-button').setAttribute('aria-pressed', String(prefs.favorites.includes(i)));
      card.querySelector('.favorite-button').setAttribute('aria-label', `${prefs.favorites.includes(i) ? 'Remove Favorite' : 'Favorite'}${LOOKS[i].name}`);
    });
    $('lookName').textContent = LOOKS[current].name;
    $('lookEnglish').textContent = LOOKS[current].english || wardrobeFor(current).english;
    $('lookNumber').textContent = displayNumber(current);
    const away = wardrobe !== wardrobeFor(current) || page !== pageFor(current);
    $('showCurrent').hidden = !away;
    $('selectionState').textContent = phase === 'held' ? 'Current Freeze Frame' : 'Current Outfit';
    updateRandomLabel();
    renderPlaybackMode();
  }
  function updateRandomLabel() {
    const count = activeFavorites().length;
    const favoritesOnly = randomFavoritesOnly();
    if (!spinning) $('randomText').textContent = favoritesOnly ? 'Pick from Favorites' : 'Let Fate Decide';
    $('randomHint').textContent = favoritesOnly && count === 1 ? 'Only 1 Outfit' : 'Random Outfit';
    $('randomButton').setAttribute('aria-label', favoritesOnly ? count === 1 ? 'Only one favorite in this wardrobe: ' + LOOKS[activeFavorites()[0]].name : `Randomly choose from this wardrobe's ${count} favorites` : 'Randomly choose an available outfit from the current wardrobe');
    $('randomScope').textContent = favoritesOnly ? count === 1 ? 'Only 1 favorite in this wardrobe · Tap hearts to add more' : `Only ${count} favorites in this wardrobe · No consecutive repeats` : `${wardrobe.name} · ${activeAvailable().length} outfits · No consecutive repeats`;
    $('randomFavoriteCount').textContent = count;
    document.querySelectorAll('[data-random-scope]').forEach(button => {
      const favorites = button.dataset.randomScope === 'favorites';
      button.setAttribute('aria-pressed', String(favorites === favoritesOnly));
      button.disabled = favorites && !count;
      button.title = favorites && !count ? 'Tap the heart next to an outfit in this wardrobe first' : '';
    });
  }
  function applyPrefs() {
    root.style.setProperty('--brightness', prefs.brightness / 100);
    root.style.setProperty('--fit', prefs.fit);
    $('brightness').value = prefs.brightness;
    $('brightnessValue').textContent = prefs.brightness + '%';
    $('volume').value = prefs.volume;
    $('volumeValue').textContent = prefs.volume + '%';
    $('idleToggle').checked = prefs.autoHide;
    $('edgeLightToggle').checked = prefs.edgeLight;
    document.querySelector('.edge-light').hidden = !prefs.edgeLight;
    document.querySelectorAll('[data-fit]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.fit === prefs.fit)));
    video.muted = !prefs.sound;
    video.volume = prefs.volume / 100;
    spare.muted = true;
    renderPlaybackMode();
    icon($('soundButton'), prefs.sound ? 'volume' : 'mute');
    $('soundButton').setAttribute('aria-label', prefs.sound ? 'Turn Sound Off' : 'Turn Sound On');
    $('soundButton').title = prefs.sound ? 'Turn Sound Off' : 'Turn Sound On';
    $('soundButton').setAttribute('aria-pressed', String(prefs.sound));
    $('soundToggle').checked = prefs.sound;
    $('soundToggle').setAttribute('aria-expanded', String(prefs.sound));
    $('soundVolume').hidden = !prefs.sound;
    $('soundState').textContent = !prefs.sound ? 'Muted' : prefs.volume === 0 ? 'Sound On · Volume Currently 0' : 'Sound On';
    scheduleIdleHide();
  }
  function activity(force = false) {
    // A host wake can precede (or replace) visibilitychange. Reconcile the
    // actual document state without overriding an explicit host media pause.
    if (documentPaused !== document.hidden) onSuspend();
    if (!force && performance.now() - lastActivity < 120) return;
    lastActivity = performance.now();
    const wasIdle = body.classList.contains('is-idle');
    body.classList.remove('is-idle');
    if (wasIdle) {
      updateProgress(phase === 'held' ? freezeTime() : video.currentTime);
      if (companionMode()) confirmDialogueVisible($('statusText').textContent);
    }
    scheduleIdleHide();
  }
  function scheduleIdleHide() {
    clearTimeout(idleTimer);
    const canHide = () => prefs.autoHide && !body.classList.contains('is-immersed') && !panel && !modeOpen && !spinning &&
      (phase !== 'loading' || isAutomaticOperation()) && !suspended();
    if (canHide()) {
      idleTimer = setTimeout(() => {
        if (canHide()) {
          body.classList.add('is-idle');
          dialogue.skipCompanionFollow();
          clearLoadingHint();
          if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.interface')) document.activeElement.blur();
        }
      }, Math.max(0, 15000 - (performance.now() - lastActivity)));
    }
  }
  function clearLoadingHint() {
    clearTimeout(loadingTimer);
    $('loading').hidden = true;
  }
  function setImmersed(enabled) {
    immersionRequest++;
    body.classList.toggle('is-immersed', enabled);
    if (enabled) {
      blockCompanionSpeech();
      closeWelcome(); clearLoadingHint(); clearTimeout(idleTimer);
      body.classList.remove('is-idle');
      document.activeElement?.blur();
    }
    if (prefs.immersed !== enabled) { prefs.immersed = enabled; persist(); }
    if (!enabled) updateProgress(phase === 'held' ? freezeTime() : video.currentTime);
  }
  async function enterImmersion() {
    const request = ++immersionRequest;
    closeWelcome(); cancelSpin(); closeModeMenu(false);
    if (panel === 'moment') await cancelMoment();
    else if (panel) closePanel(false);
    // A newer exit, startup-policy edit or reset wins over pending frame restore.
    if (request === immersionRequest) setImmersed(true);
  }
  function canShowLoadingHint() {
    return !suspended() && !isAutomaticOperation() &&
      !body.classList.contains('is-idle') && !body.classList.contains('is-immersed');
  }
  function unlockAudio() {
    if (!prefs.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (_) {}
  }
  function chime(pitch = 660, length = .11) {
    if (!prefs.sound || !audioContext || audioContext.state !== 'running' || suspended()) return;
    try {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = pitch;
      gain.gain.setValueAtTime(.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, prefs.volume / 100 * .035), audioContext.currentTime + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + length);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + length + .02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch (_) {}
  }

  function stopWatcher() {
    const watcher = frameWatcher;
    frameWatcher = null;
    if (watcher?.handle != null) {
      if (watcher.videoFrame) watcher.deck.cancelVideoFrameCallback(watcher.handle);
      else cancelAnimationFrame(watcher.handle);
    }
  }
  function watchFrames() {
    stopWatcher();
    if (phase !== 'playing' || suspended()) return;
    const watcher = frameWatcher = {deck: video, id: operation, handle: null, videoFrame: false};
    const valid = () => frameWatcher === watcher && watcher.deck === video && watcher.id === operation && phase === 'playing' && !suspended();
    const callback = (_, metadata) => {
      if (!valid()) return;
      watcher.handle = null;
      const t = metadata ? metadata.mediaTime : watcher.deck.currentTime;
      updateProgress(t);
      if (maybeBeginDeparture(t)) return;
      if (!valid()) return;
      if (!cycling() && t >= freezeTime() - .006) settle();
      else schedule();
    };
    const schedule = () => {
      if (!valid() || watcher.handle != null) return;
      watcher.videoFrame = typeof watcher.deck.requestVideoFrameCallback === 'function';
      watcher.handle = watcher.videoFrame ? watcher.deck.requestVideoFrameCallback(callback) : requestAnimationFrame(callback);
    };
    schedule();
  }
  function settle() {
    stopWatcher();
    // The chosen interval is time spent at the held frame, excluding playback.
    if (phase !== 'held') lastChange = Date.now();
    phase = 'held';
    video.pause();
    if (Number.isFinite(video.duration) && Math.abs(video.currentTime - freezeTime()) > .009) video.currentTime = Math.min(freezeTime(), video.duration - .04);
    body.classList.remove('is-playing');
    $('loading').hidden = true;
    clearTimeout(loadingTimer);
    updateProgress(freezeTime());
    $('timelineState').textContent = 'Frozen';
    $('selectionState').textContent = 'Current Freeze Frame';
    icon($('playButton'), 'repeat');
    $('playButton').setAttribute('aria-label', 'Replay Entrance');
    $('playButton').title = 'Replay Entrance';
    setStatus('MOMENT, KEPT.', line(current, 'held'));
    readyControls(false);
    if (isAutomaticOperation()) scheduleIdleHide();
    else activity(true);
  }
  function cancelSpin({keepPrepared = false, resume = true} = {}) {
    const wasSpinning = spinning;
    const warm = selectionWarm; selectionWarm = null;
    if (!keepPrepared && warm?.item === prefetch) cancelPrepared();
    ++spinId;
    spinning = false;
    body.classList.remove('is-spinning');
    document.querySelectorAll('.rolling').forEach(card => card.classList.remove('rolling'));
    $('randomButton').disabled = false;
    updateRandomLabel();
    syncTransition();
    if (wasSpinning && resume && phase === 'playing' && !suspended()) {
      if (video.ended) advanceLoop(); else primeLoop();
    }
  }
  function startOperation({ keepPlaying = false, automatic = false } = {}) {
    blockCompanionSpeech();
    cancelCompanionSwap();
    cancelTransition();
    pendingEntry = null;
    controller?.abort();
    controller = new AbortController();
    ++operation;
    automaticOperation = automatic ? operation : -1;
    stopWatcher();
    if (!keepPlaying) video.pause();
    clearTimeout(loadingTimer);
    return { id: operation, signal: controller.signal };
  }
  // Every load/seek can be cancelled. Stale async work must never alter the new look.
  /* @PURPLE_SAFE_CAROUSEL_ORDER */

  /* @PURPLE_SAFE_MEDIA_DECKS */

  /* @PURPLE_SAFE_PLAYBACK */

  /* @PURPLE_SAFE_COMPANION */

  /* @PURPLE_SAFE_COMPANION_SPEECH */

  /* @PURPLE_SAFE_QUALITY */

  /* @PURPLE_SAFE_AUTO_SWITCH */

  function mediaEvent(event, signal, action, element = video) {
    return new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => { clearTimeout(timer); element.removeEventListener(event, done); element.removeEventListener('error', fail); signal.removeEventListener('abort', abort); };
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('media')); };
      const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
      if (signal.aborted) return abort();
      element.addEventListener(event, done, { once: true });
      element.addEventListener('error', fail, { once: true });
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 22000);
      try { action(); } catch (error) { cleanup(); reject(error); }
    });
  }
  async function ensureLoaded(index, signal) {
    if (!isPlayable(index)) throw new Error('unavailable');
    if (loadedLook === index && video.dataset.quality === prefs.quality && video.readyState >= 2) return;
    loadedLook = -1;
    const quality = prefs.quality;
    await mediaEvent('loadeddata', signal, () => {
      video.src = mediaSource(index, quality);
      video.load();
    });
    loadedLook = index;
    video.dataset.look = LOOKS[index].id;
    video.dataset.quality = quality;
  }
  async function seek(time, signal, element = video) {
    const target = clamp(time, 0, Math.max(0, element.duration - .045));
    if (Math.abs(element.currentTime - target) < .002 && !element.seeking) return;
    await mediaEvent('seeked', signal, () => { element.currentTime = target; }, element);
    // A non-seekable HTTP preview can emit seeked while staying at zero.
    // Never reveal that opening frame as a successfully restored held pose.
    if (!Number.isFinite(element.currentTime) || Math.abs(element.currentTime - target) > .05) throw new Error('seek-incomplete');
  }
  function waitForEntryReveal(signal) {
    if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    // Flush the new opacity so getAnimations includes the just-started CSS
    // transition. Keep the clip paused at zero until its opening is visible;
    // delaying only the audio would discard the first footsteps/actions.
    getComputedStyle($('curtain')).opacity;
    const fades = $('curtain').getAnimations().filter(animation => animation.transitionProperty === 'opacity');
    if (!fades.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const clean = () => signal.removeEventListener('abort', abort);
      const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
      signal.addEventListener('abort', abort, {once: true});
      // A style change can finish the reveal by cancelling the transition.
      // Only the operation's abort signal cancels this selection.
      Promise.all(fades.map(animation => animation.finished.catch(() => {}))).then(() => { clean(); resolve(); });
    });
  }
  async function playSafely(id) {
    if (suspended() || phase !== 'playing') return;
    try {
      if (companionMode() && video.currentTime >= companionBoundary() - .001) { advanceCompanion(); return; }
      if (cycling() && !companionMode() && needsOpening(nextLoopIndex()) && !openingUsesVideo(nextLoopIndex())) {
        const next = nextLoopIndex();
        if (next !== null) await prepareOpening(next);
        if (id !== operation || suspended() || phase !== 'playing') return;
      }
      await video.play();
      if (id !== operation) return;
      if (suspended() || phase !== 'playing') { video.pause(); return; }
      if (pendingEntry?.id === id) {
        const entry = pendingEntry;
        pendingEntry = null;
        // Both startup and quiet wardrobe restoration replay the entrance.
        // Quiet avoids activity/waking UI, not a visible companion's E/F pair.
        const quietEntry = entry.event === 'quiet' || entry.event === 'startup';
        const silentEntry = quietEntry && (!companionMode() || panel || modeOpen ||
          body.classList.contains('is-immersed') || body.classList.contains('is-idle'));
        const words = silentEntry
          ? null
          : entry.event === 'enter' || quietEntry
          ? dialogue.enter(entry.index, {allowAffection: entry.allowAffection})
          : line(entry.index, entry.event);
        if (words) setStatus('HERE, WITH YOU.', words);
      }
      renderPlaybackMode();
      watchFrames();
      primeLoop();
      // Manual loading temporarily disallows idle hide; resume the original
      // inactivity deadline once playback is ready, without inventing activity.
      scheduleIdleHide();
    } catch (error) {
      if (id !== operation || phase !== 'playing' || suspended()) return;
      // A mode/favorite change may replace only the pending opening while this
      // same playback is preparing. Await its replacement instead of stalling.
      if (error.name === 'AbortError') return playSafely(id);
      phase = 'paused';
      body.classList.remove('is-playing');
      renderTransport();
      setStatus('READY WHEN YOU ARE.', fixedLine('ready', 'Tap play when you are ready.'));
      if (!isAutomaticOperation() && error.name !== 'NotAllowedError') toast('Playback was interrupted. Tap Play to continue.', 'Playback Notice');
    }
  }
  function loadFailure(index, error, id) {
    if (error.name === 'AbortError' || id !== operation) return;
    cancelTransition();
    releaseSpare();
    pendingEntry = null;
    dialogue.cancelPending();
    phase = 'error';
    video.pause(); video.classList.remove('visible');
    $('still').src = `images/look-${LOOKS[index].id}.jpg`;
    $('still').alt = LOOKS[index].name + ' Recommended Outfit Freeze Frame';
    $('curtain').classList.remove('closed');
    $('loading').hidden = true;
    clearTimeout(loadingTimer);
    body.classList.remove('is-playing');
    setStatus('A LITTLE PAUSE.', 'The video cannot be played right now. Click “Retry” below.');
    readyControls(false);
    if (isAutomaticOperation()) scheduleIdleHide();
    else { toast('The video cannot be played right now. Click “Retry” or choose another outfit.', 'Playback Notice'); activity(true); }
  }
  async function selectLook(index, { restore = false, entry = 'enter', allowAffection = true, preserveRandom = false, quiet = false, automatic = false, directChoice = false } = {}) {
    if (!isPlayable(index)) { lockedTap(index); return; }
    carouselShuffle.reset();
    resetCompanionAutoClock();
    closeWelcome();
    closeModeMenu(false);
    if (!preserveRandom && (index !== current || (!restore && entry === 'enter'))) dialogue.cancelPending();
    cancelSpin({keepPrepared: true, resume: false});
    if (panel) closePanel(false);
    const task = startOperation({automatic});
    releaseOpening();
    const changedWardrobe = wardrobeFor(index) !== wardrobeFor(current);
    const changedBrowse = wardrobeFor(index) !== wardrobe;
    // Explicit card/keyboard choices opt into the clip's advertised mode.
    // Restore, timers, random picks and automatic rounds keep their own policy.
    const activateCompanion = directChoice && Boolean(companionClip(index));
    const leftGlobalFavorites = !activateCompanion && prefs.playbackMode === 'global-favorites' && !prefs.favorites.includes(index);
    if (activateCompanion) {
      prefs.playbackMode = 'companion';
      prefs.wardrobeModes[wardrobeFor(index).id] = 'companion';
    } else if (leftGlobalFavorites) {
      prefs.playbackMode = 'freeze';
      prefs.wardrobeModes[wardrobeFor(index).id] = 'freeze';
    } else if (!globalMode() && changedWardrobe) prefs.playbackMode = effectiveWardrobeMode(wardrobeFor(index));
    current = index;
    if (!globalMode() && prefs.wardrobeModes[wardrobeFor(index).id] === 'companion') prefs.playbackMode = companionClip(index) ? 'companion' : 'freeze';
    if (prefs.playbackMode === 'companion' && !companionClip(index)) prefs.playbackMode = 'freeze';
    adoptWardrobe(index);
    if (cycling()) restore = false;
    if (changedBrowse) renderCards(true);
    if (LOOKS[index].silent || changedWardrobe) {
      clearTimeout(toastTimer); $('toast').classList.remove('show');
      setStatus(wardrobe.english, LOOKS[index].silent ? '' : companionClip(index) ? LOOKS[index].name : line(index, 'held'));
    }
    if (!globalMode() && changedWardrobe && prefs.wardrobeModes[wardrobe.id] === 'favorites' && !activeFavorites().length) {
      toast('This wardrobe has no favorites yet, so Freeze Frame mode is being used temporarily. Playback settings for other wardrobes are preserved.', 'Playback Mode');
    }
    if (leftGlobalFavorites) toast('This outfit is not in your favorites, so playback has switched to Freeze Frame mode.', 'Playback Mode');
    if (page !== pageFor(index)) setPage(pageFor(index), false, !automatic);
    phase = 'loading';
    readyControls(true);
    body.classList.remove('is-playing');
    updateCards(); persist();
    if (!quiet) activity(true);
    // Keep the current line during the short transition; speak once entry starts.
    clearTimeout(replyTimer);
    $('timelineState').textContent = 'Preparing';
    $('curtain').classList.add('closed');
    if (!automatic) loadingTimer = setTimeout(() => { if (task.id === operation && canShowLoadingHint()) $('loading').hidden = false; }, 900);
    try {
      // Prepare on the hidden deck during the cover, retaining any matching
      // carousel/random preview. The current decoded frame stays intact.
      const prepared = prepareNext(index, restore ? freezeTime() : 0);
      const [incoming] = await Promise.all([prepared, delay(420)]);
      if (task.id !== operation) return;
      commitPreparedDeck(incoming, index, task.id);
      releaseSpare();
      $('still').src = `images/look-${LOOKS[index].id}.jpg`;
      $('still').alt = LOOKS[index].name + ' Recommended Outfit Freeze Frame';
      document.querySelector('.ambient').style.backgroundImage = `url("images/look-${LOOKS[index].id}.jpg")`;
      await delay(40);
      if (task.id !== operation) return;
      $('curtain').classList.remove('closed');
      $('loading').hidden = true; clearTimeout(loadingTimer);
      if (!restore) await waitForEntryReveal(task.signal);
      if (task.id !== operation) return;
      readyControls(false);
      lastChange = Date.now();
      video.muted = !prefs.sound; video.volume = prefs.volume / 100;
      if (restore) { settle(); return; }
      phase = 'playing';
      body.classList.add('is-playing');
      renderTransport();
      pendingEntry = {id: task.id, index, event: quiet && entry !== 'startup' ? 'quiet' : entry, allowAffection};
      updateProgress(0);
      await playSafely(task.id);
    } catch (error) { loadFailure(index, error, task.id); }
  }
  function togglePlayback() {
    if (phase === 'transition' && transition) {
      transition.userPaused = !transition.userPaused;
      syncTransition(); renderPlaybackMode(); activity(true);
      return;
    }
    if (phase === 'loading' || phase === 'editing') return;
    unlockAudio();
    if (phase === 'playing') {
      blockCompanionSpeech();
      phase = 'paused'; cancelCompanionSwap(); video.pause(); stopWatcher(); body.classList.remove('is-playing');
      clearLoadingHint();
      icon($('playButton'), 'play'); $('playButton').setAttribute('aria-label', 'Resume Entrance');
      $('timelineState').textContent = 'Paused'; setStatus('TAKE YOUR TIME.', line(current, 'pause'));
    } else if (phase === 'paused') {
      phase = 'playing'; body.classList.add('is-playing');
      icon($('playButton'), 'pause'); $('playButton').setAttribute('aria-label', 'Pause Entrance');
      $('timelineState').textContent = 'Entrance'; setStatus('HERE, WITH YOU.', line(current, 'resume'));
      if (cycling() && video.ended) advanceLoop(); else playSafely(operation);
    } else selectLook(current, { entry: 'replay' });
    renderTransport();
    activity(true);
  }
  function randomIndex(group = wardrobe) {
    const pool = randomPool(group);
    bag = bag.filter(i => pool.includes(i));
    if (!bag.length) {
      bag = [...pool];
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    }
    if (bag[bag.length - 1] === current && pool.length > 1) {
      if (bag.length > 1) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      else { bag = []; return randomIndex(group); }
    }
    return bag.pop();
  }
  async function randomLook() {
    if (spinning || panel) return;
    closeWelcome();
    unlockAudio();
    const pool = randomPool();
    if (!pool.length) { toast('There are no favorites in this wardrobe yet. Tap the hearts next to outfits to add some.', 'Random Selection'); return; }
    if (pool.length === 1) {
      const selected = pool[0];
      const alreadySelected = selected === current;
      if (!alreadySelected) selectLook(selected, {quiet: true});
      lastChange = Date.now();
      toast(alreadySelected ? 'This wardrobe has only one favorite, and it is already selected. Favorite other outfits to include them in the random selection.' : 'This wardrobe has only one favorite. It has been selected for you.', 'Random Selection');
      activity(true);
      return;
    }
    spinning = true;
    const token = ++spinId;
    const selected = randomIndex();
    // A speculative choice may use an idle spare, but never displace an
    // imminent loop seam. A real click can later adopt the matching request.
    if (!companionSwap && phase !== 'transition' && phase !== 'loading' && !video.seeking &&
        (phase !== 'playing' || Number.isFinite(video.duration) && video.duration - video.currentTime > 3)) {
      cancelCompanionAutoNext();
      prepareNext(selected).catch(() => {});
      selectionWarm = {token, item: prefetch};
    }
    if (page !== pageFor(selected)) setPage(pageFor(selected), false);
    $('randomButton').disabled = true;
    $('randomText').textContent = 'Choosing Your Outfit';
    body.classList.add('is-spinning'); activity(true); syncTransition();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rounds = reduced ? 1 : 12;
    for (let step = 0; step < rounds; step++) {
      if (token !== spinId) return;
      const visiblePool = CHAPTERS[page].looks.filter(i => pool.includes(i));
      const highlight = step === rounds - 1 ? selected : visiblePool[step % visiblePool.length];
      document.querySelectorAll('.look-card').forEach(card => card.classList.toggle('rolling', Number(card.dataset.look) === highlight));
      chime(420 + step * 30, .045);
      await delay(reduced ? 30 : 45 + step * 10);
    }
    if (token !== spinId) return;
    chime(880, .3);
    dialogue.cancelPending();
    const response = LOOKS[selected].silent ? {text: '', rare: false} : dialogue.reply(selected, 'random');
    toast(response.text, '__CHARACTER_NAME__说 · ' + LOOKS[selected].short);
    selectLook(selected, {allowAffection: !response.rare, preserveRandom: true});
  }

  function closePanel(restoreFocus = true) {
    closeReset(false);
    setHelpView(false);
    $('settingsPanel').hidden = true; $('momentPanel').hidden = true;
    $('personalizationOptions').open = false;
    closeCustomInterval();
    $('settingsButton').setAttribute('aria-expanded', 'false');
    body.classList.remove('has-panel'); panel = null;
    if (restoreFocus) panelReturnFocus?.focus({ preventScroll: true });
    panelReturnFocus = null;
    syncTransition();
    activity(true);
  }
  function showPanel(name, trigger) {
    blockCompanionSpeech();
    closeWelcome();
    closeModeMenu(false);
    setImmersed(false);
    body.classList.remove('is-idle');
    closePanel(false);
    panel = name; panelReturnFocus = trigger;
    body.classList.add('has-panel');
    $(name + 'Panel').hidden = false;
    clearTimeout(idleTimer);
    syncTransition();
  }
  /* @PURPLE_SAFE_HELP */
  async function openMoment() {
    if (phase === 'loading' || phase === 'editing') return;
    cancelSpin();
    editorOriginal = { time: loadedLook === current && video.classList.contains('visible') ? video.currentTime : freezeTime(), phase, status: {...baseStatus} };
    const task = startOperation();
    phase = 'editing'; body.classList.remove('is-playing');
    showPanel('moment', $('momentButton'));
    readyControls(true); $('momentRange').disabled = true; $('saveMoment').disabled = true;
    $('momentLook').textContent = LOOKS[current].name;
    const words = line(current, 'edit');
    setStatus('FIND YOUR MOMENT.', words);
    $('momentHint').textContent = 'Click the timeline to seek, then use −/+ to fine-tune frame by frame.';
    try {
      await ensureLoaded(current, task.signal);
      await seek(editorOriginal.time, task.signal);
      if (task.id !== operation || panel !== 'moment') return;
      video.classList.add('visible');
      $('momentRange').max = video.duration - .05;
      $('momentDuration').textContent = ' / ' + video.duration.toFixed(2) + ' s';
      $('momentRange').value = video.currentTime;
      $('momentTime').textContent = video.currentTime.toFixed(2);
      $('momentRange').disabled = false; $('saveMoment').disabled = false;
      $('momentRange').focus({ preventScroll: true });
    } catch (error) { if (task.id === operation && error.name !== 'AbortError') { closePanel(); loadFailure(current, error, task.id); } }
  }
  function previewTime(value) {
    if (phase !== 'editing' || loadedLook !== current || $('momentRange').disabled) return;
    const t = clamp(Number(value), .1, Number($('momentRange').max));
    video.currentTime = t;
    $('momentRange').value = t;
    $('momentTime').textContent = t.toFixed(2);
    updateProgress(t);
  }
  async function cancelMoment() {
    if (panel !== 'moment') return;
    const original = editorOriginal;
    const task = startOperation();
    closePanel();
    try {
      await ensureLoaded(current, task.signal);
      await seek(original?.time ?? freezeTime(), task.signal);
      if (task.id !== operation) return;
      video.classList.add('visible');
      if (original?.phase === 'held' || original?.phase === 'error') settle();
      else if (original?.phase === 'playing') {
        phase = 'playing'; body.classList.add('is-playing');
        setStatus(original.status.label, original.status.text);
        icon($('playButton'), 'pause');
        $('playButton').setAttribute('aria-label', 'Pause Entrance');
        $('timelineState').textContent = 'Entrance';
        readyControls(false); updateProgress(video.currentTime); renderPlaybackMode();
        await playSafely(task.id);
        if (task.id !== operation) return;
      } else {
        phase = 'paused'; icon($('playButton'), 'play');
        $('playButton').setAttribute('aria-label', 'Resume Entrance');
        $('timelineState').textContent = 'Paused'; setStatus('TAKE YOUR TIME.', line(current, 'pause'));
        readyControls(false); updateProgress(video.currentTime); renderPlaybackMode();
      }
      respond(current, 'cancel', 'TAKE YOUR TIME.', false);
    } catch (error) { loadFailure(current, error, task.id); }
  }
  function saveMoment() {
    if (phase !== 'editing' || $('saveMoment').disabled) return;
    prefs.freezes[current] = Number($('momentRange').value);
    prefs.playbackMode = 'freeze'; releaseSpare();
    adoptWardrobe(current); renderCards(true);
    prefs.wardrobeModes[wardrobeFor(current).id] = 'freeze';
    persist(); closePanel(); settle(); lastChange = Date.now();
    respond(current, 'saved', 'YOUR MOMENT, KEPT.');
    chime(784, .22);
  }
  function onSuspend() {
    // WE and document visibility notifications need not arrive in the same
    // order. Never retain an old hidden flag after the document is visible.
    documentPaused = document.hidden;
    blockCompanionSpeech();
    body.classList.toggle('is-system-paused', suspended());
    if (suspended()) { cancelCompanionSwap(); decks.forEach(deck => deck.pause()); stopWatcher(); clearTimeout(idleTimer); clearLoadingHint(); audioContext?.suspend().catch(() => {}); }
    // Host resume is not a user action: keep idle/immersed state and the original
    // inactivity deadline. Pointer and keyboard handlers still wake as before.
    else { lastChange = Date.now(); if (phase === 'playing') { if (cycling() && video.ended) advanceLoop(); else playSafely(operation); } scheduleIdleHide(); }
    syncTransition();
  }

  /* @PURPLE_HOST_BRIDGE */

  /* @PURPLE_SAFE_RESET */

  function toggleFavorite(i) {
      if (!isPlayable(i)) return;
      const exists = prefs.favorites.includes(i);
      prefs.favorites = exists ? prefs.favorites.filter(x => x !== i) : [...prefs.favorites, i];
      if (!activeFavorites().length && !companionMode()) prefs.wardrobeRandomScopes[wardrobe.id] = 'all';
      bag = []; cancelSpin(); updateCards(); persist(); activity(true);
      const wasGlobal = globalMode();
      const emptied = favoritesMode() && !favoriteOrder().length;
      if (emptied) setPlaybackMode('freeze', false);
      else if (phase === 'transition' && favoritesMode()) {
        const paused = transition?.userPaused;
        startOperation(); phase = 'playing'; advanceLoop(paused);
      } else primeLoop();
      respond(i, exists ? 'unfavorite' : 'favorite', 'A LITTLE PREFERENCE.');
      if (emptied) toast(wasGlobal ? 'No favorites left. Switched back to Freeze Frame mode.' : 'No favorites left in this wardrobe. Switched back to Freeze Frame mode.', 'Playback Mode');
  }
  $('looks').addEventListener('click', event => {
    const select = event.target.closest('[data-select]');
    if (select) { unlockAudio(); chime(523, .08); selectLook(Number(select.dataset.select), {directChoice: true}); return; }
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) {
      const i = Number(favorite.dataset.favorite);
      toggleFavorite(i);
    }
  });
  $('wardrobeTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-wardrobe]');
    if (button) { unlockAudio(); chime(587, .1); selectWardrobe(button.dataset.wardrobe); }
  });
  $('prevPage').addEventListener('click', () => setPage(page - 1));
  $('wardrobeOrder').addEventListener('click', toggleWardrobeOrder);
  $('nextPage').addEventListener('click', () => setPage(page + 1));
  $('showCurrent').addEventListener('click', () => { adoptWardrobe(current); setPage(pageFor(current)); });
  $('pageTabs').addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (button) setPage(Number(button.dataset.page));
  });
  $('randomButton').addEventListener('click', randomLook);
  $('randomOptions').addEventListener('click', event => {
    const button = event.target.closest('[data-random-scope]');
    if (!button || button.disabled) return;
    const scope = button.dataset.randomScope;
    if (prefs.wardrobeRandomScopes[wardrobe.id] === scope) return;
    prefs.wardrobeRandomScopes[wardrobe.id] = scope;
    bag = []; cancelSpin(); renderAutoSwitch(); persist(); activity(true);
  });
  $('closeFirstUse').addEventListener('click', () => { closeWelcome(); $('modeButton').focus({preventScroll: true}); });
  $('playButton').addEventListener('click', togglePlayback);
  $('modeButton').addEventListener('click', () => modeOpen ? closeModeMenu() : openModeMenu());
  $('modeMenu').addEventListener('click', event => {
    const order = event.target.closest('[data-playback-order]');
    if (order) { setPlaybackOrder(order.dataset.playbackOrder); return; }
    const option = event.target.closest('[data-playback]');
    if (!option || option.getAttribute('aria-disabled') === 'true') return;
    setPlaybackMode(option.dataset.playback);
  });
  document.addEventListener('pointerdown', event => {
    if (modeOpen && !event.target.closest('.playback-mode')) closeModeMenu(false);
  });
  document.addEventListener('focusin', event => {
    if (modeOpen && !event.target.closest('.playback-mode')) closeModeMenu(false);
  });
  $('modeMenu').addEventListener('keydown', event => {
    const options = [...$('modeMenu').querySelectorAll('[data-playback-order], [data-playback]')].filter(option => !option.disabled && option.getAttribute('aria-disabled') !== 'true');
    const index = options.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus({preventScroll: true});
    }
  });
  $('momentButton').addEventListener('click', openMoment);
  $('cancelMoment').addEventListener('click', cancelMoment);
  $('saveMoment').addEventListener('click', saveMoment);
  $('momentRange').addEventListener('input', event => previewTime(event.target.value));
  $('prevFrame').addEventListener('click', () => previewTime(Number($('momentRange').value) - 1 / playbackFPS()));
  $('nextFrame').addEventListener('click', () => previewTime(Number($('momentRange').value) + 1 / playbackFPS()));
  $('resetMoment').addEventListener('click', () => { previewTime(LOOKS[current].freeze); respond(current, 'reset', 'FIND YOUR MOMENT.'); });
  $('settingsButton').addEventListener('click', () => {
    if (panel === 'settings') { closePanel(); return; }
    if (phase === 'editing') return;
    cancelSpin(); showPanel('settings', $('settingsButton'));
    $('settingsButton').setAttribute('aria-expanded', 'true'); $('closeSettings').focus({ preventScroll: true });
  });
  $('closeSettings').addEventListener('click', () => closePanel());
  // A blank click cancels an unsaved frame through the same restore path as X.
  // Drags starting inside either panel and clicks on other controls stay local.
  let panelPressInside = false;
  document.addEventListener('pointerdown', event => {
    panelPressInside = Boolean(panel && event.target.closest('#' + panel + 'Panel'));
  });
  document.addEventListener('click', event => {
    const startedInside = panelPressInside;
    panelPressInside = false;
    if (!panel || startedInside || event.target.closest('#settingsPanel,#momentPanel,button,a,input,label,select,textarea,[role="button"]')) return;
    if (panel === 'moment') cancelMoment();
    else if (panel === 'settings') closePanel();
  });
  $('brightness').addEventListener('input', event => { prefs.brightness = Number(event.target.value); applyPrefs(); persist(); });
  $('volume').addEventListener('input', event => { prefs.volume = Number(event.target.value); applyPrefs(); persist(); });
  $('idleToggle').addEventListener('change', event => { prefs.autoHide = event.target.checked; applyPrefs(); persist(); });
  $('edgeLightToggle').addEventListener('change', event => {
    prefs.edgeLight = event.target.checked;
    document.querySelector('.edge-light').hidden = !prefs.edgeLight;
    persist();
  });
  $('personalizationOptions').addEventListener('toggle', event => {
    if (event.target.open) event.target.querySelector('summary').scrollIntoView({block: 'nearest'});
  });
  // HTML buttons keep settings inside the web renderer across wallpaper hosts.
  $('fitOptions').addEventListener('click', event => {
    const button = event.target.closest('[data-fit]');
    if (!button) return;
    prefs.fit = button.dataset.fit; applyPrefs(); persist();
  });
  function setSound(enabled) {
    prefs.sound = enabled; applyPrefs(); persist(); unlockAudio(); chime(660, .17);
    toast(prefs.sound ? (prefs.volume ? 'Sound is on.' : 'Sound is on, but the volume is currently 0.') : 'Sound is off.', 'Sound Settings');
  }
  $('soundButton').addEventListener('click', () => setSound(!prefs.sound));
  $('soundToggle').addEventListener('change', event => setSound(event.target.checked));
  $('immerseButton').addEventListener('click', enterImmersion);
  const wake = () => {
    const immersed = body.classList.contains('is-immersed');
    const hidden = immersed || body.classList.contains('is-idle');
    setImmersed(false); activity(true);
    if (hidden && (immersed || !companionMode()) && (phase === 'held' || (companionMode() && video.currentTime >= companionStart()))) respond(current, 'wake', 'HERE, WITH YOU.', false);
  };
  $('wakeButton').addEventListener('click', wake);
  $('brand').addEventListener('click', event => { event.preventDefault(); wake(); });
  document.addEventListener('pointermove', () => activity());
  document.addEventListener('pointerdown', () => { unlockAudio(); activity(true); });
  document.addEventListener('focusin', () => activity(true));
  document.addEventListener('visibilitychange', onSuspend);
  for (const event of ['pageshow', 'focus']) window.addEventListener(event, () => {
    if (documentPaused !== document.hidden) onSuspend();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { if (!$('resetConfirm').hidden) closeReset(); else if (modeOpen) closeModeMenu(); else if (panel === 'moment') cancelMoment(); else if (panel) closePanel(); else if (!$('firstUseHint').hidden) closeWelcome(); else wake(); return; }
    // Mouse controls cover every function. These are only browser-preview conveniences.
    if (event.target.matches('input,select,textarea,button,a') || panel || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[1-9]$/.test(event.key) && activeOrder()[Number(event.key) - 1] !== undefined) selectLook(activeOrder()[Number(event.key) - 1], {directChoice: true});
    else if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
    else if (event.key.toLowerCase() === 'r') randomLook();
    else if (event.key.toLowerCase() === 'h') { if (body.classList.contains('is-immersed')) wake(); else enterImmersion(); }
    activity(true);
  });
  for (const deck of decks) {
    // Host media-resume calls must never start the prepared, invisible deck.
    const nativePlay = deck.play.bind(deck);
    deck.play = function () {
      if (!deckMayPlay(deck)) return Promise.resolve();
      return nativePlay();
    };
    deck.addEventListener('play', () => { if (!deckMayPlay(deck)) deck.pause(); });
    deck.addEventListener('ended', () => {
      if (deck !== video) return;
      // The departure owns its full animation; ended only releases its media
      // wait. Forcing finish here would turn a delayed start into a hard cut.
      if (phase === 'playing') cycling() ? advanceLoop() : settle();
    });
    deck.addEventListener('timeupdate', () => {
      if (deck !== video || phase !== 'playing') return;
      if (!maybeBeginDeparture(video.currentTime) && !cycling() && video.currentTime >= freezeTime()) settle();
    });
    deck.addEventListener('waiting', () => {
      if (deck !== video || phase !== 'playing' || !canShowLoadingHint()) return;
      const id = operation;
      clearTimeout(loadingTimer);
      loadingTimer = setTimeout(() => {
        if (id === operation && deck === video && phase === 'playing' && deck.readyState < 3 && canShowLoadingHint()) $('loading').hidden = false;
      }, 900);
    });
    deck.addEventListener('playing', () => { if (deck === video) { clearTimeout(loadingTimer); $('loading').hidden = true; } });
    deck.addEventListener('error', () => { if (deck === video && ['playing', 'paused', 'transition'].includes(phase)) loadFailure(current, new Error('decode'), operation); });
  }

  function updateClock() {
    const date = new Date();
    const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    if ($('clock').textContent !== time) $('clock').textContent = time;
  }
  updateClock();
  setInterval(() => {
    tickCompanionSpeech();
    if (suspended()) return;
    updateClock();
    maybeAutoSwitch();
  }, 1000);
  function showRememberedStill() {
    adoptWardrobe(current);
    $('still').src = `images/look-${LOOKS[current].id}.jpg`;
    $('still').alt = LOOKS[current].name + ' Recommended Outfit Freeze Frame';
    document.querySelector('.ambient').style.backgroundImage = `url("images/look-${LOOKS[current].id}.jpg")`;
    renderCards(); updateProgress(freezeTime()); applyPrefs();
    setStatus('MOMENT, KEPT.', companionMode() ? LOOKS[current].name : line(current, 'held'));
  }
  // Both layouts share this controller; switching does not create another player.
  window.purpleLayoutBridge = Object.freeze({
    current: () => ({index:current, id:LOOKS[current].id, name:LOOKS[current].name,
      favorite:prefs.favorites.includes(current), phase, mode:prefs.playbackMode}),
    favorite: () => toggleFavorite(current)
  });
  // Commit normalized/migrated records even when the initial still needs no video load.
  persist();
  showRememberedStill();
  if (!prefs.welcomeSeen && !body.classList.contains('is-immersed')) showWelcome();
  if (cycling()) {
    const index = favoritesMode() && !prefs.favorites.includes(current)
      ? globalMode() || shuffleCarousel() ? nextLoopIndex() : favoriteOrder()[0] : current;
    selectLook(index, {quiet: true, entry: companionMode() ? 'startup' : 'quiet'});
  } else if (Math.abs(freezeTime() - LOOKS[current].freeze) > .008) selectLook(current, { restore: true });
})();
