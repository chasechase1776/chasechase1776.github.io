-- CreateTable
CREATE TABLE "PortfolioListEntry" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolYearId" TEXT NOT NULL,

    CONSTRAINT "PortfolioListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioListEntry_schoolYearId_category_sortOrder_idx" ON "PortfolioListEntry"("schoolYearId", "category", "sortOrder");

-- AddForeignKey
ALTER TABLE "PortfolioListEntry" ADD CONSTRAINT "PortfolioListEntry_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
