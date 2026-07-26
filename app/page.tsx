"use client";

import { useMemo, useState } from "react";

type ActivityButtonState = "neutral" | "completed" | "needs-review" | "selected";

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

const initialStates: Record<string, ActivityButtonState> = {
  "Language Arts": "completed",
  Math: "needs-review",
  Finance: "neutral",
  "Unit Study": "completed",
  "Science Journal": "neutral",
  "Writing Project": "neutral",
  "Project Cycle": "neutral",
  "Presentation Cycle": "neutral",
  "Hands-On Activity": "neutral",
  "Physical Activity": "neutral",
  "Field Trip": "neutral",
  "Group Event": "neutral"
};

const subjectTallies = [
  ["Language Arts", "1h 15m"],
  ["Math", "35m"],
  ["Finance", "0m"],
  ["Science", "40m"],
  ["Social Studies", "20m"],
  ["Unit Study", "1h 10m"]
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

const skillGroups: Array<[string, string[]]> = [
  ["Language Arts", ["Reading", "Grammar", "Spelling", "Writing", "Editing"]],
  ["Math", ["Measurement and Money", "Problem-Solving and Application"]],
  ["Finance", ["Saving and Goal Setting", "Spending and Decision-Making"]],
  ["Science", ["Asks Questions and Seeks Answers", "Uses Tools and Models"]],
  ["Social Studies", ["Citizenship", "Communication", "Life Skills"]]
];

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
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
  const [narration, setNarration] = useState(
    "Today we completed chapter 1 of Story Weaver Level 1 Book 1. He read aloud, practiced spelling words, edited capitalization, and helped measure boards for the Construction unit."
  );
  const [selectedProof, setSelectedProof] = useState<string[]>(["Upload photo"]);
  const [activityStates, setActivityStates] = useState(initialStates);
  const [draftCards, setDraftCards] = useState<DraftCard[]>([]);
  const [status, setStatus] = useState("Ready to parse the current entry.");

  const canParse = useMemo(
    () => Boolean(student && schoolYear && unitStudy && selectedDate && selectedType && narration.trim()),
    [narration, schoolYear, selectedDate, selectedType, student, unitStudy]
  );

  function selectActivityType(type: string) {
    setSelectedType(type);
  }

  function buttonState(type: string) {
    return type === selectedType ? "selected" : activityStates[type] ?? "neutral";
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

  function saveDraft() {
    setActivityStates((current) => ({ ...current, [selectedType]: current[selectedType] === "completed" ? "completed" : "needs-review" }));
    setStatus(`Draft saved locally for ${selectedType} on ${selectedDate}. It will stay yellow until approved in a later backend step.`);
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
            <p>The parent sets context, picks one primary activity type, narrates what happened, attaches proof if useful, then reviews AI-style draft records before saving.</p>
          </div>
          <div className="mode-switch" aria-label="Mockup sections">
            <a href="#review-summary">Review</a>
            <a href="#weekly-tally">Weekly</a>
            <a href="#legal-panel">Legal</a>
            <a href="#skills-panel">Skills</a>
          </div>
        </header>

        <section className="review-alert-card" id="quarter-alert" aria-label="Quarter review alert">
          <div className="alert-head">
            <div>
              <p className="eyebrow">Quarter review alert</p>
              <h2>Quarter 1 review due soon</h2>
              <p>Quarter 1 is due in 3 days. No records are changed when a review becomes overdue.</p>
            </div>
            <span className="alert-status">Urgent</span>
          </div>
          <div className="alert-grid">
            <span><strong>Weekly reviews</strong> 8 / 9 completed</span>
            <span><strong>Needs review</strong> 4 activities</span>
            <span><strong>Missing time</strong> 3 activities</span>
            <span><strong>Artifacts</strong> 5 need classification</span>
            <span><strong>Portfolio candidates</strong> 12 candidates</span>
            <span><strong>Legal gaps</strong> Good Citizenship, Finance</span>
          </div>
        </section>

        <div className="main-grid" id="daily-log">
          <section className="primary-column">
            <section className="review-alert-card trial-banner">
              <div className="alert-head">
                <div>
                  <p className="eyebrow">Pre-launch status</p>
                  <h2>Trial Mode</h2>
                  <p>Records before the official homeschool start date are saved as practice/enrichment records unless the parent includes them later.</p>
                </div>
                <span className="alert-status">Trial</span>
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Daily log</p>
                  <h2>Choose one activity type</h2>
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
              <p className="panel-note">Completion states are local mock states in this step. Later they will be calculated from saved activity records for the selected date.</p>
            </section>

            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Narration</p>
                  <h2>Tell me what happened.</h2>
                </div>
                <span className="tag good">{selectedType}</span>
              </div>
              <textarea value={narration} onChange={(event) => setNarration(event.target.value)} />
            </section>

            <section className="panel" id="proof">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Artifact / proof</p>
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

            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Parse or save</p>
                  <h2>Parse or save the current log</h2>
                  <p className="panel-note">Parse is available when student, school year, unit study, date, activity type, and narration are present. Artifacts are optional.</p>
                </div>
              </div>
              <div className="primary-action-row">
                <button className="secondary-button" type="button" onClick={saveDraft}>Save as Draft</button>
                <button className="secondary-button" type="button" onClick={clearEntry}>Clear</button>
                <button className="primary-button" type="button" disabled={!canParse} onClick={parseWithAi}>Parse with AI</button>
              </div>
              <p className="status-line" role="status">{status}</p>
            </section>

            <section className="panel" id="review-summary">
              <div className="section-head">
                <div>
                  <p className="eyebrow">AI Review Summary</p>
                  <h2>Parent approval before save</h2>
                </div>
                <button className="primary-button" type="button" onClick={() => setStatus("Approved activity save is intentionally mocked in this visual parity step.")}>Save Approved Activities</button>
              </div>
              <div className="records-grid">
                {(draftCards.length ? draftCards : mockDrafts(selectedType)).map((draft) => (
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
              <p className="eyebrow">Skills</p>
              <h2>Subject skills panel</h2>
              <div className="skills-matrix">
                {skillGroups.map(([subject, skills]) => (
                  <div className="skill-group" key={subject}>
                    <h3>{subject}</h3>
                    <div className="skill-list">
                      {skills.map((skill) => <span className="tag" key={skill}>{skill}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
