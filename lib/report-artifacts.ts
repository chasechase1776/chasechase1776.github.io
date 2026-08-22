import { createAuditLogSafely } from "./audit";
import { prisma } from "./prisma";
import { createArtifactSnapshot } from "./snapshots";
import { saveGeneratedFile } from "./storage";

type ReportAuditInput = {
  action: string;
  label: string;
  details?: Record<string, unknown>;
};

type SaveReportArtifactInput = {
  bytes: Buffer;
  fileName: string;
  recordStatus: string;
  classification: string;
  tags: Record<string, unknown>;
  snapshot?: {
    schoolYearId: string;
    type: string;
    label: string;
  };
  audit?: ReportAuditInput;
};

export async function saveReportArtifact(input: SaveReportArtifactInput) {
  const savedFile = await saveGeneratedFile(input.bytes, input.fileName, "application/pdf");
  const artifact = await prisma.evidenceArtifact.create({
    data: {
      ...savedFile,
      recordStatus: input.recordStatus,
      classification: input.classification,
      tagsJson: JSON.stringify(input.tags)
    }
  });

  if (input.snapshot) {
    await createArtifactSnapshot({
      ...input.snapshot,
      artifactId: artifact.id
    }).catch(() => null);
  }

  if (input.snapshot && input.audit) {
    await createAuditLogSafely({
      schoolYearId: input.snapshot.schoolYearId,
      action: input.audit.action,
      label: input.audit.label,
      details: {
        ...(input.audit.details ?? {}),
        artifactId: artifact.id
      }
    });
  }

  return artifact;
}
