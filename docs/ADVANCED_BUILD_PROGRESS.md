# Advanced 3D Curriculum Build Progress

Last updated: June 12, 2026

This build wave closes the largest gap between the existing creation labs and a production-ready real-time 3D workflow. Every module keeps the established CreateAccess structure:

1. one primary mental model
2. direct manipulation with immediate visual feedback
3. visible measurements rather than hidden success conditions
4. a machine-checkable challenge
5. shared typography, color, spacing, navigation, and responsive behavior
6. application-neutral vocabulary supported by a concrete Three.js implementation

## Shared Additions

- `advanced-lab-core.js` centralizes Three.js scene setup, lighting, orbit controls, resizing, common bindings, meters, labels, disposal, and challenge feedback.
- `advanced-lab.css` adds shared readouts, concept notes, warning notes, meters, process steps, legends, node rows, focus styles, and reduced-motion behavior.

The shared runtime is intentionally small. Topic-specific geometry, simulation, and assessment remain inside each module so the teaching behavior stays easy to inspect.

## High-Priority Modules

### Mesh Editing Lab

File: `mesh-editing-lab.html`

- extrude, inset, bevel, and loop-cut parameters
- procedural topology reconstruction
- live vertex, triangle, height, and top-width measurements
- wireframe and vertex inspection
- challenge requires a controlled multi-operation result

### Rigging + Skin Weights

File: `rigging-skinning-lab.html`

- real `THREE.SkinnedMesh`, bones, skin indices, and skin weights
- shoulder, elbow, and wrist posing
- selected-bone influence visualization
- rigid-crease versus blended-joint comparison
- target-reaching challenge that also enforces healthy blend width

### Texture Maps + Baking

File: `texture-baking-lab.html`

- high-detail source and low-poly target comparison
- generated albedo, normal, roughness, and ambient-occlusion maps
- texture resolution and memory estimates
- silhouette limitation of normal mapping
- challenge requires a complete real-time map set

### Raycast Workshop

File: `raycasting-lab.html`

- pointer pixels to normalized device coordinates
- camera ray visualization
- distance-sorted intersections
- near/far and layer filtering
- target selection through an explicit interaction policy

### Optimization Challenge

File: `optimization-lab.html`

- object count, mesh detail, texture resolution, and light cost
- estimated triangles, draw calls, texture memory, frame time, and visual score
- instanced rendering and distance-based detail reduction
- shipping challenge with simultaneous quality and performance constraints

## Follow-Up Modules

### Particle Behavior Lab

File: `particle-vfx-lab.html`

- emission rate, lifetime, velocity, gravity, drag, and emitter shape
- additive versus alpha blending
- color over lifetime
- bounded reusable particle pool

### Shader Graph Lab

File: `shader-graph-lab.html`

- UV, world, and normal coordinate sources
- scale, noise, threshold mask, color ramp, and emission nodes
- live GLSL procedural material
- visible active-node chain

### Navigation + Pathfinding

File: `navigation-pathfinding-lab.html`

- editable walkable grid
- agent-radius obstacle expansion
- A* search with searched-cell and path-length measurements
- route playback
- shift-click obstacle authoring

### Sculpt + Retopology

File: `sculpt-retopology-lab.html`

- push, smooth, and flatten brushes
- live dense-mesh deformation
- independent low-density retopology cage
- comparison of sculpt and production triangle counts

### Rendering Detective

File: `rendering-pipeline-lab.html`

- rasterization and path-tracing mental models
- sample, bounce, noise, and render-time relationships
- reflections, denoising, tone mapping, and post-processing
- explicit note that the browser preview models path-tracing tradeoffs while Three.js performs the display render

### Asset Pipeline Inspector

File: `asset-pipeline-lab.html`

- units, up axis, pivot, transforms, naming, PBR materials, and texture compression
- live bounds and pivot visualization
- estimated package size
- glTF-oriented validation checklist

### Accessibility in 3D

File: `accessibility-3d-lab.html`

- scene contrast, target size, field of view, and motion intensity
- reduced-motion and pause controls
- high-visibility palette
- redundant color, shape, and text cues
- system `prefers-reduced-motion` support

## Research Basis

The implementation was checked against primary technical references:

- Three.js `Raycaster`: normalized device coordinates, near/far filtering, layers, and distance-sorted intersections
- Three.js `SkinnedMesh`: skeleton binding plus skin-index and skin-weight attributes
- Three.js `LOD`: distance-associated detail representations
- Three.js `InstancedMesh`: repeated geometry/material rendering with reduced draw calls
- Khronos glTF 2.0 specification: coordinate system, units, transformations, skins, textures, and metallic-roughness materials
- Godot 3D navigation documentation: walkable regions, maps, agents, and path queries
- MDN `prefers-reduced-motion`: honoring operating-system motion preferences
- Blender Manual topic structure for mesh editing, skinning, baking, sculpting, and rendering terminology

## Verification Status

Completed:

- JavaScript module syntax extraction and parsing across all HTML files
- shared JavaScript module parsing
- local `href` and `src` reference resolution across all HTML files
- structural checks for titles, canvases, branding, challenges, controls, and duplicate IDs
- executable initialization of all twelve advanced modules in isolated DOM environments
- initialization at 1280 x 720 and 390 x 844 viewport dimensions
- real Three.js geometry, scene, material, skinning, instancing, and buffer logic during simulated runtime checks
- actual DOM control sequences that complete every authored challenge
- initial-state assertions proving that no advanced challenge starts complete
- accessible-name checks for every input and select

Reusable verification command:

```powershell
node scripts/qa-advanced-modules.mjs
```

The script expects temporary QA dependencies in:

```text
%TEMP%\fundamentals-3d-qa\node_modules
```

Not completed:

- real WebGL context creation and GPU shader compilation
- screenshot-based visual comparison
- browser-computed responsive overflow inspection

The configured in-app browser blocked both the local HTTP origin and direct file URLs through its security policy. No alternate browser surface was used after that policy decision. Runtime QA therefore remains a required follow-up and is not represented as complete.

The DOM runtime harness substantially narrows the remaining risk: page initialization, event handlers, control bindings, Three.js scene logic, challenge reachability, and mobile-sized initialization are covered. Remaining uncertainty is limited to real GPU/browser rendering and visually computed layout.

## Completion Audit

| Objective requirement | Evidence | Status |
| --- | --- | --- |
| Build all five high-priority topics | Five files listed under **High-Priority Modules**, linked from `index.html`, initialized and challenge-tested by `scripts/qa-advanced-modules.mjs` | Proven |
| Build all seven follow-up topics | Seven files listed under **Follow-Up Modules**, linked from `index.html`, initialized and challenge-tested by `scripts/qa-advanced-modules.mjs` | Proven |
| Follow established lesson principles | Every module has one primary mental model, direct controls, immediate measurements, an initially incomplete challenge, and an intentional completion path | Proven |
| Preserve CreateAccess branding | Every module uses `studio.css`, `advanced-lab.css`, Lexend/DM Mono, `LogoWText.png`, shared colors, and library navigation | Proven |
| Use research and sound technical models | Research basis above cites primary Three.js, Khronos, Godot, MDN, and Blender documentation; implementations use the corresponding concepts | Proven |
| Write maintainable code | Shared runtime and styles centralize repeated behavior; the QA harness executes the production shared runtime rather than a duplicated copy | Proven |
| Document progress | This file, `RESEARCH_ROADMAP.md`, and `STUDIO_CONCEPTS.md` record scope, rationale, and current verification | Proven |
| Add useful skill opportunities | `SKILL_OPPORTUNITIES.md` includes runtime QA, teaching geometry, asset readiness, and 3D accessibility opportunities | Proven |
| Verify real browser visuals and WebGL | The configured browser blocks local HTTP and file targets; no permitted screenshot, GPU compile, or computed-overflow evidence is available | Not proven |

The full objective should not be marked complete until the final row is verified through a permitted browser target.
