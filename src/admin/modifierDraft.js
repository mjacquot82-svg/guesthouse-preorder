import { dollarsToCents } from "../services/modifierMoney.js";

export function modifierDraftSignature(draft) {
  if (!draft) return "";
  const single = draft.selectionType === "single";
  const minSelections = single ? (draft.required ? 1 : 0) : Number(draft.minSelections);
  const maxSelections = single ? 1 : Number(draft.maxSelections);
  return JSON.stringify({
    name: (draft.name ?? "").trim(),
    description: (draft.description ?? "").trim(),
    selection_type: draft.selectionType,
    required: minSelections > 0,
    min_selections: minSelections,
    max_selections: maxSelections,
    allow_quantity: Boolean(draft.allowQuantity),
    active: draft.active !== false,
    sort_order: Number(draft.sortOrder),
    choices: (draft.choices || []).map((choice, index) => ({
      identity: choice.backendId || choice.draftId,
      name: (choice.name ?? "").trim(),
      price_adjustment_cents: dollarsToCents(choice.price),
      active: choice.active !== false,
      sort_order: index,
    })),
  });
}

export function isModifierDraftDirty(draft, savedDraft) {
  return Boolean(draft && savedDraft && modifierDraftSignature(draft) !== modifierDraftSignature(savedDraft));
}
