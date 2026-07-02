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
6. Generate weekly, 9-week, and annual reports.
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
- state
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
- 9-week
- Semester
- Annual

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

### 1. Activity-First Daily Log

The parent should enter:

- What did we do?
- How long did it take?
- What unit/theme was it part of?
- What subjects did it touch?
- What legal categories did it satisfy?
- What evidence was created?
- What skills/standards were introduced, practiced, or mastered?

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

At the end of each week, prompt the parent to select 2-5 portfolio items:

- Best writing sample
- Best project photo
- Best math evidence
- Best reading/narration evidence
- Best good citizenship/civics evidence

### 6. 9-Week Review

Generate a 9-week summary showing:

- What was covered
- What the child read
- What the child wrote
- What the child built or presented
- Subject time balance
- Skills introduced/practiced/mastered
- Skills needing review
- Portfolio highlights
- Next 9-week goals

### 7. Annual Archive

At the end of the school year:

- Generate an annual PDF
- Generate a legal compliance summary
- Generate a portfolio export
- Lock/archive the year from accidental editing
- Allow amended notes only

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

### 9-Week Review Report

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
12. 9-week review
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
