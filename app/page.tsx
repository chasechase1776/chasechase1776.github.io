"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Activity = {
  id: string;
  title: string;
  date: string;
  actualMinutes: number;
  activityType: string;
  narration: string;
  recordStatus: string;
  parentApproved: boolean;
  allocations: { subject: string; minutes: number }[];
  legalTags: { legalTag: { label: string } }[];
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

const subjects = ["Language Arts", "Math", "Finance", "Science", "Social Studies", "Unit Study"];

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export default function Home() {
  const [studentName, setStudentName] = useState("Bennett");
  const [schoolYearLabel, setSchoolYearLabel] = useState("2026-2027 Trial / Enrichment");
  const [schoolYearStatus, setSchoolYearStatus] = useState("trial");
  const [officialStart, setOfficialStart] = useState("2027-05-01");
  const [unitTitle, setUnitTitle] = useState("Construction");
  const [date, setDate] = useState(todayIso());
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState("Language Arts");
  const [actualMinutes, setActualMinutes] = useState(20);
  const [subject, setSubject] = useState("Language Arts");
  const [recordStatus, setRecordStatus] = useState("trial");
  const [narration, setNarration] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [status, setStatus] = useState("Ready.");
  const [isSaving, setIsSaving] = useState(false);

  const canParse = useMemo(
    () => Boolean(studentName && schoolYearLabel && unitTitle && date && activityType && narration.trim()),
    [activityType, date, narration, schoolYearLabel, studentName, unitTitle]
  );

  async function loadActivities() {
    const response = await fetch("/api/activities", { cache: "no-store" });
    const data = await response.json();
    setActivities(data.activities ?? []);
  }

  useEffect(() => {
    void loadActivities();
  }, []);

  async function uploadArtifact() {
    if (!file) return [];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("recordStatus", recordStatus);
    formData.append("tagsJson", JSON.stringify([activityType, recordStatus]));
    const response = await fetch("/api/uploads", { method: "POST", body: formData });
    if (!response.ok) throw new Error("Artifact upload failed.");
    const data = await response.json();
    return [data.artifact.id as string];
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("Saving activity...");
    try {
      const artifactIds = await uploadArtifact();
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date,
          actualMinutes,
          activityType,
          narration,
          studentName,
          schoolYearLabel,
          schoolYearStatus,
          officialHomeschoolStartDate: officialStart,
          unitTitle,
          recordStatus,
          parentApproved: true,
          subjectAllocations: [{ subject, minutes: actualMinutes }],
          artifactIds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Activity save failed.");
      setStatus(`Saved. Markdown snapshots regenerated: ${data.markdownFiles?.length ?? 0}.`);
      setTitle("");
      setNarration("");
      setFile(null);
      await loadActivities();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function parseWithAi() {
    setStatus("Parsing with server-side mock AI...");
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
        attachedArtifactIds: []
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus("AI parse failed.");
      return;
    }
    const draft = data.drafts?.[0];
    if (draft) {
      setTitle(draft.title);
      setActualMinutes(draft.actualMinutes);
      setSubject(draft.subjectAllocations?.[0]?.subject ?? subject);
      setStatus(`${data.note} Draft filled in for parent review; it is not saved yet.`);
    }
  }

  async function generateWeeklyReview() {
    setStatus("Generating weekly review draft...");
    const response = await fetch("/api/reviews/weekly/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolYearLabel, weekStartDate: date, recordStatus })
    });
    const data = await response.json();
    setStatus(response.ok ? `Weekly review draft generated from ${data.data.activitiesLogged} approved activities.` : data.error);
  }

  async function regenerateMarkdown() {
    setStatus("Regenerating Markdown snapshots...");
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

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Private MVP app</p>
          <h1>Bennett Homeschool Records</h1>
          <p>Manual logging works without AI. AI parsing stays behind a server route and falls back to a mock parser when no API key is configured.</p>
        </div>
        <div className="status-card">
          <span>Current mode</span>
          <strong>{schoolYearStatus === "active" ? "Active" : "Trial"}</strong>
        </div>
      </section>

      <section className="context-grid" aria-label="Current context">
        <label>
          Student
          <input value={studentName} onChange={(event) => setStudentName(event.target.value)} />
        </label>
        <label>
          School year
          <input value={schoolYearLabel} onChange={(event) => setSchoolYearLabel(event.target.value)} />
        </label>
        <label>
          Year status
          <select value={schoolYearStatus} onChange={(event) => setSchoolYearStatus(event.target.value)}>
            <option>planned</option>
            <option>trial</option>
            <option>active</option>
            <option>closed</option>
            <option>archived</option>
          </select>
        </label>
        <label>
          Official start
          <input type="date" value={officialStart} onChange={(event) => setOfficialStart(event.target.value)} />
        </label>
        <label>
          Unit study
          <input value={unitTitle} onChange={(event) => setUnitTitle(event.target.value)} />
        </label>
        <label>
          Record status
          <select value={recordStatus} onChange={(event) => setRecordStatus(event.target.value)}>
            <option>trial</option>
            <option>enrichment</option>
            <option>official</option>
            <option>excluded</option>
          </select>
        </label>
      </section>

      <form className="entry-panel" onSubmit={saveActivity}>
        <div className="section-head">
          <div>
            <p className="eyebrow">Daily log</p>
            <h2>Save a learning activity</h2>
          </div>
          <button type="submit" disabled={isSaving || !title || !narration || actualMinutes <= 0}>
            {isSaving ? "Saving..." : "Save Approved Activity"}
          </button>
        </div>

        <div className="form-grid">
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nature journal and reading" />
          </label>
          <label>
            Activity type
            <select value={activityType} onChange={(event) => setActivityType(event.target.value)}>
              {activityTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Actual minutes
            <input type="number" min="1" value={actualMinutes} onChange={(event) => setActualMinutes(Number(event.target.value))} />
          </label>
          <label>
            Subject allocation
            <select value={subject} onChange={(event) => setSubject(event.target.value)}>
              {subjects.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Artifact upload
            <input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
        </div>

        <label>
          Narration
          <textarea value={narration} onChange={(event) => setNarration(event.target.value)} placeholder="What happened? What did Bennett do, say, make, read, solve, or notice?" />
        </label>

        <div className="button-row">
          <button type="button" onClick={parseWithAi} disabled={!canParse}>
            Parse with AI
          </button>
          <button type="button" onClick={generateWeeklyReview}>
            Generate Weekly Review
          </button>
          <button type="button" onClick={regenerateMarkdown}>
            Regenerate Markdown
          </button>
          <button type="button" onClick={exportPdf}>
            Export PDF
          </button>
        </div>
        <p className="status-line" role="status">{status}</p>
      </form>

      <section className="records-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Saved records</p>
            <h2>Recent activities</h2>
          </div>
          <button type="button" onClick={loadActivities}>Refresh</button>
        </div>
        <div className="record-list">
          {activities.length === 0 ? (
            <p className="muted">No records saved yet.</p>
          ) : (
            activities.map((activity) => (
              <article className="record-card" key={activity.id}>
                <div>
                  <h3>{activity.title}</h3>
                  <p>{activity.date.slice(0, 10)} - {activity.activityType} - {activity.actualMinutes} minutes</p>
                </div>
                <div className="chip-row">
                  <span>{activity.recordStatus}</span>
                  {activity.legalTags.map((item) => (
                    <span key={item.legalTag.label}>{item.legalTag.label}</span>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
