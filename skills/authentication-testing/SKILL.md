---
name: authentication-testing
description: Test authentication and session weaknesses — login and registration flows, session handling, JWT, OAuth/OIDC, password reset, and MFA. Use when an engagement has a login, token, session, or account-recovery surface that may be bypassable or forgeable. This is OWASP Top 10:2025 A07 and API2:2023.
metadata:
  domain: offensive-security
  standards: "OWASP Top 10:2025 A07, API2:2023, WSTG-ATHN/SESS"
  tier: playbook
---

# authentication testing

authentication proves *who* you are; a break lets you become someone else or skip
the check. prove the exact broken property with a server-side readback of an
authenticated action, never just a redirect or a 200 on the login response.

## surfaces

use `email_create` + `email_wait` to own real registration/reset flows, and isolated
`browser_context` instances per identity. capture token/session material with
`proxy_flows` / `browser_network_requests` but never persist secret values in
evidence.

## session management

- session fixation: does a pre-login session id survive authentication? set/capture
  before login, complete login, check if the same id is now authenticated.
- session invalidation: does logout / password change actually revoke old sessions?
  test the old cookie after the event.
- cookie flags and scope: `HttpOnly`, `Secure`, `SameSite`, domain/path; a missing
  flag is a lead, not a finding — tie it to an exploitable effect.
- predictable/observable tokens: differential across several issued tokens.

## jwt (see jwt-and-oauth.md for detail)

- algorithm confusion: `alg:none`, or HS256 signed with the public RS256 key.
- signature not verified: tamper a claim (`sub`, `role`, `admin`) and see if it is
  accepted.
- weak secret: offline crack of an HS256 token, then forge.
- claim abuse: `kid` injection, `jku`/`x5u` pointing at attacker keys, expiry/aud
  not enforced.

## oauth / oidc (see jwt-and-oauth.md)

- `redirect_uri` validation: open-redirect/loose matching → token/code theft.
- state/pkce missing → csrf on the callback.
- code/token leakage via referrer, logs, or the redirect.
- id-token audience/issuer/signature not enforced.

## reset / registration / mfa

- reset token: predictable, reusable, non-expiring, or accepted for another account.
- host-header / password-reset poisoning: does the reset link honor an attacker
  `Host`/`X-Forwarded-Host`?
- registration: pre-verification privilege, email/username collision, response
  differences that enable user enumeration.
- mfa: step skippable (go straight to the post-mfa endpoint), backup-code or
  remember-device bypass, rate-limit missing on the otp.

## validation

require a server-side readback: an action performed as the target identity, a forged
token accepted by a protected endpoint, or an old session still authorized after
revocation. minimum evidence `impact_demonstrated`. distinguish an information leak
(enumeration) from a full bypass and scope impact accordingly.

## failure / adapt

a hardened login does not close the category — pivot to reset, oauth callback, mfa
step, token handling, or session lifecycle. record which property held.

## routing

`campaign_hypothesis` per property; `campaign_test` with the exact flow; validate via
`evidence-and-validation`; forged-primitive results often feed
`vulnerability-chaining`. resource: `resources/jwt-and-oauth.md`.
