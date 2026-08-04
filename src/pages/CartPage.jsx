import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, Minus, Plus, Trash2, UserRound } from "lucide-react";
import { resolveCart } from "../services/cartCatalog.js";
import {
  buildPendingOrderRequest,
  canonicalizeCheckoutContact,
  clearOrderSubmission,
  createSubmissionGate,
  getOrderErrorMessage,
  prepareOrderSubmission,
  isCheckoutContactComplete,
  resolvePickupTimestamp,
} from "../services/checkoutOrder.js";
import { createPendingOrder } from "../services/orderApi.js";
import { createCloverCheckout } from "../services/cloverService.js";
import { useCustomerCatalog } from "../stores/customerCatalogStore.js";
import { useCustomerAuth } from "../auth/CustomerAuthContext.jsx";
import { fetchCustomerProfile } from "../services/customerAccountApi.js";
import { formatCustomerPhone } from "../services/customerPhone.js";
import { formatTaxLabel, getOrderPricing } from "../services/orderPricing.js";

const quickPickupOptions = [
  {
    value: "asap",
    label: "ASAP",
    minutes: 15,
  },
  {
    value: "10",
    label: "10 min",
    minutes: 10,
  },
  {
    value: "20",
    label: "20 min",
    minutes: 20,
  },
  {
    value: "30",
    label: "30 min",
    minutes: 30,
  },
  {
    value: "60",
    label: "1 hour",
    minutes: 60,
  },
];

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

function getStoredCart() {
  try {
    return JSON.parse(window.localStorage.getItem("cafe-cart")) || [];
  } catch {
    return [];
  }
}

function storeCart(cart) {
  window.localStorage.setItem("cafe-cart", JSON.stringify(cart));
}

function getStoredPickupTime() {
  try {
    const storedPickupTime = window.localStorage.getItem("guesthouse-pickup-time");
    const isSupportedPickupTime =
      storedPickupTime === "custom" ||
      quickPickupOptions.some((option) => option.value === storedPickupTime);

    return isSupportedPickupTime ? storedPickupTime : quickPickupOptions[0].value;
  } catch {
    return quickPickupOptions[0].value;
  }
}

function storePickupTime(value) {
  window.localStorage.setItem("guesthouse-pickup-time", value);
}

function getRoundedPickupTime(addMinutes = 20) {
  const nextTime = new Date(Date.now() + addMinutes * 60 * 1000);
  const roundedMinutes = Math.ceil(nextTime.getMinutes() / 5) * 5;
  nextTime.setMinutes(roundedMinutes, 0, 0);

  return `${String(nextTime.getHours()).padStart(2, "0")}:${String(
    nextTime.getMinutes()
  ).padStart(2, "0")}`;
}

function getStoredCustomPickupTime() {
  try {
    return window.localStorage.getItem("guesthouse-custom-pickup-time") || getRoundedPickupTime();
  } catch {
    return getRoundedPickupTime();
  }
}

function storeCustomPickupTime(value) {
  window.localStorage.setItem("guesthouse-custom-pickup-time", value);
}

function formatReadyTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getCustomPickupDate(timeValue) {
  const [hours, minutes] = timeValue.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return getCustomPickupDate(getRoundedPickupTime());
  }

  const readyTime = new Date();
  readyTime.setHours(hours || 0, minutes || 0, 0, 0);

  return readyTime;
}

function getLocalDateKey(value = new Date()) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function CartPage() {
  const { session } = useCustomerAuth();
  const { status, catalog, reload } = useCustomerCatalog();
  const [cart, setCart] = useState(getStoredCart);
  const [pickupTime, setPickupTime] = useState(getStoredPickupTime);
  const [customPickupTime, setCustomPickupTime] = useState(getStoredCustomPickupTime);
  const [checkoutContact, setCheckoutContact] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const checkoutContactRef = useRef(checkoutContact);
  const [orderNotes, setOrderNotes] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const submissionGate = useRef(createSubmissionGate());
  useEffect(() => {
    if (!session) return;
    fetchCustomerProfile().then((profile) => {
      const contact = { name: profile.name, email: profile.email, phone: formatCustomerPhone(profile.phone) };
      checkoutContactRef.current = contact;
      setCheckoutContact(contact);
      const preferredOption = quickPickupOptions.find((option) => option.minutes === profile.preferred_pickup_minutes);
      if (preferredOption) updatePickupTime(preferredOption.value);
      if (profile.preferred_pickup_notes) setOrderNotes(profile.preferred_pickup_notes);
    }).catch(() => {});
  }, [session]);
  const resolvedCart = useMemo(
    () => resolveCart(catalog, cart),
    [catalog, cart]
  );
  const orderPricing = useMemo(
    () => getOrderPricing(resolvedCart.totalCents, catalog.pricing),
    [catalog.pricing, resolvedCart.totalCents]
  );
  const canPlaceOrder = isCheckoutContactComplete(checkoutContact);
  const selectedQuickPickupTime =
    quickPickupOptions.find((option) => option.value === pickupTime) || quickPickupOptions[0];
  const pickupSummary = useMemo(() => {
    if (pickupTime === "custom") {
      return `Ready around ${formatReadyTime(getCustomPickupDate(customPickupTime))}`;
    }

    const readyTime = new Date(Date.now() + selectedQuickPickupTime.minutes * 60 * 1000);
    return `Ready around ${formatReadyTime(readyTime)}`;
  }, [customPickupTime, pickupTime, selectedQuickPickupTime]);

  function updateQuantity(itemId, nextQuantity) {
    if (submissionGate.current.isInFlight()) {
      return;
    }
    const nextCart =
      nextQuantity <= 0
        ? cart.filter((item) => item.id !== itemId)
        : cart.map((item) => (item.id === itemId ? { ...item, quantity: nextQuantity } : item));

    setCart(nextCart);
    storeCart(nextCart);
    if (!nextCart.length) {
      clearOrderSubmission();
    }
  }

  function updatePickupTime(value) {
    if (submissionGate.current.isInFlight()) {
      return;
    }
    setPickupTime(value);
    storePickupTime(value);
  }

  function updateCustomPickupTime(value) {
    if (!value || submissionGate.current.isInFlight()) return;

    setCustomPickupTime(value);
    storeCustomPickupTime(value);
    updatePickupTime("custom");
  }

  function updateCheckoutContact(field, value) {
    if (submissionGate.current.isInFlight()) {
      return;
    }
    const nextContact = { ...checkoutContactRef.current, [field]: value };
    checkoutContactRef.current = nextContact;
    setCheckoutContact(nextContact);
  }

  function updateOrderNotes(value) {
    if (submissionGate.current.isInFlight()) {
      return;
    }
    setOrderNotes(value);
  }

  async function placeOrder() {
    if (!submissionGate.current.begin()) {
      return;
    }
    const canonicalContact = canonicalizeCheckoutContact(checkoutContactRef.current);
    if (!isCheckoutContactComplete(canonicalContact)) {
      setCheckoutError(
        "Add a name, email, and phone number before placing your order."
      );
      submissionGate.current.end();
      return;
    }

    setIsPlacingOrder(true);
    setCheckoutError("");

    try {
      const requestedPickupAt = resolvePickupTimestamp({
        pickupTime,
        customPickupTime,
        quickPickupMinutes: selectedQuickPickupTime.minutes,
      });
      const request = buildPendingOrderRequest({
        contact: canonicalContact,
        idempotencyKey: "",
        lines: resolvedCart.lines,
        notes: orderNotes,
        requestedPickupAt,
      });
      const submission = await prepareOrderSubmission(request, {
        fingerprintPayload: {
          ...request,
          requested_pickup_at: {
            business_date: getLocalDateKey(),
            custom_time:
              pickupTime === "custom" ? customPickupTime : null,
            selection: pickupTime,
          },
        },
      });
      const order = await createPendingOrder(submission);
      const checkout = await createCloverCheckout(order.public_token);

      window.location.assign(checkout.checkout_url);
    } catch (error) {
      setCheckoutError(getOrderErrorMessage(error));
    } finally {
      submissionGate.current.end();
      setIsPlacingOrder(false);
    }
  }

  if (!cart.length) {
    return (
      <section className="page-section compact-section ordering-page">
        <div className="empty-state">
          <h1>Your cart is empty</h1>
          <p>Add coffee, tea, pastries, or a little flavour shot when you are ready.</p>
          <Link className="primary-button" to="/menu">
            Browse menu
          </Link>
        </div>
      </section>
    );
  }

  if (status === "idle" || status === "loading") {
    return (
      <section className="page-section compact-section ordering-page">
        <div className="empty-state" role="status" aria-live="polite">
          <h1>Checking your café bag</h1>
          <p>Confirming today’s menu and your customizations.</p>
        </div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="page-section compact-section ordering-page">
        <div className="empty-state" role="alert">
          <h1>We couldn’t check your café bag</h1>
          <p>Please check your connection and try again.</p>
          <button className="primary-button" type="button" onClick={reload}>
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section ordering-page cart-page">
      <div className="page-heading cart-heading">
        <h1>Your order</h1>
        <p>Review your café picks before placing your order.</p>
      </div>

      <div className="content-block cart-review app-cart-review">
        <ul>
          {resolvedCart.lines.map((item) => (
            <li key={item.id}>
              <div className="cart-item-copy">
                <strong>{item.name}</strong>
                {item.options?.length ? (
                  <small>
                    {item.options.map((option) => `${option.groupName}: ${option.name}`).join(", ")}
                  </small>
                ) : null}
                <span>
                  {item.quantity} x {formatPrice(item.price)}
                </span>
                {item.resolution !== "ready" ? (
                  <small role="alert">
                    {item.issues.join(" ")} Remove it or add a current version from the menu.
                  </small>
                ) : null}
              </div>
              <div className="cart-line-actions">
                <strong>
                  {item.resolution === "ready"
                    ? formatPrice(item.price * item.quantity)
                    : "Unavailable"}
                </strong>
                {item.resolution === "ready" ? (
                  <div className="quantity-stepper" aria-label={`Quantity for ${item.name}`}>
                    <button
                      disabled={isPlacingOrder}
                      type="button"
                      aria-label={`Remove one ${item.name}`}
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus size={16} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      disabled={isPlacingOrder}
                      type="button"
                      aria-label={`Add one ${item.name}`}
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                ) : null}
                <button
                  className="remove-cart-item"
                  disabled={isPlacingOrder}
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => updateQuantity(item.id, 0)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="pickup-timing-panel">
          <div className="pickup-timing-heading">
            <div>
              <span>Preferred pickup time</span>
              <h2>When should we have it ready?</h2>
            </div>
            <strong>{pickupSummary}</strong>
          </div>
          <div className="pickup-time-options" role="radiogroup" aria-label="Quick pickup timing">
            {quickPickupOptions.map((option) => (
              <label key={option.value} className={option.value === pickupTime ? "selected" : ""}>
                <input
                  checked={option.value === pickupTime}
                  disabled={isPlacingOrder}
                  name="pickup-time"
                  type="radio"
                  value={option.value}
                  onChange={() => updatePickupTime(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className={`custom-pickup-time${pickupTime === "custom" ? " selected" : ""}`}>
            <label htmlFor="custom-pickup-time">Ready around...</label>
            <input
              id="custom-pickup-time"
              disabled={isPlacingOrder}
              min="06:00"
              required
              step="300"
              type="time"
              value={customPickupTime}
              onChange={(event) => updateCustomPickupTime(event.target.value)}
              onFocus={() => updatePickupTime("custom")}
            />
          </div>
        </div>
        <div className="cart-summary-detail">
          <span>Preferred pickup time</span>
          <strong>{pickupSummary}</strong>
        </div>
        <div className="checkout-contact-panel">
          <div className="checkout-contact-heading">
            <span className="account-avatar" aria-hidden="true">
              <UserRound size={20} strokeWidth={2.4} />
            </span>
            <div>
              <span>Checkout contact</span>
              <h2>How should we contact you?</h2>
            </div>
          </div>
          {!session ? <div className="form-actions"><span>Continue as Guest</span><Link className="secondary-button" to="/login">Sign In</Link></div> : null}
          <div className="checkout-contact-grid">
            <label>
              <span>Name</span>
              <input
                autoComplete="name"
                disabled={isPlacingOrder}
                required
                value={checkoutContact.name}
                onChange={(event) =>
                  updateCheckoutContact("name", event.target.value)
                }
              />
            </label>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                disabled={isPlacingOrder}
                required
                type="email"
                value={checkoutContact.email}
                onChange={(event) =>
                  updateCheckoutContact("email", event.target.value)
                }
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                autoComplete="tel"
                disabled={isPlacingOrder}
                required
                type="tel"
                value={checkoutContact.phone}
                onChange={(event) =>
                  updateCheckoutContact("phone", formatCustomerPhone(event.target.value))
                }
                inputMode="numeric"
                pattern="\(\d{3}\) \d{3}-\d{4}"
                placeholder="(519) 881-6869"
              />
            </label>
          </div>
        </div>
        <label className="order-notes-field">
          <span>Order notes</span>
          <textarea
            maxLength={2000}
            disabled={isPlacingOrder}
            placeholder="Milk preference, pastry warming, or pickup notes"
            rows={3}
            value={orderNotes}
            onChange={(event) => updateOrderNotes(event.target.value)}
          />
        </label>
        <div className="cart-total-row cart-pricing-breakdown">
          <span>Subtotal</span>
          <strong>{formatPrice(orderPricing.subtotalCents / 100)}</strong>
          <span>{formatTaxLabel(catalog.pricing)}</span>
          <strong>{formatPrice(orderPricing.taxCents / 100)}</strong>
          <span>Estimated Total</span>
          <strong>{formatPrice(orderPricing.totalCents / 100)}</strong>
        </div>
        {checkoutError ? (
          <p className="form-status checkout-error" role="alert">
            {checkoutError}
          </p>
        ) : null}
        {resolvedCart.hasStaleLines ? (
          <Link className="primary-button" to="/menu">
            Update order
          </Link>
        ) : (
          <button
            className="primary-button"
            disabled={isPlacingOrder || !canPlaceOrder}
            type="button"
            onClick={placeOrder}
          >
            <ClipboardList size={17} strokeWidth={2.4} />
            {isPlacingOrder ? "Placing order…" : "Place order"}
          </button>
        )}
      </div>
    </section>
  );
}
