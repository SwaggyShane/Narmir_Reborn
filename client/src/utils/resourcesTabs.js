let resourcesTabImpl = null;
let pendingTab = null;

export function registerResourcesTab(fn) {
  resourcesTabImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (resourcesTabImpl === fn) resourcesTabImpl = null;
  };
}

// If ResourcesPanel is already mounted (registered), switch it immediately.
// Otherwise (e.g. called from another panel, before ResourcesPanel exists
// yet) stash the request so ResourcesPanel can pick it up as its initial
// tab the moment it mounts -- mounting is asynchronous relative to this
// call, so we can't assume the panel is registered yet just because this
// runs right after switching the active panel.
export function setResourcesTab(tabName) {
  if (resourcesTabImpl) {
    resourcesTabImpl(tabName);
  } else {
    pendingTab = tabName;
  }
}

export function consumePendingResourcesTab() {
  const tab = pendingTab;
  pendingTab = null;
  return tab;
}
