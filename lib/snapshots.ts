import { prisma } from "./prisma";
import { saveGeneratedFile } from "./storage";

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
      classification: { not: "snapshot_backup" },
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
