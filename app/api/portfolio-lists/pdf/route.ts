import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { saveReportArtifact } from "@/lib/report-artifacts";

const categoryLabels = {
  books: "Book List",
  achievements: "Achievements & Awards",
  accolades: "Accolades",
  projects: "Major Projects",
  fieldTrips: "Field Trips",
  valuableFailures: "Valuable Setbacks & Failure"
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

function formatUsDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value || "No date listed";
  return `${month}/${day}/${year}`;
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

  const drawLine = (text: string, options: { size?: number; heading?: boolean; gap?: number; indent?: number } = {}) => {
    const size = options.size ?? 11;
    if (y < 70) newPage();
    page.drawText(pdfText(text || " "), {
      x: margin + (options.indent ?? 0),
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
      const completed = entry.completedDate ? formatUsDate(entry.completedDate) : "No completion date";
      drawLine(`${index + 1}. ${entry.title || "Untitled book"}`, { heading: true });
      drawLine(`Author: ${entry.author || "Not listed"}`);
      drawLine(`Date completed: ${completed}`);
      drawLine(`Student rating: ${entry.rating ?? 5} star${entry.rating === 1 ? "" : "s"}`, { gap: 18 });
      return;
    }

    if (input.category === "valuableFailures") {
      drawLine(`${index + 1}. ${entry.title || "Untitled setback"}`, { heading: true, size: 13, gap: 18 });
      drawLine(`Date: ${formatUsDate(entry.date)} - ${entry.resolved ? "Resolved" : "Open"}`, { indent: 18, gap: 20 });
      drawLine("Failure or setback", { heading: true, indent: 18 });
      wrapText(entry.narrative || "No event narrative entered.", 86).forEach((line) => drawLine(line, { indent: 32 }));
      y -= 8;
      drawLine("Initial response", { heading: true, indent: 18 });
      wrapText(entry.response || "No response entered.", 86).forEach((line) => drawLine(line, { indent: 32 }));
      y -= 8;
      drawLine("Reflection", { heading: true, indent: 18 });
      wrapText(entry.reflection || "No reflection entered.", 86).forEach((line) => drawLine(line, { indent: 32 }));
      y -= 8;
      drawLine("Plan", { heading: true, indent: 18 });
      wrapText(entry.plan || "No plan entered.", 86).forEach((line) => drawLine(line, { indent: 32 }));
      if (entry.followUps.length) {
        y -= 8;
        drawLine("Follow-ups", { heading: true, indent: 18 });
        entry.followUps.forEach((followUp, followUpIndex) => {
          drawLine(`${followUpIndex + 1}. ${formatUsDate(followUp.date)} - ${followUp.resolved ? "Resolved" : "Open"}`, { heading: true, indent: 32 });
          wrapText(`Reattempt event: ${followUp.reattemptEvent || "Not entered."}`, 80).forEach((line) => drawLine(line, { indent: 46 }));
          wrapText(`Learning outcome: ${followUp.learningOutcome || "Not entered."}`, 80).forEach((line) => drawLine(line, { indent: 46 }));
          y -= 6;
        });
      }
      y -= 16;
      return;
    }

    drawLine(`${index + 1}. ${formatUsDate(entry.date)}`, { heading: true });
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
    const artifact = await saveReportArtifact({
      bytes: pdfBytes,
      fileName,
      recordStatus: schoolYear.status,
      classification: classificationByCategory[input.category],
      tags: { schoolYear: schoolYear.label, portfolioSection: input.category },
      snapshot: {
        schoolYearId: schoolYear.id,
        type: "portfolio_list_pdf",
        label: `${categoryLabels[input.category]} PDF`
      }
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portfolio PDF export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
