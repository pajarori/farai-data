---
name: mastg-mobile
description: The OWASP MASVS 2.1 control groups and the MASTG static/dynamic test process for Android and iOS apps — how to verify each control group and drive it with farai android tooling. Use as the methodology spine for a mobile app assessment; pair with owasp-mobile-top-10 for risk ranking.
metadata:
  domain: offensive-security
  standards: "MASVS 2.1, MASTG, OWASP Mobile Top 10:2024"
  tier: spine
---

# masvs 2.1 + mastg (mobile)

masvs defines *what* a mobile app must satisfy (control groups); mastg is the
*how* (concrete tests per platform). use masvs as the coverage spine and cite the
`MASVS-<GROUP>` id on findings alongside `M<n>:2024`.

## the seven control groups (masvs 2.1)

- **MASVS-STORAGE** — sensitive data at rest: shared prefs, sqlite, files,
  keystore/keychain, backups, logs, clipboard. no secrets in world-readable or
  backed-up storage.
- **MASVS-CRYPTO** — correct algorithms, key management, randomness; no hardcoded
  keys or home-grown crypto.
- **MASVS-AUTH** — authentication and authorization enforced server-side; secure
  local auth (biometric) binding; session handling.
- **MASVS-NETWORK** — tls everywhere, certificate/public-key pinning, no
  cleartext, safe trust config.
- **MASVS-PLATFORM** — platform interaction: exported components, intents/deep
  links, ipc, webviews and js bridges, permissions, screen protections.
- **MASVS-CODE** — code quality and supply chain: input handling, dependency
  hygiene, memory safety, patched runtimes.
- **MASVS-RESILIENCE** — anti-tamper, anti-debug, obfuscation, root/jailbreak
  detection, integrity of the binary (defense in depth, not primary control).

## test process

1. **acquire & triage.** obtain the apk/ipa. static: unpack, read the manifest /
   Info.plist + entitlements, list exported components, permissions, network
   security config, embedded secrets and endpoints, third-party sdks.
2. **static review (STORAGE/CRYPTO/CODE/PLATFORM).** decompile; check storage
   paths, crypto usage, hardcoded keys/urls, deep-link/intent handlers, webview
   bridges, debuggable/backup flags.
3. **dynamic (AUTH/NETWORK/PLATFORM/RESILIENCE).** run on device/emulator with
   instrumentation: intercept traffic (verify tls + pinning), inspect runtime
   storage, exercise exported components and deep links, hook with frida to test
   auth/authz trust and to assess resilience controls.
4. **backend.** proxy the app's api and run `owasp-api-top-10` — server-side
   authz (M3/API1/API5) is usually where the real impact is.

## driving it in farai

- use the `android_*` tool family: device/emulator management, frida dynamic
  instrumentation (frida is loaded dynamically via tools, not baked into the
  image), and ui automation.
- prefer static extraction first (fast, non-interactive → delegate a subagent),
  then dynamic on a controlled device.
- classify each finding with `MASVS-<GROUP>` + `M<n>:2024`; keep exact evidence
  (paths, decompiled snippet, intercepted request) and a reproduction.

reference: https://mas.owasp.org/MASVS/ · https://mas.owasp.org/MASTG/
