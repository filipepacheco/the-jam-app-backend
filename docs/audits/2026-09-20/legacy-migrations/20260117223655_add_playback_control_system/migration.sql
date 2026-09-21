-- CreateEnum "PlaybackState"
CREATE TYPE "EstadoReproducao" AS ENUM ('PARADO', 'TOCANDO', 'PAUSADO');

-- CreateEnum "PlaybackAction"
CREATE TYPE "AcaoReproducao" AS ENUM ('INICIAR_JAM', 'PARAR_JAM', 'INICIAR_MUSICA', 'PAUSAR_MUSICA', 'RETOMAR_MUSICA', 'PULAR_MUSICA', 'MUSICA_ANTERIOR', 'REORDENAR_FILA');

-- CreateTable "playback_history"
CREATE TABLE "playback_history" (
    "id" TEXT NOT NULL,
    "jamId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "acao" "AcaoReproducao" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "playback_history_pkey" PRIMARY KEY ("id")
);

-- AlterTable "jams"
ALTER TABLE "jams" ADD COLUMN "currentScheduleId" TEXT,
ADD COLUMN "playbackState" "EstadoReproducao" NOT NULL DEFAULT 'PARADO',
ADD CONSTRAINT "jams_currentScheduleId_key" UNIQUE ("currentScheduleId");

-- AlterTable "escalas"
ALTER TABLE "escalas" ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "pausedAt" TIMESTAMP(3);

-- Drop the old unique constraint and add the new one
ALTER TABLE "escalas" DROP CONSTRAINT "escalas_inscricaoId_ordem_key";
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_jamId_ordem_key" UNIQUE ("jamId", "ordem");

-- CreateIndex on playback_history
CREATE INDEX "playback_history_jamId_timestamp_idx" ON "playback_history"("jamId", "timestamp");

-- CreateIndex on escalas
CREATE INDEX "escalas_jamId_status_idx" ON "escalas"("jamId", "status");

-- AddForeignKey for playback_history
ALTER TABLE "playback_history" ADD CONSTRAINT "playback_history_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "jams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playback_history" ADD CONSTRAINT "playback_history_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "escalas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for currentSchedule
ALTER TABLE "jams" ADD CONSTRAINT "jams_currentScheduleId_fkey" FOREIGN KEY ("currentScheduleId") REFERENCES "escalas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create partial unique index to prevent multiple IN_PROGRESS songs per jam
CREATE UNIQUE INDEX "idx_one_in_progress_per_jam" ON "escalas"("jamId") WHERE "status" = 'EM_ANDAMENTO';
