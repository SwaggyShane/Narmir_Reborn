let warfareTabImpl = null;
let pendingTab = null;

export function registerWarfareTab(fn) {
  warfareTabImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (warfareTabImpl === fn) warfareTabImpl = null;
  };
}

// If WarfarePanel is already mounted (registered), switch it immediately.
// Otherwise (e.g. called from another panel, before WarfarePanel exists yet)
// stash the request so WarfarePanel can pick it up as its initial tab the
// moment it mounts -- mounting is asynchronous relative to this call, so we
// can't assume the panel is registered yet just because this runs right
// after switching the active panel.
export function setWarfareTab(tabName) {
  if (warfareTabImpl) {
    warfareTabImpl(tabName);
  } else {
    pendingTab = tabName;
  }
}

export function consumePendingWarfareTab() {
  const tab = pendingTab;
  pendingTab = null;
  return tab;
}
