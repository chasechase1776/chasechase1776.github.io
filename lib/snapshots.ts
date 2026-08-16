import JSZip from "jszip";
import { createAuditLogSafely } from "./audit";
import { prisma } from "./prisma";
import { readStoredFile, saveGeneratedFile } from "./storage";

type SnapshotInput = {
  schoolYearId: string;
  type: string;
  label: string;
  payload: Record<string, unknown>;
};

type BackupCheckStatus = "pass" | "fail";

type BackupVerificationCheck = {
  name: string;
  status: BackupCheckStatus;
  details: string;
};

type BackupVerificationResult = {
  verifiedAt: string;
  restoreReady: boolean;
  snapshotId: string | null;
  label: string | null;
  filePath: string | null;
  checks: BackupVerificationCheck[];
  totals?: Record<string, number>;
  includedFileCount?: number;
  missingFileCount?: number;
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

function artifactIdFromSnapshotPath(filePath: string) {
  const match = filePath.match(/\/api\/artifacts\/([^/]+)\/download/);
  return match?.[1] ?? null;
}

function addBackupCheck(checks: BackupVerificationCheck[], name: string, passed: boolean, details: string) {
  checks.push({ name, status: passed ? "pass" : "fail", details });
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

  const snapshot = await prisma.exportSnapshot.create({
    data: {
      type: input.type,
      label: input.label,
      filePath: `/api/artifacts/${artifact.id}/download`,
      schoolYearId: schoolYear.id
    }
  });
  await createAuditLogSafely({
    schoolYearId: schoolYear.id,
    action: "checkpoint_created",
    label: input.label,
    details: {
      snapshotId: snapshot.id,
      snapshotType: input.type,
      artifactId: artifact.id
    }
  });

  return snapshot;
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

async function verifyFullBackupBytes(bytes: Buffer, expectedSchoolYearId?: string) {
  const checks: BackupVerificationCheck[] = [];
  const zip = await JSZip.loadAsync(bytes);
  const backupFile = zip.file("school-year-backup.json");
  const manifestFile = zip.file("file-manifest.json");

  addBackupCheck(checks, "Backup JSON", Boolean(backupFile), "school-year-backup.json is required for restore.");
  addBackupCheck(checks, "File manifest", Boolean(manifestFile), "file-manifest.json is required to reconnect stored files.");

  if (!backupFile || !manifestFile) {
    return {
      checks,
      restoreReady: false
    };
  }

  const backup = JSON.parse(await backupFile.async("string")) as {
    backupKind?: string;
    schoolYear?: { id?: string; label?: string };
    records?: {
      activities?: unknown[];
      artifacts?: unknown[];
      annualPlans?: unknown[];
      weeklyReviews?: unknown[];
      quarterReviews?: unknown[];
      legalArchiveBuckets?: unknown[];
      bookListEntries?: unknown[];
      portfolioListEntries?: unknown[];
    };
    totals?: Record<string, number>;
  };
  const manifest = JSON.parse(await manifestFile.async("string")) as {
    includedFiles?: { zipPath: string; sizeBytes: number }[];
    missingFiles?: unknown[];
  };
  const totals = backup.totals ?? {};
  const records = backup.records ?? {};
  const includedFiles = manifest.includedFiles ?? [];
  const missingFiles = manifest.missingFiles ?? [];
  const artifactCount = Array.isArray(records.artifacts) ? records.artifacts.length : 0;

  addBackupCheck(checks, "Backup kind", backup.backupKind === "full_school_year_backup", "Package identifies itself as a full school-year backup.");
  addBackupCheck(
    checks,
    "School year match",
    !expectedSchoolYearId || backup.schoolYear?.id === expectedSchoolYearId,
    `Package belongs to ${backup.schoolYear?.label ?? "an unknown school year"}.`
  );
  addBackupCheck(checks, "Activity count", (records.activities?.length ?? 0) === totals.activities, `${records.activities?.length ?? 0} activities match the backup total.`);
  addBackupCheck(checks, "Artifact count", artifactCount === totals.artifacts, `${artifactCount} artifacts match the backup total.`);
  addBackupCheck(checks, "Annual plan count", (records.annualPlans?.length ?? 0) === totals.annualPlans, `${records.annualPlans?.length ?? 0} annual plan record(s) included.`);
  addBackupCheck(checks, "Weekly review count", (records.weeklyReviews?.length ?? 0) === totals.weeklyReviews, `${records.weeklyReviews?.length ?? 0} weekly review record(s) included.`);
  addBackupCheck(checks, "Quarter review count", (records.quarterReviews?.length ?? 0) === totals.quarterReviews, `${records.quarterReviews?.length ?? 0} quarter review record(s) included.`);
  addBackupCheck(checks, "Legal archive count", (records.legalArchiveBuckets?.length ?? 0) === totals.legalArchiveBuckets, `${records.legalArchiveBuckets?.length ?? 0} legal bucket(s) included.`);
  addBackupCheck(
    checks,
    "Manifest coverage",
    includedFiles.length + missingFiles.length === artifactCount,
    `${includedFiles.length} file(s) included and ${missingFiles.length} missing file(s) listed for ${artifactCount} artifact record(s).`
  );
  addBackupCheck(checks, "No missing stored files", missingFiles.length === 0, `${missingFiles.length} stored file(s) were missing when the backup was created.`);

  let zipFilesValid = true;
  for (const file of includedFiles) {
    const zipEntry = zip.file(file.zipPath);
    if (!zipEntry) {
      zipFilesValid = false;
      break;
    }
    const fileBytes = await zipEntry.async("nodebuffer");
    if (fileBytes.length !== file.sizeBytes) {
      zipFilesValid = false;
      break;
    }
  }
  addBackupCheck(checks, "Embedded files", zipFilesValid, `${includedFiles.length} embedded file(s) can be opened from the ZIP.`);

  return {
    checks,
    restoreReady: checks.every((check) => check.status === "pass"),
    totals,
    includedFileCount: includedFiles.length,
    missingFileCount: missingFiles.length
  };
}

export async function verifyLatestFullSchoolYearBackupPackage(schoolYearId: string): Promise<BackupVerificationResult> {
  const verifiedAt = new Date().toISOString();
  const snapshot = await prisma.exportSnapshot.findFirst({
    where: { schoolYearId, type: "full_school_year_backup" },
    orderBy: { createdAt: "desc" }
  });

  if (!snapshot) {
    return {
      verifiedAt,
      restoreReady: false,
      snapshotId: null,
      label: null,
      filePath: null,
      checks: [{ name: "Full backup package", status: "fail", details: "No full school-year backup package exists yet." }]
    };
  }

  const artifactId = artifactIdFromSnapshotPath(snapshot.filePath);
  const artifact = artifactId ? await prisma.evidenceArtifact.findUnique({ where: { id: artifactId } }) : null;
  if (!artifact) {
    return {
      verifiedAt,
      restoreReady: false,
      snapshotId: snapshot.id,
      label: snapshot.label,
      filePath: snapshot.filePath,
      checks: [{ name: "Backup artifact", status: "fail", details: "The snapshot does not point to a stored backup ZIP artifact." }]
    };
  }

  const bytes = await readStoredFile(artifact.storagePath);
  const verification = await verifyFullBackupBytes(bytes, schoolYearId);
  return {
    verifiedAt,
    restoreReady: verification.restoreReady,
    snapshotId: snapshot.id,
    label: snapshot.label,
    filePath: snapshot.filePath,
    checks: verification.checks,
    totals: verification.totals,
    includedFileCount: verification.includedFileCount,
    missingFileCount: verification.missingFileCount
  };
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
  const verification = await verifyFullBackupBytes(bytes, input.schoolYearId);
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
        missingFileCount: manifest.missingFiles.length,
        restoreReady: verification.restoreReady,
        verifiedAt: createdAt.toISOString()
      })
    }
  });

  const snapshot = await prisma.exportSnapshot.create({
    data: {
      type: "full_school_year_backup",
      label: input.label,
      filePath: `/api/artifacts/${artifact.id}/download`,
      schoolYearId: schoolYear.id
    }
  });
  await createAuditLogSafely({
    schoolYearId: schoolYear.id,
    action: "full_backup_created",
    label: input.label,
    details: {
      snapshotId: snapshot.id,
      artifactId: artifact.id,
      totals: backup.totals
    }
  });

  return snapshot;
}

export async function createArtifactSnapshot(input: {
  schoolYearId: string;
  type: string;
  label: string;
  artifactId: string;
}) {
  const artifact = await prisma.evidenceArtifact.findUnique({ where: { id: input.artifactId } });
  if (!artifact) return null;

  const snapshot = await prisma.exportSnapshot.create({
    data: {
      type: input.type,
      label: input.label,
      filePath: `/api/artifacts/${artifact.id}/download`,
      schoolYearId: input.schoolYearId
    }
  });
  await createAuditLogSafely({
    schoolYearId: input.schoolYearId,
    action: "report_artifact_saved",
    label: input.label,
    details: {
      snapshotId: snapshot.id,
      snapshotType: input.type,
      artifactId: artifact.id
    }
  });

  return snapshot;
}
