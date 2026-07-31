import { NextResponse } from "next/server";
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

    const artifact = await prisma.evidenceArtifact.create({
      data: {
        ...savedFile,
        recordStatus,
        tagsJson,
        activityId: typeof activityId === "string" && activityId ? activityId : undefined
      }
    });

    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Proof upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
