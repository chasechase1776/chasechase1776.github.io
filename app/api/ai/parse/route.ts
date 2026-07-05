import { NextResponse } from "next/server";
import { z } from "zod";
import { inferSubject, skillTaxonomy, suggestLegalTags } from "@/lib/domain";

const parseSchema = z.object({
  student: z.string().min(1),
  schoolYear: z.string().min(1),
  unitStudy: z.string().min(1),
  selectedDate: z.string().min(10),
  selectedActivityType: z.string().min(1),
  narrationText: z.string().min(1),
  attachedArtifactIds: z.array(z.string()).default([])
});

export async function POST(request: Request) {
  const parsed = parseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
  const mode = hasOpenAiKey && process.env.AI_PARSER_MODE !== "disabled" ? "mock-ready" : "mock";
  const subject = inferSubject(input.selectedActivityType);
  const skillSource = skillTaxonomy[subject] ?? [];
  const matchedSkills = skillSource.slice(0, Math.min(3, skillSource.length)).map((name) => ({ subject, name }));
  const estimatedMinutes = input.narrationText.length > 280 ? 45 : 20;

  return NextResponse.json({
    mode,
    openAiConfigured: hasOpenAiKey,
    note:
      mode === "mock"
        ? "OPENAI_API_KEY is missing or AI parsing is disabled, so this draft was produced by the local mock parser."
        : "Server route is configured to keep the API key off the frontend. Replace mock-ready mode with the OpenAI call when ready.",
    drafts: [
      {
        title: input.narrationText.split(/[.!?]/)[0]?.slice(0, 80) || input.selectedActivityType,
        date: input.selectedDate,
        activityType: input.selectedActivityType,
        actualMinutes: estimatedMinutes,
        narration: input.narrationText,
        subjectAllocations: [{ subject, minutes: estimatedMinutes }],
        legalTags: suggestLegalTags(input.selectedActivityType, [subject]),
        skills: matchedSkills,
        artifactIds: input.attachedArtifactIds,
        parentApproved: false,
        reviewStatus: "needs_review"
      }
    ]
  });
}
