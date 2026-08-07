# Acceptance Test Log

============================================================
AT-001
Owner Authentication
============================================================

Objective:
Verify that an authenticated owner can access protected owner workflows and that expired or invalid sessions produce an actionable sign-in path.

Result:
Owner authentication and protected owner access completed successfully. Authentication failures are distinguished from permission, configuration, network, and server failures in owner-facing workflows.

Issues discovered:
None.

Status:
Complete

============================================================
AT-002
Dashboard
============================================================

Objective:
Verify that the Owner Dashboard presents accurate, understandable operational summaries and integration status.

Result:
Dashboard navigation and operational summaries are functional. Clover status reporting was corrected, but loading-state metrics and live Clover health reporting still need refinement.

Issues discovered:

Issue ID:
GH-001

Title:
Dashboard displays misleading zero values during loading

Severity:
Medium

Status:
Open

Date discovered:
2026-08-05

Acceptance milestone:
AT-002 — Dashboard

Root cause (short):
Dashboard metrics render default zero values before their asynchronous data requests finish.

Resolution (short):
Not yet resolved.

Commit SHA that fixed it (if fixed):
N/A

Issue ID:
GH-005

Title:
Owner Dashboard Clover status omitted authenticated credentials and falsely displayed "Not connected"

Severity:
High

Status:
Fixed

Date discovered:
2026-08-05

Acceptance milestone:
AT-002 — Dashboard

Root cause (short):
The Clover connection request did not include the owner session credentials, and the UI collapsed request failures into a disconnected state.

Resolution (short):
Send owner credentials, preserve typed failure states, and display authenticated connection details with appropriate retry or sign-in actions.

Commit SHA that fixed it (if fixed):
520e08b2811bb997da3ef499e17a94684b2db50b

Status:
Needs Refinement

============================================================
AT-003
Scheduling
============================================================

Objective:
Verify owner management of business hours, closures, lead time, pickup intervals, capacity, and scheduling availability.

Result:
Scheduling controls and availability behavior completed successfully. The business-hours editor remains less discoverable than desired.

Issues discovered:

Issue ID:
GH-002

Title:
Business-hours editor discoverability can be improved

Severity:
Medium

Status:
Open

Date discovered:
2026-08-05

Acceptance milestone:
AT-003 — Scheduling

Root cause (short):
The current information hierarchy does not make the business-hours editing action sufficiently prominent.

Resolution (short):
Not yet resolved.

Commit SHA that fixed it (if fixed):
N/A

Status:
Needs Refinement

============================================================
AT-004
Checkout
============================================================

Objective:
Verify customer checkout details, pickup selection, pricing, order creation, and transition to secure payment.

Result:
Checkout successfully validates customer and order data, creates the order, and begins secure payment. The custom pickup-time control does not consistently communicate the backend-resolved pickup time.

Issues discovered:

Issue ID:
GH-003

Title:
Checkout custom pickup-time control does not display the resolved backend pickup time

Severity:
Medium

Status:
Open

Date discovered:
2026-08-05

Acceptance milestone:
AT-004 — Checkout

Root cause (short):
The time input is driven by local pickup intent while the authoritative resolved time is returned separately by scheduling.

Resolution (short):
Not yet resolved.

Commit SHA that fixed it (if fixed):
N/A

Status:
Needs Refinement

============================================================
AT-005
Checkout Recovery
============================================================

Objective:
Verify that a customer can recover safely when payment startup fails after the order has already been created.

Result:
Checkout now preserves the accepted order, clearly separates order confirmation from incomplete payment, prevents duplicate submission, and provides an in-place secure-payment retry.

Issues discovered:

Issue ID:
GH-004

Title:
Customer checkout reported a misleading network error when Clover checkout failed

Severity:
High

Status:
Fixed

Date discovered:
2026-08-05

Acceptance milestone:
AT-005 — Checkout Recovery

Root cause (short):
Clover transport, upstream, and application failures were flattened into a generic order-placement network error after the order had already been saved.

Resolution (short):
Preserve structured Clover errors, tell the customer the order was saved, lock the accepted order, and retry payment without resubmitting it.

Commit SHA that fixed it (if fixed):
51aebf21249cec3c1a3dc005934ad498f1828cba

Status:
Complete

============================================================
AT-006
Orders
============================================================

Objective:
Verify that owners can view operational order lists, summaries, order details, and current order state.

Result:
Owner order operations completed successfully, including truthful active/attention filtering, visible attention reasons, detail presentation, and protected API access. Incomplete Hosted Checkout records are excluded from the operator queue because they have no staff action; customer payment recovery remains unchanged.

Issues discovered:
None.

Status:
Complete

============================================================
AT-007
Order Fulfillment
============================================================

Objective:
Verify that paid orders remain active until an authorized operator completes them, with persisted history and conflict protection.

Result:
The RC workflow is simplified to Paid active -> Completed -> Recent History. Owners and Staff with order-fulfillment capability can complete paid active orders directly and, after confirmation, return an accidentally completed order to Active Orders. Payment data and order snapshots are preserved; optimistic concurrency, retry safety, payment guards, cancelled-order protection, timestamps, and historical Preparing/Ready compatibility remain intact.

Issues discovered:
None.

Status:
Complete

============================================================
AT-008
Clover Integration
============================================================

Objective:
Verify Clover connection visibility and hosted-checkout behavior, including useful failure reporting to owners and customers.

Result:
Authenticated connection status and hosted-checkout error handling completed successfully. The displayed connected state still represents stored credentials rather than a live Clover health check.

Issues discovered:

Issue ID:
GH-006

Title:
Dashboard "Connected" reflects stored credentials rather than verified operational health

Severity:
Medium

Status:
Open

Date discovered:
2026-08-05

Acceptance milestone:
AT-008 — Clover Integration

Root cause (short):
The connection endpoint checks configuration and stored installation credentials but does not validate them against Clover in real time.

Resolution (short):
Not yet resolved.

Commit SHA that fixed it (if fixed):
N/A

Status:
Needs Refinement

============================================================
Release Candidate Status
============================================================

Owner Authentication: ✅ Complete

Dashboard: 🟡 Needs Refinement

Scheduling: 🟡 Needs Refinement

Checkout: 🟡 Needs Refinement

Checkout Recovery: ✅ Complete

Orders: ✅ Complete

Order Fulfillment: ✅ Complete

Clover Integration: 🟡 Needs Refinement

Notifications: ⬜ Not Tested

Tablet UX: ⬜ Not Tested

Performance: ⬜ Not Tested

============================================================
Next Acceptance Testing Milestone
============================================================

Notifications — verify that customer and owner notifications are triggered exactly once for the correct order events and contain accurate order, payment, and pickup information.
