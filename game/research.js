/**
 * Research System
 * Handles discipline advancement and magic school selection
 */

const { researchIncrement } = require("./population");
const { RESEARCH_MAP, RESEARCH_DISCIPLINE_CAPS, MAX_RESEARCH, MAGIC_SCHOOLS } = require("./config");

function studyDiscipline(k, discipline, researchersAssigned) {
  const col = RESEARCH_MAP[discipline];
  if (!col) return { error: "Unknown discipline" };
  const assigned = Math.floor(Number(researchersAssigned));
  if (isNaN(assigned) || assigned <= 0) return { error: "Invalid number of researchers" };
  if (assigned > k.researchers)
    return { error: "Not enough researchers" };
  researchersAssigned = assigned;

  const currentLevel = k[col] || 100;
  const increment = researchIncrement(
    k,
    discipline,
    researchersAssigned,
    currentLevel,
  );
  if (increment === 0)
    return { error: "Need more researchers for any progress" };

  let cap = MAX_RESEARCH;
  if (discipline === "spellbook" || discipline === "school_spellbook") {
    cap = Infinity;
  } else {
    // Apply race-specific hard cap for this discipline (if any)
    const raceCaps = RESEARCH_DISCIPLINE_CAPS[k.race] || {};
    cap = raceCaps[discipline] || MAX_RESEARCH;
  }
  const newVal = Math.min(cap, k[col] + increment);

  return {
    updates: { [col]: newVal, updated_at: Math.floor(Date.now() / 1000) },
    increment,
  };
}

function _selectSchool(k, schoolName) {
  // Validate school name
  if (!MAGIC_SCHOOLS[schoolName]) {
    return { error: `Unknown school: ${schoolName}` };
  }

  // Can only choose if: school_of_magic is null AND res_spellbook >= 100
  if (k.school_of_magic) {
    return { error: `You have already chosen the school of ${k.school_of_magic}` };
  }

  if (k.res_spellbook < 100) {
    return { error: `You must reach spellbook research level 100 to choose a school` };
  }

  // Set school choice
  const schoolLabel = schoolName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    updates: { school_of_magic: schoolName, school_spellbook: 0 },
    events: [{ type: 'system', message: `🧠 ® You have chosen the school of ${schoolLabel}. You can now research school-specific spells!` }]
  };
}

module.exports = {
  studyDiscipline,
  _selectSchool,
};
