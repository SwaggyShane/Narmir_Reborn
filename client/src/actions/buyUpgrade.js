import { apiCall, applyGameMutation, syncUI } from '../utils/shellBridge.js';
import { toast } from '../utils/toast.js';

export async function buyUpgrade(category, key) {
  const endpoint = category === 'mausoleum'
    ? '/api/kingdom/buy-mausoleum-upgrade'
    : '/api/kingdom/economy/upgrade';

  const result = await apiCall('POST', endpoint, {
    category,
    upgradeKey: key,
  });

  if (result.error) return toast(result.error, 'error');

  window.playGameSound?.('upgrade_purchased');

  if (result.updates) {
    applyGameMutation(result, { reason: 'economy-upgrade' });
  }

  syncUI();

  toast('Upgrade purchased! Refresh the panel to see the next upgrade.', 'success');

  const btn = document.querySelector(
    `[onclick="buyUpgrade('${category}','${key}')"]`,
  );

  if (btn) {
    btn.textContent = '✅ Purchased';
    btn.disabled = true;
    btn.style.opacity = '0.6';
  }
}
