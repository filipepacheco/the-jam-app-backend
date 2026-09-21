-- Read-only preflight for applying post-baseline constraints to an existing target.
-- Every result must report zero before `prisma migrate deploy` is authorized.

SELECT 'duplicate_queue_positions' AS check_name, count(*)::bigint AS violations
FROM (
  SELECT "jamId", "ordem"
  FROM "escalas"
  GROUP BY "jamId", "ordem"
  HAVING count(*) > 1
) AS duplicates
UNION ALL
SELECT 'duplicate_registration_identities', count(*)::bigint
FROM (
  SELECT "musicoId", "escalaId", "instrumento"
  FROM "inscricoes"
  WHERE "escalaId" IS NOT NULL AND "instrumento" IS NOT NULL
  GROUP BY "musicoId", "escalaId", "instrumento"
  HAVING count(*) > 1
) AS duplicates
UNION ALL
SELECT 'multiple_in_progress_schedules', count(*)::bigint
FROM (
  SELECT "jamId"
  FROM "escalas"
  WHERE "status" = 'EM_ANDAMENTO'
  GROUP BY "jamId"
  HAVING count(*) > 1
) AS duplicates
UNION ALL
SELECT 'duplicate_spotify_links', count(*)::bigint
FROM (
  SELECT "link"
  FROM "musicas"
  WHERE "link" IS NOT NULL
  GROUP BY "link"
  HAVING count(*) > 1
) AS duplicates;
