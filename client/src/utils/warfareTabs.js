let warfareTabImpl = null;

export function registerWarfareTab(fn) {
  warfareTabImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (warfareTabImpl === fn) warfareTabImpl = null;
  };
}

export function setWarfareTab(tabName) {
  return warfareTabImpl ? warfareTabImpl(tabName) : null;
}
