import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createExportSnapshot } from "@/lib/snapshots";

const weeklySaveSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["draft", "finalized", "amended"]),
  data: z.record(z.unknown()),
  recordStatus: z.string().default("trial")
});

export async function POST(request: Request) {
  try {
    const parsed = weeklySaveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const review = await prisma.weeklyReview.update({
      where: { id: parsed.data.reviewId },
      data: {
        status: parsed.data.status,
        dataJson: JSON.stringify(parsed.data.data),
        recordStatus: parsed.data.recordStatus
      }
    });
    await createExportSnapshot({
      schoolYearId: review.schoolYearId,
      type: "weekly_review_save",
      label: `Weekly Review ${review.weekStartDate.toISOString().slice(0, 10)} ${parsed.data.status}`,
      payload: {
        reviewId: review.id,
        weekStartDate: review.weekStartDate.toISOString().slice(0, 10),
        weekEndDate: review.weekEndDate.toISOString().slice(0, 10),
        status: parsed.data.status,
        data: parsed.data.data
      }
    }).catch(() => null);

    return NextResponse.json({ review, data: parsed.data.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weekly review save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
