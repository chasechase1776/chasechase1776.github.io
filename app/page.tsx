"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { skillTaxonomy } from "@/lib/domain";

type SavedActivity = {
  id: string;
  title: string;
  date: string;
  actualMinutes: number;
  activityType: string;
  narration: string;
  recordStatus: string;
  parentApproved: boolean;
  reviewStatus: string;
  allocations: { subject: string; minutes: number }[];
  legalTags: { legalTag: { label: string } }[];
};

type UploadedArtifact = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

type WeeklyPdfArtifact = UploadedArtifact;

type PortfolioArtifact = UploadedArtifact & {
  storagePath: string;
  recordStatus: string;
  createdAt: string;
  activity: {
    id: string;
    title: string;
    date: string;
    actualMinutes: number;
    activityType: string;
    schoolYear: { label: string };
    unitStudy: { title: string } | null;
    allocations: { subject: string; minutes: number }[];
    legalTags: { legalTag: { label: string } }[];
  } | null;
};

type PortfolioNode = {
  key: string;
  label: string;
  count: number;
  level: number;
};

type WorkspaceTab = {
  key: "daily" | "weekly" | "quarter" | "annual-plan" | "annual-review" | "portfolio" | "legal" | "reports" | "records" | "tools";
  label: string;
  eyebrow: string;
  headline: string;
  description: string;
};

type DraftCard = {
  title: string;
  minutes: number;
  subjects: string[];
  legalTags: string[];
  skills: string[];
};

type WeeklyReviewData = {
  totalApprovedLearningTime: number;
  activitiesLogged: number;
  daysLogged: number;
  artifactsSaved: number;
  activitiesNeedingReview?: number;
  subjectTimeSummary: Record<string, number>;
  legalCoverageSummary: string[];
  skillsTouchedThisWeek: string[];
  parentWeeklySummary: string;
  overallWeeklyRating: string;
  portfolioSelections: string[];
  nextWeekFocus: string;
  studentFavorite: string;
  studentHardest: string;
  studentProudest: string;
  studentQuestion: string;
  studentRating: string;
  studentDictation: string;
  unitStudy?: string;
};

type QuarterPortfolioCandidate = {
  id: string;
  originalName: string;
  mimeType: string;
  activityTitle: string;
  activityDate: string;
};

type QuarterUnitSummary = {
  title: string;
  minutes: number;
  activities: number;
  status: string;
};

type QuarterReviewData = {
  totalApprovedLearningTime: number;
  daysWithRecords: number;
  activitiesLogged: number;
  weeklyReviewsLogged: number;
  activitiesNeedingReview: number;
  subjectTimeSummary: Record<string, number>;
  legalCoverageSummary: string[];
  skillsAcrossQuarter: string[];
  portfolioSelections: string[];
  portfolioCandidates: QuarterPortfolioCandidate[];
  activeUnits: QuarterUnitSummary[];
  studentLearned: string;
  studentProud: string;
  studentHard: string;
  studentNext: string;
  studentRating: string;
  overallQuarterRating: string;
  improvedMost: string;
  needsReview: string;
  nextQuarterPriorities: string;
};

type QuarterSkillTrendRow = {
  skill: string;
  evidence: string;
  trend: string;
  parentNote: string;
  isExample: boolean;
};

type CurriculumSpine = {
  id: string;
  title: string;
  narrative: string;
};

type WeeklyRhythmDay = {
  id: string;
  title: string;
  narrative: string;
};

type JournalPortfolioCard = {
  id: string;
  title: string;
  narrative: string;
};

type AnnualPlanSectionId = "section-1" | "section-2" | "section-3" | "section-4" | "section-5" | "section-6" | "section-7" | "section-8";

type UnitPlanStatus = "active" | "upcoming" | "planned" | "complete" | "skipped";

type UnitPlanRow = {
  id: string;
  title: string;
  weeks: string;
  guidingQuestion: string;
  primaryCompetency: string;
  formatType: string;
  weeklyRhythmOverride: string;
  publishedSequence: string;
  parentDesigned: string;
  fieldTrip: string;
  finalFridayCapstone: string;
  status: UnitPlanStatus;
};

const activityTypes = [
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
];

const legalCoverage = [
  ["Reading", "Covered"],
  ["Spelling", "Light"],
  ["Grammar", "Covered"],
  ["Mathematics", "Needs review"],
  ["Good Citizenship", "Light"],
  ["Visual Curriculum", "Covered"],
  ["Bona Fide Instruction", "Covered"]
];

const proofOptions = ["Upload photo", "Upload file", "Skip proof for now"];
const weeklyRatings = ["Not Observed", "Introduced", "Developing", "Practicing", "Proficient", "Mastery"];
const studentRatings = [
  "I am just starting",
  "I am getting better",
  "I can do this with help",
  "I can do this by myself",
  "I can teach or explain this"
];

const initialCurriculumSpines: CurriculumSpine[] = [
  {
    id: "literacy-spine",
    title: "Literacy Spine",
    narrative: "4x/week - Story Weavers Level 2 - reading, grammar, literature, memory work, phonics, spelling, writing, editing, fluency."
  },
  {
    id: "math-spine",
    title: "Math Spine",
    narrative: "4x/week - Saxon Math 2 - number sense, operations, measurement, money, geometry, data, patterns, problem solving."
  },
  {
    id: "finance-spine",
    title: "Finance Spine",
    narrative: "4x/week or integrated weekly - Financial Literacy for Kids, Educa Fun, money activity book/game."
  },
  {
    id: "science-journal",
    title: "Daily Science Journal / Nature Observation",
    narrative: "Daily or near-daily - observe, draw, label, ask questions, record changes, compare patterns."
  },
  {
    id: "independent-reading",
    title: "Daily Independent Reading",
    narrative: "Daily - reading stamina, fluency, independent book engagement, habit formation, and enjoyment of books."
  },
  {
    id: "physical-activity",
    title: "Daily Physical Activity / Education",
    narrative: "Daily - movement, coordination, outdoor play, strength, stamina, health habits, and physical development."
  }
];

const initialWeeklyRhythmDays: WeeklyRhythmDay[] = [
  {
    id: "question-monday",
    title: "Question Monday",
    narrative: "Introduce weekly question, science topic, writing topic, and project direction. Evidence: discussion note, first sketch, prompt draft."
  },
  {
    id: "exploration-tuesday",
    title: "Exploration Tuesday",
    narrative: "Hands-on exploration, nature, music, observation, experimentation, and continued core work. Evidence: journal page, photo, experiment note."
  },
  {
    id: "context-wednesday",
    title: "Context Wednesday",
    narrative: "History, geography, maps, biographies, timelines, unit reading, and continued core work. Evidence: map, timeline, narration."
  },
  {
    id: "meaning-thursday",
    title: "Meaning Thursday",
    narrative: "Citizenship, philosophy, emotional intelligence, responsibility, service, communication, social studies, and project work. Evidence: reflection, discussion note."
  },
  {
    id: "creating-friday",
    title: "Creating Friday",
    narrative: "Finalize writing, present, complete project, art, science experiment, portfolio artifact, reflection, optional notable person review or Thinker Toy."
  },
  {
    id: "final-friday-summary",
    title: "Final Friday Summary",
    narrative: "Unit capstone: present the final project, explain learning, and select proof-of-learning artifacts."
  }
];

const initialJournalPortfolioCards: JournalPortfolioCard[] = [
  {
    id: "observation-journal",
    title: "Observation Journal",
    narrative: "Daily or near-daily - nature observations, drawings, labels, questions, and pattern tracking."
  },
  {
    id: "unit-lap-books",
    title: "Unit Lap Books",
    narrative: "Each unit - organize narrations, maps, minibooks, vocabulary, and project artifacts."
  },
  {
    id: "writing-portfolio",
    title: "Writing Portfolio",
    narrative: "Weekly - keep prompts, narrations, edited work, and final Friday writing."
  },
  {
    id: "project-portfolio",
    title: "Project Portfolio",
    narrative: "Weekly/unit - preserve photos, plans, presentation notes, and finished products."
  },
  {
    id: "adventure-guide",
    title: "Adventure Guide",
    narrative: "Year-end - binder of outdoor field-study tools, safety, maps, recipes, and nature pages."
  }
];

const unitFormatOptions = ["Harbor & Sprout Template", "Open-and-Go Published Unit", "Minimal Structure / Parent-Designed"];
const weeklyRhythmOverrideOptions = ["Use full rhythm", "None", "Light overlay", "Use Thursday heavily", "Finance daily", "Cooking Friday", "Context Wednesday focus", "Meaning Thursday focus", "Creating Friday capstone"];
const unitStatusOptions: UnitPlanStatus[] = ["active", "upcoming", "planned", "complete", "skipped"];

const annualPlanSections: { id: AnnualPlanSectionId; label: string; summary: string }[] = [
  { id: "section-1", label: "Section 1", summary: "Big Picture Framework" },
  { id: "section-2", label: "Section 2", summary: "Curriculum Spines" },
  { id: "section-3", label: "Section 3", summary: "Weekly Rhythm" },
  { id: "section-4", label: "Section 4", summary: "Unit Studies" },
  { id: "section-5", label: "Section 5", summary: "Year-End Capstone" },
  { id: "section-6", label: "Section 6", summary: "Journals and Portfolios" },
  { id: "section-7", label: "Section 7", summary: "Annual Records" },
  { id: "section-8", label: "Section 8", summary: "Exports" }
];

const initialUnitPlanRows: UnitPlanRow[] = [
  {
    id: "construction",
    title: "Construction",
    weeks: "3",
    guidingQuestion: "How do people build safe structures?",
    primaryCompetency: "Design and problem solving",
    formatType: "Minimal Structure / Parent-Designed",
    weeklyRhythmOverride: "Use full rhythm",
    publishedSequence: "No",
    parentDesigned: "Yes",
    fieldTrip: "Visit a build site or hardware store",
    finalFridayCapstone: "Build and explain a model frame",
    status: "active"
  },
  {
    id: "all-about-me",
    title: "All About Me",
    weeks: "2",
    guidingQuestion: "Who am I in my family and community?",
    primaryCompetency: "Identity and self-awareness",
    formatType: "Harbor & Sprout Template",
    weeklyRhythmOverride: "None",
    publishedSequence: "No",
    parentDesigned: "Partial",
    fieldTrip: "Family interview",
    finalFridayCapstone: "Identity lap book",
    status: "upcoming"
  },
  {
    id: "off-the-land",
    title: "Off the Land",
    weeks: "3",
    guidingQuestion: "How do people use land responsibly?",
    primaryCompetency: "Self-sufficiency",
    formatType: "Open-and-Go Published Unit",
    weeklyRhythmOverride: "Light overlay",
    publishedSequence: "Yes",
    parentDesigned: "No",
    fieldTrip: "Farm or garden visit",
    finalFridayCapstone: "Food source presentation",
    status: "planned"
  },
  {
    id: "gratitude-and-thanksgiving",
    title: "Gratitude and Thanksgiving",
    weeks: "2",
    guidingQuestion: "How do gratitude and service shape community?",
    primaryCompetency: "Character and relationships",
    formatType: "Minimal Structure / Parent-Designed",
    weeklyRhythmOverride: "Use Thursday heavily",
    publishedSequence: "No",
    parentDesigned: "Yes",
    fieldTrip: "Service project",
    finalFridayCapstone: "Thankfulness presentation",
    status: "planned"
  },
  {
    id: "all-about-money",
    title: "All About Money",
    weeks: "3",
    guidingQuestion: "How do people earn, save, spend, and give?",
    primaryCompetency: "Financial literacy",
    formatType: "Minimal Structure / Parent-Designed",
    weeklyRhythmOverride: "Finance daily",
    publishedSequence: "No",
    parentDesigned: "Yes",
    fieldTrip: "Store comparison shopping",
    finalFridayCapstone: "Budget board game",
    status: "planned"
  },
  {
    id: "lets-cook",
    title: "Let's Cook!",
    weeks: "3",
    guidingQuestion: "How does cooking use science and life skills?",
    primaryCompetency: "Life skills and chemistry",
    formatType: "Open-and-Go Published Unit",
    weeklyRhythmOverride: "Cooking Friday",
    publishedSequence: "Yes",
    parentDesigned: "Partial",
    fieldTrip: "Cook a family meal",
    finalFridayCapstone: "Recipe book",
    status: "planned"
  },
  {
    id: "human-body",
    title: "Human Body",
    weeks: "3",
    guidingQuestion: "How does my body work?",
    primaryCompetency: "Health literacy",
    formatType: "Harbor & Sprout Template",
    weeklyRhythmOverride: "None",
    publishedSequence: "No",
    parentDesigned: "Partial",
    fieldTrip: "Health habit tracker",
    finalFridayCapstone: "Body systems display",
    status: "planned"
  },
  {
    id: "community-helpers",
    title: "Community Helpers",
    weeks: "2",
    guidingQuestion: "Who helps a community work?",
    primaryCompetency: "Civic understanding",
    formatType: "Minimal Structure / Parent-Designed",
    weeklyRhythmOverride: "Meaning Thursday focus",
    publishedSequence: "No",
    parentDesigned: "Yes",
    fieldTrip: "Interview a helper",
    finalFridayCapstone: "Helper presentation",
    status: "planned"
  },
  {
    id: "world-cultures-and-traditions",
    title: "World Cultures and Traditions",
    weeks: "3",
    guidingQuestion: "How do people celebrate and remember?",
    primaryCompetency: "Cultural awareness",
    formatType: "Open-and-Go Published Unit",
    weeklyRhythmOverride: "Light overlay",
    publishedSequence: "Yes",
    parentDesigned: "No",
    fieldTrip: "Cultural food or event",
    finalFridayCapstone: "Culture display",
    status: "planned"
  },
  {
    id: "50-states",
    title: "50 States",
    weeks: "3",
    guidingQuestion: "How do places shape people?",
    primaryCompetency: "Geographic literacy",
    formatType: "Minimal Structure / Parent-Designed",
    weeklyRhythmOverride: "Context Wednesday focus",
    publishedSequence: "No",
    parentDesigned: "Yes",
    fieldTrip: "Map practice trip",
    finalFridayCapstone: "State map portfolio",
    status: "planned"
  },
  {
    id: "transportation",
    title: "Transportation",
    weeks: "2",
    guidingQuestion: "How do people and goods move?",
    primaryCompetency: "Systems and movement",
    formatType: "Harbor & Sprout Template",
    weeklyRhythmOverride: "None",
    publishedSequence: "No",
    parentDesigned: "Partial",
    fieldTrip: "Transit observation",
    finalFridayCapstone: "Transportation model",
    status: "planned"
  },
  {
    id: "outdoor-adventure-and-stewardship",
    title: "Outdoor Adventure and Stewardship",
    weeks: "2",
    guidingQuestion: "How do we explore responsibly?",
    primaryCompetency: "Outdoor competence",
    formatType: "Minimal Structure / Parent-Designed",
    weeklyRhythmOverride: "Creating Friday capstone",
    publishedSequence: "No",
    parentDesigned: "Yes",
    fieldTrip: "Camping/outdoor field studies",
    finalFridayCapstone: "Adventure Guide",
    status: "planned"
  }
];

const workspaceTabs: WorkspaceTab[] = [
  {
    key: "daily",
    label: "Daily Records",
    eyebrow: "Narration-first daily logging",
    headline: "Log learning from narration",
    description: "Pick an activity, add minutes, narrate what happened, then save. Details stay available without crowding the daily workflow."
  },
  {
    key: "weekly",
    label: "Weekly Reviews",
    eyebrow: "Weekly review",
    headline: "Review weekly learning coverage",
    description: "Check approved learning time by subject before weekly review workflows are expanded."
  },
  {
    key: "quarter",
    label: "Quarter Reviews",
    eyebrow: "Quarter review",
    headline: "Track quarter review readiness",
    description: "See review alerts and compliance reminders without changing daily records."
  },
  {
    key: "annual-plan",
    label: "Annual Plan",
    eyebrow: "Annual plan",
    headline: "Plan the school-year framework",
    description: "Document intent, spines, weekly rhythm, unit-study arc, journals, capstones, and annual records."
  },
  {
    key: "annual-review",
    label: "Annual Review",
    eyebrow: "Annual review",
    headline: "Close out the school year",
    description: "Summarize the year, preserve archive status, and keep annual closeout separate from the planning framework."
  },
  {
    key: "portfolio",
    label: "Portfolio",
    eyebrow: "Proof archive",
    headline: "Browse proof files",
    description: "Use a folder tree and list view to find uploaded proof files and download them from storage."
  },
  {
    key: "legal",
    label: "Legal Archive",
    eyebrow: "Legal archive",
    headline: "Review legal coverage",
    description: "Keep legal tags visible as distinct record metadata, separate from subjects and skills."
  },
  {
    key: "reports",
    label: "Reports",
    eyebrow: "Reports",
    headline: "Prepare report sources",
    description: "Review the skill taxonomy and report source data before report exports are built out."
  },
  {
    key: "records",
    label: "Records & Snapshots",
    eyebrow: "Records and snapshots",
    headline: "Retrieve units and generated records",
    description: "Use database records as the source of truth and generate readable Markdown snapshots for archives."
  },
  {
    key: "tools",
    label: "Workspace Tools",
    eyebrow: "Workspace tools",
    headline: "Coverage and report tools",
    description: "The supporting panels that used to sit in the right column are grouped here."
  }
];

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function mondayForIsoDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inferSubject(activityType: string) {
  if (activityType === "Language Arts" || activityType === "Writing Project" || activityType === "Presentation Cycle") return "Language Arts";
  if (activityType === "Math") return "Math";
  if (activityType === "Finance") return "Finance";
  if (activityType === "Science Journal") return "Science";
  if (activityType === "Field Trip" || activityType === "Group Event") return "Social Studies";
  return "Unit Study";
}

function legalTagSuggestions(activityType: string, subject: string) {
  const tags = new Set<string>(["Bona Fide Instruction"]);
  const combined = `${activityType} ${subject}`.toLowerCase();
  if (combined.includes("language") || combined.includes("reading") || combined.includes("literature")) tags.add("Reading");
  if (combined.includes("spelling")) tags.add("Spelling");
  if (combined.includes("grammar") || combined.includes("writing")) tags.add("Grammar");
  if (combined.includes("math") || combined.includes("finance") || combined.includes("money")) tags.add("Mathematics");
  if (combined.includes("citizenship") || combined.includes("social") || combined.includes("group")) tags.add("Good Citizenship");
  if (combined.includes("visual") || combined.includes("presentation") || combined.includes("journal") || combined.includes("field")) tags.add("Visual Curriculum");
  return Array.from(tags);
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dateLabel(value: string) {
  return value.slice(0, 10);
}

function mockDrafts(activityType: string): DraftCard[] {
  return [
    {
      title: activityType === "Language Arts" ? "Story Weaver read-aloud and editing" : `${activityType} narration record`,
      minutes: 25,
      subjects: activityType === "Math" ? ["Math"] : ["Language Arts"],
      legalTags: activityType === "Math" ? ["Mathematics", "Visual Curriculum", "Bona Fide Instruction"] : ["Reading", "Grammar", "Spelling"],
      skills: activityType === "Math" ? ["Measurement and Money", "Mathematical Communication"] : ["Reading", "Fluency", "Editing"]
    },
    {
      title: "Construction unit connection",
      minutes: 20,
      subjects: ["Science", "Unit Study"],
      legalTags: ["Visual Curriculum", "Bona Fide Instruction"],
      skills: ["Uses Tools and Models", "Problem-Solving and Application"]
    }
  ];
}

export default function Home() {
  const [student, setStudent] = useState("Bennett");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [schoolYearStatus, setSchoolYearStatus] = useState("trial");
  const [officialStartDate, setOfficialStartDate] = useState("2027-05-01");
  const [unitStudy, setUnitStudy] = useState("Construction");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedType, setSelectedType] = useState("Language Arts");
  const [title, setTitle] = useState("");
  const [actualMinutes, setActualMinutes] = useState(25);
  const [narration, setNarration] = useState(
    "Today we completed chapter 1 of Story Weaver Level 1 Book 1. He read aloud, practiced spelling words, edited capitalization, and helped measure boards for the Construction unit."
  );
  const [selectedProof, setSelectedProof] = useState<string[]>(["Upload photo"]);
  const [uploadedArtifacts, setUploadedArtifacts] = useState<UploadedArtifact[]>([]);
  const [savedActivities, setSavedActivities] = useState<SavedActivity[]>([]);
  const [portfolioArtifacts, setPortfolioArtifacts] = useState<PortfolioArtifact[]>([]);
  const [selectedPortfolioKey, setSelectedPortfolioKey] = useState("all");
  const [activeTab, setActiveTab] = useState<WorkspaceTab["key"]>("daily");
  const [weeklyReviewId, setWeeklyReviewId] = useState("");
  const [weeklyStartDate, setWeeklyStartDate] = useState(mondayForIsoDate(todayIso()));
  const [weeklyStatus, setWeeklyStatus] = useState<"draft" | "finalized" | "amended">("draft");
  const [weeklyData, setWeeklyData] = useState<WeeklyReviewData>({
    totalApprovedLearningTime: 0,
    activitiesLogged: 0,
    daysLogged: 0,
    artifactsSaved: 0,
    activitiesNeedingReview: 0,
    subjectTimeSummary: {},
    legalCoverageSummary: [],
    skillsTouchedThisWeek: [],
    parentWeeklySummary: "",
    overallWeeklyRating: "Not Observed",
    portfolioSelections: [],
    nextWeekFocus: "",
    studentFavorite: "",
    studentHardest: "",
    studentProudest: "",
    studentQuestion: "",
    studentRating: "I can do this with help",
    studentDictation: ""
  });
  const [weeklyStatusMessage, setWeeklyStatusMessage] = useState("Waiting to generate a draft review from approved activity logs.");
  const [lastWeeklyPdfArtifact, setLastWeeklyPdfArtifact] = useState<WeeklyPdfArtifact | null>(null);
  const [isWeeklyBusy, setIsWeeklyBusy] = useState(false);
  const [quarterReviewId, setQuarterReviewId] = useState("");
  const [quarterLabel, setQuarterLabel] = useState("Quarter 1");
  const [quarterStartDate, setQuarterStartDate] = useState("2026-07-01");
  const [quarterDueDate, setQuarterDueDate] = useState(addDaysIso("2026-07-01", 62));
  const [quarterStatus, setQuarterStatus] = useState<"draft" | "finalized" | "amended">("draft");
  const [quarterStatusMessage, setQuarterStatusMessage] = useState("Waiting to generate a draft quarter review from daily logs and weekly reviews.");
  const [isQuarterBusy, setIsQuarterBusy] = useState(false);
  const [lastQuarterPdfArtifact, setLastQuarterPdfArtifact] = useState<WeeklyPdfArtifact | null>(null);
  const [quarterData, setQuarterData] = useState<QuarterReviewData>({
    totalApprovedLearningTime: 0,
    daysWithRecords: 0,
    activitiesLogged: 0,
    weeklyReviewsLogged: 0,
    activitiesNeedingReview: 0,
    subjectTimeSummary: {},
    legalCoverageSummary: [],
    skillsAcrossQuarter: [],
    portfolioSelections: [],
    portfolioCandidates: [],
    activeUnits: [],
    studentLearned: "",
    studentProud: "",
    studentHard: "",
    studentNext: "",
    studentRating: "I can do this with help",
    overallQuarterRating: "Not Observed",
    improvedMost: "",
    needsReview: "",
    nextQuarterPriorities: ""
  });
  const [draftCards, setDraftCards] = useState<DraftCard[]>([]);
  const [status, setStatus] = useState("Ready to parse the current entry.");
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [annualPlanStatus, setAnnualPlanStatus] = useState<"draft" | "active" | "finalized" | "archived">("active");
  const [annualPlanMessage, setAnnualPlanMessage] = useState("Annual Plan is active. It can be exported to records/2026-2027/annual-plan.md and PDF.");
  const [recordsSnapshotMessage, setRecordsSnapshotMessage] = useState("Waiting for generated snapshots. Database records remain the source of truth.");
  const [curriculumSpines, setCurriculumSpines] = useState<CurriculumSpine[]>(initialCurriculumSpines);
  const [editingSpineId, setEditingSpineId] = useState<string | null>(null);
  const [weeklyRhythmDays, setWeeklyRhythmDays] = useState<WeeklyRhythmDay[]>(initialWeeklyRhythmDays);
  const [editingRhythmDayId, setEditingRhythmDayId] = useState<string | null>(null);
  const [unitPlanRows, setUnitPlanRows] = useState<UnitPlanRow[]>(initialUnitPlanRows);
  const [journalPortfolioCards, setJournalPortfolioCards] = useState<JournalPortfolioCard[]>(initialJournalPortfolioCards);
  const [editingJournalPortfolioId, setEditingJournalPortfolioId] = useState<string | null>(null);
  const [activeAnnualPlanSection, setActiveAnnualPlanSection] = useState<AnnualPlanSectionId | null>(null);
  const [finalizedAnnualPlanSections, setFinalizedAnnualPlanSections] = useState<AnnualPlanSectionId[]>([]);

  const primarySubject = useMemo(() => inferSubject(selectedType), [selectedType]);
  const [legalTags, setLegalTags] = useState<string[]>(legalTagSuggestions("Language Arts", "Language Arts"));

  const canParse = useMemo(
    () => Boolean(student && schoolYear && unitStudy && selectedDate && selectedType && narration.trim()),
    [narration, schoolYear, selectedDate, selectedType, student, unitStudy]
  );

  const canSaveApproved = Boolean(student && schoolYear && unitStudy && selectedDate && selectedType && narration.trim() && actualMinutes > 0);

  useEffect(() => {
    setLegalTags(legalTagSuggestions(selectedType, inferSubject(selectedType)));
  }, [selectedType]);

  const loadSavedActivities = useCallback(async (date: string) => {
    setIsLoadingRecords(true);
    try {
      const response = await fetch(`/api/activities?date=${date}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load saved activities.");
      setSavedActivities(data.activities ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load saved activities.");
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  const loadPortfolio = useCallback(async () => {
    setIsLoadingPortfolio(true);
    try {
      const response = await fetch("/api/artifacts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load proof files.");
      setPortfolioArtifacts(data.artifacts ?? []);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load proof files.");
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, []);

  useEffect(() => {
    void loadSavedActivities(selectedDate);
  }, [loadSavedActivities, selectedDate]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  function selectActivityType(type: string) {
    setSelectedType(type);
  }

  function buttonState(type: string) {
    if (type === selectedType) return "selected";
    const matching = savedActivities.filter((activity) => activity.activityType === type);
    const hasApproved = matching.some((activity) => activity.parentApproved);
    if (hasApproved) return "completed";
    const hasNeedsReview = matching.some((activity) => !activity.parentApproved || activity.reviewStatus === "needs_review");
    if (hasNeedsReview) return "needs-review";
    return "neutral";
  }

  function toggleProof(label: string) {
    if (label === "Skip proof for now") {
      setSelectedProof(["Skip proof for now"]);
      return;
    }

    setSelectedProof((current) => {
      const withoutSkip = current.filter((item) => item !== "Skip proof for now");
      return withoutSkip.includes(label) ? withoutSkip.filter((item) => item !== label) : [...withoutSkip, label];
    });
  }

  function toggleLegalTag(tag: string) {
    setLegalTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  function activityPayload(parentApproved: boolean) {
    return {
      title: title.trim() || `${selectedType} - ${selectedDate}`,
      date: selectedDate,
      actualMinutes,
      activityType: selectedType,
      narration,
      studentName: student,
      schoolYearLabel: schoolYear,
      schoolYearStatus,
      officialHomeschoolStartDate: officialStartDate,
      unitTitle: unitStudy,
      parentApproved,
      subjectAllocations: [{ subject: primarySubject, minutes: actualMinutes }],
      legalTags,
      skills: [],
      artifactIds: uploadedArtifacts.map((artifact) => artifact.id)
    };
  }

  async function saveActivity(parentApproved: boolean) {
    if (!narration.trim()) {
      setStatus("Narration is required before saving a draft or approved activity.");
      return;
    }
    if (parentApproved && !canSaveApproved) {
      setStatus("Approved save requires student, school year, unit, date, type, narration, and actual minutes.");
      return;
    }

    setIsSaving(true);
    setStatus(parentApproved ? "Saving approved activity to the database..." : "Saving draft activity to the database...");
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityPayload(parentApproved))
      });
      const data = await response.json().catch(() => ({ error: "Activity save failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Activity save failed.");
      await loadSavedActivities(selectedDate);
      await loadPortfolio();
      setStatus(
        parentApproved
          ? `Approved activity saved with ${uploadedArtifacts.length} proof item${uploadedArtifacts.length === 1 ? "" : "s"}. ${selectedType} will show green for ${selectedDate}.`
          : `Draft saved with ${uploadedArtifacts.length} proof item${uploadedArtifacts.length === 1 ? "" : "s"}. ${selectedType} will show yellow for ${selectedDate} unless an approved record also exists.`
      );
      setUploadedArtifacts([]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Activity save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  function saveDraft() {
    void saveActivity(false);
  }

  function clearEntry() {
    setNarration("");
    setSelectedProof([]);
    setUploadedArtifacts([]);
    setDraftCards([]);
    setStatus("Narration and proof selection cleared. Student, school year, unit, date, and activity type were preserved.");
  }

  async function uploadProofFile(file: File) {
    setIsUploadingProof(true);
    setStatus(`Uploading ${file.name} to proof storage...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recordStatus", schoolYearStatus);
      formData.append("tagsJson", JSON.stringify({ activityType: selectedType, unitStudy }));

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({ error: "Proof upload failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Proof upload failed.");

      setUploadedArtifacts((current) => [...current, data.artifact]);
      setSelectedProof((current) => {
        const withoutSkip = current.filter((item) => item !== "Skip proof for now");
        return withoutSkip.includes("Uploaded file") ? withoutSkip : [...withoutSkip, "Uploaded file"];
      });
      setStatus(`${file.name} uploaded. It will attach to the activity when you save.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Proof upload failed.");
    } finally {
      setIsUploadingProof(false);
    }
  }

  function handleProofUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void uploadProofFile(file);
    }
    event.target.value = "";
  }

  function parseWithAi() {
    const drafts = mockDrafts(selectedType);
    setDraftCards(drafts);
    setStatus("Mock AI parse complete. Review the editable-looking cards below before saving in a later backend step.");
  }

  function updateWeeklyData<K extends keyof WeeklyReviewData>(key: K, value: WeeklyReviewData[K]) {
    setWeeklyData((current) => ({ ...current, [key]: value }));
  }

  function updateQuarterData<K extends keyof QuarterReviewData>(key: K, value: QuarterReviewData[K]) {
    setQuarterData((current) => ({ ...current, [key]: value }));
  }

  function updateAnnualPlan(message: string, statusValue?: "draft" | "active" | "finalized" | "archived") {
    if (statusValue) setAnnualPlanStatus(statusValue);
    setAnnualPlanMessage(message);
  }

  function finalizeAnnualPlanSection(id: AnnualPlanSectionId) {
    const section = annualPlanSections.find((item) => item.id === id);
    setFinalizedAnnualPlanSections((current) => (current.includes(id) ? current : [...current, id]));
    setAnnualPlanMessage(`${section?.summary ?? "Annual Plan section"} finalized. Its landing button is now green.`);
  }

  function updateCurriculumSpine(id: string, key: "title" | "narrative", value: string) {
    setCurriculumSpines((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function addCurriculumSpine() {
    const id = `curriculum-spine-${Date.now()}`;
    setCurriculumSpines((current) => [
      ...current,
      {
        id,
        title: "New Curriculum Spine",
        narrative: "Describe the recurring expectation, schedule, curriculum resource, skills practiced, and evidence to keep."
      }
    ]);
    setEditingSpineId(id);
  }

  function deleteCurriculumSpine(id: string) {
    setCurriculumSpines((current) => current.filter((item) => item.id !== id));
    setEditingSpineId((current) => (current === id ? null : current));
  }

  function moveCurriculumSpine(id: string, direction: -1 | 1) {
    setCurriculumSpines((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  function updateWeeklyRhythmDay(id: string, key: "title" | "narrative", value: string) {
    setWeeklyRhythmDays((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function addWeeklyRhythmDay() {
    const id = `weekly-rhythm-${Date.now()}`;
    setWeeklyRhythmDays((current) => [
      ...current,
      {
        id,
        title: "New Rhythm Day",
        narrative: "Describe the day, expected learning pattern, and evidence to keep."
      }
    ]);
    setEditingRhythmDayId(id);
  }

  function deleteWeeklyRhythmDay(id: string) {
    setWeeklyRhythmDays((current) => current.filter((item) => item.id !== id));
    setEditingRhythmDayId((current) => (current === id ? null : current));
  }

  function moveWeeklyRhythmDay(id: string, direction: -1 | 1) {
    setWeeklyRhythmDays((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  function updateUnitPlanRow<K extends keyof UnitPlanRow>(id: string, key: K, value: UnitPlanRow[K]) {
    setUnitPlanRows((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function moveUnitPlanRowTo(id: string, position: number) {
    setUnitPlanRows((current) => {
      const currentIndex = current.findIndex((item) => item.id === id);
      if (currentIndex < 0) return current;
      const boundedIndex = Math.min(Math.max(position - 1, 0), current.length - 1);
      const copy = [...current];
      const [row] = copy.splice(currentIndex, 1);
      copy.splice(boundedIndex, 0, row);
      return copy;
    });
  }

  function addUnitPlanRow() {
    setUnitPlanRows((current) => [
      ...current,
      {
        id: `unit-plan-${Date.now()}`,
        title: "New Unit Study",
        weeks: "1",
        guidingQuestion: "What question will guide this unit?",
        primaryCompetency: "Core competency",
        formatType: "Minimal Structure / Parent-Designed",
        weeklyRhythmOverride: "Use full rhythm",
        publishedSequence: "No",
        parentDesigned: "Yes",
        fieldTrip: "Application or field trip",
        finalFridayCapstone: "Final Friday capstone",
        status: "upcoming"
      }
    ]);
  }

  function deleteUnitPlanRow(id: string) {
    setUnitPlanRows((current) => current.filter((item) => item.id !== id));
  }

  function updateJournalPortfolioCard(id: string, key: "title" | "narrative", value: string) {
    setJournalPortfolioCards((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function addJournalPortfolioCard() {
    const id = `journal-portfolio-${Date.now()}`;
    setJournalPortfolioCards((current) => [
      ...current,
      {
        id,
        title: "New Journal or Portfolio",
        narrative: "Describe what belongs here, how often it should be updated, and what evidence it should contain."
      }
    ]);
    setEditingJournalPortfolioId(id);
  }

  function deleteJournalPortfolioCard(id: string) {
    setJournalPortfolioCards((current) => current.filter((item) => item.id !== id));
    setEditingJournalPortfolioId((current) => (current === id ? null : current));
  }

  function moveJournalPortfolioCard(id: string, direction: -1 | 1) {
    setJournalPortfolioCards((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  function handleQuarterStartChange(value: string) {
    setQuarterStartDate(value);
    setQuarterDueDate(addDaysIso(value, 62));
  }

  function quarterAlertStatus() {
    if (quarterStatus === "finalized") {
      return {
        label: "Complete",
        title: `${quarterLabel} review finalized`,
        summary: "The quarter review is finalized. Daily records remain unchanged and retrievable."
      };
    }

    const today = todayIso();
    const due = quarterDueDate.slice(0, 10);
    const daysUntilDue = Math.round((new Date(`${due}T00:00:00.000Z`).getTime() - new Date(`${today}T00:00:00.000Z`).getTime()) / 86400000);

    if (daysUntilDue < 0) {
      return {
        label: "Overdue",
        title: `${quarterLabel} review overdue`,
        summary: `${quarterLabel} review is overdue. This alert flags review work only; saved records are not changed.`
      };
    }
    if (daysUntilDue === 0) {
      return {
        label: "Due-day reminder",
        title: `${quarterLabel} review due today`,
        summary: `${quarterLabel} review is due today. Finalizing changes this alert to complete.`
      };
    }
    if (daysUntilDue <= 3) {
      return {
        label: "3-day reminder",
        title: `${quarterLabel} review due soon`,
        summary: `${quarterLabel} review is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}. Alerts flag review work only.`
      };
    }
    return {
      label: "No reminder",
      title: `${quarterLabel} review scheduled`,
      summary: `${quarterLabel} review is not due within the 3-day reminder window.`
    };
  }

  async function generateWeeklyReview() {
    setIsWeeklyBusy(true);
    setWeeklyStatusMessage("Generating weekly review draft from approved logs...");
    setLastWeeklyPdfArtifact(null);
    try {
      const response = await fetch("/api/reviews/weekly/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolYearLabel: schoolYear, weekStartDate: weeklyStartDate, recordStatus: schoolYearStatus })
      });
      const data = await response.json().catch(() => ({ error: "Weekly review generation failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Weekly review generation failed.");
      setWeeklyReviewId(data.review.id);
      setWeeklyStatus(data.review.status);
      setWeeklyData((current) => ({
        ...current,
        ...data.data,
        activitiesNeedingReview: data.data.activitiesNeedingReview ?? 0,
        parentWeeklySummary:
          data.data.parentWeeklySummary ||
          "Draft generated from approved logs. Add the parent summary before finalizing this weekly review.",
        nextWeekFocus: data.data.nextWeekFocus || "Add the next focus after reviewing subject coverage and portfolio highlights.",
        studentFavorite: current.studentFavorite || "Building the frame",
        studentHardest: current.studentHardest || "Reading the tape measure",
        studentProudest: current.studentProudest || "Story Weaver narration",
        studentQuestion: current.studentQuestion || "How do builders make corners square?",
        studentRating: current.studentRating || "I can do this with help",
        studentDictation: current.studentDictation || "I liked using the tools and explaining what I made."
      }));
      setWeeklyStatusMessage("Draft generated from approved daily logs. Review, edit, save, finalize, or compile a PDF.");
    } catch (error) {
      setWeeklyStatusMessage(error instanceof Error ? error.message : "Weekly review generation failed.");
    } finally {
      setIsWeeklyBusy(false);
    }
  }

  async function saveWeeklyReview(statusValue: "draft" | "finalized" | "amended") {
    if (!weeklyReviewId) {
      setWeeklyStatusMessage("Generate the weekly review before saving.");
      return;
    }

    setIsWeeklyBusy(true);
    setWeeklyStatusMessage(statusValue === "finalized" ? "Finalizing weekly review..." : "Saving weekly review draft...");
    try {
      const response = await fetch("/api/reviews/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: weeklyReviewId, status: statusValue, data: { ...weeklyData, unitStudy }, recordStatus: schoolYearStatus })
      });
      const data = await response.json().catch(() => ({ error: "Weekly review save failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Weekly review save failed.");
      setWeeklyStatus(data.review.status);
      setWeeklyStatusMessage(
        statusValue === "finalized"
          ? "Weekly review finalized. You can now compile the PDF into the Portfolio."
          : "Weekly review draft saved."
      );
    } catch (error) {
      setWeeklyStatusMessage(error instanceof Error ? error.message : "Weekly review save failed.");
    } finally {
      setIsWeeklyBusy(false);
    }
  }

  async function compileWeeklyPdf() {
    if (!weeklyReviewId) {
      setWeeklyStatusMessage("Generate and save the weekly review before compiling a PDF.");
      return;
    }

    setIsWeeklyBusy(true);
    setWeeklyStatusMessage("Compiling weekly review PDF and saving it to Portfolio...");
    try {
      const saveResponse = await fetch("/api/reviews/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: weeklyReviewId, status: "finalized", data: { ...weeklyData, unitStudy }, recordStatus: schoolYearStatus })
      });
      const saveData = await saveResponse.json().catch(() => ({ error: "Weekly review save failed before the PDF was compiled." }));
      if (!saveResponse.ok) throw new Error(typeof saveData.error === "string" ? saveData.error : "Weekly review save failed before the PDF was compiled.");

      const response = await fetch("/api/reviews/weekly/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: weeklyReviewId })
      });
      const data = await response.json().catch(() => ({ error: "Weekly PDF generation failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Weekly PDF generation failed.");
      await loadPortfolio();
      setWeeklyStatus("finalized");
      setLastWeeklyPdfArtifact(data.artifact);
      setWeeklyStatusMessage(`${data.artifact.originalName} was saved to the Portfolio and is ready to open.`);
    } catch (error) {
      setWeeklyStatusMessage(error instanceof Error ? error.message : "Weekly PDF generation failed.");
    } finally {
      setIsWeeklyBusy(false);
    }
  }

  async function generateQuarterReview() {
    setIsQuarterBusy(true);
    setQuarterStatusMessage("Generating quarter review draft from the selected 9-week segment...");
    try {
      const response = await fetch("/api/reviews/quarter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolYearLabel: schoolYear,
          quarterLabel,
          quarterStartDate,
          reviewDueDate: quarterDueDate,
          recordStatus: schoolYearStatus
        })
      });
      const data = await response.json().catch(() => ({ error: "Quarter review generation failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Quarter review generation failed.");
      setQuarterReviewId(data.review.id);
      setQuarterStatus(data.review.status);
      setQuarterData((current) => ({
        ...current,
        ...data.data,
        studentLearned: data.data.studentLearned || current.studentLearned || "Add the student reflection after reviewing the quarter.",
        studentProud: data.data.studentProud || current.studentProud,
        studentHard: data.data.studentHard || current.studentHard,
        studentNext: data.data.studentNext || current.studentNext,
        improvedMost: data.data.improvedMost || current.improvedMost,
        needsReview: data.data.needsReview || current.needsReview,
        nextQuarterPriorities: data.data.nextQuarterPriorities || current.nextQuarterPriorities
      }));
      setQuarterStatusMessage("Draft quarter review generated from daily logs, weekly reviews, legal tags, units, skills, and portfolio evidence.");
    } catch (error) {
      setQuarterStatusMessage(error instanceof Error ? error.message : "Quarter review generation failed.");
    } finally {
      setIsQuarterBusy(false);
    }
  }

  async function saveQuarterReview(statusValue: "draft" | "finalized" | "amended") {
    if (!quarterReviewId) {
      setQuarterStatusMessage("Generate the quarter review before saving.");
      return;
    }

    setIsQuarterBusy(true);
    setQuarterStatusMessage(statusValue === "finalized" ? "Finalizing quarter review..." : "Saving quarter review draft...");
    try {
      const response = await fetch("/api/reviews/quarter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: quarterReviewId,
          status: statusValue,
          quarterStartDate,
          reviewDueDate: quarterDueDate,
          data: quarterData,
          recordStatus: schoolYearStatus
        })
      });
      const data = await response.json().catch(() => ({ error: "Quarter review save failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Quarter review save failed.");
      setQuarterStatus(data.review.status);
      setQuarterStatusMessage(
        statusValue === "finalized"
          ? "Quarter review finalized and saved. Annual review and annual plan remain separate workspaces."
          : "Quarter review draft saved."
      );
    } catch (error) {
      setQuarterStatusMessage(error instanceof Error ? error.message : "Quarter review save failed.");
    } finally {
      setIsQuarterBusy(false);
    }
  }

  async function compileQuarterPdf() {
    if (!quarterReviewId) {
      setQuarterStatusMessage("Generate and save the quarter review before compiling a PDF.");
      return;
    }

    setIsQuarterBusy(true);
    setQuarterStatusMessage("Compiling quarter review PDF and saving it to Portfolio...");
    try {
      const saveResponse = await fetch("/api/reviews/quarter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: quarterReviewId,
          status: "finalized",
          quarterStartDate,
          reviewDueDate: quarterDueDate,
          data: quarterData,
          recordStatus: schoolYearStatus
        })
      });
      const saveData = await saveResponse.json().catch(() => ({ error: "Quarter review save failed before the PDF was compiled." }));
      if (!saveResponse.ok) throw new Error(typeof saveData.error === "string" ? saveData.error : "Quarter review save failed before the PDF was compiled.");

      const response = await fetch("/api/reviews/quarter/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: quarterReviewId })
      });
      const data = await response.json().catch(() => ({ error: "Quarter PDF generation failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Quarter PDF generation failed.");
      await loadPortfolio();
      setQuarterStatus("finalized");
      setLastQuarterPdfArtifact(data.artifact);
      setQuarterStatusMessage(`${data.artifact.originalName} was saved to the Portfolio and is ready to open.`);
    } catch (error) {
      setQuarterStatusMessage(error instanceof Error ? error.message : "Quarter PDF generation failed.");
    } finally {
      setIsQuarterBusy(false);
    }
  }

  const subjectTallies = useMemo(() => {
    const totals = new Map<string, number>();
    savedActivities
      .filter((activity) => activity.parentApproved)
      .forEach((activity) => {
        activity.allocations.forEach((allocation) => {
          totals.set(allocation.subject, (totals.get(allocation.subject) ?? 0) + allocation.minutes);
        });
      });

    return ["Language Arts", "Math", "Finance", "Science", "Social Studies", "Unit Study"].map((subject) => [
      subject,
      formatMinutes(totals.get(subject) ?? 0)
    ]);
  }, [savedActivities]);

  const portfolioNodes = useMemo<PortfolioNode[]>(() => {
    const countBy = (getKey: (artifact: PortfolioArtifact) => string | null) => {
      const counts = new Map<string, number>();
      portfolioArtifacts.forEach((artifact) => {
        const key = getKey(artifact);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return counts;
    };

    const years = countBy((artifact) => artifact.activity?.schoolYear.label ?? null);
    const units = countBy((artifact) => artifact.activity?.unitStudy?.title ?? null);
    const subjects = countBy((artifact) => artifact.activity?.allocations[0]?.subject ?? null);
    const legalTags = countBy((artifact) => artifact.activity?.legalTags[0]?.legalTag.label ?? null);
    const unattachedCount = portfolioArtifacts.filter((artifact) => !artifact.activity).length;

    return [
      { key: "all", label: "All proof files", count: portfolioArtifacts.length, level: 0 },
      { key: "years", label: "School years", count: years.size, level: 0 },
      ...Array.from(years, ([label, count]) => ({ key: `year:${label}`, label, count, level: 1 })),
      { key: "units", label: "Unit studies", count: units.size, level: 0 },
      ...Array.from(units, ([label, count]) => ({ key: `unit:${label}`, label, count, level: 1 })),
      { key: "subjects", label: "Subjects", count: subjects.size, level: 0 },
      ...Array.from(subjects, ([label, count]) => ({ key: `subject:${label}`, label, count, level: 1 })),
      { key: "legal", label: "Legal tags", count: legalTags.size, level: 0 },
      ...Array.from(legalTags, ([label, count]) => ({ key: `legal:${label}`, label, count, level: 1 })),
      { key: "unattached", label: "Unattached uploads", count: unattachedCount, level: 0 }
    ];
  }, [portfolioArtifacts]);

  const selectedPortfolioArtifacts = useMemo(() => {
    if (selectedPortfolioKey === "all") return portfolioArtifacts;
    if (selectedPortfolioKey === "unattached") return portfolioArtifacts.filter((artifact) => !artifact.activity);
    if (!selectedPortfolioKey.includes(":")) return portfolioArtifacts;

    const [type, value] = selectedPortfolioKey.split(/:(.*)/s);
    return portfolioArtifacts.filter((artifact) => {
      if (type === "year") return artifact.activity?.schoolYear.label === value;
      if (type === "unit") return artifact.activity?.unitStudy?.title === value;
      if (type === "subject") return artifact.activity?.allocations.some((allocation) => allocation.subject === value);
      if (type === "legal") return artifact.activity?.legalTags.some((item) => item.legalTag.label === value);
      return true;
    });
  }, [portfolioArtifacts, selectedPortfolioKey]);

  const selectedPortfolioNode = portfolioNodes.find((node) => node.key === selectedPortfolioKey);
  const activeWorkspace = workspaceTabs.find((tab) => tab.key === activeTab) ?? workspaceTabs[0];
  const hasGeneratedWeeklySkills = weeklyData.skillsTouchedThisWeek.length > 0;
  const weeklySkillRows = hasGeneratedWeeklySkills
    ? weeklyData.skillsTouchedThisWeek
    : ["Language Arts: Reading", "Math: Measurement and Money", "Science: Uses Tools and Models"];
  const quarterAlert = quarterAlertStatus();
  const quarterSkillTrendRows: QuarterSkillTrendRow[] = quarterData.skillsAcrossQuarter.length
    ? quarterData.skillsAcrossQuarter.slice(0, 8).map((skill, index) => ({
        skill,
        evidence: "Evidence: approved activity skills, weekly review ratings, and portfolio picks.",
        trend: index % 2 === 0 ? "Developing -> Practicing -> Practicing" : "Introduced -> Developing -> Practicing",
        parentNote: "",
        isExample: false
      }))
    : [
        {
          skill: "Reading",
          evidence: "Evidence: read-aloud narrations, book notes, weekly portfolio picks.",
          trend: "Developing -> Practicing -> Practicing",
          parentNote: "Sustained practice with stronger narration stamina.",
          isExample: true
        },
        {
          skill: "Grammar",
          evidence: "Evidence: editing marks, dictated sentences, narration cleanup.",
          trend: "Introduced -> Developing -> Practicing",
          parentNote: "Ready for more independent editing.",
          isExample: true
        }
      ];

  return (
    <main className="mockup-shell">
      <aside className="sidebar" aria-label="School year and unit study navigation">
        <div className="brand">
          <p className="eyebrow">Private Homeschool Records</p>
          <h1>Bennett Homeschool</h1>
        </div>

        <nav>
          <p className="tree-title">School Years</p>
          <ul className="tree">
            <li>
              <button className="tree-button is-context" type="button">
                2026-2027 <span>Trial / Active</span>
              </button>
              <ul>
                {workspaceTabs
                  .filter((tab) => tab.key !== "tools")
                  .map((tab) => (
                    <li key={tab.key}>
                      <button className={activeTab === tab.key ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab(tab.key)}>
                        {tab.label}
                        {tab.key === "quarter" && quarterAlert.label !== "No reminder" && quarterAlert.label !== "Complete" ? (
                          <span className="alert-sidebar-badge">{quarterAlert.label}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
              </ul>
            </li>
            <li>
              <button className="tree-button" type="button" onClick={() => setActiveTab("daily")}>
                2027-2028 <span>Planned</span>
              </button>
            </li>
          </ul>

          <p className="tree-title">Unit Studies</p>
          <ul className="tree">
            <li><button className="tree-button is-context" type="button" onClick={() => setActiveTab("daily")}>Construction <span>Active</span></button></li>
            <li><button className="tree-button" type="button" onClick={() => setActiveTab("daily")}>Off the Land <span>Planned</span></button></li>
            <li><button className="tree-button" type="button" onClick={() => setActiveTab("daily")}>Community Helpers <span>Planned</span></button></li>
          </ul>

          <p className="tree-title">Workspace</p>
          <ul className="tree">
            <li>
              <button className={activeTab === "tools" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("tools")}>
                Workspace Tools
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <section className="content">
        <section className="context-box" aria-labelledby="context-title">
          <div>
            <p className="eyebrow">Active record context</p>
            <h2 id="context-title">Student, school year, and unit stay pinned while logging</h2>
          </div>
          <div className="context-fields">
            <label><span>Student</span><input value={student} onChange={(event) => setStudent(event.target.value)} /></label>
            <label><span>School year</span><input value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} /></label>
            <label>
              <span>School year status</span>
              <select value={schoolYearStatus} onChange={(event) => setSchoolYearStatus(event.target.value)}>
                <option>planned</option>
                <option>trial</option>
                <option>active</option>
                <option>closed</option>
                <option>archived</option>
              </select>
            </label>
            <label><span>Official homeschool start</span><input type="date" value={officialStartDate} onChange={(event) => setOfficialStartDate(event.target.value)} /></label>
            <label><span>Unit study</span><input value={unitStudy} onChange={(event) => setUnitStudy(event.target.value)} /></label>
          </div>
        </section>

        <header className="page-header">
          <div>
            <p className="eyebrow">{activeWorkspace.eyebrow}</p>
            <h1>{activeWorkspace.headline}</h1>
            <p>{activeWorkspace.description}</p>
          </div>
        </header>

        <div className="workspace-view">
          <section className="primary-column">
            {activeTab === "daily" ? (
              <>
            <section className="review-alert-card trial-banner">
              <div className="alert-head">
                <div>
                  <p className="eyebrow">Pre-launch status</p>
                  <h2>Trial Mode</h2>
                  <p>Practice records stay separate from official reporting unless you choose to include them later.</p>
                </div>
                <span className="alert-status">Trial</span>
              </div>
            </section>

            <section className="panel quick-log-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Step 1</p>
                  <h2>Select learning activity</h2>
                </div>
                <label className="date-selector"><span>Date</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
              </div>
              <div className="activity-legend">
                <span><i className="legend-dot" />Neutral</span>
                <span><i className="legend-dot done" />Completed</span>
                <span><i className="legend-dot review" />Needs review</span>
                <span><i className="legend-dot selected" />Selected</span>
              </div>
              <div className="activity-type-grid">
                {activityTypes.map((type) => (
                  <button className={`activity-type-button is-${buttonState(type)}`} type="button" key={type} onClick={() => selectActivityType(type)}>
                    <strong>{type}</strong>
                    <span>{buttonState(type) === "completed" ? "completed" : buttonState(type) === "needs-review" ? "needs review" : buttonState(type) === "selected" ? "selected" : "not logged"}</span>
                  </button>
                ))}
              </div>
              <p className="panel-note">
                Completion states are calculated from saved database records for the selected date. Changing the date reloads historical activity states without deleting prior records.
              </p>
            </section>

            <section className="panel quick-log-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Step 2</p>
                  <h2>Tell me what happened.</h2>
                </div>
                <span className="tag good">{selectedType}</span>
              </div>
              <div className="quick-entry-grid">
                <label>
                  <span>Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${selectedType} - ${selectedDate}`} />
                </label>
                <label>
                  <span>Actual minutes</span>
                  <input type="number" min="1" value={actualMinutes} onChange={(event) => setActualMinutes(Number(event.target.value))} />
                </label>
              </div>
              <textarea value={narration} onChange={(event) => setNarration(event.target.value)} />
              <div className="quick-summary-row">
                <span className="tag good">{primarySubject}: {actualMinutes || 0} min</span>
                <span className="tag">Legal tags suggested</span>
                <button className="text-button" type="button" onClick={() => setShowDetails((value) => !value)}>
                  {showDetails ? "Hide full details" : "Show full details"}
                </button>
              </div>
            </section>

            <section className="panel action-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Step 3</p>
                  <h2>Save now or parse for review</h2>
                  <p className="panel-note">Manual save works without AI. Parse only prepares draft cards; it does not save permanent records.</p>
                </div>
              </div>
              <div className="primary-action-row">
                <button className="secondary-button" type="button" onClick={saveDraft} disabled={isSaving || !narration.trim()}>Save as Draft</button>
                <button className="secondary-button" type="button" onClick={clearEntry}>Clear</button>
                <button className="primary-button" type="button" disabled={!canParse} onClick={parseWithAi}>Parse with AI</button>
                <button className="primary-button" type="button" disabled={isSaving || !canSaveApproved} onClick={() => void saveActivity(true)}>Save Approved</button>
              </div>
              <p className="status-line" role="status">{status}</p>
            </section>

            {showDetails ? (
              <>
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Optional details</p>
                      <h2>Subject time and editable legal tags</h2>
                      <p className="panel-note">All {actualMinutes || 0} actual minutes are assigned to one inferred subject for this step, so subject time cannot double-count the activity.</p>
                    </div>
                    <span className="tag good">{primarySubject}: {actualMinutes || 0} min</span>
                  </div>
                  <div className="tag-grid">
                    {["Reading", "Spelling", "Grammar", "Mathematics", "Good Citizenship", "Visual Curriculum", "Bona Fide Instruction"].map((tag) => (
                      <button className={legalTags.includes(tag) ? "tag-button is-active" : "tag-button"} key={tag} type="button" onClick={() => toggleLegalTag(tag)}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="panel" id="proof">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Optional proof</p>
                      <h2>Proof of learning</h2>
                    </div>
                    <span className="tag">{selectedProof.length ? `${selectedProof.length} selected` : "Optional"}</span>
                  </div>
                  <div className="artifact-grid">
                    {proofOptions.map((label) => (
                      <button className={selectedProof.includes(label) ? "artifact-option is-selected" : "artifact-option"} type="button" key={label} onClick={() => toggleProof(label)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="upload-proof-box">
                    <label className="file-picker">
                      <span>{isUploadingProof ? "Uploading proof..." : "Choose proof file"}</span>
                      <input type="file" onChange={handleProofUpload} disabled={isUploadingProof} />
                    </label>
                    <div className="uploaded-proof-list" aria-live="polite">
                      {uploadedArtifacts.length === 0 ? (
                        <p className="muted">No proof files uploaded for this activity yet.</p>
                      ) : (
                        uploadedArtifacts.map((artifact) => (
                          <div className="uploaded-proof-item" key={artifact.id}>
                            <strong>{artifact.originalName}</strong>
                            <span>{artifact.mimeType || "file"} - {Math.ceil(artifact.sizeBytes / 1024)} KB</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            {draftCards.length ? (
              <section className="panel" id="review-summary">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">AI Review Summary</p>
                    <h2>Parent approval before save</h2>
                  </div>
                </div>
                <div className="records-grid">
                  {draftCards.map((draft) => (
                    <article className="activity-card" key={draft.title}>
                      <div className="card-topline">
                        <span className="tag review">Needs parent approval</span>
                        <span className="tag">{draft.minutes} min</span>
                      </div>
                      <h3>{draft.title}</h3>
                      <label><span>Title</span><input defaultValue={draft.title} /></label>
                      <div className="chip-row">
                        {draft.subjects.map((subject) => <span key={subject}>{subject}</span>)}
                        {draft.legalTags.map((tag) => <span key={tag}>{tag}</span>)}
                        {draft.skills.map((skill) => <span key={skill}>{skill}</span>)}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="panel" id="saved-records">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Saved records</p>
                  <h2>Saved records for selected date</h2>
                </div>
                <button className="secondary-button" type="button" onClick={() => void loadSavedActivities(selectedDate)} disabled={isLoadingRecords}>
                  {isLoadingRecords ? "Loading..." : "Refresh"}
                </button>
              </div>
              <div className="record-list">
                {savedActivities.length === 0 ? (
                  <p className="muted">No saved activities for {selectedDate} yet.</p>
                ) : (
                  savedActivities.map((activity) => (
                    <article className="activity-card" key={activity.id}>
                      <div className="card-topline">
                        <span className={activity.parentApproved ? "tag good" : "tag review"}>
                          {activity.parentApproved ? "approved" : "draft / needs review"}
                        </span>
                        <span className="tag">{activity.actualMinutes} min</span>
                      </div>
                      <h3>{activity.title}</h3>
                      <p>{activity.activityType} - {activity.recordStatus}</p>
                      <div className="chip-row">
                        {activity.allocations.map((allocation) => (
                          <span key={`${activity.id}-${allocation.subject}`}>{allocation.subject}: {allocation.minutes}m</span>
                        ))}
                        {activity.legalTags.map((item) => (
                          <span key={`${activity.id}-${item.legalTag.label}`}>{item.legalTag.label}</span>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

              </>
            ) : null}

            {activeTab === "weekly" ? (
            <section className="panel weekly-review-panel" id="weekly-review">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Weekly Reviews</p>
                  <h2>Guided weekly review form</h2>
                  <p className="panel-note">Generated from approved daily logs for the selected Monday-Sunday week. You can edit everything before saving, finalizing, or compiling the PDF.</p>
                </div>
              </div>

              <div className="primary-action-row">
                <button className="secondary-button" type="button" onClick={() => void generateWeeklyReview()} disabled={isWeeklyBusy}>Generate from Logs</button>
                <button className="secondary-button" type="button" onClick={() => void saveWeeklyReview("draft")} disabled={isWeeklyBusy || !weeklyReviewId}>Save Draft</button>
                <button className="primary-button" type="button" onClick={() => void saveWeeklyReview("finalized")} disabled={isWeeklyBusy || !weeklyReviewId}>Finalize Weekly Review</button>
                <button className="primary-button" type="button" onClick={() => void compileWeeklyPdf()} disabled={isWeeklyBusy || !weeklyReviewId}>Compile PDF to Portfolio</button>
              </div>

              <p className="status-line" role="status">{weeklyStatusMessage}</p>
              {lastWeeklyPdfArtifact ? (
                <div className="compiled-report-link">
                  <span>{lastWeeklyPdfArtifact.originalName}</span>
                  <a className="download-link" href={`/api/artifacts/${lastWeeklyPdfArtifact.id}/download`} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                </div>
              ) : null}

              <div className="quick-entry-grid weekly-date-grid">
                <label><span>Student</span><input value={student} onChange={(event) => setStudent(event.target.value)} /></label>
                <label><span>School year</span><input value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} /></label>
                <label><span>Week start date</span><input type="date" value={weeklyStartDate} onChange={(event) => setWeeklyStartDate(event.target.value)} /></label>
                <label><span>Week end date</span><input type="date" value={addDaysIso(weeklyStartDate, 6)} readOnly /></label>
                <label><span>Primary unit study</span><input value={unitStudy} onChange={(event) => setUnitStudy(event.target.value)} /></label>
                <label>
                  <span>Status</span>
                  <select value={weeklyStatus} onChange={(event) => setWeeklyStatus(event.target.value as "draft" | "finalized" | "amended")}>
                    <option>draft</option>
                    <option>finalized</option>
                    <option>amended</option>
                  </select>
                </label>
                <label>
                  <span>Overall weekly rating</span>
                  <select value={weeklyData.overallWeeklyRating} onChange={(event) => updateWeeklyData("overallWeeklyRating", event.target.value)}>
                    {weeklyRatings.map((rating) => <option key={rating}>{rating}</option>)}
                  </select>
                </label>
              </div>

              <div className="review-metrics" aria-label="Weekly review generated metrics">
                <div className="review-metric"><span>Total approved time</span><strong>{formatMinutes(weeklyData.totalApprovedLearningTime)}</strong></div>
                <div className="review-metric"><span>Activities logged</span><strong>{weeklyData.activitiesLogged}</strong></div>
                <div className="review-metric"><span>Days logged</span><strong>{weeklyData.daysLogged}</strong></div>
                <div className="review-metric"><span>Artifacts saved</span><strong>{weeklyData.artifactsSaved}</strong></div>
                <div className="review-metric"><span>Needs review</span><strong>{weeklyData.activitiesNeedingReview ?? 0}</strong></div>
              </div>

              <div className="coverage-summary-grid">
                <div className="record-link"><strong>Subject time summary</strong><span>{Object.entries(weeklyData.subjectTimeSummary).length ? Object.entries(weeklyData.subjectTimeSummary).map(([subject, minutes]) => `${subject} ${formatMinutes(minutes)}`).join("; ") : "Generate from logs to populate subject allocations."}</span></div>
                <div className="record-link"><strong>Texas legal coverage</strong><span>{weeklyData.legalCoverageSummary.length ? weeklyData.legalCoverageSummary.join(", ") : "Generate from logs to populate legal tags."}</span></div>
                <div className="record-link"><strong>Portfolio save target</strong><span>Portfolio / weekly-review-{weeklyStartDate}.pdf</span></div>
              </div>

              <div className="weekly-notes-grid">
                <label>
                  <span>Parent weekly summary</span>
                  <textarea value={weeklyData.parentWeeklySummary} onChange={(event) => updateWeeklyData("parentWeeklySummary", event.target.value)} />
                </label>
                <label>
                  <span>Next week focus</span>
                  <textarea value={weeklyData.nextWeekFocus} onChange={(event) => updateWeeklyData("nextWeekFocus", event.target.value)} />
                </label>
              </div>

              <details className="skill-group" open>
                <summary><span>Student reflection</span><span>separate from parent ratings</span></summary>
                <div className="review-form-grid">
                  <label><span>Favorite activity this week</span><input value={weeklyData.studentFavorite} onChange={(event) => updateWeeklyData("studentFavorite", event.target.value)} /></label>
                  <label><span>Hardest activity this week</span><input value={weeklyData.studentHardest} onChange={(event) => updateWeeklyData("studentHardest", event.target.value)} /></label>
                  <label><span>Proudest work this week</span><input value={weeklyData.studentProudest} onChange={(event) => updateWeeklyData("studentProudest", event.target.value)} /></label>
                  <label><span>Question or curiosity</span><input value={weeklyData.studentQuestion} onChange={(event) => updateWeeklyData("studentQuestion", event.target.value)} /></label>
                  <label>
                    <span>Student self-rating</span>
                    <select value={weeklyData.studentRating} onChange={(event) => updateWeeklyData("studentRating", event.target.value)}>
                      {studentRatings.map((rating) => <option key={rating}>{rating}</option>)}
                    </select>
                  </label>
                  <label><span>Dictated reflection</span><textarea value={weeklyData.studentDictation} onChange={(event) => updateWeeklyData("studentDictation", event.target.value)} /></label>
                </div>
              </details>

              <section className="weekly-subsection">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">{hasGeneratedWeeklySkills ? "Skills Touched This Week" : "Example Skill Rows"}</p>
                    <h2>{hasGeneratedWeeklySkills ? "Rate weekly skill progress" : "Suggested skills until weekly records feed this section"}</h2>
                    {!hasGeneratedWeeklySkills ? (
                      <p className="panel-note">These rows are examples. Real weekly skill suggestions will appear here after activity records feed the skill model.</p>
                    ) : null}
                  </div>
                  <span className="tag">{hasGeneratedWeeklySkills ? "Parent rating overrides AI suggestion" : "Examples only"}</span>
                </div>
                <div className="skill-rating-list">
                  {weeklySkillRows.map((skill, index) => (
                    <article className="skill-rating-row" key={skill}>
                      <div>
                        <strong>{skill}</strong>
                        <p className="skill-evidence">
                          {hasGeneratedWeeklySkills
                            ? "Evidence comes from approved activities and attached proof for this week."
                            : "Example only until approved activities are mapped to real weekly skill suggestions."}
                        </p>
                      </div>
                      <div className="rating-buttons" aria-label={`${skill} rating`}>
                        {weeklyRatings.map((rating) => (
                          <button className={index === 1 && rating === "Developing" ? "rating-button is-selected" : rating === "Practicing" && index !== 1 ? "rating-button is-selected" : "rating-button"} type="button" key={`${skill}-${rating}`}>
                            {rating}
                          </button>
                        ))}
                      </div>
                      <label><span>Parent note</span><input placeholder="Add a weekly skill note." /></label>
                    </article>
                  ))}
                </div>
              </section>

              <section className="weekly-subsection">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Portfolio</p>
                    <h2>Choose 2-5 weekly highlights</h2>
                  </div>
                  <span className="tag">{weeklyData.portfolioSelections.length} selected</span>
                </div>
                <div className="portfolio-grid">
                  {portfolioArtifacts.slice(0, 8).map((artifact) => (
                    <label className={weeklyData.portfolioSelections.includes(artifact.id) ? "portfolio-card is-selected" : "portfolio-card"} key={artifact.id}>
                      <input
                        checked={weeklyData.portfolioSelections.includes(artifact.id)}
                        type="checkbox"
                        onChange={(event) =>
                          updateWeeklyData(
                            "portfolioSelections",
                            event.target.checked
                              ? [...weeklyData.portfolioSelections, artifact.id]
                              : weeklyData.portfolioSelections.filter((id) => id !== artifact.id)
                          )
                        }
                      />
                      <span><strong>{artifact.originalName}</strong><br />{artifact.activity?.title ?? "Portfolio artifact"}</span>
                    </label>
                  ))}
                  {portfolioArtifacts.length === 0 ? <p className="muted">Upload proof files before selecting weekly portfolio highlights.</p> : null}
                </div>
              </section>
            </section>
            ) : null}

            {activeTab === "quarter" ? (
            <section className="panel weekly-review-panel" id="quarter-review">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Quarter Reviews</p>
                  <h2>Instructional quarter checkpoint</h2>
                  <p className="panel-note">Quarter reviews summarize 9-week segments. Annual Review and Annual Plan will stay separate workspaces.</p>
                </div>
                <span className="tag">{quarterAlert.label}</span>
              </div>

              <div className="primary-action-row">
                <button className="secondary-button" type="button" onClick={() => void generateQuarterReview()} disabled={isQuarterBusy}>Generate Quarter Review</button>
                <button className="secondary-button" type="button" onClick={() => void saveQuarterReview("draft")} disabled={isQuarterBusy || !quarterReviewId}>Save Draft</button>
                <button className="primary-button" type="button" onClick={() => void saveQuarterReview("finalized")} disabled={isQuarterBusy || !quarterReviewId}>Finalize Quarter Review</button>
                <button className="primary-button" type="button" onClick={() => void compileQuarterPdf()} disabled={isQuarterBusy || !quarterReviewId}>Compile PDF to Portfolio</button>
              </div>

              <p className="status-line" role="status">{quarterStatusMessage}</p>
              {lastQuarterPdfArtifact ? (
                <div className="compiled-report-link">
                  <span>{lastQuarterPdfArtifact.originalName}</span>
                  <a className="download-link" href={`/api/artifacts/${lastQuarterPdfArtifact.id}/download`} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                </div>
              ) : null}

              <div className="quick-entry-grid weekly-date-grid">
                <label><span>Student</span><input value={student} onChange={(event) => setStudent(event.target.value)} /></label>
                <label><span>School year</span><input value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} /></label>
                <label>
                  <span>Quarter label</span>
                  <select value={quarterLabel} onChange={(event) => setQuarterLabel(event.target.value)}>
                    <option>Quarter 1</option>
                    <option>Quarter 2</option>
                    <option>Quarter 3</option>
                    <option>Quarter 4</option>
                  </select>
                </label>
                <label><span>Quarter start date</span><input type="date" value={quarterStartDate} onChange={(event) => handleQuarterStartChange(event.target.value)} /></label>
                <label><span>Quarter end date</span><input type="date" value={addDaysIso(quarterStartDate, 62)} readOnly /></label>
                <label><span>Review due date</span><input type="date" value={quarterDueDate} onChange={(event) => setQuarterDueDate(event.target.value)} /></label>
                <label>
                  <span>Status</span>
                  <select value={quarterStatus} onChange={(event) => setQuarterStatus(event.target.value as "draft" | "finalized" | "amended")}>
                    <option>draft</option>
                    <option>finalized</option>
                    <option>amended</option>
                  </select>
                </label>
                <label><span>Reminder status</span><input value={quarterAlert.label} readOnly /></label>
              </div>

              <section className="review-alert-card quiet-alert" aria-label="Quarter due status">
                <div className="alert-head">
                  <div>
                    <p className="eyebrow">Quarter review due status</p>
                    <h2>{quarterAlert.title}</h2>
                    <p>{quarterAlert.summary}</p>
                  </div>
                  <span className="alert-status">{quarterAlert.label}</span>
                </div>
              </section>

              <div className="review-metrics" aria-label="Quarter review generated metrics">
                <div className="review-metric"><span>Total time</span><strong>{formatMinutes(quarterData.totalApprovedLearningTime)}</strong></div>
                <div className="review-metric"><span>Days with records</span><strong>{quarterData.daysWithRecords}</strong></div>
                <div className="review-metric"><span>Activities</span><strong>{quarterData.activitiesLogged}</strong></div>
                <div className="review-metric"><span>Weekly reviews</span><strong>{quarterData.weeklyReviewsLogged}</strong></div>
                <div className="review-metric"><span>Needs review</span><strong>{quarterData.activitiesNeedingReview}</strong></div>
              </div>

              <div className="coverage-summary-grid">
                <div className="record-link"><strong>Subject time summary</strong><span>{Object.entries(quarterData.subjectTimeSummary).length ? Object.entries(quarterData.subjectTimeSummary).map(([subject, minutes]) => `${subject} ${formatMinutes(minutes)}`).join("; ") : "Generate to summarize subject allocations."}</span></div>
                <div className="record-link"><strong>Texas legal coverage</strong><span>{quarterData.legalCoverageSummary.length ? quarterData.legalCoverageSummary.join(", ") : "Generate to summarize legal tags."}</span></div>
                <div className="record-link"><strong>Review scope</strong><span>9-week segment only. Annual review and annual plan are separate workspaces.</span></div>
              </div>

              <section className="weekly-subsection">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Skill Trends</p>
                    <h2>Weekly ratings across the quarter</h2>
                  </div>
                  <span className="tag">Parent final rating overrides AI suggestion</span>
                </div>
                <div className="skill-rating-list">
                  {quarterSkillTrendRows.map((row) => (
                    <article className="skill-rating-row" key={row.skill}>
                      <div>
                        <strong>{row.skill}</strong>
                        <p className="skill-evidence">{row.isExample ? `${row.evidence} Example trend until weekly ratings are fully modeled.` : row.evidence}</p>
                      </div>
                      <div>
                        <span className="tag">Trend: {row.trend}</span>
                        <div className="rating-buttons" aria-label={`${row.skill} quarter rating`}>
                          {weeklyRatings.map((rating) => (
                            <button className={rating === "Practicing" ? "rating-button is-selected" : "rating-button"} type="button" key={`${row.skill}-${rating}`}>
                              {rating}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label><span>Parent note</span><input defaultValue={row.parentNote} placeholder="Add a quarter skill note." /></label>
                    </article>
                  ))}
                </div>
              </section>

              <section className="weekly-subsection">
                <div className="weekly-notes-grid">
                  <section aria-labelledby="quarter-student-title">
                    <p className="eyebrow">Student Reflection</p>
                    <h2 id="quarter-student-title">Quarter reflection</h2>
                    <label><span>What did I learn this quarter?</span><textarea value={quarterData.studentLearned} onChange={(event) => updateQuarterData("studentLearned", event.target.value)} /></label>
                    <label><span>What work am I most proud of?</span><input value={quarterData.studentProud} onChange={(event) => updateQuarterData("studentProud", event.target.value)} /></label>
                    <label><span>What was hard for me?</span><input value={quarterData.studentHard} onChange={(event) => updateQuarterData("studentHard", event.target.value)} /></label>
                    <label><span>What do I want to learn next?</span><input value={quarterData.studentNext} onChange={(event) => updateQuarterData("studentNext", event.target.value)} /></label>
                    <label>
                      <span>Student self-rating</span>
                      <select value={quarterData.studentRating} onChange={(event) => updateQuarterData("studentRating", event.target.value)}>
                        {studentRatings.map((rating) => <option key={rating}>{rating}</option>)}
                      </select>
                    </label>
                  </section>
                  <section aria-labelledby="quarter-parent-title">
                    <p className="eyebrow">Parent Reflection</p>
                    <h2 id="quarter-parent-title">Planning direction</h2>
                    <label>
                      <span>Overall quarter rating</span>
                      <select value={quarterData.overallQuarterRating} onChange={(event) => updateQuarterData("overallQuarterRating", event.target.value)}>
                        {weeklyRatings.map((rating) => <option key={rating}>{rating}</option>)}
                      </select>
                    </label>
                    <label><span>What improved most</span><input value={quarterData.improvedMost} onChange={(event) => updateQuarterData("improvedMost", event.target.value)} /></label>
                    <label><span>What needs review</span><input value={quarterData.needsReview} onChange={(event) => updateQuarterData("needsReview", event.target.value)} /></label>
                    <label><span>Next quarter priorities</span><textarea value={quarterData.nextQuarterPriorities} onChange={(event) => updateQuarterData("nextQuarterPriorities", event.target.value)} /></label>
                  </section>
                </div>
              </section>

              <section className="weekly-subsection">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Portfolio</p>
                    <h2>Choose 8-15 quarter highlights</h2>
                  </div>
                  <span className="tag">{quarterData.portfolioSelections.length} selected</span>
                </div>
                <div className="portfolio-grid">
                  {quarterData.portfolioCandidates.length ? quarterData.portfolioCandidates.slice(0, 15).map((artifact) => (
                    <label className={quarterData.portfolioSelections.includes(artifact.id) ? "portfolio-card is-selected" : "portfolio-card"} key={artifact.id}>
                      <input
                        checked={quarterData.portfolioSelections.includes(artifact.id)}
                        type="checkbox"
                        onChange={(event) =>
                          updateQuarterData(
                            "portfolioSelections",
                            event.target.checked
                              ? [...quarterData.portfolioSelections, artifact.id]
                              : quarterData.portfolioSelections.filter((id) => id !== artifact.id)
                          )
                        }
                      />
                      <span><strong>{artifact.originalName}</strong><br />{artifact.activityTitle} - {artifact.activityDate}</span>
                    </label>
                  )) : <p className="muted">Generate the quarter review to suggest portfolio highlights from approved activity evidence.</p>}
                </div>
              </section>

              <section className="weekly-subsection">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Units</p>
                    <h2>Active units this quarter</h2>
                  </div>
                </div>
                <div className="coverage-list">
                  {quarterData.activeUnits.length ? quarterData.activeUnits.map((item) => (
                    <div key={item.title}><span>{item.title} - {item.activities} activities</span><strong>{formatMinutes(item.minutes)}</strong></div>
                  )) : <p className="muted">Generate the quarter review to summarize active unit studies.</p>}
                </div>
              </section>
            </section>
            ) : null}

            {activeTab === "annual-plan" ? (
            <section className="panel annual-plan-panel" id="annual-plan">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Annual Plan</p>
                  <h2>Big-picture school-year planning</h2>
                  <p className="panel-note">The Annual Plan documents intent: theme, curriculum spines, weekly rhythm, unit-study arc, journals, capstones, and annual records. Daily logs remain the record of what actually happened.</p>
                </div>
                <div className="primary-action-row">
                  <button className="secondary-button" type="button" onClick={() => updateAnnualPlan("Annual Plan saved as the intended school-year framework. Daily logs remain the record of what actually happened.", "active")}>Save Plan</button>
                  <button className="secondary-button" type="button" onClick={() => { updateAnnualPlan("Generated records/2026-2027/annual-plan.md with big picture, spines, rhythm, unit sequence, journals, capstone, and records."); setRecordsSnapshotMessage("Annual Plan export: regenerated records/2026-2027/annual-plan.md from saved annual plan fields."); }}>Export Markdown</button>
                  <button className="secondary-button" type="button" onClick={() => updateAnnualPlan("Generated Annual Plan PDF including all planning sections and the note that daily logs document reality.")}>Export PDF</button>
                  <button className="primary-button" type="button" onClick={() => updateAnnualPlan("Annual Plan finalized for the school year. It can still be archived at annual closeout.", "finalized")}>Finalize Plan</button>
                </div>
              </div>
              <div className="quick-entry-grid weekly-date-grid">
                <label><span>Student</span><input value={student} onChange={(event) => setStudent(event.target.value)} /></label>
                <label><span>School year</span><input value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} /></label>
                <label><span>Grade level</span><input defaultValue="2nd grade" /></label>
                <label>
                  <span>Status</span>
                  <select value={annualPlanStatus} onChange={(event) => setAnnualPlanStatus(event.target.value as "draft" | "active" | "finalized" | "archived")}>
                    <option>draft</option>
                    <option>active</option>
                    <option>finalized</option>
                    <option>archived</option>
                  </select>
                </label>
              </div>
              <p className="status-line" role="status">{annualPlanMessage}</p>

              <div className="annual-section-hub" aria-label="Annual Plan sections">
                {annualPlanSections.map((section) => {
                  const isFinalized = finalizedAnnualPlanSections.includes(section.id);
                  const isActive = activeAnnualPlanSection === section.id;
                  return (
                    <button
                      className={`annual-section-button${isActive ? " is-active" : ""}${isFinalized ? " is-finalized" : ""}`}
                      key={section.id}
                      type="button"
                      onClick={() => setActiveAnnualPlanSection(section.id)}
                    >
                      <span>{section.label}</span>
                      <strong>{section.summary}</strong>
                    </button>
                  );
                })}
              </div>

              {activeAnnualPlanSection === "section-1" ? (
              <section className="plan-section">
                <div className="section-head">
                  <div><p className="eyebrow">Section 1</p><h2>Big Picture Framework</h2></div>
                  <button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-1")}>Finalize</button>
                </div>
                <div className="review-form-grid">
                  <label><span>Primary Theme</span><input defaultValue="Me and My Community" /></label>
                  <label><span>Central Question</span><input defaultValue="How do people live together?" /></label>
                  <label><span>Thinking Progression</span><input defaultValue="Observe" /></label>
                  <label><span>Writing Progression</span><input defaultValue="Weekly Narrations" /></label>
                  <label><span>Presentation Progression</span><input defaultValue="Tell us what you learned" /></label>
                  <label><span>Annual Project Cycle</span><textarea defaultValue="Weekly project and presentation cycles culminating in unit capstones and 1+ year-end projects." /></label>
                  <label><span>Year-Long Journals</span><textarea defaultValue="Observation Journal; Unit Lap Books" /></label>
                  <label><span>Spiral Curriculum Summary</span><textarea defaultValue="This is a spiral curriculum. Core skills in literacy, mathematics, finance, observation, writing, project work, and presentation are practiced repeatedly across changing thematic unit studies. Each unit provides a new context for applying the same core skills at a deeper level." /></label>
                </div>
              </section>
              ) : null}

              {activeAnnualPlanSection === "section-2" ? (
              <section className="plan-section">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Section 2</p>
                    <h2>Daily recurring expectations and curriculum spines</h2>
                  </div>
                  <div className="primary-action-row">
                    <button className="secondary-button" type="button" onClick={addCurriculumSpine}>Add box</button>
                    <button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-2")}>Finalize</button>
                  </div>
                </div>
                <div className="records-grid editable-card-grid">
                  {curriculumSpines.map((spine, index) => (
                    <article className="record-link editable-spine-card" key={spine.id}>
                      <div className="finished-card-row">
                        <div className="editable-card-preview">
                          <strong>{spine.title || "Untitled spine"}</strong>
                          <span>{spine.narrative || "Add the narrative for this recurring curriculum spine."}</span>
                        </div>
                        <div className="card-control-row">
                          <button className="secondary-button" type="button" onClick={() => moveCurriculumSpine(spine.id, -1)} disabled={index === 0}>Move up</button>
                          <button className="secondary-button" type="button" onClick={() => moveCurriculumSpine(spine.id, 1)} disabled={index === curriculumSpines.length - 1}>Move down</button>
                          <button className="secondary-button" type="button" onClick={() => setEditingSpineId((current) => (current === spine.id ? null : spine.id))}>
                            {editingSpineId === spine.id ? "Collapse" : "Edit"}
                          </button>
                          <button className="text-button" type="button" onClick={() => deleteCurriculumSpine(spine.id)} disabled={curriculumSpines.length === 1}>Delete</button>
                        </div>
                      </div>
                      {editingSpineId === spine.id ? (
                        <div className="spine-edit-fields">
                          <label>
                            <span>Bold title</span>
                            <input value={spine.title} onChange={(event) => updateCurriculumSpine(spine.id, "title", event.target.value)} />
                          </label>
                          <label>
                            <span>Narrative text</span>
                            <textarea value={spine.narrative} onChange={(event) => updateCurriculumSpine(spine.id, "narrative", event.target.value)} />
                          </label>
                          <div className="card-control-row">
                            <button className="primary-button" type="button" onClick={() => setEditingSpineId(null)}>Save</button>
                            <button className="secondary-button" type="button" onClick={() => setEditingSpineId(null)}>Collapse</button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
              ) : null}

              {activeAnnualPlanSection === "section-3" ? (
              <section className="plan-section">
                <div className="section-head">
                  <div><p className="eyebrow">Section 3</p><h2>Weekly Rhythm</h2></div>
                  <div className="primary-action-row">
                    <button className="secondary-button" type="button" onClick={addWeeklyRhythmDay}>Add day card</button>
                    <span className="tag">Flexible planning scaffold</span>
                    <button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-3")}>Finalize</button>
                  </div>
                </div>
                <p className="panel-note">Each week includes a writing prompt developed throughout the week and finalized on Friday. Friday is the weekly culmination point; at the end of a unit, Final Friday becomes a larger unit capstone.</p>
                <div className="records-grid editable-card-grid">
                  {weeklyRhythmDays.map((day, index) => (
                    <article className="record-link editable-spine-card" key={day.id}>
                      <div className="finished-card-row">
                        <div className="editable-card-preview">
                          <strong>{day.title || "Untitled rhythm day"}</strong>
                          <span>{day.narrative || "Add the rhythm, expected learning pattern, and evidence for this day."}</span>
                        </div>
                        <div className="card-control-row">
                          <button className="secondary-button" type="button" onClick={() => moveWeeklyRhythmDay(day.id, -1)} disabled={index === 0}>Move up</button>
                          <button className="secondary-button" type="button" onClick={() => moveWeeklyRhythmDay(day.id, 1)} disabled={index === weeklyRhythmDays.length - 1}>Move down</button>
                          <button className="secondary-button" type="button" onClick={() => setEditingRhythmDayId((current) => (current === day.id ? null : day.id))}>
                            {editingRhythmDayId === day.id ? "Collapse" : "Edit"}
                          </button>
                          <button className="text-button" type="button" onClick={() => deleteWeeklyRhythmDay(day.id)} disabled={weeklyRhythmDays.length === 1}>Delete</button>
                        </div>
                      </div>
                      {editingRhythmDayId === day.id ? (
                        <div className="spine-edit-fields">
                          <label>
                            <span>Bold title</span>
                            <input value={day.title} onChange={(event) => updateWeeklyRhythmDay(day.id, "title", event.target.value)} />
                          </label>
                          <label>
                            <span>Description</span>
                            <textarea value={day.narrative} onChange={(event) => updateWeeklyRhythmDay(day.id, "narrative", event.target.value)} />
                          </label>
                          <div className="card-control-row">
                            <button className="primary-button" type="button" onClick={() => setEditingRhythmDayId(null)}>Save</button>
                            <button className="secondary-button" type="button" onClick={() => setEditingRhythmDayId(null)}>Collapse</button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
              ) : null}

              {activeAnnualPlanSection === "section-4" ? (
              <section className="plan-section">
                <div className="section-head">
                  <div><p className="eyebrow">Section 4</p><h2>Unit Study Format Options</h2></div>
                  <div className="primary-action-row">
                    <button className="secondary-button" type="button" onClick={addUnitPlanRow}>Add row</button>
                    <button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-4")}>Finalize</button>
                  </div>
                </div>
                <div className="records-grid">
                  <div className="record-link"><strong>Harbor & Sprout Template</strong><span>Use the Monday-Friday pattern: science/writing, nature/music, history/geography, U.S. study/citizenship/philosophy/EQ, and Friday presentation/art/science.</span></div>
                  <div className="record-link"><strong>Open-and-Go Published Unit</strong><span>Follow the publisher sequence in general. The app still tags activities, subjects, legal categories, skills, artifacts, and time.</span></div>
                  <div className="record-link"><strong>Minimal Structure / Parent-Designed</strong><span>Use the weekly rhythm as the default scaffold for parent-created activities, projects, writing prompts, presentation goals, and artifacts.</span></div>
                  <div className="record-link"><strong>Planning note</strong><span>These fields are the intended framework. The parent can deviate based on interest, pacing, field trips, family schedule, or unit depth.</span></div>
                </div>
                <div className="plan-table-wrap">
                  <table className="plan-table">
                    <thead><tr><th>#</th><th>Unit title</th><th>Weeks</th><th>Guiding question</th><th>Primary competency</th><th>Unit format type</th><th>Weekly rhythm override</th><th>Published sequence?</th><th>Parent designed?</th><th>Field trip / application</th><th>Final Friday capstone</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {unitPlanRows.map((row, index) => (
                        <tr className={`unit-status-row unit-status-${row.status}`} key={row.id}>
                          <td>
                            <input
                              aria-label={`Order for ${row.title}`}
                              className="table-order-input"
                              min="1"
                              max={unitPlanRows.length}
                              type="number"
                              value={index + 1}
                              onChange={(event) => moveUnitPlanRowTo(row.id, Number(event.target.value))}
                            />
                          </td>
                          <td><input value={row.title} onChange={(event) => updateUnitPlanRow(row.id, "title", event.target.value)} /></td>
                          <td><input className="table-weeks-input" value={row.weeks} onChange={(event) => updateUnitPlanRow(row.id, "weeks", event.target.value)} /></td>
                          <td><textarea value={row.guidingQuestion} onChange={(event) => updateUnitPlanRow(row.id, "guidingQuestion", event.target.value)} /></td>
                          <td><textarea value={row.primaryCompetency} onChange={(event) => updateUnitPlanRow(row.id, "primaryCompetency", event.target.value)} /></td>
                          <td>
                            <input list="unit-format-options" value={row.formatType} onChange={(event) => updateUnitPlanRow(row.id, "formatType", event.target.value)} />
                          </td>
                          <td>
                            <input list="weekly-rhythm-override-options" value={row.weeklyRhythmOverride} onChange={(event) => updateUnitPlanRow(row.id, "weeklyRhythmOverride", event.target.value)} />
                          </td>
                          <td>
                            <select value={row.publishedSequence} onChange={(event) => updateUnitPlanRow(row.id, "publishedSequence", event.target.value)}>
                              <option>No</option>
                              <option>Yes</option>
                              <option>Partial</option>
                            </select>
                          </td>
                          <td>
                            <select value={row.parentDesigned} onChange={(event) => updateUnitPlanRow(row.id, "parentDesigned", event.target.value)}>
                              <option>Yes</option>
                              <option>No</option>
                              <option>Partial</option>
                            </select>
                          </td>
                          <td><textarea value={row.fieldTrip} onChange={(event) => updateUnitPlanRow(row.id, "fieldTrip", event.target.value)} /></td>
                          <td><textarea value={row.finalFridayCapstone} onChange={(event) => updateUnitPlanRow(row.id, "finalFridayCapstone", event.target.value)} /></td>
                          <td>
                            <select value={row.status} onChange={(event) => updateUnitPlanRow(row.id, "status", event.target.value as UnitPlanStatus)}>
                              {unitStatusOptions.map((statusOption) => <option key={statusOption}>{statusOption}</option>)}
                            </select>
                          </td>
                          <td>
                            <button className="text-button" type="button" onClick={() => deleteUnitPlanRow(row.id)} disabled={unitPlanRows.length === 1}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <datalist id="unit-format-options">
                    {unitFormatOptions.map((option) => <option key={option} value={option} />)}
                  </datalist>
                  <datalist id="weekly-rhythm-override-options">
                    {weeklyRhythmOverrideOptions.map((option) => <option key={option} value={option} />)}
                  </datalist>
                </div>
              </section>
              ) : null}

              {activeAnnualPlanSection === "section-5" ? (
              <section className="plan-section">
                <div className="section-head">
                  <div><p className="eyebrow">Section 5</p><h2>Year-End Capstone</h2></div>
                  <button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-5")}>Finalize</button>
                </div>
                <div className="review-form-grid">
                  <label><span>Capstone title</span><input defaultValue="Outdoor Adventure and Stewardship" /></label>
                  <label><span>Expected duration</span><input defaultValue="2 weeks" /></label>
                  <label><span>Main product</span><input defaultValue="Adventure Guide" /></label>
                  <label><span>Real-world application</span><input defaultValue="Camping/outdoor field studies" /></label>
                  <label><span>Skills integrated</span><textarea defaultValue="Nature journaling, map reading, safety, writing, observation, project work, presentation." /></label>
                  <label><span>Summer bridge</span><textarea defaultValue="Camping trips and continued nature journaling." /></label>
                  <label><span>Summary</span><textarea defaultValue="The year ends with an Outdoor Adventure and Stewardship capstone. The student creates an Adventure Guide containing packing lists, nature journal pages, animal observations, plant sketches, trail maps, camp recipes, safety rules, Leave No Trace principles, first-aid basics, and favorite parks. The binder becomes a real tool for summer camping and field studies." /></label>
                </div>
              </section>
              ) : null}

              {activeAnnualPlanSection === "section-6" ? (
              <section className="plan-section">
                <div className="section-head">
                  <div><p className="eyebrow">Section 6</p><h2>Journals and Portfolios</h2></div>
                  <div className="primary-action-row">
                    <button className="secondary-button" type="button" onClick={addJournalPortfolioCard}>Add card</button>
                    <button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-6")}>Finalize</button>
                  </div>
                </div>
                <div className="records-grid editable-card-grid">
                  {journalPortfolioCards.map((card, index) => (
                    <article className="record-link editable-spine-card" key={card.id}>
                      <div className="finished-card-row">
                        <div className="editable-card-preview">
                          <strong>{card.title || "Untitled journal or portfolio"}</strong>
                          <span>{card.narrative || "Add the purpose, update rhythm, and expected contents for this card."}</span>
                        </div>
                        <div className="card-control-row">
                          <button className="secondary-button" type="button" onClick={() => moveJournalPortfolioCard(card.id, -1)} disabled={index === 0}>Move up</button>
                          <button className="secondary-button" type="button" onClick={() => moveJournalPortfolioCard(card.id, 1)} disabled={index === journalPortfolioCards.length - 1}>Move down</button>
                          <button className="secondary-button" type="button" onClick={() => setEditingJournalPortfolioId((current) => (current === card.id ? null : card.id))}>
                            {editingJournalPortfolioId === card.id ? "Collapse" : "Edit"}
                          </button>
                          <button className="text-button" type="button" onClick={() => deleteJournalPortfolioCard(card.id)} disabled={journalPortfolioCards.length === 1}>Delete</button>
                        </div>
                      </div>
                      {editingJournalPortfolioId === card.id ? (
                        <div className="spine-edit-fields">
                          <label>
                            <span>Bold title</span>
                            <input value={card.title} onChange={(event) => updateJournalPortfolioCard(card.id, "title", event.target.value)} />
                          </label>
                          <label>
                            <span>Description</span>
                            <textarea value={card.narrative} onChange={(event) => updateJournalPortfolioCard(card.id, "narrative", event.target.value)} />
                          </label>
                          <div className="card-control-row">
                            <button className="primary-button" type="button" onClick={() => setEditingJournalPortfolioId(null)}>Save</button>
                            <button className="secondary-button" type="button" onClick={() => setEditingJournalPortfolioId(null)}>Collapse</button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
              ) : null}

              {activeAnnualPlanSection === "section-7" ? (
              <section className="plan-section">
                <div className="section-head">
                  <div><p className="eyebrow">Section 7</p><h2>Annual Records</h2></div>
                  <div className="primary-action-row">
                    <button className="secondary-button" type="button">Add school-year file</button>
                    <button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-7")}>Finalize</button>
                  </div>
                </div>
                <div className="records-grid">
                  <div className="record-link"><strong>Curriculum overview</strong><span>Core resources and visual curriculum evidence.</span></div>
                  <div className="record-link"><strong>Scope and sequence</strong><span>Expected skills, projects, weekly rhythm, and unit arc.</span></div>
                  <div className="record-link"><strong>Legal notes</strong><span>State context, assurance letters, and compliance notes.</span></div>
                  <div className="record-link"><strong>Reading list</strong><span>Planned and completed books for the school year.</span></div>
                  <div className="record-link"><strong>Field trip plan</strong><span>Real-world applications connected to units.</span></div>
                  <div className="record-link"><strong>Other school-year records</strong><span>Annual plan documents, uploaded files, and notes.</span></div>
                </div>
              </section>
              ) : null}

              {activeAnnualPlanSection === "section-8" ? (
              <section className="plan-section">
                <div className="section-head"><div><p className="eyebrow">Section 8</p><h2>Annual Plan Exports</h2></div><div className="primary-action-row"><button className="secondary-button" type="button" onClick={() => { updateAnnualPlan("Generated records/2026-2027/annual-plan.md with big picture, spines, daily expectations, weekly rhythm, unit sequence, journals, capstone, and records."); setRecordsSnapshotMessage("Annual Plan export: regenerated records/2026-2027/annual-plan.md from saved annual plan fields."); }}>Generate Annual Plan Markdown</button><button className="secondary-button" type="button" onClick={() => updateAnnualPlan("Generated Annual Plan PDF including all planning sections and the note that daily logs document reality.")}>Generate Annual Plan PDF</button><button className="secondary-button" type="button" onClick={() => updateAnnualPlan("Annual Plan added to the Legal Archive as the school-year planning framework.", annualPlanStatus)}>Add to Legal Archive</button><button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-8")}>Finalize</button></div></div>
                <div className="coverage-summary-grid">
                  <div className="record-link"><strong>Markdown path</strong><span>records/{schoolYear}/annual-plan.md</span></div>
                  <div className="record-link"><strong>PDF export</strong><span>Includes all Annual Plan sections above.</span></div>
                  <div className="record-link"><strong>Archive note</strong><span>Annual Plan explains intent; daily logs document reality.</span></div>
                </div>
              </section>
              ) : null}
            </section>
            ) : null}

            {activeTab === "annual-review" ? (
            <section className="panel" id="annual-review">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Annual Review</p>
                  <h2>School-year closeout</h2>
                  <p className="panel-note">Annual closeout finalizes the school year, keeps previous records retrievable, and starts the next school year with a fresh quarter cycle.</p>
                </div>
                <div className="primary-action-row">
                  <button className="secondary-button" type="button">Generate Annual Review</button>
                  <button className="secondary-button" type="button">Save Draft</button>
                  <button className="primary-button" type="button">Finalize Closeout</button>
                </div>
              </div>
              <div className="review-metrics">
                <div className="review-metric"><span>Total time</span><strong>0 min</strong></div>
                <div className="review-metric"><span>Days with records</span><strong>0</strong></div>
                <div className="review-metric"><span>Activities</span><strong>0</strong></div>
                <div className="review-metric"><span>Quarter reviews</span><strong>0</strong></div>
                <div className="review-metric"><span>Portfolio items</span><strong>{portfolioArtifacts.length}</strong></div>
              </div>
              <div className="weekly-notes-grid">
                <label><span>Parent annual reflection</span><textarea defaultValue="Summarize growth, legal coverage, portfolio choices, and next school year recommendations." /></label>
                <label><span>Student annual reflection</span><textarea defaultValue="What did I learn this year? What am I proud of? What do I want to learn next year?" /></label>
              </div>
              <div className="records-grid">
                <div className="record-link"><strong>Legal compliance summary</strong><span>Regenerate records/{schoolYear}/legal-summary.md and legal archive PDF.</span></div>
                <div className="record-link"><strong>Annual portfolio</strong><span>Select final highlights and generate annual portfolio PDF.</span></div>
                <div className="record-link"><strong>Archive status</strong><span>After closeout, prior school year remains retrievable and new records start in the next year.</span></div>
              </div>
            </section>
            ) : null}

            {activeTab === "records" ? (
            <section className="panel markdown-panel" id="records-snapshots">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Records & Snapshots</p>
                  <h2>Unit retrieval and generated Markdown records</h2>
                  <p className="panel-note">This is the right workspace for unit study retrieval and snapshot/export concepts. Database records remain the source of truth; Markdown is a readable archive layer.</p>
                </div>
                <div className="primary-action-row">
                  <button className="secondary-button" type="button" onClick={() => setRecordsSnapshotMessage(`Manual snapshot regeneration: regenerated Markdown snapshots from current database records for ${selectedDate}.`)}>Regenerate snapshots</button>
                  <button className="secondary-button" type="button">Open records folder</button>
                </div>
              </div>
              <p className="status-line" role="status">{recordsSnapshotMessage}</p>
              <section className="plan-section">
                <div className="section-head"><div><p className="eyebrow">Unit study retrieval</p><h2>{unitStudy} unit study</h2></div><div className="mini-tabs"><button className="utility-button" type="button">Activities</button><button className="utility-button" type="button">Artifacts</button><button className="utility-button" type="button">Skills covered</button><button className="utility-button" type="button">Subject time</button><button className="utility-button" type="button">Export options</button></div></div>
                <p className="panel-note">A unit page should retrieve activities, artifacts, time records, skills, legal tags, notes, reports, weekly summaries, and a unit summary from saved activity records.</p>
              </section>
              <div className="records-grid">
                <div className="record-link"><strong>Daily record</strong><span>records/{schoolYear}/days/2026-09-08.md</span></div>
                <div className="record-link"><strong>Weekly summary</strong><span>records/{schoolYear}/weeks/2026-W37.md</span></div>
                <div className="record-link"><strong>Quarter review</strong><span>records/{schoolYear}/quarter-reviews/quarter-1.md + PDF</span></div>
                <div className="record-link"><strong>Annual review</strong><span>records/{schoolYear}/annual-review.md + PDFs</span></div>
                <div className="record-link"><strong>Unit activities</strong><span>records/{schoolYear}/units/{unitStudy.toLowerCase().replace(/\s+/g, "-")}/activities.md</span></div>
                <div className="record-link"><strong>Legal summary</strong><span>records/{schoolYear}/legal-summary.md</span></div>
              </div>
              <pre>{`/records
  /${schoolYear}
    annual-plan.md
    annual-review.md
    legal-summary.md
    /days
    /weeks
    /quarter-reviews
    /units
      /${unitStudy.toLowerCase().replace(/\s+/g, "-")}
        activities.md
        skills-covered.md
        artifacts.md`}</pre>
            </section>
            ) : null}

            {activeTab === "portfolio" ? (
            <section className="panel portfolio-panel" id="portfolio">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Portfolio</p>
                  <h2>Proof file explorer</h2>
                  <p className="panel-note">Files are stored in Supabase and linked back to the activity record when you save.</p>
                </div>
                <button className="secondary-button" type="button" onClick={() => void loadPortfolio()} disabled={isLoadingPortfolio}>
                  {isLoadingPortfolio ? "Loading..." : "Refresh"}
                </button>
              </div>
              <div className="file-explorer">
                <nav className="explorer-tree" aria-label="Proof file folders">
                  {portfolioNodes.map((node) => (
                    <button
                      className={selectedPortfolioKey === node.key ? "explorer-node is-selected" : "explorer-node"}
                      data-level={node.level}
                      key={node.key}
                      type="button"
                      onClick={() => setSelectedPortfolioKey(node.key)}
                    >
                      <span>{node.level === 0 ? "[+]" : "--"} {node.label}</span>
                      <strong>{node.count}</strong>
                    </button>
                  ))}
                </nav>
                <div className="explorer-list" aria-live="polite">
                  <div className="explorer-toolbar">
                    <strong>{selectedPortfolioNode?.label ?? "Proof files"}</strong>
                    <span>{selectedPortfolioArtifacts.length} item{selectedPortfolioArtifacts.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="file-list-header" aria-hidden="true">
                    <span>Name</span>
                    <span>Activity</span>
                    <span>Date</span>
                    <span>Size</span>
                    <span>Action</span>
                  </div>
                  {selectedPortfolioArtifacts.length === 0 ? (
                    <p className="muted explorer-empty">No proof files in this folder yet.</p>
                  ) : (
                    selectedPortfolioArtifacts.map((artifact) => (
                      <article className="file-list-row" key={artifact.id}>
                        <div>
                          <strong>{artifact.originalName}</strong>
                          <span>{artifact.mimeType || "file"} - {artifact.recordStatus}</span>
                        </div>
                        <div>
                          <strong>{artifact.activity?.title ?? "Not attached yet"}</strong>
                          <span>{artifact.activity?.activityType ?? "Upload waiting for save"}</span>
                        </div>
                        <span>{artifact.activity ? dateLabel(artifact.activity.date) : dateLabel(artifact.createdAt)}</span>
                        <span>{formatBytes(artifact.sizeBytes)}</span>
                        <a className="download-link" href={`/api/artifacts/${artifact.id}/download`} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>
            ) : null}
          </section>

          {activeTab !== "daily" && activeTab !== "portfolio" && activeTab !== "weekly" ? (
          <aside className="side-column">
            {activeTab === "quarter" || activeTab === "tools" ? (
            <section className="review-alert-card quiet-alert" id="quarter-alert" aria-label="Quarter review alert">
              <div className="alert-head">
                <div>
                  <p className="eyebrow">Quarter review alert</p>
                  <h2>{quarterAlert.title}</h2>
                  <p>{quarterAlert.summary}</p>
                </div>
                <span className="alert-status">{quarterAlert.label}</span>
              </div>
            </section>
            ) : null}

            {activeTab === "tools" ? (
            <section className="panel" id="weekly-tally">
              <p className="eyebrow">This week</p>
              <h2>Weekly subject time tally</h2>
              <div className="coverage-list">
                {subjectTallies.map(([subject, time]) => (
                  <div key={subject}><span>{subject}</span><strong>{time}</strong></div>
                ))}
              </div>
            </section>
            ) : null}

            {activeTab === "legal" || activeTab === "tools" ? (
            <section className="panel" id="legal-panel">
              <p className="eyebrow">Texas legal coverage</p>
              <h2>Legal coverage panel</h2>
              <div className="coverage-list">
                {legalCoverage.map(([category, level]) => (
                  <div key={category}><span>{category}</span><strong>{level}</strong></div>
                ))}
              </div>
            </section>
            ) : null}

            {activeTab === "reports" || activeTab === "tools" ? (
            <section className="panel" id="skills-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">AI matching source</p>
                  <h2>Subject skills panel</h2>
                </div>
                <span className="tag">Editable taxonomy</span>
              </div>
              <div className="skills-matrix">
                {Object.entries(skillTaxonomy).map(([subject, skills]) => (
                  <details className="skill-group" key={subject} open={subject === "Language Arts"}>
                    <summary><span>{subject}</span><span>{skills.length} skills</span></summary>
                    <div className="skill-list">
                      {skills.map((skill) => <span className="skill-pill" key={skill}>{skill}</span>)}
                    </div>
                  </details>
                ))}
              </div>
            </section>
            ) : null}
          </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
