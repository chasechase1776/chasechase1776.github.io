"use client";

import type { FocusEvent } from "react";

type UnitPlannerActivityStatus = "planned" | "complete" | "skipped" | "moved";

type UnitPlannerActivity = {
  id: string;
  title: string;
  expectedMinutes: number;
  startTime: string;
  finishTime: string;
  description: string;
  prepNotes: string;
  shoppingList: string;
  status: UnitPlannerActivityStatus;
};

type PlannerMoveTarget = {
  week: string;
  day: string;
};

type UnitPlannerActivityModalProps = {
  activity: UnitPlannerActivity;
  weekIndex: number;
  dayIndex: number;
  weekdayLabel: string;
  plannerWeekCount: number;
  plannerMoveTarget: PlannerMoveTarget;
  canCompleteDay: boolean;
  onClose: () => void;
  onCompleteDay: () => void;
  onSendDayToDailyRecords: () => void;
  onUpdateActivity: (patch: Partial<UnitPlannerActivity>) => void;
  onPlannerMoveTargetChange: (patch: Partial<PlannerMoveTarget>) => void;
  onMoveActivityToWeekDay: () => void;
  onMoveActivityPrompt: () => void;
  onDeleteActivity: () => void;
  onSelectExistingZero: (event: FocusEvent<HTMLInputElement>) => void;
};

export function UnitPlannerActivityModal({
  activity,
  weekIndex,
  dayIndex,
  weekdayLabel,
  plannerWeekCount,
  plannerMoveTarget,
  canCompleteDay,
  onClose,
  onCompleteDay,
  onSendDayToDailyRecords,
  onUpdateActivity,
  onPlannerMoveTargetChange,
  onMoveActivityToWeekDay,
  onMoveActivityPrompt,
  onDeleteActivity,
  onSelectExistingZero
}: UnitPlannerActivityModalProps) {
  return (
    <div
      className="unit-planner-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="unit-day-detail-panel unit-planner-modal" role="dialog" aria-modal="true" aria-labelledby="selected-planner-activity-title">
        <div className="section-head">
          <div>
            <p className="eyebrow">Week {weekIndex + 1} {weekdayLabel}</p>
            <h2 id="selected-planner-activity-title">Selected activity</h2>
          </div>
          <div className="primary-action-row">
            <button className="secondary-button" type="button" onClick={onCompleteDay} disabled={!canCompleteDay}>Complete Day</button>
            <button className="primary-button" type="button" onClick={onSendDayToDailyRecords}>Send Day to Daily Records</button>
          </div>
        </div>

        <div className="unit-day-activity-list">
          <article className="unit-day-activity-card" key={activity.id}>
            <div className="unit-activity-title-row">
              <label><span>Activity title</span><input value={activity.title} onChange={(event) => onUpdateActivity({ title: event.target.value })} /></label>
              <span className={`tag ${activity.status === "complete" ? "good" : activity.status === "planned" ? "planned" : ""}`}>{activity.status}</span>
            </div>
            <div className="unit-activity-body">
              <div className="activity-card-header">
                <label><span>Expected time</span><input type="number" min="0" value={activity.expectedMinutes} onFocus={onSelectExistingZero} onChange={(event) => onUpdateActivity({ expectedMinutes: Number(event.target.value) })} /></label>
                <label><span>Start time</span><input type="time" value={activity.startTime} onChange={(event) => onUpdateActivity({ startTime: event.target.value })} /></label>
                <label><span>Finish time</span><input type="time" value={activity.finishTime} onChange={(event) => onUpdateActivity({ finishTime: event.target.value })} /></label>
              </div>
              <div className="unit-day-activity-fields">
                <label><span>Activity description</span><textarea rows={2} value={activity.description} onChange={(event) => onUpdateActivity({ description: event.target.value })} /></label>
                <label><span>Prep notes</span><textarea rows={2} value={activity.prepNotes} onChange={(event) => onUpdateActivity({ prepNotes: event.target.value })} /></label>
              </div>
              <details className="shopping-disclosure activity-shopping-disclosure">
                <summary>Shopping List</summary>
                <label><span>Activity shopping list</span><textarea rows={2} value={activity.shoppingList} onChange={(event) => onUpdateActivity({ shoppingList: event.target.value })} /></label>
              </details>
            </div>
            <div className="unit-planner-move-date-row">
              <label><span>Move to week #</span><input type="number" min="1" max={plannerWeekCount} value={plannerMoveTarget.week} onChange={(event) => onPlannerMoveTargetChange({ week: event.target.value })} /></label>
              <label><span>Move to day #</span><input type="number" min="1" max="5" value={plannerMoveTarget.day} onChange={(event) => onPlannerMoveTargetChange({ day: event.target.value })} /></label>
              <button className="secondary-button" type="button" onClick={onMoveActivityToWeekDay} disabled={!plannerMoveTarget.week || !plannerMoveTarget.day}>Move Activity</button>
            </div>
            <div className="primary-action-row">
              {activity.status === "complete" ? (
                <button className="secondary-button" type="button" onClick={() => onUpdateActivity({ status: "planned" })}>Undo Complete</button>
              ) : (
                <button className="secondary-button" type="button" onClick={() => onUpdateActivity({ status: "complete" })}>Complete Activity</button>
              )}
              <button className="secondary-button" type="button" onClick={() => onUpdateActivity({ status: "skipped" })}>Skip</button>
              <button className="secondary-button" type="button" onClick={onMoveActivityPrompt}>Move Week/Day</button>
              <button className="success-button" type="button" onClick={onClose}>Close / Save</button>
              <button className="text-button" type="button" onClick={onDeleteActivity}>Delete</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
