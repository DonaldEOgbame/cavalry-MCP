import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

/**
 * Executes the real cavalry/bridge.js inside a VM with a scripted stand-in for
 * Cavalry's `api`/`ui` globals. It exercises the bridge's own control flow
 * (dispatch, re-entrancy, incident capture) — not Cavalry's rendering.
 */
export interface BridgeSandbox {
  api: Record<string, any>;
  appCallbacks: Record<string, (...args: any[]) => unknown>;
  timers: Array<{ callbacks: { onTimeout: () => void }; interval: number; repeating: boolean }>;
  responses: any[];
  request(op: string, params?: Record<string, unknown>, extra?: Record<string, unknown>): Record<string, any>;
  post(request: Record<string, unknown>): void;
  pump(): void;
  tick(): void;
  send(op: string, params?: Record<string, unknown>, extra?: Record<string, unknown>): any;
  responseFor(id: string): any;
  cleanup(): void;
}

export interface SandboxOptions {
  /** Bridge source to execute (defaults to cavalry/bridge.js in the working tree). */
  source?: string;
  /** A host model supplying the Cavalry API instead of the built-in stubs. */
  host?: { api: Record<string, any>; setCallbacks(callbacks: Record<string, any>): void };
}

export function createBridgeSandbox(overrides: Record<string, any> = {}, options: SandboxOptions = {}): BridgeSandbox {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-sandbox-'));
  const sessionId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  const responseDirectory = path.join(tempRoot, 'cavalry-mcp', sessionId);
  fs.mkdirSync(responseDirectory, { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'cavalry-mcp', `session-${sessionId}.json`), JSON.stringify({
    sessionId, token, callbackHost: '127.0.0.1', callbackPort: null, responseDirectory,
    allowRawScript: false, expiresAt: Date.now() + 60_000,
  }));

  const queue: string[] = [];
  const responses: any[] = [];
  const timers: BridgeSandbox['timers'] = [];
  let webCallback: { onPost: () => void } | null = null;
  let appCallbacks: Record<string, any> = {};

  class WebServer {
    listen() {}
    setRealtime() {}
    addCallbackObject(callback: { onPost: () => void }) { webCallback = callback; }
    postCount() { return queue.length; }
    getNextPost() { return { result: queue.shift() }; }
    setResultForGet(json: string) { responses.push(JSON.parse(json)); }
  }
  class Timer {
    entry: BridgeSandbox['timers'][number];
    constructor(callbacks: { onTimeout: () => void }) {
      this.entry = { callbacks, interval: 0, repeating: true };
      timers.push(this.entry);
    }
    setInterval(value: number) { this.entry.interval = value; }
    setRepeating(value: boolean) { this.entry.repeating = value; }
    start() {}
  }
  class Widget { setText() {} setAlignment() {} add() {} addStretch() {} }

  const plumbing: Record<string, any> = {
    WebServer, Timer,
    WebClient: class { post() {} },
    getTempFolder: () => tempRoot,
    readFromFile: (file: string) => fs.readFileSync(file, 'utf8'),
    getAbsolutePath: (file: string) => path.resolve(file),
    writeToFile: () => true,
  };
  const stubs: Record<string, any> = {
    getCavalryVersion: () => '2.7.2',
    getActiveComp: () => 'compNode#1',
    getFrame: () => 0,
    getSceneFilePath: () => '',
    sceneHasUnsavedChanges: () => false,
    getCurrentGeneratorType: () => 'renderMP4',
    get: () => undefined,
    render: () => undefined,
    cancelRender: () => undefined,
    processEvents: () => undefined,
    getSelection: () => [],
    getAllSceneLayers: () => [],
    getNiceName: (id: string) => id,
    getLayerType: () => 'basicShape',
  };
  const base: Record<string, any> = { ...plumbing, ...(options.host ? options.host.api : stubs), ...overrides };
  const api = new Proxy(base, {
    get(target, property: string) {
      if (property in target) return target[property];
      return () => undefined;
    },
  });
  const ui = {
    setTitle() {}, add() {}, show() {},
    VLayout: Widget, Label: Widget,
    addCallbackObject(callback: Record<string, any>) { appCallbacks = callback; options.host?.setCallbacks(callback); },
  };
  const context = vm.createContext({ api, ui, cavalry: {}, console: { log() {} }, Date, Math, JSON });
  vm.runInContext(options.source ?? fs.readFileSync(path.resolve('cavalry/bridge.js'), 'utf8'), context, { filename: 'bridge.js' });

  const sandbox: BridgeSandbox = {
    api: base,
    get appCallbacks() { return appCallbacks; },
    timers,
    responses,
    request(op, params = {}, extra = {}) {
      const id = `req_${crypto.randomUUID()}`;
      return {
        protocolVersion: 2, id, sessionId, token, op, params, timestamp: Date.now(),
        responseFile: path.join(responseDirectory, `${id}.json`), ...extra,
      };
    },
    post(request) { queue.push(JSON.stringify(request)); },
    pump() { webCallback?.onPost(); },
    tick() { timers[0]?.callbacks.onTimeout(); },
    send(op, params = {}, extra = {}) {
      const request = sandbox.request(op, params, extra);
      sandbox.post(request);
      sandbox.pump();
      return sandbox.responseFor(request.id as string);
    },
    responseFor(id) { return responses.find((response) => response.id === id); },
    cleanup() { fs.rmSync(tempRoot, { recursive: true, force: true }); },
  };
  return sandbox;
}
