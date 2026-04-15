import {
  escapeHtml,
  formatNumber,
  graphDefinitions,
} from './svgCharts.js';

const REPORT_AUTHOR = 'Oscar GeoTools';

function objectOfArraysToRows(obj) {
  if (!obj || typeof obj !== 'object') return [];

  const keys = Object.keys(obj);
  if (keys.length === 0) return [];

  const maxLen = Math.max(
    ...keys.map((key) => (Array.isArray(obj[key]) ? obj[key].length : 0))
  );

  const rows = [];

  for (let i = 0; i < maxLen; i += 1) {
    const row = {};
    for (const key of keys) {
      row[key] = Array.isArray(obj[key]) ? obj[key][i] : obj[key];
    }
    rows.push(row);
  }

  return rows;
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '-';
    if (Math.abs(value) > 0 && Math.abs(value) < 1e-3) return value.toExponential(3);
    return formatNumber(value, 4);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return escapeHtml(String(value));
}

const UNIT_LABELS = {
  L: 'm',
  D: 'm',
  E: 'kPa',
  z: 'm',
  z_top: 'm',
  z_bot: 'm',
  z_mid: 'm',
  z_tip: 'm',
  w: 'm',
  w_mid: 'm',
  w_tip: 'm',
  w_head: 'm',
  w_mobilized: 'm',
  P_head: 'kN',
  N: 'kN',
  N_head: 'kN',
  N_tip: 'kN',
  Q: 'kN',
  Qb: 'kN',
  Qult: 'kN',
  Q_total: 'kN',
  Qs_total: 'kN',
  Qs_peak: 'kN',
  Qb_peak: 'kN',
  Q_total_peak: 'kN',
  Qs_elem: 'kN',
  Q_mobilized: 'kN',
  gamma_w: 'kN/m3',
  gamma_unsat: 'kN/m3',
  gamma_sat: 'kN/m3',
  su: 'kPa',
  UCS: 'kPa',
  Em: 'kPa',
  phi_deg: 'deg',
  sigma_v0: 'kPa',
  sigma_v_eff: 'kPa',
  sigma_v0_tip: 'kPa',
  sigma_v_eff_tip: 'kPa',
  t: 'kPa',
  tult: 'kPa',
  t_mobilized: 'kPa',
  dt_dw: 'kPa/m',
  dQb_dw: 'kN/m',
  tol_disp: 'm',
  tol_residual: 'kN',
  initial_w: 'm',
  w_max_m: 'm',
  qz_w_max_m: 'm',
  gwl_z: 'm',
  shaft_pct: '%',
  base_pct: '%',
  Qb_over_Qult: '-',
  t_over_tult: '-',
  delta_phi_ratio: '-',
  K: '-',
  K_override: '-',
  alpha_override: '-',
  residual_factor: '-',
  em_factor: '-',
  rock_shaft_factor: '-',
  rock_base_factor: '-',
  Nc_override: '-',
  Nq_override: '-',
  n_elem: '-',
  max_iter: '-',
  iterations: '-',
};

function unitForKey(key) {
  const normalized = String(key ?? '').replace(/\[\d+\]/g, '');
  const parts = normalized.split('.');
  const last = parts[parts.length - 1];
  return UNIT_LABELS[normalized] ?? UNIT_LABELS[last] ?? '';
}

function labelWithUnit(key) {
  const unit = unitForKey(key);
  return unit ? `${key} (${unit})` : key;
}

function renderRowsFromObject(obj, prefix = '') {
  if (!obj || typeof obj !== 'object') return '';

  return Object.entries(obj)
    .flatMap(([key, value]) => {
      const label = prefix ? `${prefix}.${key}` : key;

      if (Array.isArray(value)) {
        if (value.every((item) => item === null || typeof item !== 'object')) {
          return [
            `<tr><th>${escapeHtml(labelWithUnit(label))}</th><td>${escapeHtml(value.map((item) => formatValue(item)).join(', '))}</td></tr>`,
          ];
        }

        return value.flatMap((item, index) => renderRowsFromObject(item, `${label}[${index + 1}]`));
      }

      if (value && typeof value === 'object') {
        return renderRowsFromObject(value, label);
      }

      return [`<tr><th>${escapeHtml(labelWithUnit(label))}</th><td>${formatValue(value)}</td></tr>`];
    })
    .join('');
}

function renderKeyValueTable(obj) {
  return `
    <table class="report-table report-key-value">
      <tbody>${renderRowsFromObject(obj)}</tbody>
    </table>
  `;
}

function renderObjectOfArraysTable(title, obj) {
  const rows = objectOfArraysToRows(obj);
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);

  return `
    <section class="report-block">
      <h3>${escapeHtml(title)}</h3>
      <table class="report-table">
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(labelWithUnit(header))}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${headers.map((header) => `<td>${formatValue(row[header])}</td>`).join('')}
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderTipTable(tip) {
  if (!tip || Object.keys(tip).length === 0) return '';

  return `
    <section class="report-block">
      <h3>Tip result</h3>
      ${renderKeyValueTable(tip)}
    </section>
  `;
}

function renderTzCurveTables(tzCurves) {
  if (!Array.isArray(tzCurves) || tzCurves.length === 0) return '';

  return tzCurves
    .map((curve) => {
      const rows = (curve.w ?? []).map((w, index) => ({
        w_mm: Number(w) * 1000,
        t_kpa: Number(curve.t?.[index] ?? 0),
      }));

      return `
        <section class="report-block">
          <h3>t-z curve: z = ${formatNumber(curve.z, 2)} m, ${escapeHtml(curve.tz_model ?? '')}</h3>
          <p class="report-note">
            Layer: ${escapeHtml(curve.layer_name ?? '-')} |
            Mobilized point: w = ${formatNumber(Number(curve.w_mobilized ?? 0) * 1000, 3)} mm,
            t = ${formatNumber(curve.t_mobilized, 3)} kPa |
            tult = ${formatNumber(curve.tult, 3)} kPa
          </p>
          <table class="report-table report-compact-table">
            <thead>
              <tr><th>w (mm)</th><th>t (kPa)</th></tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                    <tr>
                      <td>${formatNumber(row.w_mm, 4)}</td>
                      <td>${formatNumber(row.t_kpa, 4)}</td>
                    </tr>
                  `
                )
                .join('')}
            </tbody>
          </table>
        </section>
      `;
    })
    .join('');
}

function renderQzCurveTable(qzCurve) {
  if (!qzCurve) return '';

  const rows = (qzCurve.w ?? []).map((w, index) => ({
    w_mm: Number(w) * 1000,
    Q_kN: Number(qzCurve.Q?.[index] ?? 0),
  }));

  return `
    <section class="report-block">
      <h3>P-Q curve: ${escapeHtml(qzCurve.qz_model ?? '')} at z = ${formatNumber(qzCurve.z_tip, 2)} m</h3>
      <p class="report-note">
        Mobilized point: w = ${formatNumber(Number(qzCurve.w_mobilized ?? 0) * 1000, 3)} mm,
        Q = ${formatNumber(qzCurve.Q_mobilized, 3)} kN |
        Qult = ${formatNumber(qzCurve.Qult, 3)} kN
      </p>
      <table class="report-table report-compact-table">
        <thead>
          <tr><th>w (mm)</th><th>Q (kN)</th></tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${formatNumber(row.w_mm, 4)}</td>
                  <td>${formatNumber(row.Q_kN, 4)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}

function renderSummary(result) {
  return `
    <section class="report-section">
      <h2>Summary</h2>
      ${renderKeyValueTable({
        ...result.summary,
        solver_ok: result.solver?.ok,
        converged: result.solver?.converged,
        iterations: result.solver?.iterations,
        capacity_status: result.capacity?.status,
      })}
    </section>
  `;
}

function renderTables(result) {
  return `
    <section class="report-section">
      <h2>Tables</h2>
      ${renderObjectOfArraysTable('Nodes', result?.results?.nodes)}
      ${renderObjectOfArraysTable('Elements', result?.results?.elements)}
      ${renderTipTable(result?.results?.tip)}
      ${renderTzCurveTables(result?.curves?.tz)}
      ${renderQzCurveTable(result?.curves?.qz)}
    </section>
  `;
}

function renderGraphs(result) {
  const graphs = graphDefinitions(result);

  return `
    <section class="report-section">
      <h2>Graphs</h2>
      ${graphs
        .map(
          (graph) => `
            <section class="report-graph">
              <h3>${escapeHtml(graph.title)}</h3>
              ${graph.svg}
            </section>
          `
        )
        .join('')}
    </section>
  `;
}

function reportStyles() {
  return `
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111827;
        font-family: Arial, sans-serif;
        background: #fff;
      }
      .report-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 46px;
        padding: 10px 24px;
        border-bottom: 1px solid #d1d5db;
        background: #fff;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        font-size: 12px;
        z-index: 10;
      }
      .report-document {
        padding: 62px 24px 24px;
      }
      .report-cover {
        margin-bottom: 16px;
      }
      h1, h2, h3 {
        margin: 0 0 8px;
      }
      h1 { font-size: 26px; }
      h2 {
        font-size: 18px;
        border-bottom: 2px solid #111827;
        padding-bottom: 4px;
        margin-top: 16px;
      }
      h3 {
        font-size: 14px;
        margin-top: 10px;
      }
      .report-section {
        break-inside: auto;
        margin-bottom: 14px;
      }
      .report-block,
      .report-graph {
        break-inside: avoid;
        margin-bottom: 10px;
      }
      .report-note {
        margin: 0 0 5px;
        color: #4b5563;
        font-size: 12px;
      }
      .report-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        margin-bottom: 8px;
      }
      .report-table th,
      .report-table td {
        border: 1px solid #d1d5db;
        padding: 3px 5px;
        text-align: left;
        vertical-align: top;
      }
      .report-table th {
        background: #f3f4f6;
        font-weight: 700;
      }
      .report-key-value th {
        width: 36%;
      }
      .report-compact-table {
        max-width: 420px;
      }
      .svg-chart {
        width: 100%;
        max-width: 760px;
        height: auto;
        display: block;
      }
      .svg-chart-bg { fill: #fff; }
      .svg-chart-grid { stroke: #e5e7eb; stroke-width: 1; }
      .svg-chart-axis { stroke: #111827; stroke-width: 1.2; }
      .svg-chart-line { fill: none; stroke-width: 2; }
      .svg-chart-point { stroke: none; opacity: 0.85; }
      .svg-chart-hit-point { display: none; }
      .svg-chart-tick,
      .svg-chart-label,
      .svg-chart-legend {
        fill: #374151;
        font-family: Arial, sans-serif;
      }
      .svg-chart-tick { font-size: 10px; }
      .svg-chart-label { font-size: 12px; font-weight: 700; }
      .svg-chart-legend { font-size: 11px; }
      .report-actions {
        position: sticky;
        top: 0;
        padding: 10px 24px;
        background: #f9fafb;
        border-bottom: 1px solid #d1d5db;
        z-index: 20;
        display: flex;
        gap: 8px;
      }
      .report-actions button {
        border: 1px solid #111827;
        background: #111827;
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
      }
      .report-footer {
        margin-top: 18px;
        padding-top: 10px;
        border-top: 1px solid #d1d5db;
        color: #6b7280;
        font-size: 11px;
      }
      @page {
        margin: 16mm 12mm;
      }
      @media print {
        .report-actions { display: none; }
        .report-header {
          position: fixed;
          top: 0;
        }
        .report-document {
          padding: 68px 0 0;
        }
        h2 {
          break-after: avoid;
        }
      }
    </style>
  `;
}

function generateReportHtml(input, result, options) {
  const projectName = result?.project_name || input?.project_name || 'Untitled project';
  const analysisName = result?.analysis_name || input?.analysis_name || 'Untitled analysis';
  const dateText = new Date().toLocaleString();

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(projectName)} - ${escapeHtml(analysisName)} - Axial pile report</title>
        ${reportStyles()}
      </head>
      <body>
        <div class="report-actions">
          <button type="button" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <header class="report-header">
          <strong>${escapeHtml(projectName)} &middot; ${escapeHtml(analysisName)}</strong>
          <span>${escapeHtml(dateText)}</span>
        </header>
        <main class="report-document">
          <section class="report-cover">
            <h1>Axial Pile Report</h1>
            <p><strong>Project:</strong> ${escapeHtml(projectName)}</p>
            <p><strong>Analysis:</strong> ${escapeHtml(analysisName)}</p>
            <p><strong>Date:</strong> ${escapeHtml(dateText)}</p>
          </section>

          ${options.inputs ? `<section class="report-section"><h2>Inputs</h2>${renderKeyValueTable(input)}</section>` : ''}
          ${options.summary ? renderSummary(result) : ''}
          ${options.tables ? renderTables(result) : ''}
          ${options.graphs ? renderGraphs(result) : ''}
          <footer class="report-footer">Generated with ${escapeHtml(REPORT_AUTHOR)}</footer>
        </main>
      </body>
    </html>
  `;
}

function openReport(input, result, options) {
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    alert('The report window was blocked by the browser.');
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(generateReportHtml(input, result, options));
  reportWindow.document.close();
}

export function renderReportControls(input, result) {
  const container = document.getElementById('report-output');
  if (!container) return;

  const isReady = Boolean(input && result);

  container.innerHTML = `
    <div class="report-controls">
      <label class="report-option">
        <input type="checkbox" id="report-include-inputs" checked />
        Inputs
      </label>
      <label class="report-option">
        <input type="checkbox" id="report-include-summary" checked />
        Summary
      </label>
      <label class="report-option">
        <input type="checkbox" id="report-include-tables" checked />
        Tables
      </label>
      <label class="report-option">
        <input type="checkbox" id="report-include-graphs" checked />
        Graphs
      </label>
      <button type="button" id="generate-report-btn" class="btn btn-primary" ${isReady ? '' : 'disabled'}>
        Open report
      </button>
      ${isReady ? '' : '<div class="placeholder-box">Run the solver before generating a report.</div>'}
    </div>
  `;

  const reportButton = container.querySelector('#generate-report-btn');
  if (!isReady) return;

  const readOptions = () => ({
    inputs: container.querySelector('#report-include-inputs')?.checked ?? true,
    summary: container.querySelector('#report-include-summary')?.checked ?? true,
    tables: container.querySelector('#report-include-tables')?.checked ?? true,
    graphs: container.querySelector('#report-include-graphs')?.checked ?? true,
  });

  reportButton?.addEventListener('click', () => {
    openReport(input, result, readOptions());
  });
}
