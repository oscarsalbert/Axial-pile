# Oscar GeoTools: Axial Pile Tool

Small browser-based geotechnical tool for axial pile response using t-z shaft curves and P-Q / q-z base curves. The app runs the Python solver in the browser through Pyodide.

Developed by Oscar GeoTools.

## How To Use

1. Start the local app:

   ```bash
   npm install
   npm run dev
   ```

2. Open the Vite URL. With the current Vite base, local development is normally:

   ```text
   http://localhost:5173/Axial-pile/
   ```

3. Fill the input panel:

   - Project name
   - Pile geometry and stiffness
   - Groundwater and unit weights
   - Head load
   - Analysis controls
   - Soil/rock layers
   - t-z model and parameters for each layer
   - compatible P-Q / q-z model at the pile tip
   - selected depths for additional t-z curve plots

4. Click **Run solver**.

5. Review the summary, result tables, SVG plots, and optional report.

6. Use **Generate report** after a successful run to create a printable HTML report. The report can include inputs, summary, tables, and vector graphs.

## Units

The solver uses the following unit system:

| Quantity | Unit |
|---|---:|
| Length, depth, displacement | m |
| Diameter | m |
| Young's modulus | kPa |
| Unit weight | kN/m3 |
| Stress / resistance per unit area | kPa |
| Axial force / base resistance | kN |

Plots usually show displacement in mm for readability.

## Inputs

### Pile

| Input | Meaning | Unit |
|---|---|---:|
| `L` | pile length / tip depth | m |
| `D` | pile diameter | m |
| `E` | pile Young's modulus | kPa |
| `type` | `BORED` or `DRIVEN` | - |
| `base` | currently passed as `CLOSED` | - |

### Water

| Input | Meaning | Unit |
|---|---|---:|
| `gwl_z` | groundwater level depth | m |
| `gamma_w` | water unit weight | kN/m3 |

### Load

| Input | Meaning | Unit |
|---|---|---:|
| `P_head` | compressive load at pile head | kN |

### Analysis

| Input | Meaning |
|---|---|
| `n_elem` | number of axial finite elements |
| `tol_disp` | convergence tolerance for displacement increment |
| `max_iter` | maximum Newton iterations |
| `tol_residual` | optional residual tolerance, default `1e-6` |
| `regularization` | optional diagonal stiffness regularization, default `1e-9` |
| `initial_w` | optional initial displacement, default `1e-9` m |
| `capacity_warning_only` | optional flag; if true, capacity exceedance warns but does not abort |

### Layers

Layers must be continuous, without gaps or overlaps, and the last layer must reach at least the pile tip.

Each layer requires:

| Input | Meaning | Unit |
|---|---|---:|
| `name` | layer name | - |
| `z_top` | top depth | m |
| `z_bot` | bottom depth | m |
| `gamma_unsat` | unsaturated unit weight | kN/m3 |
| `gamma_sat` | saturated unit weight | kN/m3 |
| `tz_model` | t-z model name | - |
| `tz_params` | model parameters | mixed |

Parameters such as `su`, `phi_deg`, `UCS`, `Em`, and some optional overrides can be constant profiles or linear profiles through a layer.

## t-z Models

The solver computes mobilised unit shaft resistance `t` as a function of local pile-soil displacement `w`.

### `API_CLAY`

Required:

| Parameter | Unit | Notes |
|---|---:|---|
| `su` | kPa | undrained shear strength |

Optional:

| Parameter | Default | Notes |
|---|---:|---|
| `alpha_override` | computed | if provided, replaces API alpha |
| `residual_factor` | `0.9` | residual multiplier for post-peak API clay points |

Calculation:

- Effective vertical stress is limited with a minimum value.
- `psi = su / sigma_v_eff`.
- If `psi <= 1`, `alpha = 0.5 * psi^-0.5`.
- If `psi > 1`, `alpha = 0.5 * psi^-0.25`.
- `alpha` is capped at `1.0`.
- `tult = alpha * su`.
- The t-z curve uses the API clay multiplier table against `w / z_peak`.
- `z_peak = 0.02 * D`.

If `alpha_override` is defined, it is used directly. If `residual_factor` is not defined, residual API clay points use `0.9`.

### `API_SAND`

Required:

| Parameter | Unit | Notes |
|---|---:|---|
| `phi_deg` | degrees | friction angle |
| `delta_phi_ratio` | - | pile-soil interface angle ratio |

Optional:

| Parameter | Default | Notes |
|---|---:|---|
| `K_override` | `1.0` for driven, `0.7` for bored | lateral earth pressure factor |

Calculation:

- `tan_delta = tan(phi_deg * delta_phi_ratio)`.
- `K = K_override` if provided. Otherwise the provisional default is used.
- `tult = K * tan_delta * sigma_v_eff`.
- The curve is linear to `tult` at `w_peak = 0.00254 m`, then perfectly plastic.

If `K_override` is not provided, the result includes a warning that a provisional default was used.

### `REESE_ONEILL_CLAY`

Required:

| Parameter | Unit | Notes |
|---|---:|---|
| `su` | kPa | undrained shear strength |

Optional:

| Parameter | Default | Notes |
|---|---:|---|
| `alpha_override` | computed | if provided, replaces computed alpha |

Calculation:

- Uses the same alpha calculation as `API_CLAY`, unless `alpha_override` is provided.
- `tult = alpha * su`.
- The curve uses the Reese and O'Neill clay multiplier table against `w / D`.

### `REESE_ONEILL_SAND`

Required:

| Parameter | Unit | Notes |
|---|---:|---|
| `phi_deg` | degrees | friction angle |
| `delta_phi_ratio` | - | pile-soil interface angle ratio |
| `K` | - | lateral earth pressure factor |

Calculation:

- `tan_delta = tan(phi_deg * delta_phi_ratio)`.
- `tult = K * tan_delta * sigma_v_eff`.
- The curve uses the Reese and O'Neill sand multiplier table against `w / D`.

### `ONEILL_HASSAN_ROCK`

Required:

| Parameter | Unit | Notes |
|---|---:|---|
| `UCS` | kPa | unconfined compressive strength |

Optional:

| Parameter | Default | Notes |
|---|---:|---|
| `Em` | `em_factor * UCS` | rock mass modulus |
| `em_factor` | `200` | used if `Em` is not defined |
| `rock_shaft_factor` | `0.10` | used if `tult_override` is not defined |
| `tult_override` | `rock_shaft_factor * UCS` | direct ultimate shaft resistance |

Calculation:

- If `Em` is not provided, `Em = em_factor * UCS`.
- If `tult_override` is not provided, `tult = rock_shaft_factor * UCS`.
- A hyperbolic relation is used:

  ```text
  a = 2.5 * D / Em
  b = 1 / tult
  t = w / (a + b*w)
  ```

Missing optional `Em` or `tult_override` generates provisional-default warnings.

## P-Q / q-z Models

The P-Q model is selected from the models compatible with the layer at pile tip depth. The UI uses the same tip-layer convention as the solver: intermediate layers are `[z_top, z_bot)`, and the last layer is `[z_top, z_bot]`.

### Clay P-Q Models

Compatible when the tip layer contains `su`:

- `API_QZ_CLAY`
- `REESE_ONEILL_QZ_CLAY`

Optional:

| Parameter | Default | Notes |
|---|---:|---|
| `Nc_override` | `9.0` | bearing factor |

Calculation:

```text
Qult = Nc * su_tip * area_base
```

`API_QZ_CLAY` uses the API q-z multiplier table against `w / D`.

`REESE_ONEILL_QZ_CLAY` uses the Reese and O'Neill clay q-z multiplier table against `w / D`.

### Sand P-Q Models

Compatible when the tip layer contains `phi_deg`:

- `API_QZ_SAND`
- `REESE_ONEILL_QZ_SAND`

Optional:

| Parameter | Default | Notes |
|---|---:|---|
| `Nq_override` | automatic from `phi_deg` | bearing factor |

Calculation:

```text
Nq = exp(pi * tan(phi)) * tan(pi/4 + phi/2)^2
Qult = sigma_v_eff_tip * Nq * area_base
```

If `Nq_override` is not provided, `Nq` is calculated automatically and a warning is reported.

### Rock P-Q Model

Compatible when the tip layer contains `UCS`:

- `ROCK_QZ_SIMPLE`

Optional:

| Parameter | Default | Notes |
|---|---:|---|
| `Em` | `em_factor * UCS` from tip layer | if available in tip-layer parameters |
| `em_factor` | `200` | used if `Em` is not defined |
| `rock_base_factor` | `5.0` | used if `Qult_override` is not defined |
| `Qult_override` | `rock_base_factor * UCS * area_base` | direct ultimate base resistance |

Calculation:

```text
a = Qult / (area_base * Em / D)
b = 1 / Qult
Qb = w / (a + b*w)
```

Missing optional `Em` or `Qult_override` generates provisional-default warnings.

## Calculation Process

1. Inputs are validated:
   - required keys must exist
   - units must be `kN-m-kPa`
   - pile length, diameter, and stiffness must be positive
   - layers must be continuous
   - the last layer must reach the tip
   - selected q-z model must be compatible with the tip-layer parameters

2. A capacity check estimates:
   - peak shaft capacity `Qs_peak`
   - peak base capacity `Qb_peak`
   - total peak capacity `Q_total_peak`

3. A 1D finite element mesh is generated along the pile.

4. The pile axial stiffness matrix is assembled using `EA / Le`.

5. Newton iterations solve for nodal settlements:
   - element midpoint settlement gives t-z shaft resistance
   - tip settlement gives P-Q base resistance
   - residual and tangent stiffness are updated iteratively
   - compressive settlement is constrained to non-negative values

6. After convergence, the solver reports:
   - nodal depth, settlement, and axial force
   - element shaft resistance and utilisation
   - tip/base response
   - summary totals
   - optional requested t-z and P-Q curves

## Outputs

### Summary

Includes:

- head load
- head settlement
- tip settlement
- total shaft resistance
- base resistance
- total resistance
- shaft/base percentage
- convergence status
- iteration count

### Tables

Includes:

- node results
- element shaft results
- tip result
- selected t-z curve tables
- P-Q curve table

### Graphs

All graphs are SVG vector graphics:

- displacement vs depth
- axial force vs depth
- mobilised unit shaft resistance vs depth
- ultimate unit shaft resistance vs depth
- mobilised/ultimate shaft ratio vs depth
- selected t-z curves
- P-Q curve at pile tip

### Report

The report is generated as printable HTML. It can include:

- inputs
- summary
- tables
- graphs

The browser print dialog can save it as PDF.

## Maintaining The Solver Zip

The Python package must be stored inside:

```text
public/python/axial_pile_solver.zip
```

The root of the zip must contain:

```text
axial_pile_solver/
  __init__.py
  api.py
  ...
```

Avoid zipping an extra parent folder. If the package is nested as `axial_pile_solver/axial_pile_solver/...`, Pyodide will fail to import it.
