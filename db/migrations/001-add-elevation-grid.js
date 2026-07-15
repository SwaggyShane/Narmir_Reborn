/**
 * Migration: Add elevation_grid column to world_state
 * Stores precomputed elevation data for all hexes
 */

module.exports = {
  name: '001-add-elevation-grid',

  async up(db) {
    // Check if column exists
    const result = await db.get(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'world_state' AND column_name = 'elevation_grid'`
    );

    if (!result) {
      await db.run(
        `ALTER TABLE world_state ADD COLUMN elevation_grid JSONB DEFAULT '{}' NOT NULL`
      );
    }
  },

  async down(db) {
    await db.run(`ALTER TABLE world_state DROP COLUMN IF EXISTS elevation_grid`);
  }
};
