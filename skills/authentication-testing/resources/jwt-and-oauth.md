# jwt & oauth/oidc deep reference

## jwt attack ladder

1. **decode** header + payload (base64url). note `alg`, `kid`, `jku`/`x5u`, `sub`,
   `role`/scopes, `exp`, `aud`, `iss`.
2. **alg:none** — set header `{"alg":"none"}`, drop the signature, keep/modify
   claims. accepted → signature not enforced.
3. **algorithm confusion (RS→HS)** — if the server uses RS256, re-sign the token with
   HS256 using the *public* key as the HMAC secret. accepted → the server trusts the
   client-declared alg.
4. **weak HS secret** — crack offline (`shell_exec` hashcat/john against the token),
   then forge arbitrary claims.
5. **signature stripped/broken** — flip one claim byte; if still accepted, no
   verification.
6. **kid injection** — `kid` as a path/sql/command value pointing at a predictable
   key file (e.g. `/dev/null` → empty key) or an injection sink.
7. **jku / x5u** — point at an attacker-hosted jwks (in-scope callback) and sign with
   your own key.
8. **claim enforcement** — expired `exp`, wrong `aud`/`iss`, or `nbf` in the future
   still accepted.

proof: forge a token asserting a higher `role`/`sub` and use it on a protected
endpoint; require a server-side readback of the privileged action.

## oauth 2.0 / oidc checklist

- **redirect_uri** — try appended paths, subdomains, `@`-tricks, open-redirect on an
  allowed host, `localhost`, missing exact-match. a loose match leaks the
  code/token.
- **state** — missing/unchecked → csrf on the callback (log the victim into your
  account or vice versa).
- **pkce** — missing on a public client → code interception usable.
- **response_type / response_mode** — try `token`/`id_token` where `code` is
  expected; fragment leakage via referrer.
- **code reuse / expiry** — replay an authorization code; codes must be single-use
  and short-lived.
- **scope escalation** — request extra scopes; does consent enforce them.
- **id_token** — verify the server checks signature, `aud`, `iss`, `exp`; a forged or
  swapped id-token accepted is a full break.
- **token leakage** — referrer header, browser history, server logs, or an open
  redirect in the flow.

## tooling

- capture the full flow with `proxy_flows` / `proxy_sitemap`; replay steps with
  `proxy_replay`.
- drive the interactive consent in a `browser_context`; use a second context as the
  victim identity.
- host attacker jwks / redirect targets on an in-scope `callback_*` endpoint.
- never store live tokens/secrets in evidence — record the decoded claim delta and
  the server's authorized response.
