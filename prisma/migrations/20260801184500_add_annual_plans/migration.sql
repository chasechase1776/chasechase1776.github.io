CREATE TABLE "AnnualPlan" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "dataJson" TEXT NOT NULL,
    "recordStatus" TEXT NOT NULL DEFAULT 'trial',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolYearId" TEXT NOT NULL,

    CONSTRAINT "AnnualPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnualPlan_schoolYearId_key" ON "AnnualPlan"("schoolYearId");

ALTER TABLE "AnnualPlan" ADD CONSTRAINT "AnnualPlan_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
