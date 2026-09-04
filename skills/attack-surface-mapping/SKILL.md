---
name: attack-surface-mapping
description: Reconnaissance and attack-surface enumeration for a web/API/network target — passive discovery, live-service validation, application mapping, and tech/WAF fingerprinting, modeled into campaign assets. Use at the start of an engagement or when coverage feels thin, to broaden the surface before drilling into any single operation.
metadata:
  domain: offensive-security
  standards: "WSTG-INFO, OWASP Top 10:2025 A02"
  tier: spine
---

# attack surface mapping

goal: build a faithful, deduplicated model of what is reachable, then hand the most
promising operations to the specialist skills. breadth first — a wide, shallow map
beats deep tunneling into one endpoint, and it prevents the common failure of
burning a whole run on a dead path.

## flow

1. **passive discovery** (cheap, no target load): `subdomain_enum` for
   domains/dns/ct; `url_discover` for historical urls. consume each source once.
2. **validate live**: `dns_probe` to resolve and wildcard-filter; `http_probe` for
   live http services, titles, servers, technologies, and cdn/waf classification;
   `tls_probe` for cert/san pivots to more names; `port_scan` for non-web services.
3. **fingerprint**: from `http_probe` tech + `tls_probe`, note stack, frameworks,
   waf/cdn, auth surfaces, and api styles (rest/graphql/grpc/ws). a waf/edge in
   front changes how you test and how you read anomalies — do not turn edge
   behavior into an origin finding.
4. **map the app**: `web_crawl` for breadth-first endpoints, forms, and xhr;
   `dir_enum` for hidden paths. enable headless crawl only when js builds the app.
5. **model it**: record each host/service/endpoint as a `campaign_asset` (canonical
   id dedups), and each factual signal (a login form, an id-bearing url, an upload,
   a redirect param, an api schema) as a `campaign_observe`.

## prioritize operations, don't just inventory

a reachable operation with attacker-relevant shape (an id in the path, a role, a
value field, a redirect target, a file upload, an auth step) outranks expanding
generic inventory. for each, open a `campaign_hypothesis` and route to the matching
skill:

- id/owner/role/tenant boundaries → `access-control-testing`
- login/session/token/reset flows → `authentication-testing`
- parameters reaching a parser/sink → `injection-testing`
- reflected input / dom sinks / cross-origin → `client-side-testing`
- multi-step workflows with value/state → `business-logic-testing`

## preflight the defenses

before investing budget, note whether a waf, bot-detection, captcha, or rate limit
will interfere (visible in `http_probe` classification and early response shapes). a
silently challenged or blocked request looks like "no vulnerability" from the
outside — surface it to the operator and to `campaign_next_action` rather than
grinding against it.

## breadth-before-depth stop rule

if a single asset has absorbed several probes with no new evidence, return to the
map: is there an unexplored subdomain, endpoint, parameter, role, or api version?
broaden first; only tunnel deeper when the surface is genuinely covered.

## routing

record with `campaign_asset` / `campaign_observe`; for parallel bounded recon use
the `recon` lane (`agent_spawn`) with non-overlapping ownership; keep the synthesized
surface model in the parent.
