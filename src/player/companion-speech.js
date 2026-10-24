  // Auto-hidden controls keep rotating text; host suspension still stops the clock.
  let companionSpeechLook = null, companionSpeechDue = 0, companionSpeechBlocked = true;
  let companionReplyUntil = 0;
  const companionSpeechDelay = () => {
    const [min, max] = window.PURPLE_COMPANION_DIALOGUES.timing.intervalMs;
    return min + Math.random() * (max - min);
  };
  function blockCompanionSpeech() {
    companionSpeechBlocked = true; companionSpeechDue = 0;
    dialogue.skipCompanionFollow();
  }
  function tickCompanionSpeech() {
    const idle = body.classList.contains('is-idle');
    const active = Boolean(companionClip()) && !LOOKS[current].silent && phase === 'playing' && !suspended() && !video.paused &&
      !video.seeking && video.readyState >= 2 && !panel && !modeOpen && !spinning &&
      !body.classList.contains('is-immersed') &&
      $('firstUseHint').hidden && (idle || $('statusText').getClientRects().length);
    if (!active) {
      // A hidden entry must not leave a follow-up waiting for the next wake.
      blockCompanionSpeech();
      return;
    }
    const id = LOOKS[current].id, now = performance.now();
    if (companionSpeechLook !== id || companionSpeechBlocked) {
      companionSpeechLook = id; companionSpeechBlocked = false;
      companionSpeechDue = now + companionSpeechDelay();
    }
    if (video.currentTime + .002 < companionStart() || now < companionReplyUntil || $('toast').classList.contains('show')) return;
    const follow = idle ? '' : dialogue.companionFollow(current, video.currentTime);
    if (follow) {
      setStatus('HERE, WITH YOU.', follow);
      companionSpeechDue = now + companionSpeechDelay();
      return;
    }
    // The paired follow-up also works when this look is played into a freeze.
    // Only the authored companion mode gets the ongoing conversation clock.
    if (!companionMode()) { companionSpeechDue = 0; return; }
    if (!companionSpeechDue) companionSpeechDue = now + companionSpeechDelay();
    if (now < companionSpeechDue) return;
    const response = dialogue.companionAmbient(current, !idle);
    if (response.text) setStatus('HERE, WITH YOU.', response.text, {background: idle});
    companionSpeechDue = now + companionSpeechDelay();
  }
