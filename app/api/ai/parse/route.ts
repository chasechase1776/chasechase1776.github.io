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

const draftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["drafts"],
  properties: {
    drafts: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "date",
          "activityType",
          "actualMinutes",
          "narration",
          "subjectAllocations",
          "legalTags",
          "skills",
          "artifactIds",
          "parentApproved",
          "reviewStatus"
        ],
        properties: {
          title: { type: "string" },
          date: { type: "string" },
          activityType: { type: "string" },
          actualMinutes: { type: "integer", minimum: 1 },
          narration: { type: "string" },
          subjectAllocations: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["subject", "minutes"],
              properties: {
                subject: { type: "string" },
                minutes: { type: "integer", minimum: 0 }
              }
            }
          },
          legalTags: { type: "array", items: { type: "string" } },
          skills: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["subject", "name"],
              properties: {
                subject: { type: "string" },
                name: { type: "string" }
              }
            }
          },
          artifactIds: { type: "array", items: { type: "string" } },
          parentApproved: { type: "boolean" },
          reviewStatus: { type: "string", enum: ["needs_review"] }
        }
      }
    }
  }
};

type Draft = {
  title: string;
  date: string;
  activityType: string;
  actualMinutes: number;
  narration: string;
  subjectAllocations: { subject: string; minutes: number }[];
  legalTags: string[];
  skills: { subject: string; name: string }[];
  artifactIds: string[];
  parentApproved: false;
  reviewStatus: "needs_review";
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  error?: { message?: string };
};

function mockDraft(input: z.infer<typeof parseSchema>): Draft {
  const subject = inferSubject(input.selectedActivityType);
  const skillSource = skillTaxonomy[subject] ?? [];
  const matchedSkills = skillSource.slice(0, Math.min(3, skillSource.length)).map((name) => ({ subject, name }));
  const estimatedMinutes = input.narrationText.length > 280 ? 45 : 20;

  return {
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
  };
}

function extractOutputText(body: OpenAIResponseBody) {
  if (body.output_text) return body.output_text;

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

function normalizeDrafts(drafts: Draft[], input: z.infer<typeof parseSchema>) {
  return drafts.map((draft) => {
    const totalAllocated = draft.subjectAllocations.reduce((sum, allocation) => sum + allocation.minutes, 0);
    const subject = draft.subjectAllocations[0]?.subject ?? inferSubject(input.selectedActivityType);

    return {
      ...draft,
      date: input.selectedDate,
      activityType: input.selectedActivityType,
      narration: draft.narration || input.narrationText,
      artifactIds: input.attachedArtifactIds,
      parentApproved: false,
      reviewStatus: "needs_review",
      subjectAllocations:
        totalAllocated === draft.actualMinutes && draft.subjectAllocations.length
          ? draft.subjectAllocations
          : [{ subject, minutes: draft.actualMinutes }]
    };
  });
}

export async function POST(request: Request) {
  const parsed = parseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);
  const aiEnabled = hasOpenAiKey && process.env.AI_PARSER_MODE !== "disabled";

  if (!aiEnabled) {
    return NextResponse.json({
      mode: "mock",
      openAiConfigured: hasOpenAiKey,
      note: "OPENAI_API_KEY is missing or AI parsing is disabled, so this draft was produced by the local mock parser.",
      drafts: [mockDraft(input)]
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.5",
      instructions:
        "Extract parent-reviewable homeschool activity draft records from narration. Keep the activity as the source of truth. Subject allocation minutes must add up exactly to actualMinutes. Legal tags must use Texas categories when relevant. Return only data matching the schema.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                student: input.student,
                schoolYear: input.schoolYear,
                unitStudy: input.unitStudy,
                selectedDate: input.selectedDate,
                selectedActivityType: input.selectedActivityType,
                narrationText: input.narrationText,
                attachedArtifactIds: input.attachedArtifactIds,
                availableSubjects: Object.keys(skillTaxonomy),
                availableSkills: skillTaxonomy,
                texasLegalTags: [
                  "Reading",
                  "Spelling",
                  "Grammar",
                  "Mathematics",
                  "Good Citizenship",
                  "Visual Curriculum",
                  "Bona Fide Instruction"
                ]
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "homeschool_activity_parse",
          strict: true,
          schema: draftSchema
        }
      }
    })
  });

  const body = (await response.json()) as OpenAIResponseBody;
  if (!response.ok) {
    return NextResponse.json(
      { error: body.error?.message ?? "OpenAI parsing failed. Manual logging is still available." },
      { status: 502 }
    );
  }

  const outputText = extractOutputText(body);
  let json: { drafts: Draft[] };
  try {
    json = JSON.parse(outputText) as { drafts: Draft[] };
  } catch {
    return NextResponse.json({ error: "OpenAI returned an unreadable parse result. Manual logging is still available." }, { status: 502 });
  }

  return NextResponse.json({
    mode: "openai",
    openAiConfigured: hasOpenAiKey,
    note: "Drafts were parsed server-side with OpenAI. They are not saved until parent approval.",
    drafts: normalizeDrafts(json.drafts, input)
  });
}
