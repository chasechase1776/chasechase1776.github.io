# Weekly Reviews Plan

## Purpose

Weekly Reviews are guided parent reviews generated from approved daily activity logs. They summarize a week of learning without grading every individual activity.

The database remains the source of truth. Weekly Review Markdown files are generated archive/export snapshots.

Weekly Review pages may show Quarter Review due alerts as in-app reminders, but those alerts belong to the instructional period and should not alter weekly review records.

## Navigation

Each school year should include a Weekly Reviews tab.

The tab should retrieve reviews by:

- Student.
- School year.
- Week start date.
- Week end date.
- Review status.

## Workflow

1. Parent opens Weekly Reviews.
2. App defaults to the current week, Monday through Sunday.
3. Parent can select a previous week.
4. Parent clicks `Generate from Logs`.
5. App pulls approved activities, subject allocations, Texas legal tags, skills, artifacts, and daily records for that week.
6. App creates a draft weekly review.
7. Parent edits the draft, rates skills, selects portfolio highlights, adds notes, and saves.
8. Parent may finalize the weekly review.
9. Finalized review remains retrievable by school year and week.
10. App generates or updates `records/{schoolYear}/weeks/{YYYY-W##}.md`.

## Review Fields

Weekly Review should store:

- Student.
- School year.
- Week start date.
- Week end date.
- Primary unit study.
- Status: `draft`, `finalized`, or `amended`.
- Total approved learning time.
- Number of activities logged.
- Number of days logged.
- Number of artifacts saved.
- Activities needing review.
- Subject time summary.
- Texas legal coverage summary.
- Parent weekly summary.
- Overall weekly rating.
- Skill ratings.
- Portfolio selections.
- Student favorite activity this week.
- Student hardest activity this week.
- Student proudest work this week.
- Student question or curiosity.
- Student self-rating, optional.
- Student dictated reflection.
- Next week focus.

## Rating Scale

Use this rating scale for overall review and skill rows:

- Not Observed
- Introduced
- Developing
- Practicing
- Proficient
- Mastery

Student self-rating uses a separate scale:

- I am just starting
- I am getting better
- I can do this with help
- I can do this by myself
- I can teach or explain this

## Skill Rating Behavior

Skill ratings should be grouped by subject.

The form should show `Skills Touched This Week` by default based on logged activities. The full skill list should be expandable.

For each skill rating row, show:

- Skill name.
- Evidence from activities/artifacts.
- AI suggested rating, when available.
- Parent rating buttons.
- Parent note field.

Parent rating overrides the AI suggestion.

Weekly review should rate skill progress for the week based on the pattern of activities and evidence, not grade every individual activity.

## Skill Subjects

### Language Arts

- Reading
- Grammar
- Literature
- Memory Work
- Phonics
- Spelling
- Writing
- Editing
- Fluency

### Math

- Number Sense and Place Value
- Operations and Fluency
- Fractions and Part-Whole Reasoning
- Measurement and Money
- Geometry and Spatial Reasoning
- Data and Graphing
- Patterns and Algebraic Thinking
- Mathematical Communication
- Problem-Solving and Application

### Finance

- Money Recognition and Counting
- Earning and Value Creation
- Saving and Goal Setting
- Spending and Decision-Making
- Needs, Wants and Priorities
- Budgeting
- Giving and Stewardship
- Tradeoffs and Opportunity Cost
- Comparison Shopping
- Record Keeping
- Entrepreneurship
- Banking Basics
- Risk and Responsibility
- Advertising and Awareness

### Science

- Conducts Investigations with Responsible Practices
- Asks Questions and Seeks Answers
- Critical Thinking for Problem Solving
- Uses Tools and Models to Investigate the World
- Matter & Energy
- Force, Motion & Energy
- Earth & Space
- Organisms & Environments

### Social Studies

- US History
- World History
- Geography
- Economics
- Government
- Citizenship
- Culture
- Life Skills
- Communication
- Business
- Philosophy
- Emotional Intelligence

## Portfolio Highlights

Prompt the parent to choose 2-5 artifacts or activities as portfolio highlights for the week.

Portfolio choices should come from saved activities and artifacts in the selected week. Parent selections should be stored with the weekly review.

## Markdown Export

When a weekly review is finalized or amended, generate or update:

```text
records/{schoolYear}/weeks/{YYYY-W##}.md
```

Markdown is generated from database records. Manual Markdown edits do not update the database unless a future import/sync feature is intentionally added.
