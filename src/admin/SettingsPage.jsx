import { useEffect, useState } from "react";
import { verifySupabaseConnection } from "../lib/supabase.js";
import { useAdminSettings } from "../stores/adminSettingsStore.js";

export default function SettingsPage() {
  const { settings, saveSettings } = useAdminSettings();
  const [formSettings, setFormSettings] = useState(settings);
  const [status, setStatus] = useState("");
  const [supabaseStatus, setSupabaseStatus] = useState({
    connected: false,
    checked: false,
  });

  useEffect(() => {
    let isMounted = true;

    verifySupabaseConnection().then((result) => {
      if (isMounted) {
        setSupabaseStatus({ connected: result.connected, checked: true });
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

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

      <section className="admin-panel admin-settings-panel" aria-labelledby="supabase-diagnostic-heading">
        <div className="admin-diagnostic-heading">
          <div>
            <p className="eyebrow">Temporary diagnostic</p>
            <h2 id="supabase-diagnostic-heading">Supabase connection</h2>
          </div>
          <span
            className={`connection-status ${supabaseStatus.connected ? "connected" : "not-connected"}`}
          >
            {supabaseStatus.connected ? "Supabase Connected" : "Supabase Not Connected"}
          </span>
        </div>
        <p className="admin-diagnostic-note">
          {supabaseStatus.checked
            ? "This check verifies the configured Supabase URL and anon key only."
            : "Checking configured Supabase client..."}
        </p>
      </section>
    </section>
  );
}
