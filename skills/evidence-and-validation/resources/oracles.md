# category oracles — discriminating tests and required evidence

each entry: the false-positive trap, the discriminating test that rules it out,
and the minimum evidence-ladder rung before `report_add_finding` /
`campaign_verify`.

## reflected / stored xss
- trap: reflected markup or a scanner "xss" hit is not execution; encoding or CSP
  may neutralize it.
- test: load the injection point in a real browser (`browser_navigate`), then
  observe an actual side-effect — a fired `dialog` (`browser_wait_for`), a node
  injected into the dom (`browser_snapshot` / `browser_find`), or an exfil
  callback (`callback_oast`). for stored xss, trigger as the *victim* identity in
  a separate `browser_context`.
- control: the same payload in a context where execution should be blocked (proper
  encoding) must not fire.
- evidence: `impact_demonstrated` (observed execution).

## dom xss
- trap: source-to-sink reasoning from static js is a lead, not proof.
- test: drive the exact source (fragment, `postMessage`, url param) in the browser
  and observe the sink executing.
- evidence: `impact_demonstrated`.

## ssrf
- trap: a slow response or a 500 is not proof of a server-side request; a callback
  might be a scanner's or another tenant's.
- test: point the target at a unique `callback_oast` token; require the callback to
  arrive and correlate to *this* attempt's token. for blind ssrf, the token is the
  only proof. probe internal effects (metadata endpoints, internal hosts) only
  within scope.
- evidence: `impact_demonstrated` (unique callback received) or a returned internal
  resource body.

## blind sql injection
- test: boolean pair (true vs false condition) producing a stable response
  difference, or time-based delay vs a zero-delay control, repeated 3+ times to
  rule out jitter. prefer a differential over a single anomaly.
- control: an equivalent syntactically-invalid payload must not produce the
  difference.
- evidence: `differential_observed` → `reproduced`.

## error-based / union sql injection
- test: extract a known server-side value (version, a row you are authorized to
  read) and match it exactly.
- evidence: `impact_demonstrated`.

## command / code / template injection
- test: an out-of-band `callback_oast` from the target, or a computed value only
  the interpreter could produce (arithmetic, concatenation), not a reflected
  literal. distinguish the engine (ssti) from the shell.
- evidence: `impact_demonstrated`.

## open redirect
- test: follow the `Location` (`http_request` without auto-follow, or
  `browser_navigate`) and confirm the final host is attacker-controlled and
  off-origin. an in-app relative redirect is not a finding.
- evidence: `reproduced`.

## access control — idor / bola / bfla
- trap: `200` vs `403` is not authorization; a `200` may be an empty or generic
  body.
- test: two isolated identities (separate `browser_context` + `email_*`). identity
  A performs the exact operation on identity B's resource. for `read`, require a
  semantic marker that belongs to B. for `write`, require a fresh server-side
  readback showing B's resource changed. for `delete`, prove absence then restore.
  never copy a cookie/token between identities.
- control: A on A's own resource (baseline allow) and an unauthenticated/invalid
  session (baseline deny).
- evidence: `impact_demonstrated` (cross-boundary effect proven by state).

## broken authentication
- test: prove the exact broken property — a forged/none-alg jwt accepted, a session
  fixation surviving login, a reset token reused, mfa bypassed on a specific step —
  with a server-side readback of authenticated action, not just a redirect.
- evidence: `impact_demonstrated`.

## business logic / race
- test: own-resource happy path → counterfactual → mutate one relationship
  (value, quantity, order, replay) → server-side readback of the violated invariant
  → rollback any durable effect. for race, parallel submission producing a state
  the sequential path forbids, repeated.
- evidence: `impact_demonstrated` + rollback verified.

## general controls checklist
- baseline captured before mutation.
- negative control that falsifies coincidence (cache, timing, shared state, WAF).
- repeat when timing/eventual-consistency/browser/network could explain it.
- evidence saved (`evidence_save`) and bound to the hypothesis and attempt.
- for `verified`, the confirming run is a *different session* than the finder.
