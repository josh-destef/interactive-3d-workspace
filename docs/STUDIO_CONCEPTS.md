# CreateAccess 3D Studio Concept Slate

The existing fundamentals teach points, faces, axes, navigation, and transforms. These ideas extend that foundation into the creative workflow beginners encounter in Blender, Maya, 3ds Max, Unity, and similar tools.

## Design Principles

- Begin with direct manipulation before introducing terminology.
- Teach one mental model at a time.
- Give every lab a visible cause-and-effect loop.
- Use small creative challenges instead of long instructions.
- Keep controls limited, labeled, and reversible.
- Show professional vocabulary only after the learner has experienced the idea.

## Brainstormed Concepts

1. **Shape Forge** - Assemble a recognizable object from cubes, spheres, cylinders, cones, and toruses.
2. **Topology Lab** - Change segment density and smoothing while seeing vertices, edges, and face counts update.
3. **Material + Light Lab** - Discover color, roughness, metalness, light direction, and shadow through live rendering.
4. **Keyframe Studio** - Pose an object at different moments, insert keyframes, and compare linear, eased, and stepped motion.
5. **Camera Lab** - Compare perspective and orthographic projection, focal length, distance, and composition guides.
6. **UV Pattern Lab** - Wrap a checker texture around objects and correct stretching with scale, rotation, and projection modes.
7. **Modifier Playground** - Stack bend, twist, taper, bevel, mirror, and array effects non-destructively.
8. **Local vs World Space** - Rotate an object, then compare moving along global axes and its own local axes.
9. **Hierarchy Machine** - Parent wheels to a chassis or planets to a sun and see how nested transforms propagate.
10. **Silhouette Challenge** - Match target silhouettes using only a few primitives and multiple camera views.
11. **Precision + Snapping Lab** - Build a small structure using grid increments, angle snapping, alignment, and duplication.
12. **Normals Detective** - Flip face normals, reveal backface culling, and repair incorrect shading.
13. **Sculpting Sandbox** - Push, pull, smooth, inflate, and flatten a soft mesh with a brush.
14. **Procedural Pattern Builder** - Use repeat counts, spacing, randomness, and seeds to generate fences, stairs, and cities.
15. **Rigging Puppet** - Connect a simple skeleton to a character and pose limbs while learning joints and influence.
16. **Rendering Detective** - Compare real-time and path-traced ideas through samples, noise, reflections, and render time.
17. **Scene Optimization Game** - Reach a visual target under a polygon, texture-memory, and light budget.
18. **Composition Walkthrough** - Stage a tiny scene using focal point, contrast, depth, and rule-of-thirds overlays.

## First Build Wave

### 1. Shape Forge

The most important next step after transforms is making something. Primitive assembly is common across beginner tools and gives fast creative ownership without requiring edit-mode complexity.

### 2. Topology Lab

Beginners often mistake smooth shading for more geometry. This lab makes polygon density, silhouette quality, and shading mode visible at the same time.

### 3. Material + Light Lab

Objects become understandable when learners see that material appearance depends on both surface properties and illumination. This lab connects roughness, metalness, highlights, and shadows.

### 4. Keyframe Studio

Animation introduces time as another design dimension. A small timeline with explicit poses and interpolation makes keyframes and easing concrete.

## Later Candidates

Camera Lab, UV Pattern Lab, and Modifier Playground are the strongest candidates for a second wave because they naturally build on the four labs above.

## Second-Wave Gap Research

The following gaps are an inference from comparing official documentation across Blender, Autodesk, and Unity with the needs of a true beginner. The documentation is authoritative, but it is usually written to explain a production tool after the learner already understands the mental model. These topics benefit from an application-neutral interactive explanation first.

### Camera Projection and Lens Choice

Perspective, orthographic projection, focal length, camera distance, and composition are often taught as separate controls. Beginners can change them without seeing which visual effect came from projection and which came from camera placement.

**Interactive opportunity:** show the rendered camera view and a top-view diagram at the same time. Let learners hold subject size constant while changing lens and distance so perspective compression becomes visible.

### UV Mapping and Distortion

UV instruction commonly begins with editor commands and seam-marking steps. The underlying problem - flattening a 3D surface into 2D while managing cuts and distortion - is difficult to infer from button sequences.

**Interactive opportunity:** pair a live 3D checker texture with a synchronized 2D UV layout and a measured distortion score.

### Local, World, and Parent Space

Official engine documentation often introduces these spaces through transform properties or matrices. The idea becomes concrete only when an object is rotated and the learner sees two valid coordinate frames disagree.

**Interactive opportunity:** display both axis frames, switch the active gizmo between them, and leave a movement trail.

### Transform Hierarchies

Parenting is usually explained as a scene-management operation. Beginners often do not understand that child transforms are evaluated relative to the parent and composed through every ancestor.

**Interactive opportunity:** use a robot arm whose joints form a visible hierarchy. Show local and world coordinates while the learner reaches for a target.

### Face Normals and Winding

Normals are frequently introduced as arrows or shading data, while backface culling is taught elsewhere. The relationship between vertex order, front faces, normals, missing polygons, and lighting remains fragmented.

**Interactive opportunity:** deliberately corrupt a mesh, reveal its face normals, toggle culling, and let the learner repair individual triangles.

## Second Build Wave

1. **Camera Lab** - projection, focal length, distance, composition, and perspective compression.
2. **UV Mapping Lab** - projection methods, seams, texture scale, UV layout, and distortion.
3. **Coordinate Spaces Lab** - world versus local movement and transform orientation.
4. **Hierarchy Machine** - local transforms, parent-child composition, and forward kinematics.
5. **Normals Detective** - winding order, face direction, culling, and mesh repair.

## Third-Wave Research: From Scene to Play

The first two waves explain how 3D content is represented and authored. The next curriculum gap is systemic: beginners can make a scene but often cannot predict what turns it into a playable space.

### Non-Destructive Operation Order

Modifier documentation describes individual operations, but the stack is fundamentally an evaluation pipeline. An interactive lab can let learners reorder the same inputs and compare results without committing geometry.

### Rigid Bodies, Colliders, and Materials

Production physics documentation distinguishes dynamics from collision detection. Beginners commonly assume the visible mesh is the collision shape or that higher mass automatically means a higher bounce.

**Interactive opportunity:** render the collider over the visible mesh, expose one contact material at a time, and measure speed, contacts, and rebound height.

### Entity-Component Composition

Game engines increasingly build behavior through composition. A declarative A-Frame scene can make this visible: an entity remains the same address while independent components add appearance, motion, and interaction.

### Spatial Audio

Sound is often introduced after visuals, even though 3D panning is a powerful spatial-reasoning exercise. A source, listener, distance model, and directional guess form a complete feedback loop.

### Player Metrics and Grayboxing

A doorway, gap, corridor, or slope is not inherently large or small. Its meaning comes from the player's body and movement capabilities. This makes level grayboxing a strong application of scale, coordinates, measurement, and embodied reasoning.

### Game Feel as Layered Systems

Responsiveness is not one parameter. Acceleration, braking, steering, lateral grip, jump velocity, gravity, camera lag, and feedback each contribute a distinct signal. Teaching them separately makes subjective feel measurable.

## Third Build Wave

1. **Modifier Playground** - ordered, non-destructive geometry operations.
2. **Physics Playground** - cannon-es rigid bodies, colliders, material properties, and impulses.
3. **ECS Composer** - A-Frame entities and reusable behavior components.
4. **Spatial Audio Lab** - Web Audio position, panning, rolloff, and listening challenges.
5. **Graybox to Gameplay** - four lessons on metrics, guidance, pacing, and playtesting.
6. **Feel the Controls** - four lessons on response, steering, jump arcs, and feedback.

See `RESEARCH_ROADMAP.md` for the technology comparison, ranked future concepts, and course-design rationale.

## Fourth Build Wave: Production Literacy

The next wave completes the bridge from isolated authoring concepts to a usable real-time asset pipeline:

1. **Mesh Editing Lab** - extrude, inset, bevel, loop cuts, and topology consequences.
2. **Rigging + Skin Weights** - bones, binding, blended influence, and deformation health.
3. **Texture Maps + Baking** - high-to-low detail transfer and real-time map channels.
4. **Raycast Workshop** - screen coordinates, world rays, intersections, and filters.
5. **Optimization Challenge** - geometry, draw calls, textures, lights, instancing, LOD, and frame budget.
6. **Particle Behavior Lab** - emitter shape, lifetime, velocity, forces, blending, and color.
7. **Shader Graph Lab** - coordinates, math, noise, masks, ramps, and emission.
8. **Navigation + Pathfinding** - walkable space, clearance, search, and route playback.
9. **Sculpt + Retopology** - dense form editing and clean production topology.
10. **Rendering Detective** - rasterization, sampling, bounces, denoising, tone mapping, and effects.
11. **Asset Pipeline Inspector** - naming, units, axes, pivots, transforms, materials, compression, and glTF validation.
12. **Accessibility in 3D** - contrast, target size, FOV, motion comfort, and redundant cues.

Implementation details and verification state are recorded in `ADVANCED_BUILD_PROGRESS.md`.

## Research References

- [Blender Manual: Mesh Primitives](https://docs.blender.org/manual/en/latest/modeling/meshes/primitives.html) - primitives as starting points for mesh modeling.
- [Blender Manual: Materials](https://docs.blender.org/manual/en/latest/render/materials/introduction.html) - materials as definitions of surface appearance.
- [Blender Manual: Keyframes](https://docs.blender.org/manual/en/latest/animation/keyframes/introduction.html) - keyframes, interpolation, and animation curves.
- [Autodesk: Creating Primitives](https://www.autodesk.com/learn/ondemand/tutorial/creating-primitives) - a short beginner workflow centered on primitive creation.
- [Autodesk: 3D Modeling Software](https://www.autodesk.com/solutions/3d-modeling-software) - describes the common workflow of beginning with primitives and developing their polygon meshes.
- [Blender Manual: Cameras](https://docs.blender.org/manual/en/latest/render/cameras.html) - perspective and orthographic camera behavior.
- [Blender Manual: UV Seams](https://docs.blender.org/manual/en/latest/modeling/meshes/uv/unwrapping/seams.html) - describes seams as cuts used to flatten a surface.
- [Blender Manual: UV Introduction](https://docs.blender.org/manual/en/latest/editors/uv/introduction.html) - identifies distortion as a central UV-layout problem.
- [Blender Manual: Transform Orientation](https://docs.blender.org/manual/en/latest/editors/3dview/controls/orientation.html) - global, local, normal, and custom orientations.
- [Blender Manual: Parenting Objects](https://docs.blender.org/manual/en/latest/scene_layout/object/editing/parent.html) - parent transforms affecting children.
- [Unity Manual: Transforms](https://docs.unity3d.com/6000.2/Documentation/Manual/class-Transform.html) - local and global transform values in hierarchies.
- [Blender Manual: Viewport Shading](https://docs.blender.org/manual/en/latest/editors/3dview/display/shading.html) - backface culling and face display.
- [Blender Manual: Modifiers](https://docs.blender.org/manual/en/latest/modeling/modifiers/introduction.html) - non-destructive geometry operations, retained as a future lab.
- [Rapier JavaScript: Rigid Bodies](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/) - separates rigid-body dynamics from collider geometry.
- [Rapier JavaScript: Colliders](https://rapier.rs/docs/user_guides/javascript/colliders/) - collider shape, placement, and attachment.
- [A-Frame Introduction](https://aframe.io/docs/) - HTML-based 3D and WebXR authoring.
- [A-Frame Entity-Component-System](https://github.com/aframevr/aframe/blob/master/docs/introduction/entity-component-system.md) - composition-based behavior architecture.
- [Unity Character Controller](https://docs.unity3d.com/6000.4/Documentation/Manual/class-CharacterController.html) - player scale, slope, step, and collision parameters.
- [Godot: Your First 3D Game](https://docs.godotengine.org/en/4.4/getting_started/first_3d_game/index.html) - a complete beginner 3D game workflow.
- [MDN: PannerNode](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode) - 3D source position, orientation, and distance behavior.
- [Three.js: WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html) - future-facing WebGPU renderer and node-material support.
