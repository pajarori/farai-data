---
name: owasp-api-top-10
description: Methodology and coverage for the OWASP API Security Top 10:2023 — the ten API-specific risk classes (BOLA, broken auth, BOPLA, resource consumption, BFLA, business-flow abuse, SSRF, misconfiguration, inventory, unsafe consumption), how to test each against REST and GraphQL, and how to map to WSTG-APIT. Use whenever the target exposes an API.
metadata:
  domain: offensive-security
  standards: "OWASP API Security Top 10:2023, WSTG-APIT"
  tier: spine
---

# owasp api security top 10:2023

apis fail differently from page-based apps: object- and function-level
authorization dominate, and the surface is defined by endpoints × methods ×
object ids × properties. enumerate the surface first (spec/openapi/graphql
introspection, traffic capture, client analysis), then work the ten classes.
cite `API<n>:2023` on every api finding.

## the ten (2023)

1. **API1 Broken Object Level Authorization (BOLA/IDOR)** — swap object ids
   across identities; the #1 api risk. → `access-control-testing`.
2. **API2 Broken Authentication** — weak/again-forgeable tokens, jwt flaws,
   credential stuffing, no lockout, weak key/rotation. → `authentication-testing`.
3. **API3 Broken Object Property Level Authorization (BOPLA)** — mass assignment
   (writing forbidden fields) and excessive data exposure (reading them).
4. **API4 Unrestricted Resource Consumption** — no rate/size/complexity limits;
   cost or dos via large payloads, pagination, or graphql query depth/batching.
5. **API5 Broken Function Level Authorization (BFLA)** — reach admin/privileged
   functions or other roles' methods (HTTP verb and route tampering).
6. **API6 Unrestricted Access to Sensitive Business Flows** — automate/abuse a
   legitimate flow (purchase, signup, booking) without human-scale limits.
   → `business-logic-testing`.
7. **API7 Server-Side Request Forgery (SSRF)** — server fetches an
   attacker-controlled url; probe internal/metadata endpoints.
8. **API8 Security Misconfiguration** — cors, headers, verbose errors, unpatched,
   debug endpoints, missing transport security.
9. **API9 Improper Inventory Management** — shadow/old/undocumented endpoints,
   unversioned or staging hosts, `/v1` vs `/v2` drift. enumerate all versions.
10. **API10 Unsafe Consumption of APIs** — trusting third-party/upstream apis
    without validation; injection or ssrf via consumed data.

## how to test in farai

- **map the surface**: pull openapi/swagger, graphql introspection, and observed
  traffic; list endpoints × methods × params × object-id shapes. delegate a
  `recon`/`web` subagent for discovery (detached, non-editing).
- **authorization first**: prepare two same-role identities + one higher-role;
  run the differential for BOLA (API1), BOPLA (API3), BFLA (API5). prove with
  server-side effect, not status code.
- **then** resource limits (API4), business-flow abuse (API6), ssrf (API7),
  config (API8), inventory drift (API9), upstream trust (API10).
- classify with `API<n>:2023` and the web mapping (A01/A02/A04/A05/A07:2025).

reference: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
