type AnnualPlanExportArtifact = {
  id: string;
  originalName: string;
};

type AnnualPlanExportsSectionProps = {
  schoolYear: string;
  lastPdfArtifact: AnnualPlanExportArtifact | null;
  isPdfBusy: boolean;
  onGenerateMarkdown: () => void;
  onGeneratePdf: () => void;
  onAddToLegalArchive: () => void;
  onFinalize: () => void;
};

export function AnnualPlanExportsSection({
  schoolYear,
  lastPdfArtifact,
  isPdfBusy,
  onGenerateMarkdown,
  onGeneratePdf,
  onAddToLegalArchive,
  onFinalize
}: AnnualPlanExportsSectionProps) {
  return (
    <section className="plan-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Section 8</p>
          <h2>Annual Plan Exports</h2>
        </div>
        <div className="primary-action-row">
          <button className="secondary-button" type="button" onClick={onGenerateMarkdown}>Generate Annual Plan Markdown</button>
          <button className="secondary-button" type="button" onClick={onGeneratePdf} disabled={isPdfBusy}>Generate Annual Plan PDF</button>
          <button className="secondary-button" type="button" onClick={onAddToLegalArchive}>Add to Legal Archive</button>
          <button className="primary-button" type="button" onClick={onFinalize}>Finalize</button>
        </div>
      </div>
      {lastPdfArtifact ? (
        <div className="status-line">
          <span>{lastPdfArtifact.originalName}</span>
          <a className="download-link" href={`/api/artifacts/${lastPdfArtifact.id}/download`} target="_blank" rel="noreferrer">
            Open PDF
          </a>
        </div>
      ) : null}
      <div className="coverage-summary-grid">
        <div className="record-link"><strong>Markdown path</strong><span>records/{schoolYear}/annual-plan.md</span></div>
        <div className="record-link"><strong>PDF export</strong><span>Includes all Annual Plan sections above.</span></div>
        <div className="record-link"><strong>Archive note</strong><span>Annual Plan explains intent; daily logs document reality.</span></div>
      </div>
    </section>
  );
}
