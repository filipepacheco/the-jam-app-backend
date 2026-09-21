-- Spotify URLs identify catalog tracks. Nullable values remain allowed for
-- manually entered songs, while non-null URLs cannot be duplicated.
CREATE UNIQUE INDEX "musicas_link_key" ON "musicas"("link");

-- A caller-provided key makes new-event imports safely replayable per host.
ALTER TABLE "jams" ADD COLUMN "spotify_import_key" TEXT;
CREATE UNIQUE INDEX "jams_hostMusicianId_spotify_import_key_key"
ON "jams"("hostMusicianId", "spotify_import_key");
