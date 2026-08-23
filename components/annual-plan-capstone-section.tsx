type AnnualPlanCapstoneSectionProps = {
  onFinalize: () => void;
};

export function AnnualPlanCapstoneSection({ onFinalize }: AnnualPlanCapstoneSectionProps) {
  return (
    <section className="plan-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Section 5</p>
          <h2>Year-End Capstone</h2>
        </div>
        <button className="primary-button" type="button" onClick={onFinalize}>Finalize</button>
      </div>
      <div className="review-form-grid">
        <label>
          <span>Capstone title</span>
          <input defaultValue="Outdoor Adventure and Stewardship" />
        </label>
        <label>
          <span>Expected duration</span>
          <input defaultValue="2 weeks" />
        </label>
        <label>
          <span>Main product</span>
          <input defaultValue="Adventure Guide" />
        </label>
        <label>
          <span>Real-world application</span>
          <input defaultValue="Camping/outdoor field studies" />
        </label>
        <label>
          <span>Skills integrated</span>
          <textarea defaultValue="Nature journaling, map reading, safety, writing, observation, project work, presentation." />
        </label>
        <label>
          <span>Summer bridge</span>
          <textarea defaultValue="Camping trips and continued nature journaling." />
        </label>
        <label>
          <span>Summary</span>
          <textarea defaultValue="The year ends with an Outdoor Adventure and Stewardship capstone. The student creates an Adventure Guide containing packing lists, nature journal pages, animal observations, plant sketches, trail maps, camp recipes, safety rules, Leave No Trace principles, first-aid basics, and favorite parks. The binder becomes a real tool for summer camping and field studies." />
        </label>
      </div>
    </section>
  );
}
