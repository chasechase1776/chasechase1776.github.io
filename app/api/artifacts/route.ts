import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const artifacts = await prisma.evidenceArtifact.findMany({
    include: {
      activity: {
        include: {
          schoolYear: true,
          unitStudy: true,
          allocations: true,
          legalTags: { include: { legalTag: true } }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ artifacts });
}
