import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultRecordStatus, inferSubject, suggestLegalTags } from "@/lib/domain";
import { regenerateMarkdownForActivity } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { createExportSnapshot } from "@/lib/snapshots";

const activitySchema = z.object({
  title: z.string().min(1),
  date: z.string().min(10),
  actualMinutes: z.number().int().positive(),
  activityType: z.string().min(1),
  narration: z.string().min(1),
  studentName: z.string().min(1).default("Bennett C. Claypool"),
  schoolYearLabel: z.string().min(1).default("2026-2027 Trial / Enrichment"),
  schoolYearStatus: z.string().default("trial"),
  officialHomeschoolStartDate: z.string().optional().nullable(),
  unitTitle: z.string().optional().nullable(),
  recordStatus: z.string().optional(),
  parentApproved: z.boolean().default(true),
  subjectAllocations: z.array(z.object({ subject: z.string().min(1), minutes: z.number().int().nonnegative() })).default([]),
  legalTags: z.array(z.string().min(1)).default([]),
  skills: z.array(z.object({ subject: z.string().min(1), name: z.string().min(1) })).default([]),
  resources: z.array(z.object({
    title: z.string().default(""),
    authorOrEditor: z.string().default(""),
    url: z.string().default("")
  })).default([]),
  artifactIds: z.array(z.string()).default([]),
  replaceApprovedActivityIds: z.array(z.string()).default([])
});

function validateSubjectAllocations(input: z.infer<typeof activitySchema>) {
  const normalizedAllocations = input.subjectAllocations.map((item) => ({
    subject: item.subject.trim(),
    minutes: item.minutes
  }));

  if (!normalizedAllocations.length) return normalizedAllocations;

  const blankSubject = normalizedAllocations.find((item) => !item.subject);
  if (blankSubject) {
    return "Every subject allocation row needs a subject.";
  }

  const zeroMinuteSubject = normalizedAllocations.find((item) => item.minutes <= 0);
  if (zeroMinuteSubject) {
    return "Every subject allocation row needs more than 0 minutes.";
  }

  const duplicateSubjects = normalizedAllocations
    .map((item) => item.subject.toLowerCase())
    .filter((subject, index, subjects) => subjects.indexOf(subject) !== index);
  if (duplicateSubjects.length) {
    return "Each subject can appear only once in a time split. Combine duplicate subject rows before saving.";
  }

  const allocatedMinutes = normalizedAllocations.reduce((sum, item) => sum + item.minutes, 0);
  if (allocatedMinutes !== input.actualMinutes) {
    return `Subject allocation minutes must equal actual minutes. Expected ${input.actualMinutes}, received ${allocatedMinutes}.`;
  }

  return normalizedAllocations;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const activityType = searchParams.get("activityType");
  const recordStatus = searchParams.get("recordStatus");
  const studentName = searchParams.get("studentName");
  const schoolYearLabel = searchParams.get("schoolYearLabel");

  const activities = await prisma.activity.findMany({
    where: {
      ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}),
      ...(activityType ? { activityType } : {}),
      ...(recordStatus ? { recordStatus } : {}),
      ...(studentName ? { student: { name: studentName } } : {}),
      ...(schoolYearLabel ? { schoolYear: { label: schoolYearLabel } } : {})
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
  try {
    const parsed = activitySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const allocationValidation = validateSubjectAllocations(input);
    if (typeof allocationValidation === "string") {
      return NextResponse.json({ error: allocationValidation }, { status: 400 });
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
    const subjects = allocationValidation.length
      ? allocationValidation
      : [{ subject: inferSubject(input.activityType), minutes: input.actualMinutes }];
    const legalTagLabels = input.legalTags.length ? input.legalTags : suggestLegalTags(input.activityType, subjects.map((item) => item.subject));
    const recordStatus =
      input.recordStatus ?? defaultRecordStatus(dateOnly, input.officialHomeschoolStartDate, input.schoolYearStatus);

    if (input.parentApproved && input.replaceApprovedActivityIds.length > 0) {
      await prisma.activity.deleteMany({
        where: {
          id: { in: input.replaceApprovedActivityIds },
          studentId: student.id,
          schoolYearId: schoolYear.id,
          date: new Date(`${dateOnly}T00:00:00.000Z`),
          activityType: input.activityType,
          parentApproved: true
        }
      });
    }

    const activity = await prisma.activity.create({
      data: {
        title: input.title,
        date: new Date(`${dateOnly}T00:00:00.000Z`),
        actualMinutes: input.actualMinutes,
        activityType: input.activityType,
        narration: input.narration,
        notes: input.resources.length ? JSON.stringify({ resources: input.resources }) : undefined,
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

    const markdownFiles = input.parentApproved ? await regenerateMarkdownForActivity(activity.id).catch(() => []) : [];
    if (input.parentApproved) {
      await createExportSnapshot({
        schoolYearId: schoolYear.id,
        type: "activity_save",
        label: `Approved activity: ${activity.title}`,
        payload: {
          activity,
          markdownFiles,
          savedAt: new Date().toISOString()
        }
      }).catch(() => null);
    }

    return NextResponse.json({ activity, markdownFiles }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activity save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
