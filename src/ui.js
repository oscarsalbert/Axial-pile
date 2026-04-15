function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const TZ_MODEL_OPTIONS = [
  'API_CLAY',
  'API_SAND',
  'REESE_ONEILL_CLAY',
  'REESE_ONEILL_SAND',
  'ONEILL_HASSAN_ROCK',
];

const ALL_QZ_MODEL_OPTIONS = [
  'API_QZ_CLAY',
  'API_QZ_SAND',
  'REESE_ONEILL_QZ_CLAY',
  'REESE_ONEILL_QZ_SAND',
  'ROCK_QZ_SIMPLE',
];

function renderOptions(options, selectedValue) {
  return options
    .map((option) => {
      const selected = option === selectedValue ? 'selected' : '';
      return `<option value="${option}" ${selected}>${option}</option>`;
    })
    .join('');
}

function getDefaultProfileConst(value) {
  return {
    type: 'const',
    value,
  };
}

function getCompatibleQzOptionsForTzModel(tzModel) {
  switch (tzModel) {
    case 'API_CLAY':
    case 'REESE_ONEILL_CLAY':
      return ['API_QZ_CLAY', 'REESE_ONEILL_QZ_CLAY'];

    case 'API_SAND':
    case 'REESE_ONEILL_SAND':
      return ['API_QZ_SAND', 'REESE_ONEILL_QZ_SAND'];

    case 'ONEILL_HASSAN_ROCK':
      return ['ROCK_QZ_SIMPLE'];

    default:
      return ALL_QZ_MODEL_OPTIONS;
  }
}

function getTipLayer(inputData) {
  const pileLength = Number(inputData?.pile?.L ?? 0);
  const layers = inputData?.layers ?? [];

  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index];
    const isLastLayer = index === layers.length - 1;
    const zTop = Number(layer?.z_top ?? 0);
    const zBot = Number(layer?.z_bot ?? 0);

    if (isLastLayer && pileLength >= zTop && pileLength <= zBot) {
      return layer;
    }

    if (!isLastLayer && pileLength >= zTop && pileLength < zBot) {
      return layer;
    }
  }

  return layers.length > 0 ? layers[layers.length - 1] : null;
}

function getCompatibleQzOptions(inputData) {
  const tipLayer = getTipLayer(inputData);
  const tipTzModel = tipLayer?.tz_model;
  return getCompatibleQzOptionsForTzModel(tipTzModel);
}

function getDefaultQzModelForInput(inputData) {
  const compatible = getCompatibleQzOptions(inputData);
  return compatible[0] ?? 'API_QZ_CLAY';
}

function getDefaultTzParams(model) {
  switch (model) {
    case 'API_CLAY':
      return {
        su: getDefaultProfileConst(50),
      };

    case 'API_SAND':
      return {
        phi_deg: getDefaultProfileConst(35),
        delta_phi_ratio: getDefaultProfileConst(0.8),
      };

    case 'REESE_ONEILL_CLAY':
      return {
        su: getDefaultProfileConst(75),
      };

    case 'REESE_ONEILL_SAND':
      return {
        phi_deg: getDefaultProfileConst(35),
        delta_phi_ratio: getDefaultProfileConst(0.8),
        K: getDefaultProfileConst(0.7),
      };

    case 'ONEILL_HASSAN_ROCK':
      return {
        UCS: getDefaultProfileConst(2000),
        Em_mode: 'factor',
        em_factor: 200,
      };

    default:
      return {};
  }
}

function getDefaultQzParams(model) {
  switch (model) {
    case 'API_QZ_CLAY':
    case 'API_QZ_SAND':
    case 'REESE_ONEILL_QZ_CLAY':
    case 'REESE_ONEILL_QZ_SAND':
    case 'ROCK_QZ_SIMPLE':
      return {};
    default:
      return {};
  }
}

function ensureProfile(profile, fallbackConstValue = 0) {
  if (!profile || typeof profile !== 'object' || !profile.type) {
    return getDefaultProfileConst(fallbackConstValue);
  }

  if (profile.type === 'const') {
    return {
      type: 'const',
      value: profile.value ?? fallbackConstValue,
    };
  }

  if (profile.type === 'linear_layer') {
    return {
      type: 'linear_layer',
      top: profile.top ?? fallbackConstValue,
      bot: profile.bot ?? fallbackConstValue,
    };
  }

  return getDefaultProfileConst(fallbackConstValue);
}

function ensureLayerDefaults(layer, index = 0) {
  const tzModel = layer?.tz_model ?? 'API_CLAY';
  const defaults = getDefaultTzParams(tzModel);
  const mergedParams = { ...defaults, ...(layer?.tz_params ?? {}) };

  if (tzModel === 'ONEILL_HASSAN_ROCK') {
    mergedParams.UCS = ensureProfile(mergedParams.UCS, 2000);
    mergedParams.Em_mode =
      mergedParams.Em_mode === 'direct' ? 'direct' : 'factor';

    if (mergedParams.Em_mode === 'direct') {
      mergedParams.Em = ensureProfile(mergedParams.Em, 100000);
      delete mergedParams.em_factor;
    } else {
      mergedParams.em_factor =
        mergedParams.em_factor === undefined ? 200 : mergedParams.em_factor;
      delete mergedParams.Em;
    }
  }

  if (tzModel === 'API_CLAY' || tzModel === 'REESE_ONEILL_CLAY') {
    mergedParams.su = ensureProfile(mergedParams.su, tzModel === 'API_CLAY' ? 50 : 75);
  }

  if (tzModel === 'API_SAND' || tzModel === 'REESE_ONEILL_SAND') {
    mergedParams.phi_deg = ensureProfile(mergedParams.phi_deg, 35);
    mergedParams.delta_phi_ratio = ensureProfile(mergedParams.delta_phi_ratio, 0.8);
  }

  if (tzModel === 'REESE_ONEILL_SAND') {
    mergedParams.K = ensureProfile(mergedParams.K, 0.7);
  }

  return {
    name: layer?.name ?? `Layer ${index + 1}`,
    z_top: layer?.z_top ?? 0,
    z_bot: layer?.z_bot ?? 5,
    gamma_unsat: layer?.gamma_unsat ?? 18,
    gamma_sat: layer?.gamma_sat ?? 20,
    tz_model: tzModel,
    tz_params: mergedParams,
  };
}

function ensureQzDefaults(qzModel, inputData) {
  const compatible = getCompatibleQzOptions(inputData);
  const proposedName = qzModel?.name ?? getDefaultQzModelForInput(inputData);
  const name = compatible.includes(proposedName)
    ? proposedName
    : getDefaultQzModelForInput(inputData);

  return {
    name,
    params: {
      ...getDefaultQzParams(name),
      ...(qzModel?.params ?? {}),
    },
  };
}

function ensureCurveRequestsDefaults(inputData) {
  const pileLength = Number(inputData?.pile?.L ?? 0);
  const pileDiameter = Number(inputData?.pile?.D ?? 1);
  const rawDepths = inputData?.curve_requests?.tz_depths ?? [];
  const fallbackDepths =
    pileLength > 0
      ? [0.25 * pileLength, 0.5 * pileLength, 0.75 * pileLength]
      : [];

  const depths = (Array.isArray(rawDepths) && rawDepths.length > 0
    ? rawDepths
    : fallbackDepths
  )
    .map((depth) => Number(depth))
    .filter((depth) => Number.isFinite(depth))
    .map((depth) => {
      if (pileLength <= 0) return Math.max(0, depth);
      return Math.min(Math.max(0, depth), pileLength);
    });

  return {
    tz_depths: depths,
    include_qz: true,
    n_points: Number(inputData?.curve_requests?.n_points ?? 60),
    w_max_m: 0.1 * pileDiameter,
    qz_w_max_m: 0.2 * pileDiameter,
  };
}

function getDefaultLayer(previousLayer = null, index = 0) {
  const zTop = previousLayer ? Number(previousLayer.z_bot ?? 0) : 0;
  const zBot = zTop + 5;

  return {
    name: `Layer ${index + 1}`,
    z_top: zTop,
    z_bot: zBot,
    gamma_unsat: 18,
    gamma_sat: 20,
    tz_model: 'API_CLAY',
    tz_params: getDefaultTzParams('API_CLAY'),
  };
}

function renderBasicInputField({
  label,
  value,
  id = null,
  dataField = null,
  dataIndex = null,
  type = 'number',
  step = 'any',
  options = [],
  readOnly = false,
  placeholder = '',
}) {
  const idAttr = id ? `id="${id}"` : '';
  const fieldAttr = dataField ? `data-param-field="${dataField}"` : '';
  const indexAttr = dataIndex !== null ? `data-layer-index="${dataIndex}"` : '';
  const readOnlyAttr = readOnly ? 'readonly' : '';
  const placeholderAttr = placeholder ? `placeholder="${escapeHtml(placeholder)}"` : '';

  if (type === 'select') {
    return `
      <label>
        ${label}
        <select ${idAttr} ${fieldAttr} ${indexAttr}>
          ${renderOptions(options, value)}
        </select>
      </label>
    `;
  }

  return `
    <label>
      ${label}
      <input
        ${idAttr}
        type="${type}"
        step="${step}"
        value="${escapeHtml(value ?? '')}"
        ${fieldAttr}
        ${indexAttr}
        ${readOnlyAttr}
        ${placeholderAttr}
      />
    </label>
  `;
}

function renderProfileEditor({
  label,
  fieldName,
  profile,
  layerIndex,
}) {
  const p = ensureProfile(profile, 0);

  return `
    <div class="profile-editor">
      <div class="profile-editor-header">${label}</div>

      <div class="param-grid">
        ${renderBasicInputField({
          label: 'Profile type',
          value: p.type,
          dataField: `${fieldName}.__profile_type`,
          dataIndex: layerIndex,
          type: 'select',
          options: ['const', 'linear_layer'],
        })}

        ${
          p.type === 'const'
            ? renderBasicInputField({
                label: 'Value',
                value: p.value ?? '',
                dataField: `${fieldName}.__value`,
                dataIndex: layerIndex,
              })
            : `
              ${renderBasicInputField({
                label: 'Top value',
                value: p.top ?? '',
                dataField: `${fieldName}.__top`,
                dataIndex: layerIndex,
              })}
              ${renderBasicInputField({
                label: 'Bottom value',
                value: p.bot ?? '',
                dataField: `${fieldName}.__bot`,
                dataIndex: layerIndex,
              })}
            `
        }
      </div>
    </div>
  `;
}

function renderOptionalScalarField({
  label,
  value,
  fieldName,
  layerIndex = null,
  baseField = false,
}) {
  const indexAttr = layerIndex !== null ? `data-layer-index="${layerIndex}"` : '';
  const baseAttr = baseField ? 'data-base-param="true"' : '';

  return `
    <label>
      ${label}
      <input
        type="number"
        step="any"
        value="${escapeHtml(value ?? '')}"
        data-param-field="${fieldName}"
        ${indexAttr}
        ${baseAttr}
        placeholder="Optional"
      />
    </label>
  `;
}

function renderTzParamsEditor(layer, index) {
  const model = layer.tz_model;
  const params = layer.tz_params ?? {};

  switch (model) {
    case 'API_CLAY':
      return `
        <div class="param-stack">
          ${renderProfileEditor({
            label: 'su (kPa)',
            fieldName: 'su',
            profile: params.su,
            layerIndex: index,
          })}
          <div class="param-grid">
            ${renderOptionalScalarField({
              label: 'alpha_override',
              value: params.alpha_override ?? '',
              fieldName: 'alpha_override',
              layerIndex: index,
            })}
            ${renderOptionalScalarField({
              label: 'residual_factor',
              value: params.residual_factor ?? '',
              fieldName: 'residual_factor',
              layerIndex: index,
            })}
          </div>
        </div>
      `;

    case 'API_SAND':
      return `
        <div class="param-stack">
          ${renderProfileEditor({
            label: 'phi_deg',
            fieldName: 'phi_deg',
            profile: params.phi_deg,
            layerIndex: index,
          })}
          ${renderProfileEditor({
            label: 'delta_phi_ratio',
            fieldName: 'delta_phi_ratio',
            profile: params.delta_phi_ratio,
            layerIndex: index,
          })}
          <div class="param-grid">
            ${renderOptionalScalarField({
              label: 'K_override',
              value: params.K_override ?? '',
              fieldName: 'K_override',
              layerIndex: index,
            })}
          </div>
        </div>
      `;

    case 'REESE_ONEILL_CLAY':
      return `
        <div class="param-stack">
          ${renderProfileEditor({
            label: 'su (kPa)',
            fieldName: 'su',
            profile: params.su,
            layerIndex: index,
          })}
          <div class="param-grid">
            ${renderOptionalScalarField({
              label: 'alpha_override',
              value: params.alpha_override ?? '',
              fieldName: 'alpha_override',
              layerIndex: index,
            })}
          </div>
        </div>
      `;

    case 'REESE_ONEILL_SAND':
      return `
        <div class="param-stack">
          ${renderProfileEditor({
            label: 'phi_deg',
            fieldName: 'phi_deg',
            profile: params.phi_deg,
            layerIndex: index,
          })}
          ${renderProfileEditor({
            label: 'delta_phi_ratio',
            fieldName: 'delta_phi_ratio',
            profile: params.delta_phi_ratio,
            layerIndex: index,
          })}
          ${renderProfileEditor({
            label: 'K',
            fieldName: 'K',
            profile: params.K,
            layerIndex: index,
          })}
        </div>
      `;

    case 'ONEILL_HASSAN_ROCK':
      return `
        <div class="param-stack">
          ${renderProfileEditor({
            label: 'UCS (kPa)',
            fieldName: 'UCS',
            profile: params.UCS,
            layerIndex: index,
          })}

          <div class="profile-editor">
            <div class="profile-editor-header">Rock stiffness input</div>
            <div class="param-grid">
              ${renderBasicInputField({
                label: 'Em input mode',
                value: params.Em_mode ?? 'factor',
                dataField: 'Em_mode',
                dataIndex: index,
                type: 'select',
                options: ['factor', 'direct'],
              })}
            </div>
          </div>

          ${
            (params.Em_mode ?? 'factor') === 'direct'
              ? renderProfileEditor({
                  label: 'Em (kPa)',
                  fieldName: 'Em',
                  profile: params.Em,
                  layerIndex: index,
                })
              : `
                <div class="param-grid">
                  ${renderOptionalScalarField({
                    label: 'em_factor',
                    value: params.em_factor ?? 200,
                    fieldName: 'em_factor',
                    layerIndex: index,
                  })}
                </div>
              `
          }

          <div class="param-grid">
            ${renderOptionalScalarField({
              label: 'rock_shaft_factor',
              value: params.rock_shaft_factor ?? '',
              fieldName: 'rock_shaft_factor',
              layerIndex: index,
            })}
            ${renderOptionalScalarField({
              label: 'tult_override',
              value: params.tult_override ?? '',
              fieldName: 'tult_override',
              layerIndex: index,
            })}
          </div>
        </div>
      `;

    default:
      return `<div class="placeholder-box">No parameters defined for this model</div>`;
  }
}

function renderQzParamsEditor(qzModel, inputData) {
  const model = qzModel.name;
  const params = qzModel.params ?? {};
  const tipLayer = getTipLayer(inputData);

  switch (model) {
    case 'API_QZ_CLAY':
      return `
        <div class="param-grid">
          ${renderOptionalScalarField({
            label: 'Nc_override',
            value: params.Nc_override ?? '',
            fieldName: 'Nc_override',
            baseField: true,
          })}
        </div>
      `;

    case 'API_QZ_SAND':
      return `
        <div class="param-grid">
          ${renderOptionalScalarField({
            label: 'Nq_override',
            value: params.Nq_override ?? '',
            fieldName: 'Nq_override',
            baseField: true,
          })}
        </div>
      `;

    case 'REESE_ONEILL_QZ_CLAY':
      return `
        <div class="param-grid">
          ${renderOptionalScalarField({
            label: 'Nc_override',
            value: params.Nc_override ?? '',
            fieldName: 'Nc_override',
            baseField: true,
          })}
        </div>
      `;

    case 'REESE_ONEILL_QZ_SAND':
      return `
        <div class="param-grid">
          ${renderOptionalScalarField({
            label: 'Nq_override',
            value: params.Nq_override ?? '',
            fieldName: 'Nq_override',
            baseField: true,
          })}
        </div>
      `;

    case 'ROCK_QZ_SIMPLE':
      return `
        <div class="placeholder-box">
          Rock q-z uses the rock properties from the tip layer (${escapeHtml(tipLayer?.name ?? 'tip layer')}), especially UCS and, if provided, Em.
        </div>
        <div class="param-grid" style="margin-top: 10px;">
          ${renderOptionalScalarField({
            label: 'rock_base_factor',
            value: params.rock_base_factor ?? '',
            fieldName: 'rock_base_factor',
            baseField: true,
          })}
          ${renderOptionalScalarField({
            label: 'Qult_override',
            value: params.Qult_override ?? '',
            fieldName: 'Qult_override',
            baseField: true,
          })}
        </div>
      `;

    default:
      return `<div class="placeholder-box">No parameters defined for this model</div>`;
  }
}

function renderLayerGeometryTable(layers) {
  return `
    <div class="layer-geometry-table-wrap">
      <table class="layer-geometry-table" data-layer-geometry-table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Z Top (m)</th>
            <th>Z Bottom (m)</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${layers
            .map(
              (layer, index) => `
                <tr>
                  <td>
                    <input
                      type="text"
                      data-layer-field="name"
                      data-layer-index="${index}"
                      value="${escapeHtml(layer.name)}"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      data-layer-field="z_top"
                      data-layer-index="${index}"
                      value="${escapeHtml(layer.z_top)}"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      data-layer-field="z_bot"
                      data-layer-index="${index}"
                      value="${escapeHtml(layer.z_bot)}"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-danger btn-small"
                      data-remove-layer="${index}"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCurveDepthsTable(depths) {
  return `
    <div class="layer-geometry-table-wrap">
      <table class="layer-geometry-table curve-depth-table">
        <thead>
          <tr>
            <th>Depth z (m)</th>
          </tr>
        </thead>
        <tbody>
          ${depths
            .map(
              (depth, index) => `
                <tr>
                  <td>
                    <div class="curve-depth-row">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        data-curve-depth-index="${index}"
                        value="${escapeHtml(depth)}"
                      />
                      <button
                        type="button"
                        class="btn btn-danger btn-small"
                        data-remove-curve-depth="${index}"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLayerModelCard(rawLayer, index) {
  const layer = ensureLayerDefaults(rawLayer, index);

  return `
    <div class="layer-card" data-layer-index="${index}">
      <div class="layer-card-header">
        <h4>${escapeHtml(layer.name)}</h4>
      </div>

      <div class="layer-grid">
        <label>
          gamma_unsat (kN/m³)
          <input
            type="number"
            step="any"
            data-layer-field="gamma_unsat"
            data-layer-index="${index}"
            value="${escapeHtml(layer.gamma_unsat)}"
          />
        </label>

        <label>
          gamma_sat (kN/m³)
          <input
            type="number"
            step="any"
            data-layer-field="gamma_sat"
            data-layer-index="${index}"
            value="${escapeHtml(layer.gamma_sat)}"
          />
        </label>

        <label class="layer-grid-full">
          t-z model
          <select
            data-layer-field="tz_model"
            data-layer-index="${index}"
          >
            ${renderOptions(TZ_MODEL_OPTIONS, layer.tz_model)}
          </select>
        </label>

        <div class="layer-grid-full model-params-box">
          <div class="model-params-title">t-z parameters</div>
          ${renderTzParamsEditor(layer, index)}
        </div>
      </div>
    </div>
  `;
}

function getInputSectionOpenState(container) {
  const state = new Map();

  container.querySelectorAll('.input-details').forEach((details) => {
    const title = details.querySelector('.input-summary span')?.textContent;
    if (title) state.set(title, details.open);
  });

  return state;
}

function replaceObjectContents(target, source) {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });

  Object.assign(target, source);
}

function syncCurrentInputFromDom(currentInput) {
  const projectNameInput = document.getElementById('project-name');
  if (!projectNameInput) return;

  replaceObjectContents(currentInput, readBaseInputForm());
}

function syncBasicInputFieldsFromDom(currentInput) {
  if (!document.getElementById('project-name')) return;

  currentInput.project_name = document.getElementById('project-name')?.value ?? '';
  currentInput.analysis_name = document.getElementById('analysis-name')?.value ?? '';

  if (!currentInput.water) currentInput.water = {};
  const gwlZ = Number(document.getElementById('water-gwl-z')?.value);
  const gammaW = Number(document.getElementById('water-gamma-w')?.value);
  if (Number.isFinite(gwlZ)) currentInput.water.gwl_z = gwlZ;
  if (Number.isFinite(gammaW)) currentInput.water.gamma_w = gammaW;

  if (!currentInput.analysis) currentInput.analysis = {};
  const nElem = Number(document.getElementById('analysis-nelem')?.value);
  const tolDisp = Number(document.getElementById('analysis-tol-disp')?.value);
  const maxIter = Number(document.getElementById('analysis-max-iter')?.value);
  if (Number.isFinite(nElem)) currentInput.analysis.n_elem = nElem;
  if (Number.isFinite(tolDisp)) currentInput.analysis.tol_disp = tolDisp;
  if (Number.isFinite(maxIter)) currentInput.analysis.max_iter = maxIter;

  if (!currentInput.load) currentInput.load = {};
  const pHead = Number(document.getElementById('load-phead')?.value);
  if (Number.isFinite(pHead)) currentInput.load.P_head = pHead;

  syncPileGeometryFromDom(currentInput);
  syncLayerGeometryFromDom(currentInput);

  document.querySelectorAll('.layer-card').forEach((card) => {
    const index = Number(card.dataset.layerIndex);
    const layer = currentInput.layers?.[index];
    if (!layer) return;

    const gammaUnsat = Number(card.querySelector('[data-layer-field="gamma_unsat"]')?.value);
    const gammaSat = Number(card.querySelector('[data-layer-field="gamma_sat"]')?.value);
    if (Number.isFinite(gammaUnsat)) layer.gamma_unsat = gammaUnsat;
    if (Number.isFinite(gammaSat)) layer.gamma_sat = gammaSat;
  });
}

function rerenderInputForm(container, currentInput) {
  renderBaseInputForm(container, currentInput);
  bindLayerEditor(container, currentInput);
}

function enhanceInputSections(container, previousOpenSections = new Map()) {
  container.querySelectorAll('.form-section').forEach((section, index) => {
    if (section.querySelector(':scope > details.input-details')) return;

    const sectionHeader = section.querySelector(':scope > .section-header');
    const titleEl = sectionHeader?.querySelector('h3') ?? section.querySelector(':scope > h3');
    if (!titleEl) return;

    const title = titleEl.textContent;
    const details = document.createElement('details');
    details.className = 'input-details';
    details.open = previousOpenSections.has(title)
      ? previousOpenSections.get(title)
      : index < 3;

    const summary = document.createElement('summary');
    summary.className = 'input-summary';
    summary.innerHTML = `<span>${escapeHtml(title)}</span><span class="input-summary-icon"></span>`;

    const content = document.createElement('div');
    content.className = 'input-details-content';

    titleEl.remove();

    while (section.firstChild) {
      const child = section.firstChild;
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim() === '') {
        child.remove();
      } else {
        content.appendChild(child);
      }
    }

    details.appendChild(summary);
    details.appendChild(content);
    section.appendChild(details);
  });
}

export function createAppLayout(root) {
  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <h2>Oscar GeoTools</h2>
          <p>Geotechnical apps</p>
        </div>

        <nav class="sidebar-nav">
          <button class="btn nav-item nav-item-active">Axial pile</button>
          <button class="btn nav-item" disabled>Lateral pile</button>
          <button class="btn nav-item" disabled>CPT tool</button>
          <button class="btn nav-item" disabled>Settlement</button>
        </nav>

        <section class="saved-cases-panel" aria-label="Saved cases">
          <div class="saved-cases-header">
            <h3>Saved cases</h3>
            <span id="saved-cases-count">0</span>
          </div>
          <div id="saved-cases-list" class="saved-cases-list">
            <div class="saved-cases-empty">No saved cases yet.</div>
          </div>
        </section>

        <div class="sidebar-credit">Developed by Oscar GeoTools</div>
      </aside>

      <div class="main-area">
        <header class="topbar">
          <div>
            <h1>Axial Pile Tool</h1>
            <p>1D FEM · t-z / q-z solver</p>
          </div>

          <div class="topbar-actions">
            <button id="save-case-btn" class="btn">Save case</button>
            <button id="docs-btn" class="btn">Readme</button>
            <button id="load-sample-btn" class="btn">Load sample</button>
            <button id="run-btn" class="btn btn-primary">Run solver</button>
          </div>
        </header>

        <main class="dashboard">
          <aside class="panel input-panel">
            <section class="card">
              <h2>Inputs</h2>
              <div id="input-form"></div>
            </section>
          </aside>

          <section class="panel output-panel">
            <section class="card">
              <h2>Solver status</h2>
              <div id="solver-status"></div>
            </section>

            <section class="card">
              <h2>Summary</h2>
              <div id="summary-output"></div>
            </section>

            <section class="card">
              <h2>Tables</h2>
              <div id="tables-output"></div>
            </section>

            <section class="card">
              <h2>Plots</h2>
              <div id="plots-output"></div>
            </section>

            <section class="card">
              <h2>Report</h2>
              <div id="report-output"></div>
            </section>
          </section>
        </main>
      </div>

      <div id="docs-modal" class="docs-modal" aria-hidden="true">
        <div class="docs-backdrop" data-docs-close></div>
        <section class="docs-dialog" role="dialog" aria-modal="true" aria-labelledby="docs-title">
          <header class="docs-header">
            <h2 id="docs-title">Axial Pile Tool Readme</h2>
            <button type="button" class="btn" data-docs-close>Close</button>
          </header>
          <div id="docs-content" class="docs-content"></div>
        </section>
      </div>
    </div>
  `;
}

export function renderSavedCases(cases) {
  const list = document.getElementById('saved-cases-list');
  const count = document.getElementById('saved-cases-count');
  if (!list || !count) return;

  count.textContent = String(cases.length);

  if (!cases.length) {
    list.innerHTML = '<div class="saved-cases-empty">No saved cases yet.</div>';
    return;
  }

  const grouped = cases.reduce((acc, savedCase) => {
    const projectName = savedCase.project_name || 'Untitled project';
    if (!acc.has(projectName)) acc.set(projectName, []);
    acc.get(projectName).push(savedCase);
    return acc;
  }, new Map());

  list.innerHTML = Array.from(grouped.entries())
    .map(([projectName, projectCases]) => `
      <section class="saved-project-group">
        <h4>${escapeHtml(projectName)}</h4>
        <div class="saved-project-cases">
          ${projectCases
            .map((savedCase) => {
              const hasResult = Boolean(savedCase.result);
              const dateText = savedCase.saved_at
                ? new Date(savedCase.saved_at).toLocaleDateString()
                : '';
              const settlement =
                savedCase.summary?.w_head !== undefined
                  ? `${(savedCase.summary.w_head * 1000).toFixed(2)} mm`
                  : null;

              return `
                <article class="saved-case">
                  <button type="button" class="saved-case-delete" data-delete-case="${escapeHtml(savedCase.id)}" title="Delete case" aria-label="Delete case">
                    ×
                  </button>
                  <button type="button" class="saved-case-load" data-load-case="${escapeHtml(savedCase.id)}">
                    <span class="saved-case-title">${escapeHtml(savedCase.analysis_name || 'Untitled analysis')}</span>
                    <span class="saved-case-meta">
                      ${hasResult ? 'Result saved' : 'Inputs only'}${settlement ? ` · ${escapeHtml(settlement)}` : ''}${dateText ? ` · ${escapeHtml(dateText)}` : ''}
                    </span>
                  </button>
                </article>
              `;
            })
            .join('')}
        </div>
      </section>
    `)
    .join('');
}

export function renderBaseInputForm(container, inputData) {
  const previousOpenSections = getInputSectionOpenState(container);
  const layers = (inputData.layers ?? []).map((layer, index) =>
    ensureLayerDefaults(layer, index)
  );

  const normalizedInput = {
    ...inputData,
    layers,
  };

  const compatibleQzOptions = getCompatibleQzOptions(normalizedInput);
  const qzModel = ensureQzDefaults(inputData.qz_model, normalizedInput);
  const curveRequests = ensureCurveRequestsDefaults(normalizedInput);
  const tipLayer = getTipLayer(normalizedInput);

  container.innerHTML = `
    <div class="form-grid">
         <div class="form-section">
            <h3>Project</h3>

            <label>
                Project name
                <input
                    id="project-name"
                    type="text"
                    value="${escapeHtml(inputData.project_name ?? '')}"
                    placeholder="e.g. Offshore Wind Farm A"
                />
            </label>

            <label>
                Analysis name
                <input
                    id="analysis-name"
                    type="text"
                    value="${escapeHtml(inputData.analysis_name ?? '')}"
                    placeholder="e.g. Pile A1 - ULS"
                />
            </label>
        </div>
      <div class="form-section">
        <h3>Pile</h3>

        <label>
          Length, L (m)
          <input
            id="pile-length"
            type="number"
            step="any"
            value="${escapeHtml(inputData.pile?.L ?? '')}"
          />
        </label>

        <label>
          Diameter, D (m)
          <input
            id="pile-diameter"
            type="number"
            step="any"
            value="${escapeHtml(inputData.pile?.D ?? '')}"
          />
        </label>

        <label>
          Young's modulus, E (kPa)
          <input
            id="pile-E"
            type="number"
            step="any"
            value="${escapeHtml(inputData.pile?.E ?? '')}"
          />
        </label>

        <label>
          Pile type
          <select id="pile-type">
            ${renderOptions(['BORED', 'DRIVEN'], inputData.pile?.type ?? 'BORED')}
          </select>
        </label>
      </div>

      <div class="form-section">
        <h3>Water</h3>

        <label>
          Groundwater level, gwl_z (m)
          <input
            id="water-gwl-z"
            type="number"
            step="any"
            value="${escapeHtml(inputData.water?.gwl_z ?? 0)}"
          />
        </label>

        <label>
          gamma_w (kN/m³)
          <input
            id="water-gamma-w"
            type="number"
            step="any"
            value="${escapeHtml(inputData.water?.gamma_w ?? 9.81)}"
          />
        </label>
      </div>

      <div class="form-section">
        <h3>Load</h3>

        <label>
          Head load, P_head (kN)
          <input
            id="load-phead"
            type="number"
            step="any"
            value="${escapeHtml(inputData.load?.P_head ?? 0)}"
          />
        </label>
      </div>

      <div class="form-section">
        <h3>Analysis</h3>

        <label>
          Number of elements
          <input
            id="analysis-nelem"
            type="number"
            step="1"
            value="${escapeHtml(inputData.analysis?.n_elem ?? 50)}"
          />
        </label>

        <label>
          tol_disp
          <input
            id="analysis-tol-disp"
            type="number"
            step="any"
            value="${escapeHtml(inputData.analysis?.tol_disp ?? 1e-6)}"
          />
        </label>

        <label>
          max_iter
          <input
            id="analysis-max-iter"
            type="number"
            step="1"
            value="${escapeHtml(inputData.analysis?.max_iter ?? 50)}"
          />
        </label>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>Layers</h3>
          <button type="button" id="add-layer-btn" class="btn">Add layer</button>
        </div>

        ${layers.length > 0
          ? renderLayerGeometryTable(layers)
          : `<div class="placeholder-box">No layers defined</div>`}
      </div>

      <div class="form-section">
        <h3>t-z models by layer</h3>

        <div class="layers-container">
          ${
            layers.length > 0
              ? layers.map((layer, index) => renderLayerModelCard(layer, index)).join('')
              : `<div class="placeholder-box">No layers defined</div>`
          }
        </div>
      </div>

      <div class="form-section">
        <h3>P-Q / q-z</h3>

        <div class="placeholder-box" style="margin-bottom: 12px;">
          Tip layer: <strong>${escapeHtml(tipLayer?.name ?? 'Not defined')}</strong><br>
          Compatible q-z models: <strong>${compatibleQzOptions.join(', ')}</strong>
        </div>

        <label>
          q-z model
          <select id="qz-model-name">
            ${renderOptions(compatibleQzOptions, qzModel.name)}
          </select>
        </label>

        <div class="model-params-box">
          <div class="model-params-title">q-z parameters</div>
          <div id="qz-params-container">
            ${renderQzParamsEditor(qzModel, normalizedInput)}
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>t-z curves at selected depths</h3>
          <button type="button" id="add-curve-depth-btn" class="btn">Add depth</button>
        </div>

        <div class="placeholder-box" style="margin-bottom: 12px;">
          Curve displacement range: 10% of pile diameter. The P-Q curve at the pile tip is always calculated.
        </div>

        ${curveRequests.tz_depths.length > 0
          ? renderCurveDepthsTable(curveRequests.tz_depths)
          : `<div class="placeholder-box">No selected depths</div>`}
      </div>
    </div>
  `;

  enhanceInputSections(container, previousOpenSections);
}

function updateProfileTypeInState(currentInput, layerIndex, fieldName, nextType) {
  const layer = currentInput.layers?.[layerIndex];
  if (!layer) return;

  if (!layer.tz_params) layer.tz_params = {};

  const existing = ensureProfile(layer.tz_params[fieldName], 0);

  if (nextType === 'linear_layer') {
    layer.tz_params[fieldName] = {
      type: 'linear_layer',
      top: existing.type === 'const' ? Number(existing.value ?? 0) : Number(existing.top ?? 0),
      bot: existing.type === 'const' ? Number(existing.value ?? 0) : Number(existing.bot ?? 0),
    };
  } else {
    layer.tz_params[fieldName] = {
      type: 'const',
      value:
        existing.type === 'const'
          ? Number(existing.value ?? 0)
          : Number(existing.top ?? 0),
    };
  }
}

function syncQzModelWithTipLayer(currentInput) {
  const compatible = getCompatibleQzOptions(currentInput);
  const currentName = currentInput?.qz_model?.name;

  if (!currentInput.qz_model) {
    currentInput.qz_model = {
      name: compatible[0] ?? 'API_QZ_CLAY',
      params: getDefaultQzParams(compatible[0] ?? 'API_QZ_CLAY'),
    };
    return;
  }

  if (!compatible.includes(currentName)) {
    const nextName = compatible[0] ?? 'API_QZ_CLAY';
    currentInput.qz_model = {
      name: nextName,
      params: getDefaultQzParams(nextName),
    };
  }
}

function syncPileGeometryFromDom(currentInput) {
  if (!currentInput.pile) currentInput.pile = {};

  const pileLength = Number(document.getElementById('pile-length')?.value);
  const pileDiameter = Number(document.getElementById('pile-diameter')?.value);
  const pileE = Number(document.getElementById('pile-E')?.value);
  const pileType = document.getElementById('pile-type')?.value;

  if (Number.isFinite(pileLength)) currentInput.pile.L = pileLength;
  if (Number.isFinite(pileDiameter)) currentInput.pile.D = pileDiameter;
  if (Number.isFinite(pileE)) currentInput.pile.E = pileE;
  if (pileType) currentInput.pile.type = pileType;
}

function syncLayerGeometryFromDom(currentInput) {
  const rows = document.querySelectorAll('[data-layer-geometry-table] tbody tr');

  rows.forEach((row, index) => {
    const layer = currentInput.layers?.[index];
    if (!layer) return;

    const name = row.querySelector('[data-layer-field="name"]')?.value?.trim();
    const zTop = Number(row.querySelector('[data-layer-field="z_top"]')?.value);
    const zBot = Number(row.querySelector('[data-layer-field="z_bot"]')?.value);

    layer.name = name || `Layer ${index + 1}`;
    if (Number.isFinite(zTop)) layer.z_top = zTop;
    if (Number.isFinite(zBot)) layer.z_bot = zBot;
  });
}

function syncGeometryAndRefresh(container, currentInput) {
  syncBasicInputFieldsFromDom(currentInput);
  syncPileGeometryFromDom(currentInput);
  syncLayerGeometryFromDom(currentInput);
  syncQzModelWithTipLayer(currentInput);
  currentInput.curve_requests = ensureCurveRequestsDefaults(currentInput);
  rerenderInputForm(container, currentInput);
}

export function bindLayerEditor(container, currentInput) {
  currentInput.curve_requests = ensureCurveRequestsDefaults(currentInput);

  const tipAffectingInputs = container.querySelectorAll(
    '#pile-length, #pile-diameter, #pile-E, #pile-type'
  );
  tipAffectingInputs.forEach((input) => {
    input.addEventListener('change', () => {
      syncGeometryAndRefresh(container, currentInput);
    });
  });

  const addLayerBtn = container.querySelector('#add-layer-btn');
  if (addLayerBtn) {
    addLayerBtn.addEventListener('click', () => {
      syncCurrentInputFromDom(currentInput);

      if (!Array.isArray(currentInput.layers)) {
        currentInput.layers = [];
      }

      const previousLayer =
        currentInput.layers.length > 0
          ? currentInput.layers[currentInput.layers.length - 1]
          : null;

      currentInput.layers.push(
        getDefaultLayer(previousLayer, currentInput.layers.length)
      );

      syncQzModelWithTipLayer(currentInput);
      rerenderInputForm(container, currentInput);
    });
  }

  const removeButtons = container.querySelectorAll('[data-remove-layer]');
  removeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      syncCurrentInputFromDom(currentInput);

      const index = Number(button.dataset.removeLayer);
      if (Number.isNaN(index)) return;

      currentInput.layers.splice(index, 1);

      currentInput.layers = currentInput.layers.map((layer, i) => ({
        ...layer,
        name: layer.name || `Layer ${i + 1}`,
      }));

      syncQzModelWithTipLayer(currentInput);
      rerenderInputForm(container, currentInput);
    });
  });

  const modelSelects = container.querySelectorAll('[data-layer-field="tz_model"]');
  modelSelects.forEach((select) => {
    select.addEventListener('change', (event) => {
      syncBasicInputFieldsFromDom(currentInput);

      const index = Number(event.target.dataset.layerIndex);
      const model = event.target.value;

      if (Number.isNaN(index)) return;
      if (!currentInput.layers?.[index]) return;

      currentInput.layers[index].tz_model = model;
      currentInput.layers[index].tz_params = getDefaultTzParams(model);

      syncQzModelWithTipLayer(currentInput);
      rerenderInputForm(container, currentInput);
    });
  });

  const profileTypeSelects = container.querySelectorAll('[data-param-field$=".__profile_type"]');
  profileTypeSelects.forEach((select) => {
    select.addEventListener('change', (event) => {
      syncBasicInputFieldsFromDom(currentInput);

      const index = Number(event.target.dataset.layerIndex);
      const fullField = event.target.dataset.paramField;
      const fieldName = fullField.replace('.__profile_type', '');
      const nextType = event.target.value;

      updateProfileTypeInState(currentInput, index, fieldName, nextType);

      rerenderInputForm(container, currentInput);
    });
  });

  const emModeSelects = container.querySelectorAll('[data-param-field="Em_mode"]');
  emModeSelects.forEach((select) => {
    select.addEventListener('change', (event) => {
      syncBasicInputFieldsFromDom(currentInput);

      const index = Number(event.target.dataset.layerIndex);
      const nextMode = event.target.value;

      if (Number.isNaN(index)) return;
      if (!currentInput.layers?.[index]?.tz_params) return;

      const params = currentInput.layers[index].tz_params;
      params.Em_mode = nextMode;

      if (nextMode === 'direct') {
        params.Em = ensureProfile(params.Em, 100000);
        delete params.em_factor;
      } else {
        params.em_factor = params.em_factor === undefined ? 200 : params.em_factor;
        delete params.Em;
      }

      rerenderInputForm(container, currentInput);
    });
  });

  const qzModelSelect = container.querySelector('#qz-model-name');
  if (qzModelSelect) {
    qzModelSelect.addEventListener('change', (event) => {
      syncBasicInputFieldsFromDom(currentInput);

      const model = event.target.value;

      currentInput.qz_model = {
        name: model,
        params: getDefaultQzParams(model),
      };

      rerenderInputForm(container, currentInput);
    });
  }

  const addCurveDepthBtn = container.querySelector('#add-curve-depth-btn');
  if (addCurveDepthBtn) {
    addCurveDepthBtn.addEventListener('click', () => {
      syncCurrentInputFromDom(currentInput);

      const pileLength = Number(currentInput?.pile?.L ?? 0);
      const existingDepths = currentInput.curve_requests.tz_depths;
      const nextDepth =
        pileLength > 0
          ? Math.min(pileLength, existingDepths.length + 1)
          : existingDepths.length + 1;

      existingDepths.push(nextDepth);
      rerenderInputForm(container, currentInput);
    });
  }

  const curveDepthInputs = container.querySelectorAll('[data-curve-depth-index]');
  curveDepthInputs.forEach((input) => {
    input.addEventListener('change', (event) => {
      const index = Number(event.target.dataset.curveDepthIndex);
      const pileLength = Number(currentInput?.pile?.L ?? 0);
      const rawValue = Number(event.target.value);

      if (Number.isNaN(index) || !Number.isFinite(rawValue)) return;

      const clampedValue =
        pileLength > 0
          ? Math.min(Math.max(0, rawValue), pileLength)
          : Math.max(0, rawValue);

      currentInput.curve_requests.tz_depths[index] = clampedValue;
      rerenderInputForm(container, currentInput);
    });
  });

  const removeCurveDepthButtons = container.querySelectorAll('[data-remove-curve-depth]');
  removeCurveDepthButtons.forEach((button) => {
    button.addEventListener('click', () => {
      syncCurrentInputFromDom(currentInput);

      const index = Number(button.dataset.removeCurveDepth);
      if (Number.isNaN(index)) return;

      currentInput.curve_requests.tz_depths.splice(index, 1);
      rerenderInputForm(container, currentInput);
    });
  });

  const layerGeometryInputs = container.querySelectorAll(
    '[data-layer-field="name"], [data-layer-field="z_top"], [data-layer-field="z_bot"]'
  );

  layerGeometryInputs.forEach((input) => {
    input.addEventListener('change', () => {
      syncGeometryAndRefresh(container, currentInput);
    });
  });
}

function readProfileFromRoot(root, fieldName) {
  const type =
    root.querySelector(`[data-param-field="${fieldName}.__profile_type"]`)?.value ?? 'const';

  if (type === 'linear_layer') {
    return {
      type: 'linear_layer',
      top: Number(
        root.querySelector(`[data-param-field="${fieldName}.__top"]`)?.value ?? 0
      ),
      bot: Number(
        root.querySelector(`[data-param-field="${fieldName}.__bot"]`)?.value ?? 0
      ),
    };
  }

  return {
    type: 'const',
    value: Number(
      root.querySelector(`[data-param-field="${fieldName}.__value"]`)?.value ?? 0
    ),
  };
}

function readOptionalNumberFromRoot(root, fieldName) {
  const raw = root?.querySelector(`[data-param-field="${fieldName}"]`)?.value ?? '';
  if (raw === '') return undefined;
  return Number(raw);
}

function readTzParamsFromLayerIndex(layerIndex, model) {
  const card = document.querySelector(`.layer-card[data-layer-index="${layerIndex}"]`);

  switch (model) {
    case 'API_CLAY': {
      const result = {
        su: readProfileFromRoot(card, 'su'),
      };
      const alphaOverride = readOptionalNumberFromRoot(card, 'alpha_override');
      const residualFactor = readOptionalNumberFromRoot(card, 'residual_factor');
      if (alphaOverride !== undefined) result.alpha_override = alphaOverride;
      if (residualFactor !== undefined) result.residual_factor = residualFactor;
      return result;
    }

    case 'API_SAND': {
      const result = {
        phi_deg: readProfileFromRoot(card, 'phi_deg'),
        delta_phi_ratio: readProfileFromRoot(card, 'delta_phi_ratio'),
      };
      const kOverride = readOptionalNumberFromRoot(card, 'K_override');
      if (kOverride !== undefined) result.K_override = kOverride;
      return result;
    }

    case 'REESE_ONEILL_CLAY': {
      const result = {
        su: readProfileFromRoot(card, 'su'),
      };
      const alphaOverride = readOptionalNumberFromRoot(card, 'alpha_override');
      if (alphaOverride !== undefined) result.alpha_override = alphaOverride;
      return result;
    }

    case 'REESE_ONEILL_SAND':
      return {
        phi_deg: readProfileFromRoot(card, 'phi_deg'),
        delta_phi_ratio: readProfileFromRoot(card, 'delta_phi_ratio'),
        K: readProfileFromRoot(card, 'K'),
      };

    case 'ONEILL_HASSAN_ROCK': {
      const result = {
        UCS: readProfileFromRoot(card, 'UCS'),
      };

      const emMode =
        card.querySelector(`[data-param-field="Em_mode"]`)?.value ?? 'factor';

      if (emMode === 'direct') {
        result.Em = readProfileFromRoot(card, 'Em');
      } else {
        const emFactor = readOptionalNumberFromRoot(card, 'em_factor');
        if (emFactor !== undefined) result.em_factor = emFactor;
      }

      const rockShaftFactor = readOptionalNumberFromRoot(card, 'rock_shaft_factor');
      const tultOverride = readOptionalNumberFromRoot(card, 'tult_override');

      if (rockShaftFactor !== undefined) result.rock_shaft_factor = rockShaftFactor;
      if (tultOverride !== undefined) result.tult_override = tultOverride;

      return result;
    }

    default:
      return {};
  }
}

function readQzParamsFromDom(model) {
  const root = document.getElementById('qz-params-container');

  switch (model) {
    case 'API_QZ_CLAY': {
      const result = {};
      const value = readOptionalNumberFromRoot(root, 'Nc_override');
      if (value !== undefined) result.Nc_override = value;
      return result;
    }

    case 'API_QZ_SAND': {
      const result = {};
      const value = readOptionalNumberFromRoot(root, 'Nq_override');
      if (value !== undefined) result.Nq_override = value;
      return result;
    }

    case 'REESE_ONEILL_QZ_CLAY': {
      const result = {};
      const value = readOptionalNumberFromRoot(root, 'Nc_override');
      if (value !== undefined) result.Nc_override = value;
      return result;
    }

    case 'REESE_ONEILL_QZ_SAND': {
      const result = {};
      const value = readOptionalNumberFromRoot(root, 'Nq_override');
      if (value !== undefined) result.Nq_override = value;
      return result;
    }

    case 'ROCK_QZ_SIMPLE': {
      const result = {};
      const rockBaseFactor = readOptionalNumberFromRoot(root, 'rock_base_factor');
      const qUltOverride = readOptionalNumberFromRoot(root, 'Qult_override');

      if (rockBaseFactor !== undefined) result.rock_base_factor = rockBaseFactor;
      if (qUltOverride !== undefined) result.Qult_override = qUltOverride;

      return result;
    }

    default:
      return {};
  }
}

function readLayerRows() {
  const rows = document.querySelectorAll('[data-layer-geometry-table] tbody tr');

  return Array.from(rows).map((row, index) => {
    const getValue = (fieldName) =>
      row.querySelector(`[data-layer-field="${fieldName}"]`)?.value ?? '';

    return {
      name: getValue('name') || `Layer ${index + 1}`,
      z_top: Number(getValue('z_top')),
      z_bot: Number(getValue('z_bot')),
    };
  });
}

function readCurveDepthsFromDom(pileLength) {
  const inputs = document.querySelectorAll('[data-curve-depth-index]');

  return Array.from(inputs)
    .map((input) => Number(input.value))
    .filter((depth) => Number.isFinite(depth))
    .map((depth) =>
      pileLength > 0
        ? Math.min(Math.max(0, depth), pileLength)
        : Math.max(0, depth)
    );
}

export function readBaseInputForm() {
  const layerRows = readLayerRows();
  const pileLength = Number(document.getElementById('pile-length').value);
  const pileDiameter = Number(document.getElementById('pile-diameter').value);

  const layers = layerRows.map((row, index) => {
    const currentModel =
      document.querySelector(`.layer-card[data-layer-index="${index}"] [data-layer-field="tz_model"]`)?.value
      ?? 'API_CLAY';

    const gammaUnsat =
      Number(
        document.querySelector(`.layer-card[data-layer-index="${index}"] [data-layer-field="gamma_unsat"]`)?.value
      ) || 0;

    const gammaSat =
      Number(
        document.querySelector(`.layer-card[data-layer-index="${index}"] [data-layer-field="gamma_sat"]`)?.value
      ) || 0;

    return {
      name: row.name,
      z_top: row.z_top,
      z_bot: row.z_bot,
      gamma_unsat: gammaUnsat,
      gamma_sat: gammaSat,
      tz_model: currentModel,
      tz_params: readTzParamsFromLayerIndex(index, currentModel),
    };
  });

  const provisionalInput = {
    pile: {
      L: Number(document.getElementById('pile-length').value),
    },
    layers,
  };

  const compatibleQzOptions = getCompatibleQzOptions(provisionalInput);
  const qzModelNameRaw =
    document.getElementById('qz-model-name')?.value ?? compatibleQzOptions[0] ?? 'API_QZ_CLAY';

  const qzModelName = compatibleQzOptions.includes(qzModelNameRaw)
    ? qzModelNameRaw
    : compatibleQzOptions[0] ?? 'API_QZ_CLAY';

  return {
    units: 'kN-m-kPa',
    project_name: document.getElementById('project-name')?.value ?? '',
    analysis_name: document.getElementById('analysis-name')?.value ?? '',
    pile: {
      L: pileLength,
      D: pileDiameter,
      E: Number(document.getElementById('pile-E').value),
      type: document.getElementById('pile-type').value,
      base: 'CLOSED',
    },
    water: {
      gwl_z: Number(document.getElementById('water-gwl-z').value),
      gamma_w: Number(document.getElementById('water-gamma-w').value),
    },
    analysis: {
      n_elem: Number(document.getElementById('analysis-nelem').value),
      tol_disp: Number(document.getElementById('analysis-tol-disp').value),
      max_iter: Number(document.getElementById('analysis-max-iter').value),
    },
    load: {
      P_head: Number(document.getElementById('load-phead').value),
    },
    qz_model: {
      name: qzModelName,
      params: readQzParamsFromDom(qzModelName),
    },
    curve_requests: {
      tz_depths: readCurveDepthsFromDom(pileLength),
      include_qz: true,
      n_points: 60,
      w_max_m: 0.1 * pileDiameter,
      qz_w_max_m: 0.2 * pileDiameter,
    },
    layers,
  };
}

export function setSolverStatus(message, type = 'neutral') {
  const el = document.getElementById('solver-status');
  if (!el) return;

  el.innerHTML = `<div class="status-pill status-${type}">${message}</div>`;
}
