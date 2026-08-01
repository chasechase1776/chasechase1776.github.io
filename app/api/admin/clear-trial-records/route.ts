import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";

export const runtime = "nodejs";

const CONFIRMATION = "clear trial records";

async function counts() {
  const approved = await prisma.activity.aggregate({ _sum: { actualMinutes: true } });
  const days = await prisma.activity.findMany({
    distinct: ["date"],
    select: { date: true }
  });

  return {
    totalMinutes: approved._sum.actualMinutes ?? 0,
    daysWithRecords: days.length,
    activities: await prisma.activity.count(),
    artifacts: await prisma.evidenceArtifact.count(),
    weeklyReviews: await prisma.weeklyReview.count(),
    quarterReviews: await prisma.quarterReview.count(),
    exportSnapshots: await prisma.exportSnapshot.count(),
    annualPlans: await prisma.annualPlan.count(),
    bookListEntries: await prisma.bookListEntry.count(),
    unitStudies: await prisma.unitStudy.count()
  };
}

export async function POST(request: Request) {
  const passcode = process.env.APP_PASSCODE;
  const providedPasscode = request.headers.get("x-app-passcode");
  const confirmation = request.headers.get("x-confirm-reset");

  if (!passcode || providedPasscode !== passcode || confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: "Cleanup confirmation failed." }, { status: 403 });
  }

  const before = await counts();
  const artifacts = await prisma.evidenceArtifact.findMany({
    select: { id: true, originalName: true, storagePath: true }
  });

  await prisma.$transaction([
    prisma.evidenceArtifact.deleteMany(),
    prisma.exportSnapshot.deleteMany(),
    prisma.weeklyReview.deleteMany(),
    prisma.quarterReview.deleteMany(),
    prisma.activity.deleteMany()
  ]);

  const storageResults = await Promise.allSettled(artifacts.map((artifact) => deleteStoredFile(artifact.storagePath)));
  const failedStorageDeletes = storageResults
    .map((result, index) => ({ result, artifact: artifacts[index] }))
    .filter((item) => item.result.status === "rejected")
    .map((item) => ({
      id: item.artifact.id,
      originalName: item.artifact.originalName,
      error: item.result.status === "rejected" && item.result.reason instanceof Error ? item.result.reason.message : "Unknown delete error"
    }));

  const after = await counts();
  return NextResponse.json({
    before,
    after,
    deletedStorageFiles: artifacts.length - failedStorageDeletes.length,
    failedStorageDeletes
  });
}
