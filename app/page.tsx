"use client";

import type { ChangeEvent, DragEvent, FocusEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnnualPlanEditableCardList } from "@/components/annual-plan-editable-card-list";
import { AnnualPlanBigPictureSection } from "@/components/annual-plan-big-picture-section";
import { AnnualPlanRecordCardList } from "@/components/annual-plan-record-card-list";
import { AnnualPlanSectionHub } from "@/components/annual-plan-section-hub";
import { AnnualPlanUnitTable } from "@/components/annual-plan-unit-table";
import { UnitPlannerActivityModal } from "@/components/unit-planner-activity-modal";
import { UnitPlannerDayBoard } from "@/components/unit-planner-day-board";
import { UnitPlannerWeekTabs } from "@/components/unit-planner-week-tabs";
import { skillTaxonomy } from "@/lib/domain";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  resultIndex: number;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type SavedActivity = {
  id: string;
  title: string;
  date: string;
  actualMinutes: number;
  activityType: string;
  narration: string;
  notes: string | null;
  recordStatus: string;
  parentApproved: boolean;
  reviewStatus: string;
  schoolYear: { label: string };
  allocations: { subject: string; minutes: number }[];
  legalTags: { legalTag: { label: string } }[];
};

type UploadedArtifact = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

type LessonResource = {
  id: string;
  title: string;
  authorOrEditor: string;
  url: string;
};

type WeeklyPdfArtifact = UploadedArtifact;

type PortfolioArtifact = UploadedArtifact & {
  storagePath: string;
  recordStatus: string;
  classification: string | null;
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

type LegalArchiveBucket = {
  id: string;
  bucketKey: string;
  reviewedAt: string | null;
  links: {
    id: string;
    artifact: PortfolioArtifact;
  }[];
};

type ExportSnapshotRecord = {
  id: string;
  type: string;
  label: string;
  filePath: string;
  createdAt: string;
};

type SnapshotCounts = {
  activities: number;
  artifacts: number;
  weeklyReviews: number;
  quarterReviews: number;
  annualPlans: number;
  legalBuckets: number;
};

type BookListEntry = {
  id: string;
  title: string;
  author: string;
  completedDate: string;
  rating: number;
};

type PortfolioListCategory = "achievements" | "accolades" | "projects" | "fieldTrips" | "valuableFailures";
type ValuableFailureStep = "setback" | "response" | "reflection" | "plan";

type ValuableFailureFollowUp = {
  id: string;
  date: string;
  reattemptEvent: string;
  learningOutcome: string;
  resolved: boolean;
};

type PortfolioListEntry = {
  id: string;
  title: string;
  narrative: string;
  date: string;
  artifactIds: string[];
  response: string;
  reflection: string;
  plan: string;
  resolved: boolean;
  followUps: ValuableFailureFollowUp[];
};

const valuableFailureStepOptions: {
  key: ValuableFailureStep;
  label: string;
  prompt: string;
  field: "narrative" | "response" | "reflection" | "plan";
}[] = [
  { key: "setback", label: "1. What happened?", prompt: "Failure or setback", field: "narrative" },
  { key: "response", label: "2. How did he respond?", prompt: "Response", field: "response" },
  { key: "reflection", label: "3. What did he learn?", prompt: "Reflection", field: "reflection" },
  { key: "plan", label: "4. What is the plan?", prompt: "Plan", field: "plan" }
];

type ReportBucket = {
  key: string;
  label: string;
  description: string;
  classifications: string[];
};

type AuditLogRecord = {
  id: string;
  action: string;
  label: string;
  detailsJson: string;
  createdAt: string;
};

type PortfolioNode = {
  key: string;
  label: string;
  count: number;
  level: number;
};

type WorkspaceTab = {
  key: "daily" | "weekly" | "quarter" | "annual-plan" | "annual-review" | "portfolio" | "legal" | "reports" | "records" | "unit-planner" | "tools";
  label: string;
  eyebrow: string;
  headline: string;
  description: string;
};

type WeeklyReviewSection = "summary" | "parent" | "student" | "skills" | "portfolio";
type PortfolioSection = "proof" | "books" | PortfolioListCategory;
type WorkspaceToolSection = "subjects" | "legal" | "parser" | "storage" | "rules";
type SaveStateStatus = "idle" | "saving" | "saved" | "error";

const DEFAULT_STUDENT_NAME = "Bennett C. Claypool";
const STUDENT_NAME_STORAGE_KEY = "bennett-homeschool-student-name";
const ACTIVITY_RESOURCES_STORAGE_KEY = "bennett-homeschool-activity-resources";
const CURRENT_SCHOOL_YEAR_LABEL = "2026-2027";
const CURRENT_SCHOOL_YEAR_STATUS = "trial";

function saveStateFromMessage(message: string): SaveStateStatus {
  if (!message.trim()) return "idle";
  return /(failed|error|could not|requires|not found|unable|incorrect)/i.test(message) ? "error" : "saved";
}

function friendlyError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!message) return fallback;
  if (/fetch failed|failed to fetch|networkerror/i.test(message)) {
    return "The app could not reach the server. Check the connection, refresh the page, and try again.";
  }
  if (/load failed|could not load/i.test(message)) {
    return `${message} Refresh the page before making more changes.`;
  }
  return message;
}

function SaveStateIndicator({
  label,
  message,
  status = saveStateFromMessage(message)
}: {
  label: string;
  message: string;
  status?: SaveStateStatus;
}) {
  return (
    <div className={`save-state-indicator is-${status}`} role="status">
      <span className="save-state-dot" aria-hidden="true" />
      <strong>{label}</strong>
      <span>{message}</span>
    </div>
  );
}

const weeklySectionLabels: Record<WeeklyReviewSection, string> = {
  summary: "Summary Info",
  parent: "Parent Ratings",
  student: "Student Reflection",
  skills: "Skills Review",
  portfolio: "Portfolio"
};

const workspaceToolSectionLabels: Record<WorkspaceToolSection, string> = {
  subjects: "Subject Skills",
  legal: "Legal Tags",
  parser: "Parser Settings",
  storage: "Storage Settings",
  rules: "Record Rules"
};

const portfolioListLabels: Record<PortfolioListCategory, string> = {
  achievements: "Achievements & Awards",
  accolades: "Accolades",
  projects: "Major Projects",
  fieldTrips: "Field Trips",
  valuableFailures: "Valuable Setbacks & Failures"
};

const portfolioArchiveClassifications: Record<PortfolioSection, string> = {
  proof: "",
  books: "portfolio_book_list",
  achievements: "portfolio_achievements",
  accolades: "portfolio_accolades",
  projects: "portfolio_major_projects",
  fieldTrips: "portfolio_field_trips",
  valuableFailures: "portfolio_valuable_failures"
};

const portfolioListCategories: PortfolioListCategory[] = ["achievements", "accolades", "projects", "fieldTrips", "valuableFailures"];
const proofEnabledPortfolioLists: PortfolioListCategory[] = ["projects", "fieldTrips"];
const portfolioProofClassifications: Partial<Record<PortfolioListCategory, string>> = {
  projects: "portfolio_major_projects_proof",
  fieldTrips: "portfolio_field_trips_proof"
};

type DraftCard = {
  id: string;
  title: string;
  minutes: number;
  status: "needs_approval" | "approved";
  subjectAllocations: { subject: string; minutes: number }[];
  crossSubjects: { id: string; activityType: string; topic: string }[];
  legalTags: string[];
  skills: string[];
};

type DailyDetailPane = "legal" | "proof" | "resources";
type LiveActivityButtonState = "needs-review" | "completed";

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

type AnnualRecordCard = {
  id: string;
  title: string;
  narrative: string;
  attachments: UploadedArtifact[];
};

type AnnualPlanBigPicture = {
  primaryTheme: string;
  centralQuestion: string;
  thinkingProgression: string;
  writingProgression: string;
  presentationProgression: string;
  annualProjectCycle: string;
  yearLongJournals: string;
  spiralCurriculumSummary: string;
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

type UnitPlannerActivityStatus = "planned" | "complete" | "skipped" | "moved";

type UnitPlannerActivity = {
  id: string;
  title: string;
  expectedMinutes: number;
  startTime: string;
  finishTime: string;
  description: string;
  prepNotes: string;
  shoppingList: string;
  status: UnitPlannerActivityStatus;
};

type UnitPlannerDay = {
  id: string;
  complete: boolean;
  activities: UnitPlannerActivity[];
};

type UnitPlannerWeek = {
  id: string;
  complete: boolean;
  weeklyQuestion: string;
  writingTopics: string;
  presentationTopic: string;
  project: string;
  resources: string;
  shoppingList: string;
  days: UnitPlannerDay[];
};

type UnitStudyPlanner = {
  unitTitle: string;
  weeksExpected: number;
  startMonday: string;
  status: UnitPlanStatus;
  unitQuestion: string;
  unitWritingTopics: string;
  unitPresentationTopics: string;
  unitProject: string;
  weeks: UnitPlannerWeek[];
};

type SelectedPlannerActivity = {
  weekIndex: number;
  dayIndex: number;
  activityId: string;
};

type AnnualPlanSaveData = {
  annualPlanBigPicture: AnnualPlanBigPicture;
  curriculumSpines: CurriculumSpine[];
  weeklyRhythmDays: WeeklyRhythmDay[];
  unitPlanRows: UnitPlanRow[];
  unitStudyPlanners: Record<string, UnitStudyPlanner>;
  journalPortfolioCards: JournalPortfolioCard[];
  annualRecordCards: AnnualRecordCard[];
  finalizedAnnualPlanSections: AnnualPlanSectionId[];
};

type UnitStudyAllocation = {
  id: string;
  subject: string;
  minutes: number;
};

const activityTypes = [
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
  "Independent Reading",
  "Foreign Language",
  "Extracurricular",
  "Field Trip",
  "Group Event",
  "Special Event"
];

const subjectSplitActivityTypes = [
  "Language Arts",
  "Unit Study",
  "Writing Project",
  "Project Cycle",
  "Presentation Cycle",
  "Hands-On Activity",
  "Field Trip",
  "Group Event",
  "Independent Reading",
  "Extracurricular",
  "Special Event"
];

const extracurricularOptions = [
  "Sports",
  "Clubs",
  "Service",
  "Performing Arts",
  "Visual Arts",
  "Tech & STEM",
  "Communication",
  "Mind Games",
  "Other"
];

const unitStudySubjectOptions = Object.keys(skillTaxonomy);

const legalCoverage = [
  ["Reading", "Covered"],
  ["Spelling", "Light"],
  ["Grammar", "Covered"],
  ["Mathematics", "Needs review"],
  ["Good Citizenship", "Light"],
  ["Visual Curriculum", "Covered"],
  ["Bona Fide Instruction", "Covered"]
];

const allLegalTagOptions = legalCoverage.map(([label]) => label);

const reportBuckets: ReportBucket[] = [
  {
    key: "daily",
    label: "Daily Summary",
    description: "Daily summary PDFs generated from saved daily records.",
    classifications: ["daily_summary"]
  },
  {
    key: "weekly",
    label: "Weekly Review",
    description: "Weekly review PDFs generated from weekly review workspaces.",
    classifications: ["weekly_report"]
  },
  {
    key: "quarter",
    label: "Quarter Review",
    description: "Quarter review PDFs generated from quarter review workspaces.",
    classifications: ["quarter_report"]
  },
  {
    key: "annual-review",
    label: "Annual Review",
    description: "Annual review and year-end closeout reports.",
    classifications: ["annual_review", "annual_report"]
  },
  {
    key: "annual-plan",
    label: "Annual Plan",
    description: "Annual plan PDFs and planning-framework exports.",
    classifications: ["annual_plan"]
  },
  {
    key: "legal",
    label: "Legal Reports",
    description: "Legal archive, legal summary, and compliance reports.",
    classifications: ["legal_report", "legal_summary", "legal_archive"]
  },
  {
    key: "other",
    label: "Other Reports",
    description: "Generated report files that do not fit another bucket yet.",
    classifications: []
  }
];

const legalArchiveBuckets = [
  { key: "homeschool-charter", label: "Homeschool Charter" },
  { key: "annual-plans", label: "Annual Plans" },
  { key: "quarter-annual-reports", label: "Quarter + Annual Reports" },
  { key: "compliance-summaries", label: "Compliance Summaries" },
  { key: "reference-notes", label: "Reference Notes" },
  { key: "prior-year-archives", label: "Prior Year Archives" }
];

function schoolYearStartYear(label: string) {
  const match = label.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

function legalReviewDatesForYear(label: string) {
  const startYear = schoolYearStartYear(label);
  return [`${startYear}-12-15`, `${startYear + 1}-06-15`];
}

function daysUntilIso(value: string) {
  const today = new Date(`${todayIso()}T00:00:00.000Z`);
  const target = new Date(`${value}T00:00:00.000Z`);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function currentLegalReviewWindow(label: string) {
  const [decemberReview, juneReview] = legalReviewDatesForYear(label);
  const today = todayIso();
  if (today <= decemberReview) return { dueDate: decemberReview, previousDueDate: `${schoolYearStartYear(label) - 1}-06-15` };
  return { dueDate: juneReview, previousDueDate: decemberReview };
}

function legalBucketStatus(reviewedAt: string | null, label: string) {
  const window = currentLegalReviewWindow(label);
  const reviewedDate = reviewedAt?.slice(0, 10) ?? "";
  if (reviewedDate >= window.previousDueDate && reviewedDate <= window.dueDate) return "reviewed";
  const daysUntil = daysUntilIso(window.dueDate);
  if (daysUntil >= 0 && daysUntil <= 30) return "due";
  return "unaddressed";
}

function isReportArtifact(artifact: Pick<PortfolioArtifact, "classification" | "mimeType" | "originalName">) {
  const classification = artifact.classification ?? "";
  if (reportBuckets.some((bucket) => bucket.classifications.includes(classification))) return true;
  if (!artifact.mimeType.includes("pdf")) return false;
  return /(summary|review|annual-plan|annual review|quarter|weekly|legal|report)/i.test(artifact.originalName);
}

function isPortfolioListArchive(artifact: Pick<PortfolioArtifact, "classification">) {
  return Object.values(portfolioArchiveClassifications).filter(Boolean).includes(artifact.classification ?? "");
}

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

const initialAnnualRecordCards: AnnualRecordCard[] = [
  {
    id: "curriculum-overview",
    title: "Curriculum overview",
    narrative: "Core resources and visual curriculum evidence.",
    attachments: []
  },
  {
    id: "scope-and-sequence",
    title: "Scope and sequence",
    narrative: "Expected skills, projects, weekly rhythm, and unit arc.",
    attachments: []
  },
  {
    id: "legal-notes",
    title: "Legal notes",
    narrative: "State context, assurance letters, and compliance notes.",
    attachments: []
  },
  {
    id: "reading-list",
    title: "Reading list",
    narrative: "Planned and completed books for the school year.",
    attachments: []
  },
  {
    id: "field-trip-plan",
    title: "Field trip plan",
    narrative: "Real-world applications connected to units.",
    attachments: []
  },
  {
    id: "other-school-year-records",
    title: "Other school-year records",
    narrative: "Annual plan documents, uploaded files, and notes.",
    attachments: []
  }
];

const initialAnnualPlanBigPicture: AnnualPlanBigPicture = {
  primaryTheme: "Me and My Community",
  centralQuestion: "How do people live together?",
  thinkingProgression: "Observe",
  writingProgression: "Weekly Narrations",
  presentationProgression: "Tell us what you learned",
  annualProjectCycle: "Weekly project and presentation cycles culminating in unit capstones and 1+ year-end projects.",
  yearLongJournals: "Observation Journal; Unit Lap Books",
  spiralCurriculumSummary:
    "This is a spiral curriculum. Core skills in literacy, mathematics, finance, observation, writing, project work, and presentation are practiced repeatedly across changing thematic unit studies. Each unit provides a new context for applying the same core skills at a deeper level."
};

const unitFormatOptions = ["Harbor & Sprout Template", "Open-and-Go Published Unit", "Minimal Structure / Parent-Designed"];
const weeklyRhythmOverrideOptions = ["Use full rhythm", "None", "Light overlay", "Use Thursday heavily", "Finance daily", "Cooking Friday", "Context Wednesday focus", "Meaning Thursday focus", "Creating Friday capstone"];
const unitStatusOptions: UnitPlanStatus[] = ["active", "upcoming", "planned", "complete", "skipped"];
const plannerWeekdayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const readAloudActivityTitle = "Read Aloud";
const fridayTemplateActivityTitles = ["Writing Project Finalization & Critique", "Weekly Presentation:", "Complete Weekly Project"];
const protectedUnitWeekCounts: Record<string, number> = {
  construction: 4,
  "all-about-me": 4,
  "off-the-land": 5
};

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

function plannerKey(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unit";
}

function normalizeDictationTranscript(transcript: string) {
  return ` ${transcript.trim()} `
    .replace(/\s+\b(new paragraph|new paragraph please)\b[.,!?;:]?\s*/gi, "\n\n")
    .replace(/\s+\b(insert line|line break|new line|next line)\b[.,!?;:]?\s*/gi, "\n")
    .replace(/\s+\b(period|full stop)\b[.,!?;:]?\s*/gi, ". ")
    .replace(/\s+\b(comma)\b[.,!?;:]?\s*/gi, ", ")
    .replace(/\s+\b(question mark|question)\b[.,!?;:]?\s*/gi, "? ")
    .replace(/\s+\b(exclamation point|exclamation mark)\b[.,!?;:]?\s*/gi, "! ")
    .replace(/\s+\b(colon)\b[.,!?;:]?\s*/gi, ": ")
    .replace(/\s+\b(semicolon)\b[.,!?;:]?\s*/gi, "; ")
    .replace(/\s+\b(dash|hyphen)\b[.,!?;:]?\s*/gi, " - ")
    .replace(/[ \t]+([.,!?;:])/g, "$1")
    .replace(/([.,!?;:])(?=\S)/g, "$1 ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function newPlannerActivity(weekIndex: number, dayIndex: number, activityIndex: number, title?: string): UnitPlannerActivity {
  return {
    id: `planner-activity-${Date.now()}-${weekIndex}-${dayIndex}-${activityIndex}`,
    title: title ?? `Activity ${activityIndex + 1}`,
    expectedMinutes: activityIndex === 0 ? 30 : 20,
    startTime: "",
    finishTime: "",
    description: "",
    prepNotes: "",
    shoppingList: "",
    status: "planned"
  };
}

function makePlannerWeek(weekIndex: number, unitTitle: string): UnitPlannerWeek {
  const seedTitles = [
    [readAloudActivityTitle, `Launch ${unitTitle}`, "Read and narrate", "Start notebook"],
    [readAloudActivityTitle, "Observation activity", "Writing practice"],
    [readAloudActivityTitle, "Hands-on investigation", "Sketch or diagram"],
    [readAloudActivityTitle, "Project work", "Presentation practice"],
    [readAloudActivityTitle, "Final Friday share", "Portfolio pick"]
  ];

  return {
    id: `planner-week-${weekIndex + 1}`,
    complete: false,
    weeklyQuestion: "",
    writingTopics: "",
    presentationTopic: "",
    project: "",
    resources: "",
    shoppingList: "",
    days: Array.from({ length: 5 }, (_value, dayIndex) => ({
      id: `planner-week-${weekIndex + 1}-day-${dayIndex + 1}`,
      complete: false,
      activities: seedTitles[dayIndex].map((title, activityIndex) => newPlannerActivity(weekIndex, dayIndex, activityIndex, title))
    }))
  };
}

function makeUnitPlanner(row: UnitPlanRow): UnitStudyPlanner {
  const weekCount = Math.max(1, Number.parseInt(row.weeks, 10) || 4);
  return {
    unitTitle: row.title,
    weeksExpected: weekCount,
    startMonday: "",
    status: row.status,
    unitQuestion: row.guidingQuestion,
    unitWritingTopics: "",
    unitPresentationTopics: row.finalFridayCapstone,
    unitProject: row.primaryCompetency,
    weeks: Array.from({ length: weekCount }, (_value, index) => makePlannerWeek(index, row.title))
  };
}

function preservedPlannerWeekCount(row: UnitPlanRow, planner?: UnitStudyPlanner) {
  const key = plannerKey(row.title);
  return Math.max(
    1,
    Number.parseInt(row.weeks, 10) || 0,
    planner?.weeksExpected ?? 0,
    planner?.weeks?.length ?? 0,
    protectedUnitWeekCounts[row.id] ?? protectedUnitWeekCounts[key] ?? 0
  );
}

const initialUnitPlanRows: UnitPlanRow[] = [
  {
    id: "construction",
    title: "Construction",
    weeks: "4",
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
    weeks: "4",
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
    weeks: "5",
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
    key: "annual-plan",
    label: "Annual Plan",
    eyebrow: "Annual plan",
    headline: "Plan the school-year framework",
    description: "Document intent, spines, weekly rhythm, unit-study arc, journals, capstones, and annual records."
  },
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
    headline: "Browse proof of learning",
    description: "Use a folder tree and list view to find uploaded proof files, learning artifacts, and Bennett's running book list."
  },
  {
    key: "reports",
    label: "Reports",
    eyebrow: "Reports",
    headline: "Browse generated report buckets",
    description: "Keep generated PDFs and legal reports separate from proof-of-learning artifacts."
  },
  {
    key: "legal",
    label: "Legal Archive",
    eyebrow: "Legal archive",
    headline: "Review legal coverage",
    description: "Keep legal tags visible as distinct record metadata, separate from subjects and skills."
  },
  {
    key: "records",
    label: "Records & Snapshots",
    eyebrow: "Records and snapshots",
    headline: "Retrieve units and generated records",
    description: "Use database records as the source of truth and generate readable Markdown snapshots for archives."
  },
  {
    key: "unit-planner",
    label: "Unit Study Planner",
    eyebrow: "Unit study planner",
    headline: "Plan unit-study teaching days",
    description: "Plan weeks and activities before sending completed day notes to Daily Records."
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

function isWeekdayIso(value: string) {
  const day = new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

function isWeekendIso(value: string) {
  const day = new Date(`${value.slice(0, 10)}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

function weekdaysInRange(startIso: string, endIso: string) {
  let count = 0;
  const cursor = new Date(`${startIso.slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${endIso.slice(0, 10)}T00:00:00.000Z`);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function meaningfulDaysInRange(activities: SavedActivity[], startIso: string, endIso: string) {
  const dayTotals = new Map<string, number>();
  activities
    .filter((activity) => activity.parentApproved)
    .forEach((activity) => {
      const day = activity.date.slice(0, 10);
      if (day < startIso || day > endIso) return;
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + activity.actualMinutes);
    });

  return Array.from(dayTotals.entries()).filter(([day, minutes]) => isWeekdayIso(day) && minutes >= 180).length;
}

function weekendMeaningfulDaysInRange(activities: SavedActivity[], startIso: string, endIso: string) {
  const dayTotals = new Map<string, number>();
  activities
    .filter((activity) => activity.parentApproved)
    .forEach((activity) => {
      const day = activity.date.slice(0, 10);
      if (day < startIso || day > endIso) return;
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + activity.actualMinutes);
    });

  return Array.from(dayTotals.entries()).filter(([day, minutes]) => isWeekendIso(day) && minutes >= 180).length;
}

function nextSchoolYearLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{4})$/);
  if (!match) return `${value} next`;
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`;
}

function blankFutureUnitPlanRows(label: string): UnitPlanRow[] {
  return [
    {
      id: `future-unit-${label}`,
      title: "New Unit Study",
      weeks: "1",
      guidingQuestion: "",
      primaryCompetency: "",
      formatType: "Minimal Structure / Parent-Designed",
      weeklyRhythmOverride: "Use full rhythm",
      publishedSequence: "No",
      parentDesigned: "Yes",
      fieldTrip: "",
      finalFridayCapstone: "",
      status: "upcoming"
    }
  ];
}

function blankPortfolioListEntry(category: PortfolioListCategory): PortfolioListEntry {
  return {
    id: `${category}-${Date.now()}`,
    title: "",
    narrative: "",
    date: todayIso(),
    artifactIds: [],
    response: "",
    reflection: "",
    plan: "",
    resolved: false,
    followUps: []
  };
}

function blankValuableFailureFollowUp(): ValuableFailureFollowUp {
  return {
    id: `failure-follow-up-${Date.now()}`,
    date: "",
    reattemptEvent: "",
    learningOutcome: "",
    resolved: false
  };
}

function blankLessonResource(): LessonResource {
  return {
    id: `resource-${Date.now()}`,
    title: "",
    authorOrEditor: "",
    url: ""
  };
}

function filledLessonResources(resources: LessonResource[]) {
  return resources
    .map((resource) => ({
      ...resource,
      title: resource.title.trim(),
      authorOrEditor: resource.authorOrEditor.trim(),
      url: resource.url.trim()
    }))
    .filter((resource) => resource.title || resource.authorOrEditor || resource.url);
}

function inferSubject(activityType: string) {
  if (activityType === "Language Arts" || activityType === "Writing Project" || activityType === "Presentation Cycle") return "Language Arts";
  if (activityType === "Math") return "Math";
  if (activityType === "Finance") return "Finance";
  if (activityType === "Foreign Language") return "Foreign Language";
  if (activityType === "Independent Reading") return "Independent Reading";
  if (activityType === "Extracurricular") return "Extracurricular";
  if (activityType === "Science Journal") return "Science";
  if (activityType === "Field Trip" || activityType === "Group Event" || activityType === "Special Event") return "Social Studies";
  return "Unit Study";
}

function legalTagSuggestions(activityType: string, subject: string) {
  const tags = new Set<string>(["Bona Fide Instruction"]);
  const combined = `${activityType} ${subject}`.toLowerCase();
  if (combined.includes("language") || combined.includes("reading") || combined.includes("literature")) tags.add("Reading");
  if (combined.includes("spelling")) tags.add("Spelling");
  if (combined.includes("grammar") || combined.includes("writing")) tags.add("Grammar");
  if (combined.includes("math") || combined.includes("finance") || combined.includes("money")) tags.add("Mathematics");
  if (combined.includes("citizenship") || combined.includes("social") || combined.includes("group") || combined.includes("service") || combined.includes("extracurricular")) tags.add("Good Citizenship");
  if (combined.includes("visual") || combined.includes("presentation") || combined.includes("journal") || combined.includes("field") || combined.includes("foreign") || combined.includes("language") || combined.includes("arts") || combined.includes("stem")) tags.add("Visual Curriculum");
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

function formatUsDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${month}/${day}/${year}`;
}

function defaultNarrationForType() {
  return "";
}

function selectExistingZero(event: FocusEvent<HTMLInputElement>) {
  if (event.currentTarget.value === "0") {
    event.currentTarget.select();
  }
}

function parsedSubjectForType(activityType: string) {
  if (activityType === "Math") return "Math";
  if (activityType === "Finance") return "Finance";
  if (activityType === "Foreign Language") return "Foreign Language";
  if (activityType === "Independent Reading") return "Independent Reading";
  if (activityType === "Extracurricular") return "Extracurricular";
  if (activityType === "Science Journal") return "Science";
  if (activityType === "Field Trip" || activityType === "Group Event" || activityType === "Special Event") return "Social Studies";
  if (activityType === "Unit Study") return "Unit Study";
  return "Language Arts";
}

function topLevelSubjectForAllocation(subject: string) {
  if (unitStudySubjectOptions.includes(subject)) return subject;
  if (subject === "US History" || subject === "Government" || subject === "Economics") return "Social Studies";
  if (subject === "Visual Arts") return "Art";
  if (subject === "Technology & STEM") return "Science";
  if (subject === "Unit Study") return "";
  return subject;
}

function defaultAllocationSubjectForType(activityType: string) {
  return topLevelSubjectForAllocation(parsedSubjectForType(activityType));
}

function parsedLegalTagsForType(activityType: string, text = "", selectedSubjects: string[] = []) {
  const combined = `${activityType} ${text}`.toLowerCase();
  const tags = new Set<string>(["Bona Fide Instruction"]);
  const primarySubject = parsedSubjectForType(activityType);
  const allowsBroadTags = subjectSplitActivityTypes.includes(activityType);
  const subjectSet = new Set(selectedSubjects.map(topLevelSubjectForAllocation).filter(Boolean));
  const hasSelectedSubjects = subjectSet.size > 0;

  if (!allowsBroadTags) {
    if (primarySubject === "Language Arts" || primarySubject === "Independent Reading") tags.add("Reading");
    if (primarySubject === "Language Arts" && /(spell|word study|phonics)/.test(combined)) tags.add("Spelling");
    if (primarySubject === "Language Arts" && /(grammar|sentence|writing|write|edit|capitalization|punctuation)/.test(combined)) tags.add("Grammar");
    if (primarySubject === "Math" || primarySubject === "Finance") tags.add("Mathematics");
    if (primarySubject === "Science") tags.add("Visual Curriculum");
    if (primarySubject === "Foreign Language") {
      tags.add("Reading");
      tags.add("Visual Curriculum");
    }
    if (primarySubject === "Social Studies") tags.add("Good Citizenship");
    if (primarySubject === "Extracurricular") tags.add("Good Citizenship");
    return Array.from(tags);
  }

  if (subjectSet.has("Language Arts") || subjectSet.has("Independent Reading") || (!hasSelectedSubjects && /(read|book|story|literature|language|vocabulary|spanish|foreign)/.test(combined))) tags.add("Reading");
  if ((subjectSet.has("Language Arts") || !hasSelectedSubjects) && /(spell|word study|phonics)/.test(combined)) tags.add("Spelling");
  if ((subjectSet.has("Language Arts") || !hasSelectedSubjects) && /(grammar|sentence|writing|edit|capitalization|punctuation)/.test(combined)) tags.add("Grammar");
  if (subjectSet.has("Math") || subjectSet.has("Finance") || (!hasSelectedSubjects && /(math|measure|money|finance|budget|saving|spending|count|fraction|logic|problem)/.test(combined))) tags.add("Mathematics");
  if (subjectSet.has("Social Studies") || subjectSet.has("Extracurricular") || (!hasSelectedSubjects && /(citizen|service|community|group|club|team|leadership|communication|social|extracurricular|government|suffrage|vote|rights|history|american)/.test(combined))) tags.add("Good Citizenship");
  if (
    subjectSet.has("Science") ||
    subjectSet.has("Art") ||
    subjectSet.has("Music") ||
    subjectSet.has("Foreign Language") ||
    (!hasSelectedSubjects && /(visual|art|draw|journal|presentation|field|model|photo|photograph|stem|tech|performing|music|rhythm|song|science|experiment|observe|physics|architect|construction|building)/.test(combined))
  ) {
    tags.add("Visual Curriculum");
  }
  return Array.from(tags);
}

function skillSubjectForName(skill: string) {
  return Object.entries(skillTaxonomy).find(([, skills]) => skills.includes(skill))?.[0] ?? null;
}

function parsedSkillsForType(activityType: string, text = "", selectedSubjects: string[] = []) {
  const combined = `${activityType} ${text}`.toLowerCase();
  const primarySubject = parsedSubjectForType(activityType);
  const skills = new Set<string>();
  const allowsBroadSkills = subjectSplitActivityTypes.includes(activityType);
  const subjectSet = new Set(selectedSubjects.map(topLevelSubjectForAllocation).filter(Boolean));
  const hasSelectedSubjects = subjectSet.size > 0;
  const add = (skill: string) => {
    const skillSubject = skillSubjectForName(skill);
    const allocationSubject = topLevelSubjectForAllocation(skillSubject ?? "");
    if (allowsBroadSkills) {
      if (!hasSelectedSubjects || subjectSet.has(allocationSubject)) skills.add(skill);
      return;
    }
    if (skillSubject === primarySubject) skills.add(skill);
  };

  if (primarySubject === "Language Arts") ["Reading", "Fluency", "Editing"].forEach(add);
  if (primarySubject === "Math") ["Measurement and Money", "Mathematical Communication"].forEach(add);
  if (primarySubject === "Finance") ["Earning and Value Creation", "Saving and Goal Setting", "Spending and Decision-Making"].forEach(add);
  if (primarySubject === "Science") ["Asks Questions and Seeks Answers", "Uses Tools and Models to Investigate the World"].forEach(add);
  if (primarySubject === "Foreign Language") ["Listening Comprehension", "Speaking Practice", "Vocabulary"].forEach(add);
  if (primarySubject === "Independent Reading") ["Reading Stamina", "Comprehension", "Reader Response"].forEach(add);
  if (primarySubject === "Extracurricular") ["Teamwork", "Discipline and Practice", "Communication"].forEach(add);
  if (primarySubject === "Social Studies") ["Citizenship", "Communication"].forEach(add);

  if (/(read|book|story|chapter|literature)/.test(combined)) ["Reading", "Literature", "Reading Stamina", "Comprehension"].forEach(add);
  if (/(spell|phonics|word)/.test(combined)) add("Spelling");
  if (/(grammar|sentence|capitalization|punctuation)/.test(combined)) add("Grammar");
  if (/(write|draft|edit|journal|response)/.test(combined)) ["Writing", "Editing", "Reader Response"].forEach(add);
  if (/(measure|money|fraction|count|budget|saving|spending|finance)/.test(combined)) ["Measurement and Money", "Money Recognition and Counting", "Saving and Goal Setting", "Spending and Decision-Making"].forEach(add);
  if (/(logic|puzzle|strategy|mind game|chess)/.test(combined)) ["Logic", "Strategic Thinking"].forEach(add);
  if (/(problem|solve|solution|challenge|reason)/.test(combined)) ["Problem-Solving", "Problem-Solving and Application"].forEach(add);
  if (/(observe|observation|science|experiment|model|tool|draw|label|nature|physics|structure|building|construction|force|motion|architect)/.test(combined)) ["Asks Questions and Seeks Answers", "Uses Tools and Models to Investigate the World", "Observational Skills", "Physics", "Force, Motion & Energy"].forEach(add);
  if (/(biology|animal|plant|organism|life cycle|habitat|ecosystem)/.test(combined)) ["Biology", "Organisms & Environments", "Environmental Science"].forEach(add);
  if (/(chemistry|chemical|matter|mixture|reaction|solution)/.test(combined)) ["Chemistry", "Matter & Energy"].forEach(add);
  if (/(earth science|rock|weather|climate|geology|volcano|ocean)/.test(combined)) ["Earth Science", "Earth & Space", "Environmental Science"].forEach(add);
  if (/(astronomy|space|planet|star|moon|solar)/.test(combined)) ["Astronomy", "Earth & Space"].forEach(add);
  if (/(medicine|medical|health|body|anatomy|first aid)/.test(combined)) ["Medicine", "Biology"].forEach(add);
  if (/(social science|psychology|society|behavior)/.test(combined)) ["Social Science"].forEach(add);
  if (/(computer science|code|coding|program|algorithm)/.test(combined)) ["Computer Science", "Technical Skills"].forEach(add);
  if (/(engineer|engineering|design|prototype|build|construction)/.test(combined)) ["Engineering", "Uses Tools and Models to Investigate the World"].forEach(add);
  if (/(history|american|early 1900|1900s|timeline|frank lloyd wright|wright)/.test(combined)) ["US History", "Culture"].forEach(add);
  if (/(government|suffrage|vote|law|rights|civic)/.test(combined)) ["Government", "Citizenship"].forEach(add);
  if (/(economic|transportation|industry|trade|market|labor)/.test(combined)) ["Economics"].forEach(add);
  if (/(service|community|citizen|club|team|leadership)/.test(combined)) ["Citizenship", "Service", "Teamwork", "Leadership"].forEach(add);
  if (/(music|song|rhythm|beat|tempo|pitch|ear training|instrument|piano|guitar|sight-read|repertoire|improv)/.test(combined)) ["Rhythm & Timing", "Ear Training", "Technical Proficiency", "Music Theory & Sight-Reading", "Improvisation & Repertoire", "Music Appreciation"].forEach(add);
  if (/(art|draw|drawing|paint|painting|visual|color|line|form|composition|sketch|medium|observe)/.test(combined)) ["Observation", "Line & Form", "Color", "Composition", "Medium", "Art Appreciation"].forEach(add);
  if (/(art|perform|visual|music|creative)/.test(combined)) ["Creative Expression"].forEach(add);
  if (/(tech|stem|code|computer|build)/.test(combined)) ["Technical Skills", "Critical Thinking for Problem Solving"].forEach(add);
  if (/(spanish|foreign|vocabulary|speak|listen)/.test(combined)) ["Listening Comprehension", "Speaking Practice", "Vocabulary", "Cultural Awareness"].forEach(add);

  return Array.from(skills).filter((skill) => Object.values(skillTaxonomy).some((subjectSkills) => subjectSkills.includes(skill)));
}

function splitMinutesAcrossSubjects(subjects: string[], minutes: number) {
  const total = Math.max(1, minutes || 25);
  const uniqueSubjects = Array.from(new Set(subjects.map(topLevelSubjectForAllocation))).filter(Boolean);
  if (!uniqueSubjects.length) return [{ subject: "", minutes: total }];
  const baseMinutes = Math.floor(total / uniqueSubjects.length);
  let usedMinutes = 0;
  return uniqueSubjects.map((subject, index) => {
    const allocationMinutes = index === uniqueSubjects.length - 1 ? total - usedMinutes : baseMinutes;
    usedMinutes += allocationMinutes;
    return { subject, minutes: allocationMinutes };
  });
}

function inferSubjectSplitAllocations(activityType: string, text: string, minutes: number) {
  const combined = text.toLowerCase();
  const subjects: string[] = [];
  const addSubject = (subject: string) => {
    if (!subjects.includes(subject)) subjects.push(subject);
  };

  const primarySubject = parsedSubjectForType(activityType);
  if (primarySubject !== "Unit Study") addSubject(primarySubject);
  if (/(read|book|story|chapter|author|literature|narrat|frank lloyd wright|wright)/.test(combined)) addSubject("Language Arts");
  if (/(physics|science|structure|building|construction|force|motion|stand|frame|model|experiment|biology|chemistry|earth science|astronomy|medicine|environment|engineering)/.test(combined)) addSubject("Science");
  if (/(math|measure|geometry|fraction|angle|count|calculate|number)/.test(combined)) addSubject("Math");
  if (/(finance|money|budget|cost|earn|save|spend|price)/.test(combined)) addSubject("Finance");
  if (/(economic|transportation|industry|trade|market|work|labor)/.test(combined)) addSubject("Social Studies");
  if (/(history|american|early 1900|1900s|timeline|frank lloyd wright|wright)/.test(combined)) addSubject("Social Studies");
  if (/(government|suffrage|vote|law|rights|citizen|civic)/.test(combined)) addSubject("Social Studies");
  if (/(map|geography|community|culture|society)/.test(combined)) addSubject("Social Studies");
  if (/(music|song|rhythm|beat|tempo|pitch|ear training|instrument|sight-read|repertoire|improv)/.test(combined)) addSubject("Music");
  if (/(draw|photo|photograph|visual|art|design|paint|color|line|form|composition|sketch|medium)/.test(combined)) addSubject("Art");
  if (/(technology|tech|stem|engineer|tool)/.test(combined)) addSubject("Technology & STEM");

  return splitMinutesAcrossSubjects(subjects, minutes);
}

function mockDrafts(
  activityType: string,
  minutes: number,
  draftTitle: string,
  narrationText: string,
  extracurricularSelections: string[],
  manualSubjectAllocations: { subject: string; minutes: number }[] = []
): DraftCard[] {
  const primarySubject = parsedSubjectForType(activityType);
  const primaryMinutes = minutes || 25;
  const parseText = `${draftTitle} ${narrationText} ${extracurricularSelections.join(" ")}`;
  const cleanManualAllocations = manualSubjectAllocations
    .filter((allocation) => allocation.subject.trim() && allocation.minutes > 0)
    .map((allocation) => ({ subject: topLevelSubjectForAllocation(allocation.subject.trim()), minutes: allocation.minutes }))
    .filter((allocation) => allocation.subject);
  const subjectAllocations =
    subjectSplitActivityTypes.includes(activityType)
      ? cleanManualAllocations.length
        ? cleanManualAllocations
        : inferSubjectSplitAllocations(activityType, parseText, primaryMinutes)
      : [{ subject: primarySubject, minutes: primaryMinutes }];
  const selectedSubjects = subjectAllocations.map((allocation) => allocation.subject);

  return [
    {
      id: "draft-primary",
      title: draftTitle,
      minutes: primaryMinutes,
      status: "needs_approval",
      subjectAllocations,
      crossSubjects: [],
      legalTags: parsedLegalTagsForType(activityType, parseText, selectedSubjects),
      skills: parsedSkillsForType(activityType, parseText, selectedSubjects)
    }
  ];
}

const chartColors = ["#1f7a8c", "#3f7d20", "#8a5a00", "#5f5aa2", "#b35c44", "#2f5f8f", "#6d597a", "#4f772d"];

function subjectTimeEntries(summary: Record<string, number>) {
  return Object.entries(summary)
    .filter(([, minutes]) => minutes > 0)
    .sort(([, leftMinutes], [, rightMinutes]) => rightMinutes - leftMinutes);
}

function SubjectTimeCharts({ summary, emptyText }: { summary: Record<string, number>; emptyText: string }) {
  const entries = subjectTimeEntries(summary);
  const total = entries.reduce((sum, [, minutes]) => sum + minutes, 0);
  let cursor = 0;
  const pieSegments = entries.map(([, minutes], index) => {
    const start = cursor;
    const end = cursor + (minutes / total) * 100;
    cursor = end;
    return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
  });

  if (!entries.length || total <= 0) {
    return (
      <section className="chart-panel" aria-label="Subject time charts">
        <p className="muted">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="chart-panel" aria-label="Subject time charts">
      <div className="section-head compact-head">
        <div>
          <p className="eyebrow">Subject Time Charts</p>
          <h3>Time by activity area</h3>
        </div>
        <span className="tag">{formatMinutes(total)} total</span>
      </div>
      <div className="chart-layout">
        <div className="bar-chart" aria-label="Subject time bar chart">
          {entries.map(([subject, minutes], index) => {
            const percent = Math.round((minutes / total) * 100);
            return (
              <div className="bar-chart-row" key={subject}>
                <div>
                  <strong>{subject}</strong>
                  <span>{formatMinutes(minutes)} - {percent}%</span>
                </div>
                <div className="bar-track">
                  <span style={{ background: chartColors[index % chartColors.length], width: `${Math.max(4, percent)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="pie-chart-card">
          <div className="pie-chart" style={{ background: `conic-gradient(${pieSegments.join(", ")})` }} aria-hidden="true" />
          <div className="pie-legend">
            {entries.map(([subject, minutes], index) => (
              <span key={subject}><i style={{ background: chartColors[index % chartColors.length] }} />{subject} {Math.round((minutes / total) * 100)}%</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CrossSubjectChartPlaceholder() {
  return (
    <section className="chart-panel cross-subject-chart" aria-label="Cross-subject graph">
      <div className="section-head compact-head">
        <div>
          <p className="eyebrow">Cross-Subject Links</p>
          <h3>Not double-counted</h3>
        </div>
        <span className="tag">0 saved links</span>
      </div>
      <div className="bar-chart-row">
        <div>
          <strong>Cross-subject tags</strong>
          <span>Daily parse links are review-only until saved records store them.</span>
        </div>
        <div className="bar-track muted-track"><span style={{ width: "0%" }} /></div>
      </div>
    </section>
  );
}

export default function Home() {
  const [student, setStudent] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_STUDENT_NAME;
    const storedName = window.localStorage.getItem(STUDENT_NAME_STORAGE_KEY);
    return storedName && storedName !== "Bennett" ? storedName : DEFAULT_STUDENT_NAME;
  });
  const [schoolYear, setSchoolYear] = useState(CURRENT_SCHOOL_YEAR_LABEL);
  const [schoolYearStatus, setSchoolYearStatus] = useState(CURRENT_SCHOOL_YEAR_STATUS);
  const [officialStartDate, setOfficialStartDate] = useState("2027-05-01");
  const [unitStudy, setUnitStudy] = useState("Construction");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedType, setSelectedType] = useState("Language Arts");
  const [title, setTitle] = useState("");
  const [actualMinutes, setActualMinutes] = useState(25);
  const [narration, setNarration] = useState(defaultNarrationForType());
  const [isNarrationListening, setIsNarrationListening] = useState(false);
  const [narrationDictationMessage, setNarrationDictationMessage] = useState("");
  const narrationRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [foreignLanguage, setForeignLanguage] = useState("Spanish");
  const [selectedExtracurriculars, setSelectedExtracurriculars] = useState<string[]>([]);
  const [unitStudyAllocations, setUnitStudyAllocations] = useState<UnitStudyAllocation[]>([
    { id: "unit-study-allocation-default", subject: "", minutes: 25 }
  ]);
  const [entryDraftsByType, setEntryDraftsByType] = useState<Record<string, { title: string; narration: string; minutes: number }>>({
    "Language Arts": {
      title: "",
      narration: defaultNarrationForType(),
      minutes: 25
    }
  });
  const [resourcesByActivityType, setResourcesByActivityType] = useState<Record<string, LessonResource[]>>({});
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [selectedProof, setSelectedProof] = useState<string[]>(["Upload photo"]);
  const [uploadedArtifacts, setUploadedArtifacts] = useState<UploadedArtifact[]>([]);
  const [savedActivities, setSavedActivities] = useState<SavedActivity[]>([]);
  const [allSavedActivities, setAllSavedActivities] = useState<SavedActivity[]>([]);
  const [duplicateApprovedActivities, setDuplicateApprovedActivities] = useState<SavedActivity[]>([]);
  const [portfolioArtifacts, setPortfolioArtifacts] = useState<PortfolioArtifact[]>([]);
  const [legalArchive, setLegalArchive] = useState<LegalArchiveBucket[]>([]);
  const [activeLegalBucketKey, setActiveLegalBucketKey] = useState("homeschool-charter");
  const [legalArchiveMessage, setLegalArchiveMessage] = useState("Legal Archive is ready for file-cabinet review.");
  const [selectedLegalArtifactId, setSelectedLegalArtifactId] = useState("");
  const [isLegalArchiveBusy, setIsLegalArchiveBusy] = useState(false);
  const [selectedPortfolioKey, setSelectedPortfolioKey] = useState("all");
  const [activePortfolioSection, setActivePortfolioSection] = useState<PortfolioSection | null>(null);
  const [activeValuableFailureSteps, setActiveValuableFailureSteps] = useState<Record<string, ValuableFailureStep>>({});
  const [expandedResolvedFailureIds, setExpandedResolvedFailureIds] = useState<string[]>([]);
  const [bookListEntries, setBookListEntries] = useState<BookListEntry[]>([]);
  const [bookListMessage, setBookListMessage] = useState("Running book list is ready.");
  const [isBookListBusy, setIsBookListBusy] = useState(false);
  const [portfolioListEntries, setPortfolioListEntries] = useState<Record<PortfolioListCategory, PortfolioListEntry[]>>({
    achievements: [],
    accolades: [],
    projects: [],
    fieldTrips: [],
    valuableFailures: []
  });
  const [portfolioListMessages, setPortfolioListMessages] = useState<Record<PortfolioListCategory, string>>({
    achievements: "Achievements & Awards list is ready.",
    accolades: "Accolades list is ready.",
    projects: "Major Projects list is ready.",
    fieldTrips: "Field Trips list is ready.",
    valuableFailures: "Valuable Setbacks & Failure list is ready."
  });
  const [isPortfolioListBusy, setIsPortfolioListBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab["key"]>("daily");
  const [activeWeeklySection, setActiveWeeklySection] = useState<WeeklyReviewSection>("summary");
  const [isWeeklyReviewModalOpen, setIsWeeklyReviewModalOpen] = useState(false);
  const [reviewedWeeklySections, setReviewedWeeklySections] = useState<WeeklyReviewSection[]>([]);
  const [activeQuarterSection, setActiveQuarterSection] = useState<WeeklyReviewSection>("summary");
  const [isQuarterReviewModalOpen, setIsQuarterReviewModalOpen] = useState(false);
  const [reviewedQuarterSections, setReviewedQuarterSections] = useState<WeeklyReviewSection[]>([]);
  const [activeAnnualReviewSection, setActiveAnnualReviewSection] = useState<WeeklyReviewSection>("summary");
  const [isAnnualReviewModalOpen, setIsAnnualReviewModalOpen] = useState(false);
  const [reviewedAnnualReviewSections, setReviewedAnnualReviewSections] = useState<WeeklyReviewSection[]>([]);
  const [activeWorkspaceToolSection, setActiveWorkspaceToolSection] = useState<WorkspaceToolSection>("subjects");
  const [isWorkspaceToolsModalOpen, setIsWorkspaceToolsModalOpen] = useState(false);
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
  const [lastAnnualPlanPdfArtifact, setLastAnnualPlanPdfArtifact] = useState<WeeklyPdfArtifact | null>(null);
  const [lastDailyPdfArtifact, setLastDailyPdfArtifact] = useState<WeeklyPdfArtifact | null>(null);
  const [isWeeklyBusy, setIsWeeklyBusy] = useState(false);
  const [isAnnualPlanBusy, setIsAnnualPlanBusy] = useState(false);
  const [isDailyPdfBusy, setIsDailyPdfBusy] = useState(false);
  const [isCompletingDay, setIsCompletingDay] = useState(false);
  const [quarterReviewId, setQuarterReviewId] = useState("");
  const [quarterLabel, setQuarterLabel] = useState("Quarter 1");
  const [quarterStartDate, setQuarterStartDate] = useState("2026-07-01");
  const [quarterDueDate, setQuarterDueDate] = useState(addDaysIso("2026-07-01", 62));
  const [quarterStatus, setQuarterStatus] = useState<"draft" | "finalized" | "amended">("draft");
  const [quarterStatusMessage, setQuarterStatusMessage] = useState("Waiting to generate a draft quarter review from daily logs and weekly reviews.");
  const [annualReviewStatusMessage, setAnnualReviewStatusMessage] = useState("Annual Review is ready for school-year closeout review.");
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
  const [liveActivityButtonStates, setLiveActivityButtonStates] = useState<Record<string, LiveActivityButtonState>>({});
  const [status, setStatus] = useState("Ready to parse the current entry.");
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [activeDailyDetailPane, setActiveDailyDetailPane] = useState<DailyDetailPane | null>(null);
  const [isDailyEntryModalOpen, setIsDailyEntryModalOpen] = useState(false);
  const [annualPlanStatus, setAnnualPlanStatus] = useState<"draft" | "active" | "finalized" | "archived">("active");
  const [annualPlanMessage, setAnnualPlanMessage] = useState("Annual Plan is active. It can be exported to records/2026-2027/annual-plan.md and PDF.");
  const [isAnnualPlanSaving, setIsAnnualPlanSaving] = useState(false);
  const [isAnnualPlanLoading, setIsAnnualPlanLoading] = useState(false);
  const [recordsSnapshotMessage, setRecordsSnapshotMessage] = useState("Records & Snapshots runs in the background. Open this archive only when you need to retrieve a checkpoint.");
  const [snapshots, setSnapshots] = useState<ExportSnapshotRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [snapshotCounts, setSnapshotCounts] = useState<SnapshotCounts>({
    activities: 0,
    artifacts: 0,
    weeklyReviews: 0,
    quarterReviews: 0,
    annualPlans: 0,
    legalBuckets: 0
  });
  const [isSnapshotBusy, setIsSnapshotBusy] = useState(false);
  const [annualPlanBigPicture, setAnnualPlanBigPicture] = useState<AnnualPlanBigPicture>(initialAnnualPlanBigPicture);
  const [curriculumSpines, setCurriculumSpines] = useState<CurriculumSpine[]>(initialCurriculumSpines);
  const [editingSpineId, setEditingSpineId] = useState<string | null>(null);
  const [weeklyRhythmDays, setWeeklyRhythmDays] = useState<WeeklyRhythmDay[]>(initialWeeklyRhythmDays);
  const [editingRhythmDayId, setEditingRhythmDayId] = useState<string | null>(null);
  const [unitPlanRows, setUnitPlanRows] = useState<UnitPlanRow[]>(initialUnitPlanRows);
  const [unitStudyPlanners, setUnitStudyPlanners] = useState<Record<string, UnitStudyPlanner>>(() =>
    Object.fromEntries(initialUnitPlanRows.map((row) => [plannerKey(row.title), makeUnitPlanner(row)]))
  );
  const [activePlannerUnitKey, setActivePlannerUnitKey] = useState(plannerKey(initialUnitPlanRows[0].title));
  const [activePlannerWeekIndex, setActivePlannerWeekIndex] = useState<number | null>(null);
  const [selectedPlannerActivity, setSelectedPlannerActivity] = useState<SelectedPlannerActivity | null>(null);
  const [plannerMoveTarget, setPlannerMoveTarget] = useState({ week: "", day: "" });
  const [journalPortfolioCards, setJournalPortfolioCards] = useState<JournalPortfolioCard[]>(initialJournalPortfolioCards);
  const [editingJournalPortfolioId, setEditingJournalPortfolioId] = useState<string | null>(null);
  const [annualRecordCards, setAnnualRecordCards] = useState<AnnualRecordCard[]>(initialAnnualRecordCards);
  const [editingAnnualRecordId, setEditingAnnualRecordId] = useState<string | null>(null);
  const [activeAnnualPlanSection, setActiveAnnualPlanSection] = useState<AnnualPlanSectionId | null>(null);
  const [finalizedAnnualPlanSections, setFinalizedAnnualPlanSections] = useState<AnnualPlanSectionId[]>([]);

  const primarySubject = useMemo(() => inferSubject(selectedType), [selectedType]);
  const activeAnnualUnitTitle = useMemo(
    () => unitPlanRows.find((row) => row.status === "active")?.title.trim() || unitPlanRows[0]?.title.trim() || "Construction",
    [unitPlanRows]
  );
  const unitStudyAllocationTotal = useMemo(
    () => unitStudyAllocations.reduce((sum, allocation) => sum + (Number.isFinite(allocation.minutes) ? allocation.minutes : 0), 0),
    [unitStudyAllocations]
  );
  const hasSubjectTimeSplit = subjectSplitActivityTypes.includes(selectedType);
  const unitStudyAllocationSubjectsAreValid = unitStudyAllocations.every(
    (allocation) => allocation.minutes === 0 || unitStudySubjectOptions.includes(allocation.subject)
  );
  const unitStudyAllocationIsBalanced = !hasSubjectTimeSplit || (unitStudyAllocationTotal === actualMinutes && unitStudyAllocationSubjectsAreValid);
  const activitySubjectAllocations = useMemo(
    () =>
      hasSubjectTimeSplit
        ? unitStudyAllocations
            .filter((allocation) => allocation.subject.trim() && allocation.minutes > 0)
            .map((allocation) => ({ subject: allocation.subject.trim(), minutes: allocation.minutes }))
        : [{ subject: primarySubject, minutes: actualMinutes }],
    [actualMinutes, hasSubjectTimeSplit, primarySubject, unitStudyAllocations]
  );
  const currentLessonResources = resourcesByActivityType[selectedType] ?? [];
  const [legalTags, setLegalTags] = useState<string[]>(legalTagSuggestions("Language Arts", "Language Arts"));
  const savedMinutesForSelectedDate = useMemo(
    () => savedActivities.reduce((sum, activity) => sum + activity.actualMinutes, 0),
    [savedActivities]
  );
  const parsedCardsTotalMinutes = useMemo(
    () => draftCards.reduce((sum, draft) => sum + draft.minutes, 0),
    [draftCards]
  );
  const dailyInstructionMinutesForBars = Math.max(
    savedMinutesForSelectedDate + actualMinutes,
    parsedCardsTotalMinutes,
    actualMinutes,
    1
  );
  const dailyApprovedMinutes = useMemo(
    () => savedActivities.filter((activity) => activity.parentApproved).reduce((sum, activity) => sum + activity.actualMinutes, 0),
    [savedActivities]
  );
  const dailyMeaningfulTicker = useMemo(
    () => ({
      meaningfulDays: dailyApprovedMinutes >= 180 && isWeekdayIso(selectedDate) ? 1 : 0,
      weekendDays: dailyApprovedMinutes >= 180 && isWeekendIso(selectedDate) ? 1 : 0,
      weekdays: isWeekdayIso(selectedDate) ? 1 : 0
    }),
    [dailyApprovedMinutes, selectedDate]
  );

  const canParse = useMemo(
    () => Boolean(student && schoolYear && unitStudy && selectedDate && selectedType && narration.trim()),
    [narration, schoolYear, selectedDate, selectedType, student, unitStudy]
  );

  const canSaveApproved = Boolean(student && schoolYear && unitStudy && selectedDate && selectedType && narration.trim() && actualMinutes > 0 && unitStudyAllocationIsBalanced);

  useEffect(() => {
    setLegalTags(legalTagSuggestions(selectedType, inferSubject(selectedType)));
  }, [selectedType]);

  useEffect(() => {
    if (activeAnnualUnitTitle && unitStudy !== activeAnnualUnitTitle) {
      setUnitStudy(activeAnnualUnitTitle);
    }
  }, [activeAnnualUnitTitle, unitStudy]);

  useEffect(() => {
    setUnitStudyPlanners((current) => {
      let changed = false;
      const next = { ...current };
      unitPlanRows.forEach((row) => {
        const key = plannerKey(row.title);
        if (!next[key]) {
          next[key] = makeUnitPlanner(row);
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [unitPlanRows]);

  const loadSavedActivities = useCallback(async (date: string, options?: { silent?: boolean }) => {
    if (!options?.silent) setIsLoadingRecords(true);
    try {
      const params = new URLSearchParams({ date, studentName: student, schoolYearLabel: schoolYear });
      const response = await fetch(`/api/activities?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load saved activities.");
      const activities = data.activities ?? [];
      setSavedActivities(activities);
      return activities as SavedActivity[];
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load saved activities.");
      return [];
    } finally {
      if (!options?.silent) setIsLoadingRecords(false);
    }
  }, [schoolYear, student]);

  const loadDailyActivityButtonStatuses = useCallback(async (date: string) => {
    try {
      const params = new URLSearchParams({ date, studentName: student, schoolYearLabel: schoolYear });
      const response = await fetch(`/api/daily-activity-status?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load daily activity button statuses.");
      setLiveActivityButtonStates((current) => {
        const next = Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${date}::`)));
        (data.statuses ?? []).forEach((item: { activityType: string; status: LiveActivityButtonState }) => {
          if (item.status === "completed" || item.status === "needs-review") {
            next[`${date}::${item.activityType}`] = item.status;
          }
        });
        return next;
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load daily activity button statuses.");
    }
  }, [schoolYear, student]);

  const persistActivityButtonStatus = useCallback(async (activityType: string, statusValue: LiveActivityButtonState | "neutral", date = selectedDate) => {
    setLiveActivityButtonStates((current) => {
      const key = `${date}::${activityType}`;
      const next = { ...current };
      if (statusValue === "neutral") {
        delete next[key];
      } else {
        next[key] = statusValue;
      }
      return next;
    });

    try {
      const response = await fetch("/api/daily-activity-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          schoolYearStatus,
          date,
          activityType,
          status: statusValue
        })
      });
      const data = await response.json().catch(() => ({ error: "Daily activity button status update failed." }));
      if (!response.ok) throw new Error(data.error ?? "Daily activity button status update failed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Daily activity button status update failed.");
      void loadDailyActivityButtonStatuses(date);
    }
  }, [loadDailyActivityButtonStatuses, schoolYear, schoolYearStatus, selectedDate, student]);

  const loadAllSavedActivities = useCallback(async () => {
    try {
      const params = new URLSearchParams({ studentName: student, schoolYearLabel: schoolYear });
      const response = await fetch(`/api/activities?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load education-day records.");
      setAllSavedActivities(data.activities ?? []);
    } catch (error) {
      setLegalArchiveMessage(error instanceof Error ? error.message : "Could not load education-day records.");
    }
  }, [schoolYear, student]);

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

  const loadLegalArchive = useCallback(async () => {
    if (!student || !schoolYear) return;
    setIsLegalArchiveBusy(true);
    try {
      const params = new URLSearchParams({ studentName: student, schoolYearLabel: schoolYear, schoolYearStatus });
      const response = await fetch(`/api/legal-archive?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load Legal Archive.");
      setLegalArchive(data.buckets ?? []);
    } catch (error) {
      setLegalArchiveMessage(error instanceof Error ? error.message : "Could not load Legal Archive.");
    } finally {
      setIsLegalArchiveBusy(false);
    }
  }, [schoolYear, schoolYearStatus, student]);

  const loadSnapshots = useCallback(async () => {
    if (!student || !schoolYear) return;
    setIsSnapshotBusy(true);
    try {
      const params = new URLSearchParams({ studentName: student, schoolYearLabel: schoolYear, schoolYearStatus });
      const [snapshotResponse, auditResponse] = await Promise.all([
        fetch(`/api/snapshots?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/audit-log?${params.toString()}`, { cache: "no-store" })
      ]);
      const data = await snapshotResponse.json();
      const auditData = await auditResponse.json();
      if (!snapshotResponse.ok) throw new Error(data.error ?? "Could not load snapshot archive.");
      if (!auditResponse.ok) throw new Error(auditData.error ?? "Could not load audit log.");
      setSnapshots(data.snapshots ?? []);
      setAuditLogs(auditData.auditLogs ?? []);
      setSnapshotCounts(data.counts ?? {
        activities: 0,
        artifacts: 0,
        weeklyReviews: 0,
        quarterReviews: 0,
        annualPlans: 0,
        legalBuckets: 0
      });
      setRecordsSnapshotMessage(data.snapshots?.length || auditData.auditLogs?.length ? "Background archive and audit log loaded." : "No background snapshots or audit entries yet. They will appear after saves and PDF exports.");
    } catch (error) {
      setRecordsSnapshotMessage(friendlyError(error, "Could not load Records & Snapshots archive. Refresh the page and try again."));
    } finally {
      setIsSnapshotBusy(false);
    }
  }, [schoolYear, schoolYearStatus, student]);

  const createFullBackupSnapshot = useCallback(async (label = "Manual Full School-Year Backup") => {
    if (!student || !schoolYear) return;
    setIsSnapshotBusy(true);
    try {
      const response = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          schoolYearStatus,
          type: "full_school_year_backup",
          label,
          note: `Full school-year backup created from Records & Snapshots for ${selectedDate}.`
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Full backup failed.");
      await loadSnapshots();
      const verification = data.verification;
      setRecordsSnapshotMessage(
        verification?.restoreReady
          ? `Full school-year backup saved and verified. ${verification.includedFileCount ?? 0} stored file(s) are included.`
          : "Full school-year backup saved, but verification found something that needs attention. Use Verify Latest Full Backup for details."
      );
    } catch (error) {
      setRecordsSnapshotMessage(friendlyError(error, "Full backup failed. Refresh Records & Snapshots and try again."));
    } finally {
      setIsSnapshotBusy(false);
    }
  }, [loadSnapshots, schoolYear, schoolYearStatus, selectedDate, student]);

  const verifyLatestFullBackupSnapshot = useCallback(async () => {
    if (!student || !schoolYear) return;
    setIsSnapshotBusy(true);
    try {
      const response = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          schoolYearStatus,
          type: "verify_latest_full_backup",
          label: "Verify Latest Full Backup",
          note: "Verify latest full school-year backup package."
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Backup verification failed.");
      const verification = data.verification;
      if (verification?.restoreReady) {
        setRecordsSnapshotMessage(
          `Latest full backup verified and restore-ready. ${verification.includedFileCount ?? 0} stored file(s) are included; ${verification.missingFileCount ?? 0} missing.`
        );
      } else {
        const failedChecks = verification?.checks?.filter((check: { status: string }) => check.status === "fail") ?? [];
        setRecordsSnapshotMessage(
          failedChecks.length
            ? `Latest full backup needs attention: ${failedChecks.map((check: { name: string }) => check.name).join(", ")}.`
            : "No full school-year backup is available to verify yet."
        );
      }
      setSnapshotCounts(data.counts ?? snapshotCounts);
    } catch (error) {
      setRecordsSnapshotMessage(friendlyError(error, "Backup verification failed. Refresh Records & Snapshots and try again."));
    } finally {
      setIsSnapshotBusy(false);
    }
  }, [schoolYear, schoolYearStatus, snapshotCounts, student]);

  const loadBookList = useCallback(async () => {
    if (!student || !schoolYear) return;
    setIsBookListBusy(true);
    try {
      const params = new URLSearchParams({ studentName: student, schoolYearLabel: schoolYear });
      const response = await fetch(`/api/book-list?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load book list.");
      setBookListEntries(data.entries ?? []);
      setBookListMessage(data.entries?.length ? "Book list loaded." : "No completed books saved yet.");
    } catch (error) {
      setBookListMessage(error instanceof Error ? error.message : "Could not load book list.");
    } finally {
      setIsBookListBusy(false);
    }
  }, [schoolYear, student]);

  const loadPortfolioList = useCallback(async (category: PortfolioListCategory) => {
    if (!student || !schoolYear) return;
    setIsPortfolioListBusy(true);
    try {
      const params = new URLSearchParams({ studentName: student, schoolYearLabel: schoolYear, category });
      const response = await fetch(`/api/portfolio-lists?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load portfolio list.");
      setPortfolioListEntries((current) => ({ ...current, [category]: data.entries ?? [] }));
      setPortfolioListMessages((current) => ({
        ...current,
        [category]: data.entries?.length ? `${portfolioListLabels[category]} loaded.` : `No ${portfolioListLabels[category].toLowerCase()} saved yet.`
      }));
    } catch (error) {
      setPortfolioListMessages((current) => ({
        ...current,
        [category]: error instanceof Error ? error.message : "Could not load portfolio list."
      }));
    } finally {
      setIsPortfolioListBusy(false);
    }
  }, [schoolYear, student]);

  useEffect(() => {
    void loadSavedActivities(selectedDate);
    void loadDailyActivityButtonStatuses(selectedDate);
  }, [loadDailyActivityButtonStatuses, loadSavedActivities, selectedDate]);

  useEffect(() => {
    if (activeTab !== "daily") return;

    const refreshDailyStatus = () => {
      void loadSavedActivities(selectedDate, { silent: true });
      void loadDailyActivityButtonStatuses(selectedDate);
    };

    window.addEventListener("focus", refreshDailyStatus);
    const refreshInterval = window.setInterval(refreshDailyStatus, 30000);

    return () => {
      window.removeEventListener("focus", refreshDailyStatus);
      window.clearInterval(refreshInterval);
    };
  }, [activeTab, loadDailyActivityButtonStatuses, loadSavedActivities, selectedDate]);

  useEffect(() => {
    let currentToday = todayIso();

    const resetAtLocalDateChange = () => {
      const nextToday = todayIso();
      if (nextToday === currentToday) return;

      const previousToday = currentToday;
      currentToday = nextToday;
      setLiveActivityButtonStates((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${previousToday}::`)))
      );
      setSelectedDate((current) => (current === previousToday ? nextToday : current));
    };

    const midnightInterval = window.setInterval(resetAtLocalDateChange, 30000);
    return () => window.clearInterval(midnightInterval);
  }, []);

  useEffect(() => {
    void loadAllSavedActivities();
  }, [loadAllSavedActivities]);

  useEffect(() => {
    if (student.trim()) window.localStorage.setItem(STUDENT_NAME_STORAGE_KEY, student.trim());
  }, [student]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ACTIVITY_RESOURCES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, LessonResource[]>;
        setResourcesByActivityType(parsed);
      }
    } catch {
      setResourcesByActivityType({});
    } finally {
      setResourcesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!resourcesLoaded) return;
    window.localStorage.setItem(ACTIVITY_RESOURCES_STORAGE_KEY, JSON.stringify(resourcesByActivityType));
  }, [resourcesByActivityType, resourcesLoaded]);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    if (activeTab === "reports") {
      void loadPortfolio();
    }
  }, [activeTab, loadPortfolio]);

  useEffect(() => {
    void loadLegalArchive();
  }, [loadLegalArchive]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  useEffect(() => {
    void loadBookList();
  }, [loadBookList]);

  useEffect(() => {
    portfolioListCategories.forEach((category) => {
      void loadPortfolioList(category);
    });
  }, [loadPortfolioList]);

  const stopNarrationDictation = useCallback(() => {
    const recognition = narrationRecognitionRef.current;
    if (recognition) {
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      try {
        recognition.stop();
      } catch {
        // Browser speech recognition can throw if it already stopped.
      }
      narrationRecognitionRef.current = null;
    }
    setIsNarrationListening(false);
  }, []);

  const liveActivityButtonKey = useCallback((type = selectedType, date = selectedDate) => {
    return `${date}::${type}`;
  }, [selectedDate, selectedType]);

  const updateLiveActivityButtonStateFromDrafts = useCallback((nextDraftCards: DraftCard[], type = selectedType, date = selectedDate) => {
    const key = liveActivityButtonKey(type, date);
    setLiveActivityButtonStates((current) => {
      const next = { ...current };
      if (!nextDraftCards.length) {
        delete next[key];
        return next;
      }
      const nextState = "needs-review";
      if (next[key] === nextState) return current;
      next[key] = nextState;
      return next;
    });
  }, [liveActivityButtonKey, selectedDate, selectedType]);

  function statusFromDraftCards(nextDraftCards: DraftCard[]): LiveActivityButtonState | "neutral" {
    if (!nextDraftCards.length) return "neutral";
    return "needs-review";
  }

  function persistDraftButtonStatus(nextDraftCards: DraftCard[]) {
    updateLiveActivityButtonStateFromDrafts(nextDraftCards);
    void persistActivityButtonStatus(selectedType, statusFromDraftCards(nextDraftCards));
  }

  useEffect(() => {
    if (!isDailyEntryModalOpen) stopNarrationDictation();
    return () => stopNarrationDictation();
  }, [isDailyEntryModalOpen, stopNarrationDictation]);

  useEffect(() => {
    if (!isDailyEntryModalOpen) return;
    updateLiveActivityButtonStateFromDrafts(draftCards);
  }, [draftCards, isDailyEntryModalOpen, selectedDate, selectedType, updateLiveActivityButtonStateFromDrafts]);

  function selectActivityType(type: string) {
    stopNarrationDictation();
    const nextDrafts = {
      ...entryDraftsByType,
      [selectedType]: { title, narration, minutes: actualMinutes }
    };
    const saved = nextDrafts[type];
    const nextMinutes = saved?.minutes ?? 25;
    setEntryDraftsByType(nextDrafts);
    setTitle(saved?.title ?? "");
    setNarration(saved?.narration ?? defaultNarrationForType());
    setActualMinutes(nextMinutes);
    setUnitStudyAllocations([{ id: `subject-allocation-${Date.now()}`, subject: defaultAllocationSubjectForType(type), minutes: nextMinutes }]);
    setSelectedType(type);
    setDraftCards([]);
    setActiveDailyDetailPane(null);
    setUploadedArtifacts([]);
    setSelectedProof([]);
    setStatus(`${type} selected. Entry text is separate for each activity type.`);
    setIsDailyEntryModalOpen(true);
  }

  function appendNarrationDictation(transcript: string) {
    const cleanTranscript = normalizeDictationTranscript(transcript);
    if (!cleanTranscript) return;
    setNarration((current) => {
      const startsWithPunctuationOrLineBreak = /^[\n.,!?;:]/.test(cleanTranscript);
      const separator = current.trim() && !startsWithPunctuationOrLineBreak ? (/\s$/.test(current) ? "" : " ") : "";
      return `${current}${separator}${cleanTranscript}`;
    });
  }

  function toggleNarrationDictation() {
    if (isNarrationListening) {
      stopNarrationDictation();
      setNarrationDictationMessage("Dictation stopped.");
      setStatus("Dictation stopped.");
      return;
    }

    setNarrationDictationMessage("Dictation button selected. Checking microphone support...");
    setStatus("Dictation button selected. Checking microphone support...");

    if (!window.isSecureContext) {
      const message = "Dictation needs the secure live website. Open the Vercel https link and try again.";
      setNarrationDictationMessage(message);
      setStatus(message);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const message = "Dictation is not supported in this browser. Try Chrome or Edge, or use the keyboard microphone on your phone.";
      setNarrationDictationMessage(message);
      setStatus(message);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) appendNarrationDictation(result[0].transcript);
        }
      };
      recognition.onerror = () => {
        const message = "Dictation stopped. Check microphone permission and try again.";
        setNarrationDictationMessage(message);
        setStatus(message);
        setIsNarrationListening(false);
        narrationRecognitionRef.current = null;
      };
      recognition.onend = () => {
        setIsNarrationListening(false);
        narrationRecognitionRef.current = null;
      };
      narrationRecognitionRef.current = recognition;
      setNarrationDictationMessage("Starting dictation. If asked, allow microphone access.");
      setStatus("Starting dictation. If asked, allow microphone access.");
      recognition.start();
      setIsNarrationListening(true);
      setNarrationDictationMessage("Listening... speak normally, then select Stop Dictation.");
      setStatus("Listening for narration. Speak normally, then select Stop Dictation.");
    } catch {
      const message = "Dictation could not start. Check microphone permission and try again.";
      setNarrationDictationMessage(message);
      setStatus(message);
      setIsNarrationListening(false);
      narrationRecognitionRef.current = null;
    }
  }

  function clearLiveActivityButtonState(type = selectedType, date = selectedDate) {
    const key = liveActivityButtonKey(type, date);
    setLiveActivityButtonStates((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function normalizeActivityLabel(value: string) {
    return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function savedActivityMatchesButton(activity: SavedActivity, type: string) {
    const target = normalizeActivityLabel(type);
    const savedType = normalizeActivityLabel(activity.activityType);
    const savedTitle = normalizeActivityLabel(activity.title);
    const aliases: Record<string, string[]> = {
      [normalizeActivityLabel("Project Cycle")]: [
        normalizeActivityLabel("Project"),
        normalizeActivityLabel("Project-Based Learning"),
        normalizeActivityLabel("Project Based Learning"),
        normalizeActivityLabel("Unit Project"),
        normalizeActivityLabel("Complete Weekly Project")
      ],
      [normalizeActivityLabel("Presentation Cycle")]: [
        normalizeActivityLabel("Presentation"),
        normalizeActivityLabel("Weekly Presentation")
      ],
      [normalizeActivityLabel("Writing Project")]: [
        normalizeActivityLabel("Writing"),
        normalizeActivityLabel("Writing Project Finalization and Critique")
      ]
    };
    const validLabels = new Set([target, ...(aliases[target] ?? [])]);
    return validLabels.has(savedType) || validLabels.has(savedTitle) || savedTitle.startsWith(`${target} `);
  }

  function buttonState(type: string) {
    const liveState = liveActivityButtonStates[liveActivityButtonKey(type)];
    const matching = savedActivities.filter((activity) => savedActivityMatchesButton(activity, type));
    const hasApproved = matching.some((activity) => activity.parentApproved);
    if (liveState) {
      if (liveState === "completed" && !hasApproved) return "needs-review";
      return liveState === "completed" && type === selectedType && isDailyEntryModalOpen ? "selected-completed" : liveState;
    }
    if (type === selectedType && isDailyEntryModalOpen && hasApproved) return "selected-completed";
    if (type === selectedType && isDailyEntryModalOpen) return "selected";
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

  function addLessonResource() {
    setResourcesByActivityType((current) => ({
      ...current,
      [selectedType]: [blankLessonResource(), ...(current[selectedType] ?? [])]
    }));
    setStatus(`${selectedType} resource row added. It will carry forward until changed or deleted.`);
  }

  function updateLessonResource(id: string, patch: Partial<Omit<LessonResource, "id">>) {
    setResourcesByActivityType((current) => ({
      ...current,
      [selectedType]: (current[selectedType] ?? []).map((resource) => (resource.id === id ? { ...resource, ...patch } : resource))
    }));
  }

  function deleteLessonResource(id: string) {
    setResourcesByActivityType((current) => ({
      ...current,
      [selectedType]: (current[selectedType] ?? []).filter((resource) => resource.id !== id)
    }));
    setStatus(`${selectedType} resource removed. The updated list will carry forward.`);
  }

  function toggleExtracurricularOption(option: string) {
    setSelectedExtracurriculars((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
    );
  }

  function addBookListEntry() {
    setBookListEntries((current) => [
      { id: `book-${Date.now()}`, title: "", author: "", completedDate: todayIso(), rating: 5 },
      ...current
    ]);
    setBookListMessage("Book row added. Save the book list when finished.");
  }

  function updateBookListEntry(id: string, patch: Partial<Omit<BookListEntry, "id">>) {
    setBookListEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function deleteBookListEntry(id: string) {
    setBookListEntries((current) => current.filter((entry) => entry.id !== id));
    setBookListMessage("Book row removed. Save the book list when finished.");
  }

  async function saveBookList() {
    setIsBookListBusy(true);
    try {
      const response = await fetch("/api/book-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          schoolYearStatus,
          entries: bookListEntries
            .filter((entry) => entry.title.trim())
            .map((entry) => ({
              title: entry.title.trim(),
              author: entry.author.trim(),
              completedDate: entry.completedDate,
              rating: entry.rating
            }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Book list save failed.");
      setBookListEntries(data.entries ?? []);
      setBookListMessage("Book list saved.");
    } catch (error) {
      setBookListMessage(error instanceof Error ? error.message : "Book list save failed.");
    } finally {
      setIsBookListBusy(false);
    }
  }

  function addPortfolioListEntry(category: PortfolioListCategory) {
    setPortfolioListEntries((current) => ({
      ...current,
      [category]: [blankPortfolioListEntry(category), ...current[category]]
    }));
    setPortfolioListMessages((current) => ({ ...current, [category]: "Row added. Save the list when finished." }));
  }

  function updatePortfolioListEntry(category: PortfolioListCategory, id: string, patch: Partial<Omit<PortfolioListEntry, "id">>) {
    setPortfolioListEntries((current) => ({
      ...current,
      [category]: current[category].map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    }));
  }

  function deletePortfolioListEntry(category: PortfolioListCategory, id: string) {
    setPortfolioListEntries((current) => ({
      ...current,
      [category]: current[category].filter((entry) => entry.id !== id)
    }));
    setPortfolioListMessages((current) => ({ ...current, [category]: "Row removed. Save the list when finished." }));
  }

  function addValuableFailureFollowUp(entryId: string) {
    setPortfolioListEntries((current) => ({
      ...current,
      valuableFailures: current.valuableFailures.map((entry) =>
        entry.id === entryId ? { ...entry, resolved: false, followUps: [...entry.followUps, blankValuableFailureFollowUp()] } : entry
      )
    }));
    setPortfolioListMessages((current) => ({ ...current, valuableFailures: "Follow-up row added. Save the list when finished." }));
  }

  function updateValuableFailureFollowUp(entryId: string, followUpId: string, patch: Partial<Omit<ValuableFailureFollowUp, "id">>) {
    setPortfolioListEntries((current) => ({
      ...current,
      valuableFailures: current.valuableFailures.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              followUps: entry.followUps.map((followUp) => (followUp.id === followUpId ? { ...followUp, ...patch } : followUp))
            }
          : entry
      )
    }));
  }

  function valuableFailureDisplayEntries(entries = portfolioListEntries.valuableFailures) {
    return [...entries].sort((left, right) => {
      if (left.resolved !== right.resolved) return left.resolved ? 1 : -1;
      return right.date.localeCompare(left.date);
    });
  }

  function toggleResolvedFailureExpanded(entryId: string) {
    setExpandedResolvedFailureIds((current) =>
      current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId]
    );
  }

  function renderValuableFailureStepEditor(entry: PortfolioListEntry) {
    const activeStep = activeValuableFailureSteps[entry.id] ?? "setback";
    const option = valuableFailureStepOptions.find((item) => item.key === activeStep) ?? valuableFailureStepOptions[0];
    return (
      <label className="valuable-failure-step-editor">
        <span>{option.prompt}</span>
        <textarea
          rows={5}
          value={entry[option.field]}
          onChange={(event) => updatePortfolioListEntry("valuableFailures", entry.id, { [option.field]: event.target.value })}
        />
      </label>
    );
  }

  async function uploadPortfolioListArtifact(category: PortfolioListCategory, entryId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsPortfolioListBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recordStatus", schoolYearStatus);
      formData.append("classification", portfolioProofClassifications[category] ?? "portfolio_proof");
      formData.append("tagsJson", JSON.stringify({ schoolYear, portfolioSection: category }));

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Portfolio proof upload failed.");

      setPortfolioListEntries((current) => ({
        ...current,
        [category]: current[category].map((entry) =>
          entry.id === entryId ? { ...entry, artifactIds: Array.from(new Set([...entry.artifactIds, data.artifact.id])) } : entry
        )
      }));
      setPortfolioListMessages((current) => ({
        ...current,
        [category]: `${file.name} attached. Save the list when finished.`
      }));
      await loadPortfolio();
    } catch (error) {
      setPortfolioListMessages((current) => ({
        ...current,
        [category]: error instanceof Error ? error.message : "Portfolio proof upload failed."
      }));
    } finally {
      setIsPortfolioListBusy(false);
    }
  }

  async function savePortfolioList(category: PortfolioListCategory, entries = portfolioListEntries[category]) {
    setIsPortfolioListBusy(true);
    try {
      const entriesToSave = category === "valuableFailures" ? valuableFailureDisplayEntries(entries) : entries;
      const response = await fetch("/api/portfolio-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          schoolYearStatus,
          category,
          entries: entriesToSave
            .filter((entry) => entry.narrative.trim())
            .map((entry) => ({
              narrative: entry.narrative.trim(),
              title: entry.title.trim(),
              date: entry.date,
              artifactIds: entry.artifactIds,
              response: entry.response,
              reflection: entry.reflection,
              plan: entry.plan,
              resolved: entry.resolved,
              followUps: entry.followUps
            }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Portfolio list save failed.");
      setPortfolioListEntries((current) => ({ ...current, [category]: data.entries ?? [] }));
      setPortfolioListMessages((current) => ({ ...current, [category]: `${portfolioListLabels[category]} saved.` }));
      return true;
    } catch (error) {
      setPortfolioListMessages((current) => ({
        ...current,
        [category]: error instanceof Error ? error.message : "Portfolio list save failed."
      }));
      return false;
    } finally {
      setIsPortfolioListBusy(false);
    }
  }

  async function compilePortfolioPdf(section: Exclude<PortfolioSection, "proof">) {
    const isBooks = section === "books";
    if (isBooks) setIsBookListBusy(true);
    else setIsPortfolioListBusy(true);

    try {
      const entries = isBooks
        ? bookListEntries
            .filter((entry) => entry.title.trim())
            .map((entry) => ({
              title: entry.title.trim(),
              author: entry.author.trim(),
              completedDate: entry.completedDate,
              rating: entry.rating
            }))
        : portfolioListEntries[section]
            .filter((entry) => entry.narrative.trim())
            .map((entry) => ({
              narrative: entry.narrative.trim(),
              title: entry.title.trim(),
              date: entry.date,
              artifactIds: entry.artifactIds,
              response: entry.response,
              reflection: entry.reflection,
              plan: entry.plan,
              resolved: entry.resolved,
              followUps: entry.followUps
            }));

      const response = await fetch("/api/portfolio-lists/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          category: section,
          entries
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "PDF export failed.");
      if (isBooks) setBookListMessage(`${data.artifact.originalName} saved to past book lists.`);
      else setPortfolioListMessages((current) => ({ ...current, [section]: `${data.artifact.originalName} saved to past ${portfolioListLabels[section].toLowerCase()}.` }));
      await loadPortfolio();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "PDF export failed.";
      if (isBooks) setBookListMessage(message);
      else setPortfolioListMessages((current) => ({ ...current, [section]: message }));
      return false;
    } finally {
      if (isBooks) setIsBookListBusy(false);
      else setIsPortfolioListBusy(false);
    }
  }

  async function closeOutPriorSchoolYear() {
    const confirmed = window.confirm(`Close out ${schoolYear}? This will save PDFs for the book list, achievements, accolades, major projects, field trips, and valuable setbacks & failures, then clear those running lists for the selected school year.`);
    if (!confirmed) return;
    const unresolvedFailures = portfolioListEntries.valuableFailures.filter((entry) => !entry.resolved);
    const carryForwardFailures = unresolvedFailures.length
      ? window.confirm(`Carry forward ${unresolvedFailures.length} unresolved valuable failure${unresolvedFailures.length === 1 ? "" : "s"} to ${nextSchoolYearLabel(schoolYear)}?`)
      : false;

    setIsBookListBusy(true);
    setIsPortfolioListBusy(true);
    try {
      const sections: Exclude<PortfolioSection, "proof">[] = ["books", "achievements", "accolades", "projects", "fieldTrips", "valuableFailures"];
      for (const section of sections) {
        const exported = await compilePortfolioPdf(section);
        if (!exported) throw new Error("Closeout stopped because one PDF could not be created.");
      }

      const backupResponse = await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          schoolYearStatus,
          type: "full_school_year_backup",
          label: `Pre-Closeout Full Backup ${schoolYear}`,
          note: "Automatic full backup created before closing out the prior school year."
        })
      });
      const backupData = await backupResponse.json();
      if (!backupResponse.ok) throw new Error(backupData.error ?? "Closeout stopped because the full backup could not be created.");

      await fetch("/api/book-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentName: student, schoolYearLabel: schoolYear, schoolYearStatus, entries: [] })
      });
      for (const category of portfolioListCategories) {
        await savePortfolioList(category, []);
      }
      if (carryForwardFailures) {
        const nextYear = nextSchoolYearLabel(schoolYear);
        await fetch("/api/portfolio-lists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentName: student,
            schoolYearLabel: nextYear,
            schoolYearStatus: "trial",
            category: "valuableFailures",
            entries: unresolvedFailures.map((entry) => ({
              narrative: entry.narrative,
              title: entry.title,
              date: entry.date,
              artifactIds: entry.artifactIds,
              response: entry.response,
              reflection: entry.reflection,
              plan: entry.plan,
              resolved: false,
              followUps: entry.followUps
            }))
          })
        });
      }

      setBookListEntries([]);
      setBookListMessage(`${schoolYear} book list archived and reset.`);
      setPortfolioListEntries({ achievements: [], accolades: [], projects: [], fieldTrips: [], valuableFailures: [] });
      setPortfolioListMessages({
        achievements: `${schoolYear} achievements archived and reset.`,
        accolades: `${schoolYear} accolades archived and reset.`,
        projects: `${schoolYear} major projects archived and reset.`,
        fieldTrips: `${schoolYear} field trips archived and reset.`,
        valuableFailures: carryForwardFailures
          ? `${schoolYear} valuable setbacks & failures archived and unresolved items copied to ${nextSchoolYearLabel(schoolYear)}.`
          : `${schoolYear} valuable setbacks & failures archived and reset.`
      });
      await loadPortfolio();
    } catch (error) {
      const message = error instanceof Error ? error.message : "School-year closeout failed.";
      setBookListMessage(message);
    } finally {
      setIsBookListBusy(false);
      setIsPortfolioListBusy(false);
    }
  }

  function setActualMinutesForEntry(minutes: number) {
    const nextMinutes = Math.max(0, minutes);
    setActualMinutes(nextMinutes);
    if (hasSubjectTimeSplit && unitStudyAllocations.length === 1) {
      setUnitStudyAllocations((current) => current.map((allocation) => ({ ...allocation, minutes: nextMinutes })));
    }
  }

  function unitStudyRowsFromAllocations(allocations: { subject: string; minutes: number }[]) {
    return allocations.map((allocation, index) => ({
      id: `unit-study-allocation-${Date.now()}-${index}`,
      subject: topLevelSubjectForAllocation(allocation.subject),
      minutes: allocation.minutes
    }));
  }

  function addUnitStudyAllocation() {
    setUnitStudyAllocations((current) => [
      ...current,
      { id: `unit-study-allocation-${Date.now()}-${current.length}`, subject: "", minutes: 0 }
    ]);
    setStatus(`Subject row added. Adjust minutes so the ${selectedType} split equals the actual minutes.`);
  }

  function updateUnitStudyAllocation(id: string, patch: Partial<Omit<UnitStudyAllocation, "id">>) {
    setUnitStudyAllocations((current) =>
      current.map((allocation) =>
        allocation.id === id
          ? {
              ...allocation,
              ...patch,
              minutes: patch.minutes === undefined ? allocation.minutes : Math.max(0, patch.minutes)
            }
          : allocation
      )
    );
  }

  function removeUnitStudyAllocation(id: string) {
    setUnitStudyAllocations((current) => {
      if (current.length === 1) return current;
      return current.filter((allocation) => allocation.id !== id);
    });
    setStatus(`Subject row removed. Confirm the remaining minutes still match the ${selectedType} total.`);
  }

  function balanceLastUnitStudyAllocation() {
    setUnitStudyAllocations((current) => {
      if (!current.length) return current;
      const usedBeforeLast = current.slice(0, -1).reduce((sum, allocation) => sum + allocation.minutes, 0);
      return current.map((allocation, index) =>
        index === current.length - 1 ? { ...allocation, minutes: Math.max(0, actualMinutes - usedBeforeLast) } : allocation
      );
    });
    setStatus(`Last subject row balanced to the remaining ${selectedType} minutes.`);
  }

  function defaultActivityTitle() {
    const formattedDate = formatUsDate(selectedDate);
    if (selectedType === "Foreign Language") return `${foreignLanguage || "Spanish"} - Foreign Language - ${formattedDate}`;
    if (selectedType === "Extracurricular" && selectedExtracurriculars.length) {
      return `${selectedExtracurriculars.join(", ")} - Extracurricular - ${formattedDate}`;
    }
    if (selectedType === "Unit Study") return `${unitStudy || activeAnnualUnitTitle} - Unit Study - ${formattedDate}`;
    return `${selectedType} - ${formattedDate}`;
  }

  function activityPayload(parentApproved: boolean, replaceApprovedActivityIds: string[] = []) {
    return {
      title: title.trim() || defaultActivityTitle(),
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
      subjectAllocations: activitySubjectAllocations,
      legalTags,
      skills: [],
      resources: filledLessonResources(currentLessonResources),
      artifactIds: uploadedArtifacts.map((artifact) => artifact.id),
      replaceApprovedActivityIds
    };
  }

  function requestApprovedSave() {
    if (!narration.trim()) {
      setStatus("Narration is required before saving an approved activity.");
      return;
    }
    if (!canSaveApproved) {
      setStatus(
        hasSubjectTimeSplit && !unitStudyAllocationIsBalanced
          ? `${selectedType} subject minutes must equal ${actualMinutes} before saving. Current split totals ${unitStudyAllocationTotal}.`
          : "Approved save requires student, school year, unit, date, type, narration, and actual minutes."
      );
      return;
    }

    const matchingApproved = savedActivities.filter((activity) => activity.activityType === selectedType && activity.parentApproved);
    if (matchingApproved.length > 0) {
      setDuplicateApprovedActivities(matchingApproved);
      setStatus(`There is already an approved ${selectedType} record for ${formatUsDate(selectedDate)}. Choose whether to replace it or add another.`);
      return;
    }

    void saveActivity(true, []);
  }

  async function saveActivity(parentApproved: boolean, replaceApprovedActivityIds: string[] = []) {
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
        body: JSON.stringify(activityPayload(parentApproved, replaceApprovedActivityIds))
      });
      const data = await response.json().catch(() => ({ error: "Activity save failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Activity save failed.");
      await loadSavedActivities(selectedDate);
      await loadAllSavedActivities();
      await loadPortfolio();
      await persistActivityButtonStatus(selectedType, parentApproved ? "completed" : "needs-review");
      setDuplicateApprovedActivities([]);
      setStatus(
        parentApproved && replaceApprovedActivityIds.length > 0
          ? `Approved activity replaced ${replaceApprovedActivityIds.length} previous ${selectedType} record${replaceApprovedActivityIds.length === 1 ? "" : "s"} for ${formatUsDate(selectedDate)}.`
          : parentApproved
          ? `Approved activity saved with ${uploadedArtifacts.length} proof item${uploadedArtifacts.length === 1 ? "" : "s"}. ${selectedType} will show green for ${formatUsDate(selectedDate)}.`
          : `Draft saved with ${uploadedArtifacts.length} proof item${uploadedArtifacts.length === 1 ? "" : "s"}. ${selectedType} will show yellow for ${selectedDate} unless an approved record also exists.`
      );
      setUploadedArtifacts([]);
      if (parentApproved) {
        setLiveActivityButtonStates((current) => ({
          ...current,
          [liveActivityButtonKey()]: "completed"
        }));
        setIsDailyEntryModalOpen(false);
        setActiveDailyDetailPane(null);
      }
    } catch (error) {
      setStatus(friendlyError(error, "Activity save failed. Confirm the activity details and try again."));
    } finally {
      setIsSaving(false);
    }
  }

  function saveDraft() {
    void saveActivity(false, []);
  }

  function clearEntry() {
    setNarration("");
    setSelectedProof([]);
    setUploadedArtifacts([]);
    setDraftCards([]);
    clearLiveActivityButtonState();
    void persistActivityButtonStatus(selectedType, "neutral");
    setActiveDailyDetailPane(null);
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
      setStatus(friendlyError(error, "Proof upload failed. Try a smaller file or upload again."));
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

  async function updateLegalArchive(action: "review" | "connect", bucketKey = activeLegalBucketKey, artifactId = selectedLegalArtifactId) {
    setIsLegalArchiveBusy(true);
    try {
      const response = await fetch("/api/legal-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          schoolYearStatus,
          action,
          bucketKey,
          artifactId
        })
      });
      const data = await response.json().catch(() => ({ error: "Legal Archive update failed." }));
      if (!response.ok) throw new Error(data.error ?? "Legal Archive update failed.");
      setLegalArchiveMessage(action === "review" ? "Bucket marked reviewed for this review cycle." : "File connected to Legal Archive bucket.");
      setSelectedLegalArtifactId("");
      await loadLegalArchive();
    } catch (error) {
      setLegalArchiveMessage(error instanceof Error ? error.message : "Legal Archive update failed.");
    } finally {
      setIsLegalArchiveBusy(false);
    }
  }

  async function uploadLegalArchiveFile(bucketKey: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsLegalArchiveBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recordStatus", schoolYearStatus);
      formData.append("classification", "legal_archive");
      formData.append("tagsJson", JSON.stringify({ schoolYear, legalArchiveBucket: bucketKey }));
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Legal Archive upload failed.");
      await updateLegalArchive("connect", bucketKey, data.artifact.id);
      await loadPortfolio();
      setLegalArchiveMessage(`${file.name} uploaded and connected to Legal Archive.`);
    } catch (error) {
      setLegalArchiveMessage(error instanceof Error ? error.message : "Legal Archive upload failed.");
    } finally {
      setIsLegalArchiveBusy(false);
    }
  }

  function parseWithAi() {
    const drafts = mockDrafts(
      selectedType,
      actualMinutes,
      title.trim() || defaultActivityTitle(),
      narration,
      selectedExtracurriculars,
      activitySubjectAllocations
    );
    setDraftCards(drafts);
    persistDraftButtonStatus(drafts);
    setStatus("Mock AI parse complete. Review the editable cards below before saving.");
  }

  function updateDraftCard(id: string, patch: Partial<DraftCard>) {
    setDraftCards((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function toggleDraftSkill(id: string, skill: string) {
    setDraftCards((current) =>
      current.map((draft) => {
        if (draft.id !== id) return draft;
        const isRemoving = draft.skills.includes(skill);
        const nextSkills = isRemoving ? draft.skills.filter((item) => item !== skill) : [...draft.skills, skill];
        return {
          ...draft,
          skills: nextSkills
        };
      })
    );
    setStatus(
      hasSubjectTimeSplit
        ? "Skill tags updated. Time allocations stay tied to the subject rows you entered."
        : "Skill tags updated for parsed card."
    );
  }

  function toggleDraftLegalTag(id: string, tag: string) {
    setDraftCards((current) =>
      current.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              legalTags: draft.legalTags.includes(tag)
                ? draft.legalTags.filter((item) => item !== tag)
                : [...draft.legalTags, tag]
            }
          : draft
      )
    );
    setStatus("Legal tags updated for parsed card.");
  }

  function selectDraftTime(id: string) {
    setDraftCards((current) =>
      current.map((draft) => {
        if (draft.id !== id) return draft;
        const options = Array.from(new Set([10, 15, 20, 25, 30, actualMinutes || 25])).sort((a, b) => a - b);
        const currentIndex = options.findIndex((option) => option === draft.minutes);
        const minutes = options[(currentIndex + 1) % options.length] ?? 15;
        const existingTotal = draft.subjectAllocations.reduce((sum, allocation) => sum + allocation.minutes, 0);
        const subjectAllocations =
          draft.subjectAllocations.length > 1 && existingTotal > 0
            ? draft.subjectAllocations.map((allocation, index) => {
                const scaled = index === draft.subjectAllocations.length - 1
                  ? minutes - draft.subjectAllocations.slice(0, -1).reduce((sum, item) => sum + Math.round((item.minutes / existingTotal) * minutes), 0)
                  : Math.round((allocation.minutes / existingTotal) * minutes);
                return { ...allocation, minutes: Math.max(0, scaled) };
              })
            : [{ subject: draft.subjectAllocations[0]?.subject ?? primarySubject, minutes }];
        return {
          ...draft,
          minutes,
          subjectAllocations
        };
      })
    );
    setStatus("Parsed card time changed. Review allocation before approval.");
  }

  function updateDraftSubjectAllocation(cardId: string, allocationIndex: number, patch: Partial<{ subject: string; minutes: number }>) {
    setDraftCards((current) =>
      current.map((draft) => {
        if (draft.id !== cardId) return draft;
        const subjectAllocations = draft.subjectAllocations.map((allocation, index) =>
          index === allocationIndex
            ? {
                ...allocation,
                ...patch,
                minutes: patch.minutes === undefined ? allocation.minutes : Math.max(0, patch.minutes)
              }
            : allocation
        );
        const minutes = subjectAllocations.reduce((sum, allocation) => sum + allocation.minutes, 0);
        return { ...draft, subjectAllocations, minutes };
      })
    );
    setStatus("Parsed card subject minutes updated. Approve the card to apply the split to Step 2.");
  }

  function removeDraftSubjectAllocation(cardId: string, allocationIndex: number) {
    setDraftCards((current) =>
      current.map((draft) => {
        if (draft.id !== cardId || draft.subjectAllocations.length === 1) return draft;
        const subjectAllocations = draft.subjectAllocations.filter((_, index) => index !== allocationIndex);
        const minutes = subjectAllocations.reduce((sum, allocation) => sum + allocation.minutes, 0);
        return { ...draft, subjectAllocations, minutes };
      })
    );
    setStatus("Parsed card subject row removed. Review minutes before approving.");
  }

  function addDraftCrossSubject(id: string) {
    setDraftCards((current) =>
      current.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              crossSubjects: [
                ...draft.crossSubjects,
                {
                  id: `cross-${Date.now()}-${draft.crossSubjects.length}`,
                  activityType: unitStudySubjectOptions.find((subject) => subject !== parsedSubjectForType(selectedType)) ?? unitStudySubjectOptions[0] ?? "Language Arts",
                  topic: ""
                }
              ]
            }
          : draft
      )
    );
    setStatus("Cross-subject topic added. Time remains allocated to the original activity.");
  }

  function updateDraftCrossSubject(cardId: string, crossId: string, patch: Partial<DraftCard["crossSubjects"][number]>) {
    setDraftCards((current) =>
      current.map((draft) =>
        draft.id === cardId
          ? {
              ...draft,
              crossSubjects: draft.crossSubjects.map((crossSubject) =>
                crossSubject.id === crossId ? { ...crossSubject, ...patch } : crossSubject
              )
            }
          : draft
      )
    );
    setStatus("Cross-subject topic updated. Time remains allocated to the original activity.");
  }

  function removeDraftCrossSubject(cardId: string, crossId: string) {
    setDraftCards((current) =>
      current.map((draft) =>
        draft.id === cardId
          ? {
              ...draft,
              crossSubjects: draft.crossSubjects.filter((crossSubject) => crossSubject.id !== crossId)
            }
          : draft
      )
    );
    setStatus("Cross-subject topic removed.");
  }

  function mergeDraftCard(id: string) {
    setDraftCards((current) => {
      const index = current.findIndex((draft) => draft.id === id);
      if (index < 0 || current.length < 2) return current;
      const targetIndex = index === 0 ? 1 : index - 1;
      const source = current[index];
      const target = current[targetIndex];
      const merged: DraftCard = {
        ...target,
        title: `${target.title} + ${source.title}`,
        minutes: target.minutes + source.minutes,
        status: "needs_approval",
        subjectAllocations: [...target.subjectAllocations, ...source.subjectAllocations],
        legalTags: Array.from(new Set([...target.legalTags, ...source.legalTags])),
        skills: Array.from(new Set([...target.skills, ...source.skills])),
        crossSubjects: [...target.crossSubjects, ...source.crossSubjects]
      };
      return current.filter((draft) => draft.id !== id).map((draft) => (draft.id === target.id ? merged : draft));
    });
    setStatus("Parsed cards merged. Review the combined allocation before approval.");
  }

  function deleteDraftCard(id: string) {
    setDraftCards((current) => {
      const next = current.filter((draft) => draft.id !== id);
      persistDraftButtonStatus(next);
      return next;
    });
    setStatus("Parsed card deleted from AI review summary.");
  }

  function approveDraftCard(id: string) {
    const draft = draftCards.find((item) => item.id === id);
    if (hasSubjectTimeSplit && draft) {
      setUnitStudyAllocations(unitStudyRowsFromAllocations(draft.subjectAllocations));
    }
    setDraftCards((current) => {
      const next: DraftCard[] = current.map((item) => (item.id === id ? { ...item, status: "approved" as const } : item));
      persistDraftButtonStatus(next);
      return next;
    });
    setStatus(
      hasSubjectTimeSplit
        ? "Parsed card approved and its subject split was applied to Step 2. Use Save Approved when the daily record is ready."
        : "Parsed card approved for parent review. Use Save Approved when the daily record is ready to become permanent."
    );
  }

  function updateWeeklyData<K extends keyof WeeklyReviewData>(key: K, value: WeeklyReviewData[K]) {
    setWeeklyData((current) => ({ ...current, [key]: value }));
  }

  function markWeeklySectionReviewed(section: WeeklyReviewSection) {
    setReviewedWeeklySections((current) => (current.includes(section) ? current : [...current, section]));
    setWeeklyStatusMessage(`${weeklySectionLabels[section]} marked reviewed.`);
  }

  function markQuarterSectionReviewed(section: WeeklyReviewSection) {
    setReviewedQuarterSections((current) => (current.includes(section) ? current : [...current, section]));
    setQuarterStatusMessage(`${weeklySectionLabels[section]} marked reviewed for ${quarterLabel}.`);
  }

  function markAnnualReviewSectionReviewed(section: WeeklyReviewSection) {
    setReviewedAnnualReviewSections((current) => (current.includes(section) ? current : [...current, section]));
    setAnnualReviewStatusMessage(`${weeklySectionLabels[section]} marked reviewed for Annual Review.`);
  }

  function updateQuarterData<K extends keyof QuarterReviewData>(key: K, value: QuarterReviewData[K]) {
    setQuarterData((current) => ({ ...current, [key]: value }));
  }

  function updateAnnualPlan(message: string, statusValue?: "draft" | "active" | "finalized" | "archived") {
    if (statusValue) setAnnualPlanStatus(statusValue);
    setAnnualPlanMessage(message);
  }

  function annualPlanPayload(finalizedSections = finalizedAnnualPlanSections): AnnualPlanSaveData {
    return {
      annualPlanBigPicture,
      curriculumSpines,
      weeklyRhythmDays,
      unitPlanRows,
      unitStudyPlanners,
      journalPortfolioCards,
      annualRecordCards,
      finalizedAnnualPlanSections: finalizedSections
    };
  }

  const applyAnnualPlanData = useCallback((data: Partial<AnnualPlanSaveData>) => {
    if (data.annualPlanBigPicture) setAnnualPlanBigPicture(data.annualPlanBigPicture);
    if (data.curriculumSpines) setCurriculumSpines(data.curriculumSpines);
    if (data.weeklyRhythmDays) setWeeklyRhythmDays(data.weeklyRhythmDays);
    if (data.unitPlanRows) setUnitPlanRows(data.unitPlanRows);
    if (data.unitStudyPlanners) setUnitStudyPlanners(data.unitStudyPlanners);
    if (data.journalPortfolioCards) setJournalPortfolioCards(data.journalPortfolioCards);
    if (data.annualRecordCards) setAnnualRecordCards(data.annualRecordCards);
    if (data.finalizedAnnualPlanSections) setFinalizedAnnualPlanSections(data.finalizedAnnualPlanSections);
  }, []);

  async function saveAnnualPlan(statusValue = annualPlanStatus, message = "Annual Plan saved.", finalizedSections = finalizedAnnualPlanSections) {
    setIsAnnualPlanSaving(true);
    try {
      const response = await fetch("/api/annual-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          schoolYearStatus,
          officialHomeschoolStartDate: officialStartDate,
          status: statusValue,
          recordStatus: schoolYearStatus,
          data: annualPlanPayload(finalizedSections)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Annual Plan save failed.");
      setAnnualPlanStatus(data.plan.status);
      setAnnualPlanMessage(message);
    } catch (error) {
      setAnnualPlanMessage(friendlyError(error, "Annual Plan save failed. Refresh the page and try again."));
    } finally {
      setIsAnnualPlanSaving(false);
    }
  }

  function finalizeAnnualPlanSection(id: AnnualPlanSectionId) {
    const section = annualPlanSections.find((item) => item.id === id);
    const nextSections = finalizedAnnualPlanSections.includes(id) ? finalizedAnnualPlanSections : [...finalizedAnnualPlanSections, id];
    setFinalizedAnnualPlanSections(nextSections);
    void saveAnnualPlan(annualPlanStatus, `${section?.summary ?? "Annual Plan section"} finalized and saved. Its landing button is now green.`, nextSections);
  }

  function updatePlanner(updater: (planner: UnitStudyPlanner) => UnitStudyPlanner) {
    setUnitStudyPlanners((current) => {
      const row = unitPlanRows.find((item) => plannerKey(item.title) === activePlannerUnitKey) ?? unitPlanRows[0];
      const currentPlanner = current[activePlannerUnitKey] ?? makeUnitPlanner(row);
      return { ...current, [activePlannerUnitKey]: updater(currentPlanner) };
    });
  }

  function updatePlannerField<K extends keyof Omit<UnitStudyPlanner, "weeks">>(key: K, value: UnitStudyPlanner[K]) {
    updatePlanner((planner) => ({ ...planner, [key]: value }));
  }

  function updatePlannerWeek<K extends keyof Omit<UnitPlannerWeek, "days">>(weekIndex: number, key: K, value: UnitPlannerWeek[K]) {
    updatePlanner((planner) => ({
      ...planner,
      weeks: planner.weeks.map((week, index) => (index === weekIndex ? { ...week, [key]: value } : week))
    }));
  }

  function updatePlannerActivity(weekIndex: number, dayIndex: number, activityId: string, patch: Partial<UnitPlannerActivity>) {
    updatePlanner((planner) => ({
      ...planner,
      weeks: planner.weeks.map((week, weekPosition) =>
        weekPosition === weekIndex
          ? {
              ...week,
              days: week.days.map((day, dayPosition) =>
                dayPosition === dayIndex
                  ? {
                      ...day,
                      complete: false,
                      activities: day.activities.map((activity) => (activity.id === activityId ? { ...activity, ...patch } : activity))
                    }
                  : day
              )
            }
          : week
      )
    }));
  }

  function addPlannerActivity(weekIndex: number, dayIndex: number) {
    const planner = unitStudyPlanners[activePlannerUnitKey];
    const activityCount = planner?.weeks[weekIndex]?.days[dayIndex]?.activities.length ?? 0;
    const newActivity = newPlannerActivity(weekIndex, dayIndex, activityCount);
    updatePlanner((planner) => ({
      ...planner,
      weeks: planner.weeks.map((week, weekPosition) =>
        weekPosition === weekIndex
          ? {
              ...week,
              complete: false,
              days: week.days.map((day, dayPosition) =>
                dayPosition === dayIndex
                  ? {
                      ...day,
                      complete: false,
                      activities: [...day.activities, newActivity]
                    }
                  : day
              )
            }
          : week
      )
    }));
    setSelectedPlannerActivity({ weekIndex, dayIndex, activityId: newActivity.id });
    setPlannerMoveTarget({ week: "", day: "" });
  }

  function addFridayTemplate(weekIndex: number, dayIndex: number) {
    updatePlanner((planner) => ({
      ...planner,
      weeks: planner.weeks.map((week, weekPosition) =>
        weekPosition === weekIndex
          ? {
              ...week,
              complete: false,
              days: week.days.map((day, dayPosition) => {
                if (dayPosition !== dayIndex) return day;
                const existingTitles = new Set(day.activities.map((activity) => activity.title.trim().toLowerCase()));
                const templateActivities = fridayTemplateActivityTitles
                  .filter((title) => !existingTitles.has(title.toLowerCase()))
                  .map((title, templateIndex) => newPlannerActivity(weekIndex, dayIndex, day.activities.length + templateIndex, title));
                return templateActivities.length
                  ? { ...day, complete: false, activities: [...day.activities, ...templateActivities] }
                  : day;
              })
            }
          : week
      )
    }));
  }

  function deletePlannerActivity(weekIndex: number, dayIndex: number, activityId: string) {
    updatePlanner((planner) => ({
      ...planner,
      weeks: planner.weeks.map((week, weekPosition) =>
        weekPosition === weekIndex
          ? {
              ...week,
              complete: false,
              days: week.days.map((day, dayPosition) =>
                dayPosition === dayIndex
                  ? { ...day, complete: false, activities: day.activities.filter((activity) => activity.id !== activityId) }
                  : day
              )
            }
          : week
      )
    }));
    setSelectedPlannerActivity((current) => (current?.activityId === activityId ? null : current));
  }

  function movePlannerActivityToPosition(sourceWeekIndex: number, sourceDayIndex: number, activityId: string, targetWeekIndex: number, targetDayIndex: number, targetIndex: number) {
    const planner = unitStudyPlanners[activePlannerUnitKey];
    const activity = planner?.weeks[sourceWeekIndex]?.days[sourceDayIndex]?.activities.find((item) => item.id === activityId);
    if (!planner || !activity) return;

    updatePlanner((currentPlanner) => ({
      ...currentPlanner,
      weeks: currentPlanner.weeks.map((week, weekPosition) => ({
        ...week,
        complete: false,
        days: week.days.map((day, dayPosition) => {
          const isSource = weekPosition === sourceWeekIndex && dayPosition === sourceDayIndex;
          const isTarget = weekPosition === targetWeekIndex && dayPosition === targetDayIndex;
          let activities = isSource ? day.activities.filter((item) => item.id !== activityId) : [...day.activities];
          if (isTarget) {
            const boundedIndex = Math.min(Math.max(targetIndex, 0), activities.length);
            activities = [...activities.slice(0, boundedIndex), activity, ...activities.slice(boundedIndex)];
          }
          return isSource || isTarget ? { ...day, complete: false, activities } : day;
        })
      }))
    }));
  }

  function handlePlannerActivityDragStart(event: DragEvent<HTMLButtonElement>, weekIndex: number, dayIndex: number, activityId: string) {
    event.stopPropagation();
    event.dataTransfer.setData("text/plain", JSON.stringify({ weekIndex, dayIndex, activityId }));
    event.dataTransfer.effectAllowed = "move";
  }

  function handlePlannerActivityDrop(event: DragEvent<HTMLElement>, targetWeekIndex: number, targetDayIndex: number, targetIndex?: number) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as SelectedPlannerActivity & { kind?: string };
      if (parsed.kind === "day") {
        if (parsed.weekIndex === targetWeekIndex && typeof parsed.dayIndex === "number") reorderPlannerDay(targetWeekIndex, parsed.dayIndex, targetDayIndex);
        return;
      }
      if (typeof parsed.weekIndex !== "number" || typeof parsed.dayIndex !== "number" || !parsed.activityId) return;
      const targetActivities = unitStudyPlanners[activePlannerUnitKey]?.weeks[targetWeekIndex]?.days[targetDayIndex]?.activities ?? [];
      movePlannerActivityToPosition(parsed.weekIndex, parsed.dayIndex, parsed.activityId, targetWeekIndex, targetDayIndex, targetIndex ?? targetActivities.length);
    } catch {
      return;
    }
  }

  function reorderPlannerDay(weekIndex: number, sourceDayIndex: number, targetDayIndex: number) {
    if (sourceDayIndex === targetDayIndex) return;
    updatePlanner((planner) => ({
      ...planner,
      weeks: planner.weeks.map((week, index) => {
        if (index !== weekIndex) return week;
        const days = [...week.days];
        const [movedDay] = days.splice(sourceDayIndex, 1);
        days.splice(targetDayIndex, 0, movedDay);
        return { ...week, complete: false, days: days.map((day) => ({ ...day, complete: false })) };
      })
    }));
    setSelectedPlannerActivity(null);
  }

  function handlePlannerDayDragStart(event: DragEvent<HTMLElement>, weekIndex: number, dayIndex: number) {
    event.dataTransfer.setData("text/plain", JSON.stringify({ kind: "day", weekIndex, dayIndex }));
    event.dataTransfer.effectAllowed = "move";
  }

  function movePlannerActivityToWeekDay(weekIndex: number, dayIndex: number, activityId: string, targetWeek: string, targetDay: string) {
    const targetWeekIndex = Number.parseInt(targetWeek, 10) - 1;
    const targetDayIndex = Number.parseInt(targetDay, 10) - 1;
    if (
      !Number.isInteger(targetWeekIndex) ||
      !Number.isInteger(targetDayIndex) ||
      targetWeekIndex < 0 ||
      targetWeekIndex >= activePlanner.weeks.length ||
      targetDayIndex < 0 ||
      targetDayIndex > 4
    ) {
      setAnnualPlanMessage(`Choose a week from 1-${activePlanner.weeks.length} and a day from 1-5 inside this unit.`);
      return;
    }
    const targetActivities = activePlanner.weeks[targetWeekIndex]?.days[targetDayIndex]?.activities ?? [];
    movePlannerActivityToPosition(weekIndex, dayIndex, activityId, targetWeekIndex, targetDayIndex, targetActivities.length);
    setActivePlannerWeekIndex(targetWeekIndex);
    setPlannerMoveTarget({ week: "", day: "" });
  }

  function movePlannerActivity(weekIndex: number, dayIndex: number, activityId: string) {
    const planner = unitStudyPlanners[activePlannerUnitKey];
    const activity = planner?.weeks[weekIndex]?.days[dayIndex]?.activities.find((item) => item.id === activityId);
    if (!planner || !activity) return;
    const targetWeek = Number(window.prompt(`Move to week number 1-${planner.weeks.length}`, String(weekIndex + 1))) - 1;
    const targetDay = Number(window.prompt("Move to day number 1-5", String(dayIndex + 1))) - 1;
    if (!Number.isInteger(targetWeek) || !Number.isInteger(targetDay) || targetWeek < 0 || targetWeek >= planner.weeks.length || targetDay < 0 || targetDay >= 5) return;

    updatePlanner((currentPlanner) => ({
      ...currentPlanner,
      weeks: currentPlanner.weeks.map((week, weekPosition) => ({
        ...week,
        complete: false,
        days: week.days.map((day, dayPosition) => {
          const withoutMoved = weekPosition === weekIndex && dayPosition === dayIndex
            ? day.activities.filter((item) => item.id !== activityId)
            : day.activities;
          const withMoved = weekPosition === targetWeek && dayPosition === targetDay
            ? [...withoutMoved, { ...activity, id: `planner-activity-${Date.now()}`, status: "moved" as UnitPlannerActivityStatus }]
            : withoutMoved;
          return { ...day, complete: false, activities: withMoved };
        })
      }))
    }));
  }

  function activityIsDone(activity: UnitPlannerActivity) {
    return activity.status === "complete" || activity.status === "skipped";
  }

  function completePlannerDay(weekIndex: number, dayIndex: number) {
    updatePlanner((planner) => ({
      ...planner,
      weeks: planner.weeks.map((week, weekPosition) =>
        weekPosition === weekIndex
          ? {
              ...week,
              days: week.days.map((day, dayPosition) =>
                dayPosition === dayIndex ? { ...day, complete: day.activities.every(activityIsDone) } : day
              )
            }
          : week
      )
    }));
  }

  function completePlannerWeek(weekIndex: number) {
    updatePlanner((planner) => ({
      ...planner,
      weeks: planner.weeks.map((week, index) => (index === weekIndex ? { ...week, complete: week.days.every((day) => day.complete) } : week))
    }));
  }

  function startPlannerUnit() {
    updatePlanner((planner) => ({ ...planner, startMonday: todayIso(), status: "active" }));
    setUnitPlanRows((current) =>
      current.map((row) => {
        if (plannerKey(row.title) === activePlannerUnitKey) return { ...row, status: "active" };
        if (row.status === "active") return { ...row, status: "upcoming" };
        return row;
      })
    );
  }

  function completePlannerUnit() {
    updatePlanner((planner) => ({ ...planner, status: "complete" }));
    setUnitPlanRows((current) => current.map((row) => (plannerKey(row.title) === activePlannerUnitKey ? { ...row, status: "complete" } : row)));
  }

  function sendPlannerDayToDailyRecords(weekIndex: number, dayIndex: number) {
    const planner = unitStudyPlanners[activePlannerUnitKey];
    const day = planner?.weeks[weekIndex]?.days[dayIndex];
    if (!planner || !day) return;
    const completedActivities = day.activities.filter((activity) => activity.status === "complete");
    const narrationText = (completedActivities.length ? completedActivities : day.activities)
      .map((activity) => `${activity.title}: ${activity.description || activity.prepNotes || "Completed planned unit-study activity."}`)
      .join("\n\n");
    const minutes = Math.max(
      1,
      (completedActivities.length ? completedActivities : day.activities).reduce((sum, activity) => sum + activity.expectedMinutes, 0)
    );

    setActiveTab("daily");
    selectActivityType("Unit Study");
    setUnitStudy(planner.unitTitle);
    setTitle(`${planner.unitTitle} - Week ${weekIndex + 1} Day ${dayIndex + 1}`);
    setActualMinutes(minutes);
    setUnitStudyAllocations([{ id: `subject-allocation-${Date.now()}`, subject: "", minutes }]);
    setNarration(narrationText);
    setStatus(`Week ${weekIndex + 1} Day ${dayIndex + 1} planner content was sent to Daily Records as a Unit Study draft. Edit subject time, proof, and narration before saving.`);
  }

  function openUnitPlanner(row: UnitPlanRow) {
    setActiveTab("unit-planner");
    setActivePlannerUnitKey(plannerKey(row.title));
    setActivePlannerWeekIndex(null);
    setSelectedPlannerActivity(null);
    setPlannerMoveTarget({ week: "", day: "" });
    setUnitStudy(row.title);
  }

  useEffect(() => {
    if (!student || !schoolYear) return;
    let isCurrent = true;

    async function loadSavedAnnualPlan() {
      setIsAnnualPlanLoading(true);
      try {
        const params = new URLSearchParams({ studentName: student, schoolYearLabel: schoolYear });
        const response = await fetch(`/api/annual-plan?${params.toString()}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Annual Plan load failed.");
        if (isCurrent && data.plan) {
          setAnnualPlanStatus(data.plan.status);
          applyAnnualPlanData(data.data ?? {});
          setAnnualPlanMessage(`Loaded saved Annual Plan for ${schoolYear}.`);
        }
      } catch (error) {
        if (isCurrent) setAnnualPlanMessage(friendlyError(error, "Annual Plan load failed. Refresh before editing the plan."));
      } finally {
        if (isCurrent) setIsAnnualPlanLoading(false);
      }
    }

    void loadSavedAnnualPlan();
    return () => {
      isCurrent = false;
    };
  }, [applyAnnualPlanData, schoolYear, student]);

  useEffect(() => {
    setUnitPlanRows((current) => {
      let changed = false;
      const nextRows = current.map((row) => {
        const planner = unitStudyPlanners[plannerKey(row.title)];
        const preservedWeeks = preservedPlannerWeekCount(row, planner);
        if (String(preservedWeeks) === row.weeks) return row;
        changed = true;
        return { ...row, weeks: String(preservedWeeks) };
      });
      return changed ? nextRows : current;
    });
  }, [unitStudyPlanners]);

  useEffect(() => {
    setUnitStudyPlanners((current) => {
      let changed = false;
      const next = { ...current };
      unitPlanRows.forEach((row) => {
        const key = plannerKey(row.title);
        const currentPlanner = next[key] ?? makeUnitPlanner(row);
        const weeksExpected = preservedPlannerWeekCount(row, currentPlanner);
        const weeks = [...currentPlanner.weeks];
        while (weeks.length < weeksExpected) weeks.push(makePlannerWeek(weeks.length, row.title));
        const syncedPlanner: UnitStudyPlanner = {
          ...currentPlanner,
          unitTitle: row.title,
          weeksExpected,
          unitQuestion: row.guidingQuestion || currentPlanner.unitQuestion,
          weeks
        };
        const didChange =
          !next[key] ||
          currentPlanner.unitTitle !== syncedPlanner.unitTitle ||
          currentPlanner.weeksExpected !== syncedPlanner.weeksExpected ||
          currentPlanner.unitQuestion !== syncedPlanner.unitQuestion ||
          currentPlanner.weeks.length !== syncedPlanner.weeks.length;
        if (didChange) {
          changed = true;
          next[key] = syncedPlanner;
        }
      });
      return changed ? next : current;
    });
  }, [unitPlanRows]);

  useEffect(() => {
    if (activeTab !== "unit-planner" || isAnnualPlanLoading) return;
    const timer = window.setTimeout(async () => {
      setIsAnnualPlanSaving(true);
      try {
        const response = await fetch("/api/annual-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentName: student,
            schoolYearLabel: schoolYear,
            schoolYearStatus,
            officialHomeschoolStartDate: officialStartDate,
            status: annualPlanStatus,
            recordStatus: schoolYearStatus,
            data: {
              annualPlanBigPicture,
              curriculumSpines,
              weeklyRhythmDays,
              unitPlanRows,
              unitStudyPlanners,
              journalPortfolioCards,
              annualRecordCards,
              finalizedAnnualPlanSections
            }
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unit Study Planner autosave failed.");
        setAnnualPlanStatus(data.plan.status);
        setAnnualPlanMessage("Unit Study Planner autosaved with Annual Plan data.");
      } catch (error) {
        setAnnualPlanMessage(friendlyError(error, "Unit Study Planner autosave failed. Refresh before continuing planner edits."));
      } finally {
        setIsAnnualPlanSaving(false);
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [
    activeTab,
    annualPlanBigPicture,
    annualPlanStatus,
    annualRecordCards,
    curriculumSpines,
    finalizedAnnualPlanSections,
    isAnnualPlanLoading,
    journalPortfolioCards,
    officialStartDate,
    schoolYear,
    schoolYearStatus,
    student,
    unitPlanRows,
    unitStudyPlanners,
    weeklyRhythmDays
  ]);

  function updateAnnualPlanBigPicture<K extends keyof AnnualPlanBigPicture>(key: K, value: AnnualPlanBigPicture[K]) {
    setAnnualPlanBigPicture((current) => ({ ...current, [key]: value }));
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
    setUnitPlanRows((current) => {
      if (key === "status" && value === "active") {
        return current.map((item) => {
          if (item.id === id) return { ...item, status: "active" };
          if (item.status === "active") return { ...item, status: "upcoming" };
          return item;
        });
      }
      return current.map((item) => (item.id === id ? { ...item, [key]: value } : item));
    });
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

  function updateAnnualRecordCard(id: string, key: "title" | "narrative", value: string) {
    setAnnualRecordCards((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function addAnnualRecordCard() {
    const id = `annual-record-${Date.now()}`;
    setAnnualRecordCards((current) => [
      ...current,
      {
        id,
        title: "New Annual Record",
        narrative: "Describe the annual record, why it matters, and what attached documents should be preserved.",
        attachments: []
      }
    ]);
    setEditingAnnualRecordId(id);
  }

  function deleteAnnualRecordCard(id: string) {
    setAnnualRecordCards((current) => current.filter((item) => item.id !== id));
    setEditingAnnualRecordId((current) => (current === id ? null : current));
  }

  function moveAnnualRecordCard(id: string, direction: -1 | 1) {
    setAnnualRecordCards((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  function removeAnnualRecordAttachment(cardId: string, artifactId: string) {
    setAnnualRecordCards((current) =>
      current.map((card) =>
        card.id === cardId
          ? { ...card, attachments: card.attachments.filter((artifact) => artifact.id !== artifactId) }
          : card
      )
    );
  }

  async function uploadAnnualRecordAttachment(cardId: string, file: File) {
    setIsAnnualPlanBusy(true);
    setAnnualPlanMessage(`Uploading ${file.name} to the selected annual record card...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("recordStatus", schoolYearStatus);
      formData.append("tagsJson", JSON.stringify({ section: "annual_records", schoolYear, student }));

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData
      });
      const data = await response.json().catch(() => ({ error: "Annual record upload failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Annual record upload failed.");

      const artifact = data.artifact as UploadedArtifact;
      setAnnualRecordCards((current) =>
        current.map((card) =>
          card.id === cardId ? { ...card, attachments: [...card.attachments, artifact] } : card
        )
      );
      setAnnualPlanMessage(`${file.name} attached to Annual Records. It will be included when you generate the Annual Plan PDF.`);
    } catch (error) {
      setAnnualPlanMessage(friendlyError(error, "Annual record upload failed. Try the upload again."));
    } finally {
      setIsAnnualPlanBusy(false);
    }
  }

  async function exportAnnualPlanPdf() {
    setIsAnnualPlanBusy(true);
    setAnnualPlanMessage("Generating Annual Plan PDF with annual record attachments...");
    setLastAnnualPlanPdfArtifact(null);
    try {
      const response = await fetch("/api/annual-plan/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student,
          schoolYear,
          status: annualPlanStatus,
          bigPicture: annualPlanBigPicture,
          curriculumSpines,
          weeklyRhythmDays,
          unitPlanRows,
          journalPortfolioCards,
          annualRecordCards
        })
      });
      const data = await response.json().catch(() => ({ error: "Annual Plan PDF generation failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Annual Plan PDF generation failed.");
      setLastAnnualPlanPdfArtifact(data.artifact);
      window.open(`/api/artifacts/${data.artifact.id}/download`, "_blank", "noopener,noreferrer");
      setAnnualPlanMessage(`${data.artifact.originalName} was generated with Section 7 attachments and saved to Reports.`);
    } catch (error) {
      setAnnualPlanMessage(friendlyError(error, "Annual Plan PDF generation failed. Save the plan, then try again."));
    } finally {
      setIsAnnualPlanBusy(false);
    }
  }

  async function exportDailySummaryPdf() {
    const defaultTitle = `Daily Summary ${formatUsDate(selectedDate)}`;
    const requestedTitle = window.prompt("Name this Daily Summary PDF for Reports.", defaultTitle);
    if (requestedTitle === null) return;
    const reportTitle = requestedTitle.trim() || defaultTitle;

    setIsDailyPdfBusy(true);
    setLastDailyPdfArtifact(null);
    setStatus(`Creating ${reportTitle}...`);
    const pdfWindow = window.open("about:blank", "_blank");
    if (pdfWindow) {
      pdfWindow.opener = null;
      pdfWindow.document.write("<p style=\"font-family: sans-serif; padding: 24px;\">Preparing daily summary PDF...</p>");
    }
    try {
      const latestActivities = await loadSavedActivities(selectedDate, { silent: true });
      const activitiesForPdf = latestActivities.length ? latestActivities : savedActivities;
      if (!activitiesForPdf.length) {
        const missingMessage = `No saved activity records found for ${formatUsDate(selectedDate)}. Parsed cards and green-looking buttons are not permanent records until Save Approved is selected for each activity.`;
        if (pdfWindow) {
          pdfWindow.document.body.innerHTML = `<p style="font-family: sans-serif; padding: 24px;">${missingMessage}</p>`;
        }
        setStatus(missingMessage);
        return;
      }

      if (pdfWindow) {
        pdfWindow.document.body.innerHTML = "<p style=\"font-family: sans-serif; padding: 24px;\">Creating daily summary PDF...</p>";
      }
      const response = await fetch("/api/daily-summary/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student,
          schoolYearLabel: schoolYear,
          date: selectedDate,
          recordStatus: schoolYearStatus,
          reportTitle
        })
      });
      const data = await response.json().catch(() => ({ error: "Daily summary PDF generation failed before the app received details." }));
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Daily summary PDF generation failed.");
      setLastDailyPdfArtifact(data.artifact);
      setPortfolioArtifacts((current) => {
        if (current.some((artifact) => artifact.id === data.artifact.id)) return current;
        return [{ ...data.artifact, activity: null } as PortfolioArtifact, ...current];
      });
      const pdfUrl = `${window.location.origin}/api/artifacts/${data.artifact.id}/download`;
      if (pdfWindow) {
        pdfWindow.location.href = pdfUrl;
      } else {
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
      }
      setStatus(`${data.artifact.originalName} was saved to Reports and is ready to open.`);
      await loadPortfolio();
    } catch (error) {
      const message = friendlyError(error, "Daily summary PDF generation failed. Confirm approved activities exist for this date.");
      if (pdfWindow) {
        pdfWindow.document.body.innerHTML = `<p style="font-family: sans-serif; padding: 24px;">${message}</p>`;
      }
      setStatus(message);
    } finally {
      setIsDailyPdfBusy(false);
    }
  }

  async function completeDay() {
    setIsCompletingDay(true);
    setStatus(`Completing saved activities for ${formatUsDate(selectedDate)}...`);
    try {
      const latestActivities = await loadSavedActivities(selectedDate);
      const activitiesForStatus = latestActivities.length ? latestActivities : savedActivities;
      if (!activitiesForStatus.length) {
        setStatus(`No saved activities found for ${formatUsDate(selectedDate)}. Save activities before completing the day.`);
        return;
      }
      setSavedActivities(activitiesForStatus);

      const statusByType = new Map<string, LiveActivityButtonState>();
      activitiesForStatus.forEach((activity) => {
        const current = statusByType.get(activity.activityType);
        if (activity.parentApproved) {
          statusByType.set(activity.activityType, "completed");
        } else if (current !== "completed") {
          statusByType.set(activity.activityType, "needs-review");
        }
      });

      await Promise.all(
        Array.from(statusByType.entries()).map(([activityType, statusValue]) =>
          persistActivityButtonStatus(activityType, statusValue, selectedDate)
        )
      );
      await loadDailyActivityButtonStatuses(selectedDate);
      const completedCount = Array.from(statusByType.values()).filter((statusValue) => statusValue === "completed").length;
      setStatus(
        `Day completed for ${formatUsDate(selectedDate)}. ${completedCount} activity button${completedCount === 1 ? "" : "s"} marked complete from saved approved records. Compile PDF is ready for the completed records.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Complete day failed.");
    } finally {
      setIsCompletingDay(false);
    }
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
    setWeeklyStatusMessage("Compiling weekly review PDF and saving it to Reports...");
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
      setWeeklyStatusMessage(`${data.artifact.originalName} was saved to Reports and is ready to open.`);
    } catch (error) {
      setWeeklyStatusMessage(friendlyError(error, "Weekly PDF generation failed. Save the weekly review, then try again."));
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
    setQuarterStatusMessage("Compiling quarter review PDF and saving it to Reports...");
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
      setQuarterStatusMessage(`${data.artifact.originalName} was saved to Reports and is ready to open.`);
    } catch (error) {
      setQuarterStatusMessage(friendlyError(error, "Quarter PDF generation failed. Save the quarter review, then try again."));
    } finally {
      setIsQuarterBusy(false);
    }
  }

  const portfolioNodes = useMemo<PortfolioNode[]>(() => {
    const proofArtifacts = portfolioArtifacts.filter((artifact) => !isReportArtifact(artifact) && !isPortfolioListArchive(artifact));
    const countBy = (getKey: (artifact: PortfolioArtifact) => string | null) => {
      const counts = new Map<string, number>();
      proofArtifacts.forEach((artifact) => {
        const key = getKey(artifact);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return counts;
    };

    const years = countBy((artifact) => artifact.activity?.schoolYear.label ?? null);
    const units = countBy((artifact) => artifact.activity?.unitStudy?.title ?? null);
    const subjects = countBy((artifact) => artifact.activity?.allocations[0]?.subject ?? null);
    const legalTags = countBy((artifact) => artifact.activity?.legalTags[0]?.legalTag.label ?? null);
    const unattachedCount = proofArtifacts.filter((artifact) => !artifact.activity).length;

    return [
      { key: "all", label: "All proof files", count: proofArtifacts.length, level: 0 },
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
    const proofArtifacts = portfolioArtifacts.filter((artifact) => !isReportArtifact(artifact) && !isPortfolioListArchive(artifact));
    if (selectedPortfolioKey === "all") return proofArtifacts;
    if (selectedPortfolioKey === "unattached") return proofArtifacts.filter((artifact) => !artifact.activity);
    if (!selectedPortfolioKey.includes(":")) return proofArtifacts;

    const [type, value] = selectedPortfolioKey.split(/:(.*)/s);
    return proofArtifacts.filter((artifact) => {
      if (type === "year") return artifact.activity?.schoolYear.label === value;
      if (type === "unit") return artifact.activity?.unitStudy?.title === value;
      if (type === "subject") return artifact.activity?.allocations.some((allocation) => allocation.subject === value);
      if (type === "legal") return artifact.activity?.legalTags.some((item) => item.legalTag.label === value);
      return true;
    });
  }, [portfolioArtifacts, selectedPortfolioKey]);

  const selectedPortfolioNode = portfolioNodes.find((node) => node.key === selectedPortfolioKey);
  const portfolioArchiveArtifacts = useMemo(
    () => (section: Exclude<PortfolioSection, "proof">) =>
      portfolioArtifacts.filter((artifact) => artifact.classification === portfolioArchiveClassifications[section]),
    [portfolioArtifacts]
  );
  const activeWorkspace = workspaceTabs.find((tab) => tab.key === activeTab) ?? workspaceTabs[0];
  const activePlannerRow = unitPlanRows.find((row) => plannerKey(row.title) === activePlannerUnitKey) ?? unitPlanRows[0];
  const activePlanner = unitStudyPlanners[activePlannerUnitKey] ?? makeUnitPlanner(activePlannerRow);
  const activePlannerWeek =
    activePlannerWeekIndex === null
      ? null
      : activePlanner.weeks[Math.min(activePlannerWeekIndex, activePlanner.weeks.length - 1)] ?? activePlanner.weeks[0];
  const selectedPlannerActivityWeek = selectedPlannerActivity ? activePlanner.weeks[selectedPlannerActivity.weekIndex] ?? null : null;
  const selectedPlannerActivityDay = selectedPlannerActivityWeek && selectedPlannerActivity ? selectedPlannerActivityWeek.days[selectedPlannerActivity.dayIndex] ?? null : null;
  const selectedPlannerActivityCard =
    selectedPlannerActivityDay && selectedPlannerActivity
      ? selectedPlannerActivityDay.activities.find((activity) => activity.id === selectedPlannerActivity.activityId) ?? null
      : null;
  const activePlannerActivityShoppingItems =
    activePlannerWeek
      ? activePlannerWeek.days
          .flatMap((day) =>
            day.activities
              .flatMap((activity) => activity.shoppingList.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))
              .filter(Boolean)
          )
      : [];
  const plannerDateForDay = (weekIndex: number, dayIndex: number) =>
    activePlanner.startMonday ? addDaysIso(activePlanner.startMonday, weekIndex * 7 + dayIndex) : "";
  const reportBucketRows = useMemo(
    () =>
      reportBuckets.map((bucket) => {
        const artifacts = portfolioArtifacts.filter((artifact) => {
          if (bucket.key === "other") return isReportArtifact(artifact) && !reportBuckets.some((item) => item.key !== "other" && item.classifications.includes(artifact.classification ?? ""));
          return bucket.classifications.includes(artifact.classification ?? "");
        });
        return { ...bucket, artifacts };
      }),
    [portfolioArtifacts]
  );
  const schoolYearActivities = useMemo(
    () => allSavedActivities.filter((activity) => activity.schoolYear?.label === schoolYear),
    [allSavedActivities, schoolYear]
  );
  const weeklyReviewTicker = useMemo(() => {
    const start = weeklyStartDate;
    const end = addDaysIso(weeklyStartDate, 6);
    const activities = schoolYearActivities.filter((activity) => activity.date.slice(0, 10) >= start && activity.date.slice(0, 10) <= end);
    const totalMinutes = activities.filter((activity) => activity.parentApproved).reduce((sum, activity) => sum + activity.actualMinutes, 0);
    return {
      totalMinutes,
      meaningfulDays: meaningfulDaysInRange(activities, start, end),
      weekendDays: weekendMeaningfulDaysInRange(activities, start, end),
      weekdays: weekdaysInRange(start, end)
    };
  }, [schoolYearActivities, weeklyStartDate]);
  const quarterReviewTicker = useMemo(() => {
    const start = quarterStartDate;
    const end = addDaysIso(quarterStartDate, 62);
    const activities = schoolYearActivities.filter((activity) => activity.date.slice(0, 10) >= start && activity.date.slice(0, 10) <= end);
    const totalMinutes = activities.filter((activity) => activity.parentApproved).reduce((sum, activity) => sum + activity.actualMinutes, 0);
    return {
      totalMinutes,
      meaningfulDays: meaningfulDaysInRange(activities, start, end),
      weekendDays: weekendMeaningfulDaysInRange(activities, start, end),
      weekdays: weekdaysInRange(start, end)
    };
  }, [quarterStartDate, schoolYearActivities]);
  const annualReviewTicker = useMemo(() => {
    const startYear = schoolYearStartYear(schoolYear);
    const start = `${startYear}-08-15`;
    const end = `${startYear + 1}-06-15`;
    const activities = schoolYearActivities.filter((activity) => activity.date.slice(0, 10) >= start && activity.date.slice(0, 10) <= end);
    const totalMinutes = activities.filter((activity) => activity.parentApproved).reduce((sum, activity) => sum + activity.actualMinutes, 0);
    return {
      start,
      end,
      totalMinutes,
      meaningfulDays: meaningfulDaysInRange(activities, start, end),
      weekendDays: weekendMeaningfulDaysInRange(activities, start, end),
      weekdays: weekdaysInRange(start, end),
      activities: activities.filter((activity) => activity.parentApproved).length,
      daysWithRecords: new Set(activities.filter((activity) => activity.parentApproved).map((activity) => activity.date.slice(0, 10))).size
    };
  }, [schoolYear, schoolYearActivities]);
  const educationDayTicker = useMemo(() => {
    const startYear = schoolYearStartYear(schoolYear);
    const traditionalStart = `${startYear}-08-15`;
    const traditionalEnd = `${startYear + 1}-06-15`;
    const summerStart = `${startYear + 1}-06-16`;
    const summerEnd = `${startYear + 1}-08-14`;
    const dayTotals = new Map<string, number>();

    allSavedActivities
      .filter((activity) => activity.parentApproved && activity.schoolYear?.label === schoolYear)
      .forEach((activity) => {
        const day = activity.date.slice(0, 10);
        dayTotals.set(day, (dayTotals.get(day) ?? 0) + activity.actualMinutes);
      });

    const meaningfulDays = Array.from(dayTotals.entries()).filter(([, minutes]) => minutes >= 180).map(([day]) => day);
    return {
      traditionalStart,
      traditionalEnd,
      summerStart,
      summerEnd,
      traditionalCount: meaningfulDays.filter((day) => day >= traditionalStart && day <= traditionalEnd).length,
      summerCount: meaningfulDays.filter((day) => day >= summerStart && day <= summerEnd).length
    };
  }, [allSavedActivities, schoolYear]);
  const activeLegalBucket = legalArchive.find((bucket) => bucket.bucketKey === activeLegalBucketKey);
  const legalArtifactOptions = useMemo(
    () =>
      portfolioArtifacts.filter(
        (artifact) =>
          artifact.mimeType.includes("pdf") ||
          isReportArtifact(artifact) ||
          artifact.classification === "legal_archive"
      ),
    [portfolioArtifacts]
  );
  const annualReviewSubjectTimeSummary = useMemo(() => {
    const totals: Record<string, number> = {};
    portfolioArtifacts.forEach((artifact) => {
      if (artifact.activity?.schoolYear.label !== schoolYear) return;
      artifact.activity.allocations.forEach((allocation) => {
        totals[allocation.subject] = (totals[allocation.subject] ?? 0) + allocation.minutes;
      });
    });
    return totals;
  }, [portfolioArtifacts, schoolYear]);
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
  const annualReviewSkillRows = Object.keys(annualReviewSubjectTimeSummary).length
    ? Object.keys(annualReviewSubjectTimeSummary).slice(0, 8)
    : ["Language Arts", "Math", "Science", "Social Studies"];
  const activeUnitStudyRow = unitPlanRows.find((row) => row.status === "active") ?? unitPlanRows[0];

  function switchToCurrentSchoolYear() {
    setSchoolYear(CURRENT_SCHOOL_YEAR_LABEL);
    setSchoolYearStatus(CURRENT_SCHOOL_YEAR_STATUS);
    setActiveTab("daily");
  }

  function switchToFutureSchoolYear(label: string) {
    const cleanRows = blankFutureUnitPlanRows(label);
    setSchoolYear(label);
    setSchoolYearStatus("planned");
    setUnitPlanRows(cleanRows);
    setUnitStudyPlanners(Object.fromEntries(cleanRows.map((row) => [plannerKey(row.title), makeUnitPlanner(row)])));
    setActivePlannerUnitKey(plannerKey(cleanRows[0].title));
    setActivePlannerWeekIndex(null);
    setSelectedPlannerActivity(null);
    setFinalizedAnnualPlanSections([]);
    setAnnualPlanStatus("draft");
    setAnnualPlanMessage(`${label} Annual Plan opened with a clean unit-study list.`);
    setActiveAnnualPlanSection("section-4");
    setActiveTab("annual-plan");
  }

  return (
    <main className="mockup-shell">
      <aside className={isMobileMenuOpen ? "sidebar is-mobile-open" : "sidebar"} aria-label="School year and unit study navigation">
        <div className="brand">
          <button
            className="brand-toggle"
            type="button"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((current) => !current)}
          >
            <span className="eyebrow">Private Homeschool Records</span>
            <strong>Bennett Homeschool</strong>
          </button>
        </div>

        <nav
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) setIsMobileMenuOpen(false);
          }}
        >
          <p className="tree-title">Active School Year</p>
          <ul className="tree">
            <li>
              <button className="tree-button is-context" type="button" onClick={() => setActiveTab("daily")}>
                {schoolYear} <span>2nd Grade</span>
              </button>
            </li>
          </ul>

          <details className="tree-section" open>
            <summary>Daily Rhythm</summary>
            <ul className="tree">
              <li><button className={activeTab === "daily" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("daily")}>Daily Records</button></li>
              <li>
                <button className={activeTab === "unit-planner" && activePlannerUnitKey === plannerKey(activeUnitStudyRow.title) ? "tree-button is-active" : "tree-button"} type="button" onClick={() => openUnitPlanner(activeUnitStudyRow)}>
                  Active Unit Study <span>{activeUnitStudyRow.title}</span>
                </button>
              </li>
              <li><button className={activeTab === "weekly" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("weekly")}>Weekly Reviews</button></li>
              <li><button className={activeTab === "portfolio" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("portfolio")}>Portfolio</button></li>
              <li><button className={activeTab === "tools" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("tools")}>Workspace Tools</button></li>
            </ul>
          </details>

          <details className="tree-section">
            <summary>Current Year Unit Planner</summary>
            <ul className="tree">
              {unitPlanRows.slice(0, 6).map((row) => (
                <li key={row.id}>
                  <button
                    className={activeTab === "unit-planner" && activePlannerUnitKey === plannerKey(row.title) ? "tree-button is-active" : row.status === "active" ? "tree-button is-context" : "tree-button"}
                    type="button"
                    onClick={() => openUnitPlanner(row)}
                  >
                    {row.title} <span>{row.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>

          <details className="tree-section">
            <summary>
              Admin Files
              {quarterAlert.label !== "No reminder" && quarterAlert.label !== "Complete" ? <span className="alert-sidebar-badge">{quarterAlert.label}</span> : null}
            </summary>
            <ul className="tree">
              <li>
                <button className={activeTab === "quarter" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("quarter")}>
                  Quarterly Review
                  {quarterAlert.label !== "No reminder" && quarterAlert.label !== "Complete" ? <span className="alert-sidebar-badge">{quarterAlert.label}</span> : null}
                </button>
              </li>
              <li><button className={activeTab === "annual-plan" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("annual-plan")}>Annual Plan</button></li>
              <li><button className={activeTab === "annual-review" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("annual-review")}>Annual Review</button></li>
              <li><button className={activeTab === "reports" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("reports")}>Reports</button></li>
              <li><button className={activeTab === "legal" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("legal")}>Legal Archive</button></li>
              <li><button className={activeTab === "records" ? "tree-button is-active" : "tree-button"} type="button" onClick={() => setActiveTab("records")}>Records & Snapshots</button></li>
            </ul>
          </details>

          <details className="tree-section">
            <summary>School Years</summary>
            <ul className="tree">
              <li>
                <button
                  className={schoolYear === CURRENT_SCHOOL_YEAR_LABEL ? "tree-button is-context" : "tree-button"}
                  type="button"
                  onClick={switchToCurrentSchoolYear}
                >
                  Current School Year <span>{CURRENT_SCHOOL_YEAR_LABEL}</span>
                </button>
              </li>
              <li>
                <details className="tree-subsection">
                  <summary>Future Years</summary>
                  <ul>
                    <li>
                      <button
                        className="tree-button"
                        type="button"
                        onClick={() => switchToFutureSchoolYear("2027-2028")}
                      >
                        2027-2028 <span>planned</span>
                      </button>
                    </li>
                    <li>
                      <button
                        className="tree-button"
                        type="button"
                        onClick={() => switchToFutureSchoolYear("2028-2029")}
                      >
                        2028-2029 <span>planned</span>
                      </button>
                    </li>
                  </ul>
                </details>
              </li>
              <li>
                <details className="tree-subsection">
                  <summary>Past Years</summary>
                  <ul>
                    <li><button className="tree-button" type="button">2025-2026 <span>archive</span></button></li>
                  </ul>
                </details>
              </li>
            </ul>
          </details>
        </nav>
      </aside>

      <section className="content">
        <details className="context-box context-details" aria-labelledby="context-title">
          <summary className="context-summary">
            <div>
              <p className="eyebrow">Active record context</p>
              <h2 id="context-title">Student and active unit</h2>
            </div>
            <div className="context-summary-fields">
              <span><strong>Student</strong>{student}</span>
              <span><strong>Active Unit Study</strong>{unitStudy}</span>
            </div>
          </summary>
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
            <label><span>Active unit study</span><input value={unitStudy} readOnly title="Set the active unit in Annual Plan, Section 4." /></label>
          </div>
        </details>

        <header className="page-header">
          <div>
            <p className="eyebrow">{activeWorkspace.eyebrow}</p>
            <h1>{activeWorkspace.headline}</h1>
            <p>{activeWorkspace.description}</p>
          </div>
        </header>

        <div className="workspace-view">
          <section className="primary-column">
            {activeTab === "unit-planner" ? (
            <section className="panel unit-planner-panel" id="unit-study-planner">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Unit Study</p>
                  <h2>Unit Study: {activePlanner.unitTitle}</h2>
                  <p className="panel-note">Planning only. Nothing here counts toward records, reports, meaningful days, or legal archive until a day is sent to Daily Records and saved there.</p>
                </div>
                <div className="primary-action-row">
                  <button className="secondary-button" type="button" onClick={() => void saveAnnualPlan("active", "Unit Study Planner saved with Annual Plan data.")} disabled={isAnnualPlanSaving}>
                    Save Planner Draft
                  </button>
                  <button className="secondary-button" type="button" onClick={startPlannerUnit}>
                    Start Unit
                  </button>
                  <button className="primary-button" type="button" onClick={completePlannerUnit}>
                    Complete Unit Study
                  </button>
                </div>
              </div>
              <SaveStateIndicator
                label={isAnnualPlanSaving ? "Saving planner" : "Planner save state"}
                message={isAnnualPlanSaving ? "Saving planner changes..." : annualPlanMessage}
                status={isAnnualPlanSaving ? "saving" : saveStateFromMessage(annualPlanMessage)}
              />

              <div className="unit-planner-landing-summary">
                <div>
                  <span>Expected weeks</span>
                  <strong>{activePlanner.weeksExpected}</strong>
                </div>
                <div>
                  <span>Unit study question</span>
                  <strong>{activePlanner.unitQuestion || activePlannerRow.guidingQuestion || "Set in Annual Plan Section 4"}</strong>
                </div>
                <label><span>Optional start Monday</span><input type="date" value={activePlanner.startMonday} onChange={(event) => updatePlannerField("startMonday", event.target.value)} /></label>
                <label><span>Unit status</span>
                  <select value={activePlanner.status} onChange={(event) => updatePlannerField("status", event.target.value as UnitPlanStatus)}>
                    {unitStatusOptions.map((statusOption) => <option key={statusOption}>{statusOption}</option>)}
                  </select>
                </label>
              </div>

              <details className="guidance-disclosure">
                <summary>Theme Guidance</summary>
                <div className="guidance-field-stack">
                  <label><span>Unit Writing Topics</span><input value={activePlanner.unitWritingTopics} onChange={(event) => updatePlannerField("unitWritingTopics", event.target.value)} /></label>
                  <label><span>Unit Presentation Topics</span><input value={activePlanner.unitPresentationTopics} onChange={(event) => updatePlannerField("unitPresentationTopics", event.target.value)} /></label>
                  <label><span>Unit Project</span><input value={activePlanner.unitProject} onChange={(event) => updatePlannerField("unitProject", event.target.value)} /></label>
                </div>
              </details>

              <UnitPlannerWeekTabs
                weeks={activePlanner.weeks}
                activeWeekIndex={activePlannerWeekIndex}
                onSelectWeek={(weekIndex) => {
                  setActivePlannerWeekIndex(weekIndex);
                  setSelectedPlannerActivity(null);
                  setPlannerMoveTarget({ week: "", day: "" });
                }}
              />

              {activePlannerWeek ? (
                <section className="unit-week-panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Week {(activePlannerWeekIndex ?? 0) + 1}</p>
                      <h2>Weekly plan</h2>
                    </div>
                    <button className="primary-button" type="button" onClick={() => completePlannerWeek(activePlannerWeekIndex ?? 0)}>
                      Complete Week
                    </button>
                  </div>

                  <details className="guidance-disclosure">
                    <summary>Weekly Guidance</summary>
                    <div className="guidance-field-stack">
                      <label><span>Weekly question</span><input value={activePlannerWeek.weeklyQuestion} onChange={(event) => updatePlannerWeek(activePlannerWeekIndex ?? 0, "weeklyQuestion", event.target.value)} /></label>
                      <label><span>Weekly writing topics</span><input value={activePlannerWeek.writingTopics} onChange={(event) => updatePlannerWeek(activePlannerWeekIndex ?? 0, "writingTopics", event.target.value)} /></label>
                      <label><span>Weekly presentation</span><input value={activePlannerWeek.presentationTopic} onChange={(event) => updatePlannerWeek(activePlannerWeekIndex ?? 0, "presentationTopic", event.target.value)} /></label>
                      <label><span>Weekly project</span><input value={activePlannerWeek.project} onChange={(event) => updatePlannerWeek(activePlannerWeekIndex ?? 0, "project", event.target.value)} /></label>
                    </div>
                  </details>

                  <div className="weekly-planner-reference-grid">
                    <details className="resource-disclosure">
                      <summary>Resources</summary>
                      <label><span>Weekly resources</span><textarea rows={2} value={activePlannerWeek.resources} onChange={(event) => updatePlannerWeek(activePlannerWeekIndex ?? 0, "resources", event.target.value)} /></label>
                    </details>
                    <details className="shopping-disclosure">
                      <summary>Shopping List</summary>
                      <label><span>Weekly shopping list</span><textarea rows={2} value={activePlannerWeek.shoppingList} onChange={(event) => updatePlannerWeek(activePlannerWeekIndex ?? 0, "shoppingList", event.target.value)} /></label>
                      <div className="record-link">
                        <strong>From activity cards</strong>
                        {activePlannerActivityShoppingItems.length ? (
                          <ul className="compiled-shopping-list">
                            {activePlannerActivityShoppingItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                          </ul>
                        ) : (
                          <span>Activity shopping-list items will appear here as you add them below.</span>
                        )}
                      </div>
                    </details>
                  </div>

                  <UnitPlannerDayBoard
                    days={activePlannerWeek.days}
                    weekIndex={activePlannerWeekIndex ?? 0}
                    weekdayLabels={plannerWeekdayLabels}
                    selectedActivity={selectedPlannerActivity}
                    plannerDateForDay={plannerDateForDay}
                    onSelectActivity={(dayIndex, activityId) => {
                      setSelectedPlannerActivity({ weekIndex: activePlannerWeekIndex ?? 0, dayIndex, activityId });
                      setPlannerMoveTarget({ week: "", day: "" });
                    }}
                    onDayDragStart={handlePlannerDayDragStart}
                    onActivityDragStart={handlePlannerActivityDragStart}
                    onActivityDrop={handlePlannerActivityDrop}
                    onAddActivity={addPlannerActivity}
                    onAddFridayTemplate={addFridayTemplate}
                  />
                </section>
              ) : (
                <div className="planner-empty-state">
                  <strong>Pick a week to open its plan.</strong>
                  <span>The weekly guide and day columns stay hidden until you choose a week.</span>
                </div>
              )}

              {selectedPlannerActivityCard && selectedPlannerActivityDay && selectedPlannerActivity ? (
                  <UnitPlannerActivityModal
                  activity={selectedPlannerActivityCard}
                  weekIndex={selectedPlannerActivity.weekIndex}
                  weekdayLabel={plannerWeekdayLabels[selectedPlannerActivity.dayIndex]}
                  plannerWeekCount={activePlanner.weeks.length}
                  plannerMoveTarget={plannerMoveTarget}
                  canCompleteDay={selectedPlannerActivityDay.activities.every(activityIsDone)}
                  onClose={() => setSelectedPlannerActivity(null)}
                  onCompleteDay={() => completePlannerDay(selectedPlannerActivity.weekIndex, selectedPlannerActivity.dayIndex)}
                  onSendDayToDailyRecords={() => sendPlannerDayToDailyRecords(selectedPlannerActivity.weekIndex, selectedPlannerActivity.dayIndex)}
                  onUpdateActivity={(patch) => updatePlannerActivity(selectedPlannerActivity.weekIndex, selectedPlannerActivity.dayIndex, selectedPlannerActivityCard.id, patch)}
                  onPlannerMoveTargetChange={(patch) => setPlannerMoveTarget((current) => ({ ...current, ...patch }))}
                  onMoveActivityToWeekDay={() => movePlannerActivityToWeekDay(selectedPlannerActivity.weekIndex, selectedPlannerActivity.dayIndex, selectedPlannerActivityCard.id, plannerMoveTarget.week, plannerMoveTarget.day)}
                  onMoveActivityPrompt={() => movePlannerActivity(selectedPlannerActivity.weekIndex, selectedPlannerActivity.dayIndex, selectedPlannerActivityCard.id)}
                  onDeleteActivity={() => deletePlannerActivity(selectedPlannerActivity.weekIndex, selectedPlannerActivity.dayIndex, selectedPlannerActivityCard.id)}
                  onSelectExistingZero={selectExistingZero}
                />
              ) : null}
            </section>
            ) : null}

            {activeTab === "tools" ? (
            <section className="panel workspace-tools-panel" id="workspace-tools">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Workspace tools</p>
                  <h2>Open one tool at a time</h2>
                  <p className="panel-note">Supporting settings and reference panels stay compact until you need them.</p>
                </div>
              </div>
              <div className="weekly-section-hub workspace-tools-hub" aria-label="Workspace tool sections">
                {(Object.keys(workspaceToolSectionLabels) as WorkspaceToolSection[]).map((section) => {
                  const summaries: Record<WorkspaceToolSection, string> = {
                    subjects: "Browse selectable skill pills by subject.",
                    legal: "Check coverage tags used in records.",
                    parser: "Review how AI draft cards should behave.",
                    storage: "Check where uploads and PDFs belong.",
                    rules: "Review time and record-keeping rules."
                  };
                  return (
                    <button
                      className={activeWorkspaceToolSection === section && isWorkspaceToolsModalOpen ? "weekly-section-button is-active" : "weekly-section-button"}
                      key={section}
                      type="button"
                      onClick={() => {
                        setActiveWorkspaceToolSection(section);
                        setIsWorkspaceToolsModalOpen(true);
                      }}
                    >
                      <strong>{workspaceToolSectionLabels[section]}</strong>
                      <span>{summaries[section]}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            ) : null}

            {activeTab === "tools" && isWorkspaceToolsModalOpen ? (
              <div
                className="weekly-review-modal-backdrop"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setIsWorkspaceToolsModalOpen(false);
                }}
              >
                <section className="weekly-review-modal workspace-tools-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-tools-modal-title">
                  <div className="section-head weekly-review-modal-head">
                    <div>
                      <p className="eyebrow">Workspace tools</p>
                      <h2 id="workspace-tools-modal-title">{workspaceToolSectionLabels[activeWorkspaceToolSection]}</h2>
                    </div>
                    <button className="secondary-button" type="button" onClick={() => setIsWorkspaceToolsModalOpen(false)}>Close</button>
                  </div>

                  {activeWorkspaceToolSection === "subjects" ? (
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

                  {activeWorkspaceToolSection === "legal" ? (
                    <section className="panel" id="legal-panel">
                      <p className="eyebrow">Texas legal coverage</p>
                      <h2>Legal coverage panel</h2>
                      <div className="coverage-list compact-tool-list">
                        {legalCoverage.map(([category, level]) => (
                          <div key={category}><span>{category}</span><strong>{level}</strong></div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {activeWorkspaceToolSection === "parser" ? (
                    <section className="panel">
                      <p className="eyebrow">Parser settings</p>
                      <h2>AI draft-card rules</h2>
                      <div className="coverage-list compact-tool-list">
                        <div><span>Subject source</span><strong>Use the activity and manual subject split first.</strong></div>
                        <div><span>Skill pills</span><strong>Suggest relevant skills; parent can add or remove.</strong></div>
                        <div><span>Legal tags</span><strong>Keep legal tags separate from subject and skill tags.</strong></div>
                        <div><span>Time bars</span><strong>Show allocated time as part of the day total without double-counting.</strong></div>
                      </div>
                    </section>
                  ) : null}

                  {activeWorkspaceToolSection === "storage" ? (
                    <section className="panel">
                      <p className="eyebrow">Storage settings</p>
                      <h2>Upload and report destinations</h2>
                      <div className="coverage-list compact-tool-list">
                        <div><span>Proof uploads</span><strong>Portfolio proof-file explorer</strong></div>
                        <div><span>Generated PDFs</span><strong>Reports workspace buckets</strong></div>
                        <div><span>Legal files</span><strong>Legal Archive file cabinet</strong></div>
                        <div><span>Backups</span><strong>Records & Snapshots background archive</strong></div>
                      </div>
                    </section>
                  ) : null}

                  {activeWorkspaceToolSection === "rules" ? (
                    <section className="panel">
                      <p className="eyebrow">Record rules</p>
                      <h2>Current counting rules</h2>
                      <div className="coverage-list compact-tool-list">
                        <div><span>Meaningful weekday</span><strong>180+ approved minutes</strong></div>
                        <div><span>Weekend ticker</span><strong>Counts 180+ minute weekend days with no denominator.</strong></div>
                        <div><span>Source of truth</span><strong>Approved daily activities drive reviews and reports.</strong></div>
                        <div><span>Cross-subject links</span><strong>Tracked as links, not extra time.</strong></div>
                      </div>
                    </section>
                  ) : null}
                </section>
              </div>
            ) : null}

            {activeTab === "daily" ? (
              <>
            <section className="panel quick-log-panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Step 1</p>
                  <h2>Select learning activity</h2>
                </div>
                <div className="daily-completion-actions">
                  <label className="date-selector"><span>Date</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
                  <button className="success-button" type="button" onClick={() => void completeDay()} disabled={isCompletingDay || isLoadingRecords}>
                    {isCompletingDay ? "Completing..." : "Complete Day"}
                  </button>
                  <button className="success-button" type="button" onClick={() => void exportDailySummaryPdf()} disabled={isDailyPdfBusy}>
                    {isDailyPdfBusy ? "Creating PDF..." : "Compile PDF"}
                  </button>
                </div>
              </div>
              {lastDailyPdfArtifact ? (
                <div className="status-line">
                  <span>Last daily PDF: {lastDailyPdfArtifact.originalName}</span>
                  <a className="download-link" href={`/api/artifacts/${lastDailyPdfArtifact.id}/download`} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                </div>
              ) : null}
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
                    <span>{buttonState(type) === "completed" || buttonState(type) === "selected-completed" ? "completed" : buttonState(type) === "needs-review" ? "needs review" : buttonState(type) === "selected" ? "selected" : "not logged"}</span>
                  </button>
                ))}
              </div>
              <p className="panel-note">
                Completion states are calculated from saved database records for the selected date. Changing the date reloads historical activity states without deleting prior records.
              </p>
            </section>

            {isDailyEntryModalOpen ? (
              <div
                className="daily-entry-modal-backdrop"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setIsDailyEntryModalOpen(false);
                    setActiveDailyDetailPane(null);
                  }
                }}
              >
                <div className="daily-entry-modal" role="dialog" aria-modal="true" aria-labelledby="daily-entry-modal-title">
                  <div className="section-head daily-entry-modal-head">
                    <div>
                      <p className="eyebrow">Daily record entry</p>
                      <h2 id="daily-entry-modal-title">{selectedType}</h2>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setIsDailyEntryModalOpen(false);
                        setActiveDailyDetailPane(null);
                      }}
                    >
                      Close
                    </button>
                  </div>

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
                  <input value={title || defaultActivityTitle()} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label>
                  <span>Actual minutes</span>
                  <input type="number" min="1" value={actualMinutes} onFocus={selectExistingZero} onChange={(event) => setActualMinutesForEntry(Number(event.target.value))} />
                </label>
              </div>
              {selectedType === "Foreign Language" ? (
                <div className="activity-detail-panel">
                  <label>
                    <span>Language</span>
                    <input value={foreignLanguage} onChange={(event) => setForeignLanguage(event.target.value)} placeholder="Spanish" />
                  </label>
                </div>
              ) : null}
              {selectedType === "Extracurricular" ? (
                <div className="activity-detail-panel">
                  <span className="field-label">Activity areas</span>
                  <div className="tag-option-grid">
                    {extracurricularOptions.map((option) => (
                      <button
                        className={selectedExtracurriculars.includes(option) ? "tag-button is-active" : "tag-button"}
                        key={option}
                        type="button"
                        onClick={() => toggleExtracurricularOption(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {hasSubjectTimeSplit ? (
                <div className="activity-detail-panel unit-study-allocation-panel">
                  <div className="allocation-panel-head">
                    <div>
                      <span className="field-label">Subject time split</span>
                      <p className="muted">Split the {selectedType} total into subjects without double-counting time.</p>
                    </div>
                    <span className={unitStudyAllocationIsBalanced ? "tag good" : "tag review"}>
                      {unitStudyAllocationTotal}/{actualMinutes || 0} min
                    </span>
                  </div>
                  <div className="unit-study-allocation-list">
                    {unitStudyAllocations.map((allocation) => (
                      <div className="unit-study-allocation-row" key={allocation.id}>
                        <label>
                          <span>Subject area</span>
                          <select
                            value={allocation.subject}
                            onChange={(event) => updateUnitStudyAllocation(allocation.id, { subject: event.target.value })}
                          >
                            <option value="">Choose subject</option>
                            {unitStudySubjectOptions.map((subject) => (
                              <option key={subject} value={subject}>{subject}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Minutes</span>
                          <input
                            type="number"
                            min="0"
                            value={allocation.minutes}
                            onFocus={selectExistingZero}
                            onChange={(event) => updateUnitStudyAllocation(allocation.id, { minutes: Number(event.target.value) })}
                          />
                        </label>
                        <button className="text-button" type="button" onClick={() => removeUnitStudyAllocation(allocation.id)} disabled={unitStudyAllocations.length === 1}>
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="primary-action-row">
                    <button className="secondary-button" type="button" onClick={addUnitStudyAllocation}>Add subject</button>
                    <button className="secondary-button" type="button" onClick={balanceLastUnitStudyAllocation}>Balance last row</button>
                  </div>
                  {!unitStudyAllocationIsBalanced ? (
                    <p className="status-line warning">Save Approved turns back on when the subject split equals the {selectedType} actual minutes.</p>
                  ) : null}
                </div>
              ) : null}
              <div className="dictation-textarea-group">
                <div className="dictation-toolbar">
                  <span className="field-label">Narration</span>
                  <button
                    className={isNarrationListening ? "dictation-button is-listening" : "dictation-button"}
                    type="button"
                    aria-pressed={isNarrationListening}
                    onClick={toggleNarrationDictation}
                  >
                    <span aria-hidden="true">Mic</span>
                    {isNarrationListening ? "Stop Dictation" : "Dictate"}
                  </button>
                </div>
                <textarea value={narration} onChange={(event) => setNarration(event.target.value)} />
                {narrationDictationMessage ? <p className={isNarrationListening ? "dictation-status is-listening" : "dictation-status"}>{narrationDictationMessage}</p> : null}
              </div>
              <div className="daily-detail-button-row" aria-label="Daily record detail tools">
                <button className="secondary-button" type="button" onClick={() => setActiveDailyDetailPane("legal")}>
                  Legal Tags
                </button>
                <button className="secondary-button" type="button" onClick={() => setActiveDailyDetailPane("proof")}>
                  Proof of Learning
                </button>
                <button className="secondary-button" type="button" onClick={() => setActiveDailyDetailPane("resources")}>
                  Resources
                </button>
              </div>
              <div className="quick-summary-row">
                {hasSubjectTimeSplit ? (
                  activitySubjectAllocations.map((allocation) => (
                    <span className="tag good" key={`${allocation.subject}-${allocation.minutes}`}>{allocation.subject}: {allocation.minutes} min</span>
                  ))
                ) : (
                  <span className="tag good">{primarySubject}: {actualMinutes || 0} min</span>
                )}
                {selectedType === "Foreign Language" ? <span className="tag">{foreignLanguage || "Spanish"}</span> : null}
                {selectedType === "Extracurricular" && selectedExtracurriculars.length ? <span className="tag">{selectedExtracurriculars.join(", ")}</span> : null}
                <span className="tag">{legalTags.length} legal tag{legalTags.length === 1 ? "" : "s"}</span>
                <span className="tag">{uploadedArtifacts.length} proof file{uploadedArtifacts.length === 1 ? "" : "s"}</span>
                <span className="tag">{filledLessonResources(currentLessonResources).length} resource{filledLessonResources(currentLessonResources).length === 1 ? "" : "s"}</span>
              </div>
              <div className="review-metrics daily-record-ticker" aria-label="Daily record time ticker">
                <div className="review-metric"><span>Total time today</span><strong>{formatMinutes(dailyApprovedMinutes)}</strong></div>
                <div className="review-metric"><span>Meaningful days</span><strong>{dailyMeaningfulTicker.meaningfulDays} of {dailyMeaningfulTicker.weekdays}</strong></div>
                <div className="review-metric"><span>Weekend +1 days</span><strong>{dailyMeaningfulTicker.weekendDays}</strong></div>
              </div>
            </section>

            {activeDailyDetailPane ? (
              <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget) setActiveDailyDetailPane(null);
              }}>
                <section className="decision-modal daily-detail-modal" role="dialog" aria-modal="true" aria-labelledby="daily-detail-modal-title">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Step 2 details</p>
                      <h2 id="daily-detail-modal-title">
                        {activeDailyDetailPane === "legal" ? "Legal Tags" : activeDailyDetailPane === "proof" ? "Proof of Learning" : "Resources"}
                      </h2>
                    </div>
                    <button className="secondary-button" type="button" onClick={() => setActiveDailyDetailPane(null)}>Close</button>
                  </div>

                {activeDailyDetailPane === "legal" ? (
                <section className="daily-detail-pane">
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
                ) : null}

                {activeDailyDetailPane === "proof" ? (
                <section className="daily-detail-pane" id="proof">
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
                ) : null}

                {activeDailyDetailPane === "resources" ? (
                <section className="daily-detail-pane" id="resources">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Optional resources</p>
                      <h2>Resources</h2>
                      <p className="panel-note">These resources stay with {selectedType} until you change or delete them.</p>
                    </div>
                    <button className="secondary-button" type="button" onClick={addLessonResource}>Add resource</button>
                  </div>
                  <div className="resource-list">
                    {currentLessonResources.length ? currentLessonResources.map((resource) => (
                      <div className="resource-row" key={resource.id}>
                        <label>
                          <span>Book or Resource title</span>
                          <input value={resource.title} onChange={(event) => updateLessonResource(resource.id, { title: event.target.value })} />
                        </label>
                        <label>
                          <span>Author or Editor</span>
                          <input value={resource.authorOrEditor} onChange={(event) => updateLessonResource(resource.id, { authorOrEditor: event.target.value })} />
                        </label>
                        <label>
                          <span>Optional URL</span>
                          <input value={resource.url} onChange={(event) => updateLessonResource(resource.id, { url: event.target.value })} />
                        </label>
                        <button className="text-button" type="button" onClick={() => deleteLessonResource(resource.id)}>Delete</button>
                      </div>
                    )) : <p className="muted">No resources added for {selectedType} yet.</p>}
                  </div>
                  {filledLessonResources(currentLessonResources).length ? (
                    <p className="status-line">{filledLessonResources(currentLessonResources).length} resource{filledLessonResources(currentLessonResources).length === 1 ? "" : "s"} will save with this activity.</p>
                  ) : null}
                </section>
                ) : null}
                </section>
              </div>
            ) : null}

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
                <button className="primary-button" type="button" disabled={isSaving || !canSaveApproved} onClick={requestApprovedSave}>Save Approved</button>
              </div>
              <SaveStateIndicator
                label={isSaving ? "Saving activity" : isUploadingProof ? "Uploading proof" : "Daily record state"}
                message={isSaving ? "Saving this activity..." : isUploadingProof ? "Uploading proof file..." : status}
                status={isSaving || isUploadingProof ? "saving" : saveStateFromMessage(status)}
              />
            </section>

            {duplicateApprovedActivities.length ? (
              <div className="modal-backdrop" role="presentation">
                <section className="decision-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-save-title">
                  <div>
                    <p className="eyebrow">Duplicate approved record</p>
                    <h2 id="duplicate-save-title">Save another {selectedType} record?</h2>
                    <p>
                      {formatUsDate(selectedDate)} already has {duplicateApprovedActivities.length} approved {selectedType} record{duplicateApprovedActivities.length === 1 ? "" : "s"} totaling{" "}
                      {duplicateApprovedActivities.reduce((sum, activity) => sum + activity.actualMinutes, 0)} minutes.
                    </p>
                  </div>
                  <div className="duplicate-record-list">
                    {duplicateApprovedActivities.map((activity) => (
                      <div key={activity.id}>
                        <strong>{activity.title}</strong>
                        <span>{activity.actualMinutes} min</span>
                      </div>
                    ))}
                  </div>
                  <div className="modal-actions">
                    <button className="secondary-button" type="button" onClick={() => setDuplicateApprovedActivities([])} disabled={isSaving}>Cancel</button>
                    <button className="secondary-button" type="button" onClick={() => void saveActivity(true, [])} disabled={isSaving}>Add to Existing</button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => void saveActivity(true, duplicateApprovedActivities.map((activity) => activity.id))}
                      disabled={isSaving}
                    >
                      Replace Existing
                    </button>
                  </div>
                </section>
              </div>
            ) : null}

            {draftCards.length ? (
              <section className="panel" id="review-summary">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">AI Review Summary</p>
                    <h2>Parent approval before save</h2>
                  </div>
                </div>
                <div className="parsed-card-grid">
                  {draftCards.map((draft) => (
                    <article className={draft.status === "approved" ? "activity-card parsed-card is-approved" : "activity-card parsed-card"} key={draft.id}>
                      <div className="card-topline">
                        <span className={draft.status === "approved" ? "tag good" : "tag review"}>
                          {draft.status === "approved" ? "Approved card" : "Needs parent approval"}
                        </span>
                        <span className="tag">{draft.minutes} min</span>
                      </div>
                      <h3>{draft.title}</h3>
                      <label><span>Title</span><input value={draft.title} onChange={(event) => updateDraftCard(draft.id, { title: event.target.value })} /></label>
                      <div className="parsed-chip-group" aria-label={`${draft.title} parsed skills and legal tags`}>
                        {draft.skills.map((skill) => <span className="skill-chip" key={skill}>{skill}</span>)}
                        {draft.legalTags.map((tag) => <span className="legal-chip" key={tag}>{tag}</span>)}
                      </div>
                      <details className="parsed-tag-editor">
                        <summary>Adjust skill and legal tags</summary>
                        <div className="tag-editor-section">
                          <strong>Skill tags</strong>
                          <div className="skill-tag-subject-list">
                            {Object.entries(skillTaxonomy).map(([subject, skills]) => (
                              <details className="skill-tag-subject" key={subject} open={subject === parsedSubjectForType(selectedType)}>
                                <summary>
                                  <span>{subject}</span>
                                  <span>{skills.filter((skill) => draft.skills.includes(skill)).length}/{skills.length}</span>
                                </summary>
                                <div className="tag-option-grid">
                                  {skills.map((skill) => (
                                    <button
                                      className={draft.skills.includes(skill) ? "tag-button skill-option is-active" : "tag-button skill-option"}
                                      key={`${subject}-${skill}`}
                                      type="button"
                                      onClick={() => toggleDraftSkill(draft.id, skill)}
                                    >
                                      {skill}
                                    </button>
                                  ))}
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>
                        <div className="tag-editor-section">
                          <strong>Legal tags</strong>
                          <div className="tag-option-grid">
                            {allLegalTagOptions.map((tag) => (
                              <button
                                className={draft.legalTags.includes(tag) ? "tag-button legal-option is-active" : "tag-button legal-option"}
                                key={tag}
                                type="button"
                                onClick={() => toggleDraftLegalTag(draft.id, tag)}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      </details>
                      <div className="subject-allocation-bars" aria-label={`${draft.title} subject time allocations`}>
                        {draft.subjectAllocations.map((allocation, allocationIndex) => {
                          const rawPercent = (allocation.minutes / dailyInstructionMinutesForBars) * 100;
                          const percent = Math.min(100, Math.max(3, Math.round(rawPercent)));
                          const displayedPercent = Math.round(rawPercent * 10) / 10;
                          return (
                            <div className="allocation-bar-row" key={`${draft.id}-${allocation.subject}-${allocationIndex}`}>
                              <div>
                                <strong>{allocation.subject}</strong>
                                <span>{allocation.minutes} min of {dailyInstructionMinutesForBars} min day ({displayedPercent}%)</span>
                              </div>
                              <div className="allocation-track">
                                <span style={{ width: `${percent}%` }} />
                              </div>
                              {hasSubjectTimeSplit ? (
                                <div className="parsed-allocation-controls">
                                  <label>
                                    <span>Subject</span>
                                    <select
                                      value={allocation.subject}
                                      onChange={(event) => updateDraftSubjectAllocation(draft.id, allocationIndex, { subject: event.target.value })}
                                    >
                                      <option value="">Choose subject</option>
                                      {unitStudySubjectOptions.map((subject) => (
                                        <option key={subject} value={subject}>{subject}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    <span>Minutes</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={allocation.minutes}
                                      onFocus={selectExistingZero}
                                      onChange={(event) => updateDraftSubjectAllocation(draft.id, allocationIndex, { minutes: Number(event.target.value) })}
                                    />
                                  </label>
                                  <button
                                    className="text-button"
                                    type="button"
                                    onClick={() => removeDraftSubjectAllocation(draft.id, allocationIndex)}
                                    disabled={draft.subjectAllocations.length === 1}
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                      <div className="cross-subject-panel">
                        <div className="cross-subject-header">
                          <strong>Cross-subject topics</strong>
                          <button className="secondary-button" type="button" onClick={() => addDraftCrossSubject(draft.id)}>
                            {draft.crossSubjects.length ? "Add another" : "Add cross-subject topic"}
                          </button>
                        </div>
                        {draft.crossSubjects.length ? (
                          <div className="cross-subject-list">
                            {draft.crossSubjects.map((crossSubject) => (
                              <div className="cross-subject-fields" key={crossSubject.id}>
                                <label>
                                  <span>Connects to</span>
                                  <select
                                    value={crossSubject.activityType}
                                    onChange={(event) => updateDraftCrossSubject(draft.id, crossSubject.id, { activityType: event.target.value })}
                                  >
                                    {unitStudySubjectOptions.map((subject) => (
                                      <option key={subject}>{subject}</option>
                                    ))}
                                  </select>
                                </label>
                                <label>
                                  <span>Topic</span>
                                  <input
                                    value={crossSubject.topic}
                                    onChange={(event) => updateDraftCrossSubject(draft.id, crossSubject.id, { topic: event.target.value })}
                                    placeholder="Volcanoes, money choices, construction..."
                                  />
                                </label>
                                <button className="text-button" type="button" onClick={() => removeDraftCrossSubject(draft.id, crossSubject.id)}>Remove</button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="muted">Optional: connect this activity topic to another activity workspace without moving the time.</p>
                        )}
                      </div>
                      <div className="parsed-card-actions">
                        <button className="secondary-button" type="button" onClick={() => selectDraftTime(draft.id)}>Select time</button>
                        <button className="secondary-button" type="button" onClick={() => mergeDraftCard(draft.id)} disabled={draftCards.length < 2}>Merge</button>
                        <button className="text-button" type="button" onClick={() => deleteDraftCard(draft.id)}>Delete</button>
                        <button className="primary-button" type="button" onClick={() => approveDraftCard(draft.id)} disabled={draft.status === "approved"}>Approve card</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <details className="panel expandable-records-panel" id="saved-records">
              <summary>
                <div>
                  <p className="eyebrow">Saved records</p>
                  <h2>Saved records for selected date</h2>
                </div>
                <span className="tag">{savedActivities.length} saved</span>
              </summary>
              <div className="expandable-records-body">
                <div className="primary-action-row">
                  <button className="secondary-button" type="button" onClick={() => void loadSavedActivities(selectedDate)} disabled={isLoadingRecords}>
                    {isLoadingRecords ? "Loading..." : "Refresh"}
                  </button>
                  <button className="primary-button" type="button" onClick={() => void exportDailySummaryPdf()} disabled={isDailyPdfBusy}>
                    {isDailyPdfBusy ? "Creating..." : "Create Daily Summary PDF"}
                  </button>
                </div>
                {lastDailyPdfArtifact ? (
                  <div className="status-line">
                    <span>{lastDailyPdfArtifact.originalName}</span>
                    <a className="download-link" href={`/api/artifacts/${lastDailyPdfArtifact.id}/download`} target="_blank" rel="noreferrer">
                      Open PDF
                    </a>
                  </div>
                ) : null}
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
              </div>
            </details>

                </div>
              </div>
            ) : null}

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
                <button className="primary-button" type="button" onClick={() => void compileWeeklyPdf()} disabled={isWeeklyBusy || !weeklyReviewId}>Compile PDF to Reports</button>
              </div>

              <SaveStateIndicator
                label={isWeeklyBusy ? "Working on weekly review" : "Weekly review state"}
                message={isWeeklyBusy ? "Saving or exporting weekly review..." : weeklyStatusMessage}
                status={isWeeklyBusy ? "saving" : saveStateFromMessage(weeklyStatusMessage)}
              />
              {lastWeeklyPdfArtifact ? (
                <div className="compiled-report-link">
                  <span>{lastWeeklyPdfArtifact.originalName}</span>
                  <a className="download-link" href={`/api/artifacts/${lastWeeklyPdfArtifact.id}/download`} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                </div>
              ) : null}

              <div className="weekly-section-hub" aria-label="Weekly review sections">
                {[
                  ["summary", "Summary Info", "Time, activity counts, legal coverage, and charts"],
                  ["parent", "Parent Ratings", "Weekly summary, rating, and next-week focus"],
                  ["student", "Student Reflection", "Student notes, self-rating, and dictation"],
                  ["skills", "Skills Review", "AI suggestions, ratings, and parent notes"],
                  ["portfolio", "Portfolio", "Weekly highlight selections"]
                ].map(([key, label, description]) => (
                  <button
                    className={[
                      "weekly-section-button",
                      activeWeeklySection === key && isWeeklyReviewModalOpen ? "is-active" : "",
                      reviewedWeeklySections.includes(key as WeeklyReviewSection) ? "is-reviewed" : ""
                    ].filter(Boolean).join(" ")}
                    key={key}
                    type="button"
                    onClick={() => {
                      setActiveWeeklySection(key as WeeklyReviewSection);
                      setIsWeeklyReviewModalOpen(true);
                    }}
                  >
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>

              {isWeeklyReviewModalOpen ? (
                <div
                  className="weekly-review-modal-backdrop"
                  role="presentation"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setIsWeeklyReviewModalOpen(false);
                  }}
                >
                  <div className="weekly-review-modal" role="dialog" aria-modal="true" aria-labelledby="weekly-review-modal-title">
                    <div className="section-head weekly-review-modal-head">
                      <div>
                        <p className="eyebrow">Weekly Review Section</p>
                        <h2 id="weekly-review-modal-title">{weeklySectionLabels[activeWeeklySection]}</h2>
                      </div>
                      <button className="secondary-button" type="button" onClick={() => setIsWeeklyReviewModalOpen(false)}>Close</button>
                    </div>

              {activeWeeklySection === "summary" ? (
              <section className="weekly-subsection is-open">
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
              </div>

              <div className="review-metrics" aria-label="Weekly review generated metrics">
                <div className="review-metric"><span>Total time</span><strong>{formatMinutes(weeklyReviewTicker.totalMinutes || weeklyData.totalApprovedLearningTime)}</strong></div>
                <div className="review-metric"><span>Meaningful days</span><strong>{weeklyReviewTicker.meaningfulDays} of {weeklyReviewTicker.weekdays}</strong></div>
                <div className="review-metric"><span>Weekend +1 days</span><strong>{weeklyReviewTicker.weekendDays}</strong></div>
                <div className="review-metric"><span>Activities logged</span><strong>{weeklyData.activitiesLogged}</strong></div>
                <div className="review-metric"><span>Days logged</span><strong>{weeklyData.daysLogged}</strong></div>
                <div className="review-metric"><span>Artifacts saved</span><strong>{weeklyData.artifactsSaved}</strong></div>
                <div className="review-metric"><span>Needs review</span><strong>{weeklyData.activitiesNeedingReview ?? 0}</strong></div>
              </div>

              <div className="coverage-summary-grid">
                <div className="record-link"><strong>Subject time summary</strong><span>{Object.entries(weeklyData.subjectTimeSummary).length ? Object.entries(weeklyData.subjectTimeSummary).map(([subject, minutes]) => `${subject} ${formatMinutes(minutes)}`).join("; ") : "Generate from logs to populate subject allocations."}</span></div>
                <div className="record-link"><strong>Texas legal coverage</strong><span>{weeklyData.legalCoverageSummary.length ? weeklyData.legalCoverageSummary.join(", ") : "Generate from logs to populate legal tags."}</span></div>
                <div className="record-link"><strong>Report save target</strong><span>Reports / weekly-review-{weeklyStartDate}.pdf</span></div>
              </div>
              <SubjectTimeCharts summary={weeklyData.subjectTimeSummary} emptyText="Generate from logs to populate the weekly subject time bar and pie charts." />
              <CrossSubjectChartPlaceholder />
              <div className="section-review-row">
                <button className="primary-button" type="button" onClick={() => markWeeklySectionReviewed("summary")} disabled={reviewedWeeklySections.includes("summary")}>
                  {reviewedWeeklySections.includes("summary") ? "Reviewed" : "Mark Summary Info Reviewed"}
                </button>
              </div>
              </section>
              ) : null}

              {activeWeeklySection === "parent" ? (
              <section className="weekly-subsection is-open">
              <div className="weekly-notes-grid">
                <label>
                  <span>Parent weekly summary</span>
                  <textarea value={weeklyData.parentWeeklySummary} onChange={(event) => updateWeeklyData("parentWeeklySummary", event.target.value)} />
                </label>
                <label>
                  <span>Next week focus</span>
                  <textarea value={weeklyData.nextWeekFocus} onChange={(event) => updateWeeklyData("nextWeekFocus", event.target.value)} />
                </label>
                <label>
                  <span>Overall weekly rating</span>
                  <select value={weeklyData.overallWeeklyRating} onChange={(event) => updateWeeklyData("overallWeeklyRating", event.target.value)}>
                    {weeklyRatings.map((rating) => <option key={rating}>{rating}</option>)}
                  </select>
                </label>
              </div>
              <div className="section-review-row">
                <button className="primary-button" type="button" onClick={() => markWeeklySectionReviewed("parent")} disabled={reviewedWeeklySections.includes("parent")}>
                  {reviewedWeeklySections.includes("parent") ? "Reviewed" : "Mark Parent Ratings Reviewed"}
                </button>
              </div>
              </section>
              ) : null}

              {activeWeeklySection === "student" ? (
              <section className="weekly-subsection is-open">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Student Reflection</p>
                    <h2>Student notes and self-rating</h2>
                  </div>
                </div>
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
                <div className="section-review-row">
                  <button className="primary-button" type="button" onClick={() => markWeeklySectionReviewed("student")} disabled={reviewedWeeklySections.includes("student")}>
                    {reviewedWeeklySections.includes("student") ? "Reviewed" : "Mark Student Reflection Reviewed"}
                  </button>
                </div>
              </section>
              ) : null}

              {activeWeeklySection === "skills" ? (
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
                <div className="section-review-row">
                  <button className="primary-button" type="button" onClick={() => markWeeklySectionReviewed("skills")} disabled={reviewedWeeklySections.includes("skills")}>
                    {reviewedWeeklySections.includes("skills") ? "Reviewed" : "Mark Skills Review Reviewed"}
                  </button>
                </div>
              </section>
              ) : null}

              {activeWeeklySection === "portfolio" ? (
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
                <div className="section-review-row">
                  <button className="primary-button" type="button" onClick={() => markWeeklySectionReviewed("portfolio")} disabled={reviewedWeeklySections.includes("portfolio")}>
                    {reviewedWeeklySections.includes("portfolio") ? "Reviewed" : "Mark Portfolio Reviewed"}
                  </button>
                </div>
              </section>
              ) : null}
                  </div>
                </div>
              ) : null}
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
                <button className="primary-button" type="button" onClick={() => void compileQuarterPdf()} disabled={isQuarterBusy || !quarterReviewId}>Compile PDF to Reports</button>
              </div>

              <SaveStateIndicator
                label={isQuarterBusy ? "Working on quarter review" : "Quarter review state"}
                message={isQuarterBusy ? "Saving or exporting quarter review..." : quarterStatusMessage}
                status={isQuarterBusy ? "saving" : saveStateFromMessage(quarterStatusMessage)}
              />
              {lastQuarterPdfArtifact ? (
                <div className="compiled-report-link">
                  <span>{lastQuarterPdfArtifact.originalName}</span>
                  <a className="download-link" href={`/api/artifacts/${lastQuarterPdfArtifact.id}/download`} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                </div>
              ) : null}

              <div className="weekly-section-hub" aria-label="Quarter review sections">
                {[
                  ["summary", "Summary Info", "Time, activity counts, legal coverage, charts, and units"],
                  ["parent", "Parent Ratings", "Quarter rating, improvements, review needs, and priorities"],
                  ["student", "Student Reflection", "Student notes and self-rating for the quarter"],
                  ["skills", "Skills Review", "Quarter skill trends and parent notes"],
                  ["portfolio", "Portfolio", "Quarter highlight selections"]
                ].map(([key, label, description]) => (
                  <button
                    className={[
                      "weekly-section-button",
                      activeQuarterSection === key && isQuarterReviewModalOpen ? "is-active" : "",
                      reviewedQuarterSections.includes(key as WeeklyReviewSection) ? "is-reviewed" : ""
                    ].filter(Boolean).join(" ")}
                    key={key}
                    type="button"
                    onClick={() => {
                      setActiveQuarterSection(key as WeeklyReviewSection);
                      setIsQuarterReviewModalOpen(true);
                    }}
                  >
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>

              {isQuarterReviewModalOpen ? (
                <div
                  className="weekly-review-modal-backdrop"
                  role="presentation"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setIsQuarterReviewModalOpen(false);
                  }}
                >
                  <div className="weekly-review-modal" role="dialog" aria-modal="true" aria-labelledby="quarter-review-modal-title">
                    <div className="section-head weekly-review-modal-head">
                      <div>
                        <p className="eyebrow">Quarter Review Section</p>
                        <h2 id="quarter-review-modal-title">{weeklySectionLabels[activeQuarterSection]}</h2>
                      </div>
                      <button className="secondary-button" type="button" onClick={() => setIsQuarterReviewModalOpen(false)}>Close</button>
                    </div>

              {activeQuarterSection === "summary" ? (
              <section className="weekly-subsection is-open">
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
                    <option>Vacation</option>
                    <option>Summer Extension</option>
                    <option>Winter Extension</option>
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
                <div className="review-metric"><span>Total time</span><strong>{formatMinutes(quarterReviewTicker.totalMinutes || quarterData.totalApprovedLearningTime)}</strong></div>
                <div className="review-metric"><span>Meaningful days</span><strong>{quarterReviewTicker.meaningfulDays} of {quarterReviewTicker.weekdays}</strong></div>
                <div className="review-metric"><span>Weekend +1 days</span><strong>{quarterReviewTicker.weekendDays}</strong></div>
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
              <SubjectTimeCharts summary={quarterData.subjectTimeSummary} emptyText="Generate the quarter review to populate subject time bar and pie charts." />
              <CrossSubjectChartPlaceholder />
              <section className="weekly-subsection">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Units</p>
                    <h2>Active units this timeframe</h2>
                  </div>
                </div>
                <div className="coverage-list">
                  {quarterData.activeUnits.length ? quarterData.activeUnits.map((item) => (
                    <div key={item.title}><span>{item.title} - {item.activities} activities</span><strong>{formatMinutes(item.minutes)}</strong></div>
                  )) : <p className="muted">Generate the review to summarize active unit studies.</p>}
                </div>
              </section>
              <div className="section-review-row">
                <button className="primary-button" type="button" onClick={() => markQuarterSectionReviewed("summary")} disabled={reviewedQuarterSections.includes("summary")}>
                  {reviewedQuarterSections.includes("summary") ? "Reviewed" : "Mark Summary Info Reviewed"}
                </button>
              </div>
              </section>
              ) : null}

              {activeQuarterSection === "skills" ? (
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
                <div className="section-review-row">
                  <button className="primary-button" type="button" onClick={() => markQuarterSectionReviewed("skills")} disabled={reviewedQuarterSections.includes("skills")}>
                    {reviewedQuarterSections.includes("skills") ? "Reviewed" : "Mark Skills Review Reviewed"}
                  </button>
                </div>
              </section>
              ) : null}

              {activeQuarterSection === "student" ? (
              <section className="weekly-subsection">
                <div className="review-form-grid">
                  <div aria-labelledby="quarter-student-title">
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
                  </div>
                </div>
                <div className="section-review-row">
                  <button className="primary-button" type="button" onClick={() => markQuarterSectionReviewed("student")} disabled={reviewedQuarterSections.includes("student")}>
                    {reviewedQuarterSections.includes("student") ? "Reviewed" : "Mark Student Reflection Reviewed"}
                  </button>
                </div>
              </section>
              ) : null}

              {activeQuarterSection === "parent" ? (
              <section className="weekly-subsection">
                <div className="review-form-grid">
                  <div aria-labelledby="quarter-parent-title">
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
                  </div>
                </div>
                <div className="section-review-row">
                  <button className="primary-button" type="button" onClick={() => markQuarterSectionReviewed("parent")} disabled={reviewedQuarterSections.includes("parent")}>
                    {reviewedQuarterSections.includes("parent") ? "Reviewed" : "Mark Parent Ratings Reviewed"}
                  </button>
                </div>
              </section>
              ) : null}

              {activeQuarterSection === "portfolio" ? (
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
                <div className="section-review-row">
                  <button className="primary-button" type="button" onClick={() => markQuarterSectionReviewed("portfolio")} disabled={reviewedQuarterSections.includes("portfolio")}>
                    {reviewedQuarterSections.includes("portfolio") ? "Reviewed" : "Mark Portfolio Reviewed"}
                  </button>
                </div>
              </section>
              ) : null}
                  </div>
                </div>
              ) : null}
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
                  <button className="secondary-button" type="button" onClick={() => void saveAnnualPlan("active", "Annual Plan saved. Daily logs remain the record of what actually happened.")} disabled={isAnnualPlanSaving || isAnnualPlanLoading}>
                    {isAnnualPlanSaving ? "Saving..." : "Save Plan"}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => { updateAnnualPlan("Generated records/2026-2027/annual-plan.md with big picture, spines, rhythm, unit sequence, journals, capstone, and records."); setRecordsSnapshotMessage("Annual Plan export: regenerated records/2026-2027/annual-plan.md from saved annual plan fields."); }}>Export Markdown</button>
                  <button className="secondary-button" type="button" onClick={() => void exportAnnualPlanPdf()} disabled={isAnnualPlanBusy}>Export PDF</button>
                  <button className="primary-button" type="button" onClick={() => void saveAnnualPlan("finalized", "Annual Plan finalized and saved for the school year. It can still be archived at annual closeout.")} disabled={isAnnualPlanSaving || isAnnualPlanLoading}>
                    Finalize Plan
                  </button>
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
              <SaveStateIndicator
                label={isAnnualPlanLoading ? "Loading plan" : isAnnualPlanSaving ? "Saving plan" : "Annual Plan save state"}
                message={isAnnualPlanLoading ? "Loading saved Annual Plan..." : isAnnualPlanSaving ? "Saving Annual Plan changes..." : annualPlanMessage}
                status={isAnnualPlanLoading || isAnnualPlanSaving ? "saving" : saveStateFromMessage(annualPlanMessage)}
              />

              <AnnualPlanSectionHub
                sections={annualPlanSections}
                activeSectionId={activeAnnualPlanSection}
                finalizedSectionIds={finalizedAnnualPlanSections}
                onSelectSection={(sectionId) => setActiveAnnualPlanSection(sectionId as AnnualPlanSectionId)}
              />

              {activeAnnualPlanSection === "section-1" ? (
                <AnnualPlanBigPictureSection
                  bigPicture={annualPlanBigPicture}
                  onUpdateBigPicture={updateAnnualPlanBigPicture}
                  onFinalize={() => finalizeAnnualPlanSection("section-1")}
                />
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
                <AnnualPlanEditableCardList
                  cards={curriculumSpines}
                  editingCardId={editingSpineId}
                  emptyTitle="Untitled spine"
                  emptyNarrative="Add the narrative for this recurring curriculum spine."
                  narrativeLabel="Narrative text"
                  onMoveCard={moveCurriculumSpine}
                  onEditCard={setEditingSpineId}
                  onDeleteCard={deleteCurriculumSpine}
                  onUpdateCard={updateCurriculumSpine}
                />
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
                <AnnualPlanEditableCardList
                  cards={weeklyRhythmDays}
                  editingCardId={editingRhythmDayId}
                  emptyTitle="Untitled rhythm day"
                  emptyNarrative="Add the rhythm, expected learning pattern, and evidence for this day."
                  narrativeLabel="Description"
                  onMoveCard={moveWeeklyRhythmDay}
                  onEditCard={setEditingRhythmDayId}
                  onDeleteCard={deleteWeeklyRhythmDay}
                  onUpdateCard={updateWeeklyRhythmDay}
                />
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
                <AnnualPlanUnitTable
                  rows={unitPlanRows}
                  unitFormatOptions={unitFormatOptions}
                  weeklyRhythmOverrideOptions={weeklyRhythmOverrideOptions}
                  unitStatusOptions={unitStatusOptions}
                  onSelectExistingZero={selectExistingZero}
                  onMoveRowTo={moveUnitPlanRowTo}
                  onUpdateRow={updateUnitPlanRow}
                  onDeleteRow={deleteUnitPlanRow}
                />
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
                <AnnualPlanEditableCardList
                  cards={journalPortfolioCards}
                  editingCardId={editingJournalPortfolioId}
                  emptyTitle="Untitled journal or portfolio"
                  emptyNarrative="Add the purpose, update rhythm, and expected contents for this card."
                  narrativeLabel="Description"
                  onMoveCard={moveJournalPortfolioCard}
                  onEditCard={setEditingJournalPortfolioId}
                  onDeleteCard={deleteJournalPortfolioCard}
                  onUpdateCard={updateJournalPortfolioCard}
                />
              </section>
              ) : null}

              {activeAnnualPlanSection === "section-7" ? (
              <section className="plan-section">
                <div className="section-head">
                  <div><p className="eyebrow">Section 7</p><h2>Annual Records</h2></div>
                  <div className="primary-action-row">
                    <button className="secondary-button" type="button" onClick={addAnnualRecordCard}>Add card</button>
                    <button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-7")}>Finalize</button>
                  </div>
                </div>
                <AnnualPlanRecordCardList
                  cards={annualRecordCards}
                  editingCardId={editingAnnualRecordId}
                  formatBytes={formatBytes}
                  onMoveCard={moveAnnualRecordCard}
                  onEditCard={setEditingAnnualRecordId}
                  onDeleteCard={deleteAnnualRecordCard}
                  onUpdateCard={updateAnnualRecordCard}
                  onUploadAttachment={(cardId, file) => void uploadAnnualRecordAttachment(cardId, file)}
                  onRemoveAttachment={removeAnnualRecordAttachment}
                />
              </section>
              ) : null}

              {activeAnnualPlanSection === "section-8" ? (
              <section className="plan-section">
                <div className="section-head"><div><p className="eyebrow">Section 8</p><h2>Annual Plan Exports</h2></div><div className="primary-action-row"><button className="secondary-button" type="button" onClick={() => { updateAnnualPlan("Generated records/2026-2027/annual-plan.md with big picture, spines, daily expectations, weekly rhythm, unit sequence, journals, capstone, and records."); setRecordsSnapshotMessage("Annual Plan export: regenerated records/2026-2027/annual-plan.md from saved annual plan fields."); }}>Generate Annual Plan Markdown</button><button className="secondary-button" type="button" onClick={() => void exportAnnualPlanPdf()} disabled={isAnnualPlanBusy}>Generate Annual Plan PDF</button><button className="secondary-button" type="button" onClick={() => updateAnnualPlan("Annual Plan added to the Legal Archive as the school-year planning framework.", annualPlanStatus)}>Add to Legal Archive</button><button className="primary-button" type="button" onClick={() => finalizeAnnualPlanSection("section-8")}>Finalize</button></div></div>
                {lastAnnualPlanPdfArtifact ? (
                  <div className="status-line">
                    <span>{lastAnnualPlanPdfArtifact.originalName}</span>
                    <a className="download-link" href={`/api/artifacts/${lastAnnualPlanPdfArtifact.id}/download`} target="_blank" rel="noreferrer">
                      Open PDF
                    </a>
                  </div>
                ) : null}
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
            <section className="panel weekly-review-panel" id="annual-review">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Annual Review</p>
                  <h2>School-year closeout</h2>
                  <p className="panel-note">Annual closeout finalizes the school year, keeps previous records retrievable, and starts the next school year with a fresh quarter cycle.</p>
                </div>
                <div className="primary-action-row">
                  <button className="secondary-button" type="button" onClick={() => setAnnualReviewStatusMessage("Annual Review draft prepared from available school-year portfolio-linked records. Full annual generator still needs backend wiring.")}>Generate Annual Review</button>
                  <button className="secondary-button" type="button" onClick={() => setAnnualReviewStatusMessage("Annual Review draft saved for the school-year closeout workspace.")}>Save Draft</button>
                  <button className="primary-button" type="button" onClick={() => setAnnualReviewStatusMessage("Annual Review closeout marked finalized in this workspace. Archive export wiring can be added next.")}>Finalize Closeout</button>
                </div>
              </div>
              <SaveStateIndicator
                label="Annual review state"
                message={annualReviewStatusMessage}
                status={saveStateFromMessage(annualReviewStatusMessage)}
              />

              <div className="weekly-section-hub" aria-label="Annual review sections">
                {[
                  ["summary", "Summary Info", "School-year time, records, legal coverage, and charts"],
                  ["parent", "Parent Ratings", "Annual parent reflection and next-year direction"],
                  ["student", "Student Reflection", "Student year-end reflection and self-rating"],
                  ["skills", "Skills Review", "Annual skill patterns and parent notes"],
                  ["portfolio", "Portfolio", "Annual highlight selections and archive targets"]
                ].map(([key, label, description]) => (
                  <button
                    className={[
                      "weekly-section-button",
                      activeAnnualReviewSection === key && isAnnualReviewModalOpen ? "is-active" : "",
                      reviewedAnnualReviewSections.includes(key as WeeklyReviewSection) ? "is-reviewed" : ""
                    ].filter(Boolean).join(" ")}
                    key={key}
                    type="button"
                    onClick={() => {
                      setActiveAnnualReviewSection(key as WeeklyReviewSection);
                      setIsAnnualReviewModalOpen(true);
                    }}
                  >
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>

              {isAnnualReviewModalOpen ? (
                <div
                  className="weekly-review-modal-backdrop"
                  role="presentation"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setIsAnnualReviewModalOpen(false);
                  }}
                >
                  <div className="weekly-review-modal" role="dialog" aria-modal="true" aria-labelledby="annual-review-modal-title">
                    <div className="section-head weekly-review-modal-head">
                      <div>
                        <p className="eyebrow">Annual Review Section</p>
                        <h2 id="annual-review-modal-title">{weeklySectionLabels[activeAnnualReviewSection]}</h2>
                      </div>
                      <button className="secondary-button" type="button" onClick={() => setIsAnnualReviewModalOpen(false)}>Close</button>
                    </div>

              {activeAnnualReviewSection === "summary" ? (
              <section className="weekly-subsection is-open">
              <div className="review-metrics">
                <div className="review-metric"><span>Total time</span><strong>{formatMinutes(annualReviewTicker.totalMinutes)}</strong></div>
                <div className="review-metric"><span>Meaningful days</span><strong>{annualReviewTicker.meaningfulDays} of {annualReviewTicker.weekdays}</strong></div>
                <div className="review-metric"><span>Weekend +1 days</span><strong>{annualReviewTicker.weekendDays}</strong></div>
                <div className="review-metric"><span>Days with records</span><strong>{annualReviewTicker.daysWithRecords}</strong></div>
                <div className="review-metric"><span>Activities</span><strong>{annualReviewTicker.activities}</strong></div>
                <div className="review-metric"><span>Quarter reviews</span><strong>{quarterStatus === "finalized" ? 1 : 0}</strong></div>
                <div className="review-metric"><span>Portfolio items</span><strong>{portfolioArtifacts.length}</strong></div>
              </div>
              <div className="coverage-summary-grid">
                <div className="record-link"><strong>Subject time summary</strong><span>{Object.entries(annualReviewSubjectTimeSummary).length ? Object.entries(annualReviewSubjectTimeSummary).map(([subject, minutes]) => `${subject} ${formatMinutes(minutes)}`).join("; ") : "Annual Review generator is not built yet. Portfolio-linked records can populate this chart as records accumulate."}</span></div>
                <div className="record-link"><strong>Cross-subject summary</strong><span>Cross-subject links are shown separately and are not counted as extra instructional time.</span></div>
                <div className="record-link"><strong>Review scope</strong><span>Full school-year closeout.</span></div>
              </div>
              <SubjectTimeCharts summary={annualReviewSubjectTimeSummary} emptyText="Annual Review charts will populate after annual review source data is generated or portfolio-linked activities exist." />
              <CrossSubjectChartPlaceholder />
              <div className="section-review-row">
                <button className="primary-button" type="button" onClick={() => markAnnualReviewSectionReviewed("summary")} disabled={reviewedAnnualReviewSections.includes("summary")}>
                  {reviewedAnnualReviewSections.includes("summary") ? "Reviewed" : "Mark Summary Info Reviewed"}
                </button>
              </div>
              </section>
              ) : null}

              {activeAnnualReviewSection === "parent" ? (
              <section className="weekly-subsection">
              <div className="weekly-notes-grid">
                <label><span>Parent annual reflection</span><textarea defaultValue="Summarize growth, legal coverage, portfolio choices, and next school year recommendations." /></label>
                <label>
                  <span>Overall annual rating</span>
                  <select defaultValue="Practicing">
                    {weeklyRatings.map((rating) => <option key={rating}>{rating}</option>)}
                  </select>
                </label>
                <label><span>Next school year direction</span><textarea defaultValue="Name the next-year priorities, review needs, unit themes, and portfolio goals." /></label>
              </div>
              <div className="section-review-row">
                <button className="primary-button" type="button" onClick={() => markAnnualReviewSectionReviewed("parent")} disabled={reviewedAnnualReviewSections.includes("parent")}>
                  {reviewedAnnualReviewSections.includes("parent") ? "Reviewed" : "Mark Parent Ratings Reviewed"}
                </button>
              </div>
              </section>
              ) : null}

              {activeAnnualReviewSection === "student" ? (
              <section className="weekly-subsection">
              <div className="weekly-notes-grid">
                <label><span>Student annual reflection</span><textarea defaultValue="What did I learn this year? What am I proud of? What do I want to learn next year?" /></label>
                <label>
                  <span>Student self-rating</span>
                  <select defaultValue="I can do this with help">
                    {studentRatings.map((rating) => <option key={rating}>{rating}</option>)}
                  </select>
                </label>
                <label><span>Favorite year-end memory</span><input defaultValue="" placeholder="Add a year-end highlight." /></label>
              </div>
              <div className="section-review-row">
                <button className="primary-button" type="button" onClick={() => markAnnualReviewSectionReviewed("student")} disabled={reviewedAnnualReviewSections.includes("student")}>
                  {reviewedAnnualReviewSections.includes("student") ? "Reviewed" : "Mark Student Reflection Reviewed"}
                </button>
              </div>
              </section>
              ) : null}

              {activeAnnualReviewSection === "skills" ? (
              <section className="weekly-subsection">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Skills Review</p>
                    <h2>Annual skill patterns</h2>
                  </div>
                  <span className="tag">Parent final rating overrides suggestions</span>
                </div>
                <div className="skill-rating-list">
                  {annualReviewSkillRows.map((skill) => (
                    <article className="skill-rating-row" key={skill}>
                      <div>
                        <strong>{skill}</strong>
                        <p className="skill-evidence">Evidence comes from available school-year records and portfolio-linked activities for this annual timeframe.</p>
                      </div>
                      <div className="rating-buttons" aria-label={`${skill} annual rating`}>
                        {weeklyRatings.map((rating) => (
                          <button className={rating === "Practicing" ? "rating-button is-selected" : "rating-button"} type="button" key={`${skill}-${rating}`}>
                            {rating}
                          </button>
                        ))}
                      </div>
                      <label><span>Parent note</span><input placeholder="Add an annual skill note." /></label>
                    </article>
                  ))}
                </div>
                <div className="section-review-row">
                  <button className="primary-button" type="button" onClick={() => markAnnualReviewSectionReviewed("skills")} disabled={reviewedAnnualReviewSections.includes("skills")}>
                    {reviewedAnnualReviewSections.includes("skills") ? "Reviewed" : "Mark Skills Review Reviewed"}
                  </button>
                </div>
              </section>
              ) : null}

              {activeAnnualReviewSection === "portfolio" ? (
              <section className="weekly-subsection">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Portfolio</p>
                    <h2>Annual highlights and archive targets</h2>
                  </div>
                  <span className="tag">{portfolioArtifacts.length} available</span>
                </div>
                <div className="portfolio-grid">
                  {portfolioArtifacts.slice(0, 20).map((artifact) => (
                    <label className="portfolio-card" key={artifact.id}>
                      <input type="checkbox" />
                      <span><strong>{artifact.originalName}</strong><br />{artifact.activity?.title ?? "Portfolio artifact"}</span>
                    </label>
                  ))}
                  {portfolioArtifacts.length === 0 ? <p className="muted">Portfolio highlights will appear here after proof files are saved. Generated PDFs are grouped in Reports.</p> : null}
                </div>
              <div className="records-grid">
                <div className="record-link"><strong>Legal compliance summary</strong><span>Regenerate records/{schoolYear}/legal-summary.md and legal archive PDF.</span></div>
                <div className="record-link"><strong>Annual portfolio</strong><span>Select final highlights and generate annual portfolio PDF.</span></div>
                <div className="record-link"><strong>Archive status</strong><span>After closeout, prior school year remains retrievable and new records start in the next year.</span></div>
              </div>
              <div className="section-review-row">
                <button className="primary-button" type="button" onClick={() => markAnnualReviewSectionReviewed("portfolio")} disabled={reviewedAnnualReviewSections.includes("portfolio")}>
                  {reviewedAnnualReviewSections.includes("portfolio") ? "Reviewed" : "Mark Portfolio Reviewed"}
                </button>
              </div>
              </section>
              ) : null}
                  </div>
                </div>
              ) : null}
            </section>
            ) : null}

            {activeTab === "records" ? (
            <section className="panel markdown-panel" id="records-snapshots">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Records & Snapshots</p>
                  <h2>Background backup archive</h2>
                  <p className="panel-note">This workspace runs mostly in the background. It keeps small checkpoints after important saves and full ZIP backup packages for disaster recovery.</p>
                </div>
                <div className="primary-action-row">
                  <button className="secondary-button" type="button" onClick={() => void loadSnapshots()} disabled={isSnapshotBusy}>
                    {isSnapshotBusy ? "Loading..." : "Refresh Archive"}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => void createFullBackupSnapshot()} disabled={isSnapshotBusy}>
                    Create Full Backup Now
                  </button>
                  <button className="secondary-button" type="button" onClick={() => void verifyLatestFullBackupSnapshot()} disabled={isSnapshotBusy}>
                    Verify Latest Full Backup
                  </button>
                </div>
              </div>
              <SaveStateIndicator
                label={isSnapshotBusy ? "Working on backup" : "Backup state"}
                message={isSnapshotBusy ? "Creating, loading, or verifying backup records..." : recordsSnapshotMessage}
                status={isSnapshotBusy ? "saving" : saveStateFromMessage(recordsSnapshotMessage)}
              />
              <div className="snapshot-count-grid">
                <div className="education-ticker-card"><span>Activities</span><strong>{snapshotCounts.activities}</strong><small>Saved records</small></div>
                <div className="education-ticker-card"><span>Artifacts</span><strong>{snapshotCounts.artifacts}</strong><small>Files and generated PDFs</small></div>
                <div className="education-ticker-card"><span>Weekly Reviews</span><strong>{snapshotCounts.weeklyReviews}</strong><small>Drafts and finalized reviews</small></div>
                <div className="education-ticker-card"><span>Quarter Reviews</span><strong>{snapshotCounts.quarterReviews}</strong><small>Quarter records</small></div>
                <div className="education-ticker-card"><span>Annual Plans</span><strong>{snapshotCounts.annualPlans}</strong><small>Saved plan records</small></div>
                <div className="education-ticker-card"><span>Legal Buckets</span><strong>{snapshotCounts.legalBuckets}</strong><small>File-cabinet sections</small></div>
              </div>
              <details className="snapshot-automation-card">
                <summary>
                  <div>
                    <p className="eyebrow">Automatic Backup Rules</p>
                    <h3>Runs after important saves</h3>
                  </div>
                  <span className="tag">Passive</span>
                </summary>
                <div className="records-grid">
                  <div className="record-link"><strong>Daily records</strong><span>Creates a checkpoint after approved activity saves.</span></div>
                  <div className="record-link"><strong>Reviews</strong><span>Creates checkpoints after weekly and quarter review saves.</span></div>
                  <div className="record-link"><strong>Reports</strong><span>Links generated daily, weekly, quarter, annual plan, and portfolio PDFs.</span></div>
                  <div className="record-link"><strong>Portfolio lists</strong><span>Backs up book list, awards, projects, field trips, and setbacks.</span></div>
                  <div className="record-link"><strong>Legal Archive</strong><span>Records review and file connection actions.</span></div>
                  <div className="record-link"><strong>Monthly full backup</strong><span>Creates one ZIP package each month with records plus available file copies.</span></div>
                  <div className="record-link"><strong>Manual fallback</strong><span>Use Create Full Backup Now before experimenting or major clean-up.</span></div>
                  <div className="record-link"><strong>Close-out safeguard</strong><span>Creates a full ZIP backup before prior-year running lists are cleared.</span></div>
                </div>
              </details>
              <details className="snapshot-automation-card">
                <summary>
                  <div>
                    <p className="eyebrow">Snapshot Archive</p>
                    <h3>{snapshots.length} recent checkpoint{snapshots.length === 1 ? "" : "s"}</h3>
                  </div>
                  <span className="tag">Newest first</span>
                </summary>
                <div className="report-list">
                  {snapshots.length ? snapshots.map((snapshot) => (
                    <article className="report-list-row" key={snapshot.id}>
                      <div>
                        <strong>{snapshot.label}</strong>
                        <span>{snapshot.type.replace(/_/g, " ")} - {dateLabel(snapshot.createdAt)}</span>
                        {!snapshot.filePath.startsWith("/api/") ? <span>{snapshot.filePath}</span> : null}
                      </div>
                      {snapshot.filePath.startsWith("/api/") ? (
                        <a className="secondary-button" href={snapshot.filePath} target="_blank" rel="noreferrer">Open</a>
                      ) : (
                        <span className="tag">Markdown path</span>
                      )}
                    </article>
                  )) : (
                    <p className="muted">No checkpoints yet. Save a record, generate a PDF, or use Create Full Backup Now.</p>
                  )}
                </div>
              </details>
              <details className="snapshot-automation-card">
                <summary>
                  <div>
                    <p className="eyebrow">Audit Log</p>
                    <h3>{auditLogs.length} recent action{auditLogs.length === 1 ? "" : "s"}</h3>
                  </div>
                  <span className="tag">Newest first</span>
                </summary>
                <div className="report-list">
                  {auditLogs.length ? auditLogs.map((entry) => (
                    <article className="report-list-row" key={entry.id}>
                      <div>
                        <strong>{entry.label}</strong>
                        <span>{entry.action.replace(/_/g, " ")} - {dateLabel(entry.createdAt)}</span>
                      </div>
                      <span className="tag">Logged</span>
                    </article>
                  )) : (
                    <p className="muted">No audit entries yet. Saves, uploads, generated PDFs, backups, and protected planner decisions will appear here.</p>
                  )}
                </div>
              </details>
            </section>
            ) : null}

            {activeTab === "reports" ? (
            <section className="panel reports-panel" id="reports">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Reports</p>
                  <h2>Generated report buckets</h2>
                  <p className="panel-note">Generated PDFs live here. Portfolio stays focused on proof of learning: uploads, images, documents, and artifacts.</p>
                </div>
                <button className="secondary-button" type="button" onClick={() => void loadPortfolio()} disabled={isLoadingPortfolio}>
                  {isLoadingPortfolio ? "Loading..." : "Refresh reports"}
                </button>
              </div>
              <div className="report-bucket-grid">
                {reportBucketRows.map((bucket) => (
                  <details className="report-bucket-card" key={bucket.key}>
                    <summary className="report-bucket-summary">
                      <div>
                        <p className="eyebrow">{bucket.label}</p>
                        <h3>{bucket.artifacts.length} report{bucket.artifacts.length === 1 ? "" : "s"}</h3>
                        <p className="panel-note">{bucket.description}</p>
                      </div>
                      <span className="report-expand-label">Open</span>
                    </summary>
                    <div className="report-list">
                      {bucket.artifacts.length ? bucket.artifacts.map((artifact) => (
                        <article className="report-list-row" key={artifact.id}>
                          <div>
                            <strong>{artifact.originalName}</strong>
                            <span>{dateLabel(artifact.createdAt)} - {artifact.recordStatus}</span>
                          </div>
                          <a className="download-link" href={`/api/artifacts/${artifact.id}/download`} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        </article>
                      )) : <p className="muted">No reports in this bucket yet.</p>}
                    </div>
                  </details>
                ))}
              </div>
            </section>
            ) : null}

            {activeTab === "legal" ? (
            <section className="panel legal-archive-panel" id="legal-archive">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Legal Archive</p>
                  <h2>Legal file cabinet</h2>
                  <p className="panel-note">Twice-yearly review dates are June 15 and December 15. Upload files here or connect existing PDFs from Reports and Portfolio.</p>
                </div>
                <button className="secondary-button" type="button" onClick={() => { void loadLegalArchive(); void loadPortfolio(); void loadAllSavedActivities(); }} disabled={isLegalArchiveBusy}>
                  {isLegalArchiveBusy ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              <p className="status-line" role="status">{legalArchiveMessage}</p>
              <div className="education-ticker-grid" aria-label="Meaningful education day counters">
                <div className="education-ticker-card">
                  <span>Traditional school year</span>
                  <strong>{educationDayTicker.traditionalCount}</strong>
                  <small>{formatUsDate(educationDayTicker.traditionalStart)} to {formatUsDate(educationDayTicker.traditionalEnd)}</small>
                </div>
                <div className="education-ticker-card">
                  <span>Summer extension</span>
                  <strong>{educationDayTicker.summerCount}</strong>
                  <small>{formatUsDate(educationDayTicker.summerStart)} to {formatUsDate(educationDayTicker.summerEnd)}</small>
                </div>
                <div className="education-ticker-card">
                  <span>Meaningful day rule</span>
                  <strong>180 min</strong>
                  <small>Approved activity time on one date</small>
                </div>
              </div>
              <div className="legal-bucket-grid">
                {legalArchiveBuckets.map((bucket) => {
                  const savedBucket = legalArchive.find((item) => item.bucketKey === bucket.key);
                  const statusValue = legalBucketStatus(savedBucket?.reviewedAt ?? null, schoolYear);
                  const reviewWindow = currentLegalReviewWindow(schoolYear);
                  return (
                    <button
                      className={activeLegalBucketKey === bucket.key ? "legal-bucket-button is-active" : "legal-bucket-button"}
                      key={bucket.key}
                      type="button"
                      onClick={() => setActiveLegalBucketKey(bucket.key)}
                    >
                      <span className={`review-dot is-${statusValue}`} />
                      <strong>{bucket.label}</strong>
                      <small>{savedBucket?.links.length ?? 0} file{savedBucket?.links.length === 1 ? "" : "s"} · due {formatUsDate(reviewWindow.dueDate)}</small>
                    </button>
                  );
                })}
              </div>
              <section className="legal-bucket-detail">
                <div className="section-head compact-head">
                  <div>
                    <p className="eyebrow">Selected bucket</p>
                    <h2>{legalArchiveBuckets.find((bucket) => bucket.key === activeLegalBucketKey)?.label}</h2>
                    <p className="panel-note">
                      Status: {legalBucketStatus(activeLegalBucket?.reviewedAt ?? null, schoolYear).replace("-", " ")}
                      {activeLegalBucket?.reviewedAt ? ` · last reviewed ${formatUsDate(activeLegalBucket.reviewedAt)}` : ""}
                    </p>
                  </div>
                  <button className="primary-button" type="button" onClick={() => void updateLegalArchive("review")} disabled={isLegalArchiveBusy}>
                    Mark reviewed
                  </button>
                </div>
                <div className="legal-connect-grid">
                  <label className="file-picker legal-upload-picker">
                    <span>Upload file to this bucket</span>
                    <input type="file" onChange={(event) => void uploadLegalArchiveFile(activeLegalBucketKey, event)} disabled={isLegalArchiveBusy} />
                  </label>
                  <label>
                    <span>Connect existing PDF or file</span>
                    <select value={selectedLegalArtifactId} onChange={(event) => setSelectedLegalArtifactId(event.target.value)}>
                      <option value="">Choose existing file</option>
                      {legalArtifactOptions.map((artifact) => (
                        <option key={artifact.id} value={artifact.id}>{artifact.originalName}</option>
                      ))}
                    </select>
                  </label>
                  <button className="secondary-button" type="button" onClick={() => void updateLegalArchive("connect")} disabled={isLegalArchiveBusy || !selectedLegalArtifactId}>
                    Connect file
                  </button>
                </div>
                <details className="report-bucket-card" open>
                  <summary className="report-bucket-summary">
                    <span>Files in this bucket</span>
                    <strong>{activeLegalBucket?.links.length ?? 0}</strong>
                  </summary>
                  <div className="report-list">
                    {activeLegalBucket?.links.length ? activeLegalBucket.links.map((link) => (
                      <article className="report-list-row portfolio-archive-row" key={link.id}>
                        <span><strong>{link.artifact.originalName}</strong><br />{dateLabel(link.artifact.createdAt)} · {link.artifact.recordStatus}</span>
                        <span>{formatBytes(link.artifact.sizeBytes)}</span>
                        <a className="download-link" href={`/api/artifacts/${link.artifact.id}/download`} target="_blank" rel="noreferrer">Open</a>
                      </article>
                    )) : <p className="muted">No files connected to this bucket yet.</p>}
                  </div>
                </details>
              </section>
            </section>
            ) : null}

            {activeTab === "portfolio" ? (
            <section className="panel portfolio-panel" id="portfolio">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Portfolio</p>
                  <h2>Portfolio workspace</h2>
                  <p className="panel-note">Choose proof files, Bennett&apos;s book list, or year-long portfolio lists. Generated reports stay in Reports; list PDFs stay with their portfolio section.</p>
                </div>
                <button className="secondary-button" type="button" onClick={() => void closeOutPriorSchoolYear()} disabled={isBookListBusy || isPortfolioListBusy}>
                  Close out prior school year
                </button>
              </div>
              <div className="weekly-section-hub portfolio-section-hub" aria-label="Portfolio sections">
                {[
                  ["proof", "Proof file explorer", "Browse uploaded images, documents, and activity artifacts."],
                  ["books", "Book list", "Add completed books with author, finish date, and student rating."],
                  ["achievements", "Achievements & Awards", "Track dated achievements and awards with a short note."],
                  ["accolades", "Accolades", "Save praise, recognition, and outside feedback."],
                  ["projects", "Major Projects", "Track major project milestones and outcomes."],
                  ["fieldTrips", "Field trips", "Track field trip dates, narratives, and proof files."],
                  ["valuableFailures", "Valuable Setbacks & Failures", "Track setbacks, responses, reflections, plans, and follow-ups."]
                ].map(([key, label, description]) => (
                  <button
                    className={activePortfolioSection === key ? "weekly-section-button is-active" : "weekly-section-button"}
                    key={key}
                    type="button"
                    onClick={() => setActivePortfolioSection(key as PortfolioSection)}
                  >
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
              {activePortfolioSection === "proof" ? (
              <>
              <div className="section-head compact-head">
                <div>
                  <p className="eyebrow">Proof Archive</p>
                  <h2>Proof file explorer</h2>
                  <p className="panel-note">Portfolio shows proof of learning: uploaded images, documents, and activity artifacts.</p>
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
              </>
              ) : null}
              {activePortfolioSection === "books" ? (
              <section className="book-list-panel">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Running Book List</p>
                    <h2>Completed books</h2>
                    <p className="panel-note">Track completed books only. Bennett&apos;s book journal can hold reviews and longer notes.</p>
                  </div>
                  <div className="primary-action-row">
                    <button className="secondary-button" type="button" onClick={addBookListEntry}>Add book</button>
                    <button className="secondary-button" type="button" onClick={() => void compilePortfolioPdf("books")} disabled={isBookListBusy}>
                      Compile PDF
                    </button>
                    <button className="primary-button" type="button" onClick={() => void saveBookList()} disabled={isBookListBusy}>
                      {isBookListBusy ? "Saving..." : "Save book list"}
                    </button>
                  </div>
                </div>
                <p className="status-line" role="status">{bookListMessage}</p>
                <div className="book-list-table">
                  <div className="book-list-header" aria-hidden="true">
                    <span>Title</span>
                    <span>Author</span>
                    <span>Date completed</span>
                    <span>Rating</span>
                    <span>Action</span>
                  </div>
                  {bookListEntries.length ? bookListEntries.map((entry) => (
                    <div className="book-list-row" key={entry.id}>
                      <label>
                        <span>Title</span>
                        <input value={entry.title} onChange={(event) => updateBookListEntry(entry.id, { title: event.target.value })} />
                      </label>
                      <label>
                        <span>Author</span>
                        <input value={entry.author} onChange={(event) => updateBookListEntry(entry.id, { author: event.target.value })} />
                      </label>
                      <label>
                        <span>Date completed</span>
                        <input type="date" value={entry.completedDate} onChange={(event) => updateBookListEntry(entry.id, { completedDate: event.target.value })} />
                      </label>
                      <label>
                        <span>Student rating</span>
                        <select value={entry.rating} onChange={(event) => updateBookListEntry(entry.id, { rating: Number(event.target.value) })}>
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <option key={rating} value={rating}>{rating} star{rating === 1 ? "" : "s"}</option>
                          ))}
                        </select>
                      </label>
                      <button className="text-button" type="button" onClick={() => deleteBookListEntry(entry.id)}>Delete</button>
                    </div>
                  )) : <p className="muted">No completed books added yet.</p>}
                </div>
                <details className="report-bucket-card">
                  <summary className="report-bucket-summary">
                    <span>Past book lists</span>
                    <strong>{portfolioArchiveArtifacts("books").length}</strong>
                  </summary>
                  <div className="report-list">
                    {portfolioArchiveArtifacts("books").length ? portfolioArchiveArtifacts("books").map((artifact) => (
                      <article className="report-list-row portfolio-archive-row" key={artifact.id}>
                        <span><strong>{artifact.originalName}</strong><br />{dateLabel(artifact.createdAt)}</span>
                        <span>{formatBytes(artifact.sizeBytes)}</span>
                        <a className="download-link" href={`/api/artifacts/${artifact.id}/download`} target="_blank" rel="noreferrer">Open</a>
                      </article>
                    )) : <p className="muted">No past book list PDFs yet.</p>}
                  </div>
                </details>
              </section>
              ) : null}
              {portfolioListCategories.filter((category) => category !== "valuableFailures").map((category) => (
                activePortfolioSection === category ? (
                <section className="book-list-panel" key={category}>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">{portfolioListLabels[category]}</p>
                      <h2>{portfolioListLabels[category]}</h2>
                      <p className="panel-note">Add dated notes. New entries appear at the top of the list.</p>
                    </div>
                    <div className="primary-action-row">
                      <button className="secondary-button" type="button" onClick={() => addPortfolioListEntry(category)}>Add row</button>
                      <button className="secondary-button" type="button" onClick={() => void compilePortfolioPdf(category)} disabled={isPortfolioListBusy}>
                        Compile PDF
                      </button>
                      <button className="primary-button" type="button" onClick={() => void savePortfolioList(category)} disabled={isPortfolioListBusy}>
                        {isPortfolioListBusy ? "Saving..." : "Save list"}
                      </button>
                    </div>
                  </div>
                  <p className="status-line" role="status">{portfolioListMessages[category]}</p>
                  <div className="book-list-table">
                    <div className="book-list-header portfolio-note-header" aria-hidden="true">
                      <span>Date</span>
                      <span>Narrative</span>
                      <span>Action</span>
                    </div>
                    {portfolioListEntries[category].length ? portfolioListEntries[category].map((entry) => (
                      <div className="book-list-row portfolio-note-row" key={entry.id}>
                        <label>
                          <span>Date</span>
                          <input type="date" value={entry.date} onChange={(event) => updatePortfolioListEntry(category, entry.id, { date: event.target.value })} />
                        </label>
                        <label>
                          <span>Short narrative</span>
                          <textarea value={entry.narrative} onChange={(event) => updatePortfolioListEntry(category, entry.id, { narrative: event.target.value })} />
                        </label>
                        <div className="portfolio-note-actions">
                          {proofEnabledPortfolioLists.includes(category) ? (
                            <>
                              <label className="secondary-button upload-inline-button">
                                Attach proof
                                <input
                                  type="file"
                                  onChange={(event) => void uploadPortfolioListArtifact(category, entry.id, event)}
                                />
                              </label>
                              <div className="attached-proof-list">
                                {entry.artifactIds.length ? entry.artifactIds.map((artifactId) => {
                                  const artifact = portfolioArtifacts.find((item) => item.id === artifactId);
                                  return artifact ? (
                                    <a href={`/api/artifacts/${artifact.id}/download`} key={artifact.id} target="_blank" rel="noreferrer">
                                      {artifact.originalName}
                                    </a>
                                  ) : (
                                    <span key={artifactId}>Attached proof</span>
                                  );
                                }) : <span>No proof attached</span>}
                              </div>
                            </>
                          ) : null}
                          <button className="text-button" type="button" onClick={() => deletePortfolioListEntry(category, entry.id)}>Delete</button>
                        </div>
                      </div>
                    )) : <p className="muted">No {portfolioListLabels[category].toLowerCase()} added yet.</p>}
                  </div>
                  <details className="report-bucket-card">
                    <summary className="report-bucket-summary">
                      <span>Past {portfolioListLabels[category]}</span>
                      <strong>{portfolioArchiveArtifacts(category).length}</strong>
                    </summary>
                    <div className="report-list">
                      {portfolioArchiveArtifacts(category).length ? portfolioArchiveArtifacts(category).map((artifact) => (
                        <article className="report-list-row portfolio-archive-row" key={artifact.id}>
                          <span><strong>{artifact.originalName}</strong><br />{dateLabel(artifact.createdAt)}</span>
                          <span>{formatBytes(artifact.sizeBytes)}</span>
                          <a className="download-link" href={`/api/artifacts/${artifact.id}/download`} target="_blank" rel="noreferrer">Open</a>
                        </article>
                      )) : <p className="muted">No past {portfolioListLabels[category].toLowerCase()} PDFs yet.</p>}
                    </div>
                  </details>
                </section>
                ) : null
              ))}
              {activePortfolioSection === "valuableFailures" ? (
                <section className="book-list-panel valuable-failures-panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Valuable Setbacks & Failures</p>
                      <h2>Valuable Setbacks & Failures</h2>
                      <p className="panel-note">Open items stay at the top. Once an event is resolved, the full thread moves to the bottom.</p>
                    </div>
                    <div className="primary-action-row">
                      <button className="secondary-button" type="button" onClick={() => addPortfolioListEntry("valuableFailures")}>Add row</button>
                      <button className="secondary-button" type="button" onClick={() => void compilePortfolioPdf("valuableFailures")} disabled={isPortfolioListBusy}>
                        Compile PDF
                      </button>
                      <button className="primary-button" type="button" onClick={() => void savePortfolioList("valuableFailures")} disabled={isPortfolioListBusy}>
                        {isPortfolioListBusy ? "Saving..." : "Save list"}
                      </button>
                    </div>
                  </div>
                  <p className="status-line" role="status">{portfolioListMessages.valuableFailures}</p>
                  <div className="valuable-failure-list">
                    {valuableFailureDisplayEntries().length ? valuableFailureDisplayEntries().map((entry) => {
                      const isExpandedResolvedEntry = entry.resolved && expandedResolvedFailureIds.includes(entry.id);
                      return (
                      <article className={entry.resolved ? `valuable-failure-card is-resolved${isExpandedResolvedEntry ? " is-expanded" : ""}` : "valuable-failure-card"} key={entry.id}>
                        {entry.resolved ? (
                          <button
                            className="valuable-failure-history-summary"
                            type="button"
                            onClick={() => toggleResolvedFailureExpanded(entry.id)}
                            aria-expanded={isExpandedResolvedEntry}
                          >
                            <strong>{entry.title.trim() || "Resolved event"}</strong>
                            <span>{dateLabel(entry.date)}</span>
                          </button>
                        ) : null}
                        <div className="valuable-failure-main-grid">
                          <label className="valuable-failure-title-field">
                            <span>Event title</span>
                            <input value={entry.title} onChange={(event) => updatePortfolioListEntry("valuableFailures", entry.id, { title: event.target.value })} />
                          </label>
                          <label className="valuable-failure-date-field">
                            <span>Date</span>
                            <input type="date" value={entry.date} onChange={(event) => updatePortfolioListEntry("valuableFailures", entry.id, { date: event.target.value })} />
                          </label>
                        </div>
                        <div className="valuable-failure-step-buttons" aria-label="Valuable setback reflection steps">
                          {valuableFailureStepOptions.map((option) => (
                            <button
                              className={(activeValuableFailureSteps[entry.id] ?? "setback") === option.key ? "step-button is-active" : "step-button"}
                              key={option.key}
                              type="button"
                              onClick={() => setActiveValuableFailureSteps((current) => ({ ...current, [entry.id]: option.key }))}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        {renderValuableFailureStepEditor(entry)}
                        <div className="valuable-failure-actions">
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={entry.resolved}
                              onChange={(event) => updatePortfolioListEntry("valuableFailures", entry.id, { resolved: event.target.checked })}
                            />
                            <span>Event resolved</span>
                          </label>
                          <button className="secondary-button" type="button" onClick={() => addValuableFailureFollowUp(entry.id)} disabled={entry.resolved}>
                            Create follow up
                          </button>
                          <button className="text-button" type="button" onClick={() => deletePortfolioListEntry("valuableFailures", entry.id)}>Delete</button>
                        </div>
                        {entry.followUps.length ? (
                          <div className="valuable-follow-up-list">
                            {entry.followUps.map((followUp, followUpIndex) => (
                              <div className="valuable-follow-up-row" key={followUp.id}>
                                <span className="follow-up-indent">Follow-up {followUpIndex + 1}</span>
                                <label>
                                  <span>Date</span>
                                  <input type="date" value={followUp.date} onChange={(event) => updateValuableFailureFollowUp(entry.id, followUp.id, { date: event.target.value })} />
                                </label>
                                <label>
                                  <span>Reattempt event</span>
                                  <textarea value={followUp.reattemptEvent} onChange={(event) => updateValuableFailureFollowUp(entry.id, followUp.id, { reattemptEvent: event.target.value })} />
                                </label>
                                <label>
                                  <span>Learning outcome</span>
                                  <textarea value={followUp.learningOutcome} onChange={(event) => updateValuableFailureFollowUp(entry.id, followUp.id, { learningOutcome: event.target.value })} />
                                </label>
                                <div className="valuable-failure-actions">
                                  <label className="checkbox-row">
                                    <input
                                      type="checkbox"
                                      checked={followUp.resolved || entry.resolved}
                                      onChange={(event) => {
                                        updateValuableFailureFollowUp(entry.id, followUp.id, { resolved: event.target.checked });
                                        updatePortfolioListEntry("valuableFailures", entry.id, { resolved: event.target.checked });
                                      }}
                                    />
                                    <span>Event resolved</span>
                                  </label>
                                  <button className="secondary-button" type="button" onClick={() => addValuableFailureFollowUp(entry.id)} disabled={entry.resolved}>
                                    Create follow up
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </article>
                      );
                    }) : <p className="muted">No valuable setbacks & failures added yet.</p>}
                  </div>
                  <details className="report-bucket-card">
                    <summary className="report-bucket-summary">
                      <span>Past Valuable Setbacks & Failures</span>
                      <strong>{portfolioArchiveArtifacts("valuableFailures").length}</strong>
                    </summary>
                    <div className="report-list">
                      {portfolioArchiveArtifacts("valuableFailures").length ? portfolioArchiveArtifacts("valuableFailures").map((artifact) => (
                        <article className="report-list-row portfolio-archive-row" key={artifact.id}>
                          <span><strong>{artifact.originalName}</strong><br />{dateLabel(artifact.createdAt)}</span>
                          <span>{formatBytes(artifact.sizeBytes)}</span>
                          <a className="download-link" href={`/api/artifacts/${artifact.id}/download`} target="_blank" rel="noreferrer">Open</a>
                        </article>
                      )) : <p className="muted">No past valuable setbacks & failures PDFs yet.</p>}
                    </div>
                  </details>
                </section>
              ) : null}
            </section>
            ) : null}
          </section>

          {activeTab !== "daily" && activeTab !== "portfolio" && activeTab !== "weekly" && activeTab !== "reports" && activeTab !== "legal" && activeTab !== "tools" ? (
          <aside className="side-column">
            {activeTab === "quarter" ? (
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
          </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
