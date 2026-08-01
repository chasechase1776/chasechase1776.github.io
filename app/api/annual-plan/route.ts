import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const annualPlanSchema = z.object({
  studentName: z.string().min(1).default("Bennett"),
  schoolYearLabel: z.string().min(1),
  schoolYearStatus: z.string().default("trial"),
  officialHomeschoolStartDate: z.string().optional().nullable(),
  status: z.enum(["draft", "active", "finalized", "archived"]),
  recordStatus: z.string().default("trial"),
  data: z.record(z.unknown())
});

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
  const studentName = searchParams.get("studentName") || "Bennett";
  const schoolYearLabel = searchParams.get("schoolYearLabel");

  if (!schoolYearLabel) {
    return NextResponse.json({ error: "schoolYearLabel is required." }, { status: 400 });
  }

  const plan = await prisma.annualPlan.findFirst({
    where: {
      schoolYear: {
        label: schoolYearLabel,
        student: { name: studentName }
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
    const plan = await prisma.annualPlan.upsert({
      where: { schoolYearId: schoolYear.id },
      update: {
        status: input.status,
        recordStatus: input.recordStatus,
        dataJson: JSON.stringify(input.data)
      },
      create: {
        status: input.status,
        recordStatus: input.recordStatus,
        dataJson: JSON.stringify(input.data),
        schoolYearId: schoolYear.id
      }
    });

    return NextResponse.json({ plan, data: input.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Annual Plan save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
