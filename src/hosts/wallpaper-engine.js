  window.wallpaperPropertyListener = {
    setPaused(isPaused) { systemPaused = Boolean(isPaused); onSuspend(); },
    applyUserProperties(properties) {
      let apply = false, store = false;
      const changed = key => {
        if (!properties[key]) return false;
        const value = properties[key].value;
        const known = Object.prototype.hasOwnProperty.call(prefs.nativeValues, key);
        if (known && prefs.nativeValues[key] === value) return false;
        prefs.nativeValues[key] = value;
        store = true;
        // A reset before the host's first callback also needs a baseline. Later
        // intentional edits of known properties continue to work normally.
        const accepted = known || !prefs.nativeValues.__resetBaseline;
        apply ||= accepted;
        return accepted;
      };
      if (changed('sound')) prefs.sound = Boolean(properties.sound.value);
      if (changed('volume')) prefs.volume = number(properties.volume.value, prefs.volume, 0, 100);
      if (changed('brightness')) prefs.brightness = number(properties.brightness.value, prefs.brightness, 65, 115);
      if (changed('autohide')) {
        prefs.autoHide = Boolean(properties.autohide.value);
        if (!prefs.autoHide) body.classList.remove('is-idle');
      }
      if (changed('fit')) prefs.fit = properties.fit.value === 'cover' ? 'cover' : 'contain';
      if (changed('autoswitch')) {
        const minutes = [0,.25,1,5,15,20,30].includes(Number(properties.autoswitch.value)) ? Number(properties.autoswitch.value) : 0;
        setAutoInterval(minutes, isPresetInterval(minutes) ? 'preset' : 'custom');
      }
      const lookChanged = changed('look');
      if (changed('startupinterface')) {
        const policy = ['remember', 'immersed', 'visible'].includes(properties.startupinterface.value)
          ? properties.startupinterface.value : 'remember';
        if (policy !== prefs.startupInterface) {
          immersionRequest++;
          prefs.startupInterface = policy;
          if (policy === 'immersed') enterImmersion();
          else if (policy === 'visible') wake();
        }
      }
      if (['sound', 'volume', 'brightness', 'autohide', 'fit', 'autoswitch', 'look', 'startupinterface'].every(key => Object.prototype.hasOwnProperty.call(prefs.nativeValues, key))) {
        delete prefs.nativeValues.__resetBaseline;
      }
      // Host synchronization is not pointer/keyboard activity. Repeated values
      // also must not restart idle timers, reapply media state or overwrite an exit.
      if (apply) applyPrefs();
      if (store) persist();
      if (lookChanged) {
        const index = LOOKS.findIndex((look, index) => Number(look.hostValue ?? index + 1) === Number(properties.look.value));
        if (isPlayable(index)) selectLook(index, {restore: true});
      }
    }
  };
