let pyodide = null;

export async function initPyodide() {
  pyodide = await loadPyodide();

  await pyodide.loadPackage(["numpy", "matplotlib"]);

  const response = await fetch("/Axial-pile/python/axial_pile_solver.zip");
  const buffer = await response.arrayBuffer();

  pyodide.unpackArchive(buffer, "zip");

  console.log("Pyodide ready");
}

export async function runSolver(inputData) {
  if (!pyodide) {
    throw new Error("Pyodide not initialized");
  }

  pyodide.globals.set("input_data_js", inputData);

return pyodide.runPython(`
import json
from axial_pile_solver.api import solve_from_dict

data = input_data_js.to_py()
result = solve_from_dict(data)
json.dumps(result, indent=2)
`);
}