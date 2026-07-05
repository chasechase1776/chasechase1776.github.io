"use client";

import { useEffect, useMemo, useState } from "react";

type Activity = {
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
  skills?: { skill: { subject: string; name: string } }[];
  artifacts?: { id: string; originalName: string }[];
};

type DraftActivity = {
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

type ActivityButtonState = "neutral" | "completed" | "needs-review" | "selected";

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

const subjectSkills = {
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

const subjects = Object.keys(subjectSkills);
const legalCategories = ["Reading", "Spelling", "Grammar", "Mathematics", "Good Citizenship", "Visual Curriculum", "Bona Fide Instruction"];
const presets = [15, 20, 30, 45, 60];

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function loadLastUsed(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  if (!remainder) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function inferSubject(activityType: string) {
  if (activityType.includes("Math")) return "Math";
  if (activityType.includes("Finance")) return "Finance";
  if (activityType.includes("Science")) return "Science";
  if (activityType.includes("Field Trip") || activityType.includes("Group")) return "Social Studies";
  return "Language Arts";
}

function suggestedLegalTags(activityType: string, subject: string) {
  const tags = new Set<string>(["Bona Fide Instruction", "Visual Curriculum"]);
  if (subject === "Language Arts") {
    tags.add("Reading");
    tags.add("Grammar");
    tags.add("Spelling");
  }
  if (subject === "Math" || subject === "Finance") tags.add("Mathematics");
  if (activityType.includes("Group") || subject === "Social Studies") tags.add("Good Citizenship");
  return Array.from(tags);
}

function weekRange(dateIso: string) {
  const selected = new Date(`${dateIso}T12:00:00`);
  const day = selected.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(selected);
  monday.setDate(selected.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10)
  };
}

export default function Home() {
  const [studentName, setStudentName] = useState("Bennett");
  const [schoolYearLabel, setSchoolYearLabel] = useState("2026-2027 Trial / Enrichment");
  const [schoolYearStatus, setSchoolYearStatus] = useState("trial");
  const [officialStart, setOfficialStart] = useState("2027-05-01");
  const [unitTitle, setUnitTitle] = useState("Construction");
  const [date, setDate] = useState(todayIso());
  const [activityType, setActivityType] = useState("Language Arts");
  const [title, setTitle] = useState("");
  const [actualMinutes, setActualMinutes] = useState(20);
  const [narration, setNarration] = useState("");
  const [recordStatus, setRecordStatus] = useState("trial");
  const [primarySubject, setPrimarySubject] = useState("Language Arts");
  const [legalTags, setLegalTags] = useState<string[]>(suggestedLegalTags("Language Arts", "Language Arts"));
  const [selectedSkills, setSelectedSkills] = useState<{ subject: string; name: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedArtifactIds, setUploadedArtifactIds] = useState<string[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [drafts, setDrafts] = useState<DraftActivity[]>([]);
  const [status, setStatus] = useState("Ready.");
  const [isSaving, setIsSaving] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [expanded, setExpanded] = useState({ unit: false, subjects: true, legal: true, evidence: true, skills: true, notes: false });

  const canParse = Boolean(studentName && schoolYearLabel && unitTitle && date && activityType && narration.trim());
  const week = useMemo(() => weekRange(date), [date]);

  useEffect(() => {
    setStudentName(loadLastUsed("homeschool:lastStudent", "Bennett"));
    setSchoolYearLabel(loadLastUsed("homeschool:lastSchoolYear", "2026-2027 Trial / Enrichment"));
    setUnitTitle(loadLastUsed("homeschool:lastUnit", "Construction"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("homeschool:lastStudent", studentName);
    window.localStorage.setItem("homeschool:lastSchoolYear", schoolYearLabel);
    window.localStorage.setItem("homeschool:lastUnit", unitTitle);
  }, [schoolYearLabel, studentName, unitTitle]);

  useEffect(() => {
    const nextSubject = inferSubject(activityType);
    setPrimarySubject(nextSubject);
    setLegalTags(suggestedLegalTags(activityType, nextSubject));
  }, [activityType]);

  async function loadActivities(selectedDate = date) {
    const response = await fetch(`/api/activities?date=${selectedDate}`, { cache: "no-store" });
    const data = await response.json();
    setActivities(data.activities ?? []);
  }

  useEffect(() => {
    void loadActivities(date);
  }, [date]);

  const buttonStates = useMemo<Record<string, ActivityButtonState>>(() => {
    return activityTypes.reduce<Record<string, ActivityButtonState>>((acc, type) => {
      const approved = activities.some((activity) => activity.activityType === type && activity.parentApproved);
      const needsReview = activities.some(
        (activity) => activity.activityType === type && (!activity.parentApproved || activity.reviewStatus === "needs_review")
      );
      acc[type] = type === activityType ? "selected" : approved ? "completed" : needsReview ? "needs-review" : "neutral";
      return acc;
    }, {});
  }, [activities, activityType]);

  const weeklySubjectTotals = useMemo(() => {
    const totals = new Map<string, number>();
    activities
      .filter((activity) => activity.parentApproved)
      .forEach((activity) => {
        activity.allocations.forEach((allocation) => {
          totals.set(allocation.subject, (totals.get(allocation.subject) ?? 0) + allocation.minutes);
        });
      });
    return subjects.map((subject) => ({ subject, minutes: totals.get(subject) ?? 0 }));
  }, [activities]);

  const approvedCount = activities.filter((activity) => activity.parentApproved).length;
  const needsReviewCount = activities.filter((activity) => !activity.parentApproved || activity.reviewStatus === "needs_review").length;
  const artifactCount = activities.reduce((sum, activity) => sum + (activity.artifacts?.length ?? 0), 0);

  async function ensureArtifactIds() {
    if (uploadedArtifactIds.length || !file) return uploadedArtifactIds;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("recordStatus", recordStatus);
    formData.append("tagsJson", JSON.stringify([...legalTags, activityType, primarySubject]));
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Artifact upload failed.");
    const ids = [data.artifact.id as string];
    setUploadedArtifactIds(ids);
    return ids;
  }

  function activityPayload(parentApproved: boolean, artifactIds: string[]) {
    return {
      title: title.trim() || `${activityType} - ${date}`,
      date,
      actualMinutes,
      activityType,
      narration: narration.trim() || "Draft saved for parent review.",
      studentName,
      schoolYearLabel,
      schoolYearStatus,
      officialHomeschoolStartDate: officialStart,
      unitTitle,
      recordStatus,
      parentApproved,
      subjectAllocations: [{ subject: primarySubject, minutes: actualMinutes }],
      legalTags,
      skills: selectedSkills,
      artifactIds
    };
  }

  async function saveActivity(parentApproved: boolean) {
    setIsSaving(true);
    setStatus(parentApproved ? "Saving approved activity to the database..." : "Saving draft to the database...");
    try {
      const artifactIds = await ensureArtifactIds();
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityPayload(parentApproved, artifactIds))
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Activity save failed.");
      setStatus(
        parentApproved
          ? `Approved activity saved. Markdown snapshots regenerated: ${data.markdownFiles?.length ?? 0}.`
          : "Draft saved. It will show as needs review until approved."
      );
      setTitle("");
      setNarration("");
      setFile(null);
      setUploadedArtifactIds([]);
      setDrafts([]);
      await loadActivities(date);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function parseWithAi() {
    setIsParsing(true);
    setStatus("Parsing narration with the server-side AI parser...");
    try {
      const artifactIds = await ensureArtifactIds();
      const response = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student: studentName,
          schoolYear: schoolYearLabel,
          unitStudy: unitTitle,
          selectedDate: date,
          selectedActivityType: activityType,
          narrationText: narration,
          attachedArtifactIds: artifactIds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "AI parse failed. Manual logging is still available.");
      const parsedDrafts = (data.drafts ?? []) as DraftActivity[];
      setDrafts(parsedDrafts);
      if (parsedDrafts[0]) {
        setTitle(parsedDrafts[0].title);
        setActualMinutes(parsedDrafts[0].actualMinutes);
        setPrimarySubject(parsedDrafts[0].subjectAllocations[0]?.subject ?? primarySubject);
        setLegalTags(parsedDrafts[0].legalTags);
        setSelectedSkills(parsedDrafts[0].skills);
      }
      setStatus(`${data.note} Review the cards below, then approve and save when ready.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI parse failed. Manual logging is still available.");
    } finally {
      setIsParsing(false);
    }
  }

  async function generateWeeklyReview() {
    setStatus("Generating weekly review draft from saved approved logs...");
    const response = await fetch("/api/reviews/weekly/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolYearLabel, weekStartDate: week.start, recordStatus })
    });
    const data = await response.json();
    setStatus(response.ok ? `Weekly review draft generated from ${data.data.activitiesLogged} approved activities.` : data.error);
  }

  async function regenerateMarkdown() {
    setStatus("Regenerating Markdown snapshots from database records...");
    const response = await fetch("/api/exports/markdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolYearLabel })
    });
    const data = await response.json();
    setStatus(response.ok ? `Markdown files generated: ${data.generated.length}.` : "Markdown export failed.");
  }

  async function exportPdf() {
    setStatus("Preparing PDF export...");
    const response = await fetch("/api/exports/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolYearLabel })
    });
    if (!response.ok) {
      setStatus("PDF export failed.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bennett-homeschool-export.pdf";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("PDF export downloaded.");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/passcode";
  }

  function toggleLegalTag(tag: string) {
    setLegalTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  function toggleSkill(subject: string, name: string) {
    setSelectedSkills((current) =>
      current.some((skill) => skill.subject === subject && skill.name === name)
        ? current.filter((skill) => !(skill.subject === subject && skill.name === name))
        : [...current, { subject, name }]
    );
  }

  return (
    <main className="mockup-shell">
      <aside className="sidebar">
        <div className="brand">
          <p className="eyebrow">Private Records</p>
          <h1>Bennett Homeschool</h1>
        </div>
        <nav aria-label="School year navigation">
          <p className="tree-title">School Years</p>
          <ul className="tree">
            <li>
              <a className="is-active" href="#entry">
                2026-2027 <span>{schoolYearStatus}</span>
              </a>
              <ul>
                <li><a href="#annual-plan">Annual Plan</a></li>
                <li><a href="#entry">Daily Records</a></li>
                <li><a href="#unit-study">Unit Studies</a></li>
                <li><a href="#weekly-review">Weekly Reviews</a></li>
                <li><a href="#quarter-review">Quarter Reviews <span className="alert-sidebar-badge">Urgent</span></a></li>
                <li><a href="#proof">Portfolio</a></li>
                <li><a href="#legal-coverage">Legal Archive</a></li>
                <li><a href="#markdown">Reports</a></li>
              </ul>
            </li>
            <li>
              <a href="#annual-plan">2027-2028 <span>Planned</span></a>
            </li>
          </ul>
          <p className="tree-title">Unit Studies</p>
          <ul className="tree">
            <li><a href="#unit-study">Construction <span>Active</span></a></li>
            <li><a href="#unit-study">Off the Land <span>Planned</span></a></li>
          </ul>
        </nav>
        <button className="secondary-button full-width" type="button" onClick={logout}>Logout</button>
      </aside>

      <section className="content">
        <header className="context-box">
          <div className="context-fields">
            <label>
              <span>Student</span>
              <input value={studentName} onChange={(event) => setStudentName(event.target.value)} />
            </label>
            <label>
              <span>School year</span>
              <input value={schoolYearLabel} onChange={(event) => setSchoolYearLabel(event.target.value)} />
            </label>
            <label>
              <span>Unit study</span>
              <input value={unitTitle} onChange={(event) => setUnitTitle(event.target.value)} />
            </label>
          </div>
          <div className="context-actions">
            <span className="database-pill">Prisma Postgres source of truth</span>
            <button type="button" onClick={regenerateMarkdown}>Sync Markdown</button>
          </div>
        </header>

        <section className="dashboard-grid" aria-label="Dashboard summary">
          <article className="review-alert-card">
            <div className="alert-head">
              <div>
                <p className="eyebrow">Quarter review alert</p>
                <h2>Quarter 1 review due soon</h2>
                <p>Records stay unchanged if the review becomes overdue; the review is only flagged until finalized or amended.</p>
              </div>
              <span className="alert-status">Urgent</span>
            </div>
            <div className="alert-grid">
              <span><strong>Weekly reviews</strong> 0 / 9</span>
              <span><strong>Needs review</strong> {needsReviewCount}</span>
              <span><strong>Missing time</strong> 0</span>
              <span><strong>Artifacts</strong> {artifactCount}</span>
              <span><strong>Portfolio candidates</strong> {approvedCount}</span>
              <span><strong>Legal gaps</strong> Good Citizenship, Finance</span>
            </div>
            <a className="primary-link" href="#quarter-review">Open Quarter Review</a>
          </article>
          <article className="panel compact-panel">
            <p className="eyebrow">Daily pace</p>
            <h2>Quick logs under one minute</h2>
            <p>Title, date, actual minutes, activity type, and narration are enough. Everything else expands only when needed.</p>
          </article>
        </section>

        <section className="main-grid">
          <div className="primary-column">
            <section className="panel" id="entry">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Daily log</p>
                  <h2>Narration-first activity entry</h2>
                </div>
                <label className="date-selector">
                  <span>Date</span>
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </label>
              </div>

              <div className="activity-legend">
                <span><i className="legend-dot" />Neutral</span>
                <span><i className="legend-dot done" />Completed</span>
                <span><i className="legend-dot review" />Needs review</span>
                <span><i className="legend-dot selected" />Selected</span>
              </div>
              <div className="activity-type-grid">
                {activityTypes.map((type) => (
                  <button
                    className={`activity-type-button is-${buttonStates[type]}`}
                    type="button"
                    key={type}
                    onClick={() => setActivityType(type)}
                  >
                    <strong>{type}</strong>
                    <span>{buttonStates[type] === "completed" ? "completed" : buttonStates[type] === "needs-review" ? "needs review" : "not logged"}</span>
                  </button>
                ))}
              </div>

              <div className="quick-entry-grid">
                <label>
                  <span>Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short title for this learning record" />
                </label>
                <label>
                  <span>Actual minutes</span>
                  <input type="number" min="1" value={actualMinutes} onChange={(event) => setActualMinutes(Number(event.target.value))} />
                </label>
              </div>
              <div className="preset-row" aria-label="Time allocation presets">
                {presets.map((preset) => (
                  <button className={preset === actualMinutes ? "preset-button is-active" : "preset-button"} type="button" key={preset} onClick={() => setActualMinutes(preset)}>
                    {preset} min
                  </button>
                ))}
              </div>

              <label className="narration-field">
                <span>Narration</span>
                <textarea value={narration} onChange={(event) => setNarration(event.target.value)} placeholder="What happened? What did Bennett do, say, make, read, solve, notice, explain, or ask?" />
              </label>

              <div className="artifact-block" id="proof">
                <div>
                  <p className="eyebrow">Artifact / Proof</p>
                  <h3>Camera-first evidence</h3>
                  <p>Optional. Any uploaded artifact inherits the activity type, subject, and legal tags when saved.</p>
                </div>
                <label className="file-picker">
                  <span>{file ? file.name : "Attach photo, scan, audio, or document"}</span>
                  <input type="file" accept="image/*,application/pdf,audio/*,video/*" capture="environment" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
              </div>

              <div className="primary-action-row">
                <button className="primary-button" type="button" onClick={parseWithAi} disabled={!canParse || isParsing}>
                  {isParsing ? "Parsing..." : "Parse with AI"}
                </button>
                <button className="secondary-button" type="button" onClick={() => void saveActivity(false)} disabled={isSaving || !narration.trim()}>
                  Save as Draft
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setNarration("");
                    setFile(null);
                    setUploadedArtifactIds([]);
                    setDrafts([]);
                    setStatus("Current entry cleared. Student, school year, unit, date, and selected activity type were preserved.");
                  }}
                >
                  Clear
                </button>
                <button className="primary-button" type="button" onClick={() => void saveActivity(true)} disabled={isSaving || !title.trim() || !narration.trim() || actualMinutes <= 0}>
                  {isSaving ? "Saving..." : "Approve & Save"}
                </button>
              </div>
              <p className="status-line" role="status">{status}</p>

              <div className="disclosure-stack">
                <Disclosure title="Unit, year, and record status" open={expanded.unit} onToggle={() => setExpanded((value) => ({ ...value, unit: !value.unit }))}>
                  <div className="form-grid">
                    <label><span>Year status</span><select value={schoolYearStatus} onChange={(event) => setSchoolYearStatus(event.target.value)}><option>planned</option><option>trial</option><option>active</option><option>closed</option><option>archived</option></select></label>
                    <label><span>Official start</span><input type="date" value={officialStart} onChange={(event) => setOfficialStart(event.target.value)} /></label>
                    <label><span>Record status</span><select value={recordStatus} onChange={(event) => setRecordStatus(event.target.value)}><option>trial</option><option>enrichment</option><option>official</option><option>excluded</option></select></label>
                  </div>
                </Disclosure>

                <Disclosure title="Subject time allocation" open={expanded.subjects} onToggle={() => setExpanded((value) => ({ ...value, subjects: !value.subjects }))}>
                  <div className="allocation-panel">
                    <label>
                      <span>Primary subject</span>
                      <select value={primarySubject} onChange={(event) => setPrimarySubject(event.target.value)}>
                        {subjects.map((subject) => <option key={subject}>{subject}</option>)}
                      </select>
                    </label>
                    <div className="allocation-total">
                      <span>Allocated subject minutes</span>
                      <strong>{actualMinutes} / {actualMinutes}</strong>
                      <p>Subject allocation equals actual activity minutes, so time is not double-counted.</p>
                    </div>
                  </div>
                </Disclosure>

                <Disclosure title="Legal tags" open={expanded.legal} onToggle={() => setExpanded((value) => ({ ...value, legal: !value.legal }))}>
                  <div className="tag-grid">
                    {legalCategories.map((tag) => (
                      <button className={legalTags.includes(tag) ? "tag-button is-active" : "tag-button"} type="button" key={tag} onClick={() => toggleLegalTag(tag)}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </Disclosure>

                <Disclosure title="Subject skills" open={expanded.skills} onToggle={() => setExpanded((value) => ({ ...value, skills: !value.skills }))}>
                  <div className="skills-matrix">
                    {Object.entries(subjectSkills).map(([subject, skills]) => (
                      <div className="skill-group" key={subject}>
                        <h3>{subject}</h3>
                        <div className="skill-list">
                          {skills.map((skill) => (
                            <button
                              className={selectedSkills.some((item) => item.subject === subject && item.name === skill) ? "tag-button is-active" : "tag-button"}
                              type="button"
                              key={skill}
                              onClick={() => toggleSkill(subject, skill)}
                            >
                              {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Disclosure>
              </div>
            </section>

            <section className="panel" id="review-summary">
              <div className="section-head">
                <div>
                  <p className="eyebrow">AI Review Summary</p>
                  <h2>Editable activity cards</h2>
                </div>
              </div>
              {drafts.length === 0 ? (
                <p className="muted">Parse with AI to create draft cards. Drafts are not permanent records until the parent approves and saves.</p>
              ) : (
                <div className="records-grid">
                  {drafts.map((draft, index) => (
                    <article className="activity-card" key={`${draft.title}-${index}`}>
                      <p className="eyebrow">Needs parent approval</p>
                      <h3>{draft.title}</h3>
                      <p>{draft.activityType} - {draft.actualMinutes} minutes - {draft.date}</p>
                      <div className="chip-row">
                        {draft.subjectAllocations.map((allocation) => <span key={allocation.subject}>{allocation.subject}: {allocation.minutes}m</span>)}
                        {draft.legalTags.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel" id="weekly-review">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Weekly Reviews</p>
                  <h2>{week.start} to {week.end}</h2>
                </div>
                <button className="primary-button" type="button" onClick={generateWeeklyReview}>Generate from Logs</button>
              </div>
              <div className="review-metrics">
                <Metric label="Approved time" value={formatMinutes(weeklySubjectTotals.reduce((sum, item) => sum + item.minutes, 0))} />
                <Metric label="Activities" value={String(approvedCount)} />
                <Metric label="Days logged" value={approvedCount ? "1" : "0"} />
                <Metric label="Artifacts" value={String(artifactCount)} />
                <Metric label="Needs review" value={String(needsReviewCount)} />
              </div>
              <div className="subject-tally">
                {weeklySubjectTotals.map((item) => (
                  <div key={item.subject}>
                    <span>{item.subject}</span>
                    <strong>{formatMinutes(item.minutes)}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel" id="quarter-review">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Quarter Reviews</p>
                  <h2>Guided 9-week checkpoint</h2>
                </div>
                <span className="alert-status">Due soon</span>
              </div>
              <div className="form-grid">
                <label><span>Period label</span><input defaultValue="Quarter 1" /></label>
                <label><span>Start date</span><input type="date" defaultValue="2026-09-01" /></label>
                <label><span>Review due date</span><input type="date" defaultValue="2026-10-30" /></label>
              </div>
              <p className="muted">Quarter review generation and persistence are the next backend layer. This MVP screen shows the workflow while daily logs, weekly drafts, exports, uploads, and AI parsing are already connected.</p>
            </section>

            <section className="panel" id="annual-plan">
              <p className="eyebrow">Annual Plan / School-Year Records</p>
              <h2>Big-picture plan</h2>
              <div className="form-grid">
                <label><span>Named year</span><input defaultValue="2026-2027 Trial / Enrichment" /></label>
                <label><span>Daily recurring expectation</span><input defaultValue="Read, narrate, move, make, discuss" /></label>
                <label><span>Primary unit sequence</span><input defaultValue="Construction, Off the Land, Community Helpers" /></label>
              </div>
            </section>

            <section className="panel markdown-panel" id="markdown">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Markdown Snapshot / Export</p>
                  <h2>Database remains source of truth</h2>
                </div>
                <div className="button-row">
                  <button className="secondary-button" type="button" onClick={regenerateMarkdown}>Generate Markdown</button>
                  <button className="secondary-button" type="button" onClick={exportPdf}>Export PDF</button>
                </div>
              </div>
              <pre>{`/records
  /2026-2027
    annual-plan.md
    legal-summary.md
    portfolio-index.md
    /days/${date}.md
    /weeks/${week.start}.md
    /units/construction/activities.md`}</pre>
            </section>
          </div>

          <aside className="side-column">
            <section className="panel" id="legal-coverage">
              <p className="eyebrow">Texas Legal Coverage</p>
              <h2>Coverage panel</h2>
              <div className="coverage-list">
                {legalCategories.map((category) => (
                  <div key={category}>
                    <span>{category}</span>
                    <strong>{legalTags.includes(category) ? "Covered" : "Light"}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel" id="unit-study">
              <p className="eyebrow">Unit Study</p>
              <h2>{unitTitle}</h2>
              <p className="muted">Active unit. New activities inherit this unit unless changed in the context box.</p>
              <div className="mini-stat"><span>Activities today</span><strong>{activities.length}</strong></div>
              <div className="mini-stat"><span>Approved</span><strong>{approvedCount}</strong></div>
            </section>

            <section className="panel">
              <p className="eyebrow">Subject Skills</p>
              <h2>Skills touched</h2>
              <div className="compact-skill-list">
                {(selectedSkills.length ? selectedSkills : [{ subject: primarySubject, name: subjectSkills[primarySubject as keyof typeof subjectSkills][0] }]).map((skill) => (
                  <span key={`${skill.subject}-${skill.name}`}>{skill.subject}: {skill.name}</span>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Saved Records</p>
                  <h2>{date}</h2>
                </div>
                <button className="secondary-button" type="button" onClick={() => void loadActivities(date)}>Refresh</button>
              </div>
              <div className="record-list">
                {activities.length === 0 ? (
                  <p className="muted">No records saved for this date.</p>
                ) : (
                  activities.map((activity) => (
                    <article className="record-card" key={activity.id}>
                      <h3>{activity.title}</h3>
                      <p>{activity.activityType} - {activity.actualMinutes} minutes</p>
                      <div className="chip-row">
                        <span>{activity.parentApproved ? "approved" : "needs review"}</span>
                        <span>{activity.recordStatus}</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

function Disclosure({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="disclosure-panel">
      <button className="disclosure-trigger" type="button" onClick={onToggle}>
        <span>{title}</span>
        <strong>{open ? "Hide" : "Show"}</strong>
      </button>
      {open ? <div className="disclosure-body">{children}</div> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="review-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
