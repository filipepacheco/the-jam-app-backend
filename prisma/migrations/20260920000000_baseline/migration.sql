-- CreateEnum
CREATE TYPE "StatusJam" AS ENUM ('ATIVO', 'INATIVO', 'AO_VIVO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "StatusInscricao" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "StatusEscala" AS ENUM ('SUGERIDO', 'AGENDADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusMusica" AS ENUM ('SUGERIDA', 'APROVADA');

-- CreateEnum
CREATE TYPE "NivelMusico" AS ENUM ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO', 'PROFISSIONAL');

-- CreateEnum
CREATE TYPE "EstadoReproducao" AS ENUM ('PARADO', 'TOCANDO', 'PAUSADO');

-- CreateEnum
CREATE TYPE "AcaoReproducao" AS ENUM ('INICIAR_JAM', 'PARAR_JAM', 'INICIAR_MUSICA', 'PAUSAR_MUSICA', 'RETOMAR_MUSICA', 'PULAR_MUSICA', 'MUSICA_ANTERIOR', 'REORDENAR_FILA');

-- CreateTable
CREATE TABLE "jamsmusics" (
    "jamId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "musicId" TEXT NOT NULL,
    "observacoes" TEXT,

    CONSTRAINT "jamsmusics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jams" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "data" TIMESTAMP(3),
    "qrCode" TEXT,
    "slug" TEXT,
    "codigo_curto" TEXT,
    "status" "StatusJam" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "excluido_em" TIMESTAMP(3),
    "hostContato" TEXT,
    "hostNome" TEXT,
    "hostMusicianId" TEXT,
    "local" TEXT,
    "currentScheduleId" TEXT,
    "playbackState" "EstadoReproducao" NOT NULL DEFAULT 'PARADO',
    "spotify_playlist_url" TEXT,

    CONSTRAINT "jams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "musicas" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "artista" TEXT NOT NULL,
    "genero" TEXT,
    "duracao" INTEGER,
    "descricao" TEXT,
    "link" TEXT,
    "info" TEXT,
    "status" "StatusMusica" NOT NULL DEFAULT 'SUGERIDA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "neededDrums" INTEGER NOT NULL DEFAULT 0,
    "neededGuitars" INTEGER NOT NULL DEFAULT 0,
    "neededVocals" INTEGER NOT NULL DEFAULT 0,
    "neededBass" INTEGER NOT NULL DEFAULT 0,
    "neededKeys" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "musicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "musicos" (
    "id" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "nome" TEXT,
    "instrumento" TEXT,
    "nivel" "NivelMusico",
    "contato" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "telefone" TEXT,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "outros_instrumentos" TEXT,

    CONSTRAINT "musicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscricoes" (
    "id" TEXT NOT NULL,
    "musicoId" TEXT NOT NULL,
    "jamId" TEXT NOT NULL,
    "status" "StatusInscricao" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "jamMusicaId" TEXT,
    "instrumento" TEXT,
    "escalaId" TEXT,

    CONSTRAINT "inscricoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalas" (
    "id" TEXT NOT NULL,
    "jamId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "status" "StatusEscala" NOT NULL DEFAULT 'SUGERIDO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "musicId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),

    CONSTRAINT "escalas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comentario" VARCHAR(500),
    "userAgent" TEXT,
    "pageUrl" TEXT,
    "ipAddress" TEXT,
    "musicoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE INDEX "jamsmusics_musicId_idx" ON "jamsmusics"("musicId");

-- CreateIndex
CREATE UNIQUE INDEX "jamsmusics_jamId_musicId_key" ON "jamsmusics"("jamId", "musicId");

-- CreateIndex
CREATE UNIQUE INDEX "jams_slug_key" ON "jams"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "jams_codigo_curto_key" ON "jams"("codigo_curto");

-- CreateIndex
CREATE UNIQUE INDEX "jams_currentScheduleId_key" ON "jams"("currentScheduleId");

-- CreateIndex
CREATE INDEX "jams_currentScheduleId_idx" ON "jams"("currentScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "musicos_supabaseUserId_key" ON "musicos"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "musicos_email_key" ON "musicos"("email");

-- CreateIndex
CREATE UNIQUE INDEX "musicos_telefone_key" ON "musicos"("telefone");

-- CreateIndex
CREATE INDEX "inscricoes_musicoId_jamId_escalaId_idx" ON "inscricoes"("musicoId", "jamId", "escalaId");

-- CreateIndex
CREATE UNIQUE INDEX "inscricoes_musicoId_jamId_jamMusicaId_key" ON "inscricoes"("musicoId", "jamId", "jamMusicaId");

-- CreateIndex
CREATE INDEX "escalas_jamId_status_ordem_idx" ON "escalas"("jamId", "status", "ordem");

-- CreateIndex
CREATE INDEX "escalas_musicId_idx" ON "escalas"("musicId");

-- CreateIndex
CREATE INDEX "feedbacks_musicoId_idx" ON "feedbacks"("musicoId");

-- CreateIndex
CREATE INDEX "feedbacks_criadoEm_idx" ON "feedbacks"("criadoEm");

-- CreateIndex
CREATE INDEX "playback_history_jamId_timestamp_idx" ON "playback_history"("jamId", "timestamp");

-- AddForeignKey
ALTER TABLE "jamsmusics" ADD CONSTRAINT "jamsmusics_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "jams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jamsmusics" ADD CONSTRAINT "jamsmusics_musicId_fkey" FOREIGN KEY ("musicId") REFERENCES "musicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jams" ADD CONSTRAINT "jams_hostMusicianId_fkey" FOREIGN KEY ("hostMusicianId") REFERENCES "musicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jams" ADD CONSTRAINT "jams_currentScheduleId_fkey" FOREIGN KEY ("currentScheduleId") REFERENCES "escalas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_escalaId_fkey" FOREIGN KEY ("escalaId") REFERENCES "escalas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "jams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_jamMusicaId_fkey" FOREIGN KEY ("jamMusicaId") REFERENCES "jamsmusics"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inscricoes" ADD CONSTRAINT "inscricoes_musicoId_fkey" FOREIGN KEY ("musicoId") REFERENCES "musicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "jams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalas" ADD CONSTRAINT "escalas_musicId_fkey" FOREIGN KEY ("musicId") REFERENCES "musicas"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_musicoId_fkey" FOREIGN KEY ("musicoId") REFERENCES "musicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_history" ADD CONSTRAINT "playback_history_jamId_fkey" FOREIGN KEY ("jamId") REFERENCES "jams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_history" ADD CONSTRAINT "playback_history_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "escalas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
