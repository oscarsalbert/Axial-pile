export const sampleInput = {
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
  load: { P_head: 1000 },
  qz_model: {
    name: "API_QZ_CLAY",
    params: { su: 50 }
  },
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
  ]
}