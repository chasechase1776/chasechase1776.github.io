import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bookEntrySchema = z.object({
  title: z.string().min(1),
  author: z.string().default(""),
  rating: z.number().int().min(1).max(5)
});

const bookListSaveSchema = z.object({
  studentName: z.string().min(1).default("Bennett"),
  schoolYearLabel: z.string().min(1),
  schoolYearStatus: z.string().default("trial"),
  entries: z.array(bookEntrySchema)
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentName = searchParams.get("studentName") || "Bennett";
  const schoolYearLabel = searchParams.get("schoolYearLabel");

  if (!schoolYearLabel) {
    return NextResponse.json({ error: "schoolYearLabel is required." }, { status: 400 });
  }

  const entries = await prisma.bookListEntry.findMany({
    where: {
      schoolYear: {
        label: schoolYearLabel,
        student: { name: studentName }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  try {
    const parsed = bookListSaveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const schoolYear = await schoolYearFor(input.studentName, input.schoolYearLabel, input.schoolYearStatus);
    const operations = [prisma.bookListEntry.deleteMany({ where: { schoolYearId: schoolYear.id } })];
    if (input.entries.length) {
      operations.push(
        prisma.bookListEntry.createMany({
          data: input.entries.map((entry, index) => ({
            title: entry.title,
            author: entry.author,
            rating: entry.rating,
            sortOrder: index,
            schoolYearId: schoolYear.id
          }))
        })
      );
    }
    await prisma.$transaction(operations);

    const entries = await prisma.bookListEntry.findMany({
      where: { schoolYearId: schoolYear.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return NextResponse.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Book list save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
