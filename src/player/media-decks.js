  // One prepared request owns the spare. Aborting it invalidates all pending
  // work; decoded media may stay cached for a later request for the same clip.
  function cancelPrepared() {
    const item = prefetch;
    prefetch = null;
    item?.controller.abort();
  }
  function releaseSpare() {
    cancelCompanionAutoNext();
    cancelCompanionSwap();
    cancelPrepared();
    releaseOpening();
    spare.pause(); spare.muted = true;
    spare.style.opacity = '0'; spare.style.zIndex = '1';
    spare.removeAttribute('src'); spare.removeAttribute('data-look'); spare.removeAttribute('data-quality'); spare.load();
  }
  function prepareNext(index, target = 0) {
    if (!isPlayable(index)) return Promise.reject(new Error('unavailable'));
    const quality = prefs.quality;
    if (prefetch?.index === index && prefetch.quality === quality && prefetch.target === target &&
        prefetch.element === spare && !prefetch.controller.signal.aborted) return prefetch.promise;
    cancelPrepared();
    const item = {index, quality, target, element: spare, controller: new AbortController(), ready: false, promise: null};
    prefetch = item;
    const deck = item.element, signal = item.controller.signal;
    const check = () => {
      if (signal.aborted || prefetch !== item || deck !== spare) throw new DOMException('Cancelled', 'AbortError');
    };
    deck.pause(); deck.muted = true; deck.style.opacity = '0'; deck.style.zIndex = '1';
    item.promise = (async () => {
      if (deck.dataset.look !== LOOKS[index].id || deck.dataset.quality !== quality || deck.readyState < 2) {
        // Clear identity before load: a superseding request must not mistake
        // an unfinished source replacement for the previous decoded clip.
        delete deck.dataset.look; delete deck.dataset.quality;
        await mediaEvent('loadeddata', signal, () => {
          deck.preload = 'auto'; deck.src = mediaSource(index, quality); deck.load();
        }, deck);
        check();
        deck.dataset.look = LOOKS[index].id; deck.dataset.quality = quality;
      }
      check();
      await seek(target, signal, deck);
      check();
      item.ready = true;
      return deck;
    })();
    item.promise.catch(() => { if (prefetch === item) cancelPrepared(); });
    return item.promise;
  }
  // Physical deck exchange only. Mode, dialogue, persistence and activity
  // remain with the caller; an idle-loop lap must not rebuild the interface.
  function commitPreparedDeck(incoming, index, id = operation) {
    const item = prefetch;
    if (id !== operation || incoming !== spare || item?.element !== incoming || !item.ready ||
        item.index !== index || item.quality !== prefs.quality || item.controller.signal.aborted) {
      throw new DOMException('Cancelled', 'AbortError');
    }
    stopWatcher();
    const outgoing = video;
    outgoing.muted = true; outgoing.pause();
    prefetch = null;
    video = incoming; spare = outgoing;
    spare.id = 'filmNext'; video.id = 'film';
    video.classList.add('visible'); video.style.opacity = ''; video.style.zIndex = '1';
    video.muted = true; video.volume = prefs.volume / 100;
    spare.classList.remove('visible'); spare.style.opacity = '0'; spare.style.zIndex = '1'; spare.muted = true;
    loadedLook = index;
    return outgoing;
  }
