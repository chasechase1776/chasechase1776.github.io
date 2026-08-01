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

function dateDisplay(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function pdfText(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "quarter";
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

function selectedIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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

async function buildQuarterPdf(lines: string[], header: { studentYear: string; label: string; dates: string }) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const lineHeight = 14;
  let page = pdf.addPage([612, 792]);
  let y = 744;
  let pageNumber = 1;

  const drawFooter = () => {
    page.drawText(`Quarter Review - Page ${pageNumber}`, {
      x: margin,
      y: 34,
      size: 8,
      font: regular,
      color: rgb(0.35, 0.41, 0.45)
    });
  };

  const drawCentered = (value: string, size: number, font = regular) => {
    const safeValue = pdfText(value);
    const width = font.widthOfTextAtSize(safeValue, size);
    page.drawText(safeValue, {
      x: (612 - width) / 2,
      y,
      size,
      font,
      color: rgb(0.09, 0.13, 0.17)
    });
    y -= 18;
  };

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight >= 64) return;
    drawFooter();
    page = pdf.addPage([612, 792]);
    pageNumber += 1;
    y = 744;
  };

  const drawLine = (line: string, heading = false) => {
    ensureSpace(heading ? 24 : lineHeight);
    page.drawText(pdfText(line || " "), {
      x: margin,
      y,
      size: heading ? 12 : 10,
      font: heading ? bold : regular,
      color: heading ? rgb(0.09, 0.13, 0.17) : rgb(0.12, 0.16, 0.2)
    });
    y -= heading ? lineHeight + 4 : lineHeight;
  };

  drawCentered(header.studentYear, 12);
  drawCentered("Quarter Review", 12, bold);
  drawCentered(header.label, 12, bold);
  drawCentered(header.dates, 12, bold);
  y -= 18;

  for (const line of lines) {
    drawLine(line, ["Generated Metrics", "Coverage Summary", "Skill Trends", "Student Reflection", "Parent Reflection", "Portfolio", "Units"].includes(line));
  }

  drawFooter();
  return Buffer.from(await pdf.save());
}

async function pdfBufferForQuarterReview(review: {
  label: string;
  quarterStartDate: Date;
  quarterEndDate: Date;
  dataJson: string;
  schoolYear: { label: string; student: { name: string } };
}) {
  const data = JSON.parse(review.dataJson) as Record<string, unknown>;
  const portfolioSelectionIds = selectedIds(data.portfolioSelections);
  const selectedArtifacts = portfolioSelectionIds.length
    ? await prisma.evidenceArtifact.findMany({
        where: { id: { in: portfolioSelectionIds } },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const activeUnits = Array.isArray(data.activeUnits) ? data.activeUnits : [];
  const lines = [
    "Generated Metrics",
    `Total approved time: ${data.totalApprovedLearningTime ?? 0} minutes`,
    `Days with records: ${data.daysWithRecords ?? 0}`,
    `Activities logged: ${data.activitiesLogged ?? 0}`,
    `Weekly reviews: ${data.weeklyReviewsLogged ?? 0}`,
    `Needs review: ${data.activitiesNeedingReview ?? 0}`,
    "",
    "Coverage Summary",
    `Subject time: ${stringifySummary(data.subjectTimeSummary)}`,
    `Legal coverage: ${stringifySummary(data.legalCoverageSummary)}`,
    `Overall rating: ${data.overallQuarterRating ?? "Not Observed"}`,
    "",
    "Skill Trends",
    `Skills across quarter: ${stringifySummary(data.skillsAcrossQuarter)}`,
    "",
    "Student Reflection",
    `What I learned: ${data.studentLearned ?? ""}`,
    `Proudest work: ${data.studentProud ?? ""}`,
    `What was hard: ${data.studentHard ?? ""}`,
    `What I want to learn next: ${data.studentNext ?? ""}`,
    `Student self-rating: ${data.studentRating ?? ""}`,
    "",
    "Parent Reflection",
    `What improved most: ${data.improvedMost ?? ""}`,
    `What needs review: ${data.needsReview ?? ""}`,
    `Next quarter priorities: ${data.nextQuarterPriorities ?? ""}`,
    "",
    "Portfolio",
    `Selected highlights: ${selectedArtifacts.length ? selectedArtifacts.map((artifact) => artifact.originalName).join(", ") : "None"}`,
    "",
    "Units",
    ...(activeUnits.length
      ? activeUnits.map((item) => {
          const unit = item as { title?: string; minutes?: number; activities?: number; status?: string };
          return `${unit.title ?? "Unit"}: ${unit.activities ?? 0} activities, ${unit.minutes ?? 0} minutes, ${unit.status ?? "active"}`;
        })
      : ["No active units summarized."])
  ];

  return buildQuarterPdf(lines.flatMap((line) => wrapLine(line)), {
    studentYear: `${review.schoolYear.student.name} - ${review.schoolYear.label}`,
    label: review.label,
    dates: `${dateDisplay(review.quarterStartDate)} to ${dateDisplay(review.quarterEndDate)}`
  });
}

export async function POST(request: Request) {
  try {
    const parsed = pdfSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const review = await prisma.quarterReview.findUnique({
      where: { id: parsed.data.reviewId },
      include: { schoolYear: { include: { student: true } } }
    });

    if (!review) {
      return NextResponse.json({ error: "Quarter review was not found." }, { status: 404 });
    }

    const pdfBytes = await pdfBufferForQuarterReview(review);
    const fileName = `quarter-review-${slug(review.label)}.pdf`;
    const savedFile = await saveGeneratedFile(pdfBytes, fileName, "application/pdf");
    const artifact = await prisma.evidenceArtifact.create({
      data: {
        ...savedFile,
        recordStatus: review.recordStatus,
        classification: "quarter_report",
        tagsJson: JSON.stringify({
          quarterReviewId: review.id,
          schoolYear: review.schoolYear.label,
          quarterLabel: review.label,
          quarterStartDate: dateKey(review.quarterStartDate),
          quarterEndDate: dateKey(review.quarterEndDate),
          reportType: "quarter_review"
        })
      }
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quarter review PDF generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
