import JSZip from "jszip";
import { prisma } from "./prisma";
import { readStoredFile, saveGeneratedFile } from "./storage";

type SnapshotInput = {
  schoolYearId: string;
  type: string;
  label: string;
  payload: Record<string, unknown>;
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "snapshot";
}

function schoolYearStartYear(label: string) {
  const match = label.match(/\d{4}/);
  return match ? Number(match[0]) : new Date().getUTCFullYear();
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "file";
}

function countMeaningfulDays(activities: { date: Date; actualMinutes: number; parentApproved: boolean }[], start: string, end: string) {
  const dayTotals = new Map<string, number>();
  activities
    .filter((activity) => activity.parentApproved)
    .forEach((activity) => {
      const day = dateKey(activity.date);
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + activity.actualMinutes);
    });

  return Array.from(dayTotals.entries()).filter(([day, minutes]) => day >= start && day <= end && minutes >= 180).length;
}

export async function createExportSnapshot(input: SnapshotInput) {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: input.schoolYearId },
    include: { student: true }
  });

  if (!schoolYear) return null;

  const createdAt = new Date();
  const backup = {
    snapshot: {
      type: input.type,
      label: input.label,
      createdAt: createdAt.toISOString(),
      student: schoolYear.student.name,
      schoolYear: schoolYear.label,
      schoolYearStatus: schoolYear.status
    },
    data: input.payload
  };
  const bytes = Buffer.from(JSON.stringify(backup, null, 2));
  const fileName = `${slug(input.type)}-${slug(input.label)}-${createdAt.toISOString().replace(/[:.]/g, "-")}.json`;
  const savedFile = await saveGeneratedFile(bytes, fileName, "application/json");
  const artifact = await prisma.evidenceArtifact.create({
    data: {
      ...savedFile,
      recordStatus: schoolYear.status,
      classification: "snapshot_backup",
      tagsJson: JSON.stringify({
        schoolYear: schoolYear.label,
        student: schoolYear.student.name,
        snapshotType: input.type,
        snapshotLabel: input.label
      })
    }
  });

  return prisma.exportSnapshot.create({
    data: {
      type: input.type,
      label: input.label,
      filePath: `/api/artifacts/${artifact.id}/download`,
      schoolYearId: schoolYear.id
    }
  });
}

export async function buildFullSchoolYearBackup(schoolYearId: string) {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    include: {
      student: true,
      annualPlans: true,
      weeklyReviews: { orderBy: { weekStartDate: "asc" } },
      quarterReviews: { orderBy: { quarterStartDate: "asc" } },
      bookListEntries: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      portfolioListEntries: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
      legalArchiveBuckets: {
        include: {
          links: {
            include: { artifact: true },
            orderBy: { createdAt: "desc" }
          }
        },
        orderBy: { bucketKey: "asc" }
      },
      exportSnapshots: { orderBy: { createdAt: "desc" }, take: 200 }
    }
  });

  if (!schoolYear) return null;

  const activities = await prisma.activity.findMany({
    where: { schoolYearId },
    include: {
      unitStudy: true,
      allocations: true,
      legalTags: { include: { legalTag: true } },
      skills: { include: { skill: true } },
      artifacts: true
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }]
  });
  const artifacts = await prisma.evidenceArtifact.findMany({
    where: {
      NOT: [
        { classification: "snapshot_backup" },
        { classification: "full_backup_package" }
      ],
      OR: [
        { activity: { schoolYearId } },
        { tagsJson: { contains: schoolYear.label } }
      ]
    },
    orderBy: { createdAt: "desc" }
  });
  const startYear = schoolYearStartYear(schoolYear.label);
  const traditionalStart = `${startYear}-08-15`;
  const traditionalEnd = `${startYear + 1}-06-15`;
  const summerStart = `${startYear + 1}-06-16`;
  const summerEnd = `${startYear + 1}-08-14`;

  return {
    backupKind: "full_school_year_backup",
    restoreNote: "This JSON contains app records and file references. Uploaded file binaries remain in storage and are referenced by artifact records.",
    student: schoolYear.student,
    schoolYear: {
      id: schoolYear.id,
      label: schoolYear.label,
      status: schoolYear.status,
      startDate: schoolYear.startDate,
      endDate: schoolYear.endDate,
      officialHomeschoolStartDate: schoolYear.officialHomeschoolStartDate,
      includeTrialRecordsInReports: schoolYear.includeTrialRecordsInReports
    },
    attendance: {
      meaningfulDayRuleMinutes: 180,
      traditionalSchoolYear: {
        start: traditionalStart,
        end: traditionalEnd,
        days: countMeaningfulDays(activities, traditionalStart, traditionalEnd)
      },
      summerExtension: {
        start: summerStart,
        end: summerEnd,
        days: countMeaningfulDays(activities, summerStart, summerEnd)
      }
    },
    records: {
      activities,
      annualPlans: schoolYear.annualPlans.map((plan) => ({
        ...plan,
        data: JSON.parse(plan.dataJson)
      })),
      weeklyReviews: schoolYear.weeklyReviews.map((review) => ({
        ...review,
        data: JSON.parse(review.dataJson)
      })),
      quarterReviews: schoolYear.quarterReviews.map((review) => ({
        ...review,
        data: JSON.parse(review.dataJson)
      })),
      bookListEntries: schoolYear.bookListEntries,
      portfolioListEntries: schoolYear.portfolioListEntries.map((entry) => ({
        ...entry,
        followUps: JSON.parse(entry.followUpsJson),
        artifactIds: JSON.parse(entry.artifactIdsJson)
      })),
      legalArchiveBuckets: schoolYear.legalArchiveBuckets,
      artifacts,
      exportSnapshots: schoolYear.exportSnapshots
    },
    totals: {
      activities: activities.length,
      artifacts: artifacts.length,
      annualPlans: schoolYear.annualPlans.length,
      weeklyReviews: schoolYear.weeklyReviews.length,
      quarterReviews: schoolYear.quarterReviews.length,
      bookListEntries: schoolYear.bookListEntries.length,
      portfolioListEntries: schoolYear.portfolioListEntries.length,
      legalArchiveBuckets: schoolYear.legalArchiveBuckets.length
    }
  };
}

function folderForArtifact(artifact: { classification: string | null; mimeType: string; activityId: string | null }) {
  if (artifact.classification?.includes("report") || artifact.classification?.includes("annual_plan") || artifact.mimeType === "application/pdf") {
    return "files/reports";
  }
  if (artifact.classification === "legal_archive") return "files/legal-archive";
  if (artifact.activityId) return "files/proof-of-learning";
  return "files/other";
}

export async function createFullSchoolYearBackupPackage(input: {
  schoolYearId: string;
  label: string;
  note: string;
}) {
  const backup = await buildFullSchoolYearBackup(input.schoolYearId);
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: input.schoolYearId },
    include: { student: true }
  });

  if (!backup || !schoolYear) return null;

  const createdAt = new Date();
  const zip = new JSZip();
  const manifest: {
    createdAt: string;
    note: string;
    includedFiles: { artifactId: string; originalName: string; zipPath: string; mimeType: string; sizeBytes: number }[];
    missingFiles: { artifactId: string; originalName: string; reason: string }[];
  } = {
    createdAt: createdAt.toISOString(),
    note: input.note,
    includedFiles: [],
    missingFiles: []
  };

  zip.file("school-year-backup.json", JSON.stringify({ note: input.note, ...backup }, null, 2));
  zip.file(
    "README.txt",
    [
      "Bennett Homeschool full school-year backup package",
      "",
      "school-year-backup.json contains the app records.",
      "The files folder contains copies of available uploaded proof files, legal archive files, generated PDFs, and other stored artifacts.",
      "A future restore tool can use this package to rebuild records and reconnect files."
    ].join("\n")
  );

  for (const artifact of backup.records.artifacts) {
    try {
      const bytes = await readStoredFile(artifact.storagePath);
      const zipPath = `${folderForArtifact(artifact)}/${safePathPart(artifact.id)}-${safePathPart(artifact.originalName)}`;
      zip.file(zipPath, bytes);
      manifest.includedFiles.push({
        artifactId: artifact.id,
        originalName: artifact.originalName,
        zipPath,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes
      });
    } catch (error) {
      manifest.missingFiles.push({
        artifactId: artifact.id,
        originalName: artifact.originalName,
        reason: error instanceof Error ? error.message : "Stored file could not be read."
      });
    }
  }

  zip.file("file-manifest.json", JSON.stringify(manifest, null, 2));
  const bytes = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  const fileName = `${slug("full-school-year-backup")}-${slug(schoolYear.label)}-${createdAt.toISOString().replace(/[:.]/g, "-")}.zip`;
  const savedFile = await saveGeneratedFile(bytes, fileName, "application/zip");
  const artifact = await prisma.evidenceArtifact.create({
    data: {
      ...savedFile,
      recordStatus: schoolYear.status,
      classification: "full_backup_package",
      tagsJson: JSON.stringify({
        schoolYear: schoolYear.label,
        student: schoolYear.student.name,
        snapshotType: "full_school_year_backup",
        snapshotLabel: input.label,
        includedFileCount: manifest.includedFiles.length,
        missingFileCount: manifest.missingFiles.length
      })
    }
  });

  return prisma.exportSnapshot.create({
    data: {
      type: "full_school_year_backup",
      label: input.label,
      filePath: `/api/artifacts/${artifact.id}/download`,
      schoolYearId: schoolYear.id
    }
  });
}

export async function createArtifactSnapshot(input: {
  schoolYearId: string;
  type: string;
  label: string;
  artifactId: string;
}) {
  const artifact = await prisma.evidenceArtifact.findUnique({ where: { id: input.artifactId } });
  if (!artifact) return null;

  return prisma.exportSnapshot.create({
    data: {
      type: input.type,
      label: input.label,
      filePath: `/api/artifacts/${artifact.id}/download`,
      schoolYearId: input.schoolYearId
    }
  });
}
