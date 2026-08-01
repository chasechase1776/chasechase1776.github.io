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
  key: "daily" | "weekly" | "quarter" | "portfolio" | "legal" | "reports" | "tools";
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
  const [draftCards, setDraftCards] = useState<DraftCard[]>([]);
  const [status, setStatus] = useState("Ready to parse the current entry.");
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

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
        body: JSON.stringify({ reviewId: weeklyReviewId, status: statusValue, data: weeklyData, recordStatus: schoolYearStatus })
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
      if (weeklyStatus !== "finalized") {
        await saveWeeklyReview("finalized");
      }
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
                        {tab.key === "quarter" ? <span className="alert-sidebar-badge">Urgent</span> : null}
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
                    <p className="eyebrow">Skills Touched This Week</p>
                    <h2>Rate weekly skill progress</h2>
                  </div>
                  <span className="tag">Parent rating overrides AI suggestion</span>
                </div>
                <div className="skill-rating-list">
                  {(weeklyData.skillsTouchedThisWeek.length ? weeklyData.skillsTouchedThisWeek : ["Language Arts: Reading", "Math: Measurement and Money", "Science: Uses Tools and Models"]).map((skill, index) => (
                    <article className="skill-rating-row" key={skill}>
                      <div>
                        <strong>{skill}</strong>
                        <p className="skill-evidence">Evidence comes from approved activities and attached proof for this week.</p>
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
                  <h2>Quarter 1 review due soon</h2>
                  <p>Due in 3 days. This flags review work only; daily records are never changed or deleted.</p>
                </div>
                <span className="alert-status">Urgent</span>
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
