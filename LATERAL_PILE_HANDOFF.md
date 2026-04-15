# Oscar GeoTools lateral pile handoff

This document is intended as context for a new Codex chat before adding a
second tool, `lateral pile`, to the existing web app.

## Current App

The project is a Vite static web app for geotechnical tools under the
**Oscar GeoTools** name. It currently has one working tool:
**Axial Pile Tool**.

The app runs fully in the browser:

- JavaScript frontend.
- Pyodide for Python execution.
- A Python solver zip served from `public/python/axial_pile_solver.zip`.
- SVG charts generated client-side.
- Printable HTML report.
- Saved cases in browser `localStorage`.

The app is currently hosted locally at:

```text
http://localhost:5173/Axial-pile/
```

The Vite base path is:

```js
base: '/Axial-pile/'
```

## Important Existing Files

```text
src/main.js
```

Application entry point. It initializes the layout, Pyodide, inputs, reports,
saved cases, and solver execution.

```text
src/ui.js
```

Main UI renderer for the axial pile tool:

- App layout and sidebar.
- Input form.
- Collapsible input sections.
- Layer editor.
- q-z compatibility logic.
- Saved cases sidebar rendering.
- Form reading.

```text
src/pyodide.js
```

Loads Pyodide, fetches `public/python/axial_pile_solver.zip`, extracts it into
Pyodide FS, adds it to `sys.path`, and imports:

```python
from axial_pile_solver import solve_from_dict
```

It includes cache busting and import-cache invalidation because the solver zip
is edited during development.

```text
src/render.js
```

Renders solver outputs:

- Summary cards.
- Tables.
- SVG plots.
- Chart tooltips.

```text
src/svgCharts.js
```

Custom SVG chart renderer. Charts are vector, not canvas/raster.

It provides:

- `lineChartSvg`
- `depthChartSvg`
- `graphDefinitions`
- helpers for t-z and q-z datasets

```text
src/report.js
```

Generates a printable HTML report. The report can include:

- Inputs.
- Summary.
- Tables.
- Graphs.

It includes project name, analysis name, date, units, and discreet authorship:

```text
Generated with Oscar GeoTools
```

The PDF-specific jsPDF implementation was removed. The current report flow is:

```text
Open report -> browser Print / Save as PDF
```

```text
src/savedCases.js
```

Local browser persistence using `localStorage`.

Current storage key:

```js
axial-pile:saved-cases:v1
```

Saved cases include:

- `project_name`
- `analysis_name`
- `saved_at`
- `input`
- optional `result`
- summary data

This will need to evolve when lateral pile is added.

```text
src/docs.js
```

Loads `README.md` as raw text and renders it in a modal.

```text
README.md
```

Explains the axial pile tool usage, models, inputs, optional parameters,
calculation process, and outputs.

```text
public/python/axial_pile_solver.zip
```

Python solver zip. Important: the zip root must contain:

```text
axial_pile_solver/
```

not an extra wrapper folder.

## Current Axial Tool Features

The axial pile tool supports:

- Project name.
- Analysis name.
- Pile geometry and stiffness.
- Water inputs.
- Load input.
- Analysis settings.
- Soil layers.
- t-z model by layer.
- q-z / P-Q model at the pile tip.
- t-z curves at selected depths.
- P-Q curve at pile tip.
- Saved cases in sidebar.
- Printable HTML report.

Graphs are SVG and include:

- Displacement vs depth.
- Axial force vs depth.
- Mobilised unit shaft resistance vs depth.
- Ultimate unit shaft resistance vs depth.
- Mobilised / ultimate shaft resistance vs depth.
- t-z curves at selected depths.
- P-Q curve at pile tip.

## Current Known Decisions

### Solver Packaging

For development, the solver zip can be manually rebuilt. The Pyodide loader uses
cache busting to avoid stale solver imports:

```js
fetch(urlWithCacheBusting, { cache: 'no-store' })
```

### q-z Model Compatibility

The q-z model is selected based on the layer at the pile tip, not the first
layer. The UI uses the same layer interval convention as the solver:

- Intermediate layers: `[z_top, z_bot)`
- Last layer: `[z_top, z_bot]`

### Displacement Ranges

- t-z curves use displacement range up to `10%` of pile diameter.
- P-Q curve uses displacement range up to `20%` of pile diameter.

### Saved Cases

Saving a case:

- If current inputs match the last solver run, save inputs + result.
- If inputs changed after the last solver run, save inputs only.

Loading a saved case:

- If it has result data, restore inputs + outputs.
- If it has inputs only, restore inputs and clear outputs.

## Recommended Direction For Lateral Pile

Keep this as the same repo and same web app. Do **not** create a separate
project unless the lateral tool becomes a completely independent product.

The app should become a small suite:

```text
Oscar GeoTools
  Axial pile
  Lateral pile
```

Recommended future structure:

```text
src/
  shared/
    charts/
    report/
    savedCases/
    pyodide/
    formatting/
  tools/
    axial/
      axialUi.js
      axialRender.js
      axialReport.js
      axialSchema.js
      axialSolverBridge.js
    lateral/
      lateralUi.js
      lateralRender.js
      lateralReport.js
      lateralSchema.js
      lateralSolverBridge.js
```

This refactor does not need to happen all at once. A practical path is:

1. Add lateral pile with some duplication where needed.
2. Extract shared pieces after both tools expose similar needs.

Avoid a large abstract refactor before lateral pile exists.

## Recommended Lateral Solver

Use a separate Python solver zip:

```text
public/python/lateral_pile_solver.zip
```

Inside the zip:

```text
lateral_pile_solver/
  __init__.py
  solver.py
  schema.py
  curves.py
  models/
    __init__.py
    api_sand.py
    api_clay.py
    matlock_clay.py
    reese_sand.py
```

The JS bridge should import something like:

```python
from lateral_pile_solver import solve_from_dict
```

Prefer a separate solver rather than mixing p-y code into
`axial_pile_solver`. The mechanics, inputs, outputs, and model assumptions are
different enough to justify separation.

## Recommended Lateral Inputs

Likely lateral pile input groups:

- Project
  - `project_name`
  - `analysis_name`
- Pile
  - length `L`
  - diameter `D`
  - Young's modulus `E`
  - second moment of area `I` or derived circular section
  - pile head elevation/reference
- Boundary conditions
  - free head / fixed head
  - applied lateral load
  - applied moment
  - head displacement or rotation if displacement-controlled cases are needed
- Water
  - groundwater level
  - water unit weight
- Analysis
  - number of elements
  - tolerance
  - maximum iterations
  - load stepping if nonlinear
- Soil layers
  - name
  - `z_top`
  - `z_bot`
  - unit weights
  - p-y model
  - p-y parameters
- p-y curves at selected depths
  - selected depths table, similar to current t-z selected depths

## Recommended Lateral Outputs

Typical output graphs:

- Lateral displacement vs depth.
- Rotation vs depth.
- Bending moment vs depth.
- Shear force vs depth.
- Soil reaction `p` vs depth.
- p-y curves at selected depths.
- Mobilisation ratio vs depth, if available.

Typical output tables:

- Nodes:
  - depth
  - lateral displacement
  - rotation
  - shear
  - moment
- Elements:
  - mid-depth
  - soil reaction
  - p-y model
  - layer name
  - ultimate resistance if available
- p-y curve tables at selected depths.

## Saved Cases Evolution

Before or during lateral pile implementation, saved cases should include a
tool identifier:

```json
{
  "tool": "axial-pile",
  "project_name": "Project A",
  "analysis_name": "Pile A1 ULS",
  "saved_at": "...",
  "input": {},
  "result": {}
}
```

For lateral:

```json
{
  "tool": "lateral-pile",
  "project_name": "Project A",
  "analysis_name": "Pile A1 lateral SLS",
  "saved_at": "...",
  "input": {},
  "result": {}
}
```

The sidebar can either:

- show saved cases only for the active tool, or
- group by tool and project.

For usability, filtering by active tool is probably better.

The storage key should eventually become generic:

```js
geotools:saved-cases:v1
```

Migration from the current axial-only key can be handled later.

## Recommended Navigation

The sidebar already has disabled buttons:

- Axial pile
- Lateral pile
- CPT tool
- Settlement

Make `Lateral pile` active/clickable and introduce an app state like:

```js
let activeTool = 'axial-pile';
```

Each tool should define:

```js
{
  id: 'axial-pile',
  label: 'Axial pile',
  defaultInput,
  renderInputForm,
  readInputForm,
  renderResult,
  renderReportControls,
  runSolver,
}
```

This can be introduced gradually.

## Advice For The Next Codex Chat

Start the new chat with:

```text
I have a Vite/Pyodide app called Oscar GeoTools. The axial pile tool is already
working. I want to add a second tool, lateral pile, in the same web app.
Read LATERAL_PILE_HANDOFF.md first, then inspect the repo. Before implementing,
propose the smallest architecture change needed to support both tools without
over-refactoring.
```

Recommended first task in the new chat:

1. Inspect current repo.
2. Identify the minimal app-state/navigation changes needed for multiple tools.
3. Propose a lateral pile solver package interface.
4. Only then start implementation.

## Publication Note

The solver is currently public because the app is static and browser-based. If
`public/python/axial_pile_solver.zip` is deployed to GitHub Pages, anyone can
download it.

For now, this is accepted.

Discreet authorship currently appears in:

- Sidebar: `Developed by Oscar GeoTools`.
- Report footer: `Generated with Oscar GeoTools`.

Future stronger protection would require a backend/API or encrypted solver
distribution, but those are out of scope for now.
