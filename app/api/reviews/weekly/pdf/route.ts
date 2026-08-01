import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { saveGeneratedFile } from "@/lib/storage";

export const runtime = "nodejs";

const pdfSchema = z.object({
  reviewId: z.string().min(1)
});

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function stringifySummary(value: unknown) {
  if (!value) return "None";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length ? entries.map(([key, item]) => `${key}: ${item} min`).join("; ") : "None";
  }
  return String(value);
}

function wrapLine(value: string, width = 92) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function buildPdf(lines: string[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const lineHeight = 14;
  let page = pdf.addPage([612, 792]);
  let y = 744;
  let pageNumber = 1;

  const drawFooter = () => {
    page.drawText(`Weekly Review - Page ${pageNumber}`, {
      x: margin,
      y: 34,
      size: 8,
      font: regular,
      color: rgb(0.35, 0.41, 0.45)
    });
  };

  for (const line of lines) {
    if (y < 64) {
      drawFooter();
      page = pdf.addPage([612, 792]);
      pageNumber += 1;
      y = 744;
    }

    const isHeading = ["Weekly Review", "Generated Metrics", "Coverage Summary", "Parent Notes", "Student Reflection", "Skills and Portfolio"].includes(line);
    page.drawText(line || " ", {
      x: margin,
      y,
      size: isHeading ? 12 : 10,
      font: isHeading ? bold : regular,
      color: isHeading ? rgb(0.09, 0.13, 0.17) : rgb(0.12, 0.16, 0.2)
    });
    y -= isHeading ? lineHeight + 4 : lineHeight;
  }

  drawFooter();
  return Buffer.from(await pdf.save());
}

async function pdfBufferForWeeklyReview(review: {
  id: string;
  weekStartDate: Date;
  weekEndDate: Date;
  status: string;
  recordStatus: string;
  dataJson: string;
  schoolYear: { label: string; student: { name: string } };
}) {
  const data = JSON.parse(review.dataJson) as Record<string, unknown>;
  const sourceLines = [
    "Weekly Review",
    `${review.schoolYear.student.name} - ${review.schoolYear.label}`,
    `${dateKey(review.weekStartDate)} to ${dateKey(review.weekEndDate)} - ${review.status}`,
    "",
    "Generated Metrics",
    `Total approved time: ${data.totalApprovedLearningTime ?? 0} minutes`,
    `Activities logged: ${data.activitiesLogged ?? 0}`,
    `Days logged: ${data.daysLogged ?? 0}`,
    `Artifacts saved: ${data.artifactsSaved ?? 0}`,
    `Needs review: ${data.activitiesNeedingReview ?? 0}`,
    "",
    "Coverage Summary",
    `Subject time: ${stringifySummary(data.subjectTimeSummary)}`,
    `Legal coverage: ${stringifySummary(data.legalCoverageSummary)}`,
    `Overall rating: ${data.overallWeeklyRating ?? "Not Observed"}`,
    "",
    "Parent Notes",
    `Weekly summary: ${data.parentWeeklySummary ?? ""}`,
    `Next week focus: ${data.nextWeekFocus ?? ""}`,
    "",
    "Student Reflection",
    `Favorite activity: ${data.studentFavorite ?? ""}`,
    `Hardest activity: ${data.studentHardest ?? ""}`,
    `Proudest work: ${data.studentProudest ?? ""}`,
    `Question or curiosity: ${data.studentQuestion ?? ""}`,
    `Self-rating: ${data.studentRating ?? ""}`,
    `Dictated reflection: ${data.studentDictation ?? ""}`,
    "",
    "Skills and Portfolio",
    `Skills touched: ${stringifySummary(data.skillsTouchedThisWeek)}`,
    `Portfolio selections: ${stringifySummary(data.portfolioSelections)}`
  ];

  return buildPdf(sourceLines.flatMap((line) => wrapLine(line)));
}

export async function POST(request: Request) {
  try {
    const parsed = pdfSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const review = await prisma.weeklyReview.findUnique({
      where: { id: parsed.data.reviewId },
      include: { schoolYear: { include: { student: true } } }
    });

    if (!review) {
      return NextResponse.json({ error: "Weekly review was not found." }, { status: 404 });
    }

    const pdfBytes = await pdfBufferForWeeklyReview(review);
    const fileName = `weekly-review-${weekKey(review.weekStartDate)}.pdf`;
    const savedFile = await saveGeneratedFile(pdfBytes, fileName, "application/pdf");
    const artifact = await prisma.evidenceArtifact.create({
      data: {
        ...savedFile,
        recordStatus: review.recordStatus,
        classification: "weekly_report",
        tagsJson: JSON.stringify({
          weeklyReviewId: review.id,
          schoolYear: review.schoolYear.label,
          weekStartDate: dateKey(review.weekStartDate),
          weekEndDate: dateKey(review.weekEndDate),
          reportType: "weekly_review"
        })
      }
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weekly review PDF generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
