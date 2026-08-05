export function pickupTiming(order, now = new Date()) {
  const minutes = Math.round((new Date(order.requested_pickup_at) - now) / 60000);
  if (minutes < 0) return `${Math.abs(minutes)} min overdue`;
  if (minutes === 0) return "Due now";
  return `In ${minutes} min`;
}

export function summarizeOwnerOrders(orders) {
  return orders.reduce((summary, order) => {
    if (order.payment_status === "payment_pending") summary.waiting += 1;
    if (order.payment_status === "payment_failed") summary.failed += 1;
    if (order.payment_status === "paid" && summary[order.fulfillment_status] !== undefined) {
      summary[order.fulfillment_status] += 1;
    }
    return summary;
  }, { failed: 0, new: 0, preparing: 0, ready: 0, waiting: 0 });
}
