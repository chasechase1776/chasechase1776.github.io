"use client";

import type { FocusEvent } from "react";

type UnitPlanStatus = "active" | "upcoming" | "planned" | "complete" | "skipped";

type UnitPlanRow = {
  id: string;
  title: string;
  weeks: string;
  guidingQuestion: string;
  primaryCompetency: string;
  formatType: string;
  weeklyRhythmOverride: string;
  publishedSequence: string;
  parentDesigned: string;
  fieldTrip: string;
  finalFridayCapstone: string;
  status: UnitPlanStatus;
};

type AnnualPlanUnitTableProps = {
  rows: UnitPlanRow[];
  unitFormatOptions: string[];
  weeklyRhythmOverrideOptions: string[];
  unitStatusOptions: UnitPlanStatus[];
  onSelectExistingZero: (event: FocusEvent<HTMLInputElement>) => void;
  onMoveRowTo: (id: string, position: number) => void;
  onUpdateRow: <K extends keyof UnitPlanRow>(id: string, key: K, value: UnitPlanRow[K]) => void;
  onDeleteRow: (id: string) => void;
};

export function AnnualPlanUnitTable({
  rows,
  unitFormatOptions,
  weeklyRhythmOverrideOptions,
  unitStatusOptions,
  onSelectExistingZero,
  onMoveRowTo,
  onUpdateRow,
  onDeleteRow
}: AnnualPlanUnitTableProps) {
  return (
    <div className="plan-table-wrap">
      <table className="plan-table">
        <thead><tr><th>#</th><th>Unit title</th><th>Weeks</th><th>Guiding question</th><th>Primary competency</th><th>Unit format type</th><th>Weekly rhythm override</th><th>Published sequence?</th><th>Parent designed?</th><th>Field trip / application</th><th>Final Friday capstone</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className={`unit-status-row unit-status-${row.status}`} key={row.id}>
              <td>
                <input
                  aria-label={`Order for ${row.title}`}
                  className="table-order-input"
                  min="1"
                  max={rows.length}
                  type="number"
                  value={index + 1}
                  onFocus={onSelectExistingZero}
                  onChange={(event) => onMoveRowTo(row.id, Number(event.target.value))}
                />
              </td>
              <td><input value={row.title} onChange={(event) => onUpdateRow(row.id, "title", event.target.value)} /></td>
              <td><input className="table-weeks-input" value={row.weeks} onChange={(event) => onUpdateRow(row.id, "weeks", event.target.value)} /></td>
              <td><textarea value={row.guidingQuestion} onChange={(event) => onUpdateRow(row.id, "guidingQuestion", event.target.value)} /></td>
              <td><textarea value={row.primaryCompetency} onChange={(event) => onUpdateRow(row.id, "primaryCompetency", event.target.value)} /></td>
              <td>
                <input list="unit-format-options" value={row.formatType} onChange={(event) => onUpdateRow(row.id, "formatType", event.target.value)} />
              </td>
              <td>
                <input list="weekly-rhythm-override-options" value={row.weeklyRhythmOverride} onChange={(event) => onUpdateRow(row.id, "weeklyRhythmOverride", event.target.value)} />
              </td>
              <td>
                <select value={row.publishedSequence} onChange={(event) => onUpdateRow(row.id, "publishedSequence", event.target.value)}>
                  <option>No</option>
                  <option>Yes</option>
                  <option>Partial</option>
                </select>
              </td>
              <td>
                <select value={row.parentDesigned} onChange={(event) => onUpdateRow(row.id, "parentDesigned", event.target.value)}>
                  <option>Yes</option>
                  <option>No</option>
                  <option>Partial</option>
                </select>
              </td>
              <td><textarea value={row.fieldTrip} onChange={(event) => onUpdateRow(row.id, "fieldTrip", event.target.value)} /></td>
              <td><textarea value={row.finalFridayCapstone} onChange={(event) => onUpdateRow(row.id, "finalFridayCapstone", event.target.value)} /></td>
              <td>
                <select value={row.status} onChange={(event) => onUpdateRow(row.id, "status", event.target.value as UnitPlanStatus)}>
                  {unitStatusOptions.map((statusOption) => <option key={statusOption}>{statusOption}</option>)}
                </select>
              </td>
              <td>
                <button className="text-button" type="button" onClick={() => onDeleteRow(row.id)} disabled={rows.length === 1}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="unit-format-options">
        {unitFormatOptions.map((option) => <option key={option} value={option} />)}
      </datalist>
      <datalist id="weekly-rhythm-override-options">
        {weeklyRhythmOverrideOptions.map((option) => <option key={option} value={option} />)}
      </datalist>
    </div>
  );
}
