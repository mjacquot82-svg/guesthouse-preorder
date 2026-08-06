const PATH = "/api/v1/owner/communications";

export class OwnerCommunicationsError extends Error {
  constructor(message, { cause, code, status } = {}) {
    super(message, { cause });
    this.name = "OwnerCommunicationsError";
    this.code = code;
    this.status = status;
  }
}

export async function fetchOwnerCommunications({
  apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || "",
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  let response;
  try {
    response = await fetchImpl(`${apiBaseUrl.replace(/\/+$/, "")}${PATH}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (cause) {
    throw new OwnerCommunicationsError("Unable to reach communications.", { cause });
  }
  let payload;
  try { payload = await response.json(); } catch (cause) {
    throw new OwnerCommunicationsError("Communications returned an invalid response.", { cause, status: response.status });
  }
  if (!response.ok) {
    throw new OwnerCommunicationsError(payload?.detail?.message || "Communication status could not be loaded.", {
      code: payload?.detail?.code,
      status: response.status,
    });
  }
  return payload;
}
