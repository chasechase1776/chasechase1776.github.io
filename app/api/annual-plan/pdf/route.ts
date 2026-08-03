import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createArtifactSnapshot } from "@/lib/snapshots";
import { readStoredFile, saveGeneratedFile } from "@/lib/storage";

export const runtime = "nodejs";

const cardSchema = z.object({
  id: z.string(),
  title: z.string(),
  narrative: z.string()
});

const annualRecordCardSchema = cardSchema.extend({
  attachments: z.array(
    z.object({
      id: z.string(),
      originalName: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number()
    })
  )
});

const unitRowSchema = z.object({
  title: z.string(),
  weeks: z.string(),
  guidingQuestion: z.string(),
  primaryCompetency: z.string(),
  formatType: z.string(),
  weeklyRhythmOverride: z.string(),
  publishedSequence: z.string(),
  parentDesigned: z.string(),
  fieldTrip: z.string(),
  finalFridayCapstone: z.string(),
  status: z.string()
});

const bigPictureSchema = z.object({
  primaryTheme: z.string().default(""),
  centralQuestion: z.string().default(""),
  thinkingProgression: z.string().default(""),
  writingProgression: z.string().default(""),
  presentationProgression: z.string().default(""),
  annualProjectCycle: z.string().default(""),
  yearLongJournals: z.string().default(""),
  spiralCurriculumSummary: z.string().default("")
});

const annualPlanPdfSchema = z.object({
  student: z.string().default("Bennett C. Claypool"),
  schoolYear: z.string().default("2026-2027"),
  status: z.string().default("active"),
  bigPicture: bigPictureSchema.default({}),
  curriculumSpines: z.array(cardSchema).default([]),
  weeklyRhythmDays: z.array(cardSchema).default([]),
  unitPlanRows: z.array(unitRowSchema).default([]),
  journalPortfolioCards: z.array(cardSchema).default([]),
  annualRecordCards: z.array(annualRecordCardSchema).default([])
});

type EvidenceFile = {
  title: string;
  mimeType: string;
  bytes: Uint8Array;
};

function pdfText(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function wrapLine(value: string, width = 88) {
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

function attachmentName(name: string) {
  return pdfText(name).replace(/["\r\n]/g, "-") || "annual-record";
}

async function readEvidenceFiles(ids: string[]) {
  if (!ids.length) return [];
  const artifacts = await prisma.evidenceArtifact.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "asc" }
  });

  const files: EvidenceFile[] = [];
  for (const artifact of artifacts) {
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
      // Keep export working even if one attachment cannot be retrieved.
    }
  }
  return files;
}

async function buildAnnualPlanPdf(input: z.infer<typeof annualPlanPdfSchema>, evidenceFiles: EvidenceFile[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const lineHeight = 14;
  let page = pdf.addPage([612, 792]);
  let y = 744;
  let pageNumber = 1;

  const drawCentered = (value: string, yPosition: number, size: number, font = regular) => {
    const safeValue = pdfText(value || " ");
    page.drawText(safeValue, {
      x: (612 - font.widthOfTextAtSize(safeValue, size)) / 2,
      y: yPosition,
      size,
      font,
      color: rgb(0.09, 0.13, 0.17)
    });
  };

  const drawFooter = () => {
    page.drawText(`Annual Plan - Page ${pageNumber}`, {
      x: margin,
      y: 34,
      size: 8,
      font: regular,
      color: rgb(0.35, 0.41, 0.45)
    });
  };

  const ensureSpace = (height: number) => {
    if (y - height >= 64) return;
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

  const drawWrapped = (line: string, indent = 0) => {
    wrapLine(line).forEach((wrapped) => drawLine(wrapped, { indent }));
  };

  const drawGap = (height = 8) => {
    ensureSpace(height);
    y -= height;
  };

  drawCentered(`${input.student} - ${input.schoolYear}`, y, 12);
  y -= 18;
  drawCentered("Annual Plan", y, 12, bold);
  y -= 18;
  drawCentered(`Status: ${input.status}`, y, 12);
  y -= 36;

  drawLine("Section 1: Big Picture Framework", { heading: true });
  drawWrapped(`Primary Theme: ${input.bigPicture.primaryTheme}`, 12);
  drawGap();
  drawWrapped(`Central Question: ${input.bigPicture.centralQuestion}`, 12);
  drawGap();
  drawWrapped(`Thinking Progression: ${input.bigPicture.thinkingProgression}`, 12);
  drawGap();
  drawWrapped(`Writing Progression: ${input.bigPicture.writingProgression}`, 12);
  drawGap();
  drawWrapped(`Presentation Progression: ${input.bigPicture.presentationProgression}`, 12);
  drawGap();
  drawWrapped(`Annual Project Cycle: ${input.bigPicture.annualProjectCycle}`, 12);
  drawGap();
  drawWrapped(`Year-Long Journals: ${input.bigPicture.yearLongJournals}`, 12);
  drawGap();
  drawWrapped(`Spiral Curriculum Summary: ${input.bigPicture.spiralCurriculumSummary}`, 12);
  drawGap(10);

  drawLine("Section 2: Curriculum Spines", { heading: true });
  input.curriculumSpines.forEach((card) => {
    drawWrapped(`${card.title}: ${card.narrative}`, 12);
    drawGap();
  });

  drawLine("Section 3: Weekly Rhythm", { heading: true });
  input.weeklyRhythmDays.forEach((card) => {
    drawWrapped(`${card.title}: ${card.narrative}`, 12);
    drawGap();
  });

  drawLine("Section 4: Unit Studies", { heading: true });
  input.unitPlanRows.forEach((row, index) => {
    drawWrapped(`${index + 1}. ${row.title} (${row.weeks} weeks, ${row.status}) - ${row.guidingQuestion}`, 12);
    drawWrapped(`Competency: ${row.primaryCompetency}; Format: ${row.formatType}; Rhythm: ${row.weeklyRhythmOverride}`, 24);
    drawWrapped(`Field trip/application: ${row.fieldTrip}; Final Friday: ${row.finalFridayCapstone}`, 24);
    drawGap();
  });

  drawLine("Section 6: Journals and Portfolios", { heading: true });
  input.journalPortfolioCards.forEach((card) => {
    drawWrapped(`${card.title}: ${card.narrative}`, 12);
    drawGap();
  });

  drawLine("Section 7: Annual Records", { heading: true });
  input.annualRecordCards.forEach((card) => {
    drawWrapped(`${card.title}: ${card.narrative}`, 12);
    drawWrapped(
      card.attachments.length
        ? `Attached documents: ${card.attachments.map((artifact) => artifact.originalName).join(", ")}`
        : "Attached documents: none",
      24
    );
    drawGap();
  });

  if (evidenceFiles.length) {
    y -= 8;
    drawLine("Embedded Annual Record Attachments", { heading: true });
    let embeddedPdfPages = 0;

    for (const evidenceFile of evidenceFiles) {
      const mimeType = evidenceFile.mimeType.toLowerCase();

      try {
        await pdf.attach(evidenceFile.bytes, attachmentName(evidenceFile.title), {
          mimeType: evidenceFile.mimeType,
          description: `Annual record attachment: ${evidenceFile.title}`
        });
      } catch {
        // Visible previews below remain the main output.
      }

      if (["image/jpeg", "image/jpg", "image/png"].includes(mimeType)) {
        try {
          const image = mimeType.includes("png") ? await pdf.embedPng(evidenceFile.bytes) : await pdf.embedJpg(evidenceFile.bytes);
          const scale = Math.min(500 / image.width, 320 / image.height, 1);
          const width = image.width * scale;
          const height = image.height * scale;
          ensureSpace(height + 42);
          drawLine(evidenceFile.title);
          page.drawImage(image, { x: margin, y: y - height, width, height });
          y -= height + 22;
        } catch {
          drawLine(`Could not embed image preview: ${evidenceFile.title}`, { color: rgb(0.55, 0.28, 0.24) });
        }
        continue;
      }

      if (mimeType === "application/pdf" && embeddedPdfPages < 8) {
        try {
          const sourcePdf = await PDFDocument.load(evidenceFile.bytes);
          const pageCount = Math.min(sourcePdf.getPageCount(), 4, 8 - embeddedPdfPages);
          const pages = await pdf.embedPdf(sourcePdf, Array.from({ length: pageCount }, (_value, index) => index));

          for (const [index, embeddedPage] of pages.entries()) {
            embeddedPdfPages += 1;
            const scale = Math.min(500 / embeddedPage.width, 620 / embeddedPage.height, 1);
            const width = embeddedPage.width * scale;
            const height = embeddedPage.height * scale;
            ensureSpace(height + 48);
            drawLine(`${evidenceFile.title} - page ${index + 1}`);
            page.drawPage(embeddedPage, { x: margin, y: y - height, width, height });
            y -= height + 22;
          }
        } catch {
          drawLine(`Attached PDF could not be previewed: ${evidenceFile.title}`, { color: rgb(0.55, 0.28, 0.24) });
        }
        continue;
      }

      if (mimeType.startsWith("text/") || mimeType === "application/json") {
        const excerpt = new TextDecoder("utf-8").decode(evidenceFile.bytes).slice(0, 3000);
        drawLine(evidenceFile.title);
        wrapLine(excerpt.replace(/\s+/g, " "), 88).slice(0, 55).forEach((line) => drawLine(line, { indent: 12 }));
        continue;
      }

      drawLine(`Attached file: ${evidenceFile.title} (${evidenceFile.mimeType || "file"})`);
      drawLine("This file is attached to the PDF. Open the PDF attachments panel to access it.", { indent: 12 });
    }
  }

  drawFooter();
  return Buffer.from(await pdf.save());
}

export async function POST(request: Request) {
  try {
    const parsed = annualPlanPdfSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const attachmentIds = parsed.data.annualRecordCards.flatMap((card) => card.attachments.map((artifact) => artifact.id));
    const evidenceFiles = await readEvidenceFiles(attachmentIds);
    const pdfBytes = await buildAnnualPlanPdf(parsed.data, evidenceFiles);
    const fileName = `annual-plan-${parsed.data.schoolYear}.pdf`;
    const savedFile = await saveGeneratedFile(pdfBytes, fileName, "application/pdf");
    const artifact = await prisma.evidenceArtifact.create({
      data: {
        ...savedFile,
        recordStatus: parsed.data.status,
        classification: "annual_plan",
        tagsJson: JSON.stringify({
          schoolYear: parsed.data.schoolYear,
          student: parsed.data.student,
          reportType: "annual_plan",
          attachedAnnualRecordCount: attachmentIds.length
        })
      }
    });
    const student = await prisma.student.upsert({
      where: { name: parsed.data.student },
      update: {},
      create: { name: parsed.data.student }
    });
    const schoolYear = await prisma.schoolYear.upsert({
      where: { studentId_label: { studentId: student.id, label: parsed.data.schoolYear } },
      update: { status: parsed.data.status },
      create: {
        label: parsed.data.schoolYear,
        status: parsed.data.status,
        studentId: student.id
      }
    });
    await createArtifactSnapshot({
      schoolYearId: schoolYear.id,
      type: "annual_plan_pdf",
      label: `Annual Plan PDF ${parsed.data.schoolYear}`,
      artifactId: artifact.id
    }).catch(() => null);

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Annual Plan PDF generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
