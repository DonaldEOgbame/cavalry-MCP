import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMcpServer } from '../../src/mcp/server.js';
import { runtimeToolRegistry } from '../../src/mcp/tool-registry.js';

describe('complete MCP tool registry contract', () => {
  it('registers every tool exactly once with a description, schema, and runtime handler', () => {
    const server = createMcpServer() as any;
    const definitions = runtimeToolRegistry.snapshot();
    const sdkTools = server._registeredTools ?? {};
    assert.equal(definitions.length, 404);
    assert.equal(new Set(definitions.map((item) => item.name)).size, definitions.length);
    for (const definition of definitions) {
      assert.ok(definition.description.length > 0, definition.name);
      assert.ok(definition.schema && typeof definition.schema === 'object', definition.name);
      assert.equal(typeof sdkTools[definition.name]?.handler, 'function', definition.name);
    }
  });

  it('keeps stdio bounded by default and exposes the full surface only when requested', () => {
    const previous = process.env.CAVALRY_TOOL_PROFILE;
    delete process.env.CAVALRY_TOOL_PROFILE;
    createMcpServer();
    assert.ok(runtimeToolRegistry.activeNames().length < runtimeToolRegistry.names().length);
    assert.equal(runtimeToolRegistry.activeNames().length, 60, 'the production profile grows only by render_scene_verified');
    assert.ok(runtimeToolRegistry.has('render_scene_verified'));
    assert.equal(runtimeToolRegistry.has('cavalry_raw_script'), false);
    process.env.CAVALRY_TOOL_PROFILE = 'full';
    createMcpServer();
    assert.equal(runtimeToolRegistry.activeNames().length, 404);
    if (previous === undefined) delete process.env.CAVALRY_TOOL_PROFILE;
    else process.env.CAVALRY_TOOL_PROFILE = previous;
  });
});
