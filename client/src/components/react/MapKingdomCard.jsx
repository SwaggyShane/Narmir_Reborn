import { getWorldMapData } from '../../utils/worldMapData.js';
import { REGION_META } from '../../utils/raceData.js';
import { AppEvent, emitAppEvent } from '../../utils/appEvents.js';
import { useEconomyStore, useProfileStore } from '../../stores';

export function showMapKingdomCard(id, kingdomId = useProfileStore.getState().kingdom_id, marketUpgrades = useEconomyStore.getState().market_upgrades || {}) {
  const worldMapData = getWorldMapData();
  const k = worldMapData.find((entry) => String(entry.id) === String(id));
  if (!k) return;

  const state = {
    kingdomId,
    market_upgrades: marketUpgrades || {},
  };
  const meta = REGION_META[k.race] || {};
  const isMe = k.id === state.kingdomId;
  const hasTradingPost = (state.market_upgrades || {}).trading_post;

  const cardData = {
    visible: true,
    kingdom: k,
    meta,
    isMe,
    hasTradingPost,
    state,
  };

  emitAppEvent(AppEvent.MAP_KINGDOM_CARD, cardData);
}
