CREATE TYPE "ModoGestaoJam" AS ENUM ('OWNER_ONLY', 'SHARED_HOSTS');

ALTER TABLE "jams"
ADD COLUMN "modoGestao" "ModoGestaoJam" NOT NULL DEFAULT 'OWNER_ONLY';

-- Existing events keep their historic behavior after this rollout.
UPDATE "jams" SET "modoGestao" = 'SHARED_HOSTS';
