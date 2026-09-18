---
name: owasp-web-top-10
description: Risk-ranked coverage of the OWASP Top 10:2025 for web applications — the ten categories, what each means, how to test it, and how it maps to WSTG and the per-topic playbooks. Use to prioritise a web assessment by real-world risk and to classify and report findings against the current OWASP Top 10.
metadata:
  domain: offensive-security
  standards: "OWASP Top 10:2025, WSTG v4.2"
  tier: spine
---

# owasp top 10:2025 (web)

the top 10 is a *risk ranking*, not a test plan — use `wstg-methodology` for
ordered coverage and this skill to prioritise and to classify findings. cite the
`A0x:2025` id on every web finding. ssrf now lives inside A01.

## the ten (2025)

1. **A01 Broken Access Control** — idor/bola, bfla, bopla, path traversal,
   privilege escalation, and **ssrf** (folded in for 2025). test by differential
   across identities; prove with server-side effect. → `access-control-testing`.
2. **A02 Security Misconfiguration** — default/verbose config, missing headers,
   open admin/backup, permissive cors, cloud storage exposure, unpatched stacks.
   moved to #2 in 2025.
3. **A03 Software Supply Chain Failures** — vulnerable/compromised dependencies,
   build/CI and update-channel integrity (broadened from 2021's "vulnerable
   components"). enumerate components, versions, and provenance.
4. **A04 Cryptographic Failures** — weak/misused crypto, secrets in transit or at
   rest, weak tls, bad randomness, missing encryption.
5. **A05 Injection** — sqli, nosql, os command, ldap, xxe, ssti, and **xss**.
   → `injection-testing`, `client-side-testing`.
6. **A06 Insecure Design** — missing/broken controls by design: workflow abuse,
   missing rate limits, business-logic flaws, unsafe defaults. → `business-logic-testing`.
7. **A07 Authentication Failures** — weak creds, broken login/lockout, session
   fixation, weak reset, missing/again-bypassable mfa. → `authentication-testing`.
8. **A08 Software or Data Integrity Failures** — insecure deserialization,
   unsigned updates, untrusted CI/plugins, integrity assumptions.
9. **A09 Security Logging and Alerting Failures** — insufficient logging,
   detection, and alerting of security events (renamed to include alerting).
10. **A10 Mishandling of Exceptional Conditions** — new in 2025: unsafe handling
    of errors/edge cases (fail-open, leaked state, inconsistent behavior under
    fault). overlaps WSTG-ERRH plus logic edge cases.

## how to use in farai

- prioritise: A01, A02, A05, A07 are the highest-yield starting points for most
  web targets.
- classify every finding with `A0x:2025` plus its `WSTG-<CAT>` id and, for api
  surface, the `API<n>:2023` id (see `owasp-api-top-10`).
- delegate testing to the `web`/`recon` lanes as detached subagents; keep this
  thread ranking, correlating, and reporting.

changes from 2021: misconfiguration ↑ to A02; supply-chain broadened to A03;
ssrf merged into A01; logging renamed to include alerting (A09); new A10
mishandling of exceptional conditions.

reference: https://owasp.org/Top10/2025/
