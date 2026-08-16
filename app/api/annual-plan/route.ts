import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createExportSnapshot } from "@/lib/snapshots";

const annualPlanSchema = z.object({
  studentName: z.string().min(1).default("Bennett C. Claypool"),
  schoolYearLabel: z.string().min(1),
  schoolYearStatus: z.string().default("trial"),
  officialHomeschoolStartDate: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "finalized", "archived"]),
  recordStatus: z.string().default("trial"),
  data: z.record(z.unknown())
});

const protectedUnitWeekCounts: Record<string, number> = {
  construction: 4,
  "all-about-me": 4,
  "off-the-land": 5
};

function plannerKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unit";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function filledString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function plannerDetailScore(planner: unknown) {
  if (!isRecord(planner)) return { weeks: 0, score: 0 };
  const weeks = Array.isArray(planner.weeks) ? planner.weeks : [];
  let score = 0;

  ["unitQuestion", "unitWritingTopics", "unitPresentationTopics", "unitProject"].forEach((key) => {
    if (filledString(planner[key])) score += 1;
  });

  weeks.forEach((week) => {
    if (!isRecord(week)) return;
    ["weeklyQuestion", "writingTopics", "presentationTopic", "project", "resources", "shoppingList"].forEach((key) => {
      if (filledString(week[key])) score += 1;
    });
    const days = Array.isArray(week.days) ? week.days : [];
    days.forEach((day) => {
      if (!isRecord(day) || !Array.isArray(day.activities)) return;
      day.activities.forEach((activity) => {
        if (!isRecord(activity)) return;
        if (filledString(activity.title)) score += 1;
        if (filledString(activity.description)) score += 3;
        if (filledString(activity.prepNotes)) score += 2;
        if (filledString(activity.shoppingList)) score += 2;
        if (filledString(activity.startTime)) score += 1;
        if (filledString(activity.finishTime)) score += 1;
        if (typeof activity.expectedMinutes === "number" && activity.expectedMinutes > 0) score += 1;
      });
    });
  });

  return { weeks: weeks.length, score };
}

function preserveProtectedPlannerDetails(incomingData: Record<string, unknown>, existingData: Record<string, unknown> | null) {
  if (!existingData) return incomingData;
  const incomingPlanners = isRecord(incomingData.unitStudyPlanners) ? incomingData.unitStudyPlanners : null;
  const existingPlanners = isRecord(existingData.unitStudyPlanners) ? existingData.unitStudyPlanners : null;
  if (!incomingPlanners || !existingPlanners) return incomingData;

  const nextPlanners = { ...incomingPlanners };
  let changed = false;

  Object.entries(protectedUnitWeekCounts).forEach(([key, requiredWeeks]) => {
    const incomingPlanner = incomingPlanners[key];
    const existingPlanner = existingPlanners[key];
    const incomingScore = plannerDetailScore(incomingPlanner);
    const existingScore = plannerDetailScore(existingPlanner);

    if (existingScore.weeks >= requiredWeeks && existingScore.score > incomingScore.score) {
      nextPlanners[key] = existingPlanner;
      changed = true;
    }
  });

  const incomingRows = Array.isArray(incomingData.unitPlanRows) ? incomingData.unitPlanRows : null;
  const nextRows = incomingRows
    ? incomingRows.map((row) => {
        if (!isRecord(row)) return row;
        const id = typeof row.id === "string" ? row.id : "";
        const titleKey = typeof row.title === "string" ? plannerKey(row.title) : "";
        const requiredWeeks = protectedUnitWeekCounts[id] ?? protectedUnitWeekCounts[titleKey];
        return requiredWeeks ? { ...row, weeks: String(requiredWeeks) } : row;
      })
    : incomingRows;

  return changed || nextRows !== incomingRows ? { ...incomingData, unitStudyPlanners: nextPlanners, unitPlanRows: nextRows } : incomingData;
}

function dateFromIso(value?: string | null) {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : undefined;
}

async function upsertSchoolYear(input: z.infer<typeof annualPlanSchema>) {
  const student = await prisma.student.upsert({
    where: { name: input.studentName },
    update: {},
    create: { name: input.studentName }
  });

  return prisma.schoolYear.upsert({
    where: { studentId_label: { studentId: student.id, label: input.schoolYearLabel } },
    update: {
      status: input.schoolYearStatus,
      officialHomeschoolStartDate: dateFromIso(input.officialHomeschoolStartDate)
    },
    create: {
      label: input.schoolYearLabel,
      status: input.schoolYearStatus,
      officialHomeschoolStartDate: dateFromIso(input.officialHomeschoolStartDate),
      studentId: student.id
    }
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentName = searchParams.get("studentName") || "Bennett C. Claypool";
  const schoolYearLabel = searchParams.get("schoolYearLabel");

  if (!schoolYearLabel) {
    return NextResponse.json({ error: "schoolYearLabel is required." }, { status: 400 });
  }

  const plan = await prisma.annualPlan.findFirst({
    where: {
      schoolYear: {
        label: schoolYearLabel,
        student: { name: { in: [studentName, "Bennett"] } }
      }
    }
  });

  if (!plan) return NextResponse.json({ plan: null, data: null });

  return NextResponse.json({
    plan,
    data: JSON.parse(plan.dataJson)
  });
}

export async function POST(request: Request) {
  try {
    const parsed = annualPlanSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const schoolYear = await upsertSchoolYear(input);
    const existingPlan = await prisma.annualPlan.findUnique({ where: { schoolYearId: schoolYear.id } });
    const existingData = existingPlan ? JSON.parse(existingPlan.dataJson) as Record<string, unknown> : null;
    const safeData = preserveProtectedPlannerDetails(input.data, existingData);
    const plan = await prisma.annualPlan.upsert({
      where: { schoolYearId: schoolYear.id },
      update: {
        status: input.status,
        recordStatus: input.recordStatus,
        dataJson: JSON.stringify(safeData)
      },
      create: {
        status: input.status,
        recordStatus: input.recordStatus,
        dataJson: JSON.stringify(safeData),
        schoolYearId: schoolYear.id
      }
    });
    await createExportSnapshot({
      schoolYearId: schoolYear.id,
      type: "annual_plan_save",
      label: `Annual Plan ${input.status}`,
      payload: {
        planId: plan.id,
        status: input.status,
        recordStatus: input.recordStatus,
        data: safeData
      }
    }).catch(() => null);

    return NextResponse.json({ plan, data: safeData });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Annual Plan save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
