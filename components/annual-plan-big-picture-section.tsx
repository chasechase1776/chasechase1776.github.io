type AnnualPlanBigPicture = {
  primaryTheme: string;
  centralQuestion: string;
  thinkingProgression: string;
  writingProgression: string;
  presentationProgression: string;
  annualProjectCycle: string;
  yearLongJournals: string;
  spiralCurriculumSummary: string;
};

type AnnualPlanBigPictureSectionProps = {
  bigPicture: AnnualPlanBigPicture;
  onUpdateBigPicture: <K extends keyof AnnualPlanBigPicture>(key: K, value: AnnualPlanBigPicture[K]) => void;
  onFinalize: () => void;
};

export function AnnualPlanBigPictureSection({ bigPicture, onUpdateBigPicture, onFinalize }: AnnualPlanBigPictureSectionProps) {
  return (
    <section className="plan-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Section 1</p>
          <h2>Big Picture Framework</h2>
        </div>
        <button className="primary-button" type="button" onClick={onFinalize}>Finalize</button>
      </div>
      <div className="review-form-grid">
        <label>
          <span>Primary Theme</span>
          <input value={bigPicture.primaryTheme} onChange={(event) => onUpdateBigPicture("primaryTheme", event.target.value)} />
        </label>
        <label>
          <span>Central Question</span>
          <input value={bigPicture.centralQuestion} onChange={(event) => onUpdateBigPicture("centralQuestion", event.target.value)} />
        </label>
        <label>
          <span>Thinking Progression</span>
          <input value={bigPicture.thinkingProgression} onChange={(event) => onUpdateBigPicture("thinkingProgression", event.target.value)} />
        </label>
        <label>
          <span>Writing Progression</span>
          <input value={bigPicture.writingProgression} onChange={(event) => onUpdateBigPicture("writingProgression", event.target.value)} />
        </label>
        <label>
          <span>Presentation Progression</span>
          <input value={bigPicture.presentationProgression} onChange={(event) => onUpdateBigPicture("presentationProgression", event.target.value)} />
        </label>
        <label>
          <span>Annual Project Cycle</span>
          <textarea value={bigPicture.annualProjectCycle} onChange={(event) => onUpdateBigPicture("annualProjectCycle", event.target.value)} />
        </label>
        <label>
          <span>Year-Long Journals</span>
          <textarea value={bigPicture.yearLongJournals} onChange={(event) => onUpdateBigPicture("yearLongJournals", event.target.value)} />
        </label>
        <label>
          <span>Spiral Curriculum Summary</span>
          <textarea value={bigPicture.spiralCurriculumSummary} onChange={(event) => onUpdateBigPicture("spiralCurriculumSummary", event.target.value)} />
        </label>
      </div>
    </section>
  );
}
