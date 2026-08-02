import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const categorySchema = z.enum(["achievements", "accolades", "projects"]);

const entrySchema = z.object({
  narrative: z.string().min(1),
  date: z.string().default("")
});

const saveSchema = z.object({
  studentName: z.string().min(1).default("Bennett C. Claypool"),
  schoolYearLabel: z.string().min(1),
  schoolYearStatus: z.string().default("trial"),
  category: categorySchema,
  entries: z.array(entrySchema)
});

function formatEntry(entry: { id: string; narrative: string; occurredAt: Date | null }) {
  return {
    id: entry.id,
    narrative: entry.narrative,
    date: entry.occurredAt ? entry.occurredAt.toISOString().slice(0, 10) : ""
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
  const category = searchParams.get("category");

  if (!schoolYearLabel) {
    return NextResponse.json({ error: "schoolYearLabel is required." }, { status: 400 });
  }

  const parsedCategory = categorySchema.safeParse(category);
  if (!parsedCategory.success) {
    return NextResponse.json({ error: "A valid category is required." }, { status: 400 });
  }

  const entries = await prisma.portfolioListEntry.findMany({
    where: {
      category: parsedCategory.data,
      schoolYear: {
        label: schoolYearLabel,
        student: { name: { in: [studentName, "Bennett"] } }
      }
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return NextResponse.json({ entries: entries.map(formatEntry) });
}

export async function POST(request: Request) {
  try {
    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const schoolYear = await schoolYearFor(input.studentName, input.schoolYearLabel, input.schoolYearStatus);
    const operations = [
      prisma.portfolioListEntry.deleteMany({
        where: { schoolYearId: schoolYear.id, category: input.category }
      })
    ];

    if (input.entries.length) {
      operations.push(
        prisma.portfolioListEntry.createMany({
          data: input.entries.map((entry, index) => ({
            category: input.category,
            narrative: entry.narrative,
            occurredAt: entry.date ? new Date(`${entry.date}T00:00:00.000Z`) : null,
            sortOrder: index,
            schoolYearId: schoolYear.id
          }))
        })
      );
    }

    await prisma.$transaction(operations);

    const entries = await prisma.portfolioListEntry.findMany({
      where: { schoolYearId: schoolYear.id, category: input.category },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    return NextResponse.json({ entries: entries.map(formatEntry) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portfolio list save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
