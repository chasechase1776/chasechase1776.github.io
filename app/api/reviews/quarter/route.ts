import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const quarterSaveSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["draft", "finalized", "amended"]),
  quarterStartDate: z.string().min(10),
  reviewDueDate: z.string().min(10),
  data: z.record(z.unknown()),
  recordStatus: z.string().default("trial")
});

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function dateFromIso(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export async function POST(request: Request) {
  try {
    const parsed = quarterSaveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const quarterStart = dateFromIso(parsed.data.quarterStartDate);
    const review = await prisma.quarterReview.update({
      where: { id: parsed.data.reviewId },
      data: {
        quarterStartDate: quarterStart,
        quarterEndDate: addDays(quarterStart, 62),
        reviewDueDate: dateFromIso(parsed.data.reviewDueDate),
        status: parsed.data.status,
        dataJson: JSON.stringify(parsed.data.data),
        recordStatus: parsed.data.recordStatus
      }
    });

    return NextResponse.json({ review, data: parsed.data.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quarter review save failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
