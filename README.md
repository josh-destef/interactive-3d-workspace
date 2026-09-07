# Gizmobot 3D Learning Labs

Interactive, browser-based 3D lessons for beginners. The current curriculum
uses Gizmobot as a familiar subject while learners explore navigation,
transforms, modeling, materials, hierarchy, animation, particles, topology,
and assembly. It is a static site: no build step is required for normal use.

Open the repository root with any static server, then visit `/` (which forwards
to `/polished/`). For example: `npx serve .` or `python -m http.server`.
The site is designed for GitHub Pages; paths are relative and `.nojekyll` keeps
the static files available as published.

## Layout

```text
assets/                 canonical brand, models, and landing-page previews
  models/gizmobot.glb   canonical full Gizmobot
polished/               current Gizmobot curriculum and its public hub
  labs/                 one folder per active lesson
  kit/                  shared lesson shell and runnable starter template
deprecated/             preserved pre-Gizmobot experiments and archive page
docs/                   architecture, research, and asset conventions
scripts/                builders and lightweight QA checks
```

Current lessons live in `polished/labs/`; legacy work lives in
`deprecated/` and is linked as **Legacy labs** from the course hub. Legacy
experiments are available for reference but are not part of the learner path.

## Add a lesson

Copy `polished/kit/template/` into `polished/labs/<lesson-name>/`, then update
its configuration, subject code, and README. The kit README explains its shared
CSS, controls, staged lesson flow, demos, gates, and quiz. Prefer the shared
kit over copying its infrastructure. Put a reusable model, logo, or preview in
`assets/`; keep a local asset only when it is a documented lesson-specific
variant. See [asset conventions](docs/ASSET_CONVENTIONS.md).

Each active lab has a local README describing what it teaches, its important
files, and any non-obvious implementation constraints. Run `node
scripts/qa-links.mjs` after moving web files; lesson-specific scripts in
`scripts/` provide additional checks where available.
