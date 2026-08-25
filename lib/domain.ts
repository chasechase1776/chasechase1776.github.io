export const activityTypes = [
  "Language Arts",
  "Math",
  "Finance",
  "Science Journal",
  "Unit Study",
  "Writing Project",
  "Project Cycle",
  "Presentation Cycle",
  "Hands-On Activity",
  "Physical Activity",
  "Foreign Language",
  "Independent Reading",
  "Extracurricular",
  "Field Trip",
  "Group Event",
  "Special Event"
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
    "Observational Skills",
    "Biology",
    "Chemistry",
    "Physics",
    "Earth Science",
    "Astronomy",
    "Medicine",
    "Social Science",
    "Computer Science",
    "Environmental Science",
    "Engineering",
    "Matter & Energy",
    "Force, Motion & Energy",
    "Earth & Space",
    "Organisms & Environments"
  ],
  Music: [
    "Rhythm & Timing",
    "Ear Training",
    "Technical Proficiency",
    "Music Theory & Sight-Reading",
    "Improvisation & Repertoire",
    "Music Appreciation"
  ],
  Art: [
    "Observation",
    "Line & Form",
    "Color",
    "Composition",
    "Medium",
    "Art Appreciation"
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
    "Leadership",
    "Communication",
    "Business",
    "Philosophy",
    "Logic",
    "Problem-Solving",
    "Emotional Intelligence"
  ],
  "Foreign Language": [
    "Listening Comprehension",
    "Speaking Practice",
    "Vocabulary",
    "Reading in Target Language",
    "Writing in Target Language",
    "Cultural Awareness"
  ],
  "Independent Reading": [
    "Reading Stamina",
    "Comprehension",
    "Book Discussion",
    "Vocabulary from Context",
    "Reader Response"
  ],
  Extracurricular: [
    "Sports",
    "Clubs",
    "Service",
    "Performing Arts",
    "Visual Arts",
    "Tech & STEM",
    "Communication",
    "Mind Games",
    "Other",
    "Teamwork",
    "Discipline and Practice",
    "Leadership",
    "Creative Expression",
    "Technical Skills",
    "Strategic Thinking"
  ]
};

export function suggestLegalTags(activityType: string, subjects: string[]) {
  const tags = new Set<string>(["Bona Fide Instruction"]);
  const combined = [activityType, ...subjects].join(" ").toLowerCase();

  if (combined.includes("language") || combined.includes("reading") || combined.includes("literature")) tags.add("Reading");
  if (combined.includes("spelling")) tags.add("Spelling");
  if (combined.includes("grammar") || combined.includes("writing")) tags.add("Grammar");
  if (combined.includes("math") || combined.includes("finance") || combined.includes("money")) tags.add("Mathematics");
  if (combined.includes("citizenship") || combined.includes("social") || combined.includes("group") || combined.includes("service") || combined.includes("extracurricular")) tags.add("Good Citizenship");
  if (
    combined.includes("visual") ||
    combined.includes("presentation") ||
    combined.includes("journal") ||
    combined.includes("field") ||
    combined.includes("foreign") ||
    combined.includes("language") ||
    combined.includes("arts") ||
    combined.includes("art") ||
    combined.includes("music") ||
    combined.includes("stem")
  ) {
    tags.add("Visual Curriculum");
  }

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
  if (activityType === "Foreign Language") return "Foreign Language";
  if (activityType === "Independent Reading") return "Independent Reading";
  if (activityType === "Extracurricular" || activityType === "Physical Activity") return "Extracurricular";
  if (activityType === "Science Journal") return "Science";
  if (activityType === "Field Trip" || activityType === "Group Event" || activityType === "Special Event") return "Social Studies";
  return "Unit Study";
}
