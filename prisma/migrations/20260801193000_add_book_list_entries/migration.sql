CREATE TABLE "BookListEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolYearId" TEXT NOT NULL,

    CONSTRAINT "BookListEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookListEntry_schoolYearId_sortOrder_idx" ON "BookListEntry"("schoolYearId", "sortOrder");

ALTER TABLE "BookListEntry" ADD CONSTRAINT "BookListEntry_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
