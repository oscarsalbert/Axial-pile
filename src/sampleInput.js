export const sampleInput = {
  units: "kN-m-kPa",
  project_name: "Sample project",
  analysis_name: "Sample analysis",
  analysis: { n_elem: 50, tol_disp: 1e-5, max_iter: 50 },
  pile: {
    L: 10,
    D: 1,
    E: 30000000,
    type: "BORED",
    base: "CLOSED"
  },
  water: { gwl_z: 0, gamma_w: 9.81 },
  load: { P_head: 1000 },
  qz_model: {
    name: "API_QZ_CLAY",
    params: {}
  },
  curve_requests: {
    tz_depths: [2, 5, 8],
    include_qz: true,
    n_points: 60,
    w_max_m: 0.1,
    qz_w_max_m: 0.2
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
