-- A registration is an application for one instrument on one scheduled song
-- occurrence. The constraint protects this identity when concurrent HTTP
-- requests bypass the service-level precheck.
CREATE UNIQUE INDEX "inscricoes_musicoId_escalaId_instrumento_key"
ON "inscricoes"("musicoId", "escalaId", "instrumento");
