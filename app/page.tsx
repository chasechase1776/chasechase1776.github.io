"use client";

import { useEffect, useMemo, useState } from "react";
import { skillTaxonomy } from "@/lib/domain";

type ActivityButtonState = "neutral" | "completed" | "needs-review" | "selected";

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

type DraftCard = {
  title: string;
  minutes: number;
  subjects: string[];
  legalTags: string[];
  skills: string[];
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

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
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
  const [savedActivities, setSavedActivities] = useState<SavedActivity[]>([]);
  const [draftCards, setDraftCards] = useState<DraftCard[]>([]);
  const [status, setStatus] = useState("Ready to parse the current entry.");
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  async function loadSavedActivities(date = selectedDate) {
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
  }

  useEffect(() => {
    void loadSavedActivities(selectedDate);
  }, [selectedDate]);

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
      skills: []
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
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Activity save failed.");
      await loadSavedActivities(selectedDate);
      setStatus(
        parentApproved
          ? `Approved activity saved. ${selectedType} will show green for ${selectedDate}.`
          : `Draft saved. ${selectedType} will show yellow for ${selectedDate} unless an approved record also exists.`
      );
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
    setDraftCards([]);
    setStatus("Narration and proof selection cleared. Student, school year, unit, date, and activity type were preserved.");
  }

  function parseWithAi() {
    const drafts = mockDrafts(selectedType);
    setDraftCards(drafts);
    setStatus("Mock AI parse complete. Review the editable-looking cards below before saving in a later backend step.");
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
              <a className="is-active" href="#daily-log">
                2026-2027 <span>Trial / Active</span>
              </a>
              <ul>
                <li><a href="#daily-log">Daily Records</a></li>
                <li><a href="#weekly-tally">Weekly Reviews</a></li>
                <li><a href="#quarter-alert">Quarter Reviews <span className="alert-sidebar-badge">Urgent</span></a></li>
                <li><a href="#proof">Portfolio</a></li>
                <li><a href="#legal-panel">Legal Archive</a></li>
                <li><a href="#skills-panel">Reports</a></li>
              </ul>
            </li>
            <li>
              <a href="#daily-log">
                2027-2028 <span>Planned</span>
              </a>
            </li>
          </ul>

          <p className="tree-title">Unit Studies</p>
          <ul className="tree">
            <li><a className="is-active" href="#daily-log">Construction <span>Active</span></a></li>
            <li><a href="#daily-log">Off the Land <span>Planned</span></a></li>
            <li><a href="#daily-log">Community Helpers <span>Planned</span></a></li>
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
            <p className="eyebrow">Narration-first daily logging</p>
            <h1>Log learning from narration</h1>
            <p>Quick log first: pick an activity, add minutes, narrate what happened, then save. Details stay available without crowding the daily workflow.</p>
          </div>
          <div className="mode-switch" aria-label="Mockup sections">
            <a href="#daily-log">Daily log</a>
            <a href="#saved-records">Saved</a>
            <a href="#weekly-tally">Coverage</a>
          </div>
        </header>

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

        <div className="main-grid" id="daily-log">
          <section className="primary-column">
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
                    {["Upload photo", "Upload file", "Select existing artifact", "Record audio", "Skip proof for now"].map((label) => (
                      <button className={selectedProof.includes(label) ? "artifact-option is-selected" : "artifact-option"} type="button" key={label} onClick={() => toggleProof(label)}>
                        {label}
                      </button>
                    ))}
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
          </section>

          <aside className="side-column">
            <section className="panel" id="weekly-tally">
              <p className="eyebrow">This week</p>
              <h2>Weekly subject time tally</h2>
              <div className="coverage-list">
                {subjectTallies.map(([subject, time]) => (
                  <div key={subject}><span>{subject}</span><strong>{time}</strong></div>
                ))}
              </div>
            </section>

            <section className="panel" id="legal-panel">
              <p className="eyebrow">Texas legal coverage</p>
              <h2>Legal coverage panel</h2>
              <div className="coverage-list">
                {legalCoverage.map(([category, level]) => (
                  <div key={category}><span>{category}</span><strong>{level}</strong></div>
                ))}
              </div>
            </section>

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
          </aside>
        </div>
      </section>
    </main>
  );
}
