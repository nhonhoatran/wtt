-- New rows require an explicit public-profile opt-in; existing flags are preserved.
ALTER TABLE "Player" ALTER COLUMN "isPublicProfile" SET DEFAULT false;
