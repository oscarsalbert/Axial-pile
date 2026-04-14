import './style.css'
import { initPyodide, runSolver } from './pyodide.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <h1>Axial Pile Tool</h1>
  <button id="run">Run Solver</button>
  <pre id="output"></pre>
`

await initPyodide()

document.getElementById('run').onclick = async () => {
  const input = {
  units: "kN-m-kPa",
  analysis: { n_elem: 10, tol_disp: 1e-5, max_iter: 50 },
  pile: {
  L: 10,
  D: 1,
  E: 30000000,
  type: "BORED",
  base: "CLOSED"
},
  water: { gwl_z: 0, gamma_w: 10 },
layers: [
  {
    name: "Layer 1",
    z_top: 0,
    z_bot: 10,
    gamma_unsat: 18,
    gamma_sat: 20,
    tz_model: "API_CLAY",
    tz_params: {
      su: { type: "const", value: 50 }
    }
  }
],
qz_model: {
  name: "API_QZ_CLAY",
  params: { su: 50 }
},
  load: {
  P_head: 1000
}
}

  try {
    const result = await runSolver(input)
    document.getElementById('output').textContent = result
  } catch (err) {
    document.getElementById('output').textContent =
      "ERROR: " + err.message
    console.error(err)
  }
}