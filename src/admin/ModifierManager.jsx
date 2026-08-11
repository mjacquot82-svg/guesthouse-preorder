import { useState } from "react";
import { dollarsToCents } from "../services/modifierMoney.js";

const emptyGroup = {
  name: "", description: "", selectionType: "single", required: false,
  minSelections: 0, maxSelections: 1, active: true, sortOrder: 0,
};
const emptyOption = { name: "", price: "0.00", active: true, sortOrder: 0 };

function groupDraft(group) {
  return group ? { ...group } : { ...emptyGroup };
}

function optionDraft(option) {
  return option ? {
    ...option, price: (option.priceAdjustmentCents / 100).toFixed(2),
  } : { ...emptyOption };
}

function choiceSummary(group) {
  const selection = group.selectionType === "single" ? "Choose one" : group.maxSelections ? `Choose up to ${group.maxSelections}` : "Choose multiple";
  return `${group.required ? "Required" : "Optional"} · ${selection}`;
}

export default function ModifierManager({ groups, onClose, onSaveGroup, onSaveOption }) {
  const [selectedId, setSelectedId] = useState("");
  const [group, setGroup] = useState(groupDraft());
  const [option, setOption] = useState(optionDraft());
  const [editingOptionId, setEditingOptionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = groups.find((item) => item.id === selectedId);

  function selectGroup(item) {
    setSelectedId(item?.id || "");
    setGroup(groupDraft(item));
    setEditingOptionId("");
    setOption(optionDraft());
    setMessage("");
  }

  function updateGroup(field, value) {
    setGroup((current) => {
      const next = { ...current, [field]: value };
      if (field === "selectionType" && value === "single") next.maxSelections = 1;
      if (field === "required") next.minSelections = value ? Math.max(1, Number(next.minSelections)) : 0;
      return next;
    });
  }

  async function submitGroup(event) {
    event.preventDefault();
    if (!group.name.trim()) return setMessage("Group name is required.");
    if (Number(group.maxSelections) && Number(group.maxSelections) < Number(group.minSelections)) return setMessage("Maximum selections cannot be less than minimum selections.");
    setBusy(true); setMessage("");
    try {
      await onSaveGroup({ ...group, backendId: selected?.backendId });
      setMessage(`${group.name.trim()} saved.`);
      if (!selected) selectGroup(null);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function submitOption(event) {
    event.preventDefault();
    const cents = dollarsToCents(option.price);
    if (!option.name.trim()) return setMessage("Option name is required.");
    if (cents === null) return setMessage("Price adjustment is invalid. Use dollars and cents, such as 0.75.");
    setBusy(true); setMessage("");
    try {
      await onSaveOption(selected.id, { ...option, backendId: editingOptionId || undefined, priceAdjustmentCents: cents });
      setMessage(`${option.name.trim()} saved.`);
      setEditingOptionId(""); setOption(optionDraft());
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return <section className="modifier-manager" aria-labelledby="modifier-manager-heading">
    <header><div><p className="eyebrow">Products</p><h2 id="modifier-manager-heading">Modifier groups</h2><p>Modifier groups let customers customize products when ordering, such as milk choices or flavour shots.</p></div><button className="secondary-button" type="button" onClick={onClose}>Back to products</button></header>
    {message ? <div className="product-notice" role="status" aria-live="polite">{message}</div> : null}
    <div className="modifier-manager-layout">
      <aside aria-label="Modifier groups">
        <button className="primary-button" type="button" onClick={() => selectGroup(null)}>Create modifier group</button>
        {groups.length ? <div className="modifier-group-list">{groups.map((item) => <button className={selectedId === item.id ? "is-selected" : ""} key={item.backendId} type="button" onClick={() => selectGroup(item)}><strong>{item.name}</strong><span>{choiceSummary(item)}</span><small>{item.options.filter((value) => value.active).length} enabled options · {item.assignmentCount} products{item.active ? "" : " · Disabled"}</small></button>)}</div> : <div className="modifier-empty"><h3>No modifier groups yet</h3><p>Create a modifier group to add customer customization options.</p></div>}
      </aside>
      <div className="modifier-editor">
        <form onSubmit={submitGroup} aria-busy={busy}>
          <h3>{selected ? `Edit ${selected.name}` : "Create a modifier group"}</h3>
          <label><span>Customer-facing name</span><input required value={group.name} onChange={(event) => updateGroup("name", event.target.value)} /></label>
          <label><span>Description <small>(optional)</small></span><textarea rows="2" value={group.description} onChange={(event) => updateGroup("description", event.target.value)} /></label>
          <div className="form-grid"><label><span>Selection</span><select value={group.selectionType} onChange={(event) => updateGroup("selectionType", event.target.value)}><option value="single">Choose one</option><option value="multiple">Choose multiple</option></select></label><label><span>Requirement</span><select value={group.required ? "required" : "optional"} onChange={(event) => updateGroup("required", event.target.value === "required")}><option value="optional">Optional</option><option value="required">Required</option></select></label></div>
          {group.selectionType === "multiple" ? <div className="form-grid"><label><span>Minimum selections</span><input disabled={!group.required} min="0" type="number" value={group.minSelections} onChange={(event) => updateGroup("minSelections", Number(event.target.value))} /></label><label><span>Maximum selections <small>(0 means no limit)</small></span><input min="0" type="number" value={group.maxSelections} onChange={(event) => updateGroup("maxSelections", Number(event.target.value))} /></label></div> : null}
          <div className="form-grid"><label><span>Display order</span><input min="0" type="number" value={group.sortOrder} onChange={(event) => updateGroup("sortOrder", Number(event.target.value))} /></label><label className="modifier-enabled"><input checked={group.active} type="checkbox" onChange={(event) => updateGroup("active", event.target.checked)} /><span>Enabled for customer ordering</span></label></div>
          <p className="field-help">Disabling keeps assignments and past order details, but hides this group from customers.</p>
          <button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : "Save group"}</button>
        </form>
        {selected ? <section className="modifier-options-editor"><h3>Options</h3>{selected.options.length ? <div className="modifier-option-list">{selected.options.map((item) => <button key={item.backendId} type="button" onClick={() => { setEditingOptionId(item.backendId); setOption(optionDraft(item)); setMessage(""); }}><span><strong>{item.name}</strong><small>{item.active ? "Enabled" : "Disabled"}</small></span><b>{item.priceAdjustmentCents ? `+$${(item.priceAdjustmentCents / 100).toFixed(2)}` : "No extra charge"}</b></button>)}</div> : <p>No options yet. Add the choices customers can select.</p>}
          <form onSubmit={submitOption} aria-busy={busy}><h4>{editingOptionId ? "Edit option" : "Add option"}</h4><div className="form-grid"><label><span>Option name</span><input required value={option.name} onChange={(event) => setOption((current) => ({ ...current, name: event.target.value }))} /></label><label><span>Extra price (CAD)</span><input inputMode="decimal" min="0" placeholder="0.00" value={option.price} onChange={(event) => setOption((current) => ({ ...current, price: event.target.value }))} /></label></div><div className="form-grid"><label><span>Display order</span><input min="0" type="number" value={option.sortOrder} onChange={(event) => setOption((current) => ({ ...current, sortOrder: Number(event.target.value) }))} /></label><label className="modifier-enabled"><input checked={option.active} type="checkbox" onChange={(event) => setOption((current) => ({ ...current, active: event.target.checked }))} /><span>Enabled</span></label></div><div className="form-actions"><button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : editingOptionId ? "Save option" : "Add option"}</button>{editingOptionId ? <button className="secondary-button" type="button" onClick={() => { setEditingOptionId(""); setOption(optionDraft()); }}>Cancel</button> : null}</div></form>
        </section> : <div className="modifier-guidance"><h3>Add options after saving</h3><p>Save this group first, then add its customer choices and prices.</p></div>}
      </div>
    </div>
  </section>;
}
