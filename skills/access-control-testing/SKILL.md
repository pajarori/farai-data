---
name: access-control-testing
description: Test broken access control — IDOR, BOLA/BFLA/BOPLA, horizontal/vertical/contextual and object-level authorization, and SSRF reachability. Use when operations expose object identifiers, roles, tenants, ownership, or privileged functions that may be inconsistently enforced. This is OWASP Top 10:2025 A01 and API1/API3/API5.
metadata:
  domain: offensive-security
  standards: "OWASP Top 10:2025 A01, API1/API3/API5:2023, WSTG-ATHZ"
  tier: playbook
---

# access control testing

broken access control is the highest-yield web class. the core move is a
*differential across identities*: the same operation must succeed for the owner and
fail for a non-owner, proven by server-side effect — not by a status code.

## mental map

```text
actor → role/session → operation → resource owner → expected decision → observed server effect
```

authorization can fail on four axes:
- **horizontal** (idor / bola): actor A reaches actor B's object.
- **vertical** (bfla): a low-privilege actor invokes a higher-privilege function.
- **object-property** (bopla): a field the actor may not read/write is exposed or
  accepted (mass assignment, excessive data).
- **contextual**: enforcement depends on step, channel, method, or api version and
  is inconsistent across them.

## setup — isolated identities

use operator-provided or freshly created accounts kept in *separate*
`browser_context` instances, each with its own `email_*` inbox. never copy a cookie
or token between identities and never persist credential values in evidence. prepare
actor A + resource A, actor B + resource B; add an admin only for a vertical test.

## controls (run in order)

1. A → A's resource (own-resource baseline: allow).
2. B → B's resource (second baseline: allow).
3. A → the exact operation on B's resource (the test).
4. B → A's resource when reversible.
5. a fresh unauthenticated session repeats it.
6. a fresh invalid-session context repeats it.
7. for vertical: low-priv actor invokes the admin-only function; admin provides the
   expected-allow control.

## method — vary one dimension

change exactly one: object id, id encoding/format, role, tenant, http method,
content-type, field set (add/remove a property), bulk vs single, graphql resolver,
websocket message, or an alternate/older api version that skips a check. api styles
often expose the same object with weaker checks on one path.

## validation

do not infer authorization from `200` vs `403`:
- **read**: require a semantic marker that belongs to the *other* owner's resource.
- **write**: require a fresh server-side readback proving the change landed.
- **delete**: prove absence, then restore.
- **action/admin**: prove the exact protected transition or effect.

minimum evidence: `impact_demonstrated` (cross-boundary effect proven by state).
load `evidence-and-validation` and its `resources/oracles.md` for the exact test.

## ssrf reachability (rolled into A01:2025)

when an operation takes a url, host, or fetches a resource, test whether it reaches
attacker-chosen destinations: point it at a unique `callback_oast` token and require
the callback; probe in-scope internal targets only. treat as a chain primitive
(→ `vulnerability-chaining`). deep injection reasoning lives in `injection-testing`.

## failure / adapt

a `403` on one path does not close the category. try another object, role, method,
content-type, api version, or channel. an application may expose ids without giving
you two roles — record `implicit_actor`, `unauthenticated`, `not_applicable`, or
`inconclusive` explicitly instead of concluding "authorization is safe".

## routing

`campaign_hypothesis` per boundary; `campaign_test` per matrix row (baseline +
control + effect); `report_add_finding` then `campaign_verify` (cross-session).
resources: `resources/authz-matrix.md`, `resources/idor-checklist.md`.
