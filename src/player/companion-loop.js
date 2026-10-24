  // Loop only the authored idle section. The first entry remains a normal play
  // from zero; subsequent rounds never go through the empty-sofa dissolve.
  let companionSwap = null;
  const companionClip = (index = current) => LOOKS[index]?.companion;
  const companionMode = () => prefs.playbackMode === 'companion' && Boolean(companionClip());
  const companionStart = () => companionClip().startFrame / companionClip().fps;
  const companionBoundary = () => (companionClip().endFrame - 2) / companionClip().fps;

  function cancelCompanionSwap() {
    const item = companionSwap;
    if (!item) return;
    companionSwap = null;
    clearTimeout(item.timeout);
    if (item.frame != null) {
      if (item.videoFrame) item.incoming.cancelVideoFrameCallback(item.frame);
      else cancelAnimationFrame(item.frame);
    }
    item.incoming.pause(); item.incoming.muted = true;
    item.incoming.style.opacity = '0'; item.incoming.style.zIndex = '1';
    // A warmed deck has moved beyond the seam. Prepare it at the exact target
    // again after resume instead of exposing its later, stale frame.
    cancelPrepared();
  }
  function primeCompanion() {
    if (spinning && selectionWarm?.item === prefetch) return;
    if (!companionMode() || companionSwap || companionAutoNext || !['playing', 'paused'].includes(phase)) return;
    const index = current, id = operation, target = companionStart();
    prepareNext(index, target).then(deck => {
      if (id !== operation || !companionMode() || current !== index || deck !== spare || companionSwap || companionAutoNext) return;
      // Chrome may stop composing a fully occluded video. Keep the prepared
      // surface on top with a contribution below one 8-bit channel level.
      deck.style.zIndex = '2'; deck.style.opacity = '.001';
      if (phase === 'playing' && !suspended() && video.currentTime >= companionBoundary() - .001) advanceCompanion();
    }).catch(() => {});
  }
  async function advanceCompanion() {
    if (!companionMode() || companionSwap || phase !== 'playing' || suspended()) return;
    selectionWarm = null;
    if (switchCompanionAtBoundary()) return;
    const item = { id: operation, index: current, incoming: spare, outgoing: video,
      frame: null, videoFrame: false, timeout: null };
    companionSwap = item;
    const valid = () => companionSwap === item && item.id === operation && item.index === current && companionMode();
    const fail = error => {
      if (!valid()) return;
      cancelCompanionSwap();
      if (error.name === 'AbortError' || suspended() || phase !== 'playing') return;
      // Retain the last visible frame and a usable play button on decode failure.
      phase = 'paused'; video.pause(); stopWatcher(); clearLoadingHint();
      body.classList.remove('is-playing'); readyControls(false);
      toast('循环衔接暂时中断，点播放继续。', '播放提示');
    };
    try {
      const target = companionStart();
      const incoming = await prepareNext(current, target);
      if (!valid() || suspended() || phase !== 'playing') return;
      incoming.style.zIndex = '2'; incoming.style.opacity = '.001'; incoming.muted = true;
      item.timeout = setTimeout(() => fail(new Error('companion-frame-timeout')), 3000);
      const frame = (_, metadata) => {
        item.frame = null;
        if (!valid() || suspended() || phase !== 'playing') return;
        const time = metadata ? metadata.mediaTime : incoming.currentTime;
        if (incoming.paused || incoming.seeking || incoming.readyState < 2 || time < target - .002) { schedule(); return; }
        const outgoingTime = item.outgoing.currentTime;
        try { commitPreparedDeck(incoming, item.index, item.id); }
        catch (error) { fail(error); return; }
        clearTimeout(item.timeout); companionSwap = null;
        video.volume = prefs.volume / 100; video.muted = !prefs.sound;
        clearLoadingHint(); updateProgress(time);
        // No preference write, dialogue, activity, or UI rebuild on each lap.
        window.dispatchEvent(new CustomEvent('purple:companion-seam', {detail: {
          look: LOOKS[current].id, quality: prefs.quality, outgoingTime, incomingTime: time, target
        }}));
        watchFrames(); primeLoop();
      };
      const schedule = () => {
        item.videoFrame = typeof incoming.requestVideoFrameCallback === 'function';
        item.frame = item.videoFrame ? incoming.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
      };
      schedule();
      await incoming.play();
    } catch (error) { fail(error); }
  }
