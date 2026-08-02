import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { saveGeneratedFile } from "@/lib/storage";

const categoryLabels = {
  books: "Book List",
  achievements: "Achievements & Awards",
  accolades: "Accolades",
  projects: "Major Projects",
  fieldTrips: "Field Trips",
  valuableFailures: "Valuable Failures"
} as const;

const classificationByCategory = {
  books: "portfolio_book_list",
  achievements: "portfolio_achievements",
  accolades: "portfolio_accolades",
  projects: "portfolio_major_projects",
  fieldTrips: "portfolio_field_trips",
  valuableFailures: "portfolio_valuable_failures"
} as const;

const followUpSchema = z.object({
  id: z.string().default(""),
  date: z.string().default(""),
  reattemptEvent: z.string().default(""),
  learningOutcome: z.string().default(""),
  resolved: z.boolean().default(false)
});

const entrySchema = z.object({
  title: z.string().default(""),
  author: z.string().default(""),
  rating: z.number().int().min(1).max(5).optional(),
  completedDate: z.string().default(""),
  narrative: z.string().default(""),
  date: z.string().default(""),
  artifactIds: z.array(z.string()).default([]),
  response: z.string().default(""),
  reflection: z.string().default(""),
  plan: z.string().default(""),
  resolved: z.boolean().default(false),
  followUps: z.array(followUpSchema).default([])
});

const pdfSchema = z.object({
  studentName: z.string().min(1).default("Bennett C. Claypool"),
  schoolYearLabel: z.string().min(1),
  category: z.enum(["books", "achievements", "accolades", "projects", "fieldTrips", "valuableFailures"]),
  entries: z.array(entrySchema)
});

function pdfText(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrapText(text: string, maxChars: number) {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    if (`${current} ${word}`.trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [" "];
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "portfolio-list";
}

async function schoolYearFor(studentName: string, schoolYearLabel: string) {
  const student = await prisma.student.upsert({
    where: { name: studentName },
    update: {},
    create: { name: studentName }
  });

  return prisma.schoolYear.upsert({
    where: { studentId_label: { studentId: student.id, label: schoolYearLabel } },
    update: {},
    create: {
      label: schoolYearLabel,
      studentId: student.id
    }
  });
}

async function buildPdf(input: z.infer<typeof pdfSchema>, artifactsById: Map<string, { originalName: string }>) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 54;
  let page = pdf.addPage(pageSize);
  let y = 735;

  const newPage = () => {
    page = pdf.addPage(pageSize);
    y = 735;
  };

  const drawLine = (text: string, options: { size?: number; heading?: boolean; gap?: number } = {}) => {
    const size = options.size ?? 11;
    if (y < 70) newPage();
    page.drawText(pdfText(text || " "), {
      x: margin,
      y,
      size,
      font: options.heading ? bold : regular,
      color: rgb(0.08, 0.12, 0.16)
    });
    y -= options.gap ?? size + 6;
  };

  const title = categoryLabels[input.category];
  drawLine(`${input.studentName} - ${input.schoolYearLabel}`, { size: 12 });
  drawLine(title, { size: 16, heading: true, gap: 24 });

  if (!input.entries.length) {
    drawLine("No entries saved yet.");
  }

  input.entries.forEach((entry, index) => {
    if (input.category === "books") {
      const completed = entry.completedDate || "No completion date";
      drawLine(`${index + 1}. ${entry.title || "Untitled book"}`, { heading: true });
      drawLine(`Author: ${entry.author || "Not listed"}`);
      drawLine(`Date completed: ${completed}`);
      drawLine(`Student rating: ${entry.rating ?? 5} star${entry.rating === 1 ? "" : "s"}`, { gap: 18 });
      return;
    }

    if (input.category === "valuableFailures") {
      drawLine(`${index + 1}. ${entry.date || "No date listed"} - ${entry.resolved ? "Resolved" : "Open"}`, { heading: true });
      drawLine("Failure or setback", { heading: true });
      wrapText(entry.narrative || "No event narrative entered.", 92).forEach((line) => drawLine(line));
      drawLine("Initial response", { heading: true });
      wrapText(entry.response || "No response entered.", 92).forEach((line) => drawLine(line));
      drawLine("Reflection", { heading: true });
      wrapText(entry.reflection || "No reflection entered.", 92).forEach((line) => drawLine(line));
      drawLine("Plan", { heading: true });
      wrapText(entry.plan || "No plan entered.", 92).forEach((line) => drawLine(line));
      if (entry.followUps.length) {
        drawLine("Follow-ups", { heading: true });
        entry.followUps.forEach((followUp, followUpIndex) => {
          drawLine(`  ${followUpIndex + 1}. ${followUp.date || "No date listed"} - ${followUp.resolved ? "Resolved" : "Open"}`, { heading: true });
          wrapText(`Reattempt event: ${followUp.reattemptEvent || "Not entered."}`, 86).forEach((line) => drawLine(line));
          wrapText(`Learning outcome: ${followUp.learningOutcome || "Not entered."}`, 86).forEach((line) => drawLine(line));
        });
      }
      y -= 10;
      return;
    }

    drawLine(`${index + 1}. ${entry.date || "No date listed"}`, { heading: true });
    wrapText(entry.narrative || "No narrative entered.", 92).forEach((line) => drawLine(line));
    const proofNames = entry.artifactIds.map((id) => artifactsById.get(id)?.originalName).filter(Boolean);
    if (proofNames.length) {
      drawLine(`Attached proof: ${proofNames.join(", ")}`);
    }
    y -= 8;
  });

  return Buffer.from(await pdf.save());
}

export async function POST(request: Request) {
  try {
    const parsed = pdfSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const schoolYear = await schoolYearFor(input.studentName, input.schoolYearLabel);
    const artifactIds = Array.from(new Set(input.entries.flatMap((entry) => entry.artifactIds)));
    const artifacts = artifactIds.length
      ? await prisma.evidenceArtifact.findMany({
          where: { id: { in: artifactIds } },
          select: { id: true, originalName: true }
        })
      : [];
    const artifactsById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    const pdfBytes = await buildPdf(input, artifactsById);
    const fileName = `${slug(categoryLabels[input.category])}-${slug(input.schoolYearLabel)}-${Date.now()}.pdf`;
    const savedFile = await saveGeneratedFile(pdfBytes, fileName, "application/pdf");
    const artifact = await prisma.evidenceArtifact.create({
      data: {
        originalName: fileName,
        fileName: savedFile.fileName,
        mimeType: savedFile.mimeType,
        sizeBytes: savedFile.sizeBytes,
        storagePath: savedFile.storagePath,
        recordStatus: schoolYear.status,
        classification: classificationByCategory[input.category],
        tagsJson: JSON.stringify({ schoolYear: schoolYear.label, portfolioSection: input.category })
      }
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portfolio PDF export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
