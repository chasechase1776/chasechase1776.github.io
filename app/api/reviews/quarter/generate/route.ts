import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const quarterSchema = z.object({
  schoolYearLabel: z.string().min(1),
  quarterLabel: z.string().min(1),
  quarterStartDate: z.string().min(10),
  reviewDueDate: z.string().min(10),
  recordStatus: z.string().default("trial")
});

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function dateFromIso(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function stringifyWeeklySkills(dataJson: string) {
  try {
    const data = JSON.parse(dataJson) as { skillsTouchedThisWeek?: unknown };
    if (!Array.isArray(data.skillsTouchedThisWeek)) return [];
    return data.skillsTouchedThisWeek.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const parsed = quarterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const quarterStart = dateFromIso(parsed.data.quarterStartDate);
    const quarterEnd = addDays(quarterStart, 62);
    const reviewDueDate = dateFromIso(parsed.data.reviewDueDate);

    const schoolYear = await prisma.schoolYear.findFirst({
      where: { label: parsed.data.schoolYearLabel }
    });

    if (!schoolYear) {
      return NextResponse.json({ error: "School year not found. Save an activity first." }, { status: 404 });
    }

    const [activities, weeklyReviews] = await Promise.all([
      prisma.activity.findMany({
        where: {
          schoolYearId: schoolYear.id,
          date: { gte: quarterStart, lte: quarterEnd }
        },
        include: {
          allocations: true,
          legalTags: { include: { legalTag: true } },
          skills: { include: { skill: true } },
          artifacts: true,
          unitStudy: true
        },
        orderBy: { date: "asc" }
      }),
      prisma.weeklyReview.findMany({
        where: {
          schoolYearId: schoolYear.id,
          weekStartDate: { gte: quarterStart, lte: quarterEnd }
        },
        orderBy: { weekStartDate: "asc" }
      })
    ]);

    const approvedActivities = activities.filter((activity) => activity.parentApproved);
    const subjectMinutes = new Map<string, number>();
    const legalTags = new Set<string>();
    const skillNames = new Set<string>();
    const units = new Map<string, { title: string; minutes: number; activities: number; status: string }>();

    approvedActivities.forEach((activity) => {
      activity.allocations.forEach((allocation) => {
        subjectMinutes.set(allocation.subject, (subjectMinutes.get(allocation.subject) ?? 0) + allocation.minutes);
      });
      activity.legalTags.forEach((item) => legalTags.add(item.legalTag.label));
      activity.skills.forEach((item) => skillNames.add(`${item.skill.subject}: ${item.skill.name}`));
      if (activity.unitStudy) {
        const current = units.get(activity.unitStudy.title) ?? {
          title: activity.unitStudy.title,
          minutes: 0,
          activities: 0,
          status: activity.unitStudy.status
        };
        current.minutes += activity.actualMinutes;
        current.activities += 1;
        units.set(activity.unitStudy.title, current);
      }
    });

    weeklyReviews.forEach((review) => {
      stringifyWeeklySkills(review.dataJson).forEach((skill) => skillNames.add(skill));
    });

    const artifacts = approvedActivities.flatMap((activity) =>
      activity.artifacts.map((artifact) => ({
        id: artifact.id,
        originalName: artifact.originalName,
        mimeType: artifact.mimeType,
        activityTitle: activity.title,
        activityDate: activity.date.toISOString().slice(0, 10)
      }))
    );

    const data = {
      totalApprovedLearningTime: approvedActivities.reduce((sum, item) => sum + item.actualMinutes, 0),
      daysWithRecords: new Set(activities.map((item) => item.date.toISOString().slice(0, 10))).size,
      activitiesLogged: activities.length,
      weeklyReviewsLogged: weeklyReviews.length,
      activitiesNeedingReview: activities.filter((item) => !item.parentApproved || item.reviewStatus === "needs_review").length,
      subjectTimeSummary: Object.fromEntries(subjectMinutes),
      legalCoverageSummary: Array.from(legalTags),
      skillsAcrossQuarter: Array.from(skillNames),
      portfolioSelections: artifacts.slice(0, 15).map((artifact) => artifact.id),
      portfolioCandidates: artifacts.slice(0, 20),
      activeUnits: Array.from(units.values()),
      studentLearned: "",
      studentProud: "",
      studentHard: "",
      studentNext: "",
      studentRating: "I can do this with help",
      overallQuarterRating: "Not Observed",
      improvedMost: "",
      needsReview: "",
      nextQuarterPriorities: ""
    };

    const review = await prisma.quarterReview.upsert({
      where: { schoolYearId_label: { schoolYearId: schoolYear.id, label: parsed.data.quarterLabel } },
      update: {
        quarterStartDate: quarterStart,
        quarterEndDate: quarterEnd,
        reviewDueDate,
        status: "draft",
        dataJson: JSON.stringify(data),
        recordStatus: parsed.data.recordStatus
      },
      create: {
        schoolYearId: schoolYear.id,
        label: parsed.data.quarterLabel,
        quarterStartDate: quarterStart,
        quarterEndDate: quarterEnd,
        reviewDueDate,
        status: "draft",
        dataJson: JSON.stringify(data),
        recordStatus: parsed.data.recordStatus
      }
    });

    return NextResponse.json({ review, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quarter review generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
