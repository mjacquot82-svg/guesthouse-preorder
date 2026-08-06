const OWNER_CATALOG_PATH = "/api/v1/owner/catalog";

export class OwnerCatalogError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "OwnerCatalogError";
    this.status = status;
  }
}

async function request(path = "", {
  apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || "",
  body,
  csrfToken,
  fetchImpl = globalThis.fetch,
  method = "GET",
} = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  let response;
  try {
    response = await fetchImpl(
      `${apiBaseUrl.replace(/\/+$/, "")}${OWNER_CATALOG_PATH}${path}`,
      {
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
        headers,
        method,
      }
    );
  } catch (cause) {
    throw new OwnerCatalogError("Unable to reach the production catalog.", { cause });
  }
  if (response.status === 204) return null;
  let payload = null;
  try { payload = await response.json(); } catch { /* normalized below */ }
  if (!response.ok) {
    const detail = payload?.detail;
    throw new OwnerCatalogError(
      (typeof detail === "object" ? detail?.message : detail) || "Catalog update failed.",
      { status: response.status }
    );
  }
  return payload;
}

export function fetchOwnerCatalog(options = {}) {
  return request("", options);
}

export function createOwnerProduct(product, csrfToken, options = {}) {
  return request("/products", { ...options, body: product, csrfToken, method: "POST" });
}

export function updateOwnerProduct(productId, product, csrfToken, options = {}) {
  return request(`/products/${encodeURIComponent(productId)}`, {
    ...options, body: product, csrfToken, method: "PUT",
  });
}

export function archiveOwnerProduct(productId, csrfToken, options = {}) {
  return request(`/products/${encodeURIComponent(productId)}`, {
    ...options, csrfToken, method: "DELETE",
  });
}

export function updateOwnerProductAvailability(productId, available, csrfToken, options = {}) {
  return request(`/products/${encodeURIComponent(productId)}/availability`, {
    ...options, body: { available }, csrfToken, method: "PATCH",
  });
}
