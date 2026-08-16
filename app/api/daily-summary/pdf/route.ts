import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activityTypes } from "@/lib/domain";
import { createArtifactSnapshot } from "@/lib/snapshots";
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

function minutesDisplay(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${minutes} min`;
  return `${hours}h ${remaining}m`;
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

  const drawSectionHeading = (label: string, title: string) => {
    ensureSpace(34);
    page.drawText(pdfText(label), {
      x: margin,
      y,
      size: 11,
      font: bold,
      color: rgb(0.35, 0.28, 0.25)
    });
    page.drawText(pdfText(title), {
      x: margin + 28,
      y,
      size: 12,
      font: bold,
      color: rgb(0.09, 0.13, 0.17)
    });
    y -= 22;
  };

  const drawActivityTile = (x: number, tileY: number, width: number, height: number, label: string, minutes: number, completed: boolean) => {
    page.drawRectangle({
      x,
      y: tileY,
      width,
      height,
      borderWidth: 1.2,
      borderColor: completed ? rgb(0.16, 0.56, 0.38) : rgb(0.63, 0.55, 0.5),
      color: completed ? rgb(0.9, 0.96, 0.93) : rgb(1, 0.98, 0.97)
    });
    page.drawText(pdfText(label), {
      x: x + 8,
      y: tileY + height - 17,
      size: 9,
      font: bold,
      color: rgb(0.05, 0.08, 0.08)
    });
    page.drawText(minutes ? minutesDisplay(minutes) : "not logged", {
      x: x + 8,
      y: tileY + 10,
      size: 8,
      font: minutes ? bold : regular,
      color: completed ? rgb(0.08, 0.42, 0.27) : rgb(0.35, 0.28, 0.25)
    });
  };

  const drawSubjectBar = (subject: string, minutes: number, totalMinutes: number, index: number) => {
    const barWidth = 255;
    const barHeight = 8;
    const percent = totalMinutes ? Math.max(0.03, Math.min(1, minutes / totalMinutes)) : 0;
    const x = margin + 210;
    const barY = y + 2;
    drawWrapped(`${subject}: ${minutesDisplay(minutes)}`, 12);
    page.drawRectangle({
      x,
      y: barY,
      width: barWidth,
      height: barHeight,
      borderWidth: 0.8,
      borderColor: rgb(0.85, 0.78, 0.74),
      color: rgb(0.98, 0.94, 0.92)
    });
    page.drawRectangle({
      x,
      y: barY,
      width: barWidth * percent,
      height: barHeight,
      color: index % 2 === 0 ? rgb(0.16, 0.56, 0.38) : rgb(0.62, 0.42, 0.29)
    });
  };

  const drawGap = (height = 8) => {
    ensureSpace(height);
    y -= height;
  };

  const totalMinutes = activities.reduce((sum, activity) => sum + activity.actualMinutes, 0);
  const totalProof = activities.reduce((sum, activity) => sum + activity.artifacts.length, 0);
  const activityTime = new Map<string, number>();
  const activityApproved = new Map<string, boolean>();
  const subjectTime = new Map<string, number>();

  activities.forEach((activity) => {
    activityTime.set(activity.activityType, (activityTime.get(activity.activityType) ?? 0) + activity.actualMinutes);
    activityApproved.set(activity.activityType, (activityApproved.get(activity.activityType) ?? false) || activity.parentApproved);
    activity.allocations.forEach((allocation) => {
      subjectTime.set(allocation.subject, (subjectTime.get(allocation.subject) ?? 0) + allocation.minutes);
    });
    if (!activity.allocations.length) {
      subjectTime.set(activity.activityType, (subjectTime.get(activity.activityType) ?? 0) + activity.actualMinutes);
    }
  });

  const sortedSubjectTime = Array.from(subjectTime.entries()).sort((a, b) => b[1] - a[1]);

  drawCentered(`${input.studentName} - ${input.schoolYearLabel}`, y, 12);
  y -= 18;
  drawCentered("Daily Summary", y, 12, bold);
  y -= 18;
  drawCentered(dateDisplay(input.date), y, 12, bold);
  y -= 36;

  drawSectionHeading("I", "Learning activities");
  const tileWidth = 120;
  const tileHeight = 48;
  const tileGap = 12;
  const tilesPerRow = 4;
  ensureSpace(Math.ceil(activityTypes.length / tilesPerRow) * (tileHeight + tileGap) + 28);
  activityTypes.forEach((activityType, index) => {
    const row = Math.floor(index / tilesPerRow);
    const column = index % tilesPerRow;
    const x = margin + column * (tileWidth + tileGap);
    const tileY = y - row * (tileHeight + tileGap) - tileHeight;
    drawActivityTile(
      x,
      tileY,
      tileWidth,
      tileHeight,
      activityType,
      activityTime.get(activityType) ?? 0,
      activityApproved.get(activityType) ?? false
    );
  });
  y -= Math.ceil(activityTypes.length / tilesPerRow) * (tileHeight + tileGap) + 4;
  drawWrapped(`Total time: ${minutesDisplay(totalMinutes)}`, 12);
  drawWrapped(`Activities saved: ${activities.length}; proof files attached: ${totalProof}`, 12);
  drawGap(12);

  drawSectionHeading("II", "Subject skill time summary");
  if (sortedSubjectTime.length) {
    sortedSubjectTime.forEach(([subject, minutes], index) => drawSubjectBar(subject, minutes, totalMinutes, index));
  } else {
    drawWrapped("No subject time allocations were saved for this date.", 12);
  }
  drawGap(12);

  drawSectionHeading("III", "Daily record narratives");
  activities.forEach((activity, index) => {
    drawWrapped(`${index + 1}. ${activity.title}`, 12);
    drawWrapped(`${activity.activityType} - ${minutesDisplay(activity.actualMinutes)} - ${activity.parentApproved ? "approved" : "draft / needs review"} - ${activity.recordStatus}`, 24);
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
    await createArtifactSnapshot({
      schoolYearId: activities[0].schoolYearId,
      type: "daily_summary_pdf",
      label: `Daily Summary PDF ${input.date.slice(0, 10)}`,
      artifactId: artifact.id
    }).catch(() => null);

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily summary PDF generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
