# Interactive Labs

A growing collection of free, hands-on 3D learning modules from CreateAccess.
Each lab teaches one skill through a guided, interactive walkthrough in the
browser: watch a demo, then try it yourself. No installs, no accounts.

This is the monorepo behind them: the repo root is the landing page that links
out to every lab, and each module lives in its own folder under `labs/`.

```
index.html                      landing page (markup + inline CSS)
assets/                         landing page card art
labs/
  navigate-and-transform/       Navigate + Transform lab
  material-lab/                 Material Lab (colour, RGB, roughness, metalness,
                                light, glow and matching)
  hierarchy/                    Hierarchy lab (parent, child, local, world)
  keyframes/                    Keyframe lab (poses, time, interpolation)
  particles/                    Particle lab (rate, lifetime, forces)
  robot-assembly/               WIP Gizmobot assembly (objects, position,
                                rotation and parent/child transforms)
```

The four guided labs share one learning architecture. Every step is paced
**Read -> Watch -> Do**: a short, learner-paced card introduces one idea; a
worked demonstration drives the real controls; then the main panel asks for one
clear action and one thing to notice. Controls appear only when they are useful.

Each lesson moves from a concrete visual change toward the technical model
behind it. A bounded challenge combines the ideas, a three- or four-question
exit check gives explanatory feedback, and free play opens after the check.
Repeated callouts and persistent curriculum labels are deliberately avoided so
the 3D result and the next action remain the focus.

`material-lab/` keeps its full-width console so its denser set of related
surface controls remain easy to compare. Hierarchy, Keyframes and
Particles retain the compact caption-and-dock arrangement used by Navigate +
Transform. Both layouts use the same CreateAccess colour, typography, state and
feedback language.

Each lab folder is self-contained — its own `index.html`, `css/`, `js/` and
`assets/`. The small engine modules (`utils.js`, `anim.js`, `ui.js`,
`demoCursor.js`) are duplicated per lab rather than shared, so a lab can be
opened, edited or lifted out on its own without a build step deciding what it
depends on.

## Run it

No build step. Modules use ES modules and load `.glb` assets, so open it through
a server rather than `file://`:

```bash
npx serve .
# → http://localhost:3000
```

The three model-heavy labs also have a headless runtime check for their core
teaching behaviour: the hierarchy reach pose must really pick up its target, the
keyframe camera must contain the full authored height range, and the particle
budget and solo telemetry must remain live.

```bash
node ../scripts/qa-polished-models.mjs
```

The curriculum contract has a dependency-free structural check too. It verifies
the concise Read/Watch/Do structure, exit checks, local asset paths and the
lesson-specific assessment hooks across all four labs.

```bash
node ../scripts/qa-polished-curriculum.mjs
```

## Adding a module

1. Drop the module in `labs/<module-name>/` with its own `index.html` and
   relative `css/`, `js/`, `assets/` paths. Use one of the rebuilt labs as the
   reference for the Read/Watch/Do rhythm, single-action panels and exit check.
2. Add card art to `assets/`, sized 800x520 (an SVG poster or a screenshot).
3. Copy a `.card` block in the root `index.html` and point `href` at
   `labs/<module-name>/`.

## Contributing a module or idea

These labs grow from what people want to teach and learn. There are three ways
to get involved, from most to least hands-on:

- **Build a module (Pull Request).** Follow *Adding a module* above, then open a
  PR against `main`. Include a short note on what the module teaches and a
  screenshot so it's easy to review.
- **Propose a module (Issue).** Not ready to build it? Open an Issue describing
  the concept, including the skill or idea it teaches, the interaction you imagine, and
  who it's for. A rough sketch is plenty; we'll shape it together.
- **Suggest an improvement (Issue).** Spotted something confusing, broken, or
  worth adding to an existing lab? Open an Issue and tell us what you'd change.

No idea is too small, and you don't need to know the codebase to suggest one!
