-- ============================================================
-- FinTrackr — PostgreSQL initialization script
-- Runs once when the postgres container is first created.
-- The main `fintrackr` database already exists (created by
-- POSTGRES_DB env var); this script sets up extensions and
-- additional databases for co-located services.
-- ============================================================

-- ── Extensions on main database ─────────────────────────────
-- pgvector — vector similarity search (AI embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- uuid-ossp — UUID generation (fallback for older drivers)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm — trigram similarity (full-text search helpers)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- btree_gin — composite index support
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- ── GlitchTip database ──────────────────────────────────────
SELECT 'CREATE DATABASE glitchtip'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'glitchtip')\gexec

-- ── Plausible database ──────────────────────────────────────
SELECT 'CREATE DATABASE plausible'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'plausible')\gexec

-- ── Grant privileges ─────────────────────────────────────────
-- Uses a DO block so the GRANT is idempotent across restarts
DO $$
DECLARE
  v_user TEXT := current_user;  -- the POSTGRES_USER value
BEGIN
  EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE glitchtip TO %I', v_user);
  EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE plausible TO %I', v_user);
END;
$$;

-- ── Performance tuning hints ─────────────────────────────────
-- These are advisory; actual tuning should be done in postgresql.conf
-- or via PGOPTIONS. Shown here as reference.

-- ALTER SYSTEM SET shared_buffers            = '256MB';
-- ALTER SYSTEM SET effective_cache_size      = '768MB';
-- ALTER SYSTEM SET maintenance_work_mem      = '64MB';
-- ALTER SYSTEM SET checkpoint_completion_target = '0.9';
-- ALTER SYSTEM SET wal_buffers               = '16MB';
-- ALTER SYSTEM SET default_statistics_target = '100';
-- SELECT pg_reload_conf();
