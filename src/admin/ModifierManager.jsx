import { useState } from "react";
import { dollarsToCents } from "../services/modifierMoney.js";

let nextDraftId = 0;
const choiceDraft = (choice = {}) => ({
  draftId: choice.backendId || `new-choice-${nextDraftId += 1}`,
  backendId: choice.backendId,
  name: choice.name || "",
  price: choice.priceAdjustmentCents === undefined ? "0.00" : (choice.priceAdjustmentCents / 100).toFixed(2),
  active: choice.active !== false,
});

function customizationDraft(group, naturalOrder = 0) {
  if (group) return {
    ...group,
    choices: group.options.map(choiceDraft),
  };
  return {
    name: "", description: "", selectionType: "single", required: false,
    minSelections: 0, maxSelections: 1, active: true, sortOrder: naturalOrder,
    choices: [choiceDraft(), choiceDraft()],
  };
}

function customerRuleSummary(group) {
  if (group.selectionType === "single") return group.required ? "Customers must choose one" : "Customers can skip this";
  if (!group.maxSelections) return group.minSelections ? `Choose at least ${group.minSelections}` : "Choose any number";
  return group.minSelections ? `Choose ${group.minSelections}–${group.maxSelections}` : `Choose up to ${group.maxSelections}`;
}

export default function ModifierManager({ groups, onClose, onSaveCustomization }) {
  const [selectedBackendId, setSelectedBackendId] = useState("");
  const [draft, setDraft] = useState(() => customizationDraft(null, groups.length));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const editing = Boolean(draft.backendId);

  function selectCustomization(item) {
    setSelectedBackendId(item?.backendId || "");
    setDraft(customizationDraft(item, groups.length));
    setMessage("");
  }

  function updateDraft(field, value) {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "selectionType" && value === "single") {
        next.minSelections = current.required ? 1 : 0;
        next.maxSelections = 1;
      }
      if (field === "selectionType" && value === "multiple" && current.maxSelections === 1) {
        next.maxSelections = 0;
      }
      if (field === "required") next.minSelections = value ? 1 : 0;
      return next;
    });
  }

  function updateChoice(draftId, field, value) {
    setDraft((current) => ({
      ...current,
      choices: current.choices.map((choice) => choice.draftId === draftId ? { ...choice, [field]: value } : choice),
    }));
  }

  function removeChoice(choice) {
    if (choice.backendId) return updateChoice(choice.draftId, "active", false);
    setDraft((current) => ({ ...current, choices: current.choices.filter((item) => item.draftId !== choice.draftId) }));
  }

  function moveChoice(index, direction) {
    setDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.choices.length) return current;
      const choices = [...current.choices];
      [choices[index], choices[nextIndex]] = [choices[nextIndex], choices[index]];
      return { ...current, choices };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const namedChoices = draft.choices.filter((choice) => choice.name.trim() || choice.backendId);
    if (!draft.name.trim()) return setMessage("Give this customization a name, such as Milk or Toast choice.");
    if (!namedChoices.some((choice) => choice.name.trim())) return setMessage("Add at least one customer choice before saving.");
    const choices = [];
    for (const choice of namedChoices) {
      const cents = dollarsToCents(choice.price);
      if (!choice.name.trim()) return setMessage("Each choice needs a name.");
      if (cents === null) return setMessage(`Check the extra price for ${choice.name}. Use dollars and cents, such as 0.75.`);
      choices.push({ ...choice, priceAdjustmentCents: cents });
    }
    if (draft.selectionType === "multiple" && Number(draft.maxSelections) && Number(draft.maxSelections) < Number(draft.minSelections)) {
      return setMessage("Maximum choices cannot be less than minimum choices.");
    }
    setBusy(true); setMessage("");
    try {
      const result = await onSaveCustomization({ ...draft, name: draft.name.trim(), choices });
      const savedChoices = new Map(result.choices.map(({ clientId, response }) => [clientId, response]));
      setDraft((current) => ({
        ...current,
        backendId: result.group?.id || current.backendId,
        choices: choices.map((choice) => ({
          ...choice,
          backendId: savedChoices.get(choice.draftId)?.id || choice.backendId,
        })),
      }));
      setSelectedBackendId(result.group?.id || draft.backendId || "");
      setMessage("Changes saved.");
    } catch (error) {
      const partial = error.partialCustomization;
      if (partial?.group) {
        const savedChoices = new Map(partial.choices.map(({ clientId, response }) => [clientId, response]));
        setDraft((current) => ({
          ...current,
          backendId: partial.group.id,
          choices: current.choices.map((choice) => ({
            ...choice,
            backendId: savedChoices.get(choice.draftId)?.id || choice.backendId,
          })),
        }));
        setSelectedBackendId(partial.group.id);
      }
      setMessage(error.message || "This customization could not be saved. Your entries are still here; try again.");
    } finally { setBusy(false); }
  }

  return <section className="modifier-manager" aria-labelledby="modifier-manager-heading">
    <header><div><p className="eyebrow">Products</p><h2 id="modifier-manager-heading">Customer options</h2><p>Create the choices customers see when ordering, then attach them to products.</p></div><button className="secondary-button" type="button" onClick={onClose}>Back to products</button></header>
    {message ? <div className="product-notice" role="status" aria-live="polite">{message}</div> : null}
    <div className="modifier-manager-layout">
      <aside aria-label="Customer options">
        <button className="primary-button" disabled={busy} type="button" onClick={() => selectCustomization(null)}>Create customization</button>
        {groups.length ? <div className="modifier-group-list">{groups.map((item) => <button className={selectedBackendId === item.backendId ? "is-selected" : ""} key={item.backendId} type="button" onClick={() => selectCustomization(item)}><strong>{item.name}</strong><span>{customerRuleSummary(item)}</span><small>{item.options.filter((value) => value.active).length} available choices · Used on {item.assignmentCount} products{item.active ? "" : " · Unavailable"}</small></button>)}</div> : <div className="modifier-empty"><h3>No customer options yet</h3><p>Start with one customization, add the choices you offer, then attach it to a product.</p><ol><li>Name it, such as Milk.</li><li>Add choices and any extra prices.</li><li>Save, then return to a product.</li></ol></div>}
      </aside>
      <div className="modifier-editor">
        <form onSubmit={submit} aria-busy={busy}>
          <div className="customization-form-heading"><div><p className="eyebrow">{editing ? "Edit customization" : "New customization"}</p><h3>{editing ? draft.name : "Create customization"}</h3></div><label className="modifier-enabled"><input checked={draft.active} type="checkbox" onChange={(event) => updateDraft("active", event.target.checked)} /><span><strong>Available to customers</strong><small>Turn off to hide it while keeping product assignments and past order details.</small></span></label></div>
          <label><span>Name</span><input placeholder="For example, Milk" required value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} /></label>
          <fieldset className="customization-rules"><legend>Customers can</legend><div className="choice-card-row"><label className={draft.selectionType === "single" ? "is-selected" : ""}><input checked={draft.selectionType === "single"} name="selection-type" type="radio" onChange={() => updateDraft("selectionType", "single")} /><span><strong>Choose one</strong><small>Best for milk, bread, or another single choice.</small></span></label><label className={draft.selectionType === "multiple" ? "is-selected" : ""}><input checked={draft.selectionType === "multiple"} name="selection-type" type="radio" onChange={() => updateDraft("selectionType", "multiple")} /><span><strong>Choose more than one</strong><small>Best for add-ons customers can combine.</small></span></label></div></fieldset>
          {draft.selectionType === "single" ? <fieldset className="customization-rules"><legend>Is a choice required?</legend><div className="choice-card-row"><label className={!draft.required ? "is-selected" : ""}><input checked={!draft.required} name="requirement" type="radio" onChange={() => updateDraft("required", false)} /><span><strong>Can skip this</strong><small>The customer may order without choosing.</small></span></label><label className={draft.required ? "is-selected" : ""}><input checked={draft.required} name="requirement" type="radio" onChange={() => updateDraft("required", true)} /><span><strong>Must choose one</strong><small>The customer must pick before adding to Cart.</small></span></label></div></fieldset> : <div className="customization-limits"><p><strong>Choice limits</strong><br /><small>Set only what this customization needs.</small></p><label><span>Minimum choices</span><input min="0" type="number" value={draft.minSelections} onChange={(event) => updateDraft("minSelections", Number(event.target.value))} /></label><label><span>Maximum choices <small>(0 means no limit)</small></span><input min="0" type="number" value={draft.maxSelections} onChange={(event) => updateDraft("maxSelections", Number(event.target.value))} /></label></div>}
          <section className="customization-choices" aria-labelledby="customization-choices-heading"><div><h4 id="customization-choices-heading">Choices</h4><p>Enter the choices customers will see and any extra charge.</p></div><div className="customization-choice-list">{draft.choices.map((choice, index) => <div className={`customization-choice-row${choice.active ? "" : " is-unavailable"}`} key={choice.draftId}><label><span>Choice name</span><input placeholder="For example, Oat milk" value={choice.name} onChange={(event) => updateChoice(choice.draftId, "name", event.target.value)} /></label><label><span>Extra price</span><span className="money-input"><b>$</b><input inputMode="decimal" min="0" placeholder="0.00" value={choice.price} onChange={(event) => updateChoice(choice.draftId, "price", event.target.value)} /></span></label><div className="choice-row-actions"><button aria-label={`Move ${choice.name || "choice"} up`} className="secondary-button" disabled={index === 0 || busy} type="button" onClick={() => moveChoice(index, -1)}>Move up</button><button aria-label={`Move ${choice.name || "choice"} down`} className="secondary-button" disabled={index === draft.choices.length - 1 || busy} type="button" onClick={() => moveChoice(index, 1)}>Move down</button>{choice.backendId ? <button className="secondary-button" disabled={busy} type="button" onClick={() => updateChoice(choice.draftId, "active", !choice.active)}>{choice.active ? "Make unavailable" : "Make available"}</button> : <button className="secondary-button" disabled={busy} type="button" onClick={() => removeChoice(choice)}>Remove</button>}</div>{!choice.active ? <small className="choice-status">Unavailable to customers; retained for existing products and order history.</small> : null}</div>)}</div><button className="secondary-button add-choice-button" disabled={busy} type="button" onClick={() => setDraft((current) => ({ ...current, choices: [...current.choices, choiceDraft()] }))}>+ Add choice</button></section>
          <details className="customization-note"><summary>Add a customer-facing note (optional)</summary><label><span>Note</span><textarea rows="2" value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} /></label></details>
          <div className="customization-save-bar"><p>{editing ? "Save changes to this customization and its choices." : "One save creates this customization and its starting choices."}</p><button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : editing ? "Save changes" : "Save customization"}</button></div>
        </form>
      </div>
    </div>
  </section>;
}
