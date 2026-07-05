# Project Brief

Build a homeschool progress tracking and legal record archive app for a project-based/unit-study homeschool.

## Primary Design Principle

The activity is the source of truth. Subjects, legal requirements, time, standards/skills, and evidence are metadata attached to each learning activity.

## Legal Context

The app should support a Texas homeschool context but be designed so other states can be added later.

For Texas, the required/core legal subjects to track are:

- Reading
- Spelling
- Grammar
- Mathematics
- Good citizenship

The app should also track broader subject areas:

- Writing
- Science
- History
- Geography
- Civics
- Art
- Music
- PE
- Health
- Engineering / making / building
- Practical life
- Logic / thinking skills

## Core Purpose

1. Track daily homeschool learning.
2. Track time spent per subject without double-counting overlapping subjects.
3. Map activities to required legal categories.
4. Map activities to skills/standards.
5. Archive proof-of-learning evidence.
6. Generate weekly, quarter, and annual reports.
7. Generate a legal/compliance archive PDF.

## Important Tracking Rule

One activity can touch multiple subjects, but the actual clock time should only be counted once. Use a separate subject time allocation model.

Example: a 60-minute Silk Road map project may have:

- Actual minutes: 60
- Reading: 20
- History: 20
- Geography: 10
- Good Citizenship / Economics: 5
- Art / Construction: 5

The allocated subject minutes should add up to the actual minutes. Do not count the same 60-minute activity as 60 minutes in every subject.

## Pre-Launch Trial Mode

The official homeschool record system should not go live until approximately May 2027. Records entered before the official homeschool start date are extras, enrichment, practice logs, or system testing. They should not automatically be treated as the official homeschool legal archive.

School year status options:

- planned
- trial
- active
- closed
- archived

Each activity, daily record, weekly review, quarter review, annual review, and artifact should have `record_status`:

- trial
- enrichment
- official
- excluded

Default behavior:

- If date is before `official_homeschool_start_date`, default `record_status = trial`.
- If date is on or after `official_homeschool_start_date` and the school year status is active, default `record_status = official`.
- Parent can manually change `record_status`.

Legal reports should include official records by default. Portfolio reports may optionally include trial/enrichment records. Subject time reports should support Official only, Trial/enrichment only, and All records filters.

## Recommended Data Model

### students

- id
- name
- date_of_birth
- grade_level
- notes

### school_years

- id
- student_id
- year_label
- grade_level
- start_date
- end_date
- official_homeschool_start_date
- state
- status: planned, trial, active, closed, archived
- include_trial_records_in_reports
- annual_goals
- annual_summary
- archive_status

### legal_requirement_profiles

- id
- state
- description
- required_subjects
- notes

### units

- id
- school_year_id
- title
- subject_focus
- start_date
- end_date
- description
- primary_resources
- essential_questions
- final_project

### activities

- id
- student_id
- school_year_id
- unit_id
- date
- title
- description
- activity_type
- actual_minutes
- record_status: trial, enrichment, official, excluded
- parent_notes
- student_response
- completed

Activity types:

- Reading
- Read-aloud
- Narration
- Copywork
- Dictation
- Math lesson
- Experiment
- Nature study
- Map work
- Build/project
- Art
- Field trip
- Discussion
- Presentation
- Assessment
- Practical life

### subjects

- id
- name
- category

### activity_subject_allocations

- id
- activity_id
- subject_id
- minutes
- allocation_percent

Validation rule: sum(activity_subject_allocations.minutes) should equal activities.actual_minutes. If not, show a warning.

### legal_tags

- id
- name
- state
- description

Texas legal tags:

- Reading
- Spelling
- Grammar
- Mathematics
- Good Citizenship
- Visual Curriculum
- Bona Fide Instruction

### activity_legal_tags

- id
- activity_id
- legal_tag_id

### standards_or_skills

- id
- source
- grade_level
- subject
- code
- description
- parent_friendly_description
- required_for_legal_compliance

Skill status options:

- Introduced
- Practiced
- Proficient
- Mastered
- Needs Review

### activity_standards

- id
- activity_id
- standard_id
- status
- evidence_id
- notes

### evidence_artifacts

- id
- student_id
- school_year_id
- activity_id
- date
- title
- artifact_type
- file_url
- thumbnail_url
- description
- parent_note
- student_note
- subject_tags
- legal_tags
- standards_linked

Artifact types:

- Photo
- Video
- Audio narration
- Scanned worksheet
- Writing sample
- Drawing
- Project photo
- Assessment
- Reading list
- Book narration
- Field trip record
- Presentation
- Parent observation

### curriculum_resources

- id
- title
- publisher_or_source
- resource_type
- visual_format
- subject_tags
- legal_tags
- grade_range
- url_or_file
- notes

Resource types:

- Book
- Workbook
- PDF
- Printable
- Video
- Online lesson
- Coursebook
- Manipulative with written guide
- Parent-created lesson plan
- Field trip guide

### activity_resources

- id
- activity_id
- resource_id

### reading_logs

- id
- student_id
- activity_id
- date
- book_title
- author
- reading_type
- minutes
- pages_or_chapters
- level
- narration_given
- comprehension_notes

Reading types:

- Independent reading
- Read-aloud
- Shared reading
- Audiobook with visual text
- Poetry
- Reference reading

### writing_samples

- id
- student_id
- activity_id
- date
- title
- type
- prompt
- draft_file
- final_file
- transcription
- rubric_scores

Writing types:

- Copywork
- Dictation
- Narration
- Sentence writing
- Paragraph
- Journal
- Report
- Creative writing
- Project explanation
- Presentation script

### progress_checks

- id
- student_id
- school_year_id
- unit_id
- date
- period_type
- summary
- strengths
- needs_review
- next_steps
- parent_rating

Period types:

- Weekly
- Unit-end
- Quarter
- Summer Extension
- Semester
- Annual

School years should support both traditional and year-round homeschool models:

- Model A: Quarter 1, Quarter 2, Quarter 3, Quarter 4, Annual closeout.
- Model B: Quarter 1, Quarter 2, Quarter 3, Quarter 4, optional Summer Extension / Summer Term, Annual closeout.

The app should not assume education stops during summer. Summer Extension may belong to the ending school year or the next school year, based on parent preference.

Annual closeout finalizes the school year. After closeout, the next school year begins with a fresh quarter cycle.

### instructional_periods

- id
- school_year_id
- label
- period_type: quarter, summer_extension, annual
- sequence_number
- start_date
- end_date
- review_due_date
- review_status: not_started, draft, finalized, amended
- alert_status: none, upcoming, due_soon, urgent, due_today, overdue, complete
- status: planned, active, completed, finalized, amended
- notes

Default `review_due_date` should be the instructional period `end_date`, but the parent can edit it.

Quarter Review alert rules:

- If review_status = finalized, alert_status = complete
- If today is more than 14 days before review_due_date, alert_status = none
- If today is 14 to 8 days before review_due_date, alert_status = upcoming
- If today is 7 to 4 days before review_due_date, alert_status = due_soon
- If today is 3 to 1 days before review_due_date, alert_status = urgent
- If today equals review_due_date, alert_status = due_today
- If today is after review_due_date and review_status is not finalized, alert_status = overdue

Alerts should not delete or change saved records. They only flag the review until the parent finalizes or amends it.

### record status fields

The following records should include `record_status: trial, enrichment, official, excluded`:

- activities
- daily_records
- weekly_reviews
- quarter_reviews
- annual_reviews
- evidence_artifacts

### weekly_reviews

- id
- student_id
- school_year_id
- week_start_date
- week_end_date
- primary_unit_id
- status
- total_approved_minutes
- activities_logged_count
- days_logged_count
- artifacts_saved_count
- activities_needing_review_count
- subject_time_summary
- texas_legal_coverage_summary
- parent_weekly_summary
- overall_weekly_rating
- student_favorite_activity
- student_hardest_activity
- student_proudest_work
- student_question_or_curiosity
- student_self_rating
- student_dictated_reflection
- next_week_focus
- finalized_at
- amended_at

Weekly review status options:

- draft
- finalized
- amended

Weekly review rating scale:

- Not Observed
- Introduced
- Developing
- Practicing
- Proficient
- Mastery

### weekly_review_skill_ratings

- id
- weekly_review_id
- standard_or_skill_id
- subject
- skill_name
- evidence_summary
- ai_suggested_rating
- parent_rating
- parent_note

### weekly_review_portfolio_selections

- id
- weekly_review_id
- activity_id
- evidence_artifact_id
- selection_note

### quarter_reviews

- id
- student_id
- school_year_id
- instructional_period_id
- quarter_label
- start_date
- end_date
- status
- total_minutes
- days_logged_count
- activities_count
- weekly_reviews_count
- artifacts_count
- portfolio_items_count
- activities_needing_review_count
- overall_rating
- overall_summary
- what_improved
- needs_review
- what_surprised_me
- what_was_difficult
- what_should_continue
- what_should_change
- next_period_priorities
- parent_reflection
- student_favorite_activity
- student_proudest_work
- student_hardest_activity
- student_question_or_curiosity
- student_wants_to_learn_next
- student_self_rating
- student_dictated_reflection
- created_at
- updated_at
- finalized_at

Quarter review status options:

- draft
- finalized
- amended

Parent skill rating scale:

- Not Observed
- Introduced
- Developing
- Practicing
- Proficient
- Mastery

Student self-rating scale:

- I am just starting
- I am getting better
- I can do this with help
- I can do this by myself
- I can teach or explain this

Legal/subject coverage scale:

- Not Covered
- Light
- Adequate
- Strong

### quarter_review_skill_ratings

- id
- quarter_review_id
- standard_or_skill_id
- subject
- skill_name
- evidence_summary
- weekly_rating_trend
- ai_suggested_rating
- parent_final_rating
- parent_note

### quarter_review_portfolio_selections

- id
- quarter_review_id
- activity_id
- evidence_artifact_id
- source_weekly_review_id
- selection_note

### quarter_review_unit_summaries

- id
- quarter_review_id
- unit_id
- status
- activities_count
- artifacts_count
- skills_supported
- parent_summary
- student_comment
- next_action

### annual_reviews

- id
- student_id
- school_year_id
- status: draft, finalized, amended
- total_minutes
- days_logged_count
- activities_count
- weekly_reviews_count
- quarter_reviews_count
- units_completed_count
- artifacts_count
- portfolio_items_count
- legal_coverage_summary
- subject_time_summary
- skill_progress_summary
- parent_annual_reflection
- student_annual_reflection
- student_selected_best_work
- next_school_year_recommendations
- finalized_at
- archived_at

### annual_plans

- id
- student_id
- school_year_id
- grade_level
- status: draft, active, finalized, archived
- primary_theme
- central_question
- thinking_progression
- writing_progression
- presentation_progression
- annual_project_cycle
- journal_plan
- spiral_curriculum_summary
- literacy_spine_summary
- math_spine_summary
- finance_spine_summary
- science_journal_summary
- weekly_writing_prompt_summary
- weekly_project_cycle_summary
- weekly_presentation_cycle_summary
- final_friday_summary
- unit_study_framework_summary
- annual_capstone_summary
- created_at
- updated_at
- finalized_at

### annual_plan_spines

- id
- annual_plan_id
- spine_title
- frequency
- resources
- skills_covered
- summary
- notes

Default spine records should include:

- Literacy Spine
- Math Spine
- Finance Spine
- Daily Science Journal / Nature Observation
- Daily Independent Reading
- Daily Physical Activity / Education

### annual_plan_weekly_rhythm

- id
- annual_plan_id
- day_label
- sequence_number
- purpose
- typical_activities
- related_activity_types
- evidence_suggestions
- notes

Default rhythm days:

- Question Monday
- Exploration Tuesday
- Context Wednesday
- Meaning Thursday
- Creating Friday

### annual_plan_unit_formats

- id
- name
- description
- default_weekly_pattern
- notes

Default unit format types:

- harbor_sprout_template
- open_and_go_published_unit
- minimal_structure_parent_designed

### annual_plan_units

- id
- annual_plan_id
- sequence_number
- semester_or_term
- unit_title
- expected_duration_weeks
- guiding_question
- primary_competency
- resources
- field_trip
- final_friday_capstone
- status
- unit_format_type
- weekly_rhythm_override
- published_sequence_followed
- parent_designed
- format_notes
- notes

### annual_plan_journals

- id
- annual_plan_id
- journal_title
- frequency
- purpose
- artifact_expectation
- notes

### annual_plan_records

- id
- annual_plan_id
- record_title
- record_type
- file_url
- notes
- created_at

### legal_records

- id
- student_id
- school_year_id
- record_type
- date
- file_url
- notes

Legal record types:

- Withdrawal letter
- Letter of assurance
- Curriculum overview
- Annual summary
- Attendance/time log
- Portfolio export
- Assessment summary
- State requirement snapshot

### exports

- id
- student_id
- school_year_id
- export_type
- date_generated
- file_url
- notes

## Required App Features

### 0. Annual Plan

The Annual Plan tab should function as the big-picture school-year planning and archive page. It should not be a daily logging page.

The Annual Plan should define:

- School year's theme
- Central question
- Thinking, writing, and presentation progressions
- Annual project cycle
- Year-long journals
- Spiral curriculum summary
- Daily recurring expectations
- Curriculum spines
- Weekly rhythm
- Unit-study format options
- Thematic unit-study sequence
- Year-end capstone
- Journals and portfolios
- Annual records

The Annual Plan is a planning framework, not a compliance checklist. Daily logs document reality; the Annual Plan documents intent.

The 2027-2028 Annual Plan may be created before the homeschool goes live. School year status should remain planned or trial until the parent marks the school year active.

Annual Plan exports:

- `records/{schoolYear}/annual-plan.md`
- Annual Plan PDF

Annual Plan Markdown and PDF should include daily recurring expectations, weekly rhythm, unit-study format options, unit sequence with selected format type, and a note that daily logs remain the record of what actually happened.

### 1. Activity-First Daily Log

The parent should enter:

- What did we do?
- How long did it take?
- What unit/theme was it part of?
- What subjects did it touch?
- What legal categories did it satisfy?
- What evidence was created?
- What skills/standards were introduced, practiced, or mastered?
- Record status: trial, enrichment, official, or excluded

If today is before `official_homeschool_start_date`, show:

```text
Trial Mode: Records entered before the official homeschool start date are saved as practice/enrichment records and are not included in official legal reports unless you choose to include them.
```

If the school year is active, show:

```text
Active Homeschool Year: Approved records are included in official reports and archives.
```

Add a `Promote trial record to official` button with confirmation:

```text
This record was created before the official homeschool start date. Promote it to official record?
```

### 2. Subject Time Allocation

Each activity has actual_minutes. Then allocated subject minutes are assigned across subjects. The app should prevent or warn against inflated double-counting.

### 3. Legal Compliance Dashboard

For Texas, show monthly/term coverage for:

- Reading
- Spelling
- Grammar
- Mathematics
- Good Citizenship

Also show whether visual curriculum resources are being used.

Example dashboard:

- Reading: covered
- Spelling: light
- Grammar: light
- Math: covered
- Good Citizenship: covered

### 4. Evidence / Portfolio Capture

The app should make it easy to upload or capture:

- Photos
- Videos
- Audio narrations
- Scans
- Writing samples
- Project photos
- Parent notes

Each evidence item should link to:

- Activity
- Subject tags
- Legal tags
- Standards/skills
- School year
- Unit

### 5. Weekly Review

Each school year should include a Weekly Reviews tab. Weekly Reviews are generated from approved daily activity logs for a selected Monday-Sunday week, then edited and finalized by the parent.

Weekly Review workflow:

1. Parent opens Weekly Reviews.
2. App defaults to the current week, Monday-Sunday.
3. Parent can select a previous week.
4. Parent clicks Generate from Logs.
5. App pulls approved activities, subject allocations, legal tags, skills, artifacts, and daily records from that week.
6. App creates a draft weekly review.
7. Parent edits the draft, rates skills, selects portfolio items, adds notes, and saves.
8. Parent may finalize the weekly review.
9. Finalized review remains retrievable by school year and week.
10. App generates a Markdown file for the week.

Weekly Review should include:

- Student
- School year
- Week start date
- Week end date
- Primary unit study
- Status: draft, finalized, amended
- Total approved learning time
- Number of activities logged
- Number of days logged
- Number of artifacts saved
- Activities needing review
- Subject time summary
- Texas legal coverage summary
- Parent weekly summary
- Overall weekly rating
- Skill ratings
- Portfolio selections
- Next week focus
- Student favorite activity this week
- Student hardest activity this week
- Student proudest work this week
- Student question or curiosity
- Student self-rating, optional
- Student dictated reflection

Prompt the parent to choose 2-5 artifacts or activities as portfolio highlights for the week.

Weekly Review should not grade every individual activity. It should rate skill progress for the week based on the pattern of activities and evidence.

### 6. Quarter Review

Each school year should include a Quarter Reviews tab. Quarter Reviews are approximately 9-week checkpoints. For year-round homeschooling, customize the dates or add a Summer Extension before closing the school year.

The parent should be able to edit the quarter start/end date range.

Quarter Review workflow:

1. Parent opens Quarter Reviews.
2. App defaults to the current instructional quarter based on date.
3. Parent can select a previous quarter.
4. Parent can edit quarter start/end dates.
5. Parent clicks Generate Quarter Review.
6. App pulls daily activity records, daily learning records, weekly reviews, weekly skill ratings, subject allocations, legal tags, unit studies, artifacts, and portfolio selections.
7. App creates a draft quarter review.
8. Parent edits ratings, summaries, portfolio selections, student reflection, parent reflection, and next-step plans.
9. Parent saves draft or finalizes.
10. Finalized quarter review remains retrievable by school year and quarter.
11. App generates Markdown and PDF exports.

Quarter Review alerts should be visible in:

- Main dashboard
- Left sidebar beside Quarter Reviews
- Quarter Reviews tab
- Weekly Review page
- Daily Log page as a small banner

Dashboard alert should include:

- Quarter label
- Days until due or days overdue
- Weekly reviews completed / expected
- Activities needing review
- Activities missing time
- Artifacts needing classification
- Portfolio candidates
- Legal coverage gaps
- Button: Open Quarter Review

Optional notification settings:

- 14-day reminder
- 7-day reminder
- 3-day reminder
- Due-day reminder
- Overdue reminder

If browser notifications or email notifications are not implemented in MVP, show in-app alerts only.

Quarter Review should include:

- Student
- School year
- Quarter label
- Start date
- End date
- Status: draft, finalized, amended
- Total approved learning time
- Days with records
- Activities logged
- Weekly reviews completed
- Artifacts saved
- Portfolio items selected
- Activities needing review
- Subject time summary
- Texas legal coverage summary
- Skill progression summary
- Unit study progress summary
- Portfolio highlights
- Student reflection
- Parent reflection
- Next quarter priorities

The quarter review should show trends across Weekly Reviews, such as Reading: Developing -> Practicing -> Practicing.

For each skill row, show:

- Skill name
- Evidence from activities/artifacts
- Weekly rating trend
- AI suggested quarter rating
- Parent final rating
- Parent note field

Parent final rating overrides the AI suggestion.

Legal coverage should track Texas categories:

- Reading
- Spelling
- Grammar
- Mathematics
- Good Citizenship
- Visual Curriculum
- Bona Fide Instruction

Prompt the parent to select 8-15 highlights for the quarter. Pull suggestions from weekly portfolio selections and artifacts.

Student should also be able to select one student favorite portfolio item for the quarter.

Show each unit active during the period with:

- Status: not started, active, completed, paused
- Activities count
- Artifacts count
- Skills supported
- Parent summary
- Student comment, optional
- Continue, close, or review later

Parent reflection should include:

- Overall quarter rating
- What improved most
- What needs review
- What surprised me
- What was difficult
- What should continue
- What should change next quarter
- Next quarter priorities

When finalized, create or update:

```text
records/{schoolYear}/quarter-reviews/{quarterLabel}.md
```

When a Summer Extension is finalized, create or update:

```text
records/{schoolYear}/quarter-reviews/summer-extension.md
```

Also allow PDF export. The database remains the source of truth; Markdown and PDF are generated exports.

### 7. Annual Review / School-Year Closeout

Each school year should include an Annual Review tab.

Annual Review workflow:

1. Parent opens Annual Review.
2. App pulls all quarter reviews, weekly reviews, daily records, activities, artifacts, legal tags, skills, and subject time summaries from the school year.
3. App generates a draft annual review.
4. Parent edits and adds final parent reflection.
5. Student adds or dictates annual reflection.
6. Parent selects final annual portfolio highlights.
7. Parent generates legal archive PDF and annual portfolio PDF.
8. Parent closes/archives the school year.
9. App starts the next school year cycle when the parent creates the next school year.

Annual Review should include:

- Student
- School year
- Date range
- Total learning time
- Days with records
- Activities logged
- Weekly reviews completed
- Quarter reviews completed
- Units completed
- Artifacts saved
- Annual portfolio highlights
- Texas legal coverage
- Subject time summary
- Skill progression summary
- Parent annual reflection
- Student annual reflection
- Next school year recommendations
- Close/archive school year action

Annual Review student reflection fields:

- What did I learn this year?
- What am I most proud of this year?
- What was hard this year?
- What do I want to learn next year?
- Favorite book / unit / project
- Student-selected best work
- Student dictated reflection

School year closeout should support:

- Final annual review
- Annual portfolio selection
- Legal compliance summary
- Annual subject time summary
- Annual skills progress summary
- Annual unit study summary
- Annual student reflection
- Annual parent reflection
- PDF export
- Markdown export
- Archive/lock school year

After closeout:

- Previous school year remains retrievable
- New school year starts fresh
- Activity type daily completion buttons reset because the date/school year changes
- Weekly tallies continue by date but are grouped under the new school year
- Quarter cycle restarts at Quarter 1

## Reports

### Legal Compliance Report

- Student
- School year
- State
- Required subjects
- Evidence of bona fide instruction
- Visual curriculum resources used
- Coverage by required subject
- Portfolio samples
- Parent certification/summary statement

### Subject Time Report

- Total actual school time
- Allocated subject time by subject
- Weekly/monthly/term totals
- Warning if subject balance is weak

### Standards/Skills Progress Report

- Skill
- Subject
- Introduced date
- Last practiced date
- Current status
- Evidence
- Notes

### Portfolio Export

- Cover page
- Table of contents
- Reading samples
- Writing samples
- Math samples
- Project photos
- Science observations
- Good citizenship examples
- Parent summary

### Quarter Review Report

- Unit summaries
- Time by subject
- Legal subject coverage
- Skills mastered
- Skills needing review
- Portfolio highlights
- Next steps

## UX Requirements

The app should be fast to use. Daily logging should take 3-5 minutes.

Recommended workflow:

1. Select student.
2. Select school year.
3. Select unit/theme.
4. Add activity.
5. Enter actual minutes.
6. Select activity type.
7. Add subject allocations.
8. Add legal tags.
9. Add standards/skills if relevant.
10. Upload evidence.
11. Save.

Use smart presets for subject allocation.

Examples:

Hands-on science project, 60 minutes:

- Science: 40
- Math: 10
- Writing/Narration: 10

History read-aloud + project, 75 minutes:

- History: 30
- Reading: 20
- Writing/Narration: 10
- Art/Project: 15

Unit-study discussion, 45 minutes:

- Reading: 15
- History/Science: 20
- Good Citizenship: 10

The parent should be able to adjust all allocations manually.

## Conceptual Distinctions

- Subject tags are broad academic tags.
- Legal tags are compliance tags.
- Standards/skills are mastery/progress tags.
- Evidence artifacts are proof-of-learning.
- Time allocation is for balance and reporting.

## MVP Feature List

1. Student profile
2. School year setup
3. Texas legal requirement profile
4. Unit studies
5. Daily activity logging
6. Subject time allocation
7. Legal tags
8. Evidence/photo upload
9. Reading log
10. Writing samples
11. Weekly summary
12. Quarter review
13. Annual PDF export
14. Portfolio export
15. Legal compliance report

## Preferred Stack

- Next.js / React frontend
- TypeScript
- SQLite or Postgres database
- Prisma ORM
- Local file storage for MVP, with optional S3-compatible storage later
- PDF generation for exports
- Mobile-friendly responsive design

## Core Design Statement

Build a homeschool record system where the daily learning activity is the center of the data model. The app should make it easy to prove legal compliance, show learning progress, archive portfolio evidence, and track subject balance without forcing a public-school-style schedule or double-counting overlapping unit-study time.
