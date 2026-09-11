# Standalone Creation Studio

## Plan and audit

Build an isolated ES module editor at `/polished/creator/`, with no lesson migration.
Navigate + Transform supplies the visual reference; import kit tokens, stage and
transform gizmo visuals unchanged. Reuse `assets/models/gizmobot.glb` as a single
selectable entity. Material Lab informs appearance controls; Model an Accessory
informs snapshot history; Hierarchy demonstrates local/world transform handling.
Animation Lab stays independent: the bottom host is an extension slot only.

Implement model/history, viewport adapter, and dock/Inspector independently, then
integrate the shell and capabilities. Test the model before browser milestones;
exercise shared selection, editing, history, hierarchy, and responsive layout.

## Contracts (initial implementation)

All modules export factories; no lesson singletons. UI never mutates Three objects.
`createProject()` returns the single authoritative project:

- `entities`: array of entity records; `get(id)`; `children(parentId)`.
- Entity: `{id,name,type,parentId,visible,locked,components:{transform:{position:[x,y,z],rotation:[x,y,z],scale:[x,y,z]},geometry?:{...},material?:{color,roughness,metalness}}}`. Rotation is radians, scale positive. Types: group, gizmobot, cube, sphere, cylinder, cone, plane.
- Initial roots: `gizmobot` (transform position [-2,0,0], rotation [0,Math.PI,0]) and `creation` (identity group named My Creation). No initial history actions.
- `selection`: `ids` array, `activeId`, `set(idOrIds)`, `add(id)`, `clear()`; selecting does not create history.
- `subscribe(listener)` returns unsubscribe; events `{kind,label?}` with kind `change`, `selection`, or `history`. Consumers may safely reread the project.
- `addPrimitive(type)` (under creation, auto-select); `rename(id,name)`, `setVisible(id,bool)`, `duplicate(id)`, `remove(id)`, `group(ids = selection.ids)`, `ungroup(id)`, `reparent(id,parentId)`.
- `updateTransform(id,partial)`, `updateGeometry(id,partial)`, `updateMaterial(id,partial)` commit undoable edits by default. Geometry keys: cube width/height/depth; sphere radius; cylinder/cone radius/height; plane width/height.
- `beginTransaction(label)`, `commitTransaction()`, `cancelTransaction()` coalesce live updates. One drag = one undo; escape cancels.
- `history.undo()`, `.redo()`, boolean getters `.canUndo/.canRedo`.
- `serialize()` returns versioned plain JSON; `restore(data)` validates/restores. No Three references in saved state.
- Group/reparent/ungroup preserve world placement; reject cycles and transforms that cannot be represented without shear. Any scene object can parent another, which supports meaningful nested assemblies; the protected creation root cannot be deleted/reparented/ungrouped.

`createTools()` in tools.js: `setActive(name)`, `getActive()`, `subscribe(fn)`, `setAllowed(record)`; select/move/rotate/scale/add. Object mode only.

`createViewport({project,tools,canvasId:'cv',wrapId:'canvas-wrap',onStatus})`:
returns `{resetView(),focusSelected(),dispose(),ready, getObject(id), stage}`.
Imports kit stage and transformGizmos. Owns derived Three objects and all pointer
interactions. Model events reconcile object transforms and resources. Gizmo writes
go through project transactions. Scene picking respects inherited visibility.

`createDock({project,root,onFocus})` renders contents inside #editor-dock:
returns `{setState('closed'|'open'|'pinned'),getState(),setCapabilities(config),dispose()}`.
Sets root.dataset.state and root.hidden when closed. Main handles external toggle.
DOM sections use `.scene-panel`, `.scene-tree`, `.scene-row`, `.inspector`,
`.inspector-section`, `.axis-fields`, `.field`, `.object-actions`, `.dock-header`.
Inspector sections live in js/inspectorSections/, with an extensible registry.
Do not rebuild focused inputs on live model updates. Expanded state survives edits.

Shell ownership: orchestrator owns index.html, js/main.js, js/tools.js,
js/bottomEditor.js, css/creator.css, docs and integration QA.
Model agent owns js/project.js, js/history.js, js/selection.js, tests/project.test.mjs.
Viewport agent owns js/viewport.js (may add js/viewport*.js adapters).
Dock agent owns js/sceneTree.js, js/inspector.js, js/dock.js, js/inspectorSections/*.
No agent modifies another owner's files without coordinating.

Capabilities are merged defaults in main: tools, panels (scene/inspector/bottomEditor),
inspectorSections. `window.creator` exposes project, tools, viewport, dock,
setCapabilities, bottomEditor. This is an explicit development/lesson integration API.

## Studio extension (September 2026)

The initial object-only contract above is extended by optional components:

- `components.mesh: { vertices: number[3][], faces: number[][] }` is authoritative
  once a primitive enters Edit mesh. Geometry parameter fields are then hidden.
  `project.setMesh(id, mesh)` validates and commits an immutable history entry.
- `components.animation: { keys: [{frame, transform, interpolation}] }` stores
  sorted, unique transform keys. `project.updateAnimation(id, recordOrNull)` is
  undoable. `animationSettings: {fps, duration, loop}` belongs to project snapshots
  and serialization; `setAnimationSettings` validates changes. Legacy version-1
  files without these optional fields still load.

`studio.js` composes workspace modes, view utilities, mesh editing, timeline,
project files and help. `mesh.js` owns pure polygon operations; `meshEditor.js`
uses a derived selection overlay and TransformControls with one history entry per
completed drag. Cancellation restores the drag-start topology.

`animation.js` evaluates keys into `viewport.setPreviewTransforms(Map|null)`.
Seeking and playback never mutate project records. Animate-mode transform edits
upsert keys through the ordinary project transactions. `editingProject.js` is an
Inspector facade: it reads evaluated transforms and routes pose edits to the
controller. The actual project always retains base transforms. Object mode clears
preview; playback disables editing. `timeline.js` owns timeline UI only.

`tools` adds editing mode and snapping. The viewport exposes `setView/getView`,
`setDisplayMode/getDisplayMode`, `setGridVisible`, `setTransformEditor`,
`setInteractionEnabled`, `setPreviewTransforms`, and `getDisplayedTransform`.
Perspective and orthographic cameras share active-camera resize and framing.

The extension is exposed as `creator.studio` and `creator.animation`.
`creator.studio.setWorkspace('object'|'edit'|'animate')` coordinates mode changes.
`setCapabilities({features:{studio:false}})` hides this extension while retaining
existing lesson capability groups and the mountable bottom-editor API.

`projectFiles.js` validates files against a fresh model before replacing current
state, and stores standalone autosaves under `createaccess.creator.project.v1`.
File recovery tests use isolated JSDOM state, never a user's live scene.
