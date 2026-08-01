-- CreateTable
CREATE TABLE "QuarterReview" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quarterStartDate" TIMESTAMP(3) NOT NULL,
    "quarterEndDate" TIMESTAMP(3) NOT NULL,
    "reviewDueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dataJson" TEXT NOT NULL,
    "recordStatus" TEXT NOT NULL DEFAULT 'trial',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolYearId" TEXT NOT NULL,

    CONSTRAINT "QuarterReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuarterReview_schoolYearId_label_key" ON "QuarterReview"("schoolYearId", "label");

-- CreateIndex
CREATE INDEX "QuarterReview_quarterStartDate_quarterEndDate_reviewDueDate_status_idx" ON "QuarterReview"("quarterStartDate", "quarterEndDate", "reviewDueDate", "status");

-- AddForeignKey
ALTER TABLE "QuarterReview" ADD CONSTRAINT "QuarterReview_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
