import { NextResponse } from "next/server";
import { createAuditLogSafely } from "@/lib/audit";
import { readableError } from "@/lib/api-errors";
import { saveUploadedFile } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload requires a file field." }, { status: 400 });
    }

    const savedFile = await saveUploadedFile(file);
    const activityId = formData.get("activityId");
    const recordStatus = String(formData.get("recordStatus") ?? "trial");
    const tagsJson = String(formData.get("tagsJson") ?? "[]");
    const classification = formData.get("classification");

    const artifact = await prisma.evidenceArtifact.create({
      data: {
        ...savedFile,
        recordStatus,
        tagsJson,
        classification: typeof classification === "string" && classification ? classification : undefined,
        activityId: typeof activityId === "string" && activityId ? activityId : undefined
      }
    });
    const activity = artifact.activityId
      ? await prisma.activity.findUnique({ where: { id: artifact.activityId }, select: { schoolYearId: true, title: true } })
      : null;
    const parsedTags = (() => {
      try {
        return JSON.parse(tagsJson) as { schoolYear?: string; student?: string };
      } catch {
        return {};
      }
    })();
    const schoolYear = !activity && parsedTags.student && parsedTags.schoolYear
      ? await prisma.schoolYear.findFirst({
          where: { label: parsedTags.schoolYear, student: { name: parsedTags.student } },
          select: { id: true }
        })
      : null;
    const schoolYearId = activity?.schoolYearId ?? schoolYear?.id;
    if (schoolYearId) {
      await createAuditLogSafely({
        schoolYearId,
        action: "file_uploaded",
        label: `Uploaded file: ${artifact.originalName}`,
        details: {
          artifactId: artifact.id,
          mimeType: artifact.mimeType,
          sizeBytes: artifact.sizeBytes,
          classification: artifact.classification,
          linkedActivityTitle: activity?.title
        }
      });
    }

    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    const message = readableError(error, "Proof upload failed. Try a smaller file or upload again.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
