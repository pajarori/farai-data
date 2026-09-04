# xss context → breakout reference

identify the exact context of the reflection, then use its breakout. confirm
execution in a `browser_context`.

## html element body
- context: `<div>INPUT</div>`.
- breakout: `<img src=x onerror=...>`, `<svg onload=...>`, `<script>`.

## html attribute
- context: `<input value="INPUT">`.
- breakout: close the quote/tag: `"><svg onload=...>`; or add an event handler if the
  tag stays: `" onmouseover=... x="`.
- unquoted attribute: inject a new attribute with whitespace.

## javascript string
- context: `var x = "INPUT";`.
- breakout: `"; <payload>; //` or `</script>` to leave js context entirely.
- watch escaping of quotes/backslashes; try unicode escapes.

## url / href / src
- context: `<a href="INPUT">` or `location = INPUT`.
- breakout: `javascript:` scheme, `data:` where allowed; open-redirect gadget.

## css / style
- context: `style="INPUT"` or `<style>INPUT</style>`.
- breakout: `expression()` on legacy, `url()` exfil, attribute injection.

## dom sinks (source → sink)
- sources: `location.hash`, `location.search`, `document.referrer`,
  `window.name`, `postMessage` data.
- sinks: `innerHTML`, `outerHTML`, `document.write`, `insertAdjacentHTML`, `eval`,
  `setTimeout(string)`, `Function`, jquery `$()`/`.html()`, framework template
  bindings.
- test: set the source (e.g. navigate to `#<payload>`), watch the sink execute.

## framework specifics
- angular/vue template injection in interpolation contexts (`{{ }}`) → sandbox
  escapes / expression evaluation.
- react: `dangerouslySetInnerHTML`, `href={userInput}` with `javascript:`.
- avoid assuming a framework auto-escapes every sink — test the actual binding.

## csp-aware
- read the `Content-Security-Policy`; look for `unsafe-inline`, wildcard hosts, a
  jsonp endpoint, or an allowed cdn you can abuse. a strict csp narrows but rarely
  closes every sink — find one it permits, or downgrade to a non-script effect
  (data exfil, dom manipulation) that still proves impact.

## proof (never skip)
- fired `alert`/`prompt`/`confirm` observed via `browser_wait_for` on a dialog, or
- a dom node you injected present in `browser_snapshot`, or
- an exfil request to a unique `callback_oast` token.
- for stored xss, the trigger fires in a *separate victim* `browser_context`.
