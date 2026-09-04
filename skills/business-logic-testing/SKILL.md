---
name: business-logic-testing
description: Test business-logic and design flaws — workflow and state-machine abuse, race conditions, replay, and value/quantity/price manipulation. Use as soon as an operation has an actor, object, state, value, order, or channel relationship; do not wait for injection to fail first. This is OWASP Top 10:2025 A06 (Insecure Design) and API6:2023.
metadata:
  domain: offensive-security
  standards: "OWASP Top 10:2025 A06, API6:2023, WSTG-BUSL"
  tier: playbook
---

# business-logic testing

logic flaws are invisible to scanners: the request is well-formed and the server
does exactly what it was told — just not what it should. you find them by modeling
the intended rules and violating one at a time on your *own* resources, with
server-side readback and rollback.

open this the moment you see an actor/object/state/value/channel relationship — in
parallel with, not after, injection testing.

## mental map

```text
actor + role + owner + resource + state + transition
+ invariant over {order, replay, value, quantity, channel, lifecycle}
```

an invariant is a rule that must always hold: "cannot spend more than balance",
"cannot ship before payment", "a coupon applies once", "quantity ≥ 0", "step B needs
step A".

## setup

reproduce the intended happy path on an owned resource first, so you know the
baseline state. keep a counterfactual (the legitimate outcome) to compare against.

## method — violate one invariant

- **state / order**: skip a step, repeat a step, execute steps out of order, resume a
  cancelled/expired flow, act on a state that should forbid the action.
- **replay**: submit the same finalize/redeem/transfer twice; reuse a one-time token,
  coupon, or nonce.
- **value / sign / precision**: negative amounts, zero, overflow, extreme quantity,
  float precision, currency/units, price sent from the client.
- **quantity / cardinality**: exceed per-user/per-item limits, add beyond stock,
  bulk where single is intended.
- **channel parity**: the api/graphql/mobile/websocket path enforces less than the
  ui; do the forbidden action on the weaker channel.
- **race** (see `resources/invariants.md`): fire N parallel requests at a check-then-act window
  (balance, stock, coupon, vote) to double-spend or over-consume.

## validation

require a **server-side readback** proving the invariant was violated (balance, order
state, entitlement, inventory), then **roll back** any durable effect and re-verify.
a client-side price change that the server re-computes is not a finding. minimum
evidence `impact_demonstrated` + rollback verified. use `evidence-and-validation`.

## authorization boundary

value/quantity abuse on your *own* account is logic; reaching another owner's object
is access control → `access-control-testing`. keep the boundary clear when reporting.

## failure / adapt

one enforced invariant does not close the category — try another relationship
(value → replay → order → channel). record which invariant held.

## routing

model the workflow in `campaign_observe`; `campaign_hypothesis` per invariant;
`campaign_test` with happy-path baseline + one mutation + readback + rollback;
validate before claiming. logic primitives often chain (→ `vulnerability-chaining`).
resource: `resources/invariants.md`.
