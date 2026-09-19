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
        supportedLayerTypes: layerTypes,
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
            frameRange: api.get(activeComp, "frameRange"),
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
        api.set(compId, { frameRange: { x: params.startFrame, y: params.endFrame } });
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
        frameRange: api.get(compId, "frameRange"),
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
        frameRange: api.get(compId, "frameRange"),
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
        const currentRange = api.get(compId, "frameRange");
        updates.frameRange = {
          x: params.startFrame !== undefined ? params.startFrame : currentRange.x,
          y: params.endFrame !== undefined ? params.endFrame : currentRange.y,
        };
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
      const newLayerId = api.duplicate(layerId);
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
      const val = api.get(layerId, params.attrPath);
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
    // Batch Execution Engine with Symbolic Reference Resolution
    // --------------------------------------------------------------------------
    batch: function (params) {
      const operations = params.operations || [];
      const stopOnError = params.stopOnError !== false;
      const symbols = {};
      const stepResults = [];
      let allOk = true;

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

      for (let opObj of operations) {
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
          const opResult = handler(resolvedParams);

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
      }

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
  function BridgeCallback(webServer) {
    this.server = webServer;

    this.onPost = function () {
      while (this.server.postCount && this.server.postCount() > 0) {
        const post = this.server.getNextPost();
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
        try {
          this.server.setResultForGet(responseJson);
        } catch (e) {}

        // 3. Tertiary: Write to responseFile IPC if provided
        if (request.responseFile) {
          try {
            api.writeToFile(request.responseFile, responseJson, true);
          } catch (e) {}
        }
      }
    };
  }

  // Start Server
  server = new api.WebServer();
  const cb = new BridgeCallback(server);
  server.listen(LISTEN_HOST, LISTEN_PORT);
  server.addCallbackObject(cb);
  server.setRealtime(); // 60 Hz polling

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
