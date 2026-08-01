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

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
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

function buildPdf(lines: string[]) {
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 42) {
    pages.push(lines.slice(index, index + 42));
  }

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];

  pages.forEach((pageLines, pageIndex) => {
    const stream = [
      "BT",
      "/F1 10 Tf",
      "48 748 Td",
      "14 TL",
      ...pageLines.flatMap((line, lineIndex) => {
        const safe = escapePdfText(line);
        return lineIndex === 0 ? [`(${safe}) Tj`] : ["T*", `(${safe}) Tj`];
      }),
      "ET",
      "BT",
      "/F1 8 Tf",
      `48 36 Td (Weekly Review - Page ${pageIndex + 1}) Tj`,
      "ET"
    ].join("\n");
    const streamId = addObject(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
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
