-- CreateTable "feedbacks"
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comentario" VARCHAR(500),
    "userAgent" TEXT,
    "pageUrl" TEXT,
    "ipAddress" TEXT,
    "musicoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on feedbacks
CREATE INDEX "feedbacks_musicoId_idx" ON "feedbacks"("musicoId");
CREATE INDEX "feedbacks_criadoEm_idx" ON "feedbacks"("criadoEm");

-- AddForeignKey for feedbacks
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_musicoId_fkey" FOREIGN KEY ("musicoId") REFERENCES "musicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
