# CreateAccess Creator

Standalone beginner 3D editor at **`/polished/creator/`**. It runs independently of
every lesson. No existing lab is migrated or changed.

From the repository root, serve the files with `python -m http.server 8000` and
open [Creator](http://localhost:8000/polished/creator/). A browser with WebGL and an
internet connection for Three.js and Google Fonts is required, matching the labs.

## What is implemented

- Perspective viewport, neutral kit lighting, grid, ground shadows, Gizmobot,
  orbit/pan/zoom, reset view and focus selected.
- Shared Select / Move / Rotate / Scale tool rail, axis gizmos and uniform scale.
- Add Cube, Sphere, Cylinder, Cone and Plane, with grounded spawn positions,
  automatic selection and undo.
- Scene tree, ancestor expansion, keyboard selection, additive selection,
  visibility, inline rename and independent scrolling.
- Contextual Inspector registry: Transform, Geometry, Appearance and Hierarchy.
  Rotations display degrees; project data stores radians. Numeric editing is an
  alternative to dragging. Materials expose color, roughness and metalness.
- Rename, duplicate, delete, hide/show, group, ungroup and reparent. Hierarchy
  operations preserve world placement or reject transformations requiring shear.
- One selection manager and one transactional history, bounded to 100 actions.
  Undo/redo restores objects, hierarchy, appearance and selection. A drag is one
  history action; Escape cancels it.
- Open/closed/pinned dock; narrow screens use an overlay with focus containment.
  Guidance collapses as the viewport narrows. Bottom editor host starts closed.
- Versioned serialization/restore API and future lesson capability configuration.

Navigation: drag to orbit, right-drag or Shift-drag to pan, scroll to zoom.
Shortcuts: V Select, W Move, E Rotate, R Scale, F Focus, Ctrl/Command Z Undo,
Ctrl/Command Shift Z or Ctrl Y Redo, Ctrl/Command D Duplicate, Delete remove.
Shortcuts do not intercept typing in form fields. Shift-click adds viewport
selection; Shift/Ctrl/Command-click adds Scene selection.

## Architecture and files

The project is the source of truth. The viewport maintains derived Three.js
objects; UI code edits project records only through project methods. All modules
are ordinary ES modules with factory APIs. [ARCHITECTURE.md](ARCHITECTURE.md)
records the audit, implementation plan and integration contracts.

| New file/module | Responsibility |
| --- | --- |
| `index.html`, `css/creator.css` | Standalone shell, CreateAccess styling and responsive layout |
| `js/bootstrap.js`, `js/main.js` | Startup failure UI, composition, keyboard actions, Add popover and capabilities |
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
Creator replaces the stage's lesson-constrained orbit controls with its own
OrbitControls instance, allowing focus and navigation beyond the lab bounds.

## Future lesson API

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

## Testing

Final verification: **14 model tests, the derived-viewport integration suite,
34 end-to-end browser checks, the Scene/Inspector UI suite, and 38 real pointer
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
Creator tab:

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

## Deliberately deferred and limitations

- No lesson migration, challenge logic or progression engine.
- Object mode only. No vertex/edge/face editing, extrusion, bevel, physics,
  particles, game tools or robotics tools.
- The bottom host is a placeholder; there is no timeline or animation editor yet.
- Project data lasts for the current session. Serialization is available through
  the API; file import/export, autosave and persistence UI are not implemented.
- Gizmobot is one high-level entity; its internal rig/meshes are not editable
  Scene entries. Primitives have the full editable geometry/material controls.
- Multi-selection supports grouping and deleting. Direct manipulation edits the
  active object; group several objects to transform them together.
- Scale is positive. Hierarchy changes that require shear are rejected instead
  of silently changing an object's appearance. This is not a general mesh editor.
- History stores whole project snapshots; large-scene optimization is deferred.

Before migrating a lab, validate the interaction model with beginners, agree on
project save/load and asset contracts, then use capability configuration to make
one small lesson integration as a separate change.
