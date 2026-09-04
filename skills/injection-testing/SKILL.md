---
name: injection-testing
description: Test injection vulnerabilities through context, parser, and sink reasoning — SQL, NoSQL, command, code, template (SSTI), header, path, and SSRF. Use when attacker input reaches a query, interpreter, filesystem, or outbound request, and adaptive variants are needed rather than default scanner payloads. This is OWASP Top 10:2025 A05.
metadata:
  domain: offensive-security
  standards: "OWASP Top 10:2025 A05, WSTG-INPV"
  tier: playbook
---

# injection testing

injection is a reasoning task, not a payload-spray task. model where input goes,
observe how the parser treats a probe, then choose the next mutation from evidence.
scanners confirm an already-observed sink; they do not start the hypothesis.

## mental map

```text
input → decoding → normalization → parser → filter/WAF → sink → observable effect
```

find the input location and its *syntax context* (sql string vs identifier, shell
arg vs option, html attribute vs js, template expression, path segment, header
value). the context decides the breakout.

## setup

establish a baseline (benign value) and a negative control (a syntactically-invalid
payload). one input, one mutation at a time.

## method — classify then mutate

send a standard probe and classify the response:
`no consumption · syntax change/error · sanitized · filter block · parser difference
· timing delta · semantic effect`.

then choose the next family from that evidence:
- context breakout (close the quote/bracket/tag/expression).
- encoding (url, double, unicode, hex, base64) and normalization abuse.
- comments / whitespace / case variation.
- type confusion (string↔array↔object; nosql operators like `$ne`, `$gt`).
- duplicate/ordered parameters, parameter pollution.
- method / content-type variation to hit a different parser.
- alternate injection point reaching the same sink.

use PayloadsAllTheThings-style technique families as sources, not random spraying.
`vulnerability_scan` and `shell_exec` sqlmap are instruments *after* a sink/context is
observed and bound to a hypothesis.

## per-class notes

- **sql**: error-based (extract a known value) vs blind boolean/time differential.
- **nosql**: operator injection in json/query; auth bypass via `$ne`/`$gt`/regex.
- **command**: separators, subshell, oob callback; distinguish from ssti.
- **ssti**: engine-specific expression (`{{7*7}}`, `${...}`, `<%= %>`) producing a
  computed value; then escalate to rce carefully within scope.
- **header/host**: host-header routing, `X-Forwarded-*`, crlf/response splitting.
- **path/lfi**: traversal, wrappers, null/encoding; require reading an authorized
  sentinel file.
- **ssrf**: input that fetches a url/host → aim at a unique `callback_oast` token;
  in-scope internal targets only. (access-control-testing also covers ssrf reach.)

## validation

reflection or a scanner hit is a candidate. require a category oracle
(`evidence-and-validation` / `resources/oracles.md`): a computed/extracted value, an
out-of-band `callback_oast` from the target, or a repeated boolean/time differential
against a clean control. minimum evidence `differential_observed` (blind) →
`impact_demonstrated`.

## failure / adapt

a blocked family records the observed parser/filter behavior and selects a
*different grounded family* — never a global "no injection here". a WAF block is a
signal about the filter, not about the sink.

## routing

`campaign_hypothesis` per context/sink; `campaign_test` per mutation family;
validate before claiming. rce/ssrf primitives feed `vulnerability-chaining`.
resource: `resources/bypass-ladders.md`.
