# Quarter Reviews and Year-Round School Year Plan

## Purpose

Quarter Reviews are parent-editable instructional checkpoints generated from daily logs and finalized Weekly Reviews.

Each quarter is usually about 9 weeks, but date ranges can be customized for year-round homeschooling. The database remains the source of truth. Markdown and PDF files are generated export snapshots.

## School Year Structure

Each school year should contain:

- School year start date.
- School year end date.
- Quarter 1 start/end.
- Quarter 2 start/end.
- Quarter 3 start/end.
- Quarter 4 start/end.
- Optional Summer Extension or Summer Term.
- Annual Review / year-end archive.

The parent should be able to choose:

- Model A: Traditional 4-quarter school year.
- Model B: Year-round homeschool model with optional Summer Extension / Summer Term before annual closeout.

Summer Extension should be optional. It may belong to the ending school year or the next school year, based on parent preference. The app should ask which school year summer work should be assigned to.

Annual closeout finalizes the school year. After closeout, the next school year starts a fresh cycle of quarters.

## Navigation

Each school year should include:

- Daily Records.
- Unit Studies.
- Weekly Reviews.
- Quarter Reviews.
- Portfolio.
- Legal Archive.
- Annual Review.
- Reports.

Quarter Reviews should include Quarter 1 through Quarter 4 and optional Summer Extension.

## Quarter Review Workflow

1. Parent opens Quarter Reviews.
2. App defaults to the current instructional quarter based on date.
3. Parent can select a previous quarter.
4. Parent can edit quarter start/end dates.
5. Parent clicks `Generate Quarter Review`.
6. App pulls daily activity records, daily learning records, weekly reviews, weekly skill ratings, subject allocations, legal tags, unit studies, artifacts, and portfolio selections.
7. App creates a draft quarter review.
8. Parent edits ratings, summaries, portfolio selections, student reflection, parent reflection, and next-step plans.
9. Parent saves draft or finalizes.
10. Finalized quarter review remains retrievable by school year and quarter.
11. App generates Markdown and PDF exports.

## Quarter Review Fields

Quarter Review should store:

- Student.
- School year.
- Quarter label.
- Start date.
- End date.
- Status: `draft`, `finalized`, or `amended`.
- Total approved learning time.
- Days with records.
- Activities logged.
- Weekly reviews completed.
- Artifacts saved.
- Portfolio items selected.
- Activities needing review.
- Subject time summary.
- Texas legal coverage summary.
- Skill progression summary.
- Unit study progress summary.
- Portfolio highlights.
- Student reflection.
- Parent reflection.
- Next quarter priorities.

## Student Reflection

Weekly Review student reflection fields:

- Student favorite activity this week.
- Student hardest activity this week.
- Student proudest work this week.
- Student question or curiosity.
- Student self-rating, optional.
- Student dictated reflection.

Quarter Review student reflection fields:

- What did I learn this quarter?
- What work am I most proud of?
- What was hard for me?
- What do I want to learn next?
- What project or activity did I enjoy most?
- Student self-rating, optional.
- Student dictated reflection.
- Student-selected portfolio item.

Annual Review student reflection fields:

- What did I learn this year?
- What am I most proud of this year?
- What was hard this year?
- What do I want to learn next year?
- Favorite book / unit / project.
- Student-selected best work.
- Student dictated reflection.

Student self-rating scale:

- I am just starting.
- I am getting better.
- I can do this with help.
- I can do this by myself.
- I can teach or explain this.

Keep the student scale separate from the parent skill rating scale.

## Rating Scales

Parent skill rating scale:

- Not Observed
- Introduced
- Developing
- Practicing
- Proficient
- Mastery

Legal/subject coverage scale:

- Not Covered
- Light
- Adequate
- Strong

## Skill Progression

Quarter Reviews should show trends across Weekly Reviews, such as:

- Reading: Developing -> Practicing -> Practicing
- Grammar: Introduced -> Developing -> Practicing
- Writing: Introduced -> Developing

For each skill row, show:

- Skill name.
- Evidence from activities/artifacts.
- Weekly rating trend.
- AI suggested quarter rating.
- Parent final rating.
- Parent note field.

Parent final rating overrides the AI suggestion.

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

## Texas Coverage

Track Texas categories with the legal/subject coverage scale:

- Reading
- Spelling
- Grammar
- Mathematics
- Good Citizenship
- Visual Curriculum
- Bona Fide Instruction

## Portfolio Highlights

Prompt the parent to select 8-15 highlights for the quarter. Pull suggestions from weekly portfolio selections and artifacts.

Student should also be able to select one student favorite portfolio item for the quarter.

## Unit Study Section

Show each unit active during the quarter with:

- Status: `not started`, `active`, `completed`, or `paused`.
- Activities count.
- Artifacts count.
- Skills supported.
- Parent summary.
- Student comment, optional.
- Continue, close, or review later.

## Parent Reflection

Include:

- Overall quarter rating.
- What improved most.
- What needs review.
- What surprised me.
- What was difficult.
- What should continue.
- What should change next quarter.
- Next quarter priorities.

## Annual Review / School Year Closeout

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

- Student.
- School year.
- Date range.
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
- Close/archive school year action.

## Exports

When a quarter review is finalized, create or update:

```text
records/{schoolYear}/quarter-reviews/{quarterLabel}.md
```

When a Summer Extension is finalized, create or update:

```text
records/{schoolYear}/quarter-reviews/summer-extension.md
```

When an Annual Review is finalized, create or update:

```text
records/{schoolYear}/annual-review.md
```

Also update:

- `records/{schoolYear}/legal-summary.md`
- `records/{schoolYear}/portfolio-index.md`
- `records/{schoolYear}/annual-plan.md` when annual plan fields change

PDF exports should be generated from database records and saved review fields.
