# Knowledge refresh operations

## Commands

```bash
npm run knowledge:bootstrap
npm run knowledge:ingest-api -- --path=/path/to/api-metadata.json --version=2.7.2
npm run knowledge:ingest-docs -- --path=/path/to/permitted/docs --version=2.7.2
npm run knowledge:ingest-scenes -- --path=/path/to/inspection-json --project=my-project
npm run knowledge:ingest-scripts -- --path=/path/to/script-records --project=my-project
npm run knowledge:ingest-recipes -- --path=/path/to/recipes
npm run knowledge:ingest-failures -- --path=/path/to/failures --project=my-project
npm run knowledge:ingest-components -- --path=/path/to/components --project=my-project
npm run knowledge:reindex
npm run knowledge:status
npm run knowledge:verify
```

`knowledge:ingest-scenes` accepts JSON produced from Cavalry inspection. It refuses raw `.cv` parsing. Scripts are JSON records and remain data during ingestion.

## Incremental behavior

Each semantic section has a stable source/section ID and SHA-256 content hash. Unchanged content is skipped. Changed sections are replaced while retaining their original creation time. Sections removed from a single ingested document are deleted. Store writes use a temporary file followed by an atomic rename.

`knowledge_refresh` reads configured local source staging under `knowledge/sources`. Network crawling is deliberately not part of an ordinary MCP refresh; acquiring remote material requires an explicit, licensed corpus workflow.

## Verification workflow

1. Ingest as unverified.
2. Check assumptions against the connected Cavalry version and runtime capability list.
3. Validate with structured MCP operations where possible.
4. Verify actual scene state.
5. Render and inspect when the outcome is visual.
6. Record the validation checks and only then mark a script, scene, or outcome verified.

`knowledge:verify` runs a health audit; it does not execute unverified code. Live Cavalry acceptance tests remain a separate integration workflow.
