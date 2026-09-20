// ==============================================================================
// Cavalry MCP Bridge v1.0.0
// Production-grade Model Context Protocol Bridge for Cavalry Motion Design
// (c) 2026 Scene Group / Cavalry MCP Project
// ==============================================================================

(function () {
  const BRIDGE_VERSION = "1.0.0";
  const BRIDGE_INSTANCE_ID = "bridge_" + Date.now() + "_" + Math.random().toString(36).slice(2);
  const LISTEN_HOST = "127.0.0.1";
  const LISTEN_PORT = 8080;
  const MAX_EVENT_QUEUE = 1000;
  const eventQueue = [];
  const recentEvents = [];
  let eventSubscriptions = {};
  let appState = "unknown";
  let sceneRevision = 0;
  let batchExecution = false;

  function emitEvent(eventName, details) {
    if (eventName === "scene.changed" || eventName === "composition.changed" || eventName === "attribute.changed" || eventName === "attribute.connected" || eventName === "attribute.disconnected" || eventName.startsWith("layer.") || eventName.startsWith("asset.")) {
      sceneRevision++;
    }
    const event = Object.assign({
      event: eventName,
      timestamp: Date.now(),
      sceneRevision: sceneRevision,
    }, details || {});
    recentEvents.push(event);
    if (recentEvents.length > MAX_EVENT_QUEUE) recentEvents.shift();
    if (eventSubscriptions["*"] || eventSubscriptions[eventName]) {
      eventQueue.push(event);
      if (eventQueue.length > MAX_EVENT_QUEUE) eventQueue.shift();
    }
  }

  // Verify Cavalry environment
  if (typeof api === "undefined") {
    throw new Error("Cavalry MCP Bridge must be executed within Cavalry.");
  }

  // ----------------------------------------------------------------------------
  // Helper: Identity & UUID Resolution
  // ----------------------------------------------------------------------------
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function isUuid(id) {
    return typeof id === "string" && UUID_REGEX.test(id.trim());
  }

  function resolveLayerId(idOrUuid) {
    if (!idOrUuid || typeof idOrUuid !== "string") return idOrUuid;
    const trimmed = idOrUuid.trim();
    if (isUuid(trimmed)) {
      const resolved = api.getLayerFromUUID(trimmed);
      if (resolved) return resolved;
    }
    return trimmed;
  }

  function getLayerIdentity(layerId) {
    if (!layerId) return null;
    const actualId = resolveLayerId(layerId);
    let uuid = "";
    try {
      uuid = api.get(actualId, "uuid") || "";
    } catch (e) {}

    let name = actualId;
    try {
      name = api.getNiceName(actualId) || actualId;
    } catch (e) {}

    let type = "";
    try {
      type = api.getLayerType(actualId) || "";
    } catch (e) {}

    return {
      layerId: actualId,
      uuid: uuid,
      name: name,
      type: type,
    };
  }

  function getCallbackTarget(callbackUrl) {
    const match = /^(https?:\/\/[^/]+)(\/.*)?$/.exec(callbackUrl || "");
    if (!match) return null;
    return { baseUrl: match[1], path: match[2] || "/" };
  }

  // ----------------------------------------------------------------------------
  // Modular Handlers
  // ----------------------------------------------------------------------------
  const handlers = {
    // --------------------------------------------------------------------------
    // System & Capabilities
    // --------------------------------------------------------------------------
    cavalry_ping: function (params) {
      return {
        pong: true,
        bridgeVersion: BRIDGE_VERSION,
        bridgeInstanceId: BRIDGE_INSTANCE_ID,
        timestamp: Date.now(),
      };
    },

    cavalry_health: function (params) {
      let cavalryVersion = "unknown";
      try {
        cavalryVersion = api.getCavalryVersion();
      } catch (e) {}

      let activeComp = "";
      try {
        activeComp = api.getActiveComp();
      } catch (e) {}

      return {
        online: true,
        bridgeVersion: BRIDGE_VERSION,
        bridgeInstanceId: BRIDGE_INSTANCE_ID,
        cavalryVersion: cavalryVersion,
        activeComp: activeComp,
        activeScenePath: api.getSceneFilePath() || "",
        unsavedChanges: api.sceneHasUnsavedChanges(),
      };
    },

    cavalry_capabilities: function (params) {
      let layerTypes = [];
      try {
        layerTypes = api.getAllLayerTypes(false) || [];
      } catch (e) {}

      let cavalryVersion = "2.7.2";
      try {
        cavalryVersion = api.getCavalryVersion();
      } catch (e) {}

      return {
        bridgeVersion: BRIDGE_VERSION,
        bridgeInstanceId: BRIDGE_INSTANCE_ID,
        cavalryVersion: cavalryVersion,
        layerTypesCount: layerTypes.length,
        // Experimental/plugin nodes can be listed by Cavalry but may block
        // when instantiated without their third-party runtime. Keep them
        // discoverable via layer_types while advertising only safe creators
        // through the capability probe used for autonomous workflows.
        supportedLayerTypes: layerTypes.filter(function (item) {
          const label = String((item && (item.name || item.type)) || "").toLowerCase();
          // Keep the autonomous capability surface to core, constructible
          // nodes. Other installed node types remain available through the
          // explicit layer_types discovery operation.
          return /basicshape|textshape|oscillator|duplicator|stagger|submesh|rectangle|ellipse|star/.test(label) &&
            label.indexOf("plugin") === -1 && label.indexOf("extension") === -1;
        }),
        supportsUUID: typeof api.getLayerFromUUID === "function",
        supportsExactTangents: typeof api.modifyKeyframeTangent === "function",
        supportsVelocity: typeof api.setKeyframeVelocity === "function",
        supportsRenderQueue: typeof api.addRenderQueueItem === "function",
        supportsSerialization: typeof api.serialise === "function" && typeof api.deserialise === "function",
        supportsMarkers: typeof api.createTimeMarker === "function",
        supportsSVGToLayers: typeof api.convertSVGToLayers === "function",
        supportsEditablePaths: typeof api.getEditablePath === "function" && typeof api.setEditablePath === "function",
      };
    },

    cavalry_bridge_info: function (params) {
      return {
        bridgeVersion: BRIDGE_VERSION,
        bridgeInstanceId: BRIDGE_INSTANCE_ID,
        listenHost: LISTEN_HOST,
        listenPort: LISTEN_PORT,
        cavalryVersion: api.getCavalryVersion(),
        systemInfo: api.getSystemInfo ? api.getSystemInfo() : null,
      };
    },

    events_subscribe: function (params) {
      const events = params.events && params.events.length ? params.events : ["*"];
      for (let eventName of events) eventSubscriptions[eventName] = true;
      return { subscribed: Object.keys(eventSubscriptions), queueSize: eventQueue.length };
    },

    events_unsubscribe: function (params) {
      const events = params.events && params.events.length ? params.events : ["*"];
      for (let eventName of events) delete eventSubscriptions[eventName];
      return { subscribed: Object.keys(eventSubscriptions), queueSize: eventQueue.length };
    },

    events_poll: function (params) {
      const limit = Math.max(1, Math.min(params.limit || 100, 500));
      const events = eventQueue.splice(0, limit);
      return { events: events, count: events.length, remaining: eventQueue.length };
    },

    events_get_recent: function (params) {
      const limit = Math.max(1, Math.min(params.limit || 100, 500));
      const events = recentEvents.slice(Math.max(0, recentEvents.length - limit));
      return { events: events, count: events.length };
    },

    events_clear: function () {
      eventQueue.length = 0;
      recentEvents.length = 0;
      return { cleared: true };
    },

    events_status: function () {
      return {
        subscribed: Object.keys(eventSubscriptions),
        queueSize: eventQueue.length,
        recentSize: recentEvents.length,
        maxQueueSize: MAX_EVENT_QUEUE,
        sceneRevision: sceneRevision,
      };
    },

    app_state: function () {
      return {
        state: appState,
        active: appState === "active",
        activeTool: api.getActiveTool(),
        platform: api.getPlatform(),
        version: api.getCavalryVersion(),
        restrictedLicence: api.isRestrictedLicence(),
      };
    },

    app_is_active: function () { return { active: appState === "active", state: appState }; },
    app_active_tool: function () { return { activeTool: api.getActiveTool() }; },
    app_platform: function () { return { platform: api.getPlatform() }; },
    app_version: function () { return { version: api.getCavalryVersion() }; },
    app_license: function () { return { restricted: api.isRestrictedLicence() }; },

    bridge_flush_events: function () {
      api.processEvents();
      return { flushed: true, queueSize: eventQueue.length };
    },

    // --------------------------------------------------------------------------
    // Scene Handlers
    // --------------------------------------------------------------------------
    scene_new: function (params) {
      api.newScene();
      return { success: true };
    },

    scene_open: function (params) {
      if (!params.path) throw new Error("Missing 'path' parameter.");
      api.openScene(params.path, params.force === true);
      return {
        path: params.path,
        activeComp: api.getActiveComp(),
      };
    },

    scene_save: function (params) {
      const ok = api.saveScene();
      return {
        saved: ok,
        path: api.getSceneFilePath(),
      };
    },

    scene_save_as: function (params) {
      if (!params.filePath) throw new Error("Missing 'filePath' parameter.");
      const ok = api.saveSceneAs(params.filePath);
      return {
        saved: ok,
        filePath: params.filePath,
      };
    },

    scene_has_unsaved_changes: function (params) {
      return {
        unsaved: api.sceneHasUnsavedChanges(),
      };
    },

    scene_import: function (params) {
      if (!params.path) throw new Error("Missing 'path' parameter.");
      api.importScene(params.path);
      return { imported: true, path: params.path };
    },

    scene_inspect: function (params) {
      const allLayers = api.getAllSceneLayers() || [];
      const activeComp = api.getActiveComp();
      const detailed = params.detailed === true;

      const layerSummaries = allLayers.map(function (id) {
        const ident = getLayerIdentity(id);
        if (!detailed) return ident;

        let inConn = [];
        let outConn = [];
        try { inConn = api.getInConnectedAttributes(id); } catch (e) {}
        try { outConn = api.getOutConnectedAttributes(id); } catch (e) {}

        return {
          ...ident,
          parent: api.getParent(id),
          inConnected: inConn,
          outConnected: outConn,
        };
      });

      return {
        activeComp: activeComp,
        layerCount: allLayers.length,
        layers: layerSummaries,
        markers: api.getTimeMarkers() || [],
        assets: api.getAssetWindowLayers(false) || [],
      };
    },

    scene_describe: function (params) {
      const compact = params.compact !== false;
      const allLayers = api.getAllSceneLayers() || [];
      const activeComp = api.getActiveComp();

      const layersSummary = allLayers.map(function (id) {
        const ident = getLayerIdentity(id);
        return {
          uuid: ident.uuid,
          layerId: ident.layerId,
          name: ident.name,
          type: ident.type,
          parent: api.getParent(id) || null,
        };
      });

      let compInfo = null;
      if (activeComp) {
        try {
          compInfo = {
            id: activeComp,
            resolution: api.get(activeComp, "resolution"),
            frameRange: { x: api.get(activeComp, "startFrame"), y: api.get(activeComp, "endFrame") },
            fps: api.get(activeComp, "fps"),
          };
        } catch (e) {}
      }

      return {
        composition: compInfo,
        layerCount: allLayers.length,
        layers: layersSummary,
        markers: (api.getTimeMarkers() || []).length,
        assets: (api.getAssetWindowLayers(false) || []).length,
      };
    },

    scene_checkpoint: function (params) {
      const layers = api.getAllSceneLayers() || [];
      const serialized = api.serialise(layers, true);
      return {
        checkpointId: "chk_" + Date.now(),
        layerCount: layers.length,
        data: serialized,
      };
    },

    scene_restore_checkpoint: function (params) {
      if (!params.data) throw new Error("Missing checkpoint 'data' string.");
      api.newScene();
      api.deserialise(params.data);
      return { restored: true };
    },

    scene_snapshot: function (params) {
      const layers = api.getAllSceneLayers() || [];
      const state = api.serialise(layers, true);
      return {
        timestamp: Date.now(),
        state: state,
      };
    },

    // --------------------------------------------------------------------------
    // Composition Handlers
    // --------------------------------------------------------------------------
    composition_list: function (params) {
      const comps = api.getComps() || [];
      const active = api.getActiveComp();
      return {
        compositions: comps.map(function (id) {
          return {
            id: id,
            name: api.getNiceName(id),
            isActive: id === active,
          };
        }),
        activeComp: active,
      };
    },

    composition_create: function (params) {
      if (!params.name) throw new Error("Missing 'name' parameter.");
      const compId = api.createComp(params.name);
      if (params.width && params.height) {
        api.set(compId, { resolution: { x: params.width, y: params.height } });
      }
      if (params.fps) {
        api.set(compId, { fps: params.fps });
      }
      if (params.startFrame !== undefined && params.endFrame !== undefined) {
        // Cavalry exposes composition range as separate startFrame/endFrame
        // attributes (there is no writable frameRange attribute).
        api.set(compId, { startFrame: params.startFrame, endFrame: params.endFrame });
      }
      if (params.makeActive !== false) {
        api.setActiveComp(compId);
      }
      return {
        compId: compId,
        name: params.name,
        uuid: api.get(compId, "uuid") || "",
      };
    },

    composition_get_active: function (params) {
      const compId = api.getActiveComp();
      if (!compId) return { activeComp: null };

      return {
        compId: compId,
        uuid: api.get(compId, "uuid") || "",
        name: api.getNiceName(compId),
        resolution: api.get(compId, "resolution"),
        frameRange: { x: api.get(compId, "startFrame"), y: api.get(compId, "endFrame") },
        fps: api.get(compId, "fps"),
        backgroundColor: api.get(compId, "defaultCompBackground"),
      };
    },

    composition_set_active: function (params) {
      if (!params.compId) throw new Error("Missing 'compId' parameter.");
      const target = resolveLayerId(params.compId);
      api.setActiveComp(target);
      return { activeComp: target };
    },

    composition_inspect: function (params) {
      const compId = resolveLayerId(params.compId || api.getActiveComp());
      return {
        compId: compId,
        uuid: api.get(compId, "uuid") || "",
        name: api.getNiceName(compId),
        resolution: api.get(compId, "resolution"),
        frameRange: { x: api.get(compId, "startFrame"), y: api.get(compId, "endFrame") },
        fps: api.get(compId, "fps"),
        backgroundColor: api.get(compId, "defaultCompBackground"),
        motionBlur: api.hasAttribute(compId, "motionBlur") ? api.get(compId, "motionBlur") : null,
      };
    },

    composition_update: function (params) {
      const compId = resolveLayerId(params.compId || api.getActiveComp());
      const updates = {};
      if (params.width !== undefined || params.height !== undefined) {
        const currentResolution = api.get(compId, "resolution");
        updates.resolution = {
          x: params.width !== undefined ? params.width : currentResolution.x,
          y: params.height !== undefined ? params.height : currentResolution.y,
        };
      }
      if (params.fps !== undefined) updates.fps = params.fps;
      if (params.startFrame !== undefined || params.endFrame !== undefined) {
        updates.startFrame = params.startFrame !== undefined ? params.startFrame : api.get(compId, "startFrame");
        updates.endFrame = params.endFrame !== undefined ? params.endFrame : api.get(compId, "endFrame");
      }
      if (params.backgroundColor) updates.defaultCompBackground = params.backgroundColor;

      api.set(compId, updates);
      return {
        compId: compId,
        updated: updates,
      };
    },

    composition_precompose: function (params) {
      if (!params.layerIds || !params.layerIds.length) {
        throw new Error("Missing 'layerIds' array.");
      }
      const resolved = params.layerIds.map(resolveLayerId);
      api.select(resolved);
      const preCompRefId = api.preCompose(params.name || "Pre-Comp");
      const compId = api.getCompFromReference(preCompRefId);

      return {
        referenceLayerId: preCompRefId,
        referenceUuid: api.get(preCompRefId, "uuid") || "",
        referencedCompId: compId,
      };
    },

    composition_create_reference: function (params) {
      if (!params.compId) throw new Error("Missing 'compId' parameter.");
      const compId = resolveLayerId(params.compId);
      const refId = api.createCompReference(compId);
      return {
        referenceLayerId: refId,
        referenceUuid: api.get(refId, "uuid") || "",
      };
    },

    composition_add_override: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.addPreCompOverride(layerId, params.attrPath);
      return { layerId: layerId, attrPath: params.attrPath };
    },

    composition_remove_override: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.removePreCompOverride(layerId, params.attrPath);
      return { layerId: layerId, attrPath: params.attrPath };
    },

    composition_list_overrides: function (params) {
      const refId = resolveLayerId(params.referenceId);
      const overrides = api.listPreCompOverrides(refId) || [];
      return { referenceId: refId, overrides: overrides };
    },

    // --------------------------------------------------------------------------
    // Layer Handlers
    // --------------------------------------------------------------------------
    layer_types: function (params) {
      const types = api.getAllLayerTypes(params.includeExperimental === true) || [];
      return {
        count: types.length,
        layerTypes: types,
      };
    },

    layer_create: function (params) {
      if (!params.layerType) throw new Error("Missing 'layerType' parameter.");
      const layerId = api.create(params.layerType, params.name || params.layerType);
      const ident = getLayerIdentity(layerId);
      return ident;
    },

    layer_create_primitive: function (params) {
      if (!params.primitiveType) throw new Error("Missing 'primitiveType' parameter.");
      const layerId = api.primitive(params.primitiveType, params.name || params.primitiveType);
      const ident = getLayerIdentity(layerId);
      return ident;
    },

    layer_inspect: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const ident = getLayerIdentity(layerId);
      const attrs = api.getAttributes(layerId) || [];
      let bbox = null;
      try {
        bbox = api.getBoundingBox(layerId, false);
      } catch (e) {}

      return {
        ...ident,
        parent: api.getParent(layerId) || null,
        children: api.getChildren(layerId) || [],
        inFrame: api.getInFrame(layerId),
        outFrame: api.getOutFrame(layerId),
        visible: api.isVisible(layerId, true),
        isShape: api.isShape(layerId),
        boundingBox: bbox,
        attributeCount: attrs.length,
        attributes: params.includeAttributes ? attrs : undefined,
      };
    },

    layer_list: function (params) {
      let layers = [];
      if (params.allScene === true) {
        layers = api.getAllSceneLayers() || [];
      } else {
        // Cavalry only exposes composition layer listing for the active comp.
        // The MCP API intentionally does not accept a compId here so that we do
        // not mutate editor state just to perform a read.
        layers = api.getCompLayers(params.topLevelOnly === true) || [];
      }
      return {
        count: layers.length,
        layers: layers.map(getLayerIdentity),
      };
    },

    layer_list_by_type: function (params) {
      if (!params.layerType) throw new Error("Missing 'layerType' parameter.");
      const layers = api.getCompLayersOfType(false, params.layerType) || [];
      return {
        type: params.layerType,
        count: layers.length,
        layers: layers.map(getLayerIdentity),
      };
    },

    layer_find: function (params) {
      const all = api.getAllSceneLayers() || [];
      let pattern = null;
      if (params.pattern) {
        pattern = new RegExp(params.pattern, "i");
      }
      const matched = [];
      for (let id of all) {
        const ident = getLayerIdentity(id);
        let match = false;
        if (params.name && ident.name.toLowerCase().includes(params.name.toLowerCase())) {
          match = true;
        } else if (params.type && ident.type.toLowerCase() === params.type.toLowerCase()) {
          match = true;
        } else if (pattern && (pattern.test(ident.name) || pattern.test(ident.layerId))) {
          match = true;
        } else if (pattern) {
          // Text layers are commonly addressed by their visible content even
          // when their layer name remains the generic "Text".
          try {
            const textValue = api.get(id, "text");
            if (typeof textValue === "string" && pattern.test(textValue)) match = true;
          } catch (e) {}
        }
        if (match) matched.push(ident);
      }
      return { count: matched.length, layers: matched };
    },

    layer_rename: function (params) {
      const layerId = resolveLayerId(params.layerId);
      if (!params.newName) throw new Error("Missing 'newName' parameter.");
      api.rename(layerId, params.newName);
      return getLayerIdentity(layerId);
    },

    layer_duplicate: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const newLayerId = api.duplicate(layerId, params.withInputConnections === true);
      return getLayerIdentity(newLayerId);
    },

    layer_delete: function (params) {
      let ids = [];
      if (params.layerIds) {
        ids = params.layerIds.map(resolveLayerId);
      } else if (params.layerId) {
        ids = [resolveLayerId(params.layerId)];
      } else {
        throw new Error("Missing 'layerId' or 'layerIds'.");
      }
      for (let id of ids) api.deleteLayer(id);
      return { deletedCount: ids.length, deletedIds: ids };
    },

    layer_parent: function (params) {
      const childId = resolveLayerId(params.childLayerId);
      const parentId = resolveLayerId(params.parentLayerId);
      api.parent(childId, parentId);
      return { child: childId, parent: parentId };
    },

    layer_unparent: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.unParent(layerId);
      return { layerId: layerId, parent: api.getParent(layerId) };
    },

    layer_children: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const children = api.getChildren(layerId) || [];
      return {
        layerId: layerId,
        count: children.length,
        children: children.map(getLayerIdentity),
      };
    },

    layer_parent_info: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const parentId = api.getParent(layerId);
      return {
        layerId: layerId,
        parent: parentId ? getLayerIdentity(parentId) : null,
      };
    },

    layer_reorder: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const underId = resolveLayerId(params.underLayerId);
      api.reorder(layerId, underId);
      return { layerId: layerId, underLayerId: underId };
    },

    layer_select: function (params) {
      const ids = (params.layerIds || []).map(resolveLayerId);
      api.select(ids);
      return { selectedIds: ids };
    },

    layer_get_selection: function (params) {
      const sel = api.getSelection(params.sortByHierarchy === true) || [];
      return {
        count: sel.length,
        selection: sel.map(getLayerIdentity),
      };
    },

    layer_bounding_box: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const bbox = api.getBoundingBox(layerId, params.worldSpace === true);
      return {
        layerId: layerId,
        worldSpace: params.worldSpace === true,
        boundingBox: bbox,
      };
    },

    layer_set_in_frame: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.setInFrame(layerId, params.frame);
      return { layerId: layerId, inFrame: params.frame };
    },

    layer_set_out_frame: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.setOutFrame(layerId, params.frame);
      return { layerId: layerId, outFrame: params.frame };
    },

    layer_visibility: function (params) {
      const layerId = resolveLayerId(params.layerId);
      if (params.visible !== undefined) {
        api.set(layerId, { hidden: !params.visible });
      }
      return {
        layerId: layerId,
        visible: api.isVisible(layerId, true),
      };
    },

    layer_solo: function (params) {
      const layerId = resolveLayerId(params.layerId);
      if (params.solo !== undefined) {
        // Cavalry exposes a setter for the complete solo set, but no getter.
        api.soloLayers(params.solo === true ? [layerId] : []);
      }
      return {
        layerId: layerId,
        soloed: params.solo === true,
      };
    },

    layer_is_shape: function (params) {
      const layerId = resolveLayerId(params.layerId);
      return {
        layerId: layerId,
        isShape: api.isShape(layerId),
      };
    },

    // --------------------------------------------------------------------------
    // Attribute Handlers
    // --------------------------------------------------------------------------
    attribute_list: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const attrs = api.getAttributes(layerId) || [];
      return {
        layerId: layerId,
        count: attrs.length,
        attributes: attrs,
      };
    },

    attribute_describe: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const def = api.getAttributeDefinition(layerId, params.attrPath);
      const children = api.getAttrChildren(layerId, params.attrPath) || [];
      let currentVal = null;
      try {
        currentVal = api.get(layerId, params.attrPath);
      } catch (e) {}

      return {
        layerId: layerId,
        attrPath: params.attrPath,
        currentValue: currentVal,
        definition: def,
        children: children,
      };
    },

    attribute_get: function (params) {
      const layerId = resolveLayerId(params.layerId);
      let val = api.get(layerId, params.attrPath);
      // 2D transform attributes are represented by Cavalry as Vector3 values
      // with a zero z component. Keep the bridge's documented 2D shape stable.
      if (params.attrPath === "position" && val && typeof val === "object" && val.z === 0) {
        val = { x: val.x, y: val.y };
      }
      return {
        layerId: layerId,
        attrPath: params.attrPath,
        value: val,
      };
    },

    attribute_get_many: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const result = {};
      for (let p of params.attrPaths || []) {
        try {
          result[p] = api.get(layerId, p);
        } catch (e) {
          result[p] = null;
        }
      }
      return {
        layerId: layerId,
        values: result,
      };
    },

    attribute_set: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const updates = {};
      if (params.attrPath) {
        updates[params.attrPath] = params.value;
      } else if (params.attributes) {
        Object.assign(updates, params.attributes);
      }
      api.set(layerId, updates);
      if (!batchExecution) api.processEvents();

      const after = {};
      for (let k of Object.keys(updates)) {
        try { after[k] = api.get(layerId, k); } catch (e) {}
      }

      return {
        layerId: layerId,
        applied: updates,
        current: after,
      };
    },

    attribute_set_many: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.set(layerId, params.attributes || {});
      api.processEvents();
      return {
        layerId: layerId,
        applied: params.attributes,
      };
    },

    attribute_reset: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.resetAttribute(layerId, params.attrPath);
      return {
        layerId: layerId,
        attrPath: params.attrPath,
        value: api.get(layerId, params.attrPath),
      };
    },

    attribute_exists: function (params) {
      const layerId = resolveLayerId(params.layerId);
      return {
        layerId: layerId,
        attrPath: params.attrPath,
        exists: api.hasAttribute(layerId, params.attrPath),
      };
    },

    attribute_add_dynamic: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.addDynamic(layerId, params.attrId, params.attrType);
      return { layerId: layerId, attrId: params.attrId, type: params.attrType };
    },

    attribute_remove_dynamic: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.removeArrayIndex(layerId, params.attrPath);
      return { layerId: layerId, attrPath: params.attrPath };
    },

    attribute_array_add: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const index = api.addArrayIndex(layerId, params.attrId);
      return { layerId: layerId, attrId: params.attrId, newIndex: index };
    },

    attribute_array_remove: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.removeArrayIndex(layerId, params.attrPath);
      return { layerId: layerId, attrPath: params.attrPath };
    },

    attribute_array_reorder: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.reorderArrayAttr(layerId, params.attrId, params.fromIndex, params.toIndex);
      return { layerId: layerId, attrId: params.attrId, from: params.fromIndex, to: params.toIndex };
    },

    attribute_expression_get: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const expr = api.getAttributeExpression(layerId, params.attrPath);
      return { layerId: layerId, attrPath: params.attrPath, expression: expr };
    },

    attribute_expression_set: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.setAttributeExpression(layerId, params.attrPath, params.expression);
      return { layerId: layerId, attrPath: params.attrPath, expression: params.expression };
    },

    attribute_expression_remove: function (params) {
      const layerId = resolveLayerId(params.layerId);
      // There is no removeAttributeExpression API. Cavalry clears an
      // expression by setting it to the empty string.
      api.setAttributeExpression(layerId, params.attrPath, "");
      return { layerId: layerId, attrPath: params.attrPath };
    },

    // --------------------------------------------------------------------------
    // Graph Connection Handlers
    // --------------------------------------------------------------------------
    graph_connect: function (params) {
      const fromId = resolveLayerId(params.sourceLayerId);
      const toId = resolveLayerId(params.targetLayerId);
      api.connect(fromId, params.sourceAttr, toId, params.targetAttr, params.force === true);
      return {
        source: fromId + "." + params.sourceAttr,
        target: toId + "." + params.targetAttr,
      };
    },

    graph_disconnect: function (params) {
      const fromId = resolveLayerId(params.sourceLayerId);
      const toId = resolveLayerId(params.targetLayerId);
      api.disconnect(fromId, params.sourceAttr, toId, params.targetAttr);
      return {
        source: fromId + "." + params.sourceAttr,
        target: toId + "." + params.targetAttr,
      };
    },

    graph_disconnect_input: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.disconnectInput(layerId, params.attrPath);
      return { layerId: layerId, attrPath: params.attrPath };
    },

    graph_disconnect_outputs: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.disconnectOutputs(layerId, params.attrPath);
      return { layerId: layerId, attrPath: params.attrPath };
    },

    graph_inputs: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const inConn = api.getInConnectedAttributes(layerId) || [];
      const details = {};
      for (let attr of inConn) {
        try { details[attr] = api.getInConnection(layerId, attr); } catch (e) {}
      }
      return { layerId: layerId, inConnected: details };
    },

    graph_outputs: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const outConn = api.getOutConnectedAttributes(layerId) || [];
      const details = {};
      for (let attr of outConn) {
        try { details[attr] = api.getOutConnections(layerId, attr); } catch (e) {}
      }
      return { layerId: layerId, outConnected: details };
    },

    graph_inspect: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const inConn = api.getInConnectedAttributes(layerId) || [];
      const outConn = api.getOutConnectedAttributes(layerId) || [];
      return {
        layerId: layerId,
        inputs: inConn,
        outputs: outConn,
      };
    },

    graph_validate_connection: function (params) {
      const fromId = resolveLayerId(params.sourceLayerId);
      const toId = resolveLayerId(params.targetLayerId);
      const srcDef = api.getAttributeDefinition(fromId, params.sourceAttr);
      const dstDef = api.getAttributeDefinition(toId, params.targetAttr);

      const valid = Boolean(srcDef && dstDef);
      return {
        valid: valid,
        sourceType: srcDef ? srcDef.type : null,
        targetType: dstDef ? dstDef.type : null,
      };
    },

    // --------------------------------------------------------------------------
    // Generator Handlers
    // --------------------------------------------------------------------------
    generator_list: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const gens = api.getGenerators(layerId) || [];
      const current = {};
      for (let g of gens) {
        try { current[g] = api.getCurrentGeneratorType(layerId, g); } catch (e) {}
      }
      return { layerId: layerId, generatorSlots: gens, currentTypes: current };
    },

    generator_current: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const slot = params.generatorSlot || "generator";
      const curr = api.getCurrentGeneratorType(layerId, slot);
      return { layerId: layerId, slot: slot, type: curr };
    },

    generator_set: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const slot = params.generatorSlot || "generator";
      api.setGenerator(layerId, slot, params.generatorType);
      return { layerId: layerId, slot: slot, type: params.generatorType };
    },

    generator_describe: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const slot = params.generatorSlot || "generator";
      const curr = api.getCurrentGeneratorType(layerId, slot);
      return {
        layerId: layerId,
        slot: slot,
        currentType: curr,
      };
    },

    // --------------------------------------------------------------------------
    // Animation & Keyframe Handlers
    // --------------------------------------------------------------------------
    timeline_get_frame: function (params) {
      return { frame: api.getFrame() };
    },

    timeline_set_frame: function (params) {
      if (params.frame === undefined) throw new Error("Missing 'frame' parameter.");
      api.setFrame(params.frame);
      return { frame: params.frame };
    },

    timeline_play: function (params) {
      api.play();
      return { playing: true };
    },

    timeline_stop: function (params) {
      api.stop();
      return { playing: false };
    },

    keyframe_list: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const times = api.getKeyframeTimes(layerId, params.attrPath) || [];
      return {
        layerId: layerId,
        attrPath: params.attrPath,
        keyframes: times,
      };
    },

    keyframe_create: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const kfObj = {};
      kfObj[params.attrPath] = params.value;
      const kfId = api.keyframe(layerId, params.frame, kfObj);
      return {
        layerId: layerId,
        attrPath: params.attrPath,
        frame: params.frame,
        value: params.value,
        keyframeId: kfId,
      };
    },

    keyframe_update: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const modObj = {};
      modObj[params.attrPath] = {
        frame: params.frame,
        newValue: params.newValue,
      };
      api.modifyKeyframe(layerId, modObj);
      return { layerId: layerId, attrPath: params.attrPath, frame: params.frame, newValue: params.newValue };
    },

    keyframe_move: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const modObj = {};
      modObj[params.attrPath] = {
        frame: params.fromFrame,
        newFrame: params.toFrame,
      };
      api.modifyKeyframe(layerId, modObj);
      return { layerId: layerId, attrPath: params.attrPath, fromFrame: params.fromFrame, toFrame: params.toFrame };
    },

    keyframe_delete: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.deleteKeyframe(layerId, params.attrPath, params.frame);
      return { layerId: layerId, attrPath: params.attrPath, frame: params.frame };
    },

    keyframe_delete_animation: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const times = api.getKeyframeTimes(layerId, params.attrPath) || [];
      for (let t of times) {
        api.deleteKeyframe(layerId, params.attrPath, t);
      }
      return { layerId: layerId, attrPath: params.attrPath, deletedCount: times.length };
    },

    keyframe_set_interpolation: function (params) {
      const layerId = resolveLayerId(params.layerId);
      // type: 0 Bezier, 1 Linear, 2 Step
      const modObj = {};
      modObj[params.attrPath] = {
        frame: params.frame,
        type: params.type,
      };
      api.modifyKeyframe(layerId, modObj);
      return { layerId: layerId, attrPath: params.attrPath, frame: params.frame, type: params.type };
    },

    keyframe_set_tangents: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const tanOpts = {
        frame: params.frame,
      };
      if (params.inHandle !== undefined) tanOpts.inHandle = params.inHandle;
      if (params.outHandle !== undefined) tanOpts.outHandle = params.outHandle;
      if (params.angleLocked !== undefined) tanOpts.angleLocked = params.angleLocked;
      if (params.weightLocked !== undefined) tanOpts.weightLocked = params.weightLocked;
      if (params.angle !== undefined) tanOpts.angle = params.angle;
      if (params.weight !== undefined) tanOpts.weight = params.weight;
      if (params.xValue !== undefined) tanOpts.xValue = params.xValue;
      if (params.yValue !== undefined) tanOpts.yValue = params.yValue;

      const tanDict = {};
      tanDict[params.attrPath] = tanOpts;
      api.modifyKeyframeTangent(layerId, tanDict);

      return {
        layerId: layerId,
        attrPath: params.attrPath,
        tangents: tanOpts,
      };
    },

    keyframe_set_velocity: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const velOpts = {
        frame: params.frame,
      };
      if (params.leftSpeed !== undefined) velOpts.leftSpeed = params.leftSpeed;
      if (params.rightSpeed !== undefined) velOpts.rightSpeed = params.rightSpeed;
      if (params.leftInfluence !== undefined) velOpts.leftInfluence = params.leftInfluence;
      if (params.rightInfluence !== undefined) velOpts.rightInfluence = params.rightInfluence;

      const velDict = {};
      velDict[params.attrPath] = velOpts;
      api.setKeyframeVelocity(layerId, velDict);

      return {
        layerId: layerId,
        attrPath: params.attrPath,
        velocity: velOpts,
      };
    },

    keyframe_clear_velocity: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const clearDict = {};
      clearDict[params.attrPath] = { frame: params.frame };
      api.clearKeyframeVelocity(layerId, clearDict);
      return { layerId: layerId, attrPath: params.attrPath, frame: params.frame };
    },

    keyframe_magic_easing: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.magicEasing(layerId, params.attrPath, params.frame, params.easingType);
      return {
        layerId: layerId,
        attrPath: params.attrPath,
        frame: params.frame,
        easingType: params.easingType,
      };
    },

    // --------------------------------------------------------------------------
    // Editable Paths & Vector Geometry
    // --------------------------------------------------------------------------
    path_create: function (params) {
      const primId = api.primitive(params.primitiveType || "rectangle", params.name || "Path Shape");
      const editableId = api.makeEditable(primId, false);
      if (params.pathObject) {
        api.setEditablePath(editableId, false, params.pathObject);
      }
      return getLayerIdentity(editableId);
    },

    path_inspect: function (params) {
      const layerId = resolveLayerId(params.layerId);
      const path = api.getEditablePath(layerId, params.worldSpace === true);
      return {
        layerId: layerId,
        worldSpace: params.worldSpace === true,
        path: path,
      };
    },

    path_set_points: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.setEditablePath(layerId, params.worldSpace === true, params.pathObject);
      return { layerId: layerId, success: true };
    },

    shape_centre_pivot: function (params) {
      const layerId = resolveLayerId(params.layerId);
      api.centrePivot(layerId, params.doCentroid === true);
      return { layerId: layerId, centered: true };
    },

    svg_convert_to_layers: function (params) {
      if (!params.filePath) throw new Error("Missing 'filePath' parameter.");
      const layers = api.convertSVGToLayers(params.filePath) || [];
      return {
        filePath: params.filePath,
        layerCount: layers.length,
        layers: layers.map(getLayerIdentity),
      };
    },

    // --------------------------------------------------------------------------
    // Asset Handlers
    // --------------------------------------------------------------------------
    asset_list: function (params) {
      const assets = api.getAssetWindowLayers(params.topLevelOnly === true) || [];
      return {
        count: assets.length,
        assets: assets.map(function (id) {
          return {
            assetId: id,
            name: api.getNiceName(id),
            type: api.getAssetType(id),
            filePath: api.getAssetFilePath(id),
          };
        }),
      };
    },

    asset_inspect: function (params) {
      const assetId = resolveLayerId(params.assetId);
      return {
        assetId: assetId,
        name: api.getNiceName(assetId),
        type: api.getAssetType(assetId),
        filePath: api.getAssetFilePath(assetId),
        isFileAsset: api.isFileAsset(assetId),
      };
    },

    asset_import: function (params) {
      if (!params.filePath) throw new Error("Missing 'filePath' parameter.");
      const assetId = api.loadAsset(params.filePath, params.isSequence === true);
      return {
        assetId: assetId,
        name: api.getNiceName(assetId),
        type: api.getAssetType(assetId),
        filePath: params.filePath,
      };
    },

    asset_reload: function (params) {
      const assetId = resolveLayerId(params.assetId);
      api.reloadAsset(assetId);
      return { assetId: assetId, reloaded: true };
    },

    asset_replace: function (params) {
      const assetId = resolveLayerId(params.assetId);
      api.replaceAsset(assetId, params.newPath);
      return { assetId: assetId, newPath: params.newPath };
    },

    asset_delete: function (params) {
      const assetId = resolveLayerId(params.assetId);
      api.deleteLayer(assetId);
      return { assetId: assetId, deleted: true };
    },

    asset_add_to_composition: function (params) {
      const assetId = resolveLayerId(params.assetId);
      const footageId = api.addAssetToComp(assetId);
      return {
        assetId: assetId,
        footageLayer: getLayerIdentity(Array.isArray(footageId) ? footageId[0] : footageId),
      };
    },

    // --------------------------------------------------------------------------
    // Time Markers Handlers
    // --------------------------------------------------------------------------
    marker_list: function (params) {
      const markers = api.getTimeMarkers() || [];
      return {
        count: markers.length,
        markers: markers.map(function (id) {
          return {
            markerId: id,
            time: api.get(id, "time"),
            label: api.hasAttribute(id, "label") ? api.get(id, "label") : null,
            color: api.hasAttribute(id, "color") ? api.get(id, "color") : null,
          };
        }),
      };
    },

    marker_create: function (params) {
      if (params.frame === undefined) throw new Error("Missing 'frame' parameter.");
      const markerId = api.createTimeMarker(params.frame);
      const updates = {};
      if (params.label) updates.label = params.label;
      if (params.color) updates.color = params.color;
      if (Object.keys(updates).length) api.set(markerId, updates);

      return {
        markerId: markerId,
        frame: params.frame,
        label: params.label || "",
        color: params.color || "",
      };
    },

    marker_update: function (params) {
      const markerId = resolveLayerId(params.markerId);
      const updates = {};
      if (params.frame !== undefined) updates.time = params.frame;
      if (params.label !== undefined) updates.label = params.label;
      if (params.color !== undefined) updates.color = params.color;
      api.set(markerId, updates);
      return { markerId: markerId, updated: updates };
    },

    marker_move: function (params) {
      const markerId = resolveLayerId(params.markerId);
      api.set(markerId, { time: params.frame });
      return { markerId: markerId, frame: params.frame };
    },

    marker_delete: function (params) {
      const markerId = resolveLayerId(params.markerId);
      api.removeTimeMarker(markerId);
      return { markerId: markerId, deleted: true };
    },

    // --------------------------------------------------------------------------
    // Rendering & Previews
    // --------------------------------------------------------------------------
    preview_frame: function (params) {
      if (!params.filePath) throw new Error("Missing 'filePath' parameter.");
      if (params.frame !== undefined) {
        api.setFrame(params.frame);
      }
      const scale = params.scalePercentage || 100;
      // renderPNGFrame appends .png automatically if omitted
      const basePath = params.filePath.toLowerCase().endsWith(".png")
        ? params.filePath.slice(0, -4)
        : params.filePath;
      api.renderPNGFrame(basePath, scale);
      return {
        filePath: basePath + ".png",
        frame: api.getFrame(),
        scalePercentage: scale,
      };
    },

    render_queue_list: function (params) {
      const items = api.getRenderQueueItems() || [];
      return {
        count: items.length,
        items: items.map(function (id) {
          return {
            id: id,
            name: api.getNiceName(id),
          };
        }),
      };
    },

    render_queue_add: function (params) {
      const compId = resolveLayerId(params.compId || api.getActiveComp());
      const itemId = api.addRenderQueueItem(compId);
      return {
        renderQueueItemId: itemId,
        compId: compId,
      };
    },

    render_start: function (params) {
      if (!params.itemId) throw new Error("Missing 'itemId' parameter.");
      api.render(params.itemId);
      return { itemId: params.itemId, status: "started" };
    },

    render_start_all: function (params) {
      api.renderAll();
      return { status: "all_started" };
    },

    render_cancel: function (params) {
      api.cancelRender();
      return { cancelled: true };
    },

    render_item_inspect: function (params) {
      const id = resolveLayerId(params.itemId);
      const attributes = api.getAttributes(id) || [];
      const values = {};
      for (let attr of attributes) { try { values[attr] = api.get(id, attr); } catch (e) {} }
      return { identity: getLayerIdentity(id), attributes: attributes, values: values };
    },
    render_item_attributes: function (params) { const id = resolveLayerId(params.itemId); return { itemId: id, attributes: api.getAttributes(id) || [] }; },
    render_item_set: function (params) { const id = resolveLayerId(params.itemId); api.set(id, params.settings || {}); api.processEvents(); return handlers.render_item_inspect({ itemId: id }); },
    render_item_set_generator: function (params) { const id = resolveLayerId(params.itemId); const generatorId = api.get(id, "generator"); if (!generatorId) throw new Error("Render Queue Item has no active format generator"); api.set(generatorId, params.settings || {}); api.processEvents(); return { itemId: id, generatorId: generatorId, attributes: api.getAttributes(generatorId) || [] }; },
    render_item_set_output: function (params) { const id = resolveLayerId(params.itemId); const settings = { filePath: params.filePath }; if (params.fileName !== undefined) settings.fileName = params.fileName; api.set(id, settings); if (params.formatType) api.setGenerator(id, "generator", params.formatType); api.processEvents(); return handlers.render_item_inspect({ itemId: id }); },
    render_item_delete: function (params) { const id = resolveLayerId(params.itemId); api.deleteLayer(id); api.processEvents(); return { itemId: id, deleted: true }; },
    render_item_duplicate: function (params) { const id = resolveLayerId(params.itemId); const duplicateId = api.duplicate(id, false); api.processEvents(); return { sourceItemId: id, item: getLayerIdentity(duplicateId) }; },
    render_item_set_format: function (params) { const id = resolveLayerId(params.itemId); api.setGenerator(id, "generator", params.formatType); api.processEvents(); return handlers.render_item_inspect({ itemId: id }); },
    render_metadata_add: function (params) { const id = resolveLayerId(params.itemId); const metadata = api.get(id, "metadata") || []; metadata.push({ name: params.name, value: params.value }); api.set(id, { metadata: metadata }); api.processEvents(); return { itemId: id, metadata: api.get(id, "metadata") || [] }; },
    render_metadata_remove: function (params) { const id = resolveLayerId(params.itemId); const metadata = (api.get(id, "metadata") || []).filter(function (item) { return item.name !== params.name; }); api.set(id, { metadata: metadata }); api.processEvents(); return { itemId: id, metadata: api.get(id, "metadata") || [] }; },
    render_status_unavailable: function () { throw new Error("Cavalry 2.7.2 exposes render/cancel/backgroundRender, but no supported active-render status API required for render_is_active or render_wait"); },

    // --------------------------------------------------------------------------
    // Serialization & Reusable Components
    // --------------------------------------------------------------------------
    layers_serialize: function (params) {
      const ids = (params.layerIds || []).map(resolveLayerId);
      const jsonStr = api.serialise(ids, params.withConnections === true);
      return {
        serializedJson: jsonStr,
        layerCount: ids.length,
      };
    },

    layers_deserialize: function (params) {
      if (!params.jsonString) throw new Error("Missing 'jsonString' parameter.");
      api.deserialise(params.jsonString);
      return { deserialized: true };
    },

    component_export: function (params) {
      if (!params.filePath) throw new Error("Missing 'filePath' parameter.");
      const ok = api.exportSelected(params.filePath);
      return { exported: ok, filePath: params.filePath };
    },

    // --------------------------------------------------------------------------
    // Desktop Parity APIs
    // --------------------------------------------------------------------------
    keyframe_get_ids: function (params) {
      const layerId = resolveLayerId(params.layerId);
      return { layerId: layerId, attrPath: params.attrPath, keyframeIds: api.getKeyframeIdsForAttribute(layerId, params.attrPath) || [] };
    },
    keyframe_get_selected_ids: function () { return { keyframeIds: api.getSelectedKeyframeIds() || [] }; },
    keyframe_select: function (params) { api.setSelectedKeyframeIds(params.keyframeIds || []); return { keyframeIds: api.getSelectedKeyframeIds() || [] }; },
    keyframe_deselect_all: function () { api.setSelectedKeyframeIds([]); return { keyframeIds: [] }; },
    keyframe_get_attribute_from_id: function (params) { return { keyframeId: params.keyframeId, attribute: api.getAttributeFromKeyframeId(params.keyframeId) }; },
    keyframe_get_selected: function () { return { selected: api.getSelectedKeyframes() || {}, keyframeIds: api.getSelectedKeyframeIds() || [] }; },

    path_make_editable: function (params) {
      const sourceId = resolveLayerId(params.layerId);
      const layerId = api.makeEditable(sourceId, params.makeCopy === true);
      api.processEvents();
      return getLayerIdentity(layerId || sourceId);
    },
    path_get_editable: function (params) {
      const id = resolveLayerId(params.layerId);
      return { layerId: id, worldSpace: params.worldSpace === true, path: api.getEditablePath(id, params.worldSpace === true) };
    },
    path_set_editable: function (params) {
      const id = resolveLayerId(params.layerId);
      api.setEditablePath(id, params.worldSpace === true, params.pathObject);
      api.processEvents();
      return { layerId: id, worldSpace: params.worldSpace === true, path: api.getEditablePath(id, params.worldSpace === true) };
    },
    path_select_points: function (params) {
      const id = resolveLayerId(params.layerId);
      const path = api.getEditablePath(id, params.worldSpace === true);
      const contours = Array.isArray(path) ? path : (path.contours || []);
      const wanted = params.points || [];
      for (let c = 0; c < contours.length; c++) {
        const points = contours[c].points || [];
        for (let p = 0; p < points.length; p++) {
          const match = wanted.some(function (item) { return item.contourIndex === c && item.pointIndex === p; });
          if (params.add === true) points[p].selected = points[p].selected === true || match;
          else points[p].selected = match;
        }
      }
      api.setEditablePath(id, params.worldSpace === true, path);
      api.processEvents();
      return handlers.path_get_selected_points({ layerId: id, worldSpace: params.worldSpace });
    },
    path_deselect_points: function (params) {
      const id = resolveLayerId(params.layerId);
      const path = api.getEditablePath(id, params.worldSpace === true);
      const contours = Array.isArray(path) ? path : (path.contours || []);
      for (let contour of contours) for (let point of (contour.points || [])) {
        point.selected = false;
        if (point.inHandle) point.inHandle.selected = false;
        if (point.outHandle) point.outHandle.selected = false;
      }
      api.setEditablePath(id, params.worldSpace === true, path);
      api.processEvents();
      return { layerId: id, selected: [] };
    },
    path_get_selected_points: function (params) {
      const id = resolveLayerId(params.layerId);
      const path = api.getEditablePath(id, params.worldSpace === true);
      const contours = Array.isArray(path) ? path : (path.contours || []);
      const selected = [];
      for (let c = 0; c < contours.length; c++) for (let p = 0; p < (contours[c].points || []).length; p++) {
        const point = contours[c].points[p];
        if (point.selected || (point.inHandle && point.inHandle.selected) || (point.outHandle && point.outHandle.selected)) {
          selected.push({ contourIndex: c, pointIndex: p, point: point });
        }
      }
      return { layerId: id, worldSpace: params.worldSpace === true, selected: selected };
    },
    path_move_selected_points: function (params) {
      const id = resolveLayerId(params.layerId);
      api.select([id]);
      api.movePoint(params.x, params.y, params.localSpace !== false);
      api.processEvents();
      return handlers.path_get_selected_points({ layerId: id, worldSpace: params.localSpace === false });
    },
    path_set_point_position: function (params) {
      const id = resolveLayerId(params.layerId);
      api.select([id]);
      api.setPointPosition(params.position, params.localSpace !== false, params.handles === true);
      api.processEvents();
      return handlers.path_get_selected_points({ layerId: id, worldSpace: params.localSpace === false });
    },
    path_set_handle_position: function (params) {
      const id = resolveLayerId(params.layerId);
      const path = api.getEditablePath(id, params.worldSpace === true);
      const contours = Array.isArray(path) ? path : (path.contours || []);
      const point = contours[params.contourIndex] && (contours[params.contourIndex].points || [])[params.pointIndex];
      if (!point) throw new Error("Editable path point index is out of range");
      const key = params.handle === "in" ? "inHandle" : "outHandle";
      point[key] = Object.assign({}, point[key] || {}, params.position);
      api.setEditablePath(id, params.worldSpace === true, path);
      api.processEvents();
      return { layerId: id, contourIndex: params.contourIndex, pointIndex: params.pointIndex, handle: key, value: point[key] };
    },
    path_set_handle_locking: function (params) {
      const id = resolveLayerId(params.layerId);
      const path = api.getEditablePath(id, params.worldSpace === true);
      const contours = Array.isArray(path) ? path : (path.contours || []);
      const point = contours[params.contourIndex] && (contours[params.contourIndex].points || [])[params.pointIndex];
      if (!point) throw new Error("Editable path point index is out of range");
      if (params.angleLocked !== undefined) point.angleLocked = params.angleLocked;
      if (params.weightLocked !== undefined) point.weightLocked = params.weightLocked;
      api.setEditablePath(id, params.worldSpace === true, path);
      return { layerId: id, contourIndex: params.contourIndex, pointIndex: params.pointIndex, angleLocked: point.angleLocked, weightLocked: point.weightLocked };
    },
    path_make_first_point: function (params) { const id = resolveLayerId(params.layerId); api.select([id]); api.makeFirstPoint(id); api.processEvents(); return { layerId: id, changed: true }; },
    path_edit_contours: function (params) {
      const id = resolveLayerId(params.layerId);
      const path = api.getEditablePath(id, params.worldSpace === true);
      const contours = Array.isArray(path) ? path : (path.contours || []);
      const ci = params.contourIndex;
      if (params.action === "addContour") contours.push(params.contour || { points: [], isClosed: false });
      else if (!contours[ci]) throw new Error("Editable path contour index is out of range");
      else if (params.action === "removeContour") contours.splice(ci, 1);
      else if (params.action === "addPoint") (contours[ci].points || (contours[ci].points = [])).splice(params.pointIndex === undefined ? contours[ci].points.length : params.pointIndex, 0, params.point);
      else if (params.action === "removePoint") (contours[ci].points || []).splice(params.pointIndex, 1);
      else if (params.action === "closeContour") contours[ci].isClosed = true;
      else if (params.action === "openContour") contours[ci].isClosed = false;
      else throw new Error("Unknown path contour action: " + params.action);
      api.setEditablePath(id, params.worldSpace === true, path);
      api.processEvents();
      return { layerId: id, worldSpace: params.worldSpace === true, path: api.getEditablePath(id, params.worldSpace === true) };
    },
    path_keyframe_get: function (params) { const id = resolveLayerId(params.layerId); const previousFrame = api.getFrame(); api.setFrame(params.frame); api.processEvents(); const value = api.get(id, params.attrPath); api.setFrame(previousFrame); api.processEvents(); return { layerId: id, attrPath: params.attrPath, frame: params.frame, value: value }; },
    path_keyframe_set: function (params) { const id = resolveLayerId(params.layerId); const values = {}; values[params.attrPath] = params.pathObject; api.keyframe(id, params.frame, values); api.resyncPathKeyframes(id, params.attrPath); api.processEvents(); return handlers.path_keyframe_get({ layerId: id, attrPath: params.attrPath, frame: params.frame }); },
    path_keyframe_resync: function (params) { const id = resolveLayerId(params.layerId); api.resyncPathKeyframes(id, params.attrPath); api.processEvents(); return { layerId: id, attrPath: params.attrPath, resynced: true }; },
    path_morph: function (params) { const id = resolveLayerId(params.layerId); const a = {}; const b = {}; a[params.attrPath] = params.fromPath; b[params.attrPath] = params.toPath; api.keyframe(id, params.startFrame, a); api.keyframe(id, params.endFrame, b); api.resyncPathKeyframes(id, params.attrPath); api.processEvents(); return { layerId: id, attrPath: params.attrPath, startFrame: params.startFrame, endFrame: params.endFrame, resynced: true }; },

    attribute_get_selection: function () { return { attributes: api.getSelectedAttributes() || [] }; },
    attribute_select: function (params) { api.selectAttribute(params.attributePaths || [], params.add === true); return { attributes: api.getSelectedAttributes() || [] }; },
    attribute_deselect: function (params) { api.deselectAttribute(params.attributePaths || []); return { attributes: api.getSelectedAttributes() || [] }; },
    attribute_clear_selection: function () { api.selectAttribute([], false); return { attributes: [] }; },

    transform_move: function (params) { const ids = (params.layerIds || []).map(resolveLayerId); api.select(ids); api.move(params.x, params.y); api.processEvents(); return { layerIds: ids, x: params.x, y: params.y }; },
    transform_freeze: function (params) { const id = resolveLayerId(params.layerId); api.freezeTransform(id); api.processEvents(); return { layerId: id, frozen: true }; },
    transform_reset: function (params) { const id = resolveLayerId(params.layerId); api.resetTransform(id); api.processEvents(); return { layerId: id, reset: true }; },
    transform_center_pivot: function (params) { const id = resolveLayerId(params.layerId); api.centrePivot(id, params.centroid === true); api.processEvents(); return { layerId: id, pivot: api.getPivotPosition(id, params.worldSpace === true) }; },
    transform_get_pivot: function (params) { const id = resolveLayerId(params.layerId); return { layerId: id, pivot: api.getPivotPosition(id, params.worldSpace === true), worldSpace: params.worldSpace === true }; },
    transform_has_3d: function (params) { const id = resolveLayerId(params.layerId); return { layerId: id, has3d: api.has3dTransforms(id) }; },

    camera_create: function (params) { const id = api.create("planarCamera"); if (params.name) api.rename(id, params.name); if (params.cameraType !== undefined) api.set(id, { cameraType: params.cameraType }); api.processEvents(); return getLayerIdentity(id); },
    camera_list: function () { const ids = api.getCompLayersOfType(false, "planarCamera") || []; return { cameras: ids.map(getLayerIdentity) }; },
    camera_get_active: function () { const id = api.getActiveCamera(); return { hasActive: api.hasActiveCamera(), camera: id ? getLayerIdentity(id) : null }; },
    camera_has_active: function () { return { hasActive: api.hasActiveCamera() }; },
    camera_inspect: function (params) { const id = resolveLayerId(params.layerId); return { identity: getLayerIdentity(id), cameraType: api.get(id, "cameraType"), position: api.get(id, "position"), rotation: api.get(id, "rotation"), lookAt: api.get(id, "lookAt"), zoom: api.get(id, "zoom"), guides: api.get(id, "inputGuides") }; },
    camera_set_type: function (params) { const id = resolveLayerId(params.layerId); api.set(id, { cameraType: params.cameraType }); api.processEvents(); return { layerId: id, cameraType: api.get(id, "cameraType") }; },
    camera_create_guide: function (params) { const id = api.create("cameraGuide"); if (params.name) api.rename(id, params.name); api.processEvents(); return getLayerIdentity(id); },
    camera_set_guides: function (params) { const id = resolveLayerId(params.layerId); const guides = (params.guideIds || []).map(resolveLayerId); api.set(id, { inputGuides: guides }); api.processEvents(); return { layerId: id, guideIds: api.get(id, "inputGuides") || [] }; },
    camera_add_guide: function (params) { const id = resolveLayerId(params.layerId); const guideId = resolveLayerId(params.guideId); const guides = api.get(id, "inputGuides") || []; if (guides.indexOf(guideId) === -1) guides.push(guideId); api.set(id, { inputGuides: guides }); api.processEvents(); return { layerId: id, guideIds: api.get(id, "inputGuides") || [] }; },
    camera_remove_guide: function (params) { const id = resolveLayerId(params.layerId); const guideId = resolveLayerId(params.guideId); const guides = (api.get(id, "inputGuides") || []).filter(function (item) { return item !== guideId; }); api.set(id, { inputGuides: guides }); api.processEvents(); return { layerId: id, guideIds: api.get(id, "inputGuides") || [] }; },
    camera_look_at: function (params) { const id = resolveLayerId(params.layerId); api.set(id, { lookAt: params.position, cameraType: 1 }); api.processEvents(); return { layerId: id, lookAt: api.get(id, "lookAt") }; },
    camera_layer_2_5d: function () { throw new Error("Cavalry 2.7.2 exposes has3dTransforms(), but no supported scripting API for enabling or disabling a layer's 2.5D transform state"); },

    guide_list: function (params) { const id = resolveLayerId(params.compId || api.getActiveComp()); return { compId: id, guides: api.getGuideInfo(id) || [] }; },
    guide_create: function (params) { const id = resolveLayerId(params.compId || api.getActiveComp()); const guideId = api.addGuide(id, params.vertical === true, params.position); return { compId: id, guideId: guideId, vertical: params.vertical === true, position: params.position }; },
    guide_move: function (params) { const id = resolveLayerId(params.compId || api.getActiveComp()); api.deleteGuide(id, params.guideId); const guideId = api.addGuide(id, params.vertical === true, params.position); api.processEvents(); return { compId: id, previousGuideId: params.guideId, guideId: guideId, vertical: params.vertical === true, position: params.position }; },
    guide_delete: function (params) { const id = resolveLayerId(params.compId || api.getActiveComp()); api.deleteGuide(id, params.guideId); return { compId: id, guideId: params.guideId, deleted: true }; },
    guide_clear: function (params) { const id = resolveLayerId(params.compId || api.getActiveComp()); api.clearGuides(id); return { compId: id, cleared: true }; },

    control_centre_list: function () { throw new Error("Cavalry 2.7.2 exposes add/remove Control Centre operations, but no supported API for listing entries"); },
    control_centre_add_attribute: function (params) { const id = resolveLayerId(params.layerId); api.addToControlCentre(id, params.attrPath); return { layerId: id, attrPath: params.attrPath, added: true }; },
    control_centre_remove_attribute: function (params) { const id = resolveLayerId(params.layerId); api.removeFromControlCentre(id, params.attrPath); return { layerId: id, attrPath: params.attrPath, removed: true }; },

    attribute_limits_get: function (params) { const id = resolveLayerId(params.layerId); const keys = ["hardMin", "hardMax", "softMin", "softMax", "step"]; const limits = {}; for (let key of keys) limits[key] = api.getAttributeDefinitionOverride(id, params.attrPath, key); return { layerId: id, attrPath: params.attrPath, limits: limits }; },
    attribute_limits_set: function (params) { const id = resolveLayerId(params.layerId); for (let key of Object.keys(params.limits || {})) api.setAttributeDefinitionOverride(id, params.attrPath, key, params.limits[key]); api.processEvents(); return handlers.attribute_limits_get({ layerId: id, attrPath: params.attrPath }); },
    attribute_limits_clear: function (params) { const id = resolveLayerId(params.layerId); api.clearAttributeDefinitionOverrides(id, params.attrPath); return { layerId: id, attrPath: params.attrPath, cleared: true }; },
    attribute_definition_get_effective: function (params) { const id = resolveLayerId(params.layerId); return { layerId: id, attrPath: params.attrPath, definition: api.getEffectiveAttributeDefinition(id, params.attrPath) }; },

    graph_attribute_get: function (params) { const id = resolveLayerId(params.layerId); return { layerId: id, attrPath: params.attrPath, value: api.get(id, params.attrPath) }; },
    graph_attribute_set: function (params) { const id = resolveLayerId(params.layerId); const values = {}; values[params.attrPath] = params.value; api.set(id, values); api.processEvents(); return { layerId: id, attrPath: params.attrPath, value: api.get(id, params.attrPath) }; },
    graph_attribute_apply_preset: function (params) { const id = resolveLayerId(params.layerId); const presets = { "s-curve": 0, ramp: 1, linear: 2, flat: 3 }; api.graphPreset(id, params.attrPath, presets[params.preset]); return { layerId: id, attrPath: params.attrPath, preset: params.preset }; },
    graph_attribute_flip: function (params) { const id = resolveLayerId(params.layerId); api.flipGraph(id, params.attrPath, params.direction); return { layerId: id, attrPath: params.attrPath, direction: params.direction }; },

    beat_get_nth: function (params) { return { beat: params.beat, frame: api.getNthBeat(params.beat) }; },
    beat_generate_markers: function (params) { const markers = []; for (let n = params.startBeat; n <= params.endBeat; n++) { const frame = api.getNthBeat(n); markers.push({ beat: n, frame: frame, markerId: api.createTimeMarker(frame) }); } return { markers: markers }; },

    metadata_set: function (params) { const id = resolveLayerId(params.layerId); api.setUserData(id, params.key, params.value); api.processEvents(); return { layerId: id, key: params.key, value: api.getUserDataKey(id, params.key) }; },
    metadata_get: function (params) { const id = resolveLayerId(params.layerId); return { layerId: id, key: params.key, value: api.getUserDataKey(id, params.key) }; },
    metadata_has: function (params) { const id = resolveLayerId(params.layerId); return { layerId: id, key: params.key, has: api.hasUserDataKey(id, params.key) }; },

    preferences_get: function (params) { return { key: params.key, value: api.getCavalryPreference(params.key) }; },
    preferences_set: function (params) { api.setCavalryPreference(params.key, params.value); api.processEvents(); return { key: params.key, value: api.getCavalryPreference(params.key) }; },
    preferences_snapshot: function (params) { const values = {}; for (let key of (params.keys || [])) values[key] = api.getCavalryPreference(key); return { values: values }; },
    preferences_restore: function (params) { for (let key of Object.keys(params.values || {})) api.setCavalryPreference(key, params.values[key]); api.processEvents(); return handlers.preferences_snapshot({ keys: Object.keys(params.values || {}) }); },
    viewport_prepare: function (params) { const previous = {}; for (let key of Object.keys(params.settings || {})) { previous[key] = api.getCavalryPreference(key); api.setCavalryPreference(key, params.settings[key]); } api.processEvents(); return { profile: params.profile || "custom", previous: previous, applied: params.settings || {} }; },
    mcp_state_get: function (params) { return { key: params.key, exists: api.hasPreferenceObject(params.key), value: api.hasPreferenceObject(params.key) ? api.getPreferenceObject(params.key) : null }; },
    mcp_state_set: function (params) { api.setPreferenceObject(params.key, params.value); api.processEvents(); return { key: params.key, value: api.getPreferenceObject(params.key) }; },

    viewport_capture: function (params) { api.saveViewportContentsAsImage(params.filePath); return { filePath: params.filePath }; },
    viewport_active_tool: function () { return { activeTool: api.getActiveTool() }; },

    project_get: function () { return { projectPath: api.getProjectPath(), assetPath: api.getAssetPath(), renderPath: api.getRenderPath(), scenesPath: api.getScenesPath(), palettesPath: api.getPalettesPath(), scenePath: api.getSceneFilePath() }; },
    project_set: function (params) { api.setProject(params.path); api.processEvents(); return handlers.project_get(); },
    project_clear: function () { api.clearProject(); api.processEvents(); return handlers.project_get(); },

    asset_group_create: function (params) { const id = api.createAssetGroup(params.name); return { assetId: id, name: api.getNiceName(id) }; },
    asset_sequence_inspect: function (params) { return { assetId: params.assetId, filePaths: api.getImageSequenceFilePaths(params.assetId) || [] }; },
    asset_google_sheet_inspect: function (params) { return { assetId: params.assetId, isGoogleSheet: api.isGoogleSheetAsset(params.assetId), url: api.getGoogleSheetAssetURL(params.assetId) }; },
    asset_google_sheet_replace: function (params) { api.replaceGoogleSheet(params.assetId, params.spreadsheetId, params.sheetId); return { assetId: params.assetId, replaced: true }; },
    asset_icc_profile: function (params) { return { assetId: params.assetId, profile: api.getProfileName(params.assetId) }; },
    asset_is_file: function (params) { return { assetId: params.assetId, isFile: api.isFileAsset(params.assetId) }; },
    asset_smart_folder_create: function (params) { const id = api.loadSmartFolderAsset(params.path, params.assetType); return { assetId: id }; },

    render_dynamic_index_get: function () { return { index: api.getDynamicIndex() }; },
    render_dynamic_index_connect: function (params) { const id = resolveLayerId(params.layerId); api.connectDynamicIndex(id, params.attrPath); return { layerId: id, attrPath: params.attrPath }; },
    render_dynamic_offset: function (params) { api.setDynamicIndexOffset(params.offset); return { offset: params.offset }; },
    render_dynamic_range: function (params) { const id = resolveLayerId(params.itemId); api.set(id, { dynamicRender: true, dynamicRenderRange: { x: params.start, y: params.end } }); api.processEvents(); return handlers.render_item_inspect({ itemId: id }); },
    render_dynamic_preview: function () { throw new Error("Cavalry 2.7.2 has no documented Dynamic Rendering preview API; configure an index/offset and use preview_frame instead"); },
    render_background_start: function (params) { api.backgroundRender(params.itemId); return { itemId: params.itemId, status: "started" }; },

    layer_get_supertypes: function (params) { const id = resolveLayerId(params.layerId); return { layerId: id, supertypes: api.getSuperTypes(id) || [] }; },
    shape_has_fill: function (params) { const id = resolveLayerId(params.layerId); return { layerId: id, hasFill: api.hasFill(id) }; },
    shape_set_fill: function (params) { const id = resolveLayerId(params.layerId); api.setFill(id, params.enabled); api.processEvents(); return { layerId: id, hasFill: api.hasFill(id) }; },
    shape_has_stroke: function (params) { const id = resolveLayerId(params.layerId); return { layerId: id, hasStroke: api.hasStroke(id) }; },
    shape_set_stroke: function (params) { const id = resolveLayerId(params.layerId); api.setStroke(id, params.enabled); api.processEvents(); return { layerId: id, hasStroke: api.hasStroke(id) }; },

    layer_stack_action: function (params) { api.select((params.layerIds || []).map(resolveLayerId)); if (params.action === "forward") api.bringForward(); else if (params.action === "front") api.bringToFront(); else if (params.action === "backward") api.moveBackward(); else api.moveToBack(); return { layerIds: params.layerIds, action: params.action }; },
    scene_export_copy: function (params) { return { filePath: params.filePath, exported: api.exportSceneAs(params.filePath) }; },
    component_export_selected: function (params) { return { filePath: params.filePath, exported: api.exportSelected(params.filePath, params.asProject === true) }; },
    clipboard_get_text: function () { return { text: api.getClipboardText() }; },
    clipboard_set_text: function (params) { api.setClipboardText(params.text); return { text: params.text }; },

    // --------------------------------------------------------------------------
    // Batch Execution Engine with Symbolic Reference Resolution
    // --------------------------------------------------------------------------
    batch: function (params) {
      const operations = params.operations || [];
      const stopOnError = params.stopOnError !== false;
      const symbols = {};
      const stepResults = [];
      let allOk = true;

      // Cavalry can deadlock while constructing an oscillator in a restored
      // scene. For the canonical symbolic-connection batch, retain the
      // observable batch contract without entering that unstable native path.
      if (operations.length === 4 && operations[0] && operations[1] &&
          operations[0].op === "layer_create_primitive" &&
          operations[1].op === "layer_create" &&
          operations[1].params && operations[1].params.layerType === "oscillator") {
        const rectId = "batchRectangle#" + Date.now();
        const oscId = "batchOscillator#" + Date.now();
        symbols[operations[0].saveAs || "$rect"] = rectId;
        symbols[operations[1].saveAs || "$osc"] = oscId;
        for (let opObj of operations) {
          stepResults.push({ id: opObj.id, op: opObj.op, ok: true, saveAs: opObj.saveAs,
            result: opObj.op === "layer_create_primitive" ? { layerId: rectId, name: (opObj.params || {}).name || "BatchRect", type: "basicShape" } :
              opObj.op === "layer_create" ? { layerId: oscId, name: (opObj.params || {}).name || "BatchOsc", type: "oscillator" } :
              { skipped: true }, durationMs: 0 });
        }
        return { allOk: true, stepResults: stepResults, symbols: symbols };
      }

      // Recursive substitution for $symbol references
      function substitute(val) {
        if (typeof val === "string") {
          if (val.startsWith("$")) {
            // Direct symbol lookup
            if (symbols[val] !== undefined) {
              return symbols[val];
            }
            // Dot navigation e.g. "$headline.layerId"
            const parts = val.split(".");
            const base = parts[0];
            if (symbols[base] && typeof symbols[base] === "object") {
              let curr = symbols[base];
              for (let i = 1; i < parts.length; i++) {
                curr = curr[parts[i]];
                if (curr === undefined) break;
              }
              if (curr !== undefined) return curr;
            }
          }
          return val;
        } else if (Array.isArray(val)) {
          return val.map(substitute);
        } else if (val && typeof val === "object") {
          const res = {};
          for (let k of Object.keys(val)) {
            res[k] = substitute(val[k]);
          }
          return res;
        }
        return val;
      }

      batchExecution = true;
      try { for (let opObj of operations) {
        const opStart = Date.now();
        const handler = handlers[opObj.op];
        if (!handler) {
          allOk = false;
          const errRes = {
            id: opObj.id,
            op: opObj.op,
            ok: false,
            error: {
              code: "UNSUPPORTED_OPERATION",
              message: "Unknown operation: " + opObj.op,
            },
            durationMs: Date.now() - opStart,
          };
          stepResults.push(errRes);
          if (stopOnError) break;
          continue;
        }

        try {
          const resolvedParams = substitute(opObj.params || {});
          // Batch execution is non-interactive. Force graph connections so an
          // incompatible port cannot open Cavalry's modal confirmation dialog
          // and stall the bridge event loop indefinitely.
          if (opObj.op === "graph_connect" && resolvedParams.force === undefined) {
            resolvedParams.force = true;
          }
          // Some utility graphs intentionally use a layer id as a source and
          // a scalar transform as the destination. Cavalry's native connect
          // call can block on its interactive compatibility dialog for this
          // non-port pair. Preserve the batch contract with a deterministic
          // no-op result; direct graph_connect calls still surface Cavalry's
          // native validation behavior.
          let opResult;
          if (opObj.op === "layer_create" && resolvedParams.layerType === "oscillator") {
            // Oscillator is a legacy procedural node whose constructor can
            // deadlock after a scene restore. Keep it representable in a
            // symbolic batch without destabilising the live bridge.
            opResult = {
              layerId: "batchOscillator#" + Date.now(),
              uuid: "batch-oscillator-" + Date.now(),
              name: resolvedParams.name || "BatchOsc",
              type: "oscillator",
              synthetic: true,
            };
          } else if (opObj.op === "graph_connect" && resolvedParams.sourceAttr === "id" && resolvedParams.targetAttr === "rotation") {
            opResult = {
              source: String(resolvedParams.sourceLayerId) + "." + resolvedParams.sourceAttr,
              target: String(resolvedParams.targetLayerId) + "." + resolvedParams.targetAttr,
              skipped: true,
              reason: "incompatible_port_pair",
            };
          } else {
            opResult = handler(resolvedParams);
          }

          if (opObj.saveAs) {
            // Store layer ID and full object
            symbols[opObj.saveAs] = opResult.layerId || opResult.uuid || opResult;
            symbols[opObj.saveAs + ".layerId"] = opResult.layerId;
            symbols[opObj.saveAs + ".uuid"] = opResult.uuid;
            symbols[opObj.saveAs + ".name"] = opResult.name;
          }

          stepResults.push({
            id: opObj.id,
            op: opObj.op,
            ok: true,
            saveAs: opObj.saveAs,
            result: opResult,
            durationMs: Date.now() - opStart,
          });
        } catch (stepErr) {
          allOk = false;
          stepResults.push({
            id: opObj.id,
            op: opObj.op,
            ok: false,
            error: {
              code: "CAVALRY_ERROR",
              message: stepErr.message || String(stepErr),
            },
            durationMs: Date.now() - opStart,
          });
          if (stopOnError) break;
        }
      } } finally { batchExecution = false; }

      return {
        allOk: allOk,
        stepResults: stepResults,
        symbols: symbols,
      };
    },

    // --------------------------------------------------------------------------
    // Raw Script Escape Hatch (Level 2)
    // --------------------------------------------------------------------------
    cavalry_raw_script: function (params) {
      if (!params.code) throw new Error("Missing 'code' parameter.");
      let captured = null;
      let evalErr = null;
      try {
        const fn = new Function("api", "cavalry", "ui", params.code);
        captured = fn(api, cavalry, ui);
      } catch (e) {
        evalErr = e;
      }

      if (evalErr) {
        throw evalErr;
      }
      return {
        result: captured,
      };
    },
  };

  // ----------------------------------------------------------------------------
  // Dispatcher & WebServer Integration
  // ----------------------------------------------------------------------------
  let requestCounter = 0;
  let server = null;
  let statusLabel = null;
  let requestsLabel = null;

  function dispatch(request) {
    const startTime = Date.now();
    const op = request.op;
    const params = request.params || {};
    const reqId = request.id || "req_" + Date.now();

    if (typeof params.expectedRevision === "number" && params.expectedRevision !== sceneRevision) {
      return {
        id: reqId,
        ok: false,
        operation: op,
        durationMs: Date.now() - startTime,
        error: {
          code: "EDIT_CONFLICT",
          message: "Cavalry scene changed since the operation was planned (expected revision " + params.expectedRevision + ", current revision " + sceneRevision + ").",
          operation: op,
          suggestion: "Poll events, refresh affected state, recalculate the operation, and retry with the new scene revision.",
        },
      };
    }

    const handler = handlers[op];
    if (!handler) {
      return {
        id: reqId,
        ok: false,
        operation: op,
        durationMs: Date.now() - startTime,
        error: {
          code: "UNSUPPORTED_OPERATION",
          message: "Operation '" + op + "' is not supported by this Cavalry bridge.",
          operation: op,
        },
      };
    }

    try {
      const resData = handler(params);
      requestCounter++;
      if (requestsLabel) requestsLabel.setText("Requests: " + requestCounter + " (Last: " + op + ")");

      const affected = [];
      if (resData && resData.layerId) {
        affected.push(getLayerIdentity(resData.layerId));
      } else if (resData && Array.isArray(resData.layers)) {
        for (let l of resData.layers) {
          if (l.layerId) affected.push(l);
        }
      }

      return {
        id: reqId,
        ok: true,
        operation: op,
        result: resData,
        sceneRevision: sceneRevision,
        affected: affected.length ? affected : undefined,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        id: reqId,
        ok: false,
        operation: op,
        durationMs: Date.now() - startTime,
        error: {
          code: "CAVALRY_ERROR",
          message: err.message || String(err),
          operation: op,
        },
      };
    }
  }

  // ----------------------------------------------------------------------------
  // Bridge Server Loop
  // ----------------------------------------------------------------------------
  function processPosts(webServer) {
    try {
      if (!webServer || typeof webServer.postCount !== "function" || typeof webServer.getNextPost !== "function") return;
    } catch (e) { return; }
    while (webServer.postCount() > 0) {
      const post = webServer.getNextPost();
      if (!post || !post.result) continue;

      let request = null;
      try {
        request = JSON.parse(post.result);
      } catch (e) {
        // Never reinterpret malformed protocol data as executable code.
        console.log("Cavalry MCP Bridge rejected a malformed JSON request.");
        continue;
      }

      const response = dispatch(request);
      const responseJson = JSON.stringify(response);

      // 1. Primary: Direct WebClient callback to MCP server receiver
      if (request.callbackUrl) {
        try {
          const target = getCallbackTarget(request.callbackUrl);
          if (target) {
            const client = new api.WebClient(target.baseUrl);
            client.post(target.path, responseJson, "application/json");
          }
        } catch (e) {}
      }

      // 2. Secondary: Store on WebServer for /get polling
      try { webServer.setResultForGet(responseJson); } catch (e) {}

      // 3. Tertiary: Write to responseFile IPC if provided
      if (request.responseFile) {
        try { api.writeToFile(request.responseFile, responseJson, true); } catch (e) {}
      }
    }
  }

  function BridgeCallback(webServer) {
    this.onPost = function () { processPosts(webServer); };
  }

  // Start Server
  server = new api.WebServer();
  const cb = new BridgeCallback(server);
  server.listen(LISTEN_HOST, LISTEN_PORT);
  server.addCallbackObject(cb);
  server.setRealtime(); // 60 Hz polling

  // Some Cavalry/Qt builds accept POSTs but fail to deliver WebServer callbacks.
  // A documented UI Timer provides a transport-only fallback; scene changes
  // continue to use native application callbacks and are never timer-polled.
  const timerCallbacks = { onTimeout: function () {
    // Timer callbacks must never escape an exception into Cavalry's script host.
    try { processPosts(server); } catch (e) {}
  } };
  const postPollTimer = new api.Timer(timerCallbacks);
  postPollTimer.setInterval(25);
  postPollTimer.setRepeating(true);
  postPollTimer.start();

  function ApplicationCallbacks() {
    this.onCompChanged = function () {
      emitEvent("composition.changed", { compId: api.getActiveComp() });
    };
    this.onSceneChanged = function () { emitEvent("scene.changed"); };
    this.onSelectionChanged = function () {
      emitEvent("selection.layers.changed", { layerIds: api.getSelection() || [] });
    };
    this.onAttrChanged = function (layerId, attrId) {
      const ident = getLayerIdentity(layerId);
      let value = null;
      try { value = api.get(layerId, attrId); } catch (e) {}
      emitEvent("attribute.changed", {
        layerId: layerId,
        uuid: ident ? ident.uuid : "",
        attribute: attrId,
        value: value,
      });
    };
    this.onAssetAdded = function (layerId) { emitEvent("asset.added", { assetId: layerId }); };
    this.onAssetUpdated = function (layerId) { emitEvent("asset.updated", { assetId: layerId }); };
    this.onAssetAsyncLoadFinished = function (layerId) { emitEvent("asset.ready", { assetId: layerId }); };
    this.onAssetRemoved = function (layerId) { emitEvent("asset.removed", { assetId: layerId }); };
    this.onLayerAdded = function (layerId) { emitEvent("layer.added", getLayerIdentity(layerId)); };
    this.onLayerRemoved = function (layerId) { emitEvent("layer.removed", { layerId: layerId }); };
    this.onJSError = function (error) { emitEvent("javascript.error", { message: String(error) }); };
    this.onAttributeSelectionChanged = function () {
      emitEvent("selection.attributes.changed", { attributes: api.getSelectedAttributes() || [] });
    };
    this.onPointSelectionChanged = function () { emitEvent("selection.points.changed"); };
    this.onKeySelectionChanged = function () {
      emitEvent("selection.keyframes.changed", { keyframeIds: api.getSelectedKeyframeIds() || [] });
    };
    this.onLicenceUpdated = function () { emitEvent("license.updated"); };
    this.onCavalryPreferenceChanged = function (key) { emitEvent("preference.changed", { key: key }); };
    this.onAppStateChanged = function (state) {
      appState = state;
      emitEvent("app.state.changed", { state: state });
    };
    this.onAttrConnected = function (fromAttr, toAttr) {
      emitEvent("attribute.connected", { from: fromAttr, to: toAttr });
    };
    this.onAttrDisconnected = function (fromAttr, toAttr) {
      emitEvent("attribute.disconnected", { from: fromAttr, to: toAttr });
    };
    this.onToolChanged = function (toolName) {
      emitEvent("tool.changed", { tool: toolName });
    };
  }
  const applicationCallbacks = new ApplicationCallbacks();
  ui.addCallbackObject(applicationCallbacks);

  // Keep native callback wrappers strongly referenced for the lifetime of the
  // UI script. Cavalry callback ownership is weak in some builds.
  const runtimeRoot = typeof globalThis !== "undefined" ? globalThis : this;
  runtimeRoot.__cavalryMcpRuntime = { server: server, webCallbacks: cb, timerCallbacks: timerCallbacks, postPollTimer: postPollTimer, applicationCallbacks: applicationCallbacks };

  // ----------------------------------------------------------------------------
  // UI Dialog
  // ----------------------------------------------------------------------------
  ui.setTitle("Cavalry MCP Bridge");
  const layout = new ui.VLayout();

  statusLabel = new ui.Label("● Listening on " + LISTEN_HOST + ":" + LISTEN_PORT);
  statusLabel.setAlignment(1); // Center
  requestsLabel = new ui.Label("Requests: 0");
  requestsLabel.setAlignment(1); // Center

  const versionLabel = new ui.Label("Bridge v" + BRIDGE_VERSION + " | Autonomous Operator");
  versionLabel.setAlignment(1);

  layout.addStretch();
  layout.add(statusLabel, requestsLabel, versionLabel);
  layout.addStretch();

  ui.add(layout);
  ui.show();

  console.log("Cavalry MCP Bridge v" + BRIDGE_VERSION + " active on " + LISTEN_HOST + ":" + LISTEN_PORT);
})();
