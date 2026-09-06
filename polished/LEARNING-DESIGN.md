# CreateAccess guided-lab learning design

This document is the curriculum contract for Material, Hierarchy, Keyframes and
Particles. It exists so the interaction design can be reviewed as teaching, not
only as interface polish.

## Shared lesson architecture

Every lab follows the same six-part journey:

1. **Orient** — name the system and show the whole object or effect.
2. **Build a mental model** — introduce one variable or relationship at a time.
3. **Watch a worked example** — the demo uses the exact control the learner will use.
4. **Produce a visible contrast** — the learner changes enough to compare two states.
5. **Author a result** — a bounded challenge combines the earlier decisions.
6. **Retrieve, then remix** — explanatory questions precede ungated free play.

The centred Read card gives the learner control over when motion begins. It
introduces one idea in one or two short sentences. The worked example reduces
search while a control is new, then the main panel gives one concrete action
and one thing to notice. The exit check requires retrieval and responds to
every choice with a reason.

The curriculum map below guides lesson design; it is not interface chrome. A
beginner should meet its technical terms only when the interaction makes them
useful. Definitions and edge cases belong in feedback or later steps, not in a
second instruction block beside the primary task.

This design is informed by Mayer and Chandler's experiments on learner-paced
multimedia segments, Sweller and Cooper's worked-example studies, and Roediger
and Karpicke's work on retrieval practice:

- [Mayer & Chandler, 2001](https://doi.org/10.1037/0022-0663.93.2.390)
- [Sweller & Cooper, 1985](https://doi.org/10.1207/s1532690xci0201_3)
- [Roediger & Karpicke, 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x)

## Curriculum map

| Lab | Concept pipeline | Transfer outcome | Main misconception addressed | Evidence of learning |
| --- | --- | --- | --- | --- |
| Material | Surface → Reflection → Lighting → Apply | Diagnose a material from base colour, roughness, metalness and context | Emissive-looking surfaces automatically light the scene; metalness is a generic shininess control | Match a reference under shared light, then explain roughness, metal response and emissive |
| Hierarchy | Nodes → Inheritance → Transforms → Reparent | Predict which objects move after selecting a node | Motion travels both up and down a hierarchy; local and world are competing poses | Pick up a block by reparenting, then explain inheritance and coordinate space |
| Keyframes | Pose + time → Interpolate → Channels → Author | Build and diagnose a small multi-channel animation | A keyframe contains the in-between motion; easing changes the keys themselves | Author grounded start, airborne apex and landing, play the final edit, then explain the curve model |
| Particles | Emit → Initialise → Simulate → Render | Tune an effect while reasoning about count, path and appearance separately | Speed or gravity changes the live count; particles follow hidden keyframed paths | Hold a readable cone fountain inside budget, then explain steady-state count, simulation and blending |

## Technical boundaries taught explicitly

- The Material lab follows the metallic-roughness model. Roughness ranges from
  smooth to rough, while metalness normally represents non-metal or metal rather
  than a continuous “more shiny” control. See the [glTF 2.0 material
  specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials)
  and [Three.js MeshStandardMaterial](https://threejs.org/docs/#api/en/materials/MeshStandardMaterial).
- Both metals and non-metals reflect light. Metalness changes how diffuse and
  reflected colour are combined; roughness changes reflection clarity.
- In Three.js, emissive is a material colour unaffected by other lighting. It
  does not by itself create scene illumination; the lab says this directly.
- A Three.js object stores a local matrix and derives `matrixWorld` through its
  transform hierarchy. `attach()` reparents while preserving world transform,
  matching the Hierarchy lab's pickup model. See
  [Three.js Object3D](https://threejs.org/docs/#api/en/core/Object3D).
- Animation curves plot time on one axis and a property value on the other;
  interpolation defines the values between keys. See the
  [Blender keyframe manual](https://docs.blender.org/manual/en/latest/animation/keyframes/introduction.html).
- Colour over lifetime maps a gradient, including alpha, across a particle's
  normalised age. See the
  [Unity Particle System manual](https://docs.unity3d.com/Manual/PartSysColorOverLifeModule.html).

## Review rules

- A demo must never satisfy its own practice gate.
- A gate should detect the intended comparison or authored structure, not one
  magic slider value.
- A step has one short concept card and one clear action; it must not repeat the
  instruction in a second callout.
- Prefer concrete questions and visible effects before naming technical models.
- Text must distinguish the simplified lab model from a universal engine rule.
- The challenge may have many valid parameter values, but its observable goal
  must be unambiguous.
- Free play preserves the learner's work whenever that work is useful to remix.
- Every new interactive state must remain keyboard reachable and expose state
  through native controls or ARIA.
