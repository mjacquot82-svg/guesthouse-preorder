const CART_STORAGE_KEY = "cafe-cart";
const CART_UPDATED_EVENT = "cedar-oak-cart-updated";

export function getStoredCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function storeCart(cart) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
}

export function clearCart() {
  storeCart([]);
}

export function addToCart(cart, product) {
  const existing = cart.find((item) => item.id === product.id);

  if (existing) {
    return cart.map((item) =>
      item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
    );
  }

  return [...cart, { ...product, quantity: 1 }];
}

export function removeFromCart(cart, productId) {
  return cart.filter((item) => item.id !== productId);
}

export function getCartTotal(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function replaceCart(cart) {
  storeCart(cart);
  return cart;
}
