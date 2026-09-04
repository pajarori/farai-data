# business-logic invariants & race testing

## invariant catalog (probe each relationship)

| relationship | invariant | violation to try |
|---|---|---|
| value | amount ≤ balance; amount ≥ 0 | negative, zero, overflow, float precision |
| price | server-authoritative price | client-sent price/discount, currency swap |
| quantity | 0 ≤ qty ≤ stock/limit | negative qty (refund/credit), qty > stock, bulk |
| coupon/token | single use | replay redeem, apply twice, stack coupons |
| order/state | step B requires step A | skip payment, ship-before-pay, resume cancelled |
| ownership transfer | only owner initiates | initiate on borderline-owned object |
| entitlement | feature gated by plan | invoke premium action on free plan via api |
| rate/limit | ≤ N per period | exceed via parallel or alternate channel |
| lifecycle | expired/void cannot act | use expired cart/session/link |

## the standard test

1. reproduce the legitimate flow on your own resource; note the pre-state.
2. mutate exactly one relationship.
3. server-side readback: query the balance/order/inventory/entitlement again.
4. if the invariant is violated, that is the finding.
5. roll back the durable effect (cancel/refund/reset) and re-verify the rollback.

## race conditions (check-then-act)

targets: balance debit, stock decrement, coupon redemption, vote/like, withdrawal,
account-creation uniqueness, one-time actions.

method:
- identify a window where the app checks a condition then acts on it separately.
- fire many *parallel* identical requests (single-packet / near-simultaneous) so
  several pass the check before any commits.
- prove the impossible state: balance spent twice, stock below zero, coupon applied
  N times.
- repeat to show it is reliable, then roll back.

tooling: script parallel submission with `shell_exec` (e.g. concurrent curl / a small
script), or `proxy_replay` the captured request in a tight burst; capture the
resulting server state with `http_request` / `browser_*`. record the state delta
with `evidence_save`.

## reporting boundary

- own-account value/quantity/race → business logic.
- crossing to another owner's object → access control.
- always show pre-state, mutation, post-state readback, and the rollback.
