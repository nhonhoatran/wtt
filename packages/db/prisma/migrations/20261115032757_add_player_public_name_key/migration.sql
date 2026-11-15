-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "normalizedPublicName" TEXT NOT NULL DEFAULT '';

-- Keep the database key equivalent to shared normalizePersonName without requiring an extension.
-- The whitespace class is JavaScript's \s set, including NBSP and BOM.
CREATE FUNCTION "normalize_public_player_name"(value TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS $function$
  SELECT lower(btrim(regexp_replace(
    normalize(translate(regexp_replace(normalize(value, NFD), U&'[\0300-\036f]', '', 'g'), 'đĐ', 'dD'), NFC),
    U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'
  )));
$function$;

CREATE FUNCTION "refresh_player_public_name_key"() RETURNS TRIGGER
LANGUAGE plpgsql AS $function$
BEGIN
  NEW."normalizedPublicName" := "normalize_public_player_name"(COALESCE(NEW."publicDisplayName", NEW."fullName"));
  RETURN NEW;
END;
$function$;

-- Covers API writes, imports, merges, and direct data maintenance, including attempts to override the key.
CREATE TRIGGER "Player_public_name_key" BEFORE INSERT OR UPDATE ON "Player"
FOR EACH ROW EXECUTE FUNCTION "refresh_player_public_name_key"();

UPDATE "Player" SET "normalizedPublicName" = "normalize_public_player_name"(COALESCE("publicDisplayName", "fullName"));

-- CreateIndex
CREATE INDEX "Player_normalizedPublicName_idx" ON "Player"("normalizedPublicName");
