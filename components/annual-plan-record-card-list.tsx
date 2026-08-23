"use client";

import type { ChangeEvent } from "react";

type AnnualPlanRecordAttachment = {
  id: string;
  originalName: string;
  sizeBytes: number;
};

type AnnualPlanRecordCard = {
  id: string;
  title: string;
  narrative: string;
  attachments: AnnualPlanRecordAttachment[];
};

type AnnualPlanRecordCardListProps = {
  cards: AnnualPlanRecordCard[];
  editingCardId: string | null;
  formatBytes: (bytes: number) => string;
  onMoveCard: (id: string, direction: -1 | 1) => void;
  onEditCard: (id: string | null) => void;
  onDeleteCard: (id: string) => void;
  onUpdateCard: (id: string, key: "title" | "narrative", value: string) => void;
  onUploadAttachment: (cardId: string, file: File) => void;
  onRemoveAttachment: (cardId: string, artifactId: string) => void;
};

export function AnnualPlanRecordCardList({
  cards,
  editingCardId,
  formatBytes,
  onMoveCard,
  onEditCard,
  onDeleteCard,
  onUpdateCard,
  onUploadAttachment,
  onRemoveAttachment
}: AnnualPlanRecordCardListProps) {
  function handleUpload(cardId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onUploadAttachment(cardId, file);
    event.target.value = "";
  }

  return (
    <div className="records-grid editable-card-grid">
      {cards.map((card, index) => (
        <article className="record-link editable-spine-card" key={card.id}>
          <div className="finished-card-row">
            <div className="editable-card-preview">
              <strong>{card.title || "Untitled annual record"}</strong>
              <span>{card.narrative || "Add the purpose and expected documents for this annual record."}</span>
              <span>{card.attachments.length ? `${card.attachments.length} attached document${card.attachments.length === 1 ? "" : "s"}` : "No attached documents yet."}</span>
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
                <span>Description</span>
                <textarea value={card.narrative} onChange={(event) => onUpdateCard(card.id, "narrative", event.target.value)} />
              </label>
              <label className="annual-record-upload">
                <span>Attach document</span>
                <input type="file" onChange={(event) => handleUpload(card.id, event)} />
              </label>
              <div className="uploaded-proof-list" aria-live="polite">
                {card.attachments.length ? card.attachments.map((artifact) => (
                  <div className="uploaded-proof-item" key={artifact.id}>
                    <span>{artifact.originalName}</span>
                    <span>{formatBytes(artifact.sizeBytes)}</span>
                    <button className="text-button" type="button" onClick={() => onRemoveAttachment(card.id, artifact.id)}>Remove</button>
                  </div>
                )) : <p className="muted">No documents attached to this annual record yet.</p>}
              </div>
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
