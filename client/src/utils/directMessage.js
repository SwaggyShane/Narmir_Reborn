let openDirectMessageImpl = null;

export function registerOpenDirectMessage(fn) {
  openDirectMessageImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (openDirectMessageImpl === fn) openDirectMessageImpl = null;
  };
}

export function openDirectMessage(playerId, name) {
  return openDirectMessageImpl ? openDirectMessageImpl({ playerId, name }) : null;
}
