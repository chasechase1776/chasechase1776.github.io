import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultRecordStatus, inferSubject, suggestLegalTags } from "@/lib/domain";
import { regenerateMarkdownForActivity } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";

const activitySchema = z.object({
  title: z.string().min(1),
  date: z.string().min(10),
  actualMinutes: z.number().int().positive(),
  activityType: z.string().min(1),
  narration: z.string().min(1),
  studentName: z.string().min(1).default("Bennett"),
  schoolYearLabel: z.string().min(1).default("2026-2027 Trial / Enrichment"),
  schoolYearStatus: z.string().default("trial"),
  officialHomeschoolStartDate: z.string().optional().nullable(),
  unitTitle: z.string().optional().nullable(),
  recordStatus: z.string().optional(),
  parentApproved: z.boolean().default(true),
  subjectAllocations: z.array(z.object({ subject: z.string().min(1), minutes: z.number().int().nonnegative() })).default([]),
  legalTags: z.array(z.string().min(1)).default([]),
  skills: z.array(z.object({ subject: z.string().min(1), name: z.string().min(1) })).default([]),
  artifactIds: z.array(z.string()).default([])
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const activityType = searchParams.get("activityType");
  const recordStatus = searchParams.get("recordStatus");

  const activities = await prisma.activity.findMany({
    where: {
      ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}),
      ...(activityType ? { activityType } : {}),
      ...(recordStatus ? { recordStatus } : {})
    },
    include: {
      student: true,
      schoolYear: true,
      unitStudy: true,
      allocations: true,
      legalTags: { include: { legalTag: true } },
      skills: { include: { skill: true } },
      artifacts: true
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });

  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  const parsed = activitySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const allocatedMinutes = input.subjectAllocations.reduce((sum, item) => sum + item.minutes, 0);
  if (input.subjectAllocations.length > 0 && allocatedMinutes !== input.actualMinutes) {
    return NextResponse.json(
      { error: `Subject allocation minutes must equal actual minutes. Expected ${input.actualMinutes}, received ${allocatedMinutes}.` },
      { status: 400 }
    );
  }

  const student = await prisma.student.upsert({
    where: { name: input.studentName },
    update: {},
    create: { name: input.studentName }
  });

  const schoolYear = await prisma.schoolYear.upsert({
    where: { studentId_label: { studentId: student.id, label: input.schoolYearLabel } },
    update: {
      status: input.schoolYearStatus,
      officialHomeschoolStartDate: input.officialHomeschoolStartDate ? new Date(`${input.officialHomeschoolStartDate}T00:00:00.000Z`) : undefined
    },
    create: {
      label: input.schoolYearLabel,
      status: input.schoolYearStatus,
      officialHomeschoolStartDate: input.officialHomeschoolStartDate ? new Date(`${input.officialHomeschoolStartDate}T00:00:00.000Z`) : undefined,
      studentId: student.id
    }
  });

  const unitStudy =
    input.unitTitle && input.unitTitle !== "No unit"
      ? await prisma.unitStudy.upsert({
          where: { schoolYearId_title: { schoolYearId: schoolYear.id, title: input.unitTitle } },
          update: {},
          create: { title: input.unitTitle, schoolYearId: schoolYear.id }
        })
      : null;

  const dateOnly = input.date.slice(0, 10);
  const subjects = input.subjectAllocations.length
    ? input.subjectAllocations
    : [{ subject: inferSubject(input.activityType), minutes: input.actualMinutes }];
  const legalTagLabels = input.legalTags.length ? input.legalTags : suggestLegalTags(input.activityType, subjects.map((item) => item.subject));
  const recordStatus =
    input.recordStatus ?? defaultRecordStatus(dateOnly, input.officialHomeschoolStartDate, input.schoolYearStatus);

  const activity = await prisma.activity.create({
    data: {
      title: input.title,
      date: new Date(`${dateOnly}T00:00:00.000Z`),
      actualMinutes: input.actualMinutes,
      activityType: input.activityType,
      narration: input.narration,
      recordStatus,
      parentApproved: input.parentApproved,
      reviewStatus: input.parentApproved ? "approved" : "needs_review",
      studentId: student.id,
      schoolYearId: schoolYear.id,
      unitStudyId: unitStudy?.id,
      allocations: {
        create: subjects.map((item) => ({ subject: item.subject, minutes: item.minutes }))
      },
      skills: {
        create: input.skills.map((item) => ({
          skill: {
            connectOrCreate: {
              where: { subject_name: { subject: item.subject, name: item.name } },
              create: { subject: item.subject, name: item.name }
            }
          }
        }))
      },
      legalTags: {
        create: legalTagLabels.map((label) => ({
          legalTag: {
            connectOrCreate: {
              where: { label },
              create: { label }
            }
          }
        }))
      }
    },
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

  if (input.artifactIds.length > 0) {
    await prisma.evidenceArtifact.updateMany({
      where: { id: { in: input.artifactIds } },
      data: { activityId: activity.id, recordStatus }
    });
  }

  const markdownFiles = input.parentApproved ? await regenerateMarkdownForActivity(activity.id) : [];

  return NextResponse.json({ activity, markdownFiles }, { status: 201 });
}
