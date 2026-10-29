function closeReset(restoreFocus = true) {
    if ($('resetConfirm').hidden) return;
    $('resetConfirm').hidden = true;
    $('resetSettingsButton').setAttribute('aria-expanded', 'false');
    $('resetFeedback').hidden = true;
    if (restoreFocus) $('resetSettingsButton').focus({preventScroll: true});
  }

  $('resetSettingsButton').addEventListener('click', () => {
    if (!$('resetConfirm').hidden) { closeReset(); return; }
    // Finish an unsaved position preview before showing a separate confirmation.
    window.dispatchEvent(new Event('purple:reset-prompt'));
    $('resetFeedback').hidden = true;
    $('resetConfirm').hidden = false;
    $('resetSettingsButton').setAttribute('aria-expanded', 'true');
    $('cancelReset').focus({preventScroll: true});
    $('resetConfirm').scrollIntoView({block: 'nearest'});
  });

  $('cancelReset').addEventListener('click', () => closeReset());

  $('confirmReset').addEventListener('click', () => {
    if (panel !== 'settings' || $('resetConfirm').hidden) return;

    const next = {...defaults, favorites: [], freezes: [...defaults.freezes], wardrobeLooks: {...defaults.wardrobeLooks}, wardrobeModes: {...defaults.wardrobeModes}, wardrobeRandomScopes: {...defaults.wardrobeRandomScopes}, wardrobeOrders: {...defaults.wardrobeOrders},
      // Host synchronization metadata is not a user preference. Retain the last
      // observed values so a repeated host callback cannot undo the reset.
      nativeValues: {...prefs.nativeValues, __resetBaseline: true}};

    const updates = [[KEY, JSON.stringify(next)], [KEY + '.reading-v1', JSON.stringify({size: 'standard'})],
      [KEY + '.layout-v1', JSON.stringify({offsetRatio: 0, playbackOffsetRatio: 0})], [KEY + '.interface', 'normal'], [KEY + '.companion-dialogue-v1', '{}']];

    const originals = [], written = [];

    try {
      for (const [key] of updates) originals.push([key, localStorage.getItem(key)]);
      for (const [key, value] of updates) {
        localStorage.setItem(key, value);
        written.push(key);
      }
    } catch (_) {
      for (const [key, value] of originals) {
        if (!written.includes(key)) continue;
        try {
          if (value === null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        } catch (_) {}
      }

      $('resetFeedback').textContent = 'Unable to save the reset results right now. Please try again later.';
      $('resetFeedback').hidden = false;
      return;
    }

    // Cancel every pending playback/spin task before it can persist old choices.
    startOperation();
    phase = 'held';
    cancelSpin();
    releaseSpare();

    video.classList.remove('visible');
    video.style.opacity = '';
    video.removeAttribute('src');
    video.removeAttribute('data-look');
    video.removeAttribute('data-quality');
    video.load();

    audioContext?.suspend().catch(() => {});
    loadedLook = -1;

    clearTimeout(replyTimer);
    clearTimeout(toastTimer);
    clearTimeout(idleTimer);

    $('toast').classList.remove('show');
    $('loading').hidden = true;
    $('curtain').classList.remove('closed');
    body.classList.remove('is-playing', 'is-immersed', 'is-idle');

    Object.assign(prefs, next);
    WARDROBES.forEach(arrangeWardrobe);

    for (const group of WARDROBES) browsePages[group.id] = 0;

    CHAPTERS = wardrobe.chapters;
    current = defaults.current;
    page = pageFor(current);

    setImmersed(false);

    bag = [];
    editorOriginal = null;
    privateVisits = 0;
    lastPrivateReply = lastPrivateAside = -Infinity;

    dialogue = window.createPurpleDialogue({
      looks: LOOKS,
      replies: REPLIES,
      affection: window.PURPLE_AFFECTION,
      wardrobes: WARDROBE_DIALOGUES,
      isPlayable,
      storage: localStorage,
      storageKey: KEY + '.companion-dialogue-v1'
    });

    lastChange = Date.now();

    closeModeMenu(false);
    closePanel();

    // These modules update their in-memory state without writing additional keys.
    window.dispatchEvent(new Event('purple:reset-settings'));

    showRememberedStill();

    $('timelineState').textContent = 'Still';
    icon($('playButton'), 'repeat');

    $('playButton').title = 'Replay entrance';
    $('playButton').setAttribute('aria-label', 'Replay entrance');

    readyControls(false);
    showWelcome('Initial state restored');
  });
