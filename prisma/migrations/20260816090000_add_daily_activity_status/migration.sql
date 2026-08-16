CREATE TABLE IF NOT EXISTS "DailyActivityStatus" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "activityType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolYearId" TEXT NOT NULL,

    CONSTRAINT "DailyActivityStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyActivityStatus_schoolYearId_date_activityType_key" ON "DailyActivityStatus"("schoolYearId", "date", "activityType");

CREATE INDEX IF NOT EXISTS "DailyActivityStatus_date_status_idx" ON "DailyActivityStatus"("date", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DailyActivityStatus_schoolYearId_fkey'
  ) THEN
    ALTER TABLE "DailyActivityStatus"
    ADD CONSTRAINT "DailyActivityStatus_schoolYearId_fkey"
    FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
