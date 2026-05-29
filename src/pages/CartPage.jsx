import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, UserRound } from "lucide-react";
import { useCustomerSession } from "../stores/customerAuthStore.js";

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

function getStoredCheckoutContact() {
  try {
    return (
      JSON.parse(window.localStorage.getItem("cedar-oak-checkout-contact")) || {
        name: "",
        email: "",
        phoneNumber: "",
      }
    );
  } catch {
    return {
      name: "",
      email: "",
      phoneNumber: "",
    };
  }
}

function storeCheckoutContact(contact) {
  window.localStorage.setItem("cedar-oak-checkout-contact", JSON.stringify(contact));
}

function getStoredPickupTime() {
  try {
    const storedPickupTime = window.localStorage.getItem("cedar-oak-pickup-time");
    const isSupportedPickupTime =
      storedPickupTime === "custom" ||
      quickPickupOptions.some((option) => option.value === storedPickupTime);

    return isSupportedPickupTime ? storedPickupTime : quickPickupOptions[0].value;
  } catch {
    return quickPickupOptions[0].value;
  }
}

function storePickupTime(value) {
  window.localStorage.setItem("cedar-oak-pickup-time", value);
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
    return window.localStorage.getItem("cedar-oak-custom-pickup-time") || getRoundedPickupTime();
  } catch {
    return getRoundedPickupTime();
  }
}

function storeCustomPickupTime(value) {
  window.localStorage.setItem("cedar-oak-custom-pickup-time", value);
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

export default function CartPage() {
  const { customer } = useCustomerSession();
  const [cart, setCart] = useState(getStoredCart);
  const [pickupTime, setPickupTime] = useState(getStoredPickupTime);
  const [customPickupTime, setCustomPickupTime] = useState(getStoredCustomPickupTime);
  const [checkoutContact, setCheckoutContact] = useState(getStoredCheckoutContact);
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const selectedQuickPickupTime =
    quickPickupOptions.find((option) => option.value === pickupTime) || quickPickupOptions[0];
  const pickupSummary = useMemo(() => {
    if (pickupTime === "custom") {
      return `Ready around ${formatReadyTime(getCustomPickupDate(customPickupTime))}`;
    }

    const readyTime = new Date(Date.now() + selectedQuickPickupTime.minutes * 60 * 1000);
    return `Ready around ${formatReadyTime(readyTime)}`;
  }, [customPickupTime, pickupTime, selectedQuickPickupTime]);
  const contactFields = customer
    ? {
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        email: customer.email,
        phoneNumber: customer.phoneNumber,
      }
    : checkoutContact;

  useEffect(() => {
    if (!customer) return;

    setCheckoutContact({
      name: `${customer.firstName} ${customer.lastName}`.trim(),
      email: customer.email,
      phoneNumber: customer.phoneNumber,
    });
  }, [customer]);

  function updateQuantity(itemId, nextQuantity) {
    const nextCart =
      nextQuantity <= 0
        ? cart.filter((item) => item.id !== itemId)
        : cart.map((item) => (item.id === itemId ? { ...item, quantity: nextQuantity } : item));

    setCart(nextCart);
    storeCart(nextCart);
  }

  function updatePickupTime(value) {
    setPickupTime(value);
    storePickupTime(value);
  }

  function updateCustomPickupTime(value) {
    if (!value) return;

    setCustomPickupTime(value);
    storeCustomPickupTime(value);
    updatePickupTime("custom");
  }

  function updateCheckoutContact(field, value) {
    if (customer) return;

    const nextContact = {
      ...checkoutContact,
      [field]: value,
    };

    setCheckoutContact(nextContact);
    storeCheckoutContact(nextContact);
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

  return (
    <section className="page-section ordering-page cart-page">
      <div className="page-heading cart-heading">
        <h1>Your order</h1>
        <p>Review your café picks before placing your order.</p>
      </div>

      <div className="content-block cart-review app-cart-review">
        <ul>
          {cart.map((item) => (
            <li key={item.id}>
              <div className="cart-item-copy">
                <strong>{item.name}</strong>
                {item.variantName ? <small>Size: {item.variantName}</small> : null}
                {item.options?.length ? (
                  <small>
                    {item.options.map((option) => `${option.groupName}: ${option.name}`).join(", ")}
                  </small>
                ) : null}
                <span>
                  {item.quantity} x {formatPrice(item.price)}
                </span>
              </div>
              <div className="cart-line-actions">
                <strong>{formatPrice(item.price * item.quantity)}</strong>
                <div className="quantity-stepper" aria-label={`Quantity for ${item.name}`}>
                  <button
                    type="button"
                    aria-label={`Remove one ${item.name}`}
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Add one ${item.name}`}
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  className="remove-cart-item"
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
        <div className="checkout-contact-panel">
          <div className="checkout-contact-heading">
            <span className="account-avatar" aria-hidden="true">
              <UserRound size={20} strokeWidth={2.4} />
            </span>
            <div>
              <span>Checkout contact</span>
              <h2>{customer ? "Using your account profile" : "How should we contact you?"}</h2>
            </div>
          </div>
          <div className="checkout-contact-grid">
            <label>
              <span>Name</span>
              <input
                autoComplete="name"
                readOnly={Boolean(customer)}
                value={contactFields.name}
                onChange={(event) => updateCheckoutContact("name", event.target.value)}
              />
            </label>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                readOnly={Boolean(customer)}
                type="email"
                value={contactFields.email}
                onChange={(event) => updateCheckoutContact("email", event.target.value)}
              />
            </label>
            <label>
              <span>Phone</span>
              <input
                autoComplete="tel"
                readOnly={Boolean(customer)}
                type="tel"
                value={contactFields.phoneNumber}
                onChange={(event) => updateCheckoutContact("phoneNumber", event.target.value)}
              />
            </label>
          </div>
          {!customer ? (
            <Link className="checkout-login-link" to="/account/login" state={{ from: "/cart" }}>
              Log in to prefill from your account
            </Link>
          ) : null}
        </div>
        <div className="cart-summary-detail">
          <span>Preferred pickup time</span>
          <strong>{pickupSummary}</strong>
        </div>
        <div className="cart-total-row">
          <span>Estimated total</span>
          <strong>{formatPrice(total)}</strong>
        </div>
        <Link className="primary-button" to="/confirmation">
          Place order
        </Link>
      </div>
    </section>
  );
}
