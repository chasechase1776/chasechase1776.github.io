"use client";

type UnitPlannerWeekTab = {
  id: string;
  complete: boolean;
};

type UnitPlannerWeekTabsProps = {
  weeks: UnitPlannerWeekTab[];
  activeWeekIndex: number | null;
  onSelectWeek: (weekIndex: number) => void;
};

export function UnitPlannerWeekTabs({ weeks, activeWeekIndex, onSelectWeek }: UnitPlannerWeekTabsProps) {
  return (
    <div className="unit-week-tabs" aria-label="Unit study weeks">
      {weeks.map((week, weekIndex) => (
        <button
          className={["unit-week-button", activeWeekIndex === weekIndex ? "is-active" : "", week.complete ? "is-complete" : ""].filter(Boolean).join(" ")}
          type="button"
          key={week.id}
          onClick={() => onSelectWeek(weekIndex)}
        >
          <strong>Week {weekIndex + 1}</strong>
          <span>{week.complete ? "complete" : "planned"}</span>
        </button>
      ))}
    </div>
  );
}
