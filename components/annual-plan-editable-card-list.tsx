"use client";

type EditableAnnualPlanCard = {
  id: string;
  title: string;
  narrative: string;
};

type AnnualPlanEditableCardListProps = {
  cards: EditableAnnualPlanCard[];
  editingCardId: string | null;
  emptyTitle: string;
  emptyNarrative: string;
  narrativeLabel: string;
  onMoveCard: (id: string, direction: -1 | 1) => void;
  onEditCard: (id: string | null) => void;
  onDeleteCard: (id: string) => void;
  onUpdateCard: (id: string, key: "title" | "narrative", value: string) => void;
};

export function AnnualPlanEditableCardList({
  cards,
  editingCardId,
  emptyTitle,
  emptyNarrative,
  narrativeLabel,
  onMoveCard,
  onEditCard,
  onDeleteCard,
  onUpdateCard
}: AnnualPlanEditableCardListProps) {
  return (
    <div className="records-grid editable-card-grid">
      {cards.map((card, index) => (
        <article className="record-link editable-spine-card" key={card.id}>
          <div className="finished-card-row">
            <div className="editable-card-preview">
              <strong>{card.title || emptyTitle}</strong>
              <span>{card.narrative || emptyNarrative}</span>
            </div>
            <div className="card-control-row">
              <button className="secondary-button" type="button" onClick={() => onMoveCard(card.id, -1)} disabled={index === 0}>Move up</button>
              <button className="secondary-button" type="button" onClick={() => onMoveCard(card.id, 1)} disabled={index === cards.length - 1}>Move down</button>
              <button className="secondary-button" type="button" onClick={() => onEditCard(editingCardId === card.id ? null : card.id)}>
                {editingCardId === card.id ? "Collapse" : "Edit"}
              </button>
              <button className="text-button" type="button" onClick={() => onDeleteCard(card.id)} disabled={cards.length === 1}>Delete</button>
            </div>
          </div>
          {editingCardId === card.id ? (
            <div className="spine-edit-fields">
              <label>
                <span>Bold title</span>
                <input value={card.title} onChange={(event) => onUpdateCard(card.id, "title", event.target.value)} />
              </label>
              <label>
                <span>{narrativeLabel}</span>
                <textarea value={card.narrative} onChange={(event) => onUpdateCard(card.id, "narrative", event.target.value)} />
              </label>
              <div className="card-control-row">
                <button className="primary-button" type="button" onClick={() => onEditCard(null)}>Save</button>
                <button className="secondary-button" type="button" onClick={() => onEditCard(null)}>Collapse</button>
              </div>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
