-- =============================================================================
-- Migration: Add address column to profiles (superseded)
-- Date: 2026-10-26
-- Description:
--   The `address` column is now included in the initial schema migration
--   (20260101_initial_schema.sql). This file is kept as a no-op to preserve
--   migration history and avoid gaps in the timestamp sequence.
--   The IF NOT EXISTS guard makes it safe to run on any database state.
-- =============================================================================

-- No-op: address column already exists in the initial schema.
alter table public.profiles add column if not exists address text;
