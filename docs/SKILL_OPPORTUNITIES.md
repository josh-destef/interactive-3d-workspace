# CreateAccess Skill Opportunity Log

This file tracks workflows that are repeated, error-prone, or specialized enough to justify a reusable Codex skill. It is not a backlog of lesson topics; each entry describes automation or domain guidance that could be packaged and invoked consistently.

## Priority 1: Interactive 3D Lesson Builder

**Why it should be a skill**

Every lab repeats a recognizable process: select one mental model, define a direct-manipulation loop, build branded UI, create a Three.js scene, add a challenge, and verify runtime behavior. A skill could preserve quality while reducing setup time.

**Inputs**

- Concept and learner level
- Target interaction and misconception
- Required vocabulary
- Existing brand stylesheet and navigation target

**Outputs**

- Standalone HTML module using the repository's import map
- Branded sidebar, viewport, HUD, explanation, and challenge
- Homepage card
- Syntax and local-reference checks

**Required checks**

- One primary concept per lab
- Immediate visual feedback
- Keyboard/touch-safe interactions where applicable
- No console errors
- Responsive layout without horizontal overflow
- Challenge starts incomplete and can be completed

## Priority 1: Three.js Interactive QA

**Why it should be a skill**

Static parsing cannot catch missing WebGL imports, invalid geometry state, inaccessible controls, or interactions that fail to update visible feedback. The verification workflow is highly repeatable.

**Inputs**

- Local server command or workspace root
- Page list
- Primary interaction contract for each page

**Outputs**

- Runtime log report
- DOM/control inventory
- Interaction-state assertions
- Desktop and mobile overflow metrics
- Optional screenshots when supported

**Required checks**

- WebGL context and module load
- Console errors and warnings
- Canvas dimensions
- Unique primary controls
- State change after at least one meaningful interaction
- Local asset requests succeed

## Priority 1: GLB Model Normalizer

**Why it should be a skill**

Replacement models frequently have different authored origins, scales, rotations, material conventions, and bounding boxes. The repaired `fundamentals5.html` demonstrates that hard-coded gizmo placement is fragile.

**Inputs**

- GLB/GLTF path
- Desired facing direction
- Desired floor plane and target height
- Pivot policy: center, base, custom landmark

**Outputs**

- Bounds report before and after normalization
- Suggested wrapper transform
- Stable pivot and control-frame helpers
- Optional normalized export

**Required checks**

- Model rests on the requested floor
- Visual center and dimensions measured after authored transforms
- Scale/rotate controls share the actual pivot
- Animation and skinning remain intact

## Priority 2: Beginner 3D Curriculum Research

**Why it should be a skill**

Useful lesson selection requires comparing authoritative production documentation with beginner misconceptions and identifying concepts that can be made visible interactively.

**Inputs**

- Existing curriculum inventory
- Target audience and software ecosystem
- Desired number of new concepts

**Outputs**

- Coverage map
- At least ten candidate concepts
- Evidence links from official documentation
- Gap rationale labeled as evidence or inference
- Ranked interactive build recommendations

**Required checks**

- Avoid duplicating existing lessons
- Prefer cross-application mental models
- Separate terminology lessons from creative tasks
- Identify a visible cause-and-effect interaction for every recommendation

## Priority 2: Educational Challenge Designer

**Why it should be a skill**

Interactive labs need goals that prove conceptual understanding rather than reward random slider movement. Challenge design is reusable across modeling, lighting, animation, and scene construction.

**Inputs**

- Concept
- Available learner actions
- Observable scene state
- Difficulty level

**Outputs**

- Progressive challenge sequence
- Machine-checkable completion conditions
- Feedback states and hints
- Reset and retry behavior

**Required checks**

- Initial state is incomplete
- Completion cannot happen through one accidental click
- Conditions align with the learning objective
- Feedback says what remains without revealing every action

## Priority 2: Procedural Teaching Asset Generator

**Why it should be a skill**

Many lessons need purpose-built assets such as checker textures, corrupted normals, topology levels, camera test scenes, rigs, or simple characters. Generating these in code avoids licensing and download dependencies.

**Inputs**

- Teaching purpose
- Geometry complexity budget
- Required adjustable parameters

**Outputs**

- Three.js geometry/material factory
- Semantic metadata for interaction
- Visual debug modes
- Disposal and rebuild helpers

**Required checks**

- Geometry responds predictably to controls
- Face/vertex indices remain stable when interaction depends on them
- Materials expose the intended phenomenon clearly

## Priority 3: CreateAccess Brand Integrator

**Why it should be a skill**

New experiences should look and navigate like one suite. A small integration skill could add cards, labels, ordering, and shared tokens without rewriting unrelated homepage code.

**Inputs**

- New lab metadata
- Curriculum section and order
- Icon glyph and tags

**Outputs**

- Homepage card
- Shared typography/color usage
- Back-navigation and logo treatment

**Required checks**

- Link resolves locally
- Card title and description are specific
- Mobile grid remains usable
- Existing cards are preserved

## Watch List

These may become skills after more repetition:

- UV distortion analyzer for arbitrary BufferGeometry
- Face-winding and normal repair utility
- Camera/frustum teaching-scene generator
- Transform-hierarchy visualizer
- Accessible WebGL control patterns
- Offline bundling of CDN-based Three.js lessons

## Priority 1: Advanced Lab Runtime QA

**Why it should be a skill**

The production wave adds skinned geometry, procedural textures, custom shaders, dynamic buffer updates, instancing, editable navigation, and pointer-driven sculpting. These systems can parse correctly while failing only after a specific interaction.

**Inputs**

- Lab URL
- Required controls and initial state
- Interaction sequence
- Expected readouts and challenge condition

**Outputs**

- Console and resource report
- Control-state transitions
- WebGL object and buffer checks
- Challenge reachability result
- Desktop and mobile screenshots

**Required checks**

- Custom shaders compile
- Dynamic attributes update without warnings
- Pointer coordinates match canvas bounds
- Reset restores a valid state
- Challenge is incomplete initially and reachable intentionally

**Prototype**

`scripts/qa-advanced-modules.mjs` now covers isolated initialization, desktop/mobile dimensions, accessible form names, initial challenge state, and complete challenge paths. A future skill should extend it with a permitted browser surface for WebGL console logs, shader compilation, screenshots, and overflow measurements.

## Priority 2: Teaching Geometry Kernel

**Why it should be a skill**

Mesh editing, sculpting, normals, modifiers, topology, and skinning all need reliable procedural geometry updates. A small teaching-oriented kernel could provide ring construction, adjacency, brush neighborhoods, topology statistics, and debug overlays without hiding the relevant concept.

**Inputs**

- Base geometry recipe
- Intended edit operation
- Stable semantic regions
- Required overlays and measurements

**Outputs**

- BufferGeometry update functions
- Adjacency and neighborhood data
- Vertex, edge, and face statistics
- Selection and debug visualization

**Required checks**

- No invalid or non-finite positions
- Normals and bounds recompute after edits
- Indexed and non-indexed geometry are handled explicitly
- Resource disposal is included

## Priority 2: Real-Time Asset Readiness Auditor

**Why it should be a skill**

Units, axes, pivots, transforms, names, texture channels, bounds, skin weights, and compression are repeated handoff checks across glTF-oriented workflows.

**Inputs**

- GLB or glTF asset
- target engine conventions
- triangle and texture budgets
- animation and skinning expectations

**Outputs**

- machine-readable validation report
- bounds, units, axis, and pivot diagnosis
- material and texture inventory
- skin-weight and animation checks
- recommended normalization transform

**Required checks**

- preserve authored animation and skinning
- distinguish source problems from viewer normalization
- flag negative and non-uniform transforms
- report missing texture color-space intent

## Priority 2: 3D Accessibility Audit

**Why it should be a skill**

Interactive 3D lessons combine animation, camera motion, color, depth, sound, and small targets. Accessibility review needs to test the complete experience rather than static HTML alone.

**Inputs**

- Local lesson URL
- primary interaction and completion path
- motion, color, audio, and pointer behavior

**Outputs**

- keyboard and focus report
- reduced-motion behavior
- color-independent cue inventory
- target-size and responsive-layout findings
- alternate input and audio-cue findings

**Required checks**

- system motion preference is honored
- essential state is not color-only
- controls expose names and visible focus
- challenge remains achievable with reduced motion
- touch layouts avoid occluding required targets

## Priority 1: Stateful Course Track Builder

**Why it should be a skill**

The new course pages repeat a larger instructional contract than standalone labs: lesson navigation, objectives, machine-checkable readiness, persisted progress, next-lesson transitions, and a final completion state.

**Inputs**

- Course title and learning outcome
- Ordered lesson definitions
- Interactive scene state for each lesson
- Completion criteria and reset defaults

**Outputs**

- Branded multi-lesson page
- Local progress persistence
- Accessible lesson navigation
- Per-lesson objective and completion UI
- Course card for the library

**Required checks**

- Every lesson starts incomplete
- Every lesson can be completed without hidden controls
- Switching lessons rebuilds scene state cleanly
- Completion persists after reload
- Reset affects the current lesson without erasing course progress

## Priority 1: Multi-Engine CDN Compatibility QA

**Why it should be a skill**

The suite now uses Three.js modules, cannon-es, A-Frame, and browser-native Web Audio. Each has different loading, initialization, security, and user-gesture behavior.

**Inputs**

- Page inventory
- Expected CDN and browser APIs
- Required user gestures

**Outputs**

- Dependency request report
- Initialization and console-error report
- WebGL and audio capability checks
- Fallback recommendations

**Required checks**

- Import maps resolve
- Script globals initialize before use
- Web Audio starts only after an explicit gesture
- WebXR or WebGPU enhancements remain optional
- Core lesson remains understandable when an optional API is unavailable

## Priority 2: Physics Teaching Harness

**Why it should be a skill**

Physics lessons need synchronized render meshes, bodies, colliders, fixed-step simulation, debug overlays, reset behavior, contact metrics, and deterministic challenge setup.

**Inputs**

- Physics engine
- Body and collider recipes
- Exposed material parameters
- Measurement goal

**Outputs**

- Physics world bootstrap
- Visual/collider synchronization
- Contact and trajectory instrumentation
- Resettable experiments

**Required checks**

- Fixed timestep is bounded
- Dynamic resources are disposed on reset
- Collider visualization matches actual shape
- Challenge measures simulation results rather than slider values alone

## Priority 2: Spatial Audio Lesson Harness

**Why it should be a skill**

Browser audio requires gesture-gated startup and careful synchronization between visual coordinates, listener orientation, and `PannerNode` values.

**Inputs**

- Source signal or generated tone
- Listener and source controls
- Distance and panning models

**Outputs**

- Gesture-safe audio graph
- 3D source visualization
- Mystery-location challenge
- Headphone guidance and mute state

**Required checks**

- No audio begins before learner action
- Audio context resumes after browser suspension
- Visual and acoustic positions stay synchronized
- A non-audio explanation remains available
