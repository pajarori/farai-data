# tool map — situation → best tool → why

## the standard chain

```text
discover → validate → map → probe → test → verify → record
```

1. **discover** (passive): `subdomain_enum` (domains), `url_discover` (historical
   urls). one deduplicated pass per source; do not retry a failed source with a
   shell variant.
2. **validate**: `dns_probe` (resolve candidates, wildcard filter), `http_probe`
   (live services, tech, cdn/waf), `tls_probe` (cert/san pivots), `port_scan`
   (open ports + service).
3. **map**: `web_crawl` (breadth-first endpoints, forms, xhr), `dir_enum` (hidden
   paths with FUZZ + wordlist).
4. **probe**: `http_request` (one exact request), `browser_*` (rendered/auth
   state), `vulnerability_scan` (pinned templates as leads).
5. **test**: `campaign_test` with baseline + mutation + oracle.
6. **verify**: independent `verify` lane; `callback_oast` for blind classes.
7. **record**: `campaign_asset` / `campaign_observe` / `evidence_save`.

## situation → tool

| situation | use | not |
|---|---|---|
| find subdomains / passive dns / ct | `subdomain_enum` | curl/amass loops |
| historical urls for an endpoint corpus | `url_discover` | crawling first |
| are these hosts alive, what tech/waf | `http_probe` | one-by-one curl |
| resolve + enrich hostnames | `dns_probe` | dig loops |
| open ports + services | `port_scan` (`mode=service`) | `nmap_scan` unless explicit ports/NSE |
| custom NSE / UDP / evasion | `shell_exec` nmap | typed port_scan |
| breadth-first endpoint map | `web_crawl` | browser for every page |
| hidden directories/files | `dir_enum` (FUZZ) | shell ffuf unless advanced matchers |
| advanced ffuf (recursion, matchers, multi-fuzz) | `shell_exec` ffuf | dir_enum |
| one exact method/header/body request | `http_request` | browser |
| rendered dom / js / login state | `browser_*` + named `browser_context` | http_request |
| two isolated identities | two `browser_context` + `email_*` | reusing one context |
| account signup / email verification / oob | `email_create` then `email_wait` | manual inbox guessing |
| template-signal scan | `vulnerability_scan` | assuming a match is a finding |
| cve / product / kev intel | `vulnerability_lookup` | guessing versions |
| local public exploit lookup | `exploit_search` | internet_search first |
| blind ssrf/xxe/cmd callback | `callback_oast` (unique token) | inferring from timing |
| catch a reverse shell / inbound | `callback_host_info` + `callback_listen` | guessing lhost inside container |
| inspect captured traffic | `proxy_sitemap` / `proxy_flows` / `proxy_flow_get` | re-issuing requests |
| replay a captured request with a change | `proxy_replay` | rebuilding by hand |
| intercept + modify live | `proxy_intercept` | — |
| capability with no typed tool | `shell_exec` + Kali catalog | inventing a tool name |

## ffuf / nmap quick reference (folded from tool tips)

- ffuf soft-404: when everything returns 200, filter by size/words (`-fs`/`-fw`)
  against a known-bad baseline, not status. start with a small wordlist; add
  stack-specific extensions once tech is known; recurse only into real hits.
- nmap two-pass: fast discovery `-n -Pn --top-ports 100 --open -T4 --max-retries 1
  --host-timeout 90s`, then enrich only discovered ports `-sV -sC -p <ports>
  --host-timeout 3m`. add `-Pn` when hosts look down (icmp filtered). prefer
  `port_scan` unless you need UDP/NSE/timing control.

## anti-patterns

- defaulting to `shell_exec` for something a typed tool does (loses normalization
  and campaign recording).
- re-requesting the same url through browser, proxy, and http_request to "confirm".
- enabling expensive modes (headless, cipher-enum, `-p-`, oast) before the
  objective needs them.
- launching parallel workers that hammer one target when a bounded probe suffices.
