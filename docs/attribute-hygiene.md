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
  otherwise enumeration, then `hasAttribute`). Each object's UUID is read at
  most once and cached. Caches are dropped when a scene is replaced or a
  layer is removed, because Cavalry reuses layer ids.
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
  markers through marker APIs, graph ports through connection APIs. None of
  them is routed through attribute reads.

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
model counts, not host measurements. After the fix, the workload needs 3
capability enumerations, 139 UUID reads (one per created layer plus the
composition), and 15,659 notifications pass with no reads at all.

### Live before/after: not yet measured

The live comparison (host error count, invalid reads, compile, verify and QC
time, responsiveness, JavaScript dialog frequency, render behaviour) must be
run on the macOS Cavalry host:

```bash
npm run build
# install the updated bridge
cp cavalry/bridge.js ~/Library/Application\ Support/Cavalry/Scripts/CavalryBridge.js
# relaunch Cavalry so the new bridge is active, then:
npm run hygiene:live -- --cavalry-log "<path to Cavalry's log file>"
npm run benchmark:motion:live -- --cavalry-log "<path to Cavalry's log file>"
```

The live benchmark now snapshots the bridge's attribute counters and
(optionally) the Cavalry log window from before the first project call to
after the last. It **fails** if `invalidAttributeReads > 0` or the log gained
any `Attribute not found` line. To record a baseline with an older bridge,
pass `--allow-invalid-probing`. Genuine errors in the log window are listed
separately (`firstNonAttributeErrors`), so they stay visible.

No causal claim is made yet about compile time, host responsiveness, render
startup or the zero-byte H.264 issue. Those comparisons wait for the live
run, and render debugging resumes only after the benchmark logs zero expected
`Attribute not found` errors.
