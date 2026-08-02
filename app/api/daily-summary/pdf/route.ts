import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readStoredFile, saveGeneratedFile } from "@/lib/storage";

export const runtime = "nodejs";

const dailySummaryPdfSchema = z.object({
  studentName: z.string().min(1).default("Bennett C. Claypool"),
  schoolYearLabel: z.string().min(1).default("2026-2027"),
  date: z.string().min(10),
  recordStatus: z.string().default("trial")
});

type EvidenceFile = {
  title: string;
  mimeType: string;
  bytes: Uint8Array;
};

const dailyActivityInclude = {
  student: true,
  schoolYear: true,
  unitStudy: true,
  allocations: true,
  legalTags: { include: { legalTag: true } },
  skills: { include: { skill: true } },
  artifacts: true
} satisfies Prisma.ActivityInclude;

type DailySummaryActivity = Prisma.ActivityGetPayload<{ include: typeof dailyActivityInclude }>;

function pdfText(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function dateDisplay(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}/${date.getUTCFullYear()}`;
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

function activityResources(notes: string | null) {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes) as { resources?: unknown };
    if (!Array.isArray(parsed.resources)) return [];
    return parsed.resources
      .map((resource) => {
        const item = resource as { title?: unknown; authorOrEditor?: unknown; url?: unknown };
        return {
          title: typeof item.title === "string" ? item.title : "",
          authorOrEditor: typeof item.authorOrEditor === "string" ? item.authorOrEditor : "",
          url: typeof item.url === "string" ? item.url : ""
        };
      })
      .filter((resource) => resource.title || resource.authorOrEditor || resource.url);
  } catch {
    return [];
  }
}

function attachmentName(name: string) {
  return pdfText(name).replace(/["\r\n]/g, "-") || "daily-proof";
}

async function readEvidenceFiles(artifacts: { originalName: string; mimeType: string; storagePath: string }[]) {
  const files: EvidenceFile[] = [];
  for (const artifact of artifacts.slice(0, 20)) {
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
      // Keep daily summary generation working if one proof file cannot be retrieved.
    }
  }
  return files;
}

async function buildDailySummaryPdf(
  input: z.infer<typeof dailySummaryPdfSchema>,
  activities: DailySummaryActivity[],
  evidenceFiles: EvidenceFile[]
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const lineHeight = 14;
  let page = pdf.addPage([612, 792]);
  let y = 744;
  let pageNumber = 1;

  const drawFooter = () => {
    page.drawText(`Daily Summary - Page ${pageNumber}`, {
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

  const totalMinutes = activities.reduce((sum, activity) => sum + activity.actualMinutes, 0);
  const totalProof = activities.reduce((sum, activity) => sum + activity.artifacts.length, 0);

  drawCentered(`${input.studentName} - ${input.schoolYearLabel}`, y, 12);
  y -= 18;
  drawCentered("Daily Summary", y, 12, bold);
  y -= 18;
  drawCentered(dateDisplay(input.date), y, 12, bold);
  y -= 36;

  drawLine("Daily Totals", { heading: true });
  drawWrapped(`Activities saved: ${activities.length}`, 12);
  drawWrapped(`Total learning time: ${totalMinutes} minutes`, 12);
  drawWrapped(`Proof files attached: ${totalProof}`, 12);
  drawGap(10);

  drawLine("Saved Activity Records", { heading: true });
  activities.forEach((activity, index) => {
    drawWrapped(`${index + 1}. ${activity.title}`, 12);
    drawWrapped(`${activity.activityType} - ${activity.actualMinutes} minutes - ${activity.parentApproved ? "approved" : "draft / needs review"} - ${activity.recordStatus}`, 24);
    drawWrapped(`Narration: ${activity.narration}`, 24);
    if (activity.allocations.length) {
      drawWrapped(`Subject allocations: ${activity.allocations.map((allocation) => `${allocation.subject} ${allocation.minutes}m`).join("; ")}`, 24);
    }
    if (activity.legalTags.length) {
      drawWrapped(`Legal tags: ${activity.legalTags.map((item) => item.legalTag.label).join(", ")}`, 24);
    }
    if (activity.skills.length) {
      drawWrapped(`Skills: ${activity.skills.map((item) => `${item.skill.subject}: ${item.skill.name}`).join(", ")}`, 24);
    }
    if (activity.unitStudy) {
      drawWrapped(`Unit study: ${activity.unitStudy.title}`, 24);
    }
    const resources = activityResources(activity.notes);
    if (resources.length) {
      drawWrapped(
        `Resources: ${resources.map((resource) => [resource.title, resource.authorOrEditor, resource.url].filter(Boolean).join(" - ")).join("; ")}`,
        24
      );
    }
    drawWrapped(
      activity.artifacts.length
        ? `Proof uploads: ${activity.artifacts.map((artifact) => artifact.originalName).join(", ")}`
        : "Proof uploads: none",
      24
    );
    drawGap(10);
  });

  if (evidenceFiles.length) {
    drawLine("Embedded Proof Files", { heading: true });
    let embeddedPdfPages = 0;

    for (const evidenceFile of evidenceFiles) {
      const mimeType = evidenceFile.mimeType.toLowerCase();

      try {
        await pdf.attach(evidenceFile.bytes, attachmentName(evidenceFile.title), {
          mimeType: evidenceFile.mimeType,
          description: `Daily summary proof: ${evidenceFile.title}`
        });
      } catch {
        // Visible previews below remain the main proof path.
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
          const pages = await pdf.embedPdf(sourcePdf, Array.from({ length: pageCount }, (_value, pageIndex) => pageIndex));

          for (const [pageIndex, embeddedPage] of pages.entries()) {
            embeddedPdfPages += 1;
            const scale = Math.min(500 / embeddedPage.width, 620 / embeddedPage.height, 1);
            const width = embeddedPage.width * scale;
            const height = embeddedPage.height * scale;
            ensureSpace(height + 48);
            drawLine(`${evidenceFile.title} - page ${pageIndex + 1}`);
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
        drawGap();
        continue;
      }

      drawLine(`Attached file: ${evidenceFile.title} (${evidenceFile.mimeType || "file"})`);
      drawLine("This file is attached to the PDF. Open the PDF attachments panel to access it.", { indent: 12 });
      drawGap();
    }
  }

  drawFooter();
  return Buffer.from(await pdf.save());
}

export async function POST(request: Request) {
  try {
    const parsed = dailySummaryPdfSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const activityDate = new Date(`${input.date.slice(0, 10)}T00:00:00.000Z`);
    const activities = await prisma.activity.findMany({
      where: {
        date: activityDate,
        student: { name: { in: [input.studentName, "Bennett"] } },
        schoolYear: { label: input.schoolYearLabel }
      },
      include: {
        ...dailyActivityInclude
      },
      orderBy: [{ createdAt: "asc" }]
    });

    if (!activities.length) {
      return NextResponse.json({ error: "No saved activities were found for the selected date." }, { status: 404 });
    }

    const artifacts = activities.flatMap((activity) => activity.artifacts);
    const evidenceFiles = await readEvidenceFiles(artifacts);
    const pdfBytes = await buildDailySummaryPdf(input, activities, evidenceFiles);
    const fileName = `daily-summary-${input.date.slice(0, 10)}.pdf`;
    const savedFile = await saveGeneratedFile(pdfBytes, fileName, "application/pdf");
    const artifact = await prisma.evidenceArtifact.create({
      data: {
        ...savedFile,
        recordStatus: input.recordStatus,
        classification: "daily_summary",
        tagsJson: JSON.stringify({
          schoolYear: input.schoolYearLabel,
          student: input.studentName,
          date: input.date.slice(0, 10),
          reportType: "daily_summary",
          activityCount: activities.length,
          attachedProofCount: artifacts.length
        })
      }
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily summary PDF generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
