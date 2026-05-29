import { useState } from "react";
import { useAdminSettings } from "../stores/adminSettingsStore.js";

export default function SettingsPage() {
  const { settings, saveSettings } = useAdminSettings();
  const [formSettings, setFormSettings] = useState(settings);
  const [status, setStatus] = useState("");

  function updateField(field, value) {
    setFormSettings((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    saveSettings(formSettings);
    setStatus("Settings saved locally.");
  }

  return (
    <section className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">Future configuration</p>
          <h1>Settings</h1>
          <p>Placeholder business settings for later storefront and order messaging.</p>
        </div>
      </div>

      <section className="admin-panel admin-settings-panel" aria-labelledby="settings-heading">
        <h2 id="settings-heading">Business settings</h2>
        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            <span>Business Name</span>
            <input
              type="text"
              value={formSettings.businessName}
              onChange={(event) => updateField("businessName", event.target.value)}
            />
          </label>

          <label>
            <span>Logo</span>
            <input
              type="text"
              value={formSettings.logo}
              onChange={(event) => updateField("logo", event.target.value)}
              placeholder="Logo URL or asset key"
            />
          </label>

          <label>
            <span>Store Hours</span>
            <textarea
              rows="4"
              value={formSettings.storeHours}
              onChange={(event) => updateField("storeHours", event.target.value)}
            />
          </label>

          <label>
            <span>Pickup Instructions</span>
            <textarea
              rows="4"
              value={formSettings.pickupInstructions}
              onChange={(event) => updateField("pickupInstructions", event.target.value)}
            />
          </label>

          <div className="admin-form-actions">
            <button className="primary-button" type="submit">
              Save settings
            </button>
          </div>
          {status ? <p className="form-status">{status}</p> : null}
        </form>
      </section>
    </section>
  );
}
