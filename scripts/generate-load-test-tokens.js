#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { parseArgs } = require("util");
const { initDb } = require("../db/schema");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required to generate load test tokens.");
}

async function main() {
  const { values } = parseArgs({
    options: {
      count: { type: "string" },
      output: { type: "string" }
    }
  });

  const requestedCount = Number.parseInt(values.count || "5000", 10);
  if (!Number.isFinite(requestedCount) || requestedCount <= 0) {
    throw new Error(`Invalid --count value: ${values.count || ""}`);
  }

  const outputPath = path.resolve(values.output || "load-test-tokens.csv");
  const db = await initDb();

  const players = await db.all(
    `
      SELECT p.id, p.username, COALESCE(p.is_admin, 0) AS is_admin
      FROM players p
      INNER JOIN kingdoms k ON k.player_id = p.id
      WHERE COALESCE(p.is_banned, 0) = 0
      ORDER BY p.id
      LIMIT ?
    `,
    [requestedCount]
  );

  if (!players.length) {
    throw new Error("No active players with kingdoms were found for token generation.");
  }

  const rows = ["token"];
  for (const player of players) {
    const token = jwt.sign(
      {
        playerId: player.id,
        username: player.username,
        isAdmin: Number(player.is_admin) === 1
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    rows.push(token);
  }

  fs.writeFileSync(outputPath, `${rows.join("\n")}\n`, "utf8");

  console.log(
    `Generated ${players.length} load test token(s) at ${outputPath}.`
  );

  if (players.length < requestedCount) {
    console.warn(
      `Requested ${requestedCount} tokens but only found ${players.length} eligible player account(s).`
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
