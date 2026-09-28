# Attribute Hygiene: No Invalid Questions to Cavalry

Current as of 28 September 2026. Status: **fixed in the bridge and verified
against a behavioural host model; the live before/after measurement on
Cavalry 2.7.2 has not been run yet** (it needs the macOS host).

## Problem

A live production benchmark log contained about 124,592 lines, 124,527 of them
errors. Almost all were `Attribute not found` reads issued by the MCP bridge:

| Family (live log) | Approx. count |
|---|---:|
| `animationCurve#N.uuid` | 92,529 |
| `textShape#N.out` | 7,484 |
| `basicShape#N.out` | 4,951 |
| `textShape#N.time` | 4,731 |
| `basicShape#N.time` | 3,135 |
| `timeMarker#N.uuid` | 1,011 |
| `keyframes.*`, `gradient.*`, stroke, matte, taper, animation-layer, rig-control paths | remainder |

The compiler itself sends 420–421 bridge operations for the same run, so the
invalid reads were not compiler work. They were produced around it.

## Trace: where the reads came from

All sources were in `cavalry/bridge.js`. No MCP-side (TypeScript) code path in
the benchmark issued generic attribute reads.

1. **Native change callbacks (dominant).** `ApplicationCallbacks.onAttrChanged`
   ran for every change notification Cavalry emits. It called
   `getLayerIdentity(layerId)`, which unconditionally read `.uuid`, and then
   `api.get(layerId, attrId)` for whatever attribute was notified. This
   happened whether or not any client had subscribed to events. Cavalry
   notifies changes on:
   - internal objects: an `animationCurve` per keyframed channel, `timeMarker`,
     render items, palette containers. None has a `uuid` attribute, so every
     notification produced `…uuid` errors. This explains `animationCurve#N.uuid`
     being about 74% of the log: each keyframe write notifies its curve several
     times.
   - non-value paths: graph output ports (`out`), evaluation `time`,
     keyframe/array helpers (`keyframes.N`), and configuration-dependent
     children (`gradient.N…`, stroke/matte/taper/animation-layer/rig-control).
     These appear as notifications even when the node's current configuration
     has no readable value there. This explains the same text layer being
     "queried" for properties that don't belong to it.
   `onLayerAdded` did the same identity read for every added object (curves,
   markers, render items).
2. **Identity everywhere assumed `.uuid`.** `getLayerIdentity` was used for
   affected-layer reporting on every response, and by `scene_inspect`,
   `layer_list`, `layer_find` and the composition handlers.
3. **Enumerate-then-read-everything.** `render_item_inspect` read every
   attribute the item enumerates, including non-value paths. The render
   pipeline's stale-item purge called it for every Render Manager item.
4. **Blind probes.** `layer_find` read `text` from every layer that didn't
   match by name, including shapes.
5. **Duplicate verification.** Batch post-conditions re-read every attribute
   that `attribute_set` / `attribute_set_many` had already read back. These
   reads were valid but doubled the read volume.

There is **no recursive curve serializer**. The explosion was driven by
notifications, not by traversal: it scaled with keyframe writes, not with
inspection depth.

## Fix: a positive capability registry

The bridge no longer discovers capabilities by reading an attribute and
waiting for Cavalry to throw.

- **Registry, cached by `(Cavalry version, node type)`.** The first time a
  node type is seen, Cavalry's own enumeration (`api.getAttributes`) is taken
  once and cached. 138 layers of three types cost three enumerations.
- **One read path.** Every `api.get` in the bridge goes through
  `readAttr(layer, path, mode)`. An offline contract test enforces that it is
  the only `api.get` call site.
  - `known`: internal reads. Only attributes the type enumerates, minus a
    safety-net pattern for non-value paths (`out`, `in`, `time`,
    `keyframes.*`).
  - `explicit`: a caller named the path. It is confirmed on that instance with
    `api.hasAttribute` (an authoritative query that doesn't fail). If
    unavailable, the bridge returns a structured `ATTRIBUTE_NOT_FOUND` and
    Cavalry is **not** asked.
  - `trusted`: the path was just written successfully (mutation readback), or
    it is a documented attribute read by a dedicated handler (composition
    range, marker time, render-item metadata).
- **Explicit identity.** UUID support is decided once per node type (known
  layer-id classes such as `animationCurve`, `timeMarker` and render items;
  otherwise positive membership in the active composition or
  `getAllSceneLayers`). Cavalry 2.7.2 reads `uuid` on ordinary scene layers but
  neither enumerates it nor returns true from `hasAttribute`. Each object's
  UUID is read at most once and cached. Caches are dropped when a scene is
  replaced or a layer is removed, because Cavalry reuses layer ids.
- **Notifications carry no reads.** `onAttrChanged` / `onLayerAdded` emit
  `{layerId, attribute}` / `{layerId, type}`. Only an explicit event
  subscription enriches them, and then only with enumerated value
  attributes. Nothing is read during batches or renders. Scene revision
  tracking is unchanged.
- **Inspection modes.** `scene_inspect` supports `summary` (identity only, the
  default), `detailed` (hierarchy, connections, and core transforms the type
  enumerates) and `targeted` (exactly the named attributes, with unavailable
  ones listed as `unsupported`). `render_item_inspect` accepts a targeted
  `attributes` list. The render pipeline asks only for `fileName`.
- **Verification verifies what was mutated.** Attribute post-conditions
  compare the handler's own readback with the requested values, so there is
  no second read. Keyframes are verified with `getKeyframeTimes`. A value
  Cavalry does not apply as requested still fails the step (covered by a
  test).
- **Pseudo-properties use their own APIs.** Keyframes through keyframe APIs,
  markers through create/remove plus bridge-owned marker state, graph ports
  through connection APIs. None of them is routed through attribute reads.

## Telemetry

`cavalry_health` → `attributeHygiene` (from the bridge):

| Counter | Meaning |
|---|---|
| `attributeReadRequests` | Reads requested through `readAttr` |
| `validAttributeReads` | Reads Cavalry answered |
| `invalidAttributeReads` | Reads the registry allowed that Cavalry rejected. **Target 0.** Each is also journaled as an `invalid_attribute` incident |
| `unsupportedReadsAvoided` | Requests answered from the registry without asking Cavalry |
| `trustedReads` | Mutation readbacks and documented handler reads |
| `capabilityCacheHits` / `capabilityCacheMisses` / `attributeEnumerations` | Registry effectiveness |
| `instanceAttributeChecks` | `hasAttribute` confirmations for client-named paths |
| `uuidLookups` / `uuidCacheHits` / `identitiesWithoutUuid` | Identity resolution |
| `nodeInspections`, `summary/detailed/targetedInspections` | Inspection volume by mode |
| `keyframeApiCalls`, `graphOperations` | Work routed to dedicated APIs |
| `eventNotificationsWithoutReads` / `eventEnrichmentReads` | Change notifications, and how many were enriched |

Incidents now carry a diagnostic `category`: `invalid_attribute`,
`invalid_graph_port`, `invalid_keyframe_operation`, `bridge_exception`,
`javascript_exception`, `render_error`, `timeout`, `authentication_error`,
`host_unavailable`, `unknown`. Capability discovery is not a category,
because it no longer relies on failures.

## Measurements

### Behavioural host model (offline, reproducible)

`tests/bridge/support/cavalry-model.ts` models the observed host contract:
failed `api.get` logs `Attribute not found`; enumeration and `hasAttribute`
don't; notifications fire for curves, markers and non-value paths. The real
`bridge.js` runs in a VM against it and replays the 55-scene workload through
the bridge protocol (`scripts/measure-attribute-probing.ts`): compile batches,
structural verify, correction by UUID, re-verify.

| Bridge | Model `Attribute not found` | Bridge ops | Layers | Keyframes |
|---|---:|---:|---:|---:|
| Before (`bbd2ae0`) | 14,612 | 420 | 138 | 2,095 |
| After | **0** | 420 | 138 | 2,095 |
| After, with a `*` event subscription | **0** | 420 | 138 | 2,095 |

The model reproduces the live log's families in the same order of dominance
(`animationCurve.uuid` ≫ `textShape.out` > `textShape.time` >
`basicShape.out/time` > `timeMarker.uuid`, then `keyframes.N`, `gradient.*`,
stroke/matte/taper). Absolute counts differ from the live 124,527 because
the model's notification multiplicity per keyframe is an estimate. These are
model counts, not host measurements. After the live corrections, the workload needs 4
capability enumerations, 139 UUID reads (one per created layer plus the
composition), and 15,659 notifications pass with no reads at all.

### Live before/after on Cavalry 2.7.2 (28 September 2026)

Both runs used the external stdio MCP client and the same 55-scene workload
(138 layers, 2,095 keyframes, 3,120 frames, 12 QC images and one applied
correction). The baseline was commit `bbd2ae0`; the after run used the fixed
branch from a fresh Cavalry launch.

| Measurement | Baseline | Fixed branch |
|---|---:|---:|
| Appended host-log lines | 55,403 | 55 in the flushed clean run |
| Host error lines | 55,366 | **0** |
| Complete `Attribute not found:` lines | 55,365, plus one truncated trailing record | **0** |
| Bridge invalid reads | not instrumented | **0** |
| Bridge operations / batches | 421 / 12 | 421 / 12 |
| Compile | 53,279.33 ms | 49,910.08 ms |
| Verify | 439.27 ms | 286.26 ms |
| QC (12 images) | 10,189.40 ms | 7,628.29 ms |
| Correction | 80.57 ms | 126.64 ms |
| Total | 64,392.16 ms | 58,425.45 ms |
| Peak sampled Cavalry RSS | 502,640 KiB | 564,000 KiB |
| JavaScript Error dialogs | 0 observed | 0 observed; 0 journal occurrences |

The baseline's largest complete families were `animationCurve.uuid` (37,430),
`textShape.out` (2,158), `textShape.time` (1,577), `basicShape.out` (1,485),
`basicShape.time` (1,045), `timeMarker.uuid` (990), and 55 unqualified
`color` errors. The log summarizer was corrected to count unqualified
`Attribute not found: color` lines as well as `type#N.path` lines.

The after timing row is the fresh, RSS-sampled clean run. A preceding clean
run independently flushed 4,096 bytes / 55 lines from Cavalry's buffered log
and contained zero errors; it measured 50,051.11 ms compile and 58,502.32 ms
total. `cavalry_health` subsequently measured an idle host with 55 ms
`host.probeMs`, 22 ms `bridge_status` latency and 71 ms whole-tool latency.
Those fields did not exist in the baseline, so there is no baseline health
probe comparison.

The lower after timings are measured, but a single baseline run is not enough
to attribute them to removal of invalid calls. Correction latency and sampled
RSS were higher, and the sampling points were not synchronized. Treat these
differences as host/run variance, not a demonstrated performance effect. One
additional benchmark on the same long-lived process timed out a 15-second QC
preview after compilation; health immediately returned to confirmed idle
(57 ms probe, 26 ms status), and a fresh restart completed cleanly. Attribute
hygiene did not regress, but this shows responsiveness is not proven improved.
