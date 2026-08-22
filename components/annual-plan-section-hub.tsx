"use client";

type AnnualPlanSection = {
  id: string;
  label: string;
  summary: string;
};

type AnnualPlanSectionHubProps = {
  sections: AnnualPlanSection[];
  activeSectionId: string | null;
  finalizedSectionIds: string[];
  onSelectSection: (sectionId: string) => void;
};

export function AnnualPlanSectionHub({
  sections,
  activeSectionId,
  finalizedSectionIds,
  onSelectSection
}: AnnualPlanSectionHubProps) {
  return (
    <div className="annual-section-hub" aria-label="Annual Plan sections">
      {sections.map((section) => {
        const isFinalized = finalizedSectionIds.includes(section.id);
        const isActive = activeSectionId === section.id;
        return (
          <button
            className={`annual-section-button${isActive ? " is-active" : ""}${isFinalized ? " is-finalized" : ""}`}
            key={section.id}
            type="button"
            onClick={() => onSelectSection(section.id)}
          >
            <span>{section.label}</span>
            <strong>{section.summary}</strong>
          </button>
        );
      })}
    </div>
  );
}
