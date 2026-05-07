// Future Clover integration placeholder.
// Keep Clover logic out of UI components.

export async function createCloverOrder(order) {
  console.log("Future Clover order sync:", order);
  return {
    status: "mocked",
    cloverOrderId: `mock-${Date.now()}`
  };
}
