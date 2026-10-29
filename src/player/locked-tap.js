  function lockedTap(index) {
    if (!LOOKS[index]?.locked || isPlayable(index)) return;
    const now = performance.now();
    activity(true);
    if (now - lastPrivateReply < 1500) return;
    lastPrivateReply = now;
    if (LOOKS[index].silent) {
      toast('Not yet open', LOOKS[index].name);
    } else {
      privateVisits++;
      const aside = privateVisits >= 4 && now - lastPrivateAside >= 90000;
      if (aside) { privateVisits = 0; lastPrivateAside = now; }
      respond(index, aside ? 'aside' : 'locked', 'A LITTLE SECRET.');
    }
    const card = document.querySelector(`[data-look="${index}"]`);
    if (card) {
      card.classList.remove('locked-peek');
      void card.offsetWidth;
      card.classList.add('locked-peek');
    }
  }
