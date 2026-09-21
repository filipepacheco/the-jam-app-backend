-- Add composite index for Registration table to optimize query pattern
CREATE INDEX IF NOT EXISTS "inscricoes_musicoId_jamId_escalaId_idx" ON "inscricoes"("musicoId", "jamId", "escalaId");

-- Add partial unique index to prevent multiple IN_PROGRESS schedules per jam
-- This ensures only one song can be IN_PROGRESS at any time for a given jam
CREATE UNIQUE INDEX IF NOT EXISTS "escalas_jamId_in_progress_unique" ON "escalas"("jamId") WHERE "status" = 'EM_ANDAMENTO';
