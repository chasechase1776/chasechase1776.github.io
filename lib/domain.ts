export const activityTypes = [
  "Language Arts",
  "Math",
  "Finance",
  "Unit Study",
  "Science Journal",
  "Writing Project",
  "Project Cycle",
  "Presentation Cycle",
  "Hands-On Activity",
  "Physical Activity",
  "Field Trip",
  "Group Event"
] as const;

export const texasLegalTags = [
  "Reading",
  "Spelling",
  "Grammar",
  "Mathematics",
  "Good Citizenship",
  "Visual Curriculum",
  "Bona Fide Instruction"
] as const;

export const skillTaxonomy: Record<string, string[]> = {
  "Language Arts": ["Reading", "Grammar", "Literature", "Memory Work", "Phonics", "Spelling", "Writing", "Editing", "Fluency"],
  Math: [
    "Number Sense and Place Value",
    "Operations and Fluency",
    "Fractions and Part-Whole Reasoning",
    "Measurement and Money",
    "Geometry and Spatial Reasoning",
    "Data and Graphing",
    "Patterns and Algebraic Thinking",
    "Mathematical Communication",
    "Problem-Solving and Application"
  ],
  Finance: [
    "Money Recognition and Counting",
    "Earning and Value Creation",
    "Saving and Goal Setting",
    "Spending and Decision-Making",
    "Needs, Wants and Priorities",
    "Budgeting",
    "Giving and Stewardship",
    "Tradeoffs and Opportunity Cost",
    "Comparison Shopping",
    "Record Keeping",
    "Entrepreneurship",
    "Banking Basics",
    "Risk and Responsibility",
    "Advertising and Awareness"
  ],
  Science: [
    "Conducts Investigations with Responsible Practices",
    "Asks Questions and Seeks Answers",
    "Critical Thinking for Problem Solving",
    "Uses Tools and Models to Investigate the World",
    "Matter & Energy",
    "Force, Motion & Energy",
    "Earth & Space",
    "Organisms & Environments"
  ],
  "Social Studies": [
    "US History",
    "World History",
    "Geography",
    "Economics",
    "Government",
    "Citizenship",
    "Culture",
    "Life Skills",
    "Communication",
    "Business",
    "Philosophy",
    "Emotional Intelligence"
  ]
};

export function suggestLegalTags(activityType: string, subjects: string[]) {
  const tags = new Set<string>(["Bona Fide Instruction"]);
  const combined = [activityType, ...subjects].join(" ").toLowerCase();

  if (combined.includes("language") || combined.includes("reading") || combined.includes("literature")) tags.add("Reading");
  if (combined.includes("spelling")) tags.add("Spelling");
  if (combined.includes("grammar") || combined.includes("writing")) tags.add("Grammar");
  if (combined.includes("math") || combined.includes("finance") || combined.includes("money")) tags.add("Mathematics");
  if (combined.includes("citizenship") || combined.includes("social") || combined.includes("group")) tags.add("Good Citizenship");
  if (combined.includes("visual") || combined.includes("presentation") || combined.includes("journal") || combined.includes("field")) tags.add("Visual Curriculum");

  return Array.from(tags);
}

export function defaultRecordStatus(date: string, officialStartDate?: string | null, schoolYearStatus = "trial") {
  if (!officialStartDate) return "trial";
  if (date >= officialStartDate && schoolYearStatus === "active") return "official";
  return "trial";
}

export function inferSubject(activityType: string) {
  if (activityType === "Language Arts" || activityType === "Writing Project" || activityType === "Presentation Cycle") return "Language Arts";
  if (activityType === "Math") return "Math";
  if (activityType === "Finance") return "Finance";
  if (activityType === "Science Journal") return "Science";
  if (activityType === "Field Trip" || activityType === "Group Event") return "Social Studies";
  return "Unit Study";
}
