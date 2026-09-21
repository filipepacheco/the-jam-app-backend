-- Add missing indexes for reverse lookups
CREATE INDEX IF NOT EXISTS "jamsmusics_musicId_idx" ON "jamsmusics"("musicId");
CREATE INDEX IF NOT EXISTS "escalas_musicId_idx" ON "escalas"("musicId");

-- Add updatedAt columns to models that were missing them
ALTER TABLE "musicas" ADD COLUMN IF NOT EXISTS "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "inscricoes" ADD COLUMN IF NOT EXISTS "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "escalas" ADD COLUMN IF NOT EXISTS "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "feedbacks" ADD COLUMN IF NOT EXISTS "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop orphaned inscricaoId column from escalas (no relation, no FK, no service usage)
ALTER TABLE "escalas" DROP COLUMN IF EXISTS "inscricaoId";
