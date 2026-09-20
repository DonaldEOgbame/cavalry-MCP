# Cavalry Knowledge Engine

## Purpose

The Knowledge Engine is a planning subsystem for Cavalry-specific engineering knowledge. It does not mutate a scene and it does not execute retrieved scripts. Its job is to help a planner choose a Cavalry-native construction strategy, then validate that strategy against the MCP and the connected Cavalry version.

## Architecture

```text
sources -> semantic ingestion -> typed records -> local document store
                                      |               |
                                      v               v
                               graph fingerprints  hybrid retrieval
                                                       |
                  runtime capabilities + MCP coverage -+
                                                       v
                                                motion_plan
```

Records keep their source class, scope, version, verification state, content hash, provenance, entities, operations, tags, and optional structured payload. Structured payloads include APIs, scenes, scripts, recipes, failures, components, and visual outcomes.

The collections are logically separate even though the default local adapter persists them in one atomic JSON document. This keeps installation dependency-free and compatible with Node 18. The `DocumentKnowledgeStore` boundary is the migration seam for SQLite or another local store when corpus measurements justify it.

## Retrieval

Retrieval uses deterministic local hash embeddings, keyword and title matching, structured filters, normalized graph similarity, source authority, verification state, Cavalry version compatibility, and modest recency weighting.

The local embedding is replaceable through `EmbeddingProvider`. `CAVALRY_KNOWLEDGE_EMBEDDING_MODE=remote` enables a configurable HTTP embedding endpoint, with an automatic same-dimension local fallback when the service is unavailable. If embeddings are missing or regenerated, keyword and metadata search still work. Duplicate content hashes collapse at query time, favoring the more authoritative source. Important official/community conflicts are surfaced instead of silently blended.

## Scene graph model

Scene inspections become normalized graphs containing nodes, connections, hierarchy edges, generator types, animated attributes, super types, and semantic roles when known. Volatile layer IDs and names do not participate in fingerprints. Similarity is a weighted comparison of topology, node types, generators, animated attributes, super types, and roles.

Raw `.cv` files are not reverse-engineered. A scene must be inspected through Cavalry and saved as an inspection JSON record before ingestion. This avoids undocumented binary parsing and prevents source-scene mutation.

## Planning and execution boundaries

`motion_plan` searches recipes, scenes, official/API knowledge, and failure memory, then filters suggested MCP operations through the local tool inventory and optional live Cavalry capabilities. It prefers procedural patterns for repeated, radial, grid, staggered, and wave-like work, but does not force procedural construction for simple edits.

Knowledge retrieval is advisory. It grants no permission to execute code or mutate scenes. Raw scripts remain governed by the separate `CAVALRY_ALLOW_RAW_SCRIPT` permission boundary.

## Storage and performance

The default index is `knowledge/generated/knowledge-index.json`, written atomically with owner-only permissions. Content hashes make ingestion incremental. The generated index is local and ignored by Git because it may contain private project or session records.

The current store is intended for a local corpus in the low thousands of records. Before larger corpora are adopted, benchmark startup, index write amplification, and query latency. Migrate metadata to SQLite and vectors to an optional local ANN index only when measurements show the JSON adapter is insufficient.
