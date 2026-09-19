# Cavalry Scripting API Notes & Introspection Reference

This document records the confirmed API capabilities, method signatures, schemas, and limitations of Cavalry's JavaScript runtime (`api.*`, `cavalry.*`, and `ui.*`), verified directly against Cavalry 2.7+ and official type definitions (`@scenery/cavalry-types`).

---

## 1. Runtime Architecture & Execution Context

Cavalry runs a JavaScript environment (QJSEngine / ECMAScript) with global namespaces:
* `api`: Core scene, layer, attribute, animation, composition, asset, and rendering operations.
* `cavalry`: Procedural math, noise (1D/2D/3D), color conversions, vector/matrix classes, and version comparisons.
* `ui`: UI dialogs, widgets (VLayout, HLayout, Button, Label, etc.), and script-triggering helpers.
* `console`: Standard logging (`log`, `warn`, `error`, `info`, `debug`).

### Network & Web Server
* `new api.WebServer()`: Built-in HTTP server listening on a local port.
  * `server.listen(host, port)`: Binds to address (default `127.0.0.1`, port `8080`).
  * `server.addCallbackObject(cb)`: Registers a callback object with `onPost()`.
  * `server.setRealtime()`: Configures poll rate to 60 Hz (~16ms latency).
  * `server.setHighFrequency()`: Configures poll rate to 1 Hz (1000ms).
  * `server.getNextPost()`: Pops the oldest `{ result: string, headers: Array<{name: string, value: string}> }` from queue.
  * `server.getNewestPost()`: Pops the newest entry.
  * `server.setResultForGet(resultText)`: Sets payload returned on HTTP `GET /get`.
  * `server.stop()`: Stops server.
* `new api.WebClient(origin)`: Built-in HTTP client for callbacks.
  * `client.post(path, content, contentType)`: Sends HTTP POST.

---

## 2. Introspection & Discovery APIs

### Layer Types
* `api.getAllLayerTypes(includeExperimental: boolean): Array<{name: string, type: string}>`: Discovers all available layer types dynamically at runtime.
* `api.isProLayerType(layerType: string): boolean`: Checks if a layer type requires a Cavalry Pro license.
* `api.getLayerType(layerId: string): string`: Returns the type of an existing layer.
* `api.getSuperTypes(layerId: string): string[]`: Returns inheritance hierarchy (e.g. `['shape', 'primitive', 'deformable']`).

### Attribute Introspection
* `api.getAttributes(layerId: string): string[]`: Lists all attribute paths on a layer.
* `api.getAttributeDefinition(layerId: string, attrId: string): object`: Returns rich metadata for an attribute:
  * `type`: Data type string (e.g. `'double'`, `'int'`, `'bool'`, `'string'`, `'color'`, `'double2'`, `'int2'`, `'vector3'`, `'enum'`, `'compound'`).
  * `default`: Default value.
  * `min`, `max`, `softMin`, `softMax`: Numeric bounds if applicable.
  * `isAnimatable`: Boolean flag indicating if keyframes can be placed.
  * `isReadOnly`: Boolean flag indicating if the attribute cannot be modified.
  * `isArray`: Boolean indicating if attribute is an array.
  * `isCompound`: Boolean indicating compound attribute.
  * `isDynamic`: Boolean indicating dynamic uniform attribute.
  * `children`: Array of child attribute names (e.g. `['x', 'y']` for `position`).
  * `enumValues`: Array of valid enum label strings if type is enum.
* `api.getAttrChildren(layerId: string, attrId: string): string[]`: Returns sub-attributes.
* `api.getAttrType(layerId: string, attrId: string): string`: Shorthand to get data type.

### Generator Introspection
* `api.getGenerators(layerId: string): string[]`: Returns generator slots on a layer (e.g. `'generator'` on `basicShape`).
* `api.getCurrentGeneratorType(layerId: string, generatorId: string): string`: Returns current generator type (e.g. `'ellipse'`, `'rectangle'`, `'polygon'`).
* `api.setGenerator(layerId: string, generatorId: string, generatorType: string): void`: Switches generator dynamically.

---

## 3. Stable Identities & UUID System

Cavalry assigns internal IDs such as `textShape#1` or `basicShape#3`. These can shift on reordering or project reloading.
* `api.get(layerId, 'uuid'): string`: Returns the immutable UUIDv4 string for any layer.
* `api.getLayerFromUUID(uuid: string): string`: Resolves current runtime layer ID from its UUID.
* `api.uuid(): string`: Generates a random UUIDv4 string.

The MCP server maintains dual indexing (`uuid` ↔ `layerId`) with caching and invalidation across project loads.

---

## 4. Layer & Hierarchy APIs

* `api.create(layerType: string, name?: string): string`: Creates a layer of any discovered type.
* `api.primitive(primType: string, name?: string): string`: Convenience creator for primitives.
* `api.rename(layerId: string, newName: string): void`: Renames a layer.
* `api.duplicate(layerId: string): string`: Duplicates a layer.
* `api.deleteLayers(layerIds: string[]): void`: Deletes layers.
* `api.parent(layerId: string, parentId: string): void`: Sets layer hierarchy parent.
* `api.unParent(layerId: string): void`: Moves layer up one hierarchy level.
* `api.getParent(layerId: string): string`: Gets parent layer ID.
* `api.getChildren(layerId: string): string[]`: Gets child layer IDs.
* `api.reorder(layerIdToReorder: string, underLayerId: string): void`: Reorders layer stack.
* `api.select(layerIds: string[]): void`: Sets editor selection.
* `api.getSelection(sortByHierarchyOrder?: boolean): string[]`: Gets selected layers.
* `api.getSelectionBoundingBox(worldSpace: boolean): {x: number, y: number, width: number, height: number}`: Computes geometry bounds.
* `api.getInFrame(layerId: string): number` / `api.setInFrame(layerId: string, frame: number): void`: Layer clip in-point.
* `api.getOutFrame(layerId: string): number` / `api.setOutFrame(layerId: string, frame: number): void`: Layer clip out-point.
* `api.isVisible(layerId: string, includeHierarchy: boolean): boolean`: Visibility state.
* `api.soloLayers(layerIds: string[]): void`: Replaces the current solo set. The scripting API does not expose a solo-state getter.
* `api.isShape(layerId: string): boolean`: Tests if layer has vector/mesh geometry.

---

## 5. Attribute Manipulation & Expressions

* `api.get(layerId: string, attrPath: string): unknown`: Reads current attribute value.
* `api.set(layerId: string, values: Record<string, unknown>): void`: Sets one or more attributes.
* `api.resetAttribute(layerId: string, attrPath: string): void`: Resets attribute to default.
* `api.hasAttribute(layerId: string, attrPath: string): boolean`: Validates path existence.
* `api.addDynamic(layerId: string, attrId: string, attrType: string): void`: Adds dynamic uniform attribute.
* `api.addArrayIndex(layerId: string, attrId: string): number`: Appends item to array attribute.
* `api.removeArrayIndex(layerId: string, attrPath: string): void`: Removes array item at path (e.g. `'array.1'`).
* `api.reorderArrayAttr(layerId: string, attrId: string, fromIndex: number, toIndex: number): void`: Reorders array items.
* `api.setAttributeExpression(layerId: string, attrId: string, expr: string): void`: Evaluates procedural math expression (e.g. `'*2'`, `'+100'`).
* `api.getAttributeExpression(layerId: string, attrId: string): string`: Reads expression.
* `api.hasAttributeExpression(layerId: string, attrId: string): boolean`: Checks expression.
* Cavalry does not expose a separate remove-expression function; set the expression to an empty string with `api.setAttributeExpression()`.

---

## 6. Procedural Graph Connections

* `api.connect(fromLayer: string, fromAttr: string, toLayer: string, toAttr: string, force?: boolean): void`: Connects output attribute to input attribute.
* `api.disconnect(fromLayer: string, fromAttr: string, toLayer: string, toAttr: string): void`: Disconnects specific wire.
* `api.disconnectInput(layerId: string, attrId: string): void`: Clears input wire.
* `api.disconnectOutputs(layerId: string, attrId: string): void`: Clears all output wires.
* `api.getInConnection(layerId: string, attrId: string): string`: Returns incoming connected layer/attribute string.
* `api.getOutConnections(layerId: string, attrId: string): string[]`: Returns all outgoing connection paths.
* `api.getInConnectedAttributes(layerId: string): string[]`: Returns all incoming connected attributes.
* `api.getOutConnectedAttributes(layerId: string): string[]`: Returns all outgoing connected attributes.

---

## 7. Keyframes, Béziers & Tangent Curves

* `api.keyframe(layerId: string, frame: number, attributes: Record<string, unknown>): string`: Sets keyframe at frame.
* `api.deleteKeyframe(layerId: string, attrPath: string, frame: number): void`: Deletes keyframe.
* `api.getKeyframeTimes(layerId: string, attrPath: string): number[]`: Returns array of keyframe frame numbers.
* `api.modifyKeyframe(layerId: string, dictionary: Record<string, {frame: number, newFrame?: number, newValue?: unknown, type?: number}>): void`:
  * `type`: Interpolation mode integer:
    * `0`: Bézier
    * `1`: Linear
    * `2`: Step
* `api.modifyKeyframeTangent(layerId: string, dictionary: Record<string, KeyframeTangentOptions>): void`:
  * `frame`: number (required).
  * `inHandle`: boolean (optional).
  * `outHandle`: boolean (optional).
  * `angleLocked`: boolean.
  * `weightLocked`: boolean.
  * `angle`: number (tangent angle in degrees; 0 is flat).
  * `weight`: number (tangent weight length).
  * `xValue`: number (absolute X frame coordinate for handle).
  * `yValue`: number (absolute Y value coordinate for handle).
* `api.setKeyframeVelocity(layerId: string, dictionary: Record<string, {frame: number, leftSpeed?: number, rightSpeed?: number, leftInfluence?: number, rightInfluence?: number}>): void`:
  * Sets exact incoming (`left`) and outgoing (`right`) speeds and influences (0.01..1.0).
* `api.clearKeyframeVelocity(layerId: string, dictionary: Record<string, {frame: number}>): void`: Resets velocity.
* `api.magicEasing(layerId: string, attrPath: string, frame: number, easingType: string): void`:
  * Applies documented easing presets including `SlowIn`, `SlowOut`, `SlowInSlowOut`, `SpringIn`, `SpringOut`, `OvershootOut`, `BounceIn`, `BounceOut`, and `None`.

---

## 8. Compositions & Pre-Compositions

* `api.getActiveComp(): string`: Returns current composition ID.
* `api.setActiveComp(compId: string): void`: Sets active composition.
* `api.getComps(): string[]`: Lists all compositions in project.
* `api.createComp(name: string): string`: Creates a new composition.
* `api.preCompose(name?: string): string`: Precomposes selected layers into a new composition reference.
* `api.getCompFromReference(refLayerId: string): string`: Resolves original comp ID from a composition reference layer.
* `api.createCompReference(compId: string): string`: Adds a reference of an existing comp into the active comp.
* `api.addPreCompOverride(layerId: string, attrPath: string): void`: Promotes attribute to reference override.
* `api.removePreCompOverride(layerId: string, attrPath: string): void`: Removes override.
* `api.listPreCompOverrides(refId: string): string[]`: Lists active overrides.

---

## 9. Paths & Vector Geometry

* `api.makeEditable(primId: string, makeCopy: boolean): string`: Converts primitive shape to editable shape.
* `api.getEditablePath(layerId: string, worldSpace: boolean): EditableContour[]`:
  * Returns array of contours:
    ```typescript
    interface EditablePoint {
      position: { x: number; y: number };
      inHandle?: { x: number; y: number; selected?: boolean };
      outHandle?: { x: number; y: number; selected?: boolean };
      weightLocked?: boolean;
      angleLocked?: boolean;
      selected?: boolean;
    }
    interface EditableContour {
      points: EditablePoint[];
      isClosed: boolean;
    }
    ```
* `api.setEditablePath(layerId: string, worldSpace: boolean, pathObject: EditableContour[]): void`: Sets points and Bézier handles.
* `api.centrePivot(layerId: string, doCentroid: boolean): void`: Centers transformation pivot on bounding box or centroid.
* `api.convertSVGToLayers(filePath: string): string[]`: Converts an external SVG directly into native editable geometry layers.

---

## 10. Assets, Audio & Markers

### Assets
* `api.loadAsset(filePath: string, isSequence: boolean): string`: Imports PNG, JPG, WebP, SVG, MP4, MOV, WAV, MP3, etc.
* `api.reloadAsset(assetId: string): void`: Refreshes disk content.
* `api.replaceAsset(assetId: string, newPath: string): void`: Swaps file path.
* `api.addAssetToComp(assetId: string): string`: Places asset footage into active composition.
* `api.getAssetType(assetId: string): string`: Returns asset category (`image`, `audio`, `movie`, `svg`, etc.).
* `api.getAssetFilePath(assetId: string): string`: Returns source path.
* `api.getAssetWindowLayers(topLevel: boolean): string[]`: Lists asset library items.

### Time Markers
* `api.createTimeMarker(frame: number): string`: Creates marker on timeline.
* `api.getTimeMarkers(): string[]`: Lists all markers in active comp.
* `api.removeTimeMarker(markerId: string): void`: Removes marker.
* `api.set(markerId, { label: '...', time: frame, color: '#...' })`: Updates marker attributes.

---

## 11. Serialization & Checkpoints

* `api.serialise(layerIds: string[], withConnections: boolean): string`: Exports layers and their network as JSON.
* `api.deserialise(jsonString: string): void`: Deserializes and instantiates layers into the active scene.
* `api.exportSceneAs(filePath: string): boolean`: Saves complete project file `.cv`.
* `api.exportSelected(filePath: string): boolean`: Saves selected component `.cvc`.
* `api.importScene(filePath: string): void`: Imports `.cv` or `.cvc`.
* `api.newScene(): void`: Clears scene to blank state.
* `api.openScene(path: string, force?: boolean): void`: Opens saved `.cv` file.
* `api.saveScene(): boolean`: Saves in place.
* `api.saveSceneAs(filePath: string): boolean`: Saves to new path.
* `api.sceneHasUnsavedChanges(): boolean`: Checks dirty state.

---

## 12. Previewing & Rendering

* `api.renderPNGFrame(filePath: string, scalePercentage: number): void`: Renders current frame to PNG file at specified scale (e.g. 50%, 100%, 200%).
* `api.renderSVGFrame(filePath: string, scalePercentage: number, skipComps?: boolean): void`: Renders current frame as vector SVG.
* `api.saveViewportContentsAsImage(filePath: string): void`: Fast grab of current viewport screen buffer.
* `api.addRenderQueueItem(compId: string): string`: Adds composition to Render Manager.
* `api.getRenderQueueItems(): string[]`: Returns all items in Render Manager.
* `api.render(renderQueueItemId: string): void`: Executes render for specific item.
* `api.renderAll(): void`: Executes all active Render Manager items.
* `api.cancelRender(): void`: Cancels active render.
* `api.backgroundRender(itemId: string): void`: Starts background export.

---

## 13. Identified Scripting Gaps & Editor Limitations

| Capability | Scriptable in Cavalry? | Fallback / Workaround |
|---|---|---|
| **Headless CLI in Cavalry 2.7+** | ❌ Removed in 2.7+ | Automation requires running Cavalry GUI with bridge script active. |
| **Undo / Redo** | ❌ No `api.undo()` / `api.redo()` | Handled via scene snapshots, `api.serialise()`, or project checkpoints (`scene_checkpoint`). |
| **Interactive Viewport Pan/Zoom** | ❌ Viewport camera transform is internal | Physical Camera layers (`api.create('camera')`) are fully scriptable. |
| **Silent Playhead Audio Scrubbing** | ⚠️ Frame scrubbing is silent | `api.play()` plays audio in real-time; audio analysis is assisted by local MCP probe tools. |
| **Interactive File Dialog Bypass** | ⚠️ Native dialogs block execution | All MCP tools provide explicit file paths to `api.loadAsset`, `saveSceneAs`, etc. |
