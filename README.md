# farai data

versioned knowledge and skill releases for farai.

the repository is the source of truth for content metadata and release manifests. large generated artifacts stay in github releases instead of git history.

## layout

- `manifest.json` is the source template; published releases expose the active manifest as a release asset consumed by farai.
- `schema/manifest.schema.json` documents the manifest contract.
- `sources.json` records source URLs, licenses, and attribution.
- `releases/` contains human-readable release notes and validation metadata.

## release artifacts

each release publishes these assets:

- `manifest.json`
- `knowledge.db`
- `skills.tar.gz`
- `checksums.txt`

the manifest carries sha256 and size for every artifact. farai downloads into a private staging directory, verifies all metadata, validates the sqlite database, then atomically activates the version.

## local development

set `FARAI_CONTENT_MANIFEST_URL` to a local `file://` manifest or an https URL. `FARAI_CONTENT_DIR` can point at a disposable content store while developing the updater.
