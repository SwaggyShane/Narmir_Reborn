const { initDb } = require('./db/schema');

async function test() {
  console.log("Initializing database connection...");
  try {
    const db = await initDb();
    console.log("Database initialized. Simulating dummy register...");
    
    // Insert a dummy player
    const username = "dummy_" + Math.floor(Math.random()*10000);
    const playerResult = await db.run(
      "INSERT INTO players (username, password, is_admin) VALUES (?, ?, ?)",
      [username, "password", 0]
    );
    console.log("Player inserted. lastID:", playerResult.lastID);
    
    // Insert the kingdom
    console.log("Inserting kingdom...");
    const buildings = {
      bld_farms: 10,
      bld_schools: 1,
      bld_barracks: 1,
      bld_armories: 1,
      bld_housing: 100,
      bld_markets: 0,
      bld_smithies: 0,
      bld_mage_towers: 0,
      bld_shrines: 0,
      bld_outposts: 0,
      bld_training: 0,
    };
    const chosenRace = "human";
    const region = "Grasslands";
    const food = 5000;
    const fighters = 0;
    const rangers = 50;
    
    const kRes = await db.run(
      `INSERT INTO kingdoms (
        player_id, name, race, region, gold, land, population, food,
        researchers, engineers, fighters, rangers, thralls, turns_stored,
        res_spellbook, blueprints_stored,
        bld_farms, bld_schools, bld_barracks, bld_armories, bld_housing,
        bld_markets, bld_smithies, bld_mage_towers, bld_shrines, bld_outposts, bld_training, bld_mausoleums, world_fragments
      ) VALUES (?, ?, ?, ?, 10000, 504, 50000, ?, 100, 100, ?, ?, ?, 400, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '["Volcanic Rock", "Ancient Elven Wood", "Dragon Scale", "Abyssal Crystal", "Celestial Feather", "Dwarven Star-Metal", "Cursed Bloodstone", "Tears of the World Tree", "Void Essence", "Titan Bone"]')`,
      [
        playerResult.lastID,
        username + "_kingdom",
        chosenRace,
        region,
        food,
        fighters,
        rangers,
        chosenRace === "vampire" ? 50 : 0,
        buildings.bld_farms,
        buildings.bld_schools,
        buildings.bld_barracks,
        buildings.bld_armories,
        buildings.bld_housing,
        buildings.bld_markets,
        buildings.bld_smithies,
        buildings.bld_mage_towers,
        buildings.bld_shrines,
        buildings.bld_outposts,
        buildings.bld_training,
        buildings.bld_mausoleums || 0,
      ]
    );
    console.log("Kingdom inserted successfully! kRes:", kRes);
  } catch (error) {
    console.error("Fatal test error:", error);
  }
}

test();
