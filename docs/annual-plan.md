# Annual Plan

## Purpose

The Annual Plan is the big-picture school-year planning and archive page. It is not a daily logging page.

The Annual Plan documents intent: theme, central question, developmental progressions, curriculum spines, daily recurring expectations, weekly rhythm, unit-study framework, journals, capstones, and annual records. Daily logs document what actually happened.

## Header

The Annual Plan should include:

- Student.
- School year.
- Grade level.
- Status: `draft`, `active`, `finalized`, or `archived`.
- Buttons: Save Plan, Export Markdown, Export PDF, Finalize Plan.

## Big Picture Framework

Fields:

- Primary Theme.
- Central Question.
- Thinking Progression.
- Writing Progression.
- Presentation Progression.
- Annual Project Cycle.
- Year-Long Journals.
- Spiral Curriculum Summary.

Default 2nd grade examples:

- Primary Theme: Me and My Community.
- Central Question: How do people live together?
- Thinking Progression: Observe.
- Writing Progression: Weekly Narrations.
- Presentation Progression: Tell us what you learned.
- Annual Project Cycle: Weekly project and presentation cycles culminating in unit capstones and 1+ year-end projects.
- Year-Long Journals: Observation Journal; Unit Lap Books.

## Daily Recurring Expectations and Curriculum Spines

Cards:

- Literacy Spine, 4x/week.
- Math Spine, 4x/week.
- Finance Spine, 4x/week or integrated weekly.
- Daily Science Journal / Nature Observation.
- Daily Independent Reading.
- Daily Physical Activity / Education.

Each card should include frequency, primary resources, skills covered, summary, and notes.

## Weekly Rhythm

Use this named weekly rhythm:

- Question Monday.
- Exploration Tuesday.
- Context Wednesday.
- Meaning Thursday.
- Creating Friday.

Each rhythm day should include:

- Purpose.
- Typical activities.
- Related activity types.
- Evidence suggestions.

Friday functions as the weekly culmination point. At the end of a unit study, Final Friday becomes a larger unit capstone where the student presents the final project, explains what he learned, and selects proof-of-learning artifacts.

## Unit Study Format Options

Each unit study should have `unit_format_type`.

Allowed values:

- `harbor_sprout_template`
- `open_and_go_published_unit`
- `minimal_structure_parent_designed`

Format options:

- Harbor & Sprout Template: follows the Monday-Friday template structure.
- Open-and-Go Published Unit: parent generally follows the publisher sequence while the app still tracks subjects, legal categories, skills, artifacts, and time allocation.
- Minimal Structure / Parent-Designed: app uses the weekly rhythm as the default planning scaffold and supports fully custom activities, projects, writing prompts, presentation goals, and artifacts.

These fields represent the plan, not rigid requirements. The parent may deviate based on the child's interest, pacing, field trips, family schedule, or unit depth.

## Unit Study Sequence

Each unit should include:

- Sequence number.
- Semester or term.
- Unit title.
- Expected duration in weeks.
- Guiding question.
- Primary competency.
- Resources.
- Field trip / real-world application.
- Final Friday capstone.
- Status: `planned`, `active`, `completed`, `paused`, or `moved`.
- Unit Format Type.
- Weekly Rhythm Override.
- Published Sequence Followed?
- Parent Designed?
- Notes.

Default 2nd grade units:

- Construction.
- All About Me.
- Off the Land.
- Gratitude and Thanksgiving.
- All About Money.
- Let's Cook!
- Human Body.
- Community Helpers.
- World Cultures and Traditions.
- 50 States.
- Transportation.
- Outdoor Adventure and Stewardship.

## Year-End Capstone

Fields:

- Capstone title.
- Expected duration.
- Main product.
- Real-world application.
- Skills integrated.
- Summer bridge.
- Summary.

Default capstone: Outdoor Adventure and Stewardship, ending in an Adventure Guide used for summer camping and field studies.

## Journals and Portfolios

Default journals:

- Observation Journal.
- Unit Lap Books.
- Writing Portfolio.
- Project Portfolio.
- Adventure Guide.

Each journal card should include frequency, purpose, artifact expectation, and notes.

## Annual Records

Allow uploads and notes for:

- Curriculum overview.
- Scope and sequence.
- Legal notes.
- Reading list.
- Field trip plan.
- Annual plan documents.
- Other school-year records.

## Exports

Annual Plan Markdown path:

```text
records/{schoolYear}/annual-plan.md
```

Annual Plan PDF should include all Annual Plan sections.

Annual Plan Markdown and PDF should include:

- Daily recurring expectations.
- Weekly rhythm.
- Unit-study format options.
- Unit sequence with selected format type.
- Note that the Annual Plan is an intended framework and daily logs remain the record of what actually happened.
