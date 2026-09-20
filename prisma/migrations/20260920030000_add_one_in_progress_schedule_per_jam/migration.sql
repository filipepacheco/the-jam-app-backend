-- Prisma cannot declare PostgreSQL partial indexes. This constraint is the
-- database backstop for the playback command serialization protocol.
CREATE UNIQUE INDEX "escalas_jamId_in_progress_unique"
ON "escalas"("jamId")
WHERE "status" = 'EM_ANDAMENTO';
