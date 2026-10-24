  // Both safe playback decks are protected by the controller's play() guards.
  window.livelyWallpaperPlaybackChanged = function (data) {
    let state;
    try { state = typeof data === 'string' ? JSON.parse(data) : data; }
    catch (_) { return; }
    if (!state || typeof state.IsPaused !== 'boolean') return;
    systemPaused = state.IsPaused;
    onSuspend();
  };
