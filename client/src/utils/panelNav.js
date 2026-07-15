/**
 * Pure navigation utilities (no state management).
 * All state now flows through Zustand stores only.
 */
import { setActivePanelGlobal } from '../hooks/useActivePanel.js';
import { setWarfareTab as applyWarfareTab } from './warfareTabs.js';
import { setResourcesTab as applyResourcesTab } from './resourcesTabs.js';

function normalizePanelName(tabName) {
  const PANEL_ALIASES = { attack: 'warfare', spells: 'warfare', covert: 'warfare', nodes: 'resources' };
  const raw = String(tabName || '').trim().replace(/^#/, '');
  return raw ? (PANEL_ALIASES[raw] || raw) : 'status';
}

export function switchTab(tabName) {
  const WARFARE_SUBTAB_ALIASES = { attack: 'attack', spells: 'wspells', covert: 'wcovert' };
  const RESOURCES_SUBTAB_ALIASES = { nodes: 'nodes' };
  const rawTab = String(tabName || '').trim().replace(/^#/, '') || 'status';
  const activeTab = normalizePanelName(rawTab);
  const warfareSubtab = WARFARE_SUBTAB_ALIASES[rawTab] || null;
  const resourcesSubtab = RESOURCES_SUBTAB_ALIASES[rawTab] || null;

  setActivePanelGlobal(activeTab);
  if (warfareSubtab) applyWarfareTab(warfareSubtab);
  if (resourcesSubtab) applyResourcesTab(resourcesSubtab);
  if (window.location.hash !== `#${rawTab}`) window.location.hash = rawTab;
}
