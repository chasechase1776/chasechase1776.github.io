import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const statusSchema = z.object({
  studentName: z.string().min(1).default("Bennett C. Claypool"),
  schoolYearLabel: z.string().min(1),
  schoolYearStatus: z.string().default("trial"),
  date: z.string().min(10),
  activityType: z.string().min(1),
  status: z.enum(["neutral", "needs-review", "completed"])
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

async function ensureDailyActivityStatusTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyActivityStatus" (
      "id" TEXT NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "activityType" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "schoolYearId" TEXT NOT NULL,
      CONSTRAINT "DailyActivityStatus_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DailyActivityStatus_schoolYearId_date_activityType_key"
    ON "DailyActivityStatus"("schoolYearId", "date", "activityType")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "DailyActivityStatus_date_status_idx"
    ON "DailyActivityStatus"("date", "status")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'DailyActivityStatus_schoolYearId_fkey'
      ) THEN
        ALTER TABLE "DailyActivityStatus"
        ADD CONSTRAINT "DailyActivityStatus_schoolYearId_fkey"
        FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$
  `);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const studentName = searchParams.get("studentName") || "Bennett C. Claypool";
  const schoolYearLabel = searchParams.get("schoolYearLabel");
  const date = searchParams.get("date");

  if (!schoolYearLabel || !date) {
    return NextResponse.json({ error: "schoolYearLabel and date are required." }, { status: 400 });
  }

  await ensureDailyActivityStatusTable();
  const statuses = await prisma.$queryRaw<{ activityType: string; status: string; date: Date }[]>`
    SELECT das."activityType", das."status", das."date"
    FROM "DailyActivityStatus" das
    INNER JOIN "SchoolYear" sy ON sy."id" = das."schoolYearId"
    INNER JOIN "Student" student ON student."id" = sy."studentId"
    WHERE das."date" = ${new Date(`${date.slice(0, 10)}T00:00:00.000Z`)}
      AND sy."label" = ${schoolYearLabel}
      AND student."name" IN (${studentName}, 'Bennett')
    ORDER BY das."updatedAt" DESC
  `;

  return NextResponse.json({
    statuses: statuses.map((status) => ({
      activityType: status.activityType,
      status: status.status,
      date: status.date.toISOString().slice(0, 10)
    }))
  });
}

export async function POST(request: Request) {
  try {
    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const schoolYear = await schoolYearFor(input.studentName, input.schoolYearLabel, input.schoolYearStatus);
    const date = new Date(`${input.date.slice(0, 10)}T00:00:00.000Z`);
    await ensureDailyActivityStatusTable();

    if (input.status === "neutral") {
      await prisma.$executeRaw`
        DELETE FROM "DailyActivityStatus"
        WHERE "schoolYearId" = ${schoolYear.id}
          AND "date" = ${date}
          AND "activityType" = ${input.activityType}
      `;
      return NextResponse.json({ status: "neutral" });
    }

    await prisma.$executeRaw`
      INSERT INTO "DailyActivityStatus" ("id", "date", "activityType", "status", "updatedAt", "createdAt", "schoolYearId")
      VALUES (${crypto.randomUUID()}, ${date}, ${input.activityType}, ${input.status}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${schoolYear.id})
      ON CONFLICT ("schoolYearId", "date", "activityType")
      DO UPDATE SET "status" = EXCLUDED."status", "updatedAt" = CURRENT_TIMESTAMP
    `;

    return NextResponse.json({
      status: {
        activityType: input.activityType,
        status: input.status,
        date: input.date.slice(0, 10)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily activity status update failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
