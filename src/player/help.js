  let settingsScrollBeforeHelp = 0;
  function setHelpView(open) {
    const wasOpen = !$('helpBody').hidden;
    if (open && !wasOpen) settingsScrollBeforeHelp = $('settingsBody').scrollTop;
    $('settingsBody').hidden = open;
    $('helpBody').hidden = !open;
    $('settingsEyebrow').hidden = open;
    $('openHelp').hidden = open;
    $('backToSettings').hidden = !open;
    $('openHelp').setAttribute('aria-expanded', String(open));
    $('settingsPanel').classList.toggle('is-help-view', open);
    $('settingsPanel').setAttribute('aria-label', open ? '使用方法' : '氛围设置');
    $('closeSettings').setAttribute('aria-label', open ? '关闭使用方法' : '关闭设置');
    if (!open && wasOpen) $('settingsBody').scrollTop = settingsScrollBeforeHelp;
  }
  function openHelp() {
    if (phase === 'editing') return;
    if (panel !== 'settings') {
      cancelSpin();
      // The first-use link disappears on entry; return focus to a stable control.
      showPanel('settings', $('settingsButton'));
      $('settingsButton').setAttribute('aria-expanded', 'true');
    }
    closeWelcome();
    closeReset(false);
    window.dispatchEvent(new Event('purple:help-open'));
    setHelpView(true);
    $('helpBody').scrollTop = 0;
    $('helpTitle').focus({preventScroll: true});
    activity(true);
  }
  $('openHelp').addEventListener('click', openHelp);
  $('firstUseHelp').addEventListener('click', openHelp);
  $('backToSettings').addEventListener('click', () => {
    setHelpView(false);
    $('openHelp').focus({preventScroll: true});
  });
