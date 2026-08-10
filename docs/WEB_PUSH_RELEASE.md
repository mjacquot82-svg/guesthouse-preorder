# Ladel's Web Push release runbook

Web Push enrollment and sending are both off by default. PostgreSQL is the durable source of truth. The existing API triggers bounded outbox drains after a send and on Communications refresh, and its lifespan runs the same bounded drain once per minute. A process crash can delay a queued notification until the API restarts, but cannot erase it.

Generate production VAPID keys with the installed standards library (never in the browser):

```bash
python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); v.save_key('vapid-private.pem'); v.save_public_key('vapid-public.pem')"
```

Store the private key contents in `WEB_PUSH_VAPID_PRIVATE_KEY`, the URL-safe unpadded public application-server key in `WEB_PUSH_VAPID_PUBLIC_KEY`, and a monitored `mailto:` or HTTPS contact in `WEB_PUSH_VAPID_SUBJECT`. Generate an independent Fernet key for `WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY`:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Private values belong only in Render secret environment variables. Never prefix them with `VITE_`, log them, or expose them through an API. The public VAPID key is returned to authenticated customers only when the release is active.

Release procedure:

1. Deploy and run Alembic revision `20260809_15` while `PUSH_ENROLLMENT_ENABLED=false` and `PUSH_RELEASE_ENABLED=false`.
2. Configure the VAPID and encryption values on the existing API service.
3. Confirm `/service-worker.js` is JavaScript (not the SPA HTML), root-scoped, and served with no-cache headers.
4. Set `PUSH_ENROLLMENT_ENABLED=true` temporarily and enroll the authenticated acceptance-test device. Sending remains blocked while `PUSH_RELEASE_ENABLED=false`.
5. In a short controlled test window, set `PUSH_RELEASE_ENABLED=true`, redeploy, send only the authoritative Lunch Special test, and inspect its accepted/failed result. Then set it back to `false` if public release is not approved.
6. For release, leave enrollment enabled and set `PUSH_RELEASE_ENABLED=true`. Confirm Communications says release-enabled, queue a controlled announcement, and verify only honest `accepted`/`failed` results.

No separate Render worker is required at expected café scale. The API response is returned only after the announcement and delivery rows commit; Web Push network calls run afterward as a bounded trigger. If that trigger is interrupted, the existing API's once-per-minute drain reclaims and drains durable work after startup. Communications also polls while work remains, without coupling delivery to ordering or payment traffic.
