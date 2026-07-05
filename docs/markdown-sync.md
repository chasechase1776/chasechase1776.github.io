# Markdown Export and Sync Plan

## Source of Truth

The database remains the source of truth for all homeschool records.

Markdown files are generated snapshots for readability, backup, long-term records, and Obsidian-style browsing. They should not be treated as the primary data store.

Manual edits to generated Markdown files should not update the database unless a future import/sync feature is intentionally designed and implemented.

## Generation Trigger

When a parent saves or updates an approved activity, regenerate Markdown from current database records.

The save/update path should:

1. Save the approved activity and related metadata in the database.
2. Commit related database changes in the same app transaction where possible.
3. Re-query the affected records from the database.
4. Render the affected Markdown files from templates.
5. Write generated Markdown snapshots to local runtime storage.

Drafts and AI-parsed activities that have not been parent-approved should not update permanent Markdown record files. They may be shown in the app review UI or stored as draft database records.

When a parent finalizes or amends a Weekly Review, generate or update the Markdown file for that week from current database records and the saved weekly review.

When a parent finalizes or amends a Quarter Review, generate or update the Markdown file and PDF export for that instructional period from current database records and the saved quarter review.

When a parent finalizes the Annual Review, generate or update the annual review Markdown file, legal summary, portfolio index, annual plan when annual plan fields change, and PDF exports.

## Affected Files

After an approved activity save/update, regenerate:

- Daily learning record for the activity date.
- Weekly summary for the week containing the activity date.
- Unit study activity file for the activity unit.
- Unit skills-covered file for the activity unit.
- Legal summary for the school year.
- Portfolio index when artifacts are attached.

If an edit changes date, school year, unit study, legal tags, skills, or artifacts, regenerate both the old affected files and the new affected files so stale references are removed.

## Suggested Runtime Folder Structure

Generated Markdown should live outside source-controlled app code, for example under ignored local runtime storage:

```text
records/
  2026-2027/
    annual-plan.md
    legal-summary.md
    portfolio-index.md
    days/
      2026-09-08.md
      2026-09-09.md
    weeks/
      2026-W37.md
      2026-W38.md
    annual-review.md
    quarter-reviews/
      quarter-1.md
      quarter-2.md
      summer-extension.md
    units/
      construction/
        unit-summary.md
        activities.md
        artifacts.md
        skills-covered.md
      off-the-land/
        unit-summary.md
        activities.md
        artifacts.md
        skills-covered.md
```

The repository should not commit real generated record files.

## File Responsibilities

### Daily Learning Record

Path pattern:

```text
records/{school_year}/days/{date}.md
```

Include all approved activities for the date, grouped by student and unit where useful:

- Activity title.
- Activity type.
- Actual minutes.
- Subject time allocation.
- Narration or parent description.
- Texas legal tags.
- Skills practiced and status.
- Evidence/artifact links or titles.
- Parent notes.

### Weekly Summary

Path pattern:

```text
records/{school_year}/weeks/{iso_week}.md
```

Include records derived from approved activities in that week:

- Total actual learning time.
- Subject allocation totals.
- Texas legal coverage.
- Activities missing evidence.
- Portfolio-worthy artifacts.
- Skills introduced, practiced, mastered, or needing review.
- Saved Weekly Review status, parent summary, rating, skill ratings, portfolio selections, and next week focus when a weekly review exists.

When a Weekly Review is finalized or amended, regenerate this weekly Markdown file from current database records and the saved weekly review fields.

The visible weekly dashboard may reset automatically as the current date changes, but historical weekly Markdown files remain retrievable.

### Quarter Review

Path pattern:

```text
records/{school_year}/quarter-reviews/{quarter_label}.md
```

Include records derived from daily logs and Weekly Reviews in the period:

- Total approved learning time.
- Days with records.
- Activities logged.
- Weekly reviews completed.
- Subject time summary.
- Texas legal coverage summary using Not Covered, Light, Adequate, or Strong.
- Skill progression trends across weekly ratings.
- Unit study progress summary.
- Portfolio highlights.
- Student reflection.
- Parent reflection.
- Next quarter priorities.

When a Quarter Review is finalized or amended, regenerate this Markdown file and offer PDF export from current database records and the saved quarter review fields.

For Summer Extension, use:

```text
records/{school_year}/quarter-reviews/summer-extension.md
```

### Annual Review

Path pattern:

```text
records/{school_year}/annual-review.md
```

Include records derived from the entire school year:

- Total learning time.
- Days with records.
- Activities logged.
- Weekly reviews completed.
- Quarter reviews completed.
- Units completed.
- Artifacts saved.
- Annual portfolio highlights.
- Texas legal coverage.
- Subject time summary.
- Skill progression summary.
- Parent annual reflection.
- Student annual reflection.
- Next school year recommendations.
- Close/archive status.

When an Annual Review is finalized, regenerate annual review Markdown, legal summary, portfolio index, and PDF exports. The archived school year remains retrievable while the next school year starts a fresh quarter cycle.

### Unit Activities

Path pattern:

```text
records/{school_year}/units/{unit_slug}/activities.md
```

Include approved activities attached to the unit:

- Date.
- Activity type.
- Title and description.
- Time.
- Subject allocations.
- Legal tags.
- Evidence.

### Unit Skills Covered

Path pattern:

```text
records/{school_year}/units/{unit_slug}/skills-covered.md
```

Include skills derived from approved activities in the unit:

- Subject.
- Skill category.
- Skill description.
- Status.
- First introduced date.
- Last practiced date.
- Linked evidence or activity titles.

### Legal Summary

Path pattern:

```text
records/{school_year}/legal-summary.md
```

Include Texas legal coverage derived from approved activities:

- Reading.
- Spelling.
- Grammar.
- Mathematics.
- Good Citizenship.
- Visual Curriculum.
- Bona Fide Instruction.

Legal tags remain separate from academic subjects and skills.

### Portfolio Index

Path pattern:

```text
records/{school_year}/portfolio-index.md
```

Regenerate when an approved activity has attached artifacts or when artifact metadata changes.

Include:

- Artifact title.
- Artifact type.
- Date.
- Linked activity.
- Unit study.
- Subject tags.
- Legal tags.
- Skills linked.
- File path or app link.

## Implementation Notes for Later App Build

Markdown generation should be a rendering layer over database queries:

- Query database records.
- Convert records into a stable view model.
- Render Markdown from templates.
- Write files atomically where possible.

Recommended service boundary:

```text
saveApprovedActivity()
  -> write database changes
  -> identify affected markdown targets
  -> regenerateMarkdownSnapshots(targets)
```

Recommended target identifiers:

- `day:{schoolYearId}:{date}`
- `week:{schoolYearId}:{isoWeek}`
- `unitActivities:{schoolYearId}:{unitId}`
- `unitSkills:{schoolYearId}:{unitId}`
- `legalSummary:{schoolYearId}`
- `portfolioIndex:{schoolYearId}`

This keeps Markdown regeneration deterministic and testable.

## Non-Goals

- Do not parse Markdown files to update the database in the MVP.
- Do not store real generated records in Git.
- Do not let manual Markdown edits silently override database records.
- Do not regenerate from draft or unapproved AI-parsed records as if they were approved learning records.
