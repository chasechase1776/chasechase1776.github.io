import { prisma } from "./prisma";
import { saveGeneratedFile } from "./storage";

type SnapshotInput = {
  schoolYearId: string;
  type: string;
  label: string;
  payload: Record<string, unknown>;
};

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "snapshot";
}

export async function createExportSnapshot(input: SnapshotInput) {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: input.schoolYearId },
    include: { student: true }
  });

  if (!schoolYear) return null;

  const createdAt = new Date();
  const backup = {
    snapshot: {
      type: input.type,
      label: input.label,
      createdAt: createdAt.toISOString(),
      student: schoolYear.student.name,
      schoolYear: schoolYear.label,
      schoolYearStatus: schoolYear.status
    },
    data: input.payload
  };
  const bytes = Buffer.from(JSON.stringify(backup, null, 2));
  const fileName = `${slug(input.type)}-${slug(input.label)}-${createdAt.toISOString().replace(/[:.]/g, "-")}.json`;
  const savedFile = await saveGeneratedFile(bytes, fileName, "application/json");
  const artifact = await prisma.evidenceArtifact.create({
    data: {
      ...savedFile,
      recordStatus: schoolYear.status,
      classification: "snapshot_backup",
      tagsJson: JSON.stringify({
        schoolYear: schoolYear.label,
        student: schoolYear.student.name,
        snapshotType: input.type,
        snapshotLabel: input.label
      })
    }
  });

  return prisma.exportSnapshot.create({
    data: {
      type: input.type,
      label: input.label,
      filePath: `/api/artifacts/${artifact.id}/download`,
      schoolYearId: schoolYear.id
    }
  });
}

export async function createArtifactSnapshot(input: {
  schoolYearId: string;
  type: string;
  label: string;
  artifactId: string;
}) {
  const artifact = await prisma.evidenceArtifact.findUnique({ where: { id: input.artifactId } });
  if (!artifact) return null;

  return prisma.exportSnapshot.create({
    data: {
      type: input.type,
      label: input.label,
      filePath: `/api/artifacts/${artifact.id}/download`,
      schoolYearId: input.schoolYearId
    }
  });
}
