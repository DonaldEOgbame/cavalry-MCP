import { MotionRecipe } from './types.js';

// Curated starting points, intentionally expressed as adaptable construction guidance rather than macros.
export const CORE_RECIPES: MotionRecipe[] = [
  {
    name: 'word-rise-stagger', category: 'kinetic_typography', description: 'Words enter vertically with overlapping deceleration.',
    requirements: ['Text layer', 'word separation or text distribution'],
    construction: ['Create or reuse a Text Shape.', 'Separate or distribute by word.', 'Drive vertical offset through Stagger.', 'Animate the shared entrance control rather than every word.'],
    animation: { offsetY: 90, staggerFrames: 2, durationFrames: 8 }, easing: { type: 'bezier', character: 'decelerating' }, variants: ['character', 'line'],
    preferredMcpOperations: ['layer_create', 'generator_set', 'graph_connect', 'attribute_set', 'keyframe_create'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'character-cascade', category: 'kinetic_typography', description: 'Characters enter in sequence using one procedural stagger control.',
    requirements: ['Text Shape', 'character-level distribution'],
    construction: ['Use text character output/sub-mesh support where available.', 'Apply a Stagger to position, scale, or opacity.', 'Animate the stagger phase or source property.'],
    variants: ['position', 'opacity', 'rotation'], preferredMcpOperations: ['layer_create', 'graph_connect', 'attribute_set', 'keyframe_create'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'mask-line-reveal', category: 'kinetic_typography', description: 'Reveal a line of type with an animated mask while retaining readable type.',
    requirements: ['Text layer', 'mask-compatible shape'],
    construction: ['Create text.', 'Create a reveal shape sized to the line.', 'Connect or parent the mask using the runtime-supported mask system.', 'Animate only the mask extent or position.'],
    variants: ['horizontal wipe', 'vertical wipe'], preferredMcpOperations: ['layer_create', 'attribute_set', 'graph_connect', 'keyframe_create'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'radial-duplication-wave', category: 'shape_motion', description: 'Repeat one shape around a circle and phase a shared animated property clockwise.',
    requirements: ['Source shape', 'Duplicator', 'Circle Distribution', 'Stagger or falloff'],
    construction: ['Create one source shape.', 'Feed it to a Duplicator.', 'Use Circle Distribution for radial placement.', 'Use Stagger/Falloff for phase variation.', 'Animate one shared scale, position, rotation, or opacity parameter.'],
    animation: { copies: 16, direction: 'clockwise' }, variants: ['scale wave', 'radial offset', 'opacity wave'],
    preferredMcpOperations: ['layer_create', 'generator_set', 'graph_connect', 'attribute_set', 'keyframe_create'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'grid-duplication-wave', category: 'shape_motion', description: 'Generate a grid from one source and propagate motion with a Stagger or spatial falloff.',
    requirements: ['Source shape', 'Duplicator', 'Grid Distribution'],
    construction: ['Create one source shape.', 'Connect it to a Duplicator.', 'Set Grid Distribution rows and columns.', 'Drive timing with Stagger or a spatial field.'],
    variants: ['row wave', 'column wave', 'radial falloff'], preferredMcpOperations: ['layer_create', 'generator_set', 'graph_connect', 'attribute_set', 'keyframe_create'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'orbit-loop', category: 'shape_motion', description: 'Create a loopable orbit using a circular distribution or procedural angle driver.',
    requirements: ['Orbiting source', 'center or circular distribution'],
    construction: ['Choose a circular distribution for multiple objects or a parent pivot for one object.', 'Animate a full-turn angle with linear interpolation.', 'Match first and last samples without duplicating the visible loop frame.'],
    variants: ['single orbit', 'multi-orbit', 'elliptical'], preferredMcpOperations: ['layer_create', 'graph_connect', 'attribute_set', 'keyframe_create', 'keyframe_set_interpolation'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'shape-scale-pop', category: 'shape_motion', description: 'A concise scale entrance with controlled overshoot.',
    requirements: ['Shape or shape-producing layer'],
    construction: ['Keyframe scale from zero or a small readable value.', 'Add a restrained overshoot.', 'Settle quickly to final scale.', 'Offset copies procedurally when repeated.'],
    animation: { durationFrames: 10, overshoot: 1.08 }, preferredMcpOperations: ['keyframe_create', 'keyframe_set_tangent'], fallback: 'none',
  },
  {
    name: 'procedural-burst', category: 'shape_motion', description: 'Build a radial burst from a repeated source instead of independent layers.',
    requirements: ['Source line or shape', 'Duplicator', 'Circle Distribution'],
    construction: ['Create the burst element once.', 'Duplicate radially.', 'Animate radius, length, or scale.', 'Use Stagger only when sequential timing is intended.'],
    variants: ['line burst', 'dot burst', 'logo accent'], preferredMcpOperations: ['layer_create', 'generator_set', 'graph_connect', 'attribute_set', 'keyframe_create'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'directional-wipe-transition', category: 'transitions', description: 'Transition between states with a single animated matte or clipping shape.',
    requirements: ['Outgoing/incoming layers', 'matte or mask support'],
    construction: ['Group the target content.', 'Create one transition matte.', 'Animate its position or extent through frame.', 'Preserve continuity by sharing direction with adjacent motion.'],
    variants: ['left', 'right', 'up', 'down'], preferredMcpOperations: ['layer_create', 'graph_connect', 'attribute_set', 'keyframe_create'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'logo-geometric-assembly', category: 'logo_motion', description: 'Assemble a mark from meaningful geometric parts with shared timing controls.',
    requirements: ['Separated logo parts or editable paths'],
    construction: ['Identify a minimal semantic part hierarchy.', 'Parent related parts.', 'Use shared controls for build progress.', 'Stagger only enough to preserve logo recognition.'],
    variants: ['radial assembly', 'linear build', 'scale reveal'], preferredMcpOperations: ['scene_import', 'layer_parent', 'attribute_set', 'keyframe_create'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'progress-indicator', category: 'data_motion', description: 'Drive a progress visual and optional label from one normalized value.',
    requirements: ['Progress shape', 'normalized control value'],
    construction: ['Create one 0–1 progress control.', 'Connect it to the graphic extent.', 'Derive text/counter display from the same value.', 'Animate the control, not each output.'],
    variants: ['bar', 'ring', 'counter'], preferredMcpOperations: ['layer_create', 'graph_connect', 'attribute_set', 'keyframe_create'], fallback: 'cavalry_raw_script',
  },
  {
    name: 'repeated-data-cards', category: 'data_motion', description: 'Use a reusable card/component and data-driven repetition for repeated records.',
    requirements: ['Card component', 'tabular data', 'Duplicator or data distribution'],
    construction: ['Expose card content through Control Centre attributes.', 'Connect the data source.', 'Duplicate the component through a distribution.', 'Animate a shared reveal with stagger.'],
    variants: ['list', 'grid', 'carousel'], preferredMcpOperations: ['component_import', 'graph_connect', 'attribute_set'], fallback: 'cavalry_raw_script',
  },
];
