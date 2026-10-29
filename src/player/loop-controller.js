  // Two media decks: departures dissolve while the outgoing deck is still moving.
  // Close-up/reclining endings retain their full-person, post-ended dissolve.
  const LOOP_SEAMS = __PURPLE_LOOP_SEAMS__;
  // Default to the prepared next deck's real first frame at the chosen quality.
  // Keep that frame in the display surface; no extra media deck or opening JPG.
  const openingSurface = document.createElement('canvas');
  openingSurface.id = 'loopPlate'; openingSurface.className = 'scene';
  openingSurface.setAttribute('aria-hidden', 'true');
  openingSurface.width = openingSurface.height = 1;
  $('curtain').before(openingSurface);
  let openingPlate = null;
  function releaseOpening() {
    openingPlate = null;
    openingSurface.classList.remove('is-primed');
    delete openingSurface.dataset.opening;
    openingSurface.width = openingSurface.height = 1;
  }
  const crossesWardrobe = index => index !== null && wardrobeFor(index) !== wardrobeFor(current);
  const needsOpening = index => index !== null && (Boolean(LOOP_SEAMS[LOOKS[current].id]) || crossesWardrobe(index));
  // An explicit opening is only a clean-scene exception (currently closed sit-09).
  // Cross-wardrobe transitions retain the outgoing wardrobe's shared empty scene.
  const openingUsesVideo = index => index !== null && !crossesWardrobe(index) &&
    Boolean(LOOP_SEAMS[LOOKS[current].id]) && !LOOP_SEAMS[LOOKS[index].id]?.opening;
  function prepareOpening(index) {
    // Cross-group departures first clear the outgoing sofa; the incoming deck
    // then reveals the target's actual opening. Never use the browsed wardrobe.
    const fromVideo = openingUsesVideo(index);
    const src = fromVideo ? `${mediaSource(index)}#opening`
      : crossesWardrobe(index) ? `images/${wardrobeFor(current).empty}`
      : LOOP_SEAMS[LOOKS[index].id]?.opening || `images/${wardrobeFor(index).empty}`;
    if (openingPlate?.src === src) return openingPlate.promise;
    const item = {src, promise: null};
    openingPlate = item;
    openingSurface.classList.remove('is-primed');
    item.promise = (async () => {
      let source, width, height;
      if (fromVideo) {
        const prepared = prepareNext(index), request = prefetch;
        source = await prepared;
        if (prefetch !== request || source !== spare || !request.ready || request.target !== 0 ||
            source.seeking || Math.abs(source.currentTime) > .05) throw new DOMException('Cancelled', 'AbortError');
        width = source.videoWidth; height = source.videoHeight;
      } else {
        source = new Image(); source.src = src;
        await source.decode(); width = source.naturalWidth; height = source.naturalHeight;
      }
      if (openingPlate !== item) throw new DOMException('Cancelled', 'AbortError');
      openingSurface.width = width; openingSurface.height = height;
      openingSurface.getContext('2d', {alpha: false}).drawImage(source, 0, 0);
      openingSurface.dataset.opening = src;
      openingSurface.classList.add('is-primed');
      // Give the displayed surface a paint opportunity before media starts.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (openingPlate !== item) throw new DOMException('Cancelled', 'AbortError');
      return openingSurface;
    })();
    item.promise.catch(() => { if (openingPlate === item) releaseOpening(); });
    return item.promise;
  }
  function maybeBeginDeparture(time) {
    if (companionMode()) {
      sampleCompanionAutoClock(time);
      if (!video.seeking && time >= companionBoundary() - .001) advanceCompanion();
      return false;
    }
    const seam = LOOP_SEAMS[LOOKS[current].id];
    if (!seam || !cycling() || phase !== 'playing' || suspended() || video.seeking || !Number.isFinite(video.duration)) return false;
    if (time < video.duration - seam.lead) return false;
    advanceLoop();
    return true;
  }
  function deckMayPlay(deck) {
    if (suspended()) return false;
    if (deck !== video) return phase === 'playing' && companionMode() && companionSwap?.incoming === deck && companionSwap.id === operation;
    if (phase === 'playing') return true;
    const tx = transition;
    return phase === 'transition' && tx?.departing && tx.outgoing === deck && !tx.cancelled && !transitionBlocked(tx);
  }
  function cycling() { return prefs.playbackMode !== 'freeze'; }
  const loopOrder = () => globalMode() ? globalOrder() : orderFor(wardrobeFor(current)).filter(isPlayable);
  function favoriteOrder() { return loopOrder().filter(i => prefs.favorites.includes(i)); }
  const carouselShuffle = createCarouselShuffle();
  const carouselMode = () => ['all', 'favorites', 'global-all', 'global-favorites'].includes(prefs.playbackMode);
  const shuffleCarousel = () => carouselMode() && prefs.playbackOrder === 'shuffle';
  function nextLoopIndex() {
    if (!carouselMode()) return current;
    const order = ['all', 'global-all'].includes(prefs.playbackMode) ? loopOrder() : favoriteOrder();
    if (!order.length) return null;
    if (shuffleCarousel()) return carouselShuffle.peek(order, current, `${prefs.playbackMode}:${globalMode() ? 'global' : wardrobeFor(current).id}`);
    const position = loopOrder().indexOf(current);
    return order.find(i => loopOrder().indexOf(i) > position) ?? order[0];
  }
  function playbackModeLabel(includeOrder = true) {
    const labels = {freeze: 'Still mode', companion: 'Dynamic companion', single: 'Single-look loop', all: 'Wardrobe carousel', favorites: 'Wardrobe favorites', 'global-all': 'All-wardrobe carousel', 'global-favorites': 'All-wardrobe favorites'};
    return labels[prefs.playbackMode] + (includeOrder && carouselMode() ? prefs.playbackOrder === 'shuffle' ? ' · Shuffle' : ' · In order' : '');
  }
  function setPlaybackOrder(order) {
    if (!['sequence', 'shuffle'].includes(order) || order === prefs.playbackOrder || phase === 'editing') return;
    prefs.playbackOrder = order; carouselShuffle.reset(); persist();
    // A handoff already on screen keeps its chosen target. The new order is
    // used afterwards; during normal playback only the hidden preload changes.
    if (carouselMode() && ['playing', 'paused'].includes(phase)) { releaseSpare(); primeLoop(); }
    renderPlaybackMode(); activity(true);
  }
  function renderPlaybackMode() {
    const label = playbackModeLabel(), shuffled = prefs.playbackOrder === 'shuffle';
    const orderText = shuffled ? 'Shuffle' : 'In order';
    body.dataset.playbackMode = prefs.playbackMode;
    $('modeButton').setAttribute('aria-label', 'Playback mode: ' + label);
    $('modeButton').title = label + ' · Change playback mode';
    $('modeLabel').textContent = label;
    $('modeButton').disabled = phase === 'editing';
    document.querySelectorAll('[data-playback-order]').forEach(button => {
      button.setAttribute('aria-checked', String(button.dataset.playbackOrder === prefs.playbackOrder));
      button.disabled = phase === 'editing';
    });
    document.querySelectorAll('.mode-order-suffix').forEach(suffix => { suffix.textContent = shuffled ? ' · Shuffle' : ' · In order'; });
    $('playbackOrderHint').textContent = !carouselMode() ? 'Used for the carousel and favorites playback below'
      : shuffled ? 'No repeats within a round; starts with the next look' : 'Follows wardrobe order; starts with the next look';
    const localCount = orderFor(wardrobeFor(current)).filter(i => prefs.favorites.includes(i)).length;
    $('favoriteCount').textContent = localCount;
    $('favoriteModeHint').textContent = localCount ? `${wardrobeFor(current).name} · ${orderText} play favorites` : 'Favorite a look in the currently playing wardrobe first';
    $('globalFavoriteCount').textContent = prefs.favorites.length;
    $('globalFavoriteModeHint').textContent = prefs.favorites.length ? `Across all three wardrobes, ${orderText} play favorites` : 'Favorite a look you like in any wardrobe first';
    $('globalAllModeHint').textContent = `Across all three wardrobes, ${orderText} play available looks`;
    $('companionModeHint').textContent = companionClip() ? 'After the entrance, continuously loop the idle animation' : 'A loop clip is not available for this look yet';
    $('allModeHint').textContent = `${wardrobeFor(current).name} · ${orderText}play in full`;
    document.querySelectorAll('[data-playback]').forEach(option => {
      option.setAttribute('aria-checked', String(option.dataset.playback === prefs.playbackMode));
      option.setAttribute('aria-disabled', String((option.dataset.playback === 'companion' && !companionClip()) || (option.dataset.playback === 'favorites' && !localCount) || (option.dataset.playback === 'global-favorites' && !prefs.favorites.length)));
    });
    renderAutoSwitch();
    renderTransport();
  }
  // Every transport state has one icon, one action label and one timeline label.
  function renderTransport() {
    renderQuality();
    // Expose an explicit user pause, including a paused handoff, to the layout.
    // Automatic held frames and host suspension must not brighten the wardrobe.
    const userPaused = phase === 'paused' || (phase === 'transition' && Boolean(transition?.userPaused));
    if (body.classList.contains('is-user-paused') !== userPaused) body.classList.toggle('is-user-paused', userPaused);
    let action = 'Replay entrance', symbol = 'repeat', state = 'Still';
    if (phase === 'error') {
      action = 'Retry playback'; state = 'Playback failed';
    } else if (phase === 'loading') {
      action = 'Preparing playback'; state = 'Ready';
    } else if (phase === 'editing') {
      action = 'Selecting a still frame'; state = 'Frame selection';
    } else if (phase === 'transition') {
      const paused = transition?.userPaused;
      action = transition?.automatic ? paused ? 'Resume outfit change' : 'Pause outfit change' : paused ? 'Resume looping playback' : 'Pause looping playback'; symbol = paused ? 'play' : 'pause';
      state = paused ? 'Paused' : transition?.automatic ? 'Gently switch to another look' : nextLoopIndex() === current ? 'Watch again' : 'Gently switch to another look';
    } else if (phase === 'playing' || phase === 'paused') {
      const paused = phase === 'paused';
      action = cycling() ? paused ? 'Resume looping playback' : 'Pause looping playback' : paused ? 'Resume entrance playback' : 'Pause entrance';
      symbol = paused ? 'play' : 'pause';
      state = paused ? 'Paused' : cycling() ? playbackModeLabel(false) : 'Entrance';
    }
    icon($('playButton'), symbol);
    $('playButton').setAttribute('aria-label', action); $('playButton').title = action;
    $('retryLabel').hidden = phase !== 'error';
    $('playButton').classList.toggle('has-retry', phase === 'error');
    $('timelineState').textContent = state;
  }
  function openModeMenu() {
    if (phase === 'editing' || panel) return;
    closeWelcome();
    clearTimeout(toastTimer); $('toast').classList.remove('show');
    modeOpen = true; $('modeMenu').hidden = false;
    $('modeButton').setAttribute('aria-expanded', 'true');
    activity(true); clearTimeout(idleTimer); renderPlaybackMode(); syncTransition();
    window.dispatchEvent(new Event('purple:playback-layout'));
    $('modeMenu').querySelector('[data-playback][aria-checked="true"]').focus({preventScroll: true});
  }
  function closeModeMenu(restoreFocus = true) {
    if (!modeOpen) return;
    modeOpen = false; $('modeMenu').hidden = true;
    $('modeButton').setAttribute('aria-expanded', 'false');
    if (restoreFocus) $('modeButton').focus({preventScroll: true});
    syncTransition(); activity(true);
  }
  function setPlaybackMode(mode, speak = true) {
    if (!playbackModes.includes(mode) || phase === 'editing' || (mode === 'companion' && !companionClip())) return;
    const order = (globalMode(mode) ? globalOrder() : orderFor(wardrobeFor(current))).filter(i => isPlayable(i) && prefs.favorites.includes(i));
    if (['favorites', 'global-favorites'].includes(mode) && !order.length) return;
    cancelSpin({resume: mode === prefs.playbackMode});
    closeModeMenu();
    if (mode === prefs.playbackMode) {
      if (!globalMode(mode)) prefs.wardrobeModes[wardrobeFor(current).id] = mode;
      persist();
      return;
    }
    const interrupted = phase === 'transition';
    if (interrupted) { startOperation(); phase = 'held'; }
    prefs.playbackMode = mode;
    carouselShuffle.reset();
    resetCompanionAutoClock();
    if (!globalMode(mode)) {
      prefs.wardrobeModes[wardrobeFor(current).id] = mode;
      adoptWardrobe(current); renderCards(true);
    }
    releaseSpare(); persist(); renderPlaybackMode();
    lastChange = Date.now();
    if (mode === 'freeze') selectLook(current, {restore: true, quiet: true});
    else {
      const selected = favoritesMode() && !prefs.favorites.includes(current)
        ? globalMode() || shuffleCarousel() ? nextLoopIndex() : favoriteOrder()[0] : current;
      if (selected !== current || !['playing', 'paused'].includes(phase)) selectLook(selected, {quiet: true});
      else if (phase === 'playing' && video.ended) advanceLoop();
      else if (mode === 'companion' && phase === 'playing' && video.currentTime >= companionBoundary() - .001) advanceCompanion();
      else primeLoop();
    }
    if (speak && !LOOKS[current].silent) {
      const words = {freeze: 'All right, let’s keep this moment you love.', companion: 'I’m right here, keeping you company at your own pace.', single: 'You like this look so much… then I’ll stay and let you enjoy it a little longer.', all: 'Take your time watching; I’ll change looks one by one for you.', favorites: 'I remember every look you hearted. I’ll slowly show them to you.', 'global-all': 'All-wardrobe carousel enabled. Available looks from all three wardrobes will play in order.', 'global-favorites': 'All-wardrobe favorites enabled. Favorites from all three wardrobes will play in order.'};
      const wordsForMode = shuffleCarousel() ? `Enabled ${playbackModeLabel()}，; no repeats within a round.` : fixedLine(mode, words[mode]);
      toast(wordsForMode, globalMode() || shuffleCarousel() ? 'Playback mode' : 'She says');
      if (mode !== 'freeze') setStatus('STAY A LITTLE.', wordsForMode);
      unlockAudio(); chime(660, .12);
    }
  }
  function primeLoop() {
    if (spinning && selectionWarm?.item === prefetch) return;
    if (companionMode()) { primeCompanion(); return; }
    if (!cycling() || !['playing', 'paused'].includes(phase)) return;
    const next = nextLoopIndex();
    if (next !== null) {
      prepareNext(next);
      if (needsOpening(next)) prepareOpening(next).catch(() => {});
    }
  }
  // Continuous carousel rounds keep running behind settings. Timed departures
  // and companion handoffs wait while the user is changing playback options.
  function transitionBlocked(tx) { return suspended() || tx.userPaused || panel === 'moment' || spinning || ((tx.companion || tx.leaveAfterHold) && (panel || modeOpen)); }
  function syncTransition() {
    const tx = transition;
    if (!tx) return;
    if (transitionBlocked(tx)) {
      // A finished clean plate must stay opaque; pausing and replaying a finished
      // animation would rewind it and briefly expose the outgoing tail again.
      if (tx.animation?.playState === 'running') tx.animation.pause();
      if (tx.departing) tx.outgoing.pause();
    }
    else {
      if (tx.departing && !tx.outgoing.ended && tx.outgoing.paused && !tx.resuming) {
        tx.resuming = true;
        tx.outgoing.play().then(() => {
          if (transition === tx && transitionBlocked(tx)) tx.outgoing.pause();
        }).catch(error => {
          if (transition === tx && !tx.cancelled) loadFailure(current, error, tx.id);
        }).finally(() => { tx.resuming = false; });
      }
      if (tx.animation?.playState === 'paused') tx.animation.play();
      [...tx.waiters].forEach(wake => wake());
    }
  }
  async function waitForTransition(tx) {
    if (tx.cancelled || tx.signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
    if (!transitionBlocked(tx)) return Promise.resolve();
    await new Promise((resolve, reject) => {
      const clean = () => { tx.waiters.delete(wake); tx.signal.removeEventListener('abort', abort); };
      const wake = () => {
        if (tx.cancelled || tx.signal.aborted) { abort(); return; }
        if (!transitionBlocked(tx)) { clean(); resolve(); }
      };
      const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
      tx.waiters.add(wake); tx.signal.addEventListener('abort', abort, {once: true});
    });
    // Pause state can change again in the same input event; recheck after waking.
    return waitForTransition(tx);
  }
  function cancelTransition() {
    const tx = transition;
    if (!tx) return;
    tx.cancelled = true; tx.animation?.cancel();
    [...tx.waiters].forEach(wake => wake());
    transition = null;
    spare.style.opacity = '0'; spare.style.zIndex = '1';
    video.style.zIndex = '1'; openingSurface.style.opacity = '';
    body.classList.remove('is-loop-transition');
  }
  function waitForOutgoingEnd(tx) {
    if (tx.outgoing.ended) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const clean = () => { tx.outgoing.removeEventListener('ended', done); tx.signal.removeEventListener('abort', abort); tx.waiters.delete(cancelled); };
      const done = () => { clean(); resolve(); };
      const abort = () => { clean(); reject(new DOMException('Cancelled', 'AbortError')); };
      const cancelled = () => { if (tx.cancelled) abort(); };
      if (tx.signal.aborted || tx.cancelled) { abort(); return; }
      tx.outgoing.addEventListener('ended', done, {once: true});
      tx.signal.addEventListener('abort', abort, {once: true});
      tx.waiters.add(cancelled);
    });
  }
  async function advanceLoop(userPaused = false) {
    if (companionMode()) { advanceCompanion(); return; }
    if (!cycling() || phase !== 'playing' || transition || suspended()) return;
    selectionWarm = null;
    const next = nextLoopIndex();
    if (next === null) { setPlaybackMode('freeze', false); return; }
    const seam = LOOP_SEAMS[LOOKS[current].id];
    const crossGroup = crossesWardrobe(next);
    const task = startOperation({keepPlaying: Boolean(seam)});
    phase = 'transition';
    const tx = transition = {...task, userPaused, waiters: new Set(), cancelled: false, animation: null,
      departing: Boolean(seam), outgoing: video, resuming: false};
    body.classList.remove('is-playing'); body.classList.add('is-loop-transition');
    readyControls(false); renderPlaybackMode();
    $('loading').hidden = true;
    try {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const prepared = prepareNext(next);
      let incoming;
      if (seam || crossGroup) {
        // Wait for the real first frame while the outgoing departure continues.
        // A late decode holds its ended frame, then still gets the full fade.
        syncTransition();
        const cover = await prepareOpening(next);
        await waitForTransition(tx);
        if (task.id !== operation) return;
        tx.animation = cover.animate([{opacity: .001}, {opacity: 1}], {
          duration: reduced ? 100 : seam ? seam.fade * 1000 : 250,
          easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards'
        });
        syncTransition();
        // The original clip still reaches its real end underneath the clean plate.
        const results = await Promise.all([prepared, tx.animation.finished, seam ? waitForOutgoingEnd(tx) : Promise.resolve()]);
        incoming = results[0];
        if (crossGroup) {
          await waitForTransition(tx);
          if (task.id !== operation) return;
          // Hold the clean outgoing scene until the target first frame is ready.
          // Fade that scene away with an opaque target underneath, avoiding a dip.
          incoming.style.zIndex = '2'; incoming.style.opacity = '1';
          cover.style.opacity = '1'; tx.animation.cancel();
          tx.animation = cover.animate([{opacity: 1}, {opacity: .001}], {
            duration: reduced ? 100 : 300, easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards'
          });
          syncTransition(); await tx.animation.finished;
          cover.style.opacity = '';
        }
      } else {
        incoming = await prepared;
        await waitForTransition(tx);
        await delay(140);
        await waitForTransition(tx);
        if (task.id !== operation) return;
        incoming.style.zIndex = '2';
        tx.animation = incoming.animate([{opacity: 0}, {opacity: 1}], {
          duration: reduced ? 100 : 460, easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards'
        });
        syncTransition();
        await tx.animation.finished;
      }
      await waitForTransition(tx);
      if (task.id !== operation) return;
      // The outgoing frame stays opaque below the incoming frame: no black dip.
      const previous = current;
      commitPreparedDeck(incoming, next, task.id);
      tx.animation.cancel();
      video.style.opacity = ''; transition = null;
      if (shuffleCarousel()) carouselShuffle.commit(next);
      current = next; loadedLook = next; phase = 'playing';
      $('curtain').style.backgroundImage = `url("images/${wardrobeFor(current).empty}")`;
      video.muted = !prefs.sound; video.volume = prefs.volume / 100;
      $('still').src = `images/look-${LOOKS[next].id}.jpg`;
      $('still').alt = LOOKS[next].name + ' outfit recommendation still frame';
      document.querySelector('.ambient').style.backgroundImage = `url("images/look-${LOOKS[next].id}.jpg")`;
      // Playback updates the selection, never the page a person is browsing.
      updateCards();
      body.classList.remove('is-loop-transition'); body.classList.add('is-playing');
      icon($('playButton'), 'pause'); readyControls(false); renderPlaybackMode(); updateProgress(0); persist();
      // Automatic rounds never call toast/activity or wake an immersed interface.
      if (previous !== next) setStatus('HERE, WITH YOU.', LOOKS[next].silent ? '' : dialogue.enter(next, {allowAffection: false}));
      await playSafely(task.id);
    } catch (error) {
      if (task.id === operation && !tx.cancelled) loadFailure(current, error, task.id);
    }
  }
