-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SchoolYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'trial',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "officialHomeschoolStartDate" DATETIME,
    "includeTrialRecordsInReports" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "studentId" TEXT NOT NULL,
    CONSTRAINT "SchoolYear_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnitStudy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    CONSTRAINT "UnitStudy_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "actualMinutes" INTEGER NOT NULL,
    "activityType" TEXT NOT NULL,
    "narration" TEXT NOT NULL,
    "notes" TEXT,
    "recordStatus" TEXT NOT NULL DEFAULT 'trial',
    "parentApproved" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" TEXT NOT NULL DEFAULT 'needs_review',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    "unitStudyId" TEXT,
    CONSTRAINT "Activity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_unitStudyId_fkey" FOREIGN KEY ("unitStudyId") REFERENCES "UnitStudy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubjectAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "activityId" TEXT NOT NULL,
    CONSTRAINT "SubjectAllocation_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LegalTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityLegalTag" (
    "activityId" TEXT NOT NULL,
    "legalTagId" TEXT NOT NULL,
    PRIMARY KEY ("activityId", "legalTagId"),
    CONSTRAINT "ActivityLegalTag_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityLegalTag_legalTagId_fkey" FOREIGN KEY ("legalTagId") REFERENCES "LegalTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ActivitySkill" (
    "activityId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    PRIMARY KEY ("activityId", "skillId"),
    CONSTRAINT "ActivitySkill_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivitySkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "recordStatus" TEXT NOT NULL DEFAULT 'trial',
    "classification" TEXT,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityId" TEXT,
    CONSTRAINT "EvidenceArtifact_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStartDate" DATETIME NOT NULL,
    "weekEndDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dataJson" TEXT NOT NULL,
    "recordStatus" TEXT NOT NULL DEFAULT 'trial',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "schoolYearId" TEXT NOT NULL,
    CONSTRAINT "WeeklyReview_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExportSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schoolYearId" TEXT NOT NULL,
    CONSTRAINT "ExportSnapshot_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_name_key" ON "Student"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolYear_studentId_label_key" ON "SchoolYear"("studentId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "UnitStudy_schoolYearId_title_key" ON "UnitStudy"("schoolYearId", "title");

-- CreateIndex
CREATE INDEX "Activity_date_activityType_parentApproved_reviewStatus_idx" ON "Activity"("date", "activityType", "parentApproved", "reviewStatus");

-- CreateIndex
CREATE INDEX "Activity_recordStatus_idx" ON "Activity"("recordStatus");

-- CreateIndex
CREATE UNIQUE INDEX "LegalTag_label_key" ON "LegalTag"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_subject_name_key" ON "Skill"("subject", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_schoolYearId_weekStartDate_key" ON "WeeklyReview"("schoolYearId", "weekStartDate");
