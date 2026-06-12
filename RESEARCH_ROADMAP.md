# Interactive 3D Research and Build Roadmap

This roadmap compares the current CreateAccess suite with production-oriented 3D documentation and identifies concepts that are both underserved for beginners and suitable for direct manipulation.

## Current Coverage

The suite teaches dimensions, vertices and faces, navigation, transforms, primitive modeling, topology, materials, lighting, keyframes, cameras, UV mapping, coordinate spaces, hierarchies, face normals, mesh editing, skinning, texture baking, ray interaction, optimization, particles, procedural shaders, navigation, sculpting, rendering, asset handoff, and accessibility.

The largest remaining gap has shifted from basic production literacy to longer integrated workflows: character creation from sculpt through animation, complete environment production, authored VFX sequences, and collaborative publishing.

## Tool Radar

### Keep Using Three.js

Three.js remains the best base for tightly authored explanations because the suite already has a shared visual language, asset pipeline, and interaction model. Its modular scope also makes hidden systems visible instead of solving them invisibly.

Best fits:

- custom geometry and visualization
- camera and transform explanations
- authored game-feel simulations
- visual debugging overlays

### Add Rapier or cannon-es for Physics

Physics engines distinguish rigid-body motion from collision shape. That separation is itself an important lesson: the visible mesh, collider, mass, friction, and restitution are related but not interchangeable.

Best fits:

- rigid bodies and impulses
- restitution and friction
- collider debugging
- joints and constraints

This build wave uses `cannon-es` for a compact browser lab. Rapier remains the stronger candidate for a later, larger physics course because its JavaScript guide explicitly separates rigid bodies and colliders.

### Add A-Frame for Declarative 3D and ECS

A-Frame exposes 3D entities and components through HTML. Its entity-component-system architecture creates a beginner-friendly bridge from visible objects to reusable behavior composition.

Best fits:

- entity-component-system concepts
- WebXR-ready scenes
- declarative scene authoring
- behavior composition without class hierarchies

### Add the Web Audio API

`PannerNode` represents source position, orientation, distance falloff, and directional cones in 3D coordinates. This provides an unusually direct spatial-reasoning lesson that works without a game engine.

Best fits:

- locating unseen objects
- distance falloff
- stereo and HRTF comparison
- directional sound emitters

### Watch WebGPU and TSL

Three.js now documents `WebGPURenderer` and its node-based shading language. It is promising for teaching procedural materials and GPU computation, but WebGL remains the safer default for the broadest classroom compatibility.

Best later fits:

- node-based procedural materials
- compute-driven particles
- GPU simulation
- visual shader graphs

### Evaluate Babylon.js for Node-Based Creation

Babylon.js documents both a Node Material Editor and Node Geometry inspired by Blender Geometry Nodes. This is the strongest candidate for a future visual-programming course because the engine already treats material and geometry graphs as first-class authoring systems.

Best later fits:

- shader graph fundamentals
- procedural geometry graphs
- particle behavior graphs
- live inspector and debugging lessons

Adoption note: use Babylon.js when the node graph itself is the subject. Rebuilding the current direct-manipulation labs in another engine would increase maintenance without improving the concept.

### Evaluate PlayCanvas for Collaborative Authoring

PlayCanvas combines a browser editor, WebGL/WebGPU engine, Web Components, and live preview. It is a strong fit for a later course on scene organization, team workflows, assets, and publishing.

Best later fits:

- editor-to-runtime workflow
- collaborative scene building
- performance profiling
- standards-based Web Components

Adoption note: courses would need external project persistence or an embedded component workflow. Standalone CreateAccess HTML remains simpler for short labs.

### Use p5.js for Shader and Generative-Art On-Ramps

p5.js WebGL intentionally hides setup boilerplate and has beginner-oriented shader material. It offers a gentler bridge from 2D creative coding into vertex and fragment programs than a full game engine.

Best later fits:

- coordinates and color in shaders
- signed-distance shapes
- noise and procedural texture
- framebuffer and image effects

### Defer React Three Fiber

React Three Fiber is a React renderer for Three.js and its official introduction assumes both React and basic Three.js knowledge. It would be useful if CreateAccess becomes a component-based application, but it adds framework concepts that are unrelated to the current beginner learning goals.

Best later fits:

- a data-driven course platform
- reusable scene components
- application-scale state and routing

## Course Design Findings

Official beginner courses tend to teach engine operations in sequence. CreateAccess can add value by centering each lesson on a measurable design decision:

1. **Predict** what a spatial parameter will change.
2. **Manipulate** one or two variables.
3. **Playtest** the result immediately.
4. **Measure** distance, time, visibility, or error.
5. **Revise** until a clear target is reached.

This loop is used in the two new tracks:

- **Graybox to Gameplay** teaches scale, metrics, guidance, pacing, and playtesting.
- **Feel the Controls** teaches acceleration, turning, jump arcs, camera response, and feedback.

## Ranked New Concepts

1. **Physics Playground** - mass, friction, restitution, gravity, and impulses.
2. **Collider Workshop** - compare render meshes with box, sphere, capsule, convex, and compound colliders.
3. **ECS World Builder** - compose appearance and behavior from components.
4. **Spatial Audio Lab** - locate and shape sound in 3D space.
5. **Modifier Playground** - build non-destructively with ordered operations.
6. **Navigation Mesh Lab** - paint walkable space and inspect generated paths.
7. **Raycast Workshop** - connect screen pointers, world rays, intersections, and interaction layers.
8. **Occlusion and Visibility Lab** - learn sightlines, cover, reveal, and camera obstruction.
9. **LOD and Performance Budget** - balance screen size, geometric detail, draw calls, and frame time.
10. **Procedural Layout Builder** - generate rooms and paths from constraints and seeds.
11. **Sculpting Sandbox** - push, pull, smooth, flatten, and preserve volume.
12. **Rigging and Skin Weights** - compare rigid parenting with blended vertex influence.
13. **Particle Behavior Lab** - emitters, lifetime, velocity, drag, color, and shape.
14. **Shader Graph Lab** - combine coordinates, noise, masks, and color ramps.
15. **Post-processing Lab** - separate scene lighting from image-space effects.
16. **Accessibility in 3D Space** - contrast, motion reduction, field of view, target size, and alternate cues.
17. **WebXR Scale Room** - compare desktop camera assumptions with embodied scale.
18. **Save and Share a Scene** - serialize entities, transforms, materials, and authored intent.
19. **Node Material Course** - connect coordinates, math, masks, textures, and light in Babylon.js.
20. **Generative Shader Sketchbook** - move from 2D p5.js coordinates into WebGL shader space.
21. **Collaborative Scene Pipeline** - author, inspect, profile, and publish a scene with PlayCanvas.
22. **Gaussian Splat Explorer** - compare point-based scene capture with polygonal geometry.
23. **Screen-Space Effects Lab** - teach depth buffers, outlines, bloom, and color grading.
24. **GPU Particle Course** - progress from CPU emitters to node- or compute-driven simulation.

## Builds in This Wave

- `modifier-playground.html`
- `physics-playground.html`
- `ecs-composer.html`
- `spatial-audio-lab.html`
- `level-design-course.html`
- `game-feel-course.html`

## Advanced Production Wave

Built June 12, 2026:

- `mesh-editing-lab.html`
- `rigging-skinning-lab.html`
- `texture-baking-lab.html`
- `raycasting-lab.html`
- `optimization-lab.html`
- `particle-vfx-lab.html`
- `shader-graph-lab.html`
- `navigation-pathfinding-lab.html`
- `sculpt-retopology-lab.html`
- `rendering-pipeline-lab.html`
- `asset-pipeline-lab.html`
- `accessibility-3d-lab.html`

Shared support:

- `advanced-lab-core.js`
- `advanced-lab.css`

See `ADVANCED_BUILD_PROGRESS.md` for instructional scope, implementation notes, and verification status.

## Primary References

- [Rapier JavaScript: Rigid Bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)
- [Rapier JavaScript: Colliders](https://rapier.rs/docs/user_guides/javascript/colliders/)
- [A-Frame Introduction](https://aframe.io/docs/)
- [A-Frame Entity-Component-System](https://github.com/aframevr/aframe/blob/master/docs/introduction/entity-component-system.md)
- [Unity Character Controller](https://docs.unity3d.com/6000.4/Documentation/Manual/class-CharacterController.html)
- [Godot: Your First 3D Game](https://docs.godotengine.org/en/4.4/getting_started/first_3d_game/index.html)
- [MDN: PannerNode](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode)
- [MDN: Web Audio Spatialization Basics](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics)
- [Three.js: WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html)
- [Blender: Modifiers](https://docs.blender.org/manual/en/latest/modeling/modifiers/introduction.html)
- [Babylon.js: Node Material](https://doc.babylonjs.com/features/featuresDeepDive/materials/node_material/nodeMaterial)
- [Babylon.js: Node Geometry](https://doc.babylonjs.com/features/featuresDeepDive/mesh/nodeGeometry)
- [PlayCanvas: Graphics](https://developer.playcanvas.com/user-manual/graphics/)
- [PlayCanvas: Web Components](https://developer.playcanvas.com/user-manual/web-components/)
- [React Three Fiber: Introduction](https://r3f.docs.pmnd.rs/getting-started/introduction)
- [p5.js: Introduction to Shaders](https://p5js.org/tutorials/intro-to-shaders/)
