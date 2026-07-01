#!/usr/bin/env node

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const API_BASE = process.env.NARMIR_API_BASE || "http://127.0.0.1:3000/api";
const USERNAME = process.env.NARMIR_USERNAME || "codex_local";
const PASSWORD = process.env.NARMIR_PASSWORD;
const TARGET_TURNS = Number(process.env.NARMIR_TARGET_TURNS || 5000);
const REPORT_PATH = path.join(process.cwd(), "docs", "CODEX_LOCAL_5000_TURN_REPORT.md");
const LOG_PATH = path.join(process.cwd(), "docs", "CODEX_LOCAL_5000_TURN_LOG.json");

const SCHOOL_CHOICE = "conjuration";
const PLANNING_INTERVAL = 25;
const SNAPSHOT_INTERVAL = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return 0;
}

function fmt(value) {
  return toNumber(value).toLocaleString();
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

class NarmirClient {
  constructor() {
    this.token = null;
    this.csrfToken = null;
    this.cookieHeader = "";
    this.http = axios.create({
      baseURL: API_BASE,
      timeout: 60000,
      validateStatus: () => true,
    });
  }

  async login(username, password) {
    const res = await this.requestWithRetry("post", "/auth/login", { username, password }, false);
    if (res.status !== 200 || !res.data?.ok) {
      throw new Error(`Login failed: ${res.status} ${res.data?.error || "unknown error"}`);
    }

    const cookies = Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"] : [];
    const tokenCookie = cookies.find((cookie) => cookie.startsWith("token="));
    const csrfCookie = cookies.find((cookie) => cookie.startsWith("csrf_token="));

    this.token = res.data.token;
    this.csrfToken = csrfCookie ? csrfCookie.split(";")[0].split("=")[1] : null;
    this.cookieHeader = [tokenCookie, csrfCookie]
      .filter(Boolean)
      .map((cookie) => cookie.split(";")[0])
      .join("; ");

    if (!this.token || !this.csrfToken || !this.cookieHeader) {
      throw new Error("Login succeeded but auth cookies were incomplete");
    }
  }

  headers(withCsrf = false) {
    const headers = {
      Authorization: `Bearer ${this.token}`,
      Cookie: this.cookieHeader,
    };
    if (withCsrf) headers["x-csrf-token"] = this.csrfToken;
    return headers;
  }

  async requestWithRetry(method, url, body, withCsrf) {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        if (method === "get") {
          return await this.http.get(url, { headers: this.headers(withCsrf) });
        }
        return await this.http.post(url, body, { headers: this.headers(withCsrf) });
      } catch (error) {
        lastError = error;
        const message = String(error.message || "");
        const transient = message.includes("timeout") || message.includes("ECONNRESET") || message.includes("socket hang up");
        if (!transient || attempt === 3) break;
        await sleep(1000 * attempt);
      }
    }
    throw lastError;
  }

  async get(url) {
    let res;
    try {
      res = await this.requestWithRetry("get", url, null, false);
    } catch (error) {
      throw new Error(`GET ${url} failed: ${error.message}`, { cause: error });
    }
    if (res.status >= 400) {
      throw new Error(`GET ${url} failed: ${res.status} ${res.data?.error || "unknown error"}`);
    }
    return res.data;
  }

  async post(url, body) {
    let res;
    try {
      res = await this.requestWithRetry("post", url, body, true);
    } catch (error) {
      throw new Error(`POST ${url} failed: ${error.message}`, { cause: error });
    }
    if (res.status >= 400) {
      throw new Error(`POST ${url} failed: ${res.status} ${res.data?.error || "unknown error"}`);
    }
    return res.data;
  }
}

async function waitForServer(client, attempts = 15) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const res = await client.http.get("/health", { timeout: 5000, validateStatus: () => true });
      if (res.status === 200 && res.data?.ok) {
        return;
      }
      lastError = new Error(`health returned ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(1000);
  }
  throw new Error(`Server did not become ready: ${lastError?.message || "unknown error"}`);
}

class RunLogger {
  constructor() {
    this.startedAt = new Date().toISOString();
    this.bugs = [];
    this.snapshots = [];
    this.actions = [];
    this.tutorialNotes = [];
    this.summary = {};
    this.plan = [
      "Phase 1: stabilize food, housing, schools, markets, and basic research.",
      "Phase 2: grow researchers, engineers, libraries, and mage capacity.",
      "Phase 3: choose a non-combat school, deepen economy, and add defense.",
      "Phase 4: run safe exploration, improve storage, and smooth the build pipeline.",
      "Phase 5: leave the kingdom in a readable, reviewable state and extract tutorial notes.",
    ];
  }

  addAction(turn, type, detail, data = {}) {
    this.actions.push({ turn, type, detail, data, at: new Date().toISOString() });
  }

  addBug(turn, detail, data = {}) {
    this.bugs.push({ turn, detail, data, at: new Date().toISOString() });
  }

  addSnapshot(label, kingdom, studies) {
    this.snapshots.push({
      label,
      turn: kingdom.turn,
      turns_stored: kingdom.turns_stored,
      gold: toNumber(kingdom.gold),
      food: toNumber(kingdom.food),
      land: toNumber(kingdom.land),
      population: toNumber(kingdom.population),
      happiness: toNumber(kingdom.happiness),
      level: toNumber(kingdom.level),
      score: toNumber(kingdom.score),
      school_of_magic: kingdom.school_of_magic || null,
      research_focus: studies?.research_focus || [],
      research: {
        economy: toNumber(kingdom.res_economy),
        construction: toNumber(kingdom.res_construction),
        military: toNumber(kingdom.res_military),
        spellbook: toNumber(studies?.res_spellbook),
        school_spellbook: toNumber(studies?.school_spellbook),
      },
      buildings: {
        farms: toNumber(kingdom.bld_farms),
        housing: toNumber(kingdom.bld_housing),
        granaries: toNumber(kingdom.bld_granaries),
        markets: toNumber(kingdom.bld_markets),
        schools: toNumber(kingdom.bld_schools),
        libraries: toNumber(kingdom.bld_libraries),
        barracks: toNumber(kingdom.bld_barracks),
        mage_towers: toNumber(kingdom.bld_mage_towers),
        taverns: toNumber(kingdom.bld_taverns),
        vaults: toNumber(kingdom.bld_vaults),
        guard_towers: toNumber(kingdom.bld_guard_towers),
        walls: toNumber(kingdom.bld_walls),
      },
      units: {
        researchers: toNumber(kingdom.researchers),
        engineers: toNumber(kingdom.engineers),
        mages: toNumber(kingdom.mages),
        rangers: toNumber(kingdom.rangers),
        fighters: toNumber(kingdom.fighters),
        scribes: toNumber(kingdom.scribes),
      },
    });
  }

  addTutorialNote(note) {
    if (!this.tutorialNotes.includes(note)) {
      this.tutorialNotes.push(note);
    }
  }

  saveJson() {
    ensureDir(LOG_PATH);
    fs.writeFileSync(
      LOG_PATH,
      JSON.stringify(
        {
          startedAt: this.startedAt,
          plan: this.plan,
          summary: this.summary,
          tutorialNotes: this.tutorialNotes,
          bugs: this.bugs,
          snapshots: this.snapshots,
          actions: this.actions,
        },
        null,
        2,
      ),
    );
  }

  saveMarkdown() {
    const lines = [];
    lines.push("# Codex Local 5,000 Turn Run");
    lines.push("");
    lines.push(`- Started: ${this.startedAt}`);
    lines.push(`- Account: ${USERNAME}`);
    lines.push(`- Target turns spent: ${TARGET_TURNS}`);
    lines.push(`- School choice target: ${SCHOOL_CHOICE}`);
    lines.push("");
    lines.push("## Plan");
    lines.push("");
    for (const item of this.plan) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    Object.entries(this.summary).forEach(([key, value]) => {
      lines.push(`- ${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    });
    lines.push("");
    lines.push("## Turn Snapshots");
    lines.push("");
    for (const snap of this.snapshots) {
      lines.push(`### ${snap.label}`);
      lines.push("");
      lines.push(`- Turn: ${snap.turn}`);
      lines.push(`- Stored turns: ${snap.turns_stored}`);
      lines.push(`- Gold: ${fmt(snap.gold)}`);
      lines.push(`- Food: ${fmt(snap.food)}`);
      lines.push(`- Land: ${fmt(snap.land)}`);
      lines.push(`- Population: ${fmt(snap.population)}`);
      lines.push(`- Happiness: ${fmt(snap.happiness)}`);
      lines.push(`- Level: ${fmt(snap.level)}`);
      lines.push(`- Score: ${fmt(snap.score)}`);
      lines.push(`- School: ${snap.school_of_magic || "not selected yet"}`);
      lines.push(`- Research focus: ${(snap.research_focus || []).join(", ") || "none"}`);
      lines.push(`- Research: economy ${snap.research.economy}, construction ${snap.research.construction}, military ${snap.research.military}, spellbook ${snap.research.spellbook}, school spellbook ${snap.research.school_spellbook}`);
      lines.push(`- Buildings: farms ${snap.buildings.farms}, housing ${snap.buildings.housing}, granaries ${snap.buildings.granaries}, markets ${snap.buildings.markets}, schools ${snap.buildings.schools}, libraries ${snap.buildings.libraries}, barracks ${snap.buildings.barracks}, mage towers ${snap.buildings.mage_towers}, taverns ${snap.buildings.taverns}, vaults ${snap.buildings.vaults}, guard towers ${snap.buildings.guard_towers}, walls ${snap.buildings.walls}`);
      lines.push(`- Units: researchers ${snap.units.researchers}, engineers ${snap.units.engineers}, mages ${snap.units.mages}, rangers ${snap.units.rangers}, fighters ${snap.units.fighters}, scribes ${snap.units.scribes}`);
      lines.push("");
    }
    lines.push("## Actions Taken");
    lines.push("");
    for (const action of this.actions) {
      lines.push(`- Turn ${action.turn}: ${action.type} - ${action.detail}`);
    }
    lines.push("");
    lines.push("## Tutorial Notes");
    lines.push("");
    for (const note of this.tutorialNotes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
    lines.push("## Bugs Encountered");
    lines.push("");
    if (this.bugs.length === 0) {
      lines.push("- No blocking API bugs encountered during the run.");
    } else {
      for (const bug of this.bugs) {
        lines.push(`- Turn ${bug.turn}: ${bug.detail}`);
      }
    }
    lines.push("");
    ensureDir(REPORT_PATH);
    fs.writeFileSync(REPORT_PATH, lines.join("\n"));
  }
}

function countQueued(queue, key) {
  return toNumber(queue?.[key]);
}

function makeBuildPlan(kingdom, turnsSpent) {
  const queue = kingdom.build_queue || {};
  const freeLand = Math.max(0, toNumber(kingdom.land) - toNumber(kingdom.built_land));
  const gold = toNumber(kingdom.gold);
  const plan = {};

  const current = (field) => toNumber(kingdom[field]);
  const queued = (key) => countQueued(queue, key);

  const add = (key, target, chunk) => {
    const field = `bld_${key}`;
    const currentTotal = current(field) + queued(key);
    if (currentTotal >= target) return;
    plan[key] = Math.min(chunk, target - currentTotal);
  };

  if (gold < 3000 || freeLand < 100) {
    return plan;
  }

  if (turnsSpent < 500) {
    add("farms", 30, 8);
    add("housing", 180, 12);
    add("granaries", 6, 3);
    add("schools", 3, 2);
    add("markets", 3, 2);
    add("libraries", 3, 2);
    add("barracks", 3, 1);
  } else if (turnsSpent < 1500) {
    add("farms", 60, 10);
    add("housing", 300, 16);
    add("granaries", 12, 4);
    add("schools", 10, 3);
    add("markets", 10, 3);
    add("libraries", 8, 3);
    add("barracks", 5, 2);
    add("mage_towers", 5, 2);
    add("vaults", 4, 2);
    add("taverns", 4, 2);
  } else if (turnsSpent < 3000) {
    add("farms", 90, 10);
    add("housing", 450, 18);
    add("granaries", 18, 4);
    add("schools", 16, 4);
    add("markets", 16, 4);
    add("libraries", 14, 4);
    add("mage_towers", 10, 3);
    add("vaults", 8, 2);
    add("guard_towers", 10, 3);
    add("walls", 10, 3);
    add("taverns", 8, 2);
    add("outposts", 3, 1);
  } else {
    add("farms", 110, 8);
    add("housing", 575, 18);
    add("granaries", 24, 4);
    add("schools", 20, 3);
    add("markets", 22, 3);
    add("libraries", 20, 3);
    add("mage_towers", 14, 3);
    add("vaults", 12, 2);
    add("guard_towers", 16, 2);
    add("walls", 18, 2);
    add("taverns", 12, 2);
    add("outposts", 6, 1);
  }

  return plan;
}

function makeEngineerAllocation(kingdom, turnsSpent) {
  const engineers = toNumber(kingdom.engineers);
  if (engineers <= 0) return {};

  const priorities = turnsSpent < 1500
    ? ["housing", "farms", "schools", "markets", "libraries", "granaries", "barracks"]
    : ["libraries", "markets", "mage_towers", "vaults", "guard_towers", "walls", "housing", "farms"];

  const queue = kingdom.build_queue || {};
  const active = priorities.filter((key) => countQueued(queue, key) > 0);
  if (active.length === 0) return {};

  const allocation = {};
  let remaining = engineers;
  active.forEach((key, index) => {
    const share = index === active.length - 1 ? remaining : Math.max(1, Math.floor(engineers / active.length));
    allocation[key] = share;
    remaining -= share;
  });
  return allocation;
}

function desiredResearchFocus(turnsSpent) {
  if (turnsSpent < 800) return ["economy"];
  if (turnsSpent < 1500) return ["construction"];
  if (turnsSpent < 2600) return ["spellbook"];
  if (turnsSpent < 3200) return ["economy"];
  return ["military"];
}

function summarizeBuildPlan(plan) {
  return Object.entries(plan)
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => `${qty} ${key.replace(/_/g, " ")}`)
    .join(", ");
}

async function maybeTopUpTurns(client, kingdomId, logger) {
  await client.post("/admin/set-kingdom", {
    kingdomId,
    fields: {
      turns_stored: TARGET_TURNS,
      turn: 0,
    },
  });
  logger.addAction(0, "admin", `Set stored turns to ${TARGET_TURNS} and reset current turn to 0.`);
}

async function maybeHire(client, kingdom, unit, target, logger) {
  const current = toNumber(kingdom[unit]);
  if (current >= target) return kingdom;
  const affordable = Math.floor(toNumber(kingdom.gold) / 250);
  const availablePop = toNumber(kingdom.population);
  let amount = Math.min(target - current, affordable, availablePop);
  if (amount <= 0) return kingdom;

  if (unit === "researchers") {
    const cap = toNumber(kingdom.bld_schools) * 100;
    amount = Math.min(amount, Math.max(0, cap - current));
  }

  if (["fighters", "rangers", "clerics", "thieves", "ninjas"].includes(unit)) {
    const barracksCap = toNumber(kingdom.bld_barracks) * 500;
    const troops = toNumber(kingdom.fighters) + toNumber(kingdom.rangers) + toNumber(kingdom.clerics) + toNumber(kingdom.thieves) + toNumber(kingdom.ninjas);
    amount = Math.min(amount, Math.max(0, barracksCap - troops));
  }

  amount = Math.min(amount, 250);
  if (amount <= 0) return kingdom;

  try {
    await client.post("/kingdom/hire", { unit, amount });
    logger.addAction(toNumber(kingdom.turn), "hire", `Hired ${amount} ${unit}.`);
    return client.get("/kingdom/me");
  } catch (error) {
    logger.addBug(toNumber(kingdom.turn), `Hire planning blocked for ${unit}: ${error.message}`);
    return kingdom;
  }
}

async function maybePlanState(client, kingdom, studies, turnsSpent, logger) {
  const focus = desiredResearchFocus(turnsSpent);
  if (JSON.stringify(studies.research_focus || []) !== JSON.stringify(focus)) {
    try {
      await client.post("/kingdom/research-focus", { focus });
      logger.addAction(toNumber(kingdom.turn), "research", `Set research focus to ${focus.join(", ")}.`);
    } catch (error) {
      logger.addBug(toNumber(kingdom.turn), `Research focus update blocked: ${error.message}`);
    }
  }

  if (toNumber(studies.res_spellbook) >= 100 && !kingdom.school_of_magic) {
    try {
      await client.post("/kingdom/select-school", { school: SCHOOL_CHOICE });
      logger.addAction(toNumber(kingdom.turn), "school", `Selected ${SCHOOL_CHOICE}.`);
      logger.addTutorialNote("School selection unlocks only after regular spellbook research reaches 100.");
    } catch (error) {
      logger.addBug(toNumber(kingdom.turn), `School selection blocked: ${error.message}`);
    }
  }

  if (toNumber(kingdom.bld_libraries) > 0) {
    kingdom = await maybeHire(client, kingdom, "scribes", Math.min(150, toNumber(kingdom.bld_libraries) * 8), logger);
  }

  kingdom = await maybeHire(client, kingdom, "researchers", Math.min(1500, toNumber(kingdom.bld_schools) * 100), logger);
  kingdom = await maybeHire(client, kingdom, "engineers", Math.min(900, 100 + Math.floor(turnsSpent / 6)), logger);
  if (kingdom.school_of_magic) {
    kingdom = await maybeHire(client, kingdom, "mages", turnsSpent < 3000 ? 120 : 320, logger);
  }
  kingdom = await maybeHire(client, kingdom, "rangers", turnsSpent < 1000 ? 150 : 300, logger);
  kingdom = await maybeHire(client, kingdom, "fighters", turnsSpent < 1500 ? 100 : 250, logger);

  const buildPlan = makeBuildPlan(kingdom, turnsSpent);
  if (Object.keys(buildPlan).length > 0) {
    try {
      await client.post("/kingdom/build-queue", { orders: buildPlan });
      logger.addAction(toNumber(kingdom.turn), "build", `Queued ${summarizeBuildPlan(buildPlan)}.`);
    } catch (error) {
      logger.addBug(toNumber(kingdom.turn), `Build queue planning blocked: ${error.message}`);
    }
  }

  const freshKingdom = await client.get("/kingdom/me");
  const allocation = makeEngineerAllocation(freshKingdom, turnsSpent);
  if (Object.keys(allocation).length > 0) {
    try {
      await client.post("/kingdom/build-allocation", { allocation });
      logger.addAction(toNumber(kingdom.turn), "engineers", `Assigned engineers to ${Object.entries(allocation).map(([k, v]) => `${k} ${v}`).join(", ")}.`);
    } catch (error) {
      logger.addBug(toNumber(kingdom.turn), `Engineer allocation blocked: ${error.message}`);
    }
  }

  const schoolMages = toNumber(freshKingdom.school_of_magic) ? Math.min(toNumber(freshKingdom.mages), 150) : 0;
  if (toNumber(freshKingdom.mages) > 0 && freshKingdom.school_of_magic) {
    try {
      await client.post("/kingdom/school-allocation", {
        spellbook: 0,
        school_spellbook: schoolMages,
      });
      logger.addAction(toNumber(freshKingdom.turn), "mages", `Assigned ${schoolMages} mages to school spellbook.`);
    } catch (error) {
      logger.addBug(toNumber(freshKingdom.turn), `Mage allocation blocked: ${error.message}`);
    }
  }

  if (turnsSpent >= 1200 && turnsSpent < 1400 && toNumber(freshKingdom.rangers) >= 100 && toNumber(freshKingdom.food) >= 5000) {
    try {
      await client.post("/kingdom/expedition/start", { type: "scout", rangers: 100, fighters: 0 });
      logger.addAction(toNumber(freshKingdom.turn), "expedition", "Launched one scout expedition for tutorial coverage.");
      logger.addTutorialNote("A small scout expedition is a safe first exploration action once food and spare rangers exist.");
    } catch (error) {
      logger.addBug(toNumber(freshKingdom.turn), `Scout expedition failed: ${error.message}`);
    }
  }
}

function extractTutorialNotes(kingdom, studies, logger) {
  if (toNumber(kingdom.bld_schools) > 1) {
    logger.addTutorialNote("Schools directly gate researcher capacity, so early economy growth should include more schools, not just more researchers.");
  }
  if (toNumber(kingdom.bld_barracks) > 1) {
    logger.addTutorialNote("Barracks gate troop headcount for most military units, so new players need barracks before broad recruiting.");
  }
  if (toNumber(kingdom.bld_libraries) > 0) {
    logger.addTutorialNote("Libraries matter early because they support research speed and later unlock better value from scribes and magical progression.");
  }
  if (toNumber(kingdom.bld_granaries) > 0) {
    logger.addTutorialNote("Granaries are part of the stability layer, not just decoration; food security feels better once farms and granaries grow together.");
  }
  if (toNumber(studies.res_spellbook) > 0) {
    logger.addTutorialNote("Regular spellbook research must advance before a kingdom can commit to a magic school.");
  }
}

async function main() {
  if (!PASSWORD) {
    throw new Error("NARMIR_PASSWORD must be set in the environment for the local run.");
  }

  const client = new NarmirClient();
  const logger = new RunLogger();

  await waitForServer(client);
  await client.login(USERNAME, PASSWORD);

  let kingdom = await client.get("/kingdom/me");
  await maybeTopUpTurns(client, kingdom.id, logger);

  kingdom = await client.get("/kingdom/me");
  let studies = await client.get("/kingdom/studies/overview");
  logger.addSnapshot("Start", kingdom, studies);

  const initialTurns = toNumber(kingdom.turns_stored);
  let turnsSpent = 0;

  while (turnsSpent < TARGET_TURNS) {
    if (turnsSpent % PLANNING_INTERVAL === 0) {
      kingdom = await client.get("/kingdom/me");
      studies = await client.get("/kingdom/studies/overview");
      await maybePlanState(client, kingdom, studies, turnsSpent, logger);
      kingdom = await client.get("/kingdom/me");
      studies = await client.get("/kingdom/studies/overview");
      extractTutorialNotes(kingdom, studies, logger);
    }

    let turnResult;
    try {
      turnResult = await client.post("/kingdom/turn", {});
    } catch (error) {
      logger.addBug(toNumber(kingdom.turn), `Turn request failed: ${error.message}`);
      break;
    }

    turnsSpent += 1;

    const updates = turnResult?.updates || {};
    const turnValue = toNumber(updates.turn || kingdom.turn || 0);
    const turnStored = toNumber(updates.turns_stored);

    if (Array.isArray(turnResult.events)) {
      const suspicious = turnResult.events
        .map((event) => event?.message || "")
        .filter((message) => message.includes("max ∞") || message.includes("paused"));
      suspicious.forEach((message) => logger.addBug(turnValue, `Construction note: ${message}`));
    }

    if (turnsSpent % SNAPSHOT_INTERVAL === 0 || turnsSpent === TARGET_TURNS) {
      kingdom = await client.get("/kingdom/me");
      studies = await client.get("/kingdom/studies/overview");
      logger.addSnapshot(`After ${turnsSpent} turns`, kingdom, studies);
      logger.addAction(turnValue, "checkpoint", `Checkpoint at ${turnsSpent} spent turns with ${turnStored} stored turns remaining.`);
      console.log(`[run] ${turnsSpent}/${TARGET_TURNS} turns spent | turn=${turnValue} | gold=${fmt(kingdom.gold)} | pop=${fmt(kingdom.population)} | land=${fmt(kingdom.land)} | score=${fmt(kingdom.score)}`);
    }

    if (turnsSpent % 200 === 0) {
      await sleep(75);
    }
  }

  kingdom = await client.get("/kingdom/me");
  studies = await client.get("/kingdom/studies/overview");
  const news = await client.get("/kingdom/news/list");

  logger.summary = {
    started_at: logger.startedAt,
    completed_at: new Date().toISOString(),
    initial_turns_stored: initialTurns,
    target_turns_spent: TARGET_TURNS,
    actual_turns_spent: turnsSpent,
    final_turn: toNumber(kingdom.turn),
    final_turns_stored: toNumber(kingdom.turns_stored),
    final_score: fmt(kingdom.score),
    final_level: toNumber(kingdom.level),
    final_gold: fmt(kingdom.gold),
    final_food: fmt(kingdom.food),
    final_land: fmt(kingdom.land),
    final_population: fmt(kingdom.population),
    final_happiness: fmt(kingdom.happiness),
    final_school: kingdom.school_of_magic || "none",
    final_research_focus: (studies.research_focus || []).join(", ") || "none",
    latest_news_headline: news?.[0]?.message || "none",
  };

  logger.saveJson();
  logger.saveMarkdown();

  console.log(`[run] report written to ${REPORT_PATH}`);
  console.log(`[run] log written to ${LOG_PATH}`);
}

main().catch((error) => {
  console.error(`[run] fatal: ${error.message}`);
  process.exit(1);
});
