-- Migration: Fix jamsmusics table by removing incompatible row
-- This migration handles the case where musicId column needs to be added
-- but there's existing data without a default value

-- Step 1: Delete any rows that don't have a musicId (since we can't backfill)
DELETE FROM jamsmusics WHERE musicaId IS NULL OR id IS NULL;

-- Alternative: If you want to preserve data, you could try to map musicaId -> musicId
-- UPDATE jamsmusics SET musicId = musicaId WHERE musicId IS NULL AND musicaId IS NOT NULL;

-- Step 2: Now the table is clean and the migration can proceed

