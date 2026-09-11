# CreateAccess Creation Studio

Beginner 3D learning environment at **`/polished/creator/`**, shared by free play and guided lessons.
**Model an Accessory** runs at **`/polished/creator/?lesson=model-an-accessory`**;
its original lab URL redirects here.
**Build Gizmobot in Creation Studio** runs at **`/polished/creator/?lesson=build-gizmobot`**;
the original standalone assembly lab remains available unchanged.

From the repository root, serve the files with `python -m http.server 8000` and
open [Creation Studio](http://localhost:8000/polished/creator/). A browser with WebGL and an
internet connection for Three.js and Google Fonts is required, matching the labs.

## What is implemented

- Perspective viewport, neutral kit lighting, grid, ground shadows, Gizmobot,
  orbit/pan/zoom, reset view and focus selected.
- Shared Select / Move / Rotate / Scale tool rail, axis gizmos and uniform scale.
- A viewport-header Add menu groups Cube, Sphere, Cylinder, Cone and Plane under
  Shapes, with clear form previews, grounded spawn positions, automatic selection
  and undo. The grouped menu can grow with later object categories such as lights
  and cameras without moving creation controls into the Inspector.
- Outliner tree, ancestor expansion, keyboard selection, additive selection,
  visibility, inline rename and independent scrolling.
- Contextual Inspector registry: Transform, Geometry, Appearance and Hierarchy.
  Rotations display degrees; project data stores radians. Numeric editing is an
  alternative to dragging. Materials expose color, roughness and metalness.
- Rename, duplicate, delete, hide/show, group, ungroup and reparent. Any scene
  object can be a parent, so nested assemblies can use a meaningful shape as
  their root. Hierarchy operations preserve world placement or reject transforms requiring shear.
- One selection manager and one transactional history, bounded to 100 actions.
  Undo/redo restores objects, hierarchy, appearance and selection. A drag is one
  history action; Escape cancels it.
- Open/closed editor dock; narrow screens use an overlay with focus containment.
  Guidance collapses as the viewport narrows. Bottom editor host starts closed.
- Versioned serialization/restore API and future lesson capability configuration.

Navigation: drag to orbit, right-drag or Shift-drag to pan, scroll to zoom.
Shortcuts: V Select, W Move, E Rotate, R Scale, F Focus, Ctrl/Command Z Undo,
Ctrl/Command Shift Z or Ctrl Y Redo, Ctrl/Command D Duplicate, Delete remove.
Shortcuts do not intercept typing in form fields. Shift-click adds viewport
selection; Shift/Ctrl/Command-click adds Outliner selection.

## Architecture and files

The project is the source of truth. The viewport maintains derived Three.js
objects; UI code edits project records only through project methods. All modules
are ordinary ES modules with factory APIs. [ARCHITECTURE.md](ARCHITECTURE.md)
records the audit, implementation plan and integration contracts.

| New file/module | Responsibility |
| --- | --- |
| `index.html`, `css/creator.css` | Standalone shell, CreateAccess styling and responsive layout |
| `js/bootstrap.js`, `js/main.js` | Startup failure UI, composition, keyboard actions, Add menu and capabilities |
| `js/project.js` | Entity store, hierarchy math, commands, serialization and transactions |
| `js/history.js`, `js/selection.js` | Shared snapshot history and selection |
| `js/tools.js` | Active tool and allowed tool state |
| `js/viewport.js` | Three.js adapter, assets, picking, direct manipulation and camera |
| `js/dock.js`, `js/sceneTree.js`, `js/inspector.js` | Dock states, tree and Inspector registry |
| `js/inspectorSections/*.js` | Transform, Geometry, Appearance, Hierarchy and field helpers |
| `js/bottomEditor.js` | Mountable future editor host |
| `tests/*.mjs` | Model, derived viewport and browser interaction tests |
| `qa/` | Browser results and screenshots |

All changed/created files for this implementation are inside this directory.
Pre-existing uncommitted repository work was preserved.

Reused unchanged: `polished/kit/js/stage.js` (and its `utils.js` dependency),
`polished/kit/js/transformGizmos.js`, `polished/kit/css/tokens.css`,
`assets/models/gizmobot.glb` and `assets/brand/` logos. Three.js remains pinned at
0.158.0, as in Navigate + Transform. History, appearance and hierarchy patterns
were audited in the existing labs, without importing their lesson singletons.
Creation Studio replaces the stage's lesson-constrained orbit controls with its own
OrbitControls instance, allowing focus and navigation beyond the lab bounds.

## Lesson API

The standalone route exposes `window.creator` for integration and testing:

```js
creator.setCapabilities({
  tools: { rotate: false, scale: false, add: false },
  panels: { scene: false, bottomEditor: false },
  inspectorSections: { geometry: false, appearance: false }
});

const saved = creator.project.serialize();
creator.project.restore(saved); // validates, clears selection and resets history
creator.bottomEditor.mount(yourDOMNode);
creator.bottomEditor.open();
```

Capability calls merge partial configuration. Features default to enabled;
visibility and allowed tools are separate from entity data. This is an exposure
API for lesson composition, not an authorization/security boundary. Future labs
can register Inspector sections using the exported `createInspector` factory.

### Model an Accessory

`js/lessons/accessory.js` composes a guided build over the existing project,
selection, history, tools, and Inspector. It starts with the original four-piece
back-module example. The instruction panel’s See the pieces action separates it; Continue stays hidden until that animation finishes. The learner places the first cube at
`(-2, 1.75, -1)` behind Gizmobot, sizes it as the Backpack Body, then introduces
the settings side of the shared Snap control. The learner compares Regular
increments with Nearest surface, adjusts Surface reach, and surface-snaps a
smaller cube detail before shaping a cylinder mast and overlapping a sphere tip.
Building on Material Lab, the learner gives every piece its own color and surface
finish. Three focused hierarchy steps then connect Antenna Tip to Antenna Mast,
Mast to Backpack Body, and Backpack Detail to Backpack Body. Moving the Body
demonstrates the completed parent chain before unlocking free play; there is no
end-of-lesson quiz.

`js/lessons/guidance.js` and `css/lesson.css` provide the reusable instruction
surface: green step labels and newly introduced interface terms, a white card, orange target highlights, anchored
pointers, and optional dimming with a cutout around a live control. General
instructions use a larger panel flush with the left edge at the bottom of the viewport. **Got it** returns the card there and
releases the spotlight for practice; **Continue** appears when the practice gate
passes. On phones the instruction and Inspector have separate reserved areas.

Lesson copy marks new vocabulary with `terms: ['Viewport', 'Outliner']` metadata
passed to `guidance.show()` or `guidance.welcome()`. The shared renderer wraps
those terms in `.lesson-term`, using CreateAccess green consistently without
embedding HTML in lesson copy. Previous labs or lessons use parallel
`references: ['Navigate & Transform']` metadata and render in `.lesson-reference`
using CreateAccess navy. Use these conventions whenever a lesson introduces a
named Creation Studio control, workspace region, or prior lesson reference.

New capability groups support `shapes`, `actions` (duplicate, delete, visibility,
rename, group, ungroup, reparent), and `transformFields` (position, rotation, scale).
They default to enabled in free play. Hidden actions are also removed from their
keyboard shortcuts. These remain teaching controls, not access restrictions.

Run the lesson and capability regression checks with:

```text
node --test polished/creator/tests/project.test.mjs polished/creator/tests/accessory.test.mjs polished/creator/tests/guidance.test.mjs polished/creator/tests/lesson-capabilities.test.mjs
```

## Testing

Final verification: **14 model tests, the derived-viewport integration suite,
34 end-to-end browser checks, the Outliner/Inspector UI suite, and 38 real pointer
and keyboard gesture checks pass.** Browser runs report no runtime errors.
All new JavaScript files pass syntax checks. Desktop (1440×900), narrow drawer
(820×850) and phone (390×844) screenshots were visually inspected.

Screenshots: [default](qa/default.png), [Add menu](qa/add-menu.png),
[selected primitive and Inspector](qa/selected-primitive.png),
[grouped Scene](qa/grouped-scene.png), [narrow drawer](qa/narrow-drawer.png),
[phone](qa/phone.png). Detailed checks are in
[browser-results.json](qa/browser-results.json) and
[gesture-results.json](qa/gesture-results.json).

Run `node --test polished/creator/tests/project.test.mjs` from the repository root.
The model has no runtime dependencies. `tests/viewport.test.mjs` uses the same
temporary Three.js/JSDOM dependency location as the repository's existing QA
scripts: `%TEMP%/fundamentals-3d-qa/node_modules`.

Browser tests use a real, isolated headless Edge instance through the DevTools
protocol. The desktop browser tool could not start because of a Windows sandbox
ACL error, so this fallback was used for actual WebGL, mouse and keyboard tests.
Serve the repository on port 8000 and launch an isolated browser with remote
debugging on port 9337. Run browser tests **sequentially**, because they share its
Creation Studio tab:

```powershell
$creatorProfile = Join-Path $env:TEMP 'createaccess-creator-qa'
Start-Process 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' -WindowStyle Hidden -ArgumentList @('--headless=new', '--no-first-run', '--enable-unsafe-swiftshader', '--remote-debugging-port=9337', "--user-data-dir=$creatorProfile", 'http://localhost:8000/polished/creator/')
```

The test run in this environment needed an unsandboxed browser process because
the Windows execution sandbox prevented renderer startup and CDN access. That is
a test-environment constraint, not an application requirement.

```text
node polished/creator/tests/browser.test.mjs
node --test polished/creator/tests/ui.test.mjs
node polished/creator/tests/gestures.test.mjs
```

`node polished/creator/tests/capture-showcase.mjs` regenerates the representative
screenshots after the tests finish.

The browser session helper accepts no application mocks. The viewport unit test
mocks the GPU/asset transport but uses real Three transforms and real project
commands. Browser screenshots and machine-readable results are in `qa/`.

## Original editor boundaries (updated by the studio extension below)

- Model an Accessory and Material Lab run in Creation Studio; other labs retain their existing shells.
- Edit mesh and object animation are now available in standalone Creation Studio; see the
  modelling and animation workbench section below for scope and limitations.
- The bottom host now mounts the animation timeline.
- Standalone Creation Studio provides project files and browser autosave.
- Gizmobot is one high-level entity; its internal rig/meshes are not editable
  Scene entries. Primitives have the full editable geometry/material controls.
- Multi-selection supports grouping and deleting. Direct manipulation edits the
  active object; group several objects to transform them together.
- Scale is positive. Hierarchy changes that require shear are rejected instead
  of silently changing an object's appearance. This is not a general mesh editor.
- History stores whole project snapshots; large-scene optimization is deferred.

Further lessons can reuse this guidance surface and the same capability API.
Project save/load is provided by the studio extension below.

### Build Gizmobot in Creation Studio

`js/lessons/assembly.js` begins with twelve parts assembled and Gizmobot's
frowning Head plus an oversized Hand disconnected nearby. It introduces the
Viewport and Outliner through that visible problem, briefly revisits Move,
Rotate, and Scale from Navigate & Transform, then introduces Snap with its
default Regular increments. Snap settings and Nearest surface are held back for
Model an Accessory, where they have a visible modelling purpose.
The Head is repaired with Viewport Move and Rotate while its Inspector fields are
unavailable; the Hand is repaired exclusively through exact Position, Rotation,
and Scale values in the Transform Inspector while Viewport transform tools are
unavailable. The original smile returns when the Head reaches its target. The
original generated assembly GLB remains unchanged; the temporary frown is a
Viewport overlay.

## Material Lab integration

`?lesson=material-lab` composes the material lesson over this same editor. The
project exposes one semantic **Gizmobot Shell**; a material model profile maps its
Appearance state to `Shell_Paint` in the existing lesson GLB while preserving the
face, decals and fixed accents. The fixed neutral light, reference comparisons,
teaching gates and photo capture live in the lesson scenario, outside Appearance.

Material records accept optional `emissiveIntensity` (0–1.25); glow follows Base
Color. Both primitive materials and the semantic shell render this property.
`setCapabilities({appearance:{baseColor,rgb,roughness,metalness,emissive,
exploreRgb,readOnly},scene:{excludeIds}})` controls progressive exposure.
The Inspector offers `setExpanded(section, bool)` and `revealSection(section,
field)` so lessons can introduce a control without managing its DOM.

Watch comparisons restore the learner's material and do not enter history or
satisfy practice gates. Each constrained challenge establishes a new history
baseline with `project.history.clear()`; subsequent edits retain normal undo and
redo without restoring hidden properties from earlier exercises. Matching uses
the same named swatches and Appearance controls. Each submitted check reports an
overall match percentage plus Base Color, Roughness, and Metalness closeness,
alongside one perceptual hint rather than exact target values. Broad scoring
bands accept a recognisably close finish without requiring exact slider values.
Reduced-motion comparisons use static, slower holds.

Material Lab opens with a keyboard-accessible lesson overview. Each new control
gets a callout using the shared guidance card and a plain orange outline, without
a marker dot or dimming the model. On desktop the card points to the control;
Got it returns it to the lower-left home. Show me where reopens the callout and
reveals the control. Phone callouts stay in the reserved lower instruction area.
Optional comparison demos reuse the kit's Navigate/Transform pointer on the live
sliders, restore the learner's material, and never complete practice.

The journey includes one learner-paced demonstration in which the light circles
Gizmobot and then returns to its fixed neutral position. Light position and
temperature are not learner controls; the copy points toward a future lighting
lesson. Room lighting on/off remains only as an emission preview. Three
explanation checks cover roughness, metalness, and emission before free play
restores the learner's pre-challenge material and room-lighting choice. Editing
a checked match requires checking it again. RGB remains optional.

On phones the open Material dock stacks below a live preview, and its contents
scroll as one surface. Shared Creation Studio styles supply the surfaces, typography and
controls; `material-lesson.css` contains lesson density and responsive placement.

## Modelling and animation workbench

Free play now has three workspaces in the viewport header. Guided lessons keep
controlling their existing exposed features; the new workspace controls are
hidden there unless `features.studio` is explicitly enabled.

- **Object** edits the base scene. Move and rotate handles use world axes; scale
  handles and numeric Inspector fields use the object's local transform. **Snap**
  offers configurable movement, rotation and scale increments, plus a Nearest
  surface mode with adjustable reach for placing one object flush against another.
- **Edit mesh** converts a primitive into an editable polygon mesh. Choose Faces
  or Vertices, then pick in the viewport or use the keyboard-accessible element
  list. Drag the move handles or enter coordinates. Extrude adds depth, Inset
  creates a smaller face, and Subdivide splits faces with shared edge midpoints.
  Conversion, element movement and topology edits all use the project history.
  Sphere, cone and cylinder conversion uses a deliberately low-resolution mesh.
- **Animate** opens a timeline below the viewport while retaining the full-height
  Inspector. Add a transform key at frame 0, seek to another frame, then change
  the pose. Transform edits automatically record or update a key in this
  workspace. Playback and scrubbing evaluate derived transforms without changing
  the base scene or history. Object mode returns to the base pose.

The timeline supports play/pause/stop, a keyboard-accessible playhead, frame/FPS/end
settings, looping, multiple object tracks and selecting/moving/deleting keys.
Each key contains position, rotation and scale. Interpolation is linear,
smoothstep easing, or a step/hold; it applies to the segment after that key.
Rotations interpolate as Euler components, preserving authored full turns.
This is object animation, not skeleton or vertex animation.

**View** provides perspective and true orthographic front/right/top cameras,
selection framing, grid visibility and wireframe. Orthographic views support
pan/zoom and keep their viewing direction fixed.

**Project** saves and opens `.creator.json` files including meshes and keys.
Standalone work autosaves to this browser after edits; Restore autosave is an
explicit recovery action. Files are validated before replacing the scene. Invalid
files leave the current project intact. Save a file for portable storage; browser
storage may be cleared or unavailable. Imported project files do not load scripts,
textures or external models. File size is limited to 8 MB.

**Help** opens an optional field guide with short build/shape/animate exercises,
observation prompts and shortcuts. `I` records a key and Space plays/pauses in
Animate. Ctrl/Command S saves a project. Existing V/W/E/R/F and undo shortcuts
remain available outside text fields.

Additional checks:

```text
node --test polished/creator/tests/mesh.test.mjs polished/creator/tests/animation.test.mjs polished/creator/tests/studio-project.test.mjs polished/creator/tests/project-files.test.mjs
```

Current mesh limits are 20,000 vertices and 20,000 polygon faces per object, with
at most 64 corners per face. This teaching mesh editor uses polygon triangulation
and does not repair self-intersections or offer booleans, bevels, UVs, sculpting,
rigging, physics or rendering/export pipelines. Animation is one transform track
per object, without a graph editor or independent channel keying.
