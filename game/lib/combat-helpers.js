// game/lib/combat-helpers.js
// Combat formatting and utility helpers — pure functions for combat report generation.

const COMBAT_NEWS_UNIT_LABELS = {
  thralls: "Thralls",
  fighters: "Fighters",
  rangers: "Rangers",
  mages: "Mages",
  clerics: "Clerics",
  ninjas: "Ninjas",
  thieves: "Thieves",
  engineers: "Engineers",
  war_machines: "War Machines",
};

const COMBAT_NEWS_UNIT_ORDER = [
  "thralls",
  "fighters",
  "rangers",
  "mages",
  "clerics",
  "ninjas",
  "thieves",
  "engineers",
  "war_machines",
];

function happinessMult(happiness) {
  if (happiness < 50) return 0.8 + (happiness / 50) * 0.1;
  if (happiness < 100) return 0.9 + ((happiness - 50) / 50) * 0.1;
  return Math.min(1.2, 1.0 + ((happiness - 100) / 100) * 0.1);
}

function happinessCombatMult(happiness) {
  const mult = 0.5 + (happiness / 120);
  return Math.max(0.5, Math.min(1.5, mult));
}

function sumRecordValues(record = {}) {
  return Object.values(record).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function normalizeCombatUnits(units = {}) {
  return {
    thralls: units.thralls || 0,
    fighters: units.fighters || 0,
    rangers: units.rangers || 0,
    mages: units.mages || 0,
    clerics: units.clerics || 0,
    ninjas: units.ninjas || 0,
    thieves: units.thieves || 0,
    engineers: units.engineers || 0,
    war_machines: units.war_machines || units.warMachines || 0,
  };
}

function formatCombatUnitCounts(units = {}, labels = COMBAT_NEWS_UNIT_LABELS) {
  const normalized = normalizeCombatUnits(units);
  const parts = COMBAT_NEWS_UNIT_ORDER
    .filter((unit) => normalized[unit] > 0)
    .map((unit) => `${(normalized[unit] || 0).toLocaleString()} ${labels[unit] || COMBAT_NEWS_UNIT_LABELS[unit]}`);
  return parts.length ? parts.join(", ") : "None";
}

function formatCombatBuildingsLost(report = {}) {
  const parts = [];
  if (report.wallsDestroyed > 0) parts.push(`${report.wallsDestroyed.toLocaleString()} Walls`);
  if (report.defBldLost > 0) parts.push(`${report.defBldLost.toLocaleString()} Buildings`);
  if (report.buildingDamaged) parts.push(String(report.buildingDamaged).replace(/_/g, " "));
  return parts.length ? parts.join(", ") : "None";
}

function formatCombatV2NewsBlurb(attacker, defender, report, perspective = "attacker") {
  const fmt = (value) => (Number(value) || 0).toLocaleString();
  const attackerName = attacker?.name || "The attacking host";
  const defenderName = defender?.name || "the defending kingdom";
  const land = report.landTransferred || 0;
  const attackerLost = report.injuredTroops?.attacker?.deadByType || {
    thralls: report.atkThrallsLost,
    fighters: report.atkFightersLost,
    rangers: report.atkRangersLost,
    mages: report.atkMagesLost,
    clerics: report.atkClericsLost,
    ninjas: report.atkNinjasLost,
    thieves: report.atkThievesLost,
    engineers: report.atkEngineersLost,
    war_machines: report.atkWmLost,
  };
  const defenderLost = report.injuredTroops?.defender?.deadByType || {
    thralls: report.defThrallsLost,
    fighters: report.defFightersLost,
    rangers: report.defRangersLost,
    mages: report.defMagesLost,
    clerics: report.defClericsLost,
    ninjas: report.defNinjasLost,
    thieves: report.defThievesLost,
    engineers: report.defEngineersLost,
    war_machines: report.defWmLost,
  };
  const attackerInjured = report.atkInjuredByType || report.injuredTroops?.attacker?.injuredByType || {};
  const defenderInjured = report.defInjuredByType || report.injuredTroops?.defender?.injuredByType || {};
  const attackerDeaths = report.attackerKilled || sumRecordValues(attackerLost);
  const defenderDeaths = report.defenderKilled || sumRecordValues(defenderLost);
  const criticalKills = report.criticalKills ||
    (report.injuredTroops?.attacker?.criticalKills || 0) +
    (report.injuredTroops?.defender?.criticalKills || 0);
  const criticalHits = report.criticalHits ||
    (report.injuredTroops?.attacker?.criticalHits || 0) +
    (report.injuredTroops?.defender?.criticalHits || 0);
  const sabotage = report.thiefSabotage || report.disabledWarMachines || 0;
  const wallDamage = report.wallDamage || 0;
  const defenderUnitLabels = {
    ...COMBAT_NEWS_UNIT_LABELS,
    war_machines: "Ballistae",
  };

  const title = perspective === "defender" ? "Defense report" : "Attack report";
  const outcome = report.win ? "Attacker victory" : "Defender held";
  const landLine = perspective === "defender"
    ? `Land loss: ${report.win ? `${fmt(land)} acres lost` : "None"}`
    : `Land gained: ${report.win ? `${fmt(land)} acres captured` : "None"}`;
  const detailParts = [];
  if (sabotage > 0) detailParts.push(`${fmt(sabotage)} ballistae disabled`);
  if (wallDamage > 0) detailParts.push(`${fmt(wallDamage)} wall HP damaged`);
  const siegeLine = detailParts.length ? `Siege notes: ${detailParts.join("; ")}` : "Siege notes: None";

  return [
    `${title}: ${attackerName} vs ${defenderName}`,
    `Outcome: ${outcome}`,
    landLine,
    `Troops engaged - Attacker: ${formatCombatUnitCounts(report.sent)}`,
    `Troops engaged - Defender: ${formatCombatUnitCounts(report.defenderEngaged, defenderUnitLabels)}`,
    `Troops lost - Attacker: ${formatCombatUnitCounts(attackerLost)} (${fmt(attackerDeaths)} total)`,
    `Troops lost - Defender: ${formatCombatUnitCounts(defenderLost, defenderUnitLabels)} (${fmt(defenderDeaths)} total)`,
    `Troops injured - Attacker: ${formatCombatUnitCounts(attackerInjured)}`,
    `Troops injured - Defender: ${formatCombatUnitCounts(defenderInjured, defenderUnitLabels)}`,
    `Critical hits: ${fmt(criticalHits)} hits, ${fmt(criticalKills)} killing blows`,
    `Buildings lost: ${formatCombatBuildingsLost(report)}`,
    siegeLine,
  ].join("\n");
}

module.exports = {
  COMBAT_NEWS_UNIT_LABELS,
  COMBAT_NEWS_UNIT_ORDER,
  happinessMult,
  happinessCombatMult,
  sumRecordValues,
  normalizeCombatUnits,
  formatCombatUnitCounts,
  formatCombatBuildingsLost,
  formatCombatV2NewsBlurb,
};
