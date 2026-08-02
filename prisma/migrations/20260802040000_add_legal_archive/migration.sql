-- CreateTable
CREATE TABLE "LegalArchiveBucket" (
    "id" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolYearId" TEXT NOT NULL,

    CONSTRAINT "LegalArchiveBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalArchiveLink" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bucketId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,

    CONSTRAINT "LegalArchiveLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalArchiveBucket_schoolYearId_bucketKey_key" ON "LegalArchiveBucket"("schoolYearId", "bucketKey");

-- CreateIndex
CREATE UNIQUE INDEX "LegalArchiveLink_bucketId_artifactId_key" ON "LegalArchiveLink"("bucketId", "artifactId");

-- AddForeignKey
ALTER TABLE "LegalArchiveBucket" ADD CONSTRAINT "LegalArchiveBucket_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalArchiveLink" ADD CONSTRAINT "LegalArchiveLink_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "LegalArchiveBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalArchiveLink" ADD CONSTRAINT "LegalArchiveLink_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "EvidenceArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
