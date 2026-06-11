-- Migration 002: Rename storage columns for consistency
-- Renames:
--   bld_training -> bld_trainings (singular to plural for consistency with other building columns)
--   weapons_stockpile -> weapons_stored (suffix consistency with blueprints_stored, scaffolding_stored, etc.)
--   armor_stockpile -> armor_stored (same suffix consistency)

BEGIN;

ALTER TABLE kingdoms RENAME COLUMN bld_training TO bld_trainings;
ALTER TABLE kingdoms RENAME COLUMN weapons_stockpile TO weapons_stored;
ALTER TABLE kingdoms RENAME COLUMN armor_stockpile TO armor_stored;

COMMIT;
