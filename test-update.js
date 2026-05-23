const { initDb, applyKingdomUpdates } = require('./db/schema');

async function test() {
  console.log("Initializing database connection...");
  try {
    const db = await initDb();
    console.log("Database initialized. Finding Stolice...");
    
    const k = await db.get("SELECT * FROM kingdoms WHERE id = 11");
    if (!k) {
      console.log("Stolice not found!");
      return;
    }
    console.log(`Current gold for Stolice: ${k.gold}`);
    
    // Attempt updates
    console.log("Attempting to add gold to Stolice via applyKingdomUpdates...");
    const updatedCols = await applyKingdomUpdates(11, { gold: k.gold + 500 });
    console.log("Updated columns:", updatedCols);
    
    const k2 = await db.get("SELECT gold FROM kingdoms WHERE id = 11");
    console.log(`New gold for Stolice: ${k2.gold}`);
    
  } catch (error) {
    console.error("Fatal test error:", error);
  }
}

test();
