-- At most one default row per catalog. Partial unique indexes: Prisma cannot model WHERE clauses, so they live only in SQL.
CREATE UNIQUE INDEX "MatchFormat_single_default" ON "MatchFormat" ("isDefault") WHERE "isDefault";

CREATE UNIQUE INDEX "GroupScoringRule_single_default" ON "GroupScoringRule" ("isDefault") WHERE "isDefault";
