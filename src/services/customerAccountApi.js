const CUSTOMER_PATH = "/api/v1/customer";

async function request(path, { body, csrfToken, method = "GET", fetchImpl = globalThis.fetch, apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || "" } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  const response = await fetchImpl(`${apiBaseUrl.replace(/\/+$/, "")}${CUSTOMER_PATH}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body), credentials: "include", headers, method,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.detail?.message || payload?.detail || "Customer account request failed.");
  return payload;
}

export const fetchCustomerProfile = (options = {}) => request("/profile", options);
export const updateCustomerProfile = (profile, csrfToken, options = {}) => request("/profile", { ...options, body: profile, csrfToken, method: "PUT" });
export const fetchCustomerOrders = (options = {}) => request("/orders", options);
export const fetchCustomerOrder = (orderId, options = {}) => request(`/orders/${encodeURIComponent(orderId)}`, options);
