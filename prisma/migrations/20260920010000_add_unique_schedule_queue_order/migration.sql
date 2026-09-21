-- The application serializes queue allocation and renumbering on the parent
-- jam row. This constraint remains the final protection against any writer
-- that bypasses that protocol.
CREATE UNIQUE INDEX "escalas_jamId_ordem_key" ON "escalas"("jamId", "ordem");
