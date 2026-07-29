const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || "";

function apiUrl(path, apiBaseUrl = API_BASE_URL) {
  return `${apiBaseUrl.replace(/\/+$/, "")}${path}`;
}

async function readResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(
      payload?.detail?.message || "Clover checkout is unavailable."
    );
  }
  return payload;
}

export async function createCloverCheckout(
  publicToken,
  { apiBaseUrl = API_BASE_URL, fetchImpl = globalThis.fetch } = {}
) {
  const response = await fetchImpl(
    apiUrl(
      `/api/v1/clover/orders/${encodeURIComponent(publicToken)}/checkout`,
      apiBaseUrl
    ),
    {
      headers: { Accept: "application/json" },
      method: "POST",
    }
  );
  const payload = await readResponse(response);
  if (
    typeof payload?.checkout_url !== "string" ||
    typeof payload?.checkout_session_id !== "string"
  ) {
    throw new Error("Clover returned an invalid checkout response.");
  }
  return payload;
}

export async function fetchCloverConnection({
  apiBaseUrl = API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const response = await fetchImpl(
    apiUrl("/api/v1/clover/connection", apiBaseUrl),
    { headers: { Accept: "application/json" } }
  );
  return readResponse(response);
}

export function getCloverConnectUrl(apiBaseUrl = API_BASE_URL) {
  return apiUrl("/api/v1/clover/oauth/start", apiBaseUrl);
}
