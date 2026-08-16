import { NextResponse } from "next/server";
import { readableError } from "@/lib/api-errors";
import { ensureAuditLogTable } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

async function schoolYearFor(studentName: string, schoolYearLabel: string) {
  return prisma.schoolYear.findFirst({
    where: {
      label: schoolYearLabel,
      student: { name: { in: [studentName, "Bennett"] } }
    }
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentName = searchParams.get("studentName") || "Bennett C. Claypool";
    const schoolYearLabel = searchParams.get("schoolYearLabel");

    if (!schoolYearLabel) {
      return NextResponse.json({ error: "schoolYearLabel is required." }, { status: 400 });
    }

    const schoolYear = await schoolYearFor(studentName, schoolYearLabel);
    if (!schoolYear) return NextResponse.json({ auditLogs: [] });

    await ensureAuditLogTable();
    const auditLogs = await prisma.auditLog.findMany({
      where: { schoolYearId: schoolYear.id },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return NextResponse.json({ auditLogs });
  } catch (error) {
    const message = readableError(error, "Could not load the audit log. Refresh Records & Snapshots and try again.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
