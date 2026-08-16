import { prisma } from "./prisma";

type AuditInput = {
  schoolYearId: string;
  action: string;
  label: string;
  details?: Record<string, unknown>;
};

let auditTableReady = false;

export async function ensureAuditLogTable() {
  if (auditTableReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "detailsJson" TEXT NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "schoolYearId" TEXT NOT NULL,
      CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "AuditLog_schoolYearId_fkey" FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_schoolYearId_createdAt_idx" ON "AuditLog"("schoolYearId", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`);

  auditTableReady = true;
}

export async function createAuditLog(input: AuditInput) {
  await ensureAuditLogTable();
  return prisma.auditLog.create({
    data: {
      schoolYearId: input.schoolYearId,
      action: input.action,
      label: input.label,
      detailsJson: JSON.stringify(input.details ?? {})
    }
  });
}

export async function createAuditLogSafely(input: AuditInput) {
  try {
    await createAuditLog(input);
  } catch {
    // Audit logging should not block the parent workflow.
  }
}
