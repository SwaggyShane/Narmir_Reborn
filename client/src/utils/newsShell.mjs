import newsEmojiTools from "../../../game/news-emoji.js";
import { repairMojibake } from "./repairMojibake.js";

const { decorateNewsMessage, getNewsMeta } = newsEmojiTools;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function appendNewsItems({
  events,
  newsCache,
  state,
  newsFilter,
  playGameSound,
  incrementNewsBadge,
  summarizeAttackNewsForAll,
  documentRef = document,
}) {
  if (!events || !events.length) return;

  const soundsToPlay = {};

  events.forEach(function (ev) {
    const m = repairMojibake(ev.message || "").toLowerCase();

    if (m.includes("season:")) soundsToPlay.seasonal_event = true;
    if (m.includes("kingdom level up")) soundsToPlay.level_up = true;
    if (m.includes("spell") && m.includes("cast")) soundsToPlay.spell_recv = true;
    if (m.includes("completed: ") || m.includes("completed ")) soundsToPlay.build_complete = true;
    if (m.includes("food shortage") || m.includes("starved")) soundsToPlay.food_shortage = true;
    if (m.includes("mana empty")) soundsToPlay.mana_low = true;
    if (m.includes("trade route raided") || m.includes("attacked and")) soundsToPlay.error = true;
  });

  Object.keys(soundsToPlay).forEach(function (snd) {
    playGameSound(snd);
  });

  const now = Math.floor(Date.now() / 1000);

  events.forEach(function (ev) {
    newsCache.unshift({
      type: ev.type || "system",
      message: decorateNewsMessage(ev.message || ev),
      turn_num: state.turn || 0,
      created_at: now,
    });
  });

  const list = documentRef.getElementById("news-list");
  if (!list) {
    return;
  }

  Array.from(list.children).forEach(function (child) {
    if (!child.classList.contains("news-turn-group")) child.remove();
  });

  const rows = events
    .map(function (ev) {
      const type = ev.type || "system";
      const meta = getNewsMeta(type);
      let msg =
        newsFilter === "all" && type === "attack"
          ? summarizeAttackNewsForAll(ev)
          : repairMojibake(ev.message || ev);
      msg = decorateNewsMessage(msg);
      const isBorderType = type === "attack" || type === "spell" || type === "covert";
      const borderStyle = isBorderType
        ? "border-left:3px solid " + meta.color + ";padding-left:10px;"
        : "";

      return (
        '<div class="news-item" style="' +
        borderStyle +
        '">' +
        '<span class="news-icon">' +
        repairMojibake(meta.icon) +
        "</span>" +
        '<span class="news-body" style="color:' +
        (isBorderType ? "var(--text)" : "var(--text2)") +
        '">' +
        escapeHtml(String(repairMojibake(msg))).replace(/\n/g, "<br>") +
        "</span>" +
        "</div>"
      );
    })
    .join("");

  const group =
    '<div class="news-turn-group">' +
    '<div class="news-turn-header">' +
    '<span class="turn-label">Turn ' +
    (state.turn || "-") +
    "</span>" +
    '<span class="turn-time">Just now</span>' +
    "</div>" +
    rows +
    "</div>";

  list.insertAdjacentHTML("afterbegin", group);
  incrementNewsBadge(events.length);
}
