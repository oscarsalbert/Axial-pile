let pyodide = null;
const SOLVER_ROOT = "/home/pyodide/solver";

export async function initPyodide() {
  pyodide = await loadPyodide();

  await pyodide.loadPackage(["numpy", "matplotlib"]);

  const zipUrl = `${import.meta.env.BASE_URL}python/axial_pile_solver.zip?v=${Date.now()}`;
  const response = await fetch(zipUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch solver zip: ${response.status} ${response.statusText} at ${zipUrl}`);
  }

  const contentType = response.headers.get("content-type");
  const buffer = await response.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  console.log("Solver ZIP URL:", zipUrl);
  console.log("Solver ZIP content-type:", contentType);
  console.log("Solver ZIP size:", buffer.byteLength);

  pyodide.globals.set("solver_zip_bytes_js", uint8);
  pyodide.globals.set("solver_root_js", SOLVER_ROOT);

  const debugInfo = pyodide.runPython(`
import io
import os
import sys
import json
import zipfile
import shutil
import importlib

zip_bytes = bytes(solver_zip_bytes_js.to_py())
solver_root = str(solver_root_js)

if os.path.exists(solver_root):
    shutil.rmtree(solver_root)

os.makedirs(solver_root, exist_ok=True)

with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
    zip_entries = zf.namelist()
    zf.extractall(solver_root)

if solver_root in sys.path:
    sys.path.remove(solver_root)

sys.path.insert(0, solver_root)
importlib.invalidate_caches()

from axial_pile_solver.api import solve_from_dict

matches = []

for root, dirs, files in os.walk(solver_root):
    if root.endswith("axial_pile_solver") or "/axial_pile_solver" in root:
        matches.append({
            "root": root,
            "files": files[:20],
        })

json.dumps({
    "cwd": os.getcwd(),
    "solver_root": solver_root,
    "zip_entries": zip_entries[:30],
    "sys_path": sys.path,
    "matches": matches,
    "import_check": "ok",
}, indent=2)
`);

  console.log("PYODIDE DEBUG", debugInfo);
  console.log("Pyodide ready");
}

export async function runSolver(inputData) {
  if (!pyodide) {
    throw new Error("Pyodide not initialized");
  }

  pyodide.globals.set("input_data_js", inputData);

  return pyodide.runPython(`
import sys
import json
import importlib

solver_root = "${SOLVER_ROOT}"

if solver_root in sys.path:
    sys.path.remove(solver_root)

sys.path.insert(0, solver_root)
importlib.invalidate_caches()

from axial_pile_solver.api import solve_from_dict

data = input_data_js.to_py()
result = solve_from_dict(data)
json.dumps(result, indent=2)
`);
}
