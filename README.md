# Fundamentals of 3D — Dev Setup

No build step. Static HTML/JS/CSS only.

## Run the dev server

From the project root (`fundamentals_of_3d/`):

```bash
npx serve .
```

Then open the URL it prints (usually `http://localhost:3000`).

### Alternatives

```bash
# Python (if you have Python 3)
python -m http.server 8080
# → open http://localhost:8080

# Node http-server (if preferred over serve)
npx http-server . -p 3000
# → open http://localhost:3000
```

## Open a specific lesson

Navigate to the lesson file in your browser after the server is running:

| Lesson | URL |
|--------|-----|
| Fundamentals 1 | `http://localhost:3000/fundamentals1.html` |
| Fundamentals 2 | `http://localhost:3000/fundamentals2.html` |
| Fundamentals 3 | `http://localhost:3000/fundamentals3.html` |
| Fundamentals 4 | `http://localhost:3000/fundamentals4.html` |
| Fundamentals 5 | `http://localhost:3000/fundamentals5/` |

## Project structure

```
fundamentals_of_3d/
├── index.html                 # course landing page
├── fundamentals1.html         # standalone lesson pages
├── fundamentals2.html
├── fundamentals3.html
├── fundamentals4.html
├── fundamentals5/             # lesson 5 (multi-file)
│   ├── index.html
│   ├── css/styles.css
│   └── js/                    # main.js, stage.js, anim.js, etc.
├── labs/                      # extra labs & mini-courses (+ test-labs.html)
├── shared/                    # css/js shared by the lab pages
├── assets/                    # logos and 3D models (gizmo.glb, …)
├── docs/                      # roadmap / progress notes
└── scripts/                   # QA scripts
```
