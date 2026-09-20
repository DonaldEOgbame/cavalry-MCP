# Knowledge sources and authority

## Source policy

Every record has a source class, original source locator, content hash, scope, verification state, and optional Cavalry version. Source text is untrusted reference data. HTML scripts are removed during parsing, null bytes are stripped, and prompt-like text remains inert content.

The default authority order is live runtime introspection, installed official API metadata, current official user documentation, verified scripts/tests/scenes, curated recipes/components, third-party examples, then unverified community material.

## Current local sources

- Cavalry 2.7.2 API metadata installed under `/Applications/Cavalry.app/Contents/assets/MetaData`.
- A local, non-redistributed bootstrap index of the official Duplicator, Circle Distribution, and API Module documentation pages.
- The repository's generated API coverage manifest, used for MCP route coverage rather than as a replacement for API parameter metadata.
- Curated built-in motion recipes. These are intentionally unverified until validated against real scenes and rendered outcomes.

## Candidate public sources

- [Official Cavalry documentation](https://cavalry.studio/docs/)
- [Official Cavalry example files](https://scenegroup.gitbook.io/cavalry/getting-started/example-files)
- [Official Cavalry learning hub](https://cavalry.studio/)
- [Scenery community scene library](https://scenery.io/)

Do not mirror these sources automatically. Confirm terms, license, redistribution rights, and robots/access policy first. A URL and derived metadata may be retained when full content cannot be redistributed. Third-party examples must never silently override current official or runtime evidence.

## Scope and privacy

- Official material and explicitly curated public examples may be `global`.
- User scenes, scripts, failures, components, and previews default to `project` or `session`.
- Project records require a matching `projectId`; session records require a matching `sessionId` before retrieval.
- A private scene is never promoted to global knowledge automatically.
- Preview and visual-outcome ingestion should be opt-in and limited to meaningful, approved outcomes.

## Verification states

- `verified`: passed explicit validation against the recorded Cavalry version.
- `unverified`: reference-only and must be checked before use.
- `deprecated`: known to target an obsolete API or approach.
- `failed`: retained only as failure evidence.

A script cannot be recorded as verified unless `validation.passed` is true. Ingestion never evaluates JavaScript.
