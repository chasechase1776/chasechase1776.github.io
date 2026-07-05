import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type ActivityWithRelations = Prisma.ActivityGetPayload<{
  include: {
    student: true;
    schoolYear: true;
    unitStudy: true;
    allocations: true;
    legalTags: { include: { legalTag: true } };
    skills: { include: { skill: true } };
    artifacts: true;
  };
}>;

function rootForSchoolYear(label: string) {
  return path.resolve(process.cwd(), "records", label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function activityMarkdown(activity: ActivityWithRelations) {
  const legalTags = activity.legalTags.map((item) => item.legalTag.label).join(", ") || "None";
  const skills = activity.skills.map((item) => `${item.skill.subject}: ${item.skill.name}`).join("; ") || "None";
  const allocations = activity.allocations.map((item) => `- ${item.subject}: ${item.minutes} minutes`).join("\n") || "- None";

  return `# ${activity.title}

- Student: ${activity.student.name}
- Date: ${dateKey(activity.date)}
- Activity type: ${activity.activityType}
- Actual minutes: ${activity.actualMinutes}
- Record status: ${activity.recordStatus}
- Parent approved: ${activity.parentApproved ? "yes" : "no"}
- Unit: ${activity.unitStudy?.title ?? "None"}
- Legal tags: ${legalTags}
- Skills: ${skills}

## Narration

${activity.narration}

## Subject Time

${allocations}
`;
}

export async function regenerateMarkdownForActivity(activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      student: true,
      schoolYear: true,
      unitStudy: true,
      allocations: true,
      legalTags: { include: { legalTag: true } },
      skills: { include: { skill: true } },
      artifacts: true
    }
  });

  if (!activity) return [];

  const root = rootForSchoolYear(activity.schoolYear.label);
  const dayDir = path.join(root, "days");
  const weekDir = path.join(root, "weeks");
  const unitDir = path.join(root, "units", (activity.unitStudy?.title ?? "no-unit").toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  await Promise.all([mkdir(dayDir, { recursive: true }), mkdir(weekDir, { recursive: true }), mkdir(unitDir, { recursive: true })]);

  const dayPath = path.join(dayDir, `${dateKey(activity.date)}.md`);
  await writeFile(dayPath, activityMarkdown(activity));

  const weekActivities = await prisma.activity.findMany({
    where: { schoolYearId: activity.schoolYearId, parentApproved: true },
    include: { allocations: true },
    orderBy: { date: "asc" }
  });
  const weeklyTotal = weekActivities.reduce((sum, item) => sum + item.actualMinutes, 0);
  const weekPath = path.join(weekDir, `${weekKey(activity.date)}.md`);
  await writeFile(weekPath, `# ${weekKey(activity.date)}

- Total approved learning time: ${weeklyTotal} minutes
- Activities logged: ${weekActivities.length}

Generated from database records.
`);

  const unitPath = path.join(unitDir, "activities.md");
  await writeFile(unitPath, `# ${activity.unitStudy?.title ?? "No Unit"} Activities

${activityMarkdown(activity)}
`);

  await prisma.exportSnapshot.createMany({
    data: [
      { type: "markdown", label: "daily learning record", filePath: dayPath, schoolYearId: activity.schoolYearId },
      { type: "markdown", label: "weekly summary", filePath: weekPath, schoolYearId: activity.schoolYearId },
      { type: "markdown", label: "unit activities", filePath: unitPath, schoolYearId: activity.schoolYearId }
    ]
  });

  return [dayPath, weekPath, unitPath];
}
