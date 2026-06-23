import { apiCall } from './api.js';
import { toast } from './toast.js';
import { repairMojibake } from './repairMojibake.js';
import { gameStateManager } from '../GameStateManager.js';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const replayWarReport = async (id) => {
  try {
    const warLogCache = Array.isArray(gameStateManager.getState().warLogCache) ? gameStateManager.getState().warLogCache : [];
    let row = warLogCache.find((r) => r.id == id);

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

    const modal = document.getElementById('replay-modal');
    const title = document.getElementById('replay-modal-title');
    const content = document.getElementById('replay-modal-content');
    if (!modal || !title || !content) {
      toast('System Error: Replay modal not found', 'error');
      return;
    }

    title.innerHTML =
      '⚔ ' +
      escapeHtml(repairMojibake(row.attacker_name || 'Unknown')) +
      ' vs ' +
      escapeHtml(repairMojibake(row.defender_name || 'Unknown'));
    content.innerHTML = '';
    modal.style.display = 'flex';

    let i = 0;
    const nextStep = () => {
      if (modal.style.display === 'none') return;
      if (i >= details.steps.length) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.style.width = '100%';
        btn.style.marginTop = '16px';
        btn.textContent = 'Finish Replay';
        btn.onclick = () => { modal.style.display = 'none'; };
        content.appendChild(btn);
        content.scrollTop = content.scrollHeight;
        return;
      }

      const step = details.steps[i];
      const div = document.createElement('div');
      div.style.marginBottom = '12px';
      div.style.padding = '10px';
      div.style.background = 'rgba(255,255,255,0.05)';
      div.style.borderRadius = 'var(--radius)';
      div.style.borderLeft = `3px solid ${String(step.icon || '').includes('⚔') ? 'var(--red)' : 'var(--accent)'}`;
      div.style.opacity = '0';
      div.style.transform = 'translateX(20px)';
      div.style.transition = 'all 0.3s ease';
      div.innerHTML =
        '<div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:4px">' +
        escapeHtml(repairMojibake(step.icon || '⚔')) +
        ' ' +
        escapeHtml(repairMojibake(step.title || 'Battle Step')) +
        '</div>' +
        '<div style="font-size:13px;color:var(--text);white-space:pre-wrap">' +
        escapeHtml(repairMojibake(step.msg || '')) +
        '</div>';

      content.appendChild(div);
      void div.offsetWidth;
      div.style.opacity = '1';
      div.style.transform = 'translateX(0)';
      content.scrollTop = content.scrollHeight;
      i += 1;
      setTimeout(nextStep, 1000);
    };

    setTimeout(nextStep, 100);
  } catch (error) {
    console.error('Replay Error:', error);
    toast('Error viewing replay: ' + error.message, 'error');
  }
};
