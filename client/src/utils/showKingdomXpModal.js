let showKingdomXpModalImpl = null;

export function registerShowKingdomXpModal(fn) {
  showKingdomXpModalImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (showKingdomXpModalImpl === fn) showKingdomXpModalImpl = null;
  };
}

export function showKingdomXpModal() {
  return showKingdomXpModalImpl ? showKingdomXpModalImpl() : null;
}