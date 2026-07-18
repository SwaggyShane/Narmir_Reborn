let warfareTabImpl = null;
let pendingTab = null;
let pendingTargetId = null;

export function registerWarfareTab(fn) {
  warfareTabImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (warfareTabImpl === fn) warfareTabImpl = null;
  };
}

// A specific kingdom to pre-select once the relevant target list loads (map
// card / kingdom profile / rankings row "Attack"/"Spell"/"Covert" buttons).
// Unlike pendingTab, this can't be consumed-and-cleared in one step: the
// target list itself loads asynchronously (a separate API call) after the
// tab switch, so the caller needs to peek repeatedly until that list is
// populated and only clear once it's actually found a match in it.
export function setWarfareTarget(id) {
  pendingTargetId = id;
}

export function peekPendingWarfareTarget() {
  return pendingTargetId;
}

export function clearPendingWarfareTarget() {
  pendingTargetId = null;
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
