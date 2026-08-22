import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { saveReportArtifact } from "@/lib/report-artifacts";
import { readStoredFile } from "@/lib/storage";

export const runtime = "nodejs";

const pdfSchema = z.object({
  reviewId: z.string().min(1)
});

type SelectedEvidenceFile = {
  title: string;
  mimeType: string;
  bytes: Uint8Array;
};

type PdfHeader = {
  studentYear: string;
  weekDates: string;
  unitStudy: string;
  subjectTimeSummary: unknown;
};

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateDisplay(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${date.getUTCFullYear()}`;
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

function subjectSummaryEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([subject, minutes]) => [subject, Number(minutes)] as const)
    .filter(([, minutes]) => Number.isFinite(minutes) && minutes > 0)
    .sort(([, left], [, right]) => right - left);
}

function selectedIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function pdfText(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function attachmentName(name: string) {
  return pdfText(name).replace(/["\r\n]/g, "-") || "portfolio-evidence";
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

async function selectedEvidenceFiles(selectedArtifacts: { originalName: string; mimeType: string; storagePath: string }[]) {
  const files: SelectedEvidenceFile[] = [];
  for (const artifact of selectedArtifacts.slice(0, 10)) {
    try {
      const bytes = await readStoredFile(artifact.storagePath);
      if (bytes.length) {
        files.push({
          title: artifact.originalName,
          mimeType: artifact.mimeType,
          bytes
        });
      }
    } catch {
      // Keep the report generation working even if one selected evidence file cannot be retrieved.
    }
  }
  return files;
}

async function buildPdf(lines: string[], evidenceFiles: SelectedEvidenceFile[], header: PdfHeader) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const lineHeight = 14;
  const chartColors = [
    rgb(0.12, 0.48, 0.55),
    rgb(0.25, 0.49, 0.13),
    rgb(0.54, 0.35, 0),
    rgb(0.37, 0.35, 0.64),
    rgb(0.7, 0.36, 0.27),
    rgb(0.18, 0.37, 0.56),
    rgb(0.43, 0.35, 0.48),
    rgb(0.31, 0.47, 0.18)
  ];
  let page = pdf.addPage([612, 792]);
  let y = 744;
  let pageNumber = 1;

  const drawCentered = (value: string, yPosition: number, size: number, font = regular) => {
    const safeValue = pdfText(value || " ");
    const width = font.widthOfTextAtSize(safeValue, size);
    page.drawText(safeValue, {
      x: (612 - width) / 2,
      y: yPosition,
      size,
      font,
      color: rgb(0.09, 0.13, 0.17)
    });
  };

  const drawFooter = () => {
    page.drawText(`Weekly Review - Page ${pageNumber}`, {
      x: margin,
      y: 34,
      size: 8,
      font: regular,
      color: rgb(0.35, 0.41, 0.45)
    });
  };

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight >= 64) return;
    drawFooter();
    page = pdf.addPage([612, 792]);
    pageNumber += 1;
    y = 744;
  };

  const drawLine = (line: string, options?: { heading?: boolean; indent?: number; color?: ReturnType<typeof rgb> }) => {
    ensureSpace(options?.heading ? 24 : lineHeight);
    page.drawText(pdfText(line || " "), {
      x: margin + (options?.indent ?? 0),
      y,
      size: options?.heading ? 12 : 10,
      font: options?.heading ? bold : regular,
      color: options?.color ?? (options?.heading ? rgb(0.09, 0.13, 0.17) : rgb(0.12, 0.16, 0.2))
    });
    y -= options?.heading ? lineHeight + 4 : lineHeight;
  };

  const drawSubjectCharts = (summary: unknown) => {
    const entries = subjectSummaryEntries(summary);
    const total = entries.reduce((sum, [, minutes]) => sum + minutes, 0);
    ensureSpace(entries.length ? 230 : 50);
    drawLine("Subject Time Charts", { heading: true });

    if (!entries.length || total <= 0) {
      drawLine("Generate the review from approved logs to populate the subject time bar and pie charts.", { indent: 12 });
      return;
    }

    const chartTop = y;
    const barX = margin;
    const trackX = barX + 120;
    const trackWidth = 130;
    const rowHeight = 20;

    entries.slice(0, 8).forEach(([subject, minutes], index) => {
      const rowY = chartTop - index * rowHeight;
      const percent = minutes / total;
      const color = chartColors[index % chartColors.length];
      page.drawText(pdfText(subject), { x: barX, y: rowY, size: 8, font: bold, color: rgb(0.12, 0.16, 0.2) });
      page.drawText(`${minutes}m (${Math.round(percent * 100)}%)`, { x: barX, y: rowY - 10, size: 7, font: regular, color: rgb(0.35, 0.41, 0.45) });
      page.drawRectangle({ x: trackX, y: rowY - 1, width: trackWidth, height: 8, color: rgb(0.93, 0.96, 0.97), borderColor: rgb(0.78, 0.86, 0.89), borderWidth: 0.5 });
      page.drawRectangle({ x: trackX, y: rowY - 1, width: Math.max(4, trackWidth * percent), height: 8, color });
    });

    const centerX = margin + 390;
    const centerY = chartTop - 50;
    const radius = 48;
    let startAngle = -90;
    entries.slice(0, 8).forEach(([, minutes], index) => {
      const sweep = (minutes / total) * 360;
      const endAngle = startAngle + sweep;
      const points = [`M ${centerX} ${centerY}`];
      const steps = Math.max(3, Math.ceil(sweep / 18));
      for (let step = 0; step <= steps; step += 1) {
        const angle = (startAngle + (sweep * step) / steps) * (Math.PI / 180);
        points.push(`L ${centerX + Math.cos(angle) * radius} ${centerY + Math.sin(angle) * radius}`);
      }
      points.push("Z");
      page.drawSvgPath(points.join(" "), { color: chartColors[index % chartColors.length] });
      startAngle = endAngle;
    });
    page.drawCircle({ x: centerX, y: centerY, size: radius, borderColor: rgb(0.78, 0.86, 0.89), borderWidth: 0.5 });

    entries.slice(0, 8).forEach(([subject, minutes], index) => {
      const legendY = chartTop - 116 - index * 12;
      page.drawRectangle({ x: margin + 320, y: legendY, width: 7, height: 7, color: chartColors[index % chartColors.length] });
      page.drawText(pdfText(`${subject} ${Math.round((minutes / total) * 100)}%`), { x: margin + 332, y: legendY - 1, size: 7, font: regular, color: rgb(0.35, 0.41, 0.45) });
    });

    y = Math.min(chartTop - entries.slice(0, 8).length * rowHeight, chartTop - 126 - entries.slice(0, 8).length * 12);
    y -= 16;
    drawLine("Cross-subject graph: cross-subject links are not yet stored in saved records, so this report does not double-count them.", { indent: 12 });
    y -= 6;
  };

  drawCentered(header.studentYear, y, 12);
  y -= 18;
  drawCentered("Weekly Review", y, 12, bold);
  y -= 18;
  drawCentered(header.weekDates, y, 12, bold);
  y -= 18;
  drawCentered(header.unitStudy, y, 12);
  y -= 36;

  drawSubjectCharts(header.subjectTimeSummary);

  for (const line of lines) {
    const isHeading = ["Generated Metrics", "Coverage Summary", "Parent Notes", "Student Reflection", "Skills and Portfolio"].includes(line);
    drawLine(line, { heading: isHeading });
  }

  if (evidenceFiles.length) {
    ensureSpace(42);
    y -= 8;
    drawLine("Selected Portfolio Evidence", { heading: true });

    let embeddedPdfPages = 0;
    for (const evidenceFile of evidenceFiles) {
      const mimeType = evidenceFile.mimeType.toLowerCase();

      try {
        await pdf.attach(evidenceFile.bytes, attachmentName(evidenceFile.title), {
          mimeType: evidenceFile.mimeType,
          description: `Selected weekly portfolio evidence: ${evidenceFile.title}`
        });
      } catch {
        // Visible previews below are the main proof path; attachments are a convenience where supported.
      }

      if (["image/jpeg", "image/jpg", "image/png"].includes(mimeType)) {
        try {
          const image = mimeType.includes("png") ? await pdf.embedPng(evidenceFile.bytes) : await pdf.embedJpg(evidenceFile.bytes);
          const maxWidth = 500;
          const maxHeight = 320;
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
          const width = image.width * scale;
          const height = image.height * scale;
          ensureSpace(height + 42);

          drawLine(evidenceFile.title);
          page.drawImage(image, {
            x: margin,
            y: y - height,
            width,
            height
          });
          y -= height + 22;
        } catch {
          drawLine(`Could not embed image preview: ${evidenceFile.title}`, { color: rgb(0.55, 0.28, 0.24) });
        }
        continue;
      }

      if (mimeType === "application/pdf" && embeddedPdfPages < 6) {
        try {
          const sourcePdf = await PDFDocument.load(evidenceFile.bytes);
          const pageCount = Math.min(sourcePdf.getPageCount(), 3, 6 - embeddedPdfPages);
          const embeddedPages = await pdf.embedPdf(sourcePdf, Array.from({ length: pageCount }, (_value, index) => index));

          for (const [index, embeddedPage] of embeddedPages.entries()) {
            embeddedPdfPages += 1;
            const scale = Math.min(500 / embeddedPage.width, 620 / embeddedPage.height, 1);
            const width = embeddedPage.width * scale;
            const height = embeddedPage.height * scale;
            ensureSpace(height + 48);
            drawLine(`${evidenceFile.title} - page ${index + 1}`);
            page.drawPage(embeddedPage, {
              x: margin,
              y: y - height,
              width,
              height
            });
            y -= height + 22;
          }
        } catch {
          drawLine(`Attached PDF could not be previewed: ${evidenceFile.title}`, { color: rgb(0.55, 0.28, 0.24) });
        }
        continue;
      }

      if (mimeType.startsWith("text/") || mimeType === "application/json") {
        const excerpt = new TextDecoder("utf-8").decode(evidenceFile.bytes).slice(0, 2500);
        drawLine(evidenceFile.title);
        for (const line of wrapLine(excerpt.replace(/\s+/g, " "), 88).slice(0, 45)) {
          drawLine(line, { indent: 12 });
        }
        continue;
      }

      drawLine(`Attached file: ${evidenceFile.title} (${evidenceFile.mimeType || "file"})`);
      drawLine("Open the PDF attachments panel in your PDF viewer to access this file.", { indent: 12 });
    }
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
  const portfolioSelectionIds = selectedIds(data.portfolioSelections);
  const selectedArtifacts = portfolioSelectionIds.length
    ? await prisma.evidenceArtifact.findMany({
        where: { id: { in: portfolioSelectionIds } },
        orderBy: { createdAt: "desc" }
      })
    : [];
  const selectedArtifactNames = selectedArtifacts.map((artifact) => artifact.originalName);
  const evidenceFiles = await selectedEvidenceFiles(selectedArtifacts);
  const header = {
    studentYear: `${review.schoolYear.student.name} - ${review.schoolYear.label}`,
    weekDates: `${dateDisplay(review.weekStartDate)} to ${dateDisplay(review.weekEndDate)}`,
    unitStudy: typeof data.unitStudy === "string" && data.unitStudy.trim() ? data.unitStudy : "Unit study not specified",
    subjectTimeSummary: data.subjectTimeSummary
  };
  const sourceLines = [
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
    `Portfolio selections: ${selectedArtifactNames.length ? selectedArtifactNames.join(", ") : stringifySummary(data.portfolioSelections)}`
  ];

  return buildPdf(sourceLines.flatMap((line) => wrapLine(line)), evidenceFiles, header);
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
    const artifact = await saveReportArtifact({
      bytes: pdfBytes,
      fileName,
      recordStatus: review.recordStatus,
      classification: "weekly_report",
      tags: {
        weeklyReviewId: review.id,
        schoolYear: review.schoolYear.label,
        weekStartDate: dateKey(review.weekStartDate),
        weekEndDate: dateKey(review.weekEndDate),
        reportType: "weekly_review"
      },
      snapshot: {
        schoolYearId: review.schoolYearId,
        type: "weekly_review_pdf",
        label: `Weekly Review PDF ${weekKey(review.weekStartDate)}`
      }
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weekly review PDF generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
