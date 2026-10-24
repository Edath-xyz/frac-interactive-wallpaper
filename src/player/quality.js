  // One source selector is shared by foreground playback and speculative decks.
  function mediaQuality(index, requested = prefs.quality) {
    const available = LOOKS[index].videoQualities || VIDEO_QUALITIES;
    return available.includes(requested) ? requested : 'original';
  }
  function mediaSource(index, quality = prefs.quality) {
    quality = mediaQuality(index, quality);
    return `media/${quality === 'original' ? '' : quality + '/'}look-${LOOKS[index].id}.webm`;
  }
  function playbackFPS() { return mediaQuality(current) === 'original' ? LOOKS[current].fps : 60; }
  function renderQuality() {
    const busy = ['loading', 'transition', 'editing'].includes(phase);
    $('qualityOptions').setAttribute('aria-busy', String(busy));
    $('qualityNotice').hidden = !LOOKS[current].videoQualities || LOOKS[current].videoQualities.length === VIDEO_QUALITIES.length;
    document.querySelectorAll('#qualityOptions [data-quality]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.quality === prefs.quality));
      button.disabled = busy || !(LOOKS[current].videoQualities || VIDEO_QUALITIES).includes(button.dataset.quality);
      if (button.dataset.quality === 'original') button.textContent = LOOKS[current].baseQualityLabel || '基础视频';
    });
  }
  async function setQuality(quality) {
    if (!VIDEO_QUALITIES.includes(quality) || quality === prefs.quality || ['loading', 'transition', 'editing'].includes(phase)) return;
    const previousQuality = prefs.quality;
    const previousPhase = phase;
    const time = video.currentTime;
    const hasFrame = loadedLook === current && video.readyState >= 1 && video.classList.contains('visible');
    cancelSpin({resume: false});
    prefs.quality = quality;
    persist();
    // The recommended still needs no decoder. The next play or frame edit uses
    // the new choice; the existing custom frame, when present, is reloaded below.
    if (!hasFrame || phase === 'error') {
      releaseSpare(); renderQuality(); activity(true);
      return;
    }
    const index = current;
    const task = startOperation();
    releaseSpare();
    phase = 'loading'; body.classList.remove('is-playing'); readyControls(true);
    loadingTimer = setTimeout(() => { if (task.id === operation && canShowLoadingHint()) $('loading').hidden = false; }, 900);
    try {
      // Hold the old frame while loading and seeking the same moment on the
      // spare deck. A cancelled request must never swap over a newer selection.
      const incoming = await prepareNext(index, time);
      if (task.id !== operation) return;
      commitPreparedDeck(incoming, index, task.id);
      releaseSpare();
    } catch (error) {
      if (task.id !== operation) return;
      // The old deck is still intact. Keep it usable if the chosen file fails.
      releaseSpare();
      prefs.quality = previousQuality; persist();
      if (error.name !== 'AbortError') toast('这档画质暂时无法加载，已保留原画质。', '播放提示');
    }
    if (task.id !== operation) return;
    phase = previousPhase;
    clearTimeout(loadingTimer); $('loading').hidden = true;
    video.muted = !prefs.sound; video.volume = prefs.volume / 100;
    body.classList.toggle('is-playing', phase === 'playing');
    readyControls(false); renderPlaybackMode(); updateProgress(video.currentTime); activity(true);
    if (phase === 'playing') await playSafely(task.id);
    else if (phase === 'paused') primeLoop();
  }
  $('qualityOptions').addEventListener('click', event => {
    const button = event.target.closest('button[data-quality]');
    if (button && !button.disabled) setQuality(button.dataset.quality);
  });
