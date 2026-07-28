import { OrderApiError } from "./orderApi.js";

const PICKUP_INTERVAL_MINUTES = 5;
const PENDING_ORDER_SUBMISSION_KEY = "guesthouse-pending-order-submission";

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function freezeRecursively(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(freezeRecursively);
  return Object.freeze(value);
}

async function hashPayload(payload, cryptoImpl) {
  const { idempotency_key: _, ...submission } = payload;
  const canonicalPayload = JSON.stringify(canonicalize(submission));
  const digest = await cryptoImpl.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalPayload)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function requireBackendId(value, field) {
  const numericValue = Number(value);
  if (!Number.isSafeInteger(numericValue) || numericValue <= 0) {
    throw new Error(`${field} is unavailable.`);
  }
  return numericValue;
}

function roundPickupForward(value) {
  const intervalMilliseconds = PICKUP_INTERVAL_MINUTES * 60 * 1000;
  return new Date(
    Math.ceil(value.getTime() / intervalMilliseconds) * intervalMilliseconds
  );
}

export function resolvePickupTimestamp({
  pickupTime,
  customPickupTime,
  quickPickupMinutes,
  now = new Date(),
}) {
  if (pickupTime !== "custom") {
    return roundPickupForward(
      new Date(now.getTime() + quickPickupMinutes * 60 * 1000)
    ).toISOString();
  }

  const [hours, minutes] = customPickupTime.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error("Choose a valid pickup time.");
  }

  const pickup = new Date(now);
  pickup.setHours(hours, minutes, 0, 0);
  return pickup.toISOString();
}

export function buildPendingOrderRequest({
  contact,
  idempotencyKey,
  lines,
  notes,
  requestedPickupAt,
}) {
  return {
    idempotency_key: idempotencyKey,
    customer: {
      name: contact.name.trim(),
      email: contact.email.trim(),
      phone: contact.phone.trim(),
    },
    requested_pickup_at: requestedPickupAt,
    notes: notes.trim() || null,
    lines: lines.map((line) => {
      const variant = line.options.find((option) => option.variantId);
      return {
        product_id: requireBackendId(
          line.productBackendId,
          `${line.name} product`
        ),
        variant_id: variant
          ? requireBackendId(variant.variantId, `${line.name} variant`)
          : null,
        modifier_option_ids: line.options
          .filter((option) => !option.variantId)
          .map((option) =>
            requireBackendId(option.backendId, `${line.name} modifier`)
          ),
        quantity: line.quantity,
      };
    }),
  };
}

export function createSubmissionGate() {
  let inFlight = false;

  return {
    begin() {
      if (inFlight) {
        return false;
      }
      inFlight = true;
      return true;
    },
    end() {
      inFlight = false;
    },
    isInFlight() {
      return inFlight;
    },
  };
}

export async function prepareOrderSubmission(
  payload,
  {
    cryptoImpl = globalThis.crypto,
    fingerprintPayload = payload,
    storage = globalThis.sessionStorage,
  } = {}
) {
  if (
    !cryptoImpl?.subtle ||
    typeof cryptoImpl.randomUUID !== "function" ||
    !storage
  ) {
    throw new Error("Secure order submission is unavailable.");
  }

  const fingerprint = await hashPayload(
    fingerprintPayload,
    cryptoImpl
  );
  let storedSubmission;
  try {
    storedSubmission = JSON.parse(
      storage.getItem(PENDING_ORDER_SUBMISSION_KEY)
    );
  } catch {
    storedSubmission = null;
  }

  const idempotencyKey =
    storedSubmission?.fingerprint === fingerprint &&
    typeof storedSubmission.idempotencyKey === "string"
      ? storedSubmission.idempotencyKey
      : cryptoImpl.randomUUID();
  const requestedPickupAt =
    storedSubmission?.fingerprint === fingerprint &&
    typeof storedSubmission.requestedPickupAt === "string"
      ? storedSubmission.requestedPickupAt
      : payload.requested_pickup_at;

  storage.setItem(
    PENDING_ORDER_SUBMISSION_KEY,
    JSON.stringify({
      fingerprint,
      idempotencyKey,
      requestedPickupAt,
    })
  );

  const submission = JSON.parse(JSON.stringify(payload));
  submission.idempotency_key = idempotencyKey;
  submission.requested_pickup_at = requestedPickupAt;
  return freezeRecursively(submission);
}

export function clearOrderSubmission(
  storage = globalThis.sessionStorage,
) {
  storage?.removeItem(PENDING_ORDER_SUBMISSION_KEY);
}

export function getOrderErrorMessage(error) {
  if (!(error instanceof OrderApiError)) {
    return "We couldn’t place your order. Please check your connection and try again.";
  }

  switch (error.code) {
    case "request_validation_error":
      return "Please check your name, email, phone number, and order details.";
    case "pickup_invalid":
      return error.message;
    case "product_not_sellable":
      return "An item is no longer available. Please review your order.";
    case "variant_required":
    case "variant_invalid":
    case "modifier_option_invalid":
    case "modifier_selection_invalid":
      return "An item customization has changed. Please update your order.";
    case "idempotency_conflict":
      return "This order was already submitted with different details. Please refresh and try again.";
    default:
      return "We couldn’t place your order. Please check your connection and try again.";
  }
}
