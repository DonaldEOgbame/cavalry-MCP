import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const bridgePath = path.resolve(process.cwd(), 'cavalry/bridge.js');
const source = fs.readFileSync(bridgePath, 'utf8');

describe('Cavalry bridge API contract', () => {
  it('uses the documented layer, visibility, solo, and reset APIs', () => {
    assert.match(source, /api\.getCompLayers\(/);
    assert.match(source, /api\.getCompLayersOfType\(/);
    assert.match(source, /api\.getBoundingBox\(/);
    assert.match(source, /api\.isVisible\(/);
    assert.match(source, /api\.soloLayers\(/);
    assert.match(source, /api\.resetAttribute\(/);
    assert.match(source, /api\.deleteLayer\(/);

    assert.doesNotMatch(source, /api\.getLayers\(/);
    assert.doesNotMatch(source, /api\.isLayerVisible\(/);
    assert.doesNotMatch(source, /api\.isLayerSoloed\(/);
    assert.doesNotMatch(source, /api\.setLayerSoloed\(/);
    assert.doesNotMatch(source, /api\.reset\(/);
    assert.doesNotMatch(source, /api\.removeAttributeExpression\(/);
    assert.doesNotMatch(source, /api\.deleteLayers\(/);
  });

  it('does not execute malformed request bodies as raw scripts', () => {
    assert.doesNotMatch(source, /op:\s*["']cavalry_raw_script["'][^\n]+post\.result/);
    assert.match(source, /rejected a malformed JSON request/);
  });

  it('authenticates sessions and constrains callbacks, response files, and raw scripts', () => {
    assert.match(source, /loadSession\(request\)/);
    assert.match(source, /rejected an unauthenticated request/);
    assert.match(source, /session\.token !== request\.token/);
    assert.match(source, /validResponseFile\(request, session\)/);
    assert.match(source, /127\\\.0\\\.0\\\.1\|localhost/);
    assert.match(source, /batchContainsRawScript/);
    assert.match(source, /RAW_SCRIPT_DISABLED/);
    assert.match(source, /session\.expiresAt < Date\.now\(\)/);
    assert.match(source, /candidate !== session\.expectedResponseFile/);
    assert.match(source, /candidate\.indexOf\("\.\.\/"\) !== -1/);
    assert.match(source, /api\.getAbsolutePath\(candidate\)/);
    assert.match(source, /Math\.abs\(Date\.now\(\) - request\.timestamp\)/);
    assert.doesNotMatch(source, /\[::1\]/);
  });

  it('negotiates an explicit bridge protocol version and capabilities', () => {
    assert.match(source, /const PROTOCOL_VERSION = 2/);
    assert.match(source, /request\.protocolVersion !== PROTOCOL_VERSION/);
    assert.match(source, /BRIDGE_PROTOCOL_MISMATCH/);
    assert.match(source, /bridgeCapabilities: BRIDGE_CAPABILITIES/);
    assert.match(source, /REPLAYED_REQUEST/);
    assert.match(source, /seenRequestIds\[replayKey\]/);
  });

  it('finds raw-script calls recursively in nested batches without aliases', () => {
    assert.match(source, /item\.op === "cavalry_raw_script"/);
    assert.match(source, /item\.op === "batch" && containsRawScript/);
    for (const bypass of ['raw_script', 'execute_script', 'eval', 'script']) {
      assert.doesNotMatch(source, new RegExp(`handlers\\.${bypass}\\s*=`));
    }
  });

  it('splits callback URLs into the base URL and route required by WebClient', () => {
    assert.match(source, /new api\.WebClient\(target\.baseUrl\)/);
    assert.match(source, /client\.post\(target\.path,/);
  });

  it('registers every documented application callback and conflict revision checks', () => {
    const callbacks = [
      'onCompChanged', 'onSceneChanged', 'onSelectionChanged', 'onAttrChanged',
      'onAssetAdded', 'onAssetUpdated', 'onAssetAsyncLoadFinished', 'onAssetRemoved',
      'onLayerAdded', 'onLayerRemoved', 'onJSError', 'onAttributeSelectionChanged',
      'onPointSelectionChanged', 'onKeySelectionChanged', 'onLicenceUpdated',
      'onCavalryPreferenceChanged', 'onAppStateChanged', 'onAttrConnected',
      'onAttrDisconnected', 'onToolChanged',
    ];
    for (const callback of callbacks) assert.match(source, new RegExp(`this\\.${callback}\\s*=`));
    assert.match(source, /const applicationCallbacks = new ApplicationCallbacks\(\)/);
    assert.match(source, /ui\.addCallbackObject\(applicationCallbacks\)/);
    assert.match(source, /code:\s*["']EDIT_CONFLICT["']/);
    assert.match(source, /params\.expectedRevision\s*!==\s*sceneRevision/);
  });

  it('only calls APIs present in the installed Cavalry metadata', (context) => {
    const metadataDir = '/Applications/Cavalry.app/Contents/assets/MetaData';
    const metadataFiles = [
      'api_function_metadata.json',
      'core_api_function_metadata.json',
      'gui_api_function_metadata.json',
      'widget_api_function_metadata.json',
    ];
    if (!fs.existsSync(metadataDir)) {
      context.skip('Cavalry metadata is not installed on this host');
      return;
    }

    const documented = new Set<string>();
    for (const file of metadataFiles) {
      const entries = JSON.parse(fs.readFileSync(path.join(metadataDir, file), 'utf8')) as Array<{ name: string }>;
      for (const entry of entries) documented.add(entry.name);
    }
    // Constructors are documented in the Web APIs guide rather than the
    // function metadata shipped with Cavalry.
    documented.add('WebClient');
    documented.add('WebServer');
    documented.add('Timer');

    const used = [...source.matchAll(/\bapi\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]);
    const missing = [...new Set(used.filter((name) => !documented.has(name)))].sort();
    assert.deepEqual(missing, []);
  });
});
