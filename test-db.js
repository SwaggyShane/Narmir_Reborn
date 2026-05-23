const { initDb } = require('./db/schema');

async function test() {
  console.log("Initializing database connection...");
  try {
    const db = await initDb();
    console.log("Database initialized. Checking tables...");
    
    // Check players count
    try {
      const players = await db.all("SELECT id, username, is_admin FROM players");
      console.log(`Players found: ${players.length}`);
      console.log(JSON.stringify(players, null, 2));
    } catch (e) {
      console.error("Failed to query players table:", e.message);
    }

    // Check kingdoms count
    try {
      const kingdoms = await db.all("SELECT id, player_id, name, race FROM kingdoms");
      console.log(`Kingdoms found: ${kingdoms.length}`);
      console.log(JSON.stringify(kingdoms, null, 2));
    } catch (e) {
      console.error("Failed to query kingdoms table:", e.message);
    }

    // Check server_state
    try {
      const state = await db.all("SELECT * FROM server_state");
      console.log("Server state rows:", state.length);
      console.log(JSON.stringify(state, null, 2));
    } catch (e) {
      console.error("Failed to query server_state table:", e.message);
    }
  } catch (error) {
    console.error("Fatal test error:", error);
  }
}

test();
