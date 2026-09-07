# Gizmobot's Back Module

A thirteen-step beginner modelling lesson built on the shared lab kit. Serve the
repository root and open `/polished/labs/model-an-accessory/`. No build step.

The student starts with one cube and shapes it into a back module for
Gizmobot: size it against him, enter Edit Mode and pick a face, inset that
face, pull it out into a panel, round the edges, add a pocket, build an aerial
from a cylinder and a sphere, group it, add a connector, colour it, and clip it
onto the port on Gizmobot's back so he carries it.

This replaces the earlier slider version of this lab at the same path.

## The one rule

**There is not a single range input in this lab.** Every value is set by
dragging in the viewport, on the same gizmos Navigate + Transform taught, with
a modal-operator layer on top:

| Interaction | What it does |
| --- | --- |
| Drag a handle | Move arrows, uniform scale ring, axis scale boxes, rotate rings |
| <kbd>G</kbd> <kbd>R</kbd> <kbd>S</kbd> <kbd>I</kbd> <kbd>E</kbd> | Grab, rotate, scale, inset, extrude - the object follows the pointer |
| <kbd>X</kbd> <kbd>Y</kbd> <kbd>Z</kbd> | Constrain the running operator to one axis |
| Type digits | Set an exact value mid-operator: `G` `Z` `0.5` `Enter` |
| <kbd>Ctrl</kbd> held | Snap to 0.05 increments |
| <kbd>Esc</kbd> / right-click | Cancel, restoring the start pose exactly |
| wheel during bevel | Segment count, 1-4. It has no panel anywhere. |
| <kbd>Tab</kbd> | Object Mode / Edit Mode |
| <kbd>Shift</kbd><kbd>D</kbd>, <kbd>Ctrl</kbd><kbd>G</kbd>, <kbd>Ctrl</kbd><kbd>Z</kbd> | Duplicate, group, undo |

Every key also has a button, on the rail or in the dock. Nothing is reachable
by key alone and nothing by mouse alone. The dock holds buttons and colour
swatches only.

The only numeric feedback is `#modal-readout`, a chip in the top-left of the
viewport that appears while something is being dragged and reports in the units
being dragged. The object list's transform block reports; it is not how you
transform.

## Scope and reuse

- `js/config.js` - beats, copy, camera presets, limits, measured Gizmobot.
- `js/model.js` - the box/inset/extrude geometry, groups, the connector, snapshots.
- `js/gizmos.js`, `js/interaction.js` - ported from Navigate + Transform and
  retargeted from that lab's single character to whatever is selected.
- `js/modal.js` - the G/R/S/I/E operators, axis lock, type-to-set, snapping.
- `js/port.js` - the socket on his back and the matching connector.
- `js/outliner.js`, `js/history.js` - new, self-contained.
- Swatches come from Material Lab; the GLB export path is the previous version
  of this lab's, unchanged apart from the root name.
- Gizmobot loads from the canonical `assets/models/gizmobot.glb`.

## Measured, not eyeballed

The Gizmobot figures in `config.js` come from
`robot-assembly/assets/assembly-report.json`, whose source mesh has the same
sha256 as the GLB this lab loads. Two things about that data are easy to get
wrong and are handled explicitly:

- **The report is in object space.** Its overall AABB tops out at 2.804, not
  3.317, because the GLB's single node carries translation `(0, 0, -0.156)` and
  scale `(0.979, 1.183, 1.183)`. Every figure in `config.js` already has that
  applied. Reading the report straight in drops every measurement about 0.31,
  and the port ends up inside his back rather than on it.
- **Use the report's bounds, not the manifest's positions.**
  `assembly-manifest.json` lists an `assembledPosition` per part; those are
  hand-authored rest-pose pivots that disagree with the real geometry by up to
  0.34 on X. They are right for the assembly lab's snapping and wrong for
  measuring where his back plate actually is.

The asset is authored facing -Z. `gizmobot.js` turns it once on load through a
single `BASE_Y` constant that `turn()` and `resetTurn()` also go through, so
nothing can quietly reset him to the direction the file shipped in.

## Deliberate simplifications

These are the boundaries of the lab's model, stated rather than hidden:

- **An object is a box plus, per face, how far it has been inset and how far
  pushed out**, rebuilt into one merged geometry. There is no general mesh
  editor, so there is never a broken mesh to get stuck in.
- **Inset and extrude are separate, and that is the point.** Inset alone
  changes no silhouette - it makes a smaller face inside the face, which is
  topology, not shape, so the shrinking highlight is its only feedback. Push
  alone, with no inset, moves the whole face and is arithmetically identical
  to scaling on that axis. Steps 4 and 5 exist to take that pair apart, since
  "I extruded and it just got bigger" is where beginners stall.
- **Extrude only goes outward.** A negative extrusion would sit inside the
  parent box and be invisible without CSG, so it is clamped at zero.
- **Bevel is uniform across an object**, not per selected edge. The caption says
  it rounds every edge where two faces meet; it never claims the student picked
  them.
- **Edit Mode is for boxes.** Cylinders and spheres have no pickable faces.
- **The connector is a magnet, not a mechanism.** Gizmobot carries a round
  port on his back; the module carries the matching half. Bring the two within
  0.42 units and both rings light; let go and the module root is translated so
  the two coincide exactly. It does not simulate, collide or align rotation -
  a snap that also spun the student's module would undo work they meant to
  keep. The snap is the attach: it calls `attach()` itself rather than asking
  for a button press after the magnet has visibly grabbed it.

## Review checks

Walked in a browser: all sixteen beats stage without error; the rail grows one
tool at a time across the steps; Cylinder and Sphere stay hidden until step 8;
the demo restores the student's work and never satisfies its own gate.
Confirmed the inset model teaches what it claims: insetting a face leaves the
bounding box identical while shrinking the highlight from 1.00 to 0.56 span,
and extruding a face with no inset leaves the width unchanged and only makes
the box deeper - a stretch, exactly as step 5 says. Verified that a modal operator confirms (`G` `X` `0.5` `Enter` moves
exactly 0.5) and that `Esc` restores the start pose to the same numbers.
Verified that extrusions and bevel survive an undo/redo snapshot round trip,
that grouping nests children, and that `attach()` leaves the module's world
position unchanged while making it follow Gizmobot when he turns.

External dependencies match the other static labs: Three.js from jsDelivr and
fonts from Google Fonts. A failed Gizmobot load leaves a visible reload message.
