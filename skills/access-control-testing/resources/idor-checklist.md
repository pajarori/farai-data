# idor / object-reference checklist

## find the references

- ids in path (`/orders/1043`), query (`?user=1043`), body, headers, cookies, and
  json fields.
- indirect references: filenames, s3 keys, signed urls, export/report ids, invoice
  numbers, batch/job ids, graphql node ids, websocket subscription ids.
- capture them from `web_crawl`, `browser_network_requests`, and `proxy_sitemap`.

## enumerate safely

- sequential ints → try neighbors (±1, ±small) belonging to your *own* other
  account first; only touch third-party objects when scope allows.
- uuids/hashids → not a control; look for a second endpoint that maps a
  human-guessable value to the id, or a leak of another owner's id.
- do not mass-enumerate unrelated real users; use operator-provided A/B accounts.

## per-reference test

1. authenticate as A, capture A's request to A's object.
2. swap only the id to B's object (`http_request` or `proxy_replay`).
3. compare body to B's own baseline — require a marker belonging to B.
4. repeat for write/delete/action with server-side readback + rollback.

## common bypasses to try (one variable each)

- change method (GET blocked → POST/PUT allowed).
- change content-type (json blocked → form/xml allowed).
- wrap the id (`[1043]`, `1043,1044`, `{"id":1043}`) for bulk/array handlers.
- add the id in a second location the server trusts (param pollution).
- older api version or a mobile/graphql equivalent of the same object.
- path tricks that reach the object via a different route.

## proof

- read: B's semantic marker returned to A.
- write: readback shows B's object changed.
- delete: B's object absent, then restored.
- record raw request/response with `evidence_save`; never store B's secrets/pii
  beyond the minimal marker needed to prove the boundary crossing.
