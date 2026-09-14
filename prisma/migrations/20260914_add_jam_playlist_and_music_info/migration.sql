-- Keep the database schema aligned with fields used by the Jam and Music Prisma models.
ALTER TABLE "jams" ADD COLUMN "spotify_playlist_url" TEXT;
ALTER TABLE "musicas" ADD COLUMN "info" TEXT;
