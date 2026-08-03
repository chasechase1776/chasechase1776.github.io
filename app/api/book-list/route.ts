import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createExportSnapshot } from "@/lib/snapshots";

const bookEntrySchema = z.object({
  title: z.string().min(1),
  author: z.string().default(""),
  completedDate: z.string().default(""),
  rating: z.number().int().min(1).max(5)
});

const bookListSaveSchema = z.object({
  studentName: z.string().min(1).default("Bennett C. Claypool"),
  schoolYearLabel: z.string().min(1),
  schoolYearStatus: z.string().default("trial"),
  entries: z.array(bookEntrySchema)
});

function formatBookEntry(entry: { id: string; title: string; author: string; rating: number; completedAt: Date | null }) {
  return {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    rating: entry.rating,
    completedDate: entry.completedAt ? entry.completedAt.toISOString().slice(0, 10) : ""
  };
}

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
  const studentName = searchParams.get("studentName") || "Bennett C. Claypool";
  const schoolYearLabel = searchParams.get("schoolYearLabel");

  if (!schoolYearLabel) {
    return NextResponse.json({ error: "schoolYearLabel is required." }, { status: 400 });
  }

  const entries = await prisma.bookListEntry.findMany({
    where: {
      schoolYear: {
        label: schoolYearLabel,
        student: { name: { in: [studentName, "Bennett"] } }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json({ entries: entries.map(formatBookEntry) });
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
            completedAt: entry.completedDate ? new Date(`${entry.completedDate}T00:00:00.000Z`) : null,
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
    await createExportSnapshot({
      schoolYearId: schoolYear.id,
      type: "book_list_save",
      label: `Book List saved (${entries.length} entries)`,
      payload: {
        entries: entries.map(formatBookEntry)
      }
    }).catch(() => null);

    return NextResponse.json({ entries: entries.map(formatBookEntry) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Book list save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
