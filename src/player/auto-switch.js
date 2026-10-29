let customIntervalOpen = false, draftIntervalUnit = 'seconds';
  const autoSwitchDisabled = () => cycling() && !companionMode();
  const hasHeldDeparture = () => !companionClip() && Boolean(LOOP_SEAMS[LOOKS[current].id]);
  let companionAutoClock = {key: '', elapsed: 0, deck: null, time: 0, round: 0};
  let companionAutoNext = null, companionAutoBag = [], companionAutoRetryAt = 0;
  let companionAutoDeferredRound = -1;
  const companionAutoRecoveryLead = 1.5, companionAutoPrepareLead = 3;
  function companionAutoPool() {
    const group = wardrobeFor(current);
    const favorites = prefs.wardrobeRandomScopes[group.id] === 'favorites';
    return orderFor(group).filter(i => isPlayable(i) && companionClip(i) && (!favorites || prefs.favorites.includes(i)));
  }
  function resetCompanionAutoClock() {
    companionAutoClock = {key: '', elapsed: 0, deck: null, time: 0, round: 0};
    companionAutoRetryAt = 0; companionAutoDeferredRound = -1;
    const prepared = Boolean(companionAutoNext);
    cancelCompanionAutoNext();
    if (prepared) primeCompanion();
  }
  function cancelCompanionAutoNext() {
    if (!companionAutoNext) return;
    companionAutoNext = null;
    cancelPrepared();
  }
  function deferCompanionAutoNext() {
    const item = companionAutoNext;
    if (!item) return;
    // An unplayed target is not consumed. Retry it in a later lap rather than
    // drawing a different outfit every second while the decoder is occupied.
    if (!companionAutoBag.includes(item.index)) companionAutoBag.push(item.index);
    companionAutoDeferredRound = companionAutoClock.round;
    cancelCompanionAutoNext(); primeCompanion();
  }
  function companionAutoActive() {
    return companionMode() && prefs.interval > 0 && phase === 'playing' && !suspended() &&
      !panel && !modeOpen && !spinning && !video.paused && !video.seeking && video.readyState >= 2;
  }
  // Use the advancing media clock: entry, pauses, seeks and blocked UI time do
  // not count. Deck swaps keep elapsed time but establish a fresh sample.
  function sampleCompanionAutoClock(time = video.currentTime) {
    const key = `${current}:${prefs.playbackMode}:${prefs.interval}`;
    if (companionAutoClock.key !== key) {
      resetCompanionAutoClock(); companionAutoClock.key = key;
    }
    const clock = companionAutoClock, active = companionAutoActive();
    // Both a normal deck exchange and a backwards seek start a new lap. A
    // pause/resume on the same deck does not reopen a cancelled preparation.
    if (clock.deck && (clock.deck !== video || time < clock.time - .25)) clock.round++;
    if (active && clock.deck === video) {
      const delta = time - Math.max(clock.time, companionStart());
      if (delta > 0 && delta < .5) clock.elapsed += delta * 1000;
    }
    clock.deck = video; clock.time = time;
    const item = companionAutoNext;
    // This runs on each displayed frame, not only the one-second timer. Leave
    // the spare enough time to recover the current loop before its boundary.
    if (item && (item.round !== clock.round || item.outgoing !== video ||
        (active && !item.ready && time >= item.deadline))) deferCompanionAutoNext();
  }
  function updateCompanionAutoNext() {
    sampleCompanionAutoClock();
    const pool = companionMode() ? companionAutoPool() : [];
    const active = companionAutoActive();
    if (companionAutoNext && (!active || companionAutoNext.id !== operation ||
        companionAutoNext.quality !== prefs.quality || !pool.includes(companionAutoNext.index))) {
      deferCompanionAutoNext();
    }
    if (!active || companionSwap || companionAutoNext || companionAutoDeferredRound === companionAutoClock.round ||
        performance.now() < companionAutoRetryAt || !pool.some(i => i !== current)) return;
    const remaining = companionBoundary() - video.currentTime;
    // Reserve the spare only for a round whose end falls after the deadline.
    // Reserve distinct preparation and recovery windows. A late request keeps
    // the already prepared current loop and can use the following round.
    if (video.currentTime < companionStart() || remaining < companionAutoPrepareLead ||
        companionAutoClock.elapsed + remaining * 1000 < prefs.interval * 60000) return;
    companionAutoBag = companionAutoBag.filter(i => pool.includes(i) && i !== current);
    if (!companionAutoBag.length) {
      companionAutoBag = pool.filter(i => i !== current);
      for (let i = companionAutoBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [companionAutoBag[i], companionAutoBag[j]] = [companionAutoBag[j], companionAutoBag[i]];
      }
    }
    const item = companionAutoNext = {index: companionAutoBag.pop(), id: operation, quality: prefs.quality, ready: false,
      round: companionAutoClock.round, outgoing: video, deadline: companionBoundary() - companionAutoRecoveryLead};
    prepareNext(item.index).then(deck => {
      if (companionAutoNext !== item) return;
      item.ready = true; item.deck = deck;
      deck.style.zIndex = '2'; deck.style.opacity = '.001';
    }).catch(() => {
      if (companionAutoNext !== item) return;
      companionAutoRetryAt = performance.now() + 30000; deferCompanionAutoNext();
    });
  }
  function switchCompanionAtBoundary() {
    sampleCompanionAutoClock();
    const item = companionAutoNext;
    if (!item) return false;
    if (companionAutoActive() && companionAutoClock.elapsed >= prefs.interval * 60000 &&
        item.id === operation && item.quality === prefs.quality && item.ready && item.deck === spare &&
        companionAutoPool().includes(item.index)) {
      // The prepared first frame is retained through startOperation below.
      companionAutoNext = null;
      switchAfterHold(item.index, true);
      return true;
    }
    // A pause, scope edit or slow load must not turn a normal lap into a swap.
    deferCompanionAutoNext();
    return false;
  }
  // Keep the historical minute fields; whole seconds are stored as minute fractions.
  function normalizeAutoInterval(value, fallback = 0) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes <= 0) return fallback;
    return Math.max(1, Math.min(3600, Math.round(minutes * 60))) / 60;
  }
  function isPresetInterval(minutes) { return [0, .25, 5, 15].includes(minutes); }
  function intervalUnit(minutes) { return Math.round(minutes * 60) % 60 ? 'seconds' : 'minutes'; }
  function formatAutoInterval(minutes) {
    if (!minutes) return 'Off';
    const seconds = Math.round(minutes * 60);
    return seconds % 60 ? `Every ${seconds} seconds` : `Every ${seconds / 60} minutes`;
  }
  function renderCustomIntervalAction() {
    const value = Number($('customInterval').value);
    const max = draftIntervalUnit === 'seconds' ? 3600 : 60;
    const seconds = draftIntervalUnit === 'seconds' ? value : value * 60;
    const applied = prefs.intervalMode === 'custom' && prefs.interval > 0 &&
      Number.isInteger(value) && value >= 1 && value <= max &&
      draftIntervalUnit === prefs.customIntervalUnit && seconds === Math.round(prefs.interval * 60);
    const button = $('applyCustomInterval');
    button.textContent = applied ? 'Applied' : 'Apply';
    button.dataset.applied = String(applied);
    button.disabled = autoSwitchDisabled() || applied;
  }
  function renderAutoSwitch() {
    const disabled = autoSwitchDisabled();
    if (disabled) customIntervalOpen = false;
    const custom = prefs.intervalMode === 'custom' && prefs.interval > 0;
    $('autoIntervalValue').textContent = formatAutoInterval(prefs.interval);
    $('autoOptions').classList.toggle('is-dormant', disabled);
    $('autoOptions').querySelectorAll('button').forEach(button => { button.disabled = disabled; });
    $('autoOptions').querySelectorAll('[data-interval]').forEach(button => {
      button.setAttribute('aria-pressed', String(!custom && Number(button.dataset.interval) === prefs.interval));
    });
    $('customIntervalButton').setAttribute('aria-pressed', String(custom));
    $('customIntervalButton').setAttribute('aria-expanded', String(custom || customIntervalOpen));
    $('autoCustom').hidden = !custom && !customIntervalOpen;
    $('customInterval').disabled = disabled;
    if (!customIntervalOpen) {
      draftIntervalUnit = prefs.customIntervalUnit;
      $('customInterval').value = draftIntervalUnit === 'seconds' ? Math.round(prefs.customInterval * 60) : prefs.customInterval;
    }
    $('customInterval').max = draftIntervalUnit === 'seconds' ? 3600 : 60;
    $('customIntervalUnits').querySelectorAll('button').forEach(button => {
      button.disabled = disabled;
      button.setAttribute('aria-pressed', String(button.dataset.timeUnit === draftIntervalUnit));
    });
    $('autoLoopNote').hidden = !disabled;
    const pool = companionMode() ? companionAutoPool() : [];
    $('autoTimingNote').textContent = companionMode()
      ? !pool.length ? 'There are no dynamic companion outfits in the current scope, so timed outfit switching is paused. Favorite a dynamic outfit or select “All in this group”.'
      : pool.length === 1 && pool[0] === current ? 'Only this dynamic companion outfit is available in the current scope. Keeping the current outfit.'
      : 'Switches only among dynamic companion outfits in this group. The timer starts after entry, and the outfit changes when the current loop ends. The timer pauses during playback pauses or while an operation panel is open.'
      : hasHeldDeparture() ? 'The timer starts from the still frame. After the selected duration, the departure animation plays before switching outfits.'
      : 'The timer starts from the still frame. The outfit changes after the selected duration.';
    renderCustomIntervalAction();
  }
  function closeCustomInterval() {
    customIntervalOpen = false;
    $('autoCustomFeedback').hidden = true;
    $('customInterval').removeAttribute('aria-invalid');
    renderAutoSwitch();
  }
  window.addEventListener('purple:help-open', closeCustomInterval);
  window.addEventListener('purple:reset-prompt', closeCustomInterval);
  function setAutoInterval(minutes, mode = 'preset', unit = intervalUnit(minutes)) {
    // Applying a new deadline (including off) cancels the pending departure,
    // restores the chosen held frame, and leaves the settings panel open.
    if (transition?.leaveAfterHold) {
      startOperation({automatic: true}); releaseSpare();
      settle(); readyControls(false); renderPlaybackMode();
    }
    resetCompanionAutoClock();
    prefs.interval = normalizeAutoInterval(minutes);
    prefs.intervalMode = mode;
    if (mode === 'custom') {
      prefs.customInterval = prefs.interval;
      prefs.customIntervalUnit = unit;
    }
    lastChange = Date.now();
    closeCustomInterval(); applyPrefs(); persist();
  }
  $('autoOptions').addEventListener('click', event => {
    if (autoSwitchDisabled()) return;
    const preset = event.target.closest('[data-interval]');
    if (preset) { setAutoInterval(Number(preset.dataset.interval)); return; }
    if (!event.target.closest('#customIntervalButton')) return;
    closeCustomInterval();
    customIntervalOpen = true;
    renderAutoSwitch();
    $('customInterval').focus({preventScroll: true}); $('customInterval').select();
    $('autoCustom').scrollIntoView({block: 'nearest'});
  });
  function clearIntervalError() {
    $('autoCustomFeedback').hidden = true; $('customInterval').removeAttribute('aria-invalid');
  }
  $('customIntervalUnits').addEventListener('click', event => {
    const button = event.target.closest('[data-time-unit]');
    if (!button || autoSwitchDisabled()) return;
    customIntervalOpen = true;
    draftIntervalUnit = button.dataset.timeUnit;
    clearIntervalError(); renderAutoSwitch();
  });
  function applyCustomInterval() {
    if (autoSwitchDisabled() || $('applyCustomInterval').disabled) return;
    const input = $('customInterval'), value = Number(input.value), max = draftIntervalUnit === 'seconds' ? 3600 : 60;
    if (!Number.isInteger(value) || value < 1 || value > max) {
      input.setAttribute('aria-invalid', 'true');
      $('autoCustomFeedback').textContent = `Enter a whole number from 1 to ${max} ${draftIntervalUnit === 'seconds' ? 'seconds' : 'minutes'}.`;
      $('autoCustomFeedback').hidden = false; input.focus(); return;
    }
    setAutoInterval(draftIntervalUnit === 'seconds' ? value / 60 : value, 'custom', draftIntervalUnit);
  }
  $('applyCustomInterval').addEventListener('click', applyCustomInterval);
  $('customInterval').addEventListener('input', () => { customIntervalOpen = true; clearIntervalError(); renderCustomIntervalAction(); });
  $('autoCustom').addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target === $('customInterval')) { event.preventDefault(); applyCustomInterval(); }
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeCustomInterval();
      $('customIntervalButton').focus({preventScroll: true});
    }
  });
  function maybeAutoSwitch() {
    updateCompanionAutoNext();
    if (companionMode()) return;
    if (suspended() || cycling() || !prefs.interval || panel || modeOpen || spinning || phase !== 'held') return;
    if (Date.now() - lastChange < Math.round(prefs.interval * 60000)) return;
    lastChange = Date.now();
    const group = wardrobeFor(current);
    const pool = randomPool(group);
    if (!pool.length) return;
    const selected = randomIndex(group);
    if (selected === current) return;
    switchAfterHold(selected);
  }
  async function switchAfterHold(next, companion = false) {
    if (!isPlayable(next) || next === current || (companion
      ? !companionMode() || !companionClip(next) || phase !== 'playing'
      : phase !== 'held' || cycling())) return;
    const task = startOperation({automatic: true});
    if (!companion) releaseSpare();
    dialogue.cancelPending(); clearTimeout(replyTimer);
    const tx = transition = {...task, automatic: true, companion, userPaused: false, waiters: new Set(),
      cancelled: false, animation: null, departing: false, outgoing: video,
      leaveAfterHold: !companion && hasHeldDeparture()};
    phase = 'transition';
    readyControls(false); renderPlaybackMode();
    $('loading').hidden = true;
    try {
      // Keep the exact held frame visible while the hidden deck prepares its own
      // first frame. No shared empty-scene image participates in this handoff.
      const incoming = await prepareNext(next);
      await waitForTransition(tx);
      if (task.id !== operation) return;
      if (tx.leaveAfterHold) {
        // Startup may only have a still image. Decode the current selected
        // frame under that image, then continue its tail without a seek to an
        // arbitrary exit point. Never leave before the next clip is ready.
        const heldTime = loadedLook === current && video.classList.contains('visible') ? video.currentTime : freezeTime();
        await ensureLoaded(current, task.signal);
        await seek(heldTime, task.signal);
        await waitForTransition(tx);
        if (task.id !== operation) return;
        video.classList.add('visible');
        tx.departing = true;
        const ended = waitForOutgoingEnd(tx);
        syncTransition();
        await ended;
        await waitForTransition(tx);
        if (task.id !== operation) return;
        tx.departing = false;
      }
      incoming.style.zIndex = '2'; incoming.style.opacity = '.001';
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await waitForTransition(tx);
      if (task.id !== operation) return;
      tx.animation = incoming.animate([{opacity: .001}, {opacity: 1}], {
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 460,
        easing: 'cubic-bezier(.4,0,.25,1)', fill: 'forwards'
      });
      syncTransition();
      await tx.animation.finished;
      await waitForTransition(tx);
      if (task.id !== operation) return;
      commitPreparedDeck(incoming, next, task.id);
      tx.animation.cancel(); video.style.opacity = ''; transition = null;
      current = next; loadedLook = next; phase = 'playing';
      // Automatic playback must not take over the wardrobe being browsed.
      $('curtain').style.backgroundImage = `url("images/${wardrobeFor(current).empty}")`;
      video.muted = !prefs.sound; video.volume = prefs.volume / 100;
      $('still').src = `images/look-${LOOKS[next].id}.jpg`;
      $('still').alt = LOOKS[next].name + ' outfit recommendation still';
      document.querySelector('.ambient').style.backgroundImage = `url("images/look-${LOOKS[next].id}.jpg")`;
      releaseSpare();
      updateCards(); persist(); updateProgress(0);
      body.classList.add('is-playing');
      readyControls(false); renderPlaybackMode();
      if (companion) {
        // A silent handoff still needs text belonging to the new outfit when
        // controls return. Do not consume an unseen entry/follow pair or wake UI.
        if (LOOKS[next].silent) {
          setStatus('HERE, WITH YOU.', '', {background: true});
        } else if (body.classList.contains('is-idle') || body.classList.contains('is-immersed')) {
          const words = dialogue.companionAmbient(next, false);
          if (words.text) setStatus('HERE, WITH YOU.', words.text, {background: true});
        }
        pendingEntry = {id: task.id, index: next, event: 'quiet', allowAffection: true};
      }
      await playSafely(task.id);
    } catch (error) {
      if (task.id !== operation || tx.cancelled) return;
      // Failed preparation leaves the previous held frame and selection intact.
      cancelTransition(); releaseSpare();
      phase = companion ? 'playing' : 'held'; lastChange = Date.now();
      resetCompanionAutoClock();
      $('loading').hidden = true;
      readyControls(false); renderPlaybackMode(); updateProgress(freezeTime());
      scheduleIdleHide();
      if (companion) playSafely(task.id);
    }
  }
