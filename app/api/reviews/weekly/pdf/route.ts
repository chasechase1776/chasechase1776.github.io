import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
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

function addWrappedText(doc: PDFKit.PDFDocument, text: string, options: PDFKit.Mixins.TextOptions = {}) {
  doc.text(text || "None", { width: 480, lineGap: 3, ...options });
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
  const doc = new PDFDocument({ margin: 48, size: "LETTER", bufferPages: true });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.font("Helvetica-Bold").fontSize(18).text("Weekly Review", { lineGap: 4 });
  doc.font("Helvetica").fontSize(10).fillColor("#5a6872").text(`${review.schoolYear.student.name} - ${review.schoolYear.label}`);
  doc.text(`${dateKey(review.weekStartDate)} to ${dateKey(review.weekEndDate)} - ${review.status}`);
  doc.moveDown();

  doc.fillColor("#17212b").font("Helvetica-Bold").fontSize(12).text("Generated Metrics");
  doc.font("Helvetica").fontSize(10);
  addWrappedText(doc, `Total approved time: ${data.totalApprovedLearningTime ?? 0} minutes`);
  addWrappedText(doc, `Activities logged: ${data.activitiesLogged ?? 0}`);
  addWrappedText(doc, `Days logged: ${data.daysLogged ?? 0}`);
  addWrappedText(doc, `Artifacts saved: ${data.artifactsSaved ?? 0}`);
  addWrappedText(doc, `Needs review: ${data.activitiesNeedingReview ?? 0}`);
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(12).text("Coverage Summary");
  doc.font("Helvetica").fontSize(10);
  addWrappedText(doc, `Subject time: ${stringifySummary(data.subjectTimeSummary)}`);
  addWrappedText(doc, `Legal coverage: ${stringifySummary(data.legalCoverageSummary)}`);
  addWrappedText(doc, `Overall rating: ${data.overallWeeklyRating ?? "Not Observed"}`);
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(12).text("Parent Notes");
  doc.font("Helvetica").fontSize(10);
  addWrappedText(doc, `Weekly summary: ${data.parentWeeklySummary ?? ""}`);
  doc.moveDown(0.5);
  addWrappedText(doc, `Next week focus: ${data.nextWeekFocus ?? ""}`);
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(12).text("Student Reflection");
  doc.font("Helvetica").fontSize(10);
  addWrappedText(doc, `Favorite activity: ${data.studentFavorite ?? ""}`);
  addWrappedText(doc, `Hardest activity: ${data.studentHardest ?? ""}`);
  addWrappedText(doc, `Proudest work: ${data.studentProudest ?? ""}`);
  addWrappedText(doc, `Question or curiosity: ${data.studentQuestion ?? ""}`);
  addWrappedText(doc, `Self-rating: ${data.studentRating ?? ""}`);
  addWrappedText(doc, `Dictated reflection: ${data.studentDictation ?? ""}`);
  doc.moveDown();

  doc.font("Helvetica-Bold").fontSize(12).text("Skills and Portfolio");
  doc.font("Helvetica").fontSize(10);
  addWrappedText(doc, `Skills touched: ${stringifySummary(data.skillsTouchedThisWeek)}`);
  addWrappedText(doc, `Portfolio selections: ${stringifySummary(data.portfolioSelections)}`);

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor("#5a6872").text(`Weekly Review - ${weekKey(review.weekStartDate)} - Page ${i + 1}`, 48, 748, {
      align: "center",
      width: 516
    });
  }

  doc.end();
  return finished;
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
