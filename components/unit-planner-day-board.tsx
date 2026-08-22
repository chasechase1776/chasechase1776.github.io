"use client";

import type { DragEvent } from "react";

type UnitPlannerActivity = {
  id: string;
  title: string;
  status: string;
};

type UnitPlannerDay = {
  id: string;
  complete: boolean;
  activities: UnitPlannerActivity[];
};

type SelectedPlannerActivity = {
  weekIndex: number;
  dayIndex: number;
  activityId: string;
} | null;

type UnitPlannerDayBoardProps = {
  days: UnitPlannerDay[];
  weekIndex: number;
  weekdayLabels: string[];
  selectedActivity: SelectedPlannerActivity;
  plannerDateForDay: (weekIndex: number, dayIndex: number) => string;
  onSelectActivity: (dayIndex: number, activityId: string) => void;
  onDayDragStart: (event: DragEvent<HTMLElement>, weekIndex: number, dayIndex: number) => void;
  onActivityDragStart: (event: DragEvent<HTMLButtonElement>, weekIndex: number, dayIndex: number, activityId: string) => void;
  onActivityDrop: (event: DragEvent<HTMLElement>, weekIndex: number, dayIndex: number, activityIndexOrDayIndex?: number) => void;
  onAddActivity: (weekIndex: number, dayIndex: number) => void;
  onAddFridayTemplate: (weekIndex: number, dayIndex: number) => void;
};

export function UnitPlannerDayBoard({
  days,
  weekIndex,
  weekdayLabels,
  selectedActivity,
  plannerDateForDay,
  onSelectActivity,
  onDayDragStart,
  onActivityDragStart,
  onActivityDrop,
  onAddActivity,
  onAddFridayTemplate
}: UnitPlannerDayBoardProps) {
  return (
    <div className="unit-day-columns">
      {days.map((day, dayIndex) => (
        <article
          className={day.complete ? "unit-day-column is-complete" : "unit-day-column"}
          draggable
          key={day.id}
          onDragStart={(event) => onDayDragStart(event, weekIndex, dayIndex)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onActivityDrop(event, weekIndex, dayIndex)}
        >
          <div className="unit-day-head">
            <strong>{weekdayLabels[dayIndex]}</strong>
            <span className={day.complete ? "tag good" : "tag planned"}>{day.complete ? "complete" : "planned"}</span>
          </div>
          <p className="unit-day-date">{plannerDateForDay(weekIndex, dayIndex) || `Day ${dayIndex + 1}`}</p>
          <div className="unit-activity-pill-stack">
            {day.activities.map((activity, activityIndex) => (
              <button
                className={[
                  "unit-activity-pill",
                  `is-${activity.status}`,
                  selectedActivity?.weekIndex === weekIndex && selectedActivity.dayIndex === dayIndex && selectedActivity.activityId === activity.id ? "is-selected" : ""
                ].filter(Boolean).join(" ")}
                draggable
                key={activity.id}
                type="button"
                onClick={() => onSelectActivity(dayIndex, activity.id)}
                onDragStart={(event) => onActivityDragStart(event, weekIndex, dayIndex, activity.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.stopPropagation();
                  onActivityDrop(event, weekIndex, dayIndex, activityIndex);
                }}
              >
                {activity.title || "Untitled"}
              </button>
            ))}
          </div>
          <div className="unit-day-action-row">
            <button className="secondary-button unit-create-activity-button" type="button" onClick={() => onAddActivity(weekIndex, dayIndex)}>
              Create Activity
            </button>
            {dayIndex === 4 ? (
              <button className="secondary-button" type="button" onClick={() => onAddFridayTemplate(weekIndex, dayIndex)}>
                Friday Template
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
