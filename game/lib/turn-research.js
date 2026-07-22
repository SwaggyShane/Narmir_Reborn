// game/lib/turn-research.js
// processTurn phases 7 + 7b: auto-research and mage research.
// Engine extract plan S06. Mutates ctx (incl. xpSourcesAccum) in place.

'use strict';

const fragmentBonusManager = require('../fragment-bonus-manager');
const { getCap } = require('./data-transformations');
const { ensureObject } = require('./healing');
const { raceBonus } = require('./race-bonus');
const { awardTroopXp } = require('./troops');
const { awardXp } = require('../xp');
const { safeJsonStringify } = require('../../utils/helpers');
const {
  getSynergyPassiveBonusMultiplier,
  getSynergyPassiveBonusAbsolute,
} = require('./synergy-cache');

/**
 * @param {import('./turn-context').TurnContext} ctx
 * @returns {void}
 */
function runResearchPhase(ctx) {
  const { k, updates, events } = ctx;
  let xpSourcesAccum = ctx.xpSourcesAccum;

  // ── 7. Auto-research — use per-discipline allocation ──────────────────────────
  let schoolBonus = 1 + Math.floor(k.bld_schools / 5) * 0.02;
  const autoSchoolSpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'schools', 'speed');
  const autoSchoolOutputMult = fragmentBonusManager.getBonusMultiplier(k, 'schools', 'output');
  schoolBonus *= (autoSchoolSpeedMult * autoSchoolOutputMult);
  const researchMb = ensureObject(k.milestone_bonuses, {});
  const raceResearch = raceBonus(k, 'research') * (1 + (researchMb.research_speed_pct || 0) / 100);
  const raceMagic = raceBonus(k, 'magic');
  const researchers = k.researchers;

  const schoolUpgrades = ensureObject(k.school_upgrades, {});
  const curriculumMult = schoolUpgrades.advanced_curriculum ? 1.2 : 1.0;
  const maxSlots = schoolUpgrades.repository ? 2 : 1;

  if (researchers > 0) {
    const ALL_DISCIPLINES = [
      {
        col: 'res_economy',
        key: 'economy',
        label: 'Economy',
        multi: raceResearch,
      },
      {
        col: 'res_weapons',
        key: 'weapons',
        label: 'Weapons',
        multi: raceResearch,
      },
      { col: 'res_armor', key: 'armor', label: 'Armor', multi: raceResearch },
      {
        col: 'res_military',
        key: 'military',
        label: 'Military tactics',
        multi: raceResearch,
      },
      {
        col: 'res_attack_magic',
        key: 'attack_magic',
        label: 'Attack magic',
        multi: raceMagic,
      },
      {
        col: 'res_defense_magic',
        key: 'defense_magic',
        label: 'Defense magic',
        multi: raceMagic,
      },
      {
        col: 'res_entertainment',
        key: 'entertainment',
        label: 'Entertainment',
        multi: raceResearch,
      },
      {
        col: 'res_construction',
        key: 'construction',
        label: 'Construction',
        multi: raceResearch,
      },
      {
        col: 'res_war_machines',
        key: 'war_machines',
        label: 'War machines',
        multi: raceResearch,
      },
      {
        col: 'res_spellbook',
        key: 'spellbook',
        label: 'Spellbook',
        multi: raceMagic,
      },
    ];

    // Research focus — single or dual discipline
    let focus = ensureObject(
      k.research_focus,
      []
    );
    if (!focus.length) {
      // Auto-select highest current discipline
      const top = ALL_DISCIPLINES.reduce(
        (best, d) => ((k[d.col] || 0) >= (k[best.col] || 0) ? d : best),
        ALL_DISCIPLINES[0],
      );
      focus = [top.key];
      updates.research_focus = safeJsonStringify(focus);
    }
    focus = focus.slice(0, maxSlots);
    const perSlot = Math.floor(researchers / focus.length);

    // Get library research speed multiplier
    const libraryResearchMult = fragmentBonusManager.getBonusMultiplier(k, 'libraries', 'research_speed');

    // Get synergy research speed multiplier
    const synergyResearchMult = getSynergyPassiveBonusMultiplier(k, 'research_speed');

    // Get synergy research cost reduction (absolute value, e.g., 0.30 = 30% reduction)
    const synergyResearchCostReduction = getSynergyPassiveBonusAbsolute(k, 'research_cost_reduction');

    let rProgress = ensureObject(
      k.research_progress,
      {}
    );
    const advances = [];
    let resEstimates = [];

    focus.forEach(function (fKey) {
      const d = ALL_DISCIPLINES.find((x) => x.key === fKey);
      if (!d) return;

      const current =
        updates[d.col] !== undefined ? updates[d.col] : k[d.col] || 0;
      const cap = getCap(d.col, k.level || 1);
      if (current >= cap) return; // At cap, no progress

      const effective = Math.floor(
        perSlot * schoolBonus * d.multi * curriculumMult * libraryResearchMult * synergyResearchMult,
      );
      rProgress[d.col] = (rProgress[d.col] || 0) + effective;

      let factor = 1.0;
      if (current > 100) {
        factor = Math.pow(1.05, current - 100);
      }
      let COST_PER_PCT = Math.floor(200 * factor);
      // Apply synergy research cost reduction (e.g., 0.30 means cost is 70% of normal)
      if (synergyResearchCostReduction > 0) {
        COST_PER_PCT = Math.floor(COST_PER_PCT * (1.0 - synergyResearchCostReduction));
      }

      let inc = 0;
      if (rProgress[d.col] >= COST_PER_PCT) {
        inc = Math.floor(rProgress[d.col] / COST_PER_PCT);
        rProgress[d.col] -= inc * COST_PER_PCT;
      }

      if (inc > 0) {
        const newVal = Math.min(cap, current + inc);
        if (newVal !== current) {
          updates[d.col] = newVal;
          advances.push(`${d.label} → ${newVal}%`);
        }
      }

      if (effective > 0) {
        const pct = Math.floor((rProgress[d.col] / COST_PER_PCT) * 100);
        const turnsLeft = Math.ceil(
          (COST_PER_PCT - rProgress[d.col]) / effective,
        );
        resEstimates.push(`${d.label} (${pct}%, ${turnsLeft} turns left)`);
      }
    });

    updates.research_progress = safeJsonStringify(rProgress);

    // Award Researcher XP even if no technical advances occurred
    if (researchers > 0) {
      const rXpMult =
        (schoolUpgrades.grand_academy ? 1.5 : 1.0) *
        (focus.length > 0 ? 1.0 : 0.5);
      // Base XP 5 per turn for working + 5 per advance
      const totalRXp = Math.floor((5 + advances.length * 5) * rXpMult);
      const rXp = awardTroopXp(
        { ...k, troop_levels: updates.troop_levels || k.troop_levels },
        'researchers',
        totalRXp,
      );
      updates.troop_levels = ensureObject(rXp.troop_levels, updates.troop_levels || {});
      if (rXp.levelUps.length)
        events.push({
          type: 'system',
          message: `📚 Researchers grew more skilled!`,
        });
    }

    if (advances.length > 0) {
      events.push({
        type: 'system',
        message: `📚 Research advanced: ${advances.join(', ')}.`,
      });
      const resXp = awardXp(
        {
          ...k,
          xp: updates.xp || k.xp,
          level: updates.level || k.level || 1,
          xp_sources: xpSourcesAccum,
        },
        'research',
        advances.length,
      );
      updates.xp = resXp.xp;
      updates.level = resXp.level;
      if (resXp.levelled) events.push(...resXp.events);
      Object.assign(xpSourcesAccum, resXp.xp_sources);
    } else if (researchers > 0) {
      if (resEstimates.length > 0) {
        events.push({
          type: 'system',
          message: `🔬 ${researchers.toLocaleString()} researchers studying. Est: ${resEstimates.join(', ')}.`,
        });
      } else {
        events.push({
          type: 'system',
          message: `🔬 ${researchers.toLocaleString()} researchers studying ${focus.join(' & ')}.`,
        });
      }
    }
  } else {
    events.push({
      type: 'system',
      message: `🔬 No researchers assigned — hire researchers and allocate them to advance your kingdom's knowledge.`,
    });
  }

  // ── 7b. Mage research — mages study spellbook (100+) and school_spellbook ──────
  const mages = k.mages || 0;
  if (mages > 0) {
    let mageAlloc = ensureObject(k.research_allocation, {});
    const spellbookMages = mageAlloc.spellbook_mages || 0;
    const schoolSpellbookMages = mageAlloc.school_spellbook_mages || 0;

    if (spellbookMages > 0 || schoolSpellbookMages > 0) {
      let mageRProgress = ensureObject(k.mage_research_progress, {});
      const mageAdvances = [];
      const mageSchoolBonus = schoolBonus; // Same multiplier as researchers
      const mageMult = raceMagic; // Magic bonus for mage research
      const mageLibraryMult = fragmentBonusManager.getBonusMultiplier(k, 'libraries', 'research_speed');

      // Process spellbook research for mages (continuation from 100+)
      if (spellbookMages > 0) {
        const spellCol = 'res_spellbook';
        const currentSpell = updates[spellCol] !== undefined ? updates[spellCol] : k[spellCol] || 0;
        const spellCap = getCap(spellCol, k.level || 1);

        if (currentSpell < spellCap) {
          const spellEffective = Math.floor(
            spellbookMages * mageSchoolBonus * mageMult * curriculumMult * mageLibraryMult
          );
          mageRProgress[spellCol] = (mageRProgress[spellCol] || 0) + spellEffective;

          let spellFactor = 1.0;
          if (currentSpell > 100) {
            spellFactor = Math.pow(1.05, currentSpell - 100);
          }
          const spellCost = Math.floor(200 * spellFactor);

          let spellInc = 0;
          if (mageRProgress[spellCol] >= spellCost) {
            spellInc = Math.floor(mageRProgress[spellCol] / spellCost);
            mageRProgress[spellCol] -= spellInc * spellCost;
          }

          if (spellInc > 0) {
            const newSpellVal = Math.min(spellCap, currentSpell + spellInc);
            if (newSpellVal !== currentSpell) {
              updates[spellCol] = newSpellVal;
              mageAdvances.push(`Spellbook -> ${newSpellVal}%`);
            }
          }
        }
      }

      // Process school_spellbook research for mages (0+)
      if (schoolSpellbookMages > 0 && k.school_of_magic) {
        const schoolCol = 'school_spellbook';
        const currentSchool = updates[schoolCol] !== undefined ? updates[schoolCol] : k[schoolCol] || 0;
        const schoolCap = getCap(schoolCol, k.level || 1);

        if (currentSchool < schoolCap) {
          const schoolEffective = Math.floor(
            schoolSpellbookMages * mageSchoolBonus * mageMult * curriculumMult * mageLibraryMult
          );
          mageRProgress[schoolCol] = (mageRProgress[schoolCol] || 0) + schoolEffective;

          let schoolFactor = 1.0;
          if (currentSchool > 100) {
            schoolFactor = Math.pow(1.05, currentSchool - 100);
          }
          const schoolCost = Math.floor(200 * schoolFactor);

          let schoolInc = 0;
          if (mageRProgress[schoolCol] >= schoolCost) {
            schoolInc = Math.floor(mageRProgress[schoolCol] / schoolCost);
            mageRProgress[schoolCol] -= schoolInc * schoolCost;
          }

          if (schoolInc > 0) {
            const newSchoolVal = Math.min(schoolCap, currentSchool + schoolInc);
            if (newSchoolVal !== currentSchool) {
              updates[schoolCol] = newSchoolVal;
              mageAdvances.push(`School Spellbook -> ${newSchoolVal}%`);
            }
          }
        }
      }

      updates.mage_research_progress = safeJsonStringify(mageRProgress);

      // Award Mage XP
      if (spellbookMages > 0 || schoolSpellbookMages > 0) {
        const mXpMult = schoolUpgrades.grand_academy ? 1.5 : 1.0;
        const totalMXp = Math.floor((5 + mageAdvances.length * 5) * mXpMult);
        const mXp = awardTroopXp(
          { ...k, troop_levels: updates.troop_levels || k.troop_levels },
          'mages',
          totalMXp
        );
        updates.troop_levels = ensureObject(mXp.troop_levels, updates.troop_levels || {});
        if (mXp.levelUps.length) {
          events.push({
            type: 'system',
            message: `✨ Mages grew more skilled!`,
          });
        }
      }

      if (mageAdvances.length > 0) {
        events.push({
          type: 'system',
          message: `✨ Mage research advanced: ${mageAdvances.join(', ')}.`,
        });
        const mResXp = awardXp(
          {
            ...k,
            xp: updates.xp || k.xp,
            level: updates.level || k.level || 1,
            xp_sources: xpSourcesAccum,
          },
          'magic',
          mageAdvances.length
        );
        updates.xp = mResXp.xp;
        updates.level = mResXp.level;
        if (mResXp.levelled) events.push(...mResXp.events);
        Object.assign(xpSourcesAccum, mResXp.xp_sources);
      } else if (spellbookMages > 0 || schoolSpellbookMages > 0) {
        const mageEstimates = [];
        if (spellbookMages > 0) mageEstimates.push('Spellbook');
        if (schoolSpellbookMages > 0) mageEstimates.push('School Spellbook');
        events.push({
          type: 'system',
          message: `✨ ${(spellbookMages + schoolSpellbookMages).toLocaleString()} mages studying ${mageEstimates.join(' & ')}.`,
        });
      }
    }
  }

  ctx.xpSourcesAccum = xpSourcesAccum;
}

module.exports = {
  runResearchPhase,
};
