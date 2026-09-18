---
name: owasp-mobile-top-10
description: Coverage of the OWASP Mobile Top 10:2024 risk classes for Android and iOS apps and how each maps to the MASVS control groups. Use to prioritise a mobile assessment by risk and to classify mobile findings; pair with mastg-mobile for the concrete MASVS/MASTG test process.
metadata:
  domain: offensive-security
  standards: "OWASP Mobile Top 10:2024, MASVS 2.1, MASTG"
  tier: spine
---

# owasp mobile top 10:2024

mobile risk is split between the client (on-device storage, binary, platform
apis) and the backend it talks to. use this list to prioritise; use
`mastg-mobile` for the MASVS-driven test process and `android-*` tooling to
execute. cite `M<n>:2024` on mobile findings.

## the ten (2024)

1. **M1 Improper Credential Usage** — hardcoded/embedded secrets, insecure
   credential storage or transmission. (MASVS-STORAGE/CRYPTO)
2. **M2 Inadequate Supply Chain Security** — vulnerable/malicious sdks, unsigned
   or tampered build/dependency pipeline. (MASVS-CODE/RESILIENCE)
3. **M3 Insecure Authentication/Authorization** — weak or client-side auth/authz,
   trusting the device, missing server checks. (MASVS-AUTH)
4. **M4 Insufficient Input/Output Validation** — injection, deep-link/intent and
   ipc abuse, unsafe webview bridges. (MASVS-PLATFORM/CODE)
5. **M5 Insecure Communication** — no/weak tls, missing pinning, cleartext,
   mixed channels. (MASVS-NETWORK)
6. **M6 Inadequate Privacy Controls** — over-collection, leaking pii via logs,
   clipboard, backups, or third parties. (MASVS-PRIVACY/STORAGE)
7. **M7 Insufficient Binary Protections** — no obfuscation/anti-tamper/anti-debug;
   easy reversing and patching. (MASVS-RESILIENCE)
8. **M8 Security Misconfiguration** — insecure defaults, exported components,
   debug flags, permissive manifest/entitlements. (MASVS-PLATFORM)
9. **M9 Insecure Data Storage** — sensitive data in shared prefs, sqlite, files,
   keychain/keystore misuse, world-readable storage. (MASVS-STORAGE)
10. **M10 Insufficient Cryptography** — weak algorithms, hardcoded keys, bad iv/
    randomness, home-grown crypto. (MASVS-CRYPTO)

## how to test in farai

- static first, then dynamic: pull the apk/ipa, inspect manifest/entitlements,
  exported components, storage, secrets, and network config; then run the app
  with instrumentation.
- android tooling: use the `android_*` tool family (device/emulator control,
  frida instrumentation, ui automation) to exercise M3/M4/M5/M7/M9 at runtime.
- backend counts: mobile apps talk to apis — run `owasp-api-top-10` against the
  captured backend traffic; many "mobile" findings are really api findings.
- classify with `M<n>:2024` plus the MASVS group; drive the process from
  `mastg-mobile`.

reference: https://owasp.org/www-project-mobile-top-10/ · https://mas.owasp.org/
