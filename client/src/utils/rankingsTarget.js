import { switchTab } from './panelNav.js';
import { setWarfareTarget } from './warfareTabs.js';

// Navigate to the Warfare panel's attack/spells/covert tab with a specific
// kingdom pre-selected as the target — used by the world map card, kingdom
// profile modal, and rankings row action buttons.
export function targetFromRankings(id, tab) {
  setWarfareTarget(id);
  switchTab(tab);
}
