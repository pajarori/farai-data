# authorization matrix — exact tuples

record every experiment as one row. one row = one `campaign_test`.

```text
actor → role/session → operation → resource owner → expected decision → observed server effect
```

## worked horizontal (idor/bola) example

| # | actor | operation | resource owner | expected | observed |
|---|---|---|---|---|---|
| 1 | A | GET /api/orders/{A} | A | allow | A's order body |
| 2 | B | GET /api/orders/{B} | B | allow | B's order body |
| 3 | A | GET /api/orders/{B} | B | deny | **B's order body → BOLA** |
| 4 | unauth | GET /api/orders/{B} | B | deny | 401 (control) |

row 3 is a finding only if the body carries a marker provably belonging to B, not a
generic/empty 200.

## vertical (bfla) example

| # | actor | operation | expected | observed |
|---|---|---|---|---|
| 1 | admin | POST /api/admin/users (create) | allow | user created (control) |
| 2 | user | POST /api/admin/users | deny | **user created → BFLA** |
| 3 | user | GET /api/admin/users | deny | 403 (path enforced, function not) |

note row 3 vs row 2: read may be blocked while the write function is not — test the
*function*, not just the page.

## object-property (bopla) example

- **mass assignment (write)**: add a privileged field to a normal update
  (`{"role":"admin"}`, `{"verified":true}`, `{"balance":999}`). readback the object;
  if the field changed, it was accepted without authorization.
- **excessive data (read)**: request the object and diff the returned properties
  against what the ui/role should see; a field belonging to another trust level is
  a leak.

## write/state discipline

- write → fresh server-side readback (a second authorized request) proving the
  change landed for the other owner.
- delete → prove absence, then restore (rollback).
- action → prove the exact protected transition (state before ≠ state after).
- durable effects always require rollback and a fresh-state re-check.

## dimensions to vary (one per row)

object id · id format/encoding (int, uuid, hashid, base64) · role · tenant/org ·
http method (GET↔POST↔PUT↔PATCH↔DELETE) · content-type · field set · single↔bulk ·
graphql resolver/field · websocket message · api version (v1 vs v2) · sibling
endpoint that skips a guard · parent/child relationship.

## applicability markers (when full matrix is impossible)

- `implicit_actor` — a fixed/anonymous actor already reaches another owner.
- `unauthenticated` — a guest performs an owner-only operation.
- `not_applicable` — no distinct actor/resource boundary exists.
- `inconclusive` — a sink exists but no server-side readback or safe rollback is
  available to confirm.
