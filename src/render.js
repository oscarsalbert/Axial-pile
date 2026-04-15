import {
  escapeHtml,
  formatNumber,
  graphDefinitions,
} from './svgCharts.js';

function prettifyHeader(key) {
  const map = {
    z: 'Depth (m)',
    w: 'Displacement (m)',
    N: 'Axial force (kN)',
    z_mid: 'Mid-depth (m)',
    w_mid: 'Mid displacement (m)',
    t: 'Unit shaft resistance',
    t_over_tult: 't / tult',
    tult: 'tult',
    Qs_elem: 'Shaft resistance, element (kN)',
    tz_model: 't-z model',
    layer_name: 'Layer',
    z_tip: 'Tip depth (m)',
    w_tip: 'Tip settlement (m)',
    Qb: 'Base resistance (kN)',
    Qult: 'Ultimate base resistance (kN)',
    Qb_over_Qult: 'Qb / Qult',
    qz_model: 'q-z model',
  };

  return map[key] ?? key;
}

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

function formatCellValue(key, value) {
  if (value === null || value === undefined || value === '') return '-';

  if (typeof value === 'string') return escapeHtml(value);
  if (typeof value !== 'number') return escapeHtml(String(value));

  if (key === 'w' || key === 'w_mid' || key === 'w_tip') return value.toExponential(3);
  if (key === 'z' || key === 'z_mid' || key === 'z_tip') return value.toFixed(2);
  if (key === 'N' || key === 'Qs_elem' || key === 'Qb' || key === 'Qult') return value.toFixed(2);
  if (key === 't' || key === 'tult') return value.toFixed(2);
  if (key === 't_over_tult' || key === 'Qb_over_Qult') return value.toFixed(3);

  return value.toFixed(2);
}

function createCollapsibleSection(title, contentHTML, id) {
  return `
    <div class="output-section">
      <div class="output-header" data-toggle="${id}">
        <span>${escapeHtml(title)}</span>
        <span class="toggle-icon">▼</span>
      </div>
      <div class="output-content" id="${id}">
        ${contentHTML}
      </div>
    </div>
  `;
}

function renderSummary(summary, solver, projectName = '', analysisName = '') {
  if (!summary || Object.keys(summary).length === 0) {
    return `<div class="placeholder-box">No summary available</div>`;
  }

  const headSettlementMm =
    summary.w_head !== undefined && summary.w_head !== null
      ? summary.w_head * 1000
      : null;

  const tipSettlementMm =
    summary.w_tip !== undefined && summary.w_tip !== null
      ? summary.w_tip * 1000
      : null;

  return `
    ${
      projectName || analysisName
        ? `<div class="project-title">${escapeHtml(projectName || 'Untitled project')}${analysisName ? ` · ${escapeHtml(analysisName)}` : ''}</div>`
        : ''
    }

    <div class="summary-grid">
      <div class="summary-card"><span>Head load</span><strong>${formatNumber(summary.P_head, 2)} kN</strong></div>
      <div class="summary-card"><span>Head settlement</span><strong>${formatNumber(headSettlementMm, 3)} mm</strong></div>
      <div class="summary-card"><span>Tip settlement</span><strong>${formatNumber(tipSettlementMm, 3)} mm</strong></div>
      <div class="summary-card"><span>Total shaft resistance</span><strong>${formatNumber(summary.Qs_total, 2)} kN</strong></div>
      <div class="summary-card"><span>Base resistance</span><strong>${formatNumber(summary.Qb, 2)} kN</strong></div>
      <div class="summary-card"><span>Total resistance</span><strong>${formatNumber(summary.Q_total, 2)} kN</strong></div>
      <div class="summary-card"><span>Shaft percentage</span><strong>${formatNumber(summary.shaft_pct, 1)} %</strong></div>
      <div class="summary-card"><span>Base percentage</span><strong>${formatNumber(summary.base_pct, 1)} %</strong></div>
      <div class="summary-card"><span>Converged</span><strong>${solver?.converged ? 'Yes' : 'No'}</strong></div>
      <div class="summary-card"><span>Iterations</span><strong>${solver?.iterations ?? '-'}</strong></div>
    </div>
  `;
}

function renderTableFromObjectOfArrays(obj) {
  const rows = objectOfArraysToRows(obj);

  if (!rows || rows.length === 0) {
    return `<div class="placeholder-box">No data</div>`;
  }

  const headers = Object.keys(rows[0]);

  return `
    <div class="table-wrapper">
      <table class="result-table">
        <thead>
          <tr>
            ${headers.map((header) => `<th>${escapeHtml(prettifyHeader(header))}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${headers
                    .map((header) => `<td>${formatCellValue(header, row[header])}</td>`)
                    .join('')}
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSolverDetails(solver, capacity) {
  return `
    <div class="solver-meta">
      <div><strong>OK:</strong> ${solver?.ok ? 'Yes' : 'No'}</div>
      <div><strong>Converged:</strong> ${solver?.converged ? 'Yes' : 'No'}</div>
      <div><strong>Iterations:</strong> ${solver?.iterations ?? '-'}</div>
      <div><strong>Max |dw|:</strong> ${solver?.max_abs_dw ?? '-'}</div>
      <div><strong>Max residual:</strong> ${solver?.max_abs_residual ?? '-'}</div>
    </div>

    ${
      solver?.warnings?.length
        ? `
          <div class="message-block warning-block">
            <strong>Warnings</strong>
            <ul>${solver.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
          </div>
        `
        : ''
    }

    ${
      solver?.errors?.length
        ? `
          <div class="message-block error-block">
            <strong>Errors</strong>
            <ul>${solver.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>
          </div>
        `
        : ''
    }

    ${
      capacity
        ? `<div class="capacity-block"><strong>Capacity check status:</strong> ${escapeHtml(capacity.status ?? '-')}</div>`
        : ''
    }
  `;
}

function renderPlots(result) {
  const graphs = graphDefinitions(result);

  return `
    <div class="plots-grid">
      ${graphs
        .map(
          (graph) => `
            <div class="plot-card">
              <h4>${escapeHtml(graph.title)}</h4>
              <div class="plot-svg-wrap">${graph.svg}</div>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

export function renderLoading() {
  const el = document.getElementById('solver-status');
  if (el) {
    el.innerHTML = `<div class="status-pill status-warning">Running solver...</div>`;
  }
}

export function renderError(err) {
  const statusEl = document.getElementById('solver-status');
  const summaryEl = document.getElementById('summary-output');
  const tablesEl = document.getElementById('tables-output');
  const plotsEl = document.getElementById('plots-output');

  if (statusEl) {
    statusEl.innerHTML = `<div class="status-pill status-error">Solver failed</div>`;
  }

  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="message-block error-block">
        <strong>Error</strong>
        <div>${escapeHtml(err?.message ?? String(err))}</div>
      </div>
    `;
  }

  if (tablesEl) tablesEl.innerHTML = '';
  if (plotsEl) plotsEl.innerHTML = '';
}

export function renderResult(result) {
  const summaryEl = document.getElementById('summary-output');
  const tablesEl = document.getElementById('tables-output');
  const plotsEl = document.getElementById('plots-output');

  const summaryHTML = renderSummary(
    result?.summary,
    result?.solver,
    result?.project_name ?? '',
    result?.analysis_name ?? ''
  );

  const tablesHTML = `
    <div class="table-block">
      <h4>Nodes (depth results)</h4>
      ${renderTableFromObjectOfArrays(result?.results?.nodes)}
    </div>

    <div class="table-block">
      <h4>Elements (shaft resistance)</h4>
      ${renderTableFromObjectOfArrays(result?.results?.elements)}
    </div>

    <div class="table-block">
      <h4>Tip result</h4>
      <div class="table-wrapper">
        <table class="result-table">
          <tbody>
            ${Object.entries(result?.results?.tip ?? {})
              .map(
                ([key, value]) => `
                  <tr>
                    <th>${escapeHtml(prettifyHeader(key))}</th>
                    <td>${typeof value === 'number' ? formatNumber(value, 3) : escapeHtml(String(value))}</td>
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (summaryEl) {
    summaryEl.innerHTML = createCollapsibleSection('Summary', summaryHTML, 'summary-section');
  }

  if (tablesEl) {
    tablesEl.innerHTML = createCollapsibleSection('Tables', tablesHTML, 'tables-section');
  }

  if (plotsEl) {
    plotsEl.innerHTML = createCollapsibleSection('Plots', renderPlots(result), 'plots-section');
  }

  const solverStatusEl = document.getElementById('solver-status');
  if (solverStatusEl) {
    solverStatusEl.innerHTML = createCollapsibleSection(
      'Solver status',
      renderSolverDetails(result?.solver, result?.capacity),
      'solver-status-section'
    );
  }

  bindCollapsibles();
  bindChartTooltips();
}

function bindCollapsibles() {
  document.querySelectorAll('.output-header').forEach((header) => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.toggle;
      const content = document.getElementById(targetId);
      const icon = header.querySelector('.toggle-icon');

      const isHidden = content.style.display === 'none';

      content.style.display = isHidden ? 'block' : 'none';
      icon.textContent = isHidden ? '▼' : '▶';
    });
  });
}

function bindChartTooltips() {
  let tooltip = document.getElementById('chart-tooltip');

  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'chart-tooltip';
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);
  }

  const moveTooltip = (event) => {
    tooltip.style.left = `${event.clientX + 14}px`;
    tooltip.style.top = `${event.clientY + 14}px`;
  };

  document.querySelectorAll('[data-chart-point="true"]').forEach((point) => {
    point.addEventListener('mouseenter', (event) => {
      const target = event.currentTarget;
      tooltip.innerHTML = `
        <div><strong>${target.dataset.series}</strong></div>
        <div>${target.dataset.xLabel}: ${target.dataset.x}</div>
        <div>${target.dataset.yLabel}: ${target.dataset.y}</div>
      `;
      tooltip.classList.add('chart-tooltip-visible');
      moveTooltip(event);
    });

    point.addEventListener('mousemove', moveTooltip);

    point.addEventListener('mouseleave', () => {
      tooltip.classList.remove('chart-tooltip-visible');
    });
  });
}
