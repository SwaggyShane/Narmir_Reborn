import { apiCall } from './api.mjs';
import { toast } from './toast.js';
import { repairMojibake } from './repairMojibake.js';

let _openReplayModal = null;

export function registerReplayModal(fn) {
  _openReplayModal = fn;
}

export const replayWarReport = async (id) => {
  try {
    let row = null;

    if (!row) {
      const loaded = await apiCall(`/api/kingdom/war-log/${id}`);
      if (loaded && !loaded.error) {
        row = loaded;
      } else {
        toast('Replay data not found. Try refreshing.', 'error');
        return;
      }
    }

    let details = row.detail;
    while (typeof details === 'string') {
      details = JSON.parse(details);
    }

    if (!details || !Array.isArray(details.steps) || details.steps.length === 0) {
      toast('This report has no replay data.', 'error');
      return;
    }

    if (!_openReplayModal) {
      toast('System Error: Replay modal not available', 'error');
      return;
    }

    const title =
      '⚔ ' +
      repairMojibake(row.attacker_name || 'Unknown') +
      ' vs ' +
      repairMojibake(row.defender_name || 'Unknown');

    _openReplayModal({ title, steps: details.steps });
  } catch (error) {
    console.error('Replay Error:', error);
    toast('Error viewing replay: ' + error.message, 'error');
  }
};
