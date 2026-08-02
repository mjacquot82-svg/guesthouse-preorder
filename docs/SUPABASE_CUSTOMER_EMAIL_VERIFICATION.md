# Supabase customer email verification

The customer verification endpoint redeems Supabase `TokenHash` values server-side. The hosted Supabase project must use this **Confirm signup** link:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Verify email address</a>
```

Production configuration:

- Set the Supabase Site URL to `https://ladels.jdsstudio.ca`.
- Add exactly `https://ladels.jdsstudio.ca/account/verify-email` to the redirect URL allow list.
- Use the link above in the **Confirm signup** template. Do not send a browser session or access token to the customer application.
- Disable link tracking in the production SMTP provider. Supabase warns that rewritten verification links may fail.
- Keep Supabase email confirmation enabled. Token expiry and one-time replay protection are enforced by Supabase Auth when `/auth/v1/verify` redeems the token hash.

Registration and verification resend both pass the fixed application verification URL as `redirect_to`; no browser-supplied redirect is accepted. Resend uses Supabase's `signup` resend type. An invalid, expired, or replayed token receives the generic `verification_invalid` response.

Before release, send a real production signup email and confirm the delivered link uses the production HTTPS host, verifies once, fails on replay, fails after the configured expiry, and that resend invalidates or supersedes the previous link according to the hosted project's Supabase settings.
