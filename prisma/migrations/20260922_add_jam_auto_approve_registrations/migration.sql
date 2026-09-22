-- Allow each jam host to choose whether new performance registrations are approved automatically.
ALTER TABLE "jams"
ADD COLUMN "auto_approve_registrations" BOOLEAN NOT NULL DEFAULT false;
