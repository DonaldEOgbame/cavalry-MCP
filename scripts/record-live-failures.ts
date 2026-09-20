#!/usr/bin/env node

import { knowledgeEngine } from '../src/knowledge/engine.js';

const PROJECT_ID = 'cavalry-2.7.2-golden-corpus';
const failures = [
  {
    intent: 'Build and verify golden scene 04-word-rise-stagger',
    approach: 'Use the high-level word animation helper.',
    mcpOperation: 'text_animate_words', category: 'LIVE_CORPUS_VALIDATION',
    error: '04-word-rise-stagger: missing node type stagger',
    cause: 'The helper completed without producing the required Stagger node in Cavalry 2.7.2.',
    solution: 'Create Sub-Mesh and Stagger explicitly, connect Stagger to shapeTimeOffset, and validate the saved graph.',
    verifiedReplacement: 'Golden scene 04-word-rise-stagger passed graph extraction and five-frame visual validation.',
  },
  {
    intent: 'Build and verify golden scene 15-svg-asset-footage',
    approach: 'Assume the imported asset node is reported as fileAsset.',
    mcpOperation: 'asset_import', category: 'LIVE_CORPUS_VALIDATION',
    error: '15-svg-asset-footage: missing node type fileAsset',
    cause: 'Cavalry 2.7.2 reports the imported SVG graph as asset plus svgShape.',
    solution: 'Validate against the actual runtime node types asset and svgShape.',
    verifiedReplacement: 'Golden scene 15-svg-asset-footage passed with asset and svgShape nodes.',
  },
  {
    intent: 'Validate recipe repeated-data-cards in live Cavalry',
    approach: 'Render five timing checkpoints from the initial card grid.',
    mcpOperation: 'preview_frame', category: 'LIVE_RECIPE_VALIDATION',
    error: 'repeated-data-cards produced no visible motion across validation frames',
    cause: 'The initial card source had no animated property and default grid spacing caused overlap.',
    solution: 'Animate source opacity and explicitly set Grid Distribution count and size.',
    verifiedReplacement: 'Corrected repeated-data-cards produced three distinct rendered states and a visible repeated grid.',
  },
  {
    intent: 'Build and verify golden scene 14-editable-svg-path',
    approach: 'Convert an SVG staged outside configured filesystem roots.',
    mcpOperation: 'svg_convert_to_layers', category: 'LIVE_CORPUS_VALIDATION',
    error: "Access to filesystem path '/tmp/cavalry-golden-editable.svg' is outside the authorized sandbox roots.",
    cause: 'On macOS, /tmp and /private/tmp path canonicalization differed during path authorization.',
    solution: 'Stage through os.tmpdir() and pass the canonical returned path.',
    verifiedReplacement: 'Golden scene 14-editable-svg-path converted, saved, rendered, and passed graph validation.',
  },
  {
    intent: 'Validate recipe procedural-burst in live Cavalry',
    approach: 'Animate only source scale.y through a Duplicator.',
    mcpOperation: 'preview_frame', category: 'LIVE_RECIPE_VALIDATION',
    error: 'procedural-burst produced no visible motion across validation frames',
    cause: 'The valid source scale curve did not change the duplicated rendered outcome in this graph.',
    solution: 'Retain the scale curve and add a verified shared opacity driver that propagates to duplicates.',
    verifiedReplacement: 'Corrected procedural-burst produced three distinct rendered states.',
  },
  {
    intent: 'Build and verify golden scene 01-basic-transform-keyframes',
    approach: 'Keyframe basicShape rotation and assume success from the command response.',
    mcpOperation: 'keyframe_create', category: 'LIVE_CORPUS_VALIDATION',
    error: '01-basic-transform-keyframes: missing animated attribute rotation',
    cause: 'The rotation keyframe call returned without error but no rotation curve persisted in the scene graph.',
    solution: 'Verify curves from the saved snapshot and use persisted position, opacity, and scale attributes for the recipe.',
    verifiedReplacement: 'Golden scene 01 passed extracted-curve checks and five-frame render validation.',
  },
  {
    intent: 'Build and verify golden scene 20-logo-geometric-assembly',
    approach: 'Create a triangle primitive directly.',
    mcpOperation: 'layer_create_primitive', category: 'LIVE_CORPUS_VALIDATION',
    error: "Cannot read properties of null (reading 'uuid')",
    cause: 'triangle is not a supported primitive identifier in the live Cavalry 2.7.2 runtime.',
    solution: 'Use polygon primitives for geometric logo parts.',
    verifiedReplacement: 'Golden scene 20 built with polygons and passed hierarchy, animation, and render checks.',
  },
  {
    intent: 'Validate recipe orbit-loop in live Cavalry',
    approach: 'Drive the orbit parent rotation with a default Oscillator.',
    mcpOperation: 'preview_frame', category: 'LIVE_RECIPE_VALIDATION',
    error: 'orbit-loop produced no visible motion across validation frames',
    cause: 'The default Oscillator connection was structurally valid but produced a static visible output.',
    solution: 'Use a closed five-key position loop and verify that first/last samples match while intermediate renders differ.',
    verifiedReplacement: 'Corrected orbit-loop produced four distinct rendered states with matching loop endpoints.',
  },
  {
    intent: 'Build and verify golden scene 14-editable-svg-path',
    approach: 'Convert an SVG directly from the workspace path.',
    mcpOperation: 'svg_convert_to_layers', category: 'LIVE_CORPUS_VALIDATION',
    error: "Bridge operation 'svg_convert_to_layers' timed out after 15000ms.",
    cause: 'The live converter hung on the workspace path but succeeded with a staged temporary input.',
    solution: 'Stage SVG input in os.tmpdir(), relaunch Cavalry after a converter hang, then validate the editableShape output.',
    verifiedReplacement: 'Golden scene 14 passed using the staged temporary SVG workflow.',
  },
  {
    intent: 'Run the complete live integration suite in one Cavalry process',
    approach: 'Execute all 22 stateful integration tests sequentially in one host session.',
    mcpOperation: 'integration_test_suite', category: 'LIVE_BRIDGE_VALIDATION',
    error: 'Cavalry terminated natively before the final test after the long combined sequence.',
    cause: 'The crash appeared after the long stateful sequence when callback-server cleanup and final-scene isolation were not deterministic; Crashpad captured the native failure.',
    solution: 'Forward the Node test context, stop the callback receiver in an after hook, and start the final end-to-end test from a forced blank scene.',
    verifiedReplacement: 'The full 22-test sequence completed in one Cavalry process: 21 passed and the absent third-party-plugin test correctly skipped.',
  },
  {
    intent: 'Set visible Text Shape content through the bridge',
    approach: 'Set the text attribute to a plain string in a bulk attribute update.',
    mcpOperation: 'attribute_set_many', category: 'LIVE_TEXT_VALIDATION',
    error: 'The command succeeded but the rendered layer retained the default Cavalry text.',
    cause: 'Cavalry 2.7.2 expects the rich text payload shape for this attribute.',
    solution: 'Set text explicitly as { text, overrides: [] } after other attributes.',
    verifiedReplacement: 'Word, character, marker, mask, progress, and end-to-end text rendered with requested content.',
  },
];

for (const failure of failures) {
  await knowledgeEngine.addFailure(failure, 'project', PROJECT_ID, '2.7.2');
}
process.stdout.write(`${JSON.stringify({ recorded: failures.length }, null, 2)}\n`);
