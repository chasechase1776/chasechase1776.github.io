import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const weeklySchema = z.object({
  schoolYearLabel: z.string().min(1),
  weekStartDate: z.string().min(10),
  recordStatus: z.string().default("trial")
});

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export async function POST(request: Request) {
  const parsed = weeklySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const weekStart = new Date(`${parsed.data.weekStartDate.slice(0, 10)}T00:00:00.000Z`);
  const weekEnd = addDays(weekStart, 6);

  const schoolYear = await prisma.schoolYear.findFirst({
    where: { label: parsed.data.schoolYearLabel }
  });

  if (!schoolYear) {
    return NextResponse.json({ error: "School year not found. Save an activity first." }, { status: 404 });
  }

  const activities = await prisma.activity.findMany({
    where: {
      schoolYearId: schoolYear.id,
      parentApproved: true,
      date: { gte: weekStart, lte: weekEnd }
    },
    include: {
      allocations: true,
      legalTags: { include: { legalTag: true } },
      skills: { include: { skill: true } },
      artifacts: true
    },
    orderBy: { date: "asc" }
  });

  const subjectMinutes = new Map<string, number>();
  const legalTags = new Set<string>();
  const skillNames = new Set<string>();
  let artifactCount = 0;

  activities.forEach((activity) => {
    artifactCount += activity.artifacts.length;
    activity.allocations.forEach((allocation) => {
      subjectMinutes.set(allocation.subject, (subjectMinutes.get(allocation.subject) ?? 0) + allocation.minutes);
    });
    activity.legalTags.forEach((item) => legalTags.add(item.legalTag.label));
    activity.skills.forEach((item) => skillNames.add(`${item.skill.subject}: ${item.skill.name}`));
  });

  const data = {
    totalApprovedLearningTime: activities.reduce((sum, item) => sum + item.actualMinutes, 0),
    activitiesLogged: activities.length,
    daysLogged: new Set(activities.map((item) => item.date.toISOString().slice(0, 10))).size,
    artifactsSaved: artifactCount,
    subjectTimeSummary: Object.fromEntries(subjectMinutes),
    legalCoverageSummary: Array.from(legalTags),
    skillsTouchedThisWeek: Array.from(skillNames),
    parentWeeklySummary: "",
    overallWeeklyRating: "Not Observed",
    portfolioSelections: [],
    nextWeekFocus: ""
  };

  const review = await prisma.weeklyReview.upsert({
    where: { schoolYearId_weekStartDate: { schoolYearId: schoolYear.id, weekStartDate: weekStart } },
    update: { weekEndDate: weekEnd, status: "draft", dataJson: JSON.stringify(data), recordStatus: parsed.data.recordStatus },
    create: {
      schoolYearId: schoolYear.id,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      status: "draft",
      dataJson: JSON.stringify(data),
      recordStatus: parsed.data.recordStatus
    }
  });

  return NextResponse.json({ review, data });
}
