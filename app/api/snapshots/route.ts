import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildFullSchoolYearBackup, createExportSnapshot } from "@/lib/snapshots";

const snapshotSchema = z.object({
  studentName: z.string().min(1).default("Bennett C. Claypool"),
  schoolYearLabel: z.string().min(1),
  schoolYearStatus: z.string().default("trial"),
  type: z.string().min(1).default("manual_checkpoint"),
  label: z.string().min(1).default("Manual school-year checkpoint"),
  note: z.string().default("")
});

async function schoolYearFor(studentName: string, schoolYearLabel: string, schoolYearStatus = "trial") {
  const student = await prisma.student.upsert({
    where: { name: studentName },
    update: {},
    create: { name: studentName }
  });

  return prisma.schoolYear.upsert({
    where: { studentId_label: { studentId: student.id, label: schoolYearLabel } },
    update: { status: schoolYearStatus },
    create: {
      label: schoolYearLabel,
      status: schoolYearStatus,
      studentId: student.id
    }
  });
}

async function snapshotCounts(schoolYearId: string) {
  const [activities, artifacts, weeklyReviews, quarterReviews, annualPlans, legalBuckets] = await Promise.all([
    prisma.activity.count({ where: { schoolYearId } }),
    prisma.evidenceArtifact.count({
      where: {
        OR: [
          { activity: { schoolYearId } },
          { tagsJson: { contains: "schoolYear" } }
        ]
      }
    }),
    prisma.weeklyReview.count({ where: { schoolYearId } }),
    prisma.quarterReview.count({ where: { schoolYearId } }),
    prisma.annualPlan.count({ where: { schoolYearId } }),
    prisma.legalArchiveBucket.count({ where: { schoolYearId } })
  ]);

  return { activities, artifacts, weeklyReviews, quarterReviews, annualPlans, legalBuckets };
}

function monthStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

async function createFullSchoolYearSnapshot(schoolYearId: string, label: string, note: string) {
  const fullBackup = await buildFullSchoolYearBackup(schoolYearId);
  if (!fullBackup) return null;

  return createExportSnapshot({
    schoolYearId,
    type: "full_school_year_backup",
    label,
    payload: {
      note,
      ...fullBackup
    }
  });
}

async function ensureMonthlyFullBackup(schoolYearId: string) {
  const existing = await prisma.exportSnapshot.findFirst({
    where: {
      schoolYearId,
      type: "full_school_year_backup",
      createdAt: { gte: monthStart() }
    }
  });

  if (existing) return existing;

  const now = new Date();
  const label = `Monthly Full Backup ${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return createFullSchoolYearSnapshot(schoolYearId, label, "Automatic monthly full school-year backup.");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentName = searchParams.get("studentName") || "Bennett C. Claypool";
  const schoolYearLabel = searchParams.get("schoolYearLabel");
  const schoolYearStatus = searchParams.get("schoolYearStatus") || "trial";

  if (!schoolYearLabel) {
    return NextResponse.json({ error: "schoolYearLabel is required." }, { status: 400 });
  }

  const schoolYear = await schoolYearFor(studentName, schoolYearLabel, schoolYearStatus);
  await ensureMonthlyFullBackup(schoolYear.id).catch(() => null);
  const snapshots = await prisma.exportSnapshot.findMany({
    where: { schoolYearId: schoolYear.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({ snapshots, counts: await snapshotCounts(schoolYear.id) });
}

export async function POST(request: Request) {
  try {
    const parsed = snapshotSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const schoolYear = await schoolYearFor(input.studentName, input.schoolYearLabel, input.schoolYearStatus);
    const counts = await snapshotCounts(schoolYear.id);
    const snapshot =
      input.type === "full_school_year_backup"
        ? await createFullSchoolYearSnapshot(schoolYear.id, input.label, input.note)
        : await createExportSnapshot({
            schoolYearId: schoolYear.id,
            type: input.type,
            label: input.label,
            payload: {
              note: input.note,
              counts,
              createdBy: "manual_records_snapshot"
            }
          });

    return NextResponse.json({ snapshot, counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Snapshot creation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
