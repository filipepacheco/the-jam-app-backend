-- Read-only PostgreSQL catalog preflight for a selected target.
-- This script intentionally reads only relevant system-catalog metadata and the
-- Prisma migration ledger. It does not query application-table rows, connection
-- settings, principals, owners, secrets, or migration logs.

-- Application tables present in public.
SELECT c.relname AS table_name,
       c.relpersistence AS persistence,
       c.relrowsecurity AS row_level_security
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN ('escalas', 'feedbacks', 'inscricoes', 'jams', 'jamsmusics',
                    'musicas', 'musicos', 'playback_history')
ORDER BY c.relname;

-- Columns, types, nullability, and identity metadata.
SELECT c.relname AS table_name,
       a.attnum AS ordinal_position,
       a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       NOT a.attnotnull AS is_nullable,
       a.attidentity AS identity_kind
FROM pg_catalog.pg_attribute AS a
JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN ('escalas', 'feedbacks', 'inscricoes', 'jams', 'jamsmusics',
                    'musicas', 'musicos', 'playback_history')
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;

-- Named primary, unique, foreign-key, check, and exclusion constraints.
SELECT c.relname AS table_name,
       con.conname AS constraint_name,
       con.contype AS constraint_type,
       pg_get_constraintdef(con.oid, true) AS definition,
       con.convalidated AS is_validated,
       con.condeferrable AS is_deferrable,
       con.condeferred AS is_initially_deferred
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('escalas', 'feedbacks', 'inscricoes', 'jams', 'jamsmusics',
                    'musicas', 'musicos', 'playback_history')
ORDER BY c.relname, con.conname;

-- Every index, including partial-index predicates and expressions.
SELECT t.relname AS table_name,
       i.relname AS index_name,
       ix.indisprimary AS is_primary,
       ix.indisunique AS is_unique,
       ix.indisvalid AS is_valid,
       pg_get_indexdef(i.oid) AS definition,
       pg_get_expr(ix.indpred, ix.indrelid) AS predicate
FROM pg_catalog.pg_index AS ix
JOIN pg_catalog.pg_class AS i ON i.oid = ix.indexrelid
JOIN pg_catalog.pg_class AS t ON t.oid = ix.indrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN ('escalas', 'feedbacks', 'inscricoes', 'jams', 'jamsmusics',
                    'musicas', 'musicos', 'playback_history')
ORDER BY t.relname, i.relname;

-- Enum labels, including StatusJam and playback types if present.
SELECT ns.nspname AS schema_name,
       t.typname AS enum_name,
       e.enumsortorder AS sort_order,
       e.enumlabel AS enum_label
FROM pg_catalog.pg_type AS t
JOIN pg_catalog.pg_namespace AS ns ON ns.oid = t.typnamespace
JOIN pg_catalog.pg_enum AS e ON e.enumtypid = t.oid
WHERE ns.nspname = 'public'
  AND t.typname IN ('AcaoReproducao', 'EstadoReproducao', 'NivelMusico',
                    'StatusEscala', 'StatusInscricao', 'StatusJam', 'StatusMusica')
ORDER BY t.typname, e.enumsortorder;

-- The Prisma migration ledger is optional. The block only reads non-log metadata
-- when the relation exists, so it is safe for targets created without Prisma Migrate.
DO $$
DECLARE
  migration_record record;
BEGIN
  IF pg_catalog.to_regclass('public._prisma_migrations') IS NOT NULL THEN
    FOR migration_record IN EXECUTE $ledger$
      SELECT migration_name,
             finished_at IS NOT NULL AS finished,
             rolled_back_at IS NOT NULL AS rolled_back,
             applied_steps_count
      FROM public._prisma_migrations
      ORDER BY migration_name
    $ledger$
    LOOP
      RAISE NOTICE '%', json_build_object(
        'migration_name', migration_record.migration_name,
        'finished', migration_record.finished,
        'rolled_back', migration_record.rolled_back,
        'applied_steps_count', migration_record.applied_steps_count
      );
    END LOOP;
  ELSE
    RAISE NOTICE '_prisma_migrations is absent';
  END IF;
END;
$$;
