import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createExportSnapshot } from "@/lib/snapshots";

const bucketKeys = [
  "homeschool-charter",
  "annual-plans",
  "quarter-annual-reports",
  "compliance-summaries",
  "reference-notes",
  "prior-year-archives"
] as const;

const legalArchiveSchema = z.object({
  studentName: z.string().min(1).default("Bennett C. Claypool"),
  schoolYearLabel: z.string().min(1),
  schoolYearStatus: z.string().default("trial"),
  action: z.enum(["review", "connect"]),
  bucketKey: z.enum(bucketKeys),
  artifactId: z.string().optional()
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

async function ensureBucket(schoolYearId: string, bucketKey: string) {
  return prisma.legalArchiveBucket.upsert({
    where: { schoolYearId_bucketKey: { schoolYearId, bucketKey } },
    update: {},
    create: { schoolYearId, bucketKey }
  });
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
  await Promise.all(bucketKeys.map((bucketKey) => ensureBucket(schoolYear.id, bucketKey)));

  const buckets = await prisma.legalArchiveBucket.findMany({
    where: { schoolYearId: schoolYear.id },
    include: {
      links: {
        include: { artifact: true },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: { bucketKey: "asc" }
  });

  return NextResponse.json({ buckets });
}

export async function POST(request: Request) {
  try {
    const parsed = legalArchiveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const schoolYear = await schoolYearFor(input.studentName, input.schoolYearLabel, input.schoolYearStatus);
    const bucket = await ensureBucket(schoolYear.id, input.bucketKey);

    if (input.action === "review") {
      await prisma.legalArchiveBucket.update({
        where: { id: bucket.id },
        data: { reviewedAt: new Date() }
      });
    }

    if (input.action === "connect") {
      if (!input.artifactId) {
        return NextResponse.json({ error: "artifactId is required to connect a file." }, { status: 400 });
      }
      await prisma.legalArchiveLink.upsert({
        where: { bucketId_artifactId: { bucketId: bucket.id, artifactId: input.artifactId } },
        update: {},
        create: { bucketId: bucket.id, artifactId: input.artifactId }
      });
    }
    await createExportSnapshot({
      schoolYearId: schoolYear.id,
      type: "legal_archive_update",
      label: `Legal Archive ${input.action}: ${input.bucketKey}`,
      payload: {
        action: input.action,
        bucketKey: input.bucketKey,
        artifactId: input.artifactId ?? null,
        updatedAt: new Date().toISOString()
      }
    }).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Legal archive update failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
