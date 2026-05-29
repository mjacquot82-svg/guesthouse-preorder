export const ORDER_READY_FOR_PICKUP_EVENT = "cedar-oak-order-ready-for-pickup";

export function emitOrderReadyForPickup(order) {
  if (!order || typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ORDER_READY_FOR_PICKUP_EVENT, {
      detail: {
        orderId: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        pickupSummary: order.pickupSummary,
      },
    })
  );
}
