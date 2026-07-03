---
name: run-lesson
description: Launch, drive, and screenshot the browser 3D lessons in this repo (fundamentals5 and siblings). Use whenever asked to run/start/open the lesson, screenshot it, or verify that a visual change (gizmos, beats, layout, WebGL rendering) actually works in the real app. Backs the built-in /run and /verify skills for this project.
---

# Run / verify the 3D lessons

These lessons are static ES-module apps that load Three.js from a CDN (importmap)
and a shared `gizmo.glb`. They must be served over **HTTP** — `file://` breaks
both module loading and the GLB fetch. WebGL means a real render loop, so a
static screenshot only proves anything if the frame has actually painted.

## 1. Serve the project root

Run the bundled server (serves the repo root so `/fundamentals5/…` and the
root-level `/gizmo.glb` both resolve). Start it in the **background**:

```
node .claude/skills/run-lesson/serve.mjs
```

It prints `READY serving … at http://localhost:8123/`. If it reports the port is
in use, a server is probably already up — just reuse `http://localhost:8123/`.
The lesson lives at **`http://localhost:8123/fundamentals5/`**.

## 2. Drive it — prefer the Playwright MCP

`.mcp.json` registers a `playwright` MCP server (bundled Chromium, headed so the
real GPU renders WebGL). Use its tools to:

- `browser_navigate` to `http://localhost:8123/fundamentals5/`.
- Wait for the scene: poll `browser_evaluate` for `window.__status === 'ready'`
  if present, otherwise wait until the `#loading` overlay is hidden and a couple
  of animation frames have passed (WebGL needs a painted frame).
- `browser_console_messages` / `browser_network_requests` to catch GLB load
  failures, module errors, or Three.js warnings — things a screenshot can't show.
- `browser_take_screenshot` to capture the result.

**Reaching a specific beat:** the lesson is interaction-gated — each beat's
`Continue` (`#btn-continue`, gains class `on` when enabled) only unlocks after
the student satisfies it. To step forward, click `#btn-continue` once it has the
`on` class; repeat to advance. For isolated *gizmo* visuals (rotate rings, scale
handles) it's faster to use the harness approach in step 3 than to play through.

If the Playwright MCP tools are not loaded (fresh `.mcp.json` needs a Claude Code
restart + approval), fall back to the Edge + CDP recipe in the
`headless-screenshot-3d-lessons` memory.

## 3. Isolated gizmo / component checks (throwaway harness)

Gizmos only appear in later beats. To inspect one directly, write a temporary
`fundamentals5/_harness.html` that defines the same importmap, imports
`./js/stage.js`, `./js/character.js`, `./js/gizmos.js`, forces the handle visible
after `loadCharacter`, runs its own render loop, and sets `window.__status =
'ready'`. Screenshot via the MCP, then **delete the harness** — never leave it in
the repo. A `?a=iso|side|steep` camera-angle switch is handy for 3D handles.

## 4. Clean up

Stop the background server when done. Delete any temporary harness files.
