export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) {
    return '-';
  }

  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toFixed(digits);
}

function formatTick(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  if (Math.abs(num - Math.round(num)) < 1e-9) return String(Math.round(num));
  if (Math.abs(num * 10 - Math.round(num * 10)) < 1e-9) return num.toFixed(1);
  return num.toFixed(2);
}

const COLORS = [
  '#2563eb',
  '#0ea5e9',
  '#475569',
  '#7c8aa5',
  '#1d4ed8',
  '#38bdf8',
  '#64748b',
  '#93a4bd',
];

export function getCurveColor(index) {
  return COLORS[index % COLORS.length];
}

function getFiniteValues(values) {
  return values.map(Number).filter((value) => Number.isFinite(value));
}

function getExtent(values, fallbackMin = 0, fallbackMax = 1) {
  const finiteValues = getFiniteValues(values);
  if (finiteValues.length === 0) return [fallbackMin, fallbackMax];

  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);

  if (Math.abs(max - min) < 1e-12) {
    const delta = Math.abs(max || 1) * 0.1;
    min -= delta;
    max += delta;
  }

  return [min, max];
}

function padExtent([min, max], padding = 0.06) {
  const span = max - min;
  return [min - span * padding, max + span * padding];
}

function extendExtentFromZero(rawMax, padding = 0.06) {
  const max = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 1;
  const paddedMax = max <= 0 ? 1 : max * (1 + padding);
  return [0, paddedMax];
}

function niceNumber(value, round) {
  if (!Number.isFinite(value) || value <= 0) return 1;

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction;

  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;

  return niceFraction * 10 ** exponent;
}

function getNiceAxisFromZero(rawMax, targetTicks = 5) {
  const max = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 1;
  if (max <= 0) return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };

  const range = niceNumber(max, false);
  const step = niceNumber(range / Math.max(1, targetTicks - 1), true);
  const axisMax = Math.ceil(max / step) * step;
  const ticks = [];

  for (let value = 0; value <= axisMax + step * 0.5; value += step) {
    ticks.push(Math.abs(value) < 1e-12 ? 0 : value);
  }

  return { min: 0, max: axisMax, ticks };
}

function getFixedAxisFromZero(rawMax, targetTicks = 5) {
  const max = Number.isFinite(rawMax) ? Math.max(0, rawMax) : 1;
  if (max <= 0) return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };

  const ticks = [];
  const step = niceNumber(max / Math.max(1, targetTicks), true);

  for (let value = 0; value < max - step * 0.25; value += step) {
    ticks.push(Math.abs(value) < 1e-12 ? 0 : value);
  }

  if (ticks.length === 0 || Math.abs(ticks[ticks.length - 1] - max) > 1e-9) {
    ticks.push(max);
  }

  return { min: 0, max, ticks };
}

function makeTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || count < 2) return [];

  const ticks = [];
  const step = (max - min) / (count - 1);

  for (let i = 0; i < count; i += 1) {
    ticks.push(min + step * i);
  }

  return ticks;
}

export function lineChartSvg({
  datasets,
  xLabel,
  yLabel,
  reverseY = false,
  showLegend = true,
  yStartsAtZero = false,
  yMaxOverride = null,
  width = 760,
  height = 360,
}) {
  const plot = {
    left: 68,
    right: 24,
    top: 24,
    bottom: showLegend ? 82 : 54,
  };

  const allPoints = datasets.flatMap((dataset) => dataset.data ?? []);
  const [rawXMin, rawXMax] = getExtent(allPoints.map((point) => point.x));
  const [rawYMin, rawYMax] = getExtent(allPoints.map((point) => point.y));
  const xAxis = getNiceAxisFromZero(rawXMax);
  const yAxis = yStartsAtZero
    ? getFixedAxisFromZero(yMaxOverride ?? rawYMax)
    : null;
  const [xMin, xMax] = [xAxis.min, xAxis.max];
  const [yMin, yMax] = yAxis
    ? [yAxis.min, yAxis.max]
    : padExtent([rawYMin, rawYMax], 0.05);

  const innerWidth = width - plot.left - plot.right;
  const innerHeight = height - plot.top - plot.bottom;

  const scaleX = (value) => plot.left + ((value - xMin) / (xMax - xMin)) * innerWidth;
  const scaleY = (value) => {
    const ratio = (value - yMin) / (yMax - yMin);
    return reverseY
      ? plot.top + ratio * innerHeight
      : plot.top + (1 - ratio) * innerHeight;
  };

  const xTicks = xAxis.ticks;
  const yTicks = yAxis?.ticks ?? makeTicks(yMin, yMax);

  const grid = `
    ${xTicks.map((tick) => {
      const x = scaleX(tick);
      return `
        <line x1="${x}" y1="${plot.top}" x2="${x}" y2="${plot.top + innerHeight}" class="svg-chart-grid" />
        <text x="${x}" y="${plot.top + innerHeight + 18}" text-anchor="middle" class="svg-chart-tick">${formatTick(tick)}</text>
      `;
    }).join('')}
    ${yTicks.map((tick) => {
      const y = scaleY(tick);
      return `
        <line x1="${plot.left}" y1="${y}" x2="${plot.left + innerWidth}" y2="${y}" class="svg-chart-grid" />
        <text x="${plot.left - 8}" y="${y + 4}" text-anchor="end" class="svg-chart-tick">${formatTick(tick)}</text>
      `;
    }).join('')}
  `;

  const series = datasets.map((dataset) => {
    const points = (dataset.data ?? [])
      .filter((point) => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
      .map((point) => ({
        x: scaleX(Number(point.x)),
        y: scaleY(Number(point.y)),
      }));

    const polyline = dataset.showLine === false || points.length < 2
      ? ''
      : `<polyline points="${points.map((point) => `${point.x},${point.y}`).join(' ')}" class="svg-chart-line" stroke="${dataset.color}" />`;

    const circles = points
      .filter(() => dataset.pointRadius > 0)
      .map((point, index) => {
        const rawPoint = (dataset.data ?? [])[index] ?? {};
        const tooltipAttrs = `
          data-chart-point="true"
          data-series="${escapeHtml(dataset.label)}"
          data-x="${formatTick(rawPoint.x)}"
          data-y="${formatTick(rawPoint.y)}"
          data-x-label="${escapeHtml(xLabel)}"
          data-y-label="${escapeHtml(yLabel)}"
        `;
        return `
          <circle
            cx="${point.x}"
            cy="${point.y}"
            r="${dataset.pointRadius}"
            fill="${dataset.color}"
            class="svg-chart-point"
            ${tooltipAttrs}
          />
          <circle
            cx="${point.x}"
            cy="${point.y}"
            r="${Math.max(6, dataset.pointRadius + 3)}"
            fill="transparent"
            class="svg-chart-hit-point"
            ${tooltipAttrs}
          />
        `;
      })
      .join('');

    return `${polyline}${circles}`;
  }).join('');

  const legend = showLegend
    ? `
      <g transform="translate(${plot.left}, ${height - 48})">
        ${datasets
          .filter((dataset) => !dataset.hideFromLegend)
          .map((dataset, index) => {
            const x = (index % 2) * 310;
            const y = Math.floor(index / 2) * 20;
            return `
              <g transform="translate(${x}, ${y})">
                <line x1="0" y1="8" x2="22" y2="8" stroke="${dataset.color}" stroke-width="2" />
                <text x="30" y="12" class="svg-chart-legend">${escapeHtml(dataset.label)}</text>
              </g>
            `;
          })
          .join('')}
      </g>
    `
    : '';

  return `
    <svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" class="svg-chart-bg" />
      ${grid}
      <line x1="${plot.left}" y1="${plot.top + innerHeight}" x2="${plot.left + innerWidth}" y2="${plot.top + innerHeight}" class="svg-chart-axis" />
      <line x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${plot.top + innerHeight}" class="svg-chart-axis" />
      ${series}
      <text x="${plot.left + innerWidth / 2}" y="${height - (showLegend ? 14 : 12)}" text-anchor="middle" class="svg-chart-label">${escapeHtml(xLabel)}</text>
      <text x="18" y="${plot.top + innerHeight / 2}" transform="rotate(-90 18 ${plot.top + innerHeight / 2})" text-anchor="middle" class="svg-chart-label">${escapeHtml(yLabel)}</text>
      ${legend}
    </svg>
  `;
}

export function depthChartSvg(xData, yData, label, xAxisTitle, depthMax = null) {
  return lineChartSvg({
    datasets: [
      {
        label,
        color: getCurveColor(0),
        data: (xData ?? []).map((x, index) => ({
          x: Number(x),
          y: Number(yData?.[index] ?? 0),
        })),
        pointRadius: 2,
      },
    ],
    xLabel: xAxisTitle,
    yLabel: 'Depth (m)',
    reverseY: true,
    showLegend: false,
    yStartsAtZero: true,
    yMaxOverride: depthMax,
  });
}

export function buildTzCurveDatasets(tzCurves) {
  return (tzCurves ?? []).flatMap((curve, index) => {
    const color = getCurveColor(index);
    const label = `z = ${formatNumber(curve.z, 2)} m - ${curve.tz_model}`;

    return [
      {
        label,
        color,
        data: (curve.w ?? []).map((w, i) => ({
          x: Number(w) * 1000,
          y: Number(curve.t?.[i] ?? 0),
        })),
        pointRadius: 0,
      },
      {
        label: `${label} mobilized`,
        color,
        data: [
          {
            x: Number(curve.w_mobilized ?? 0) * 1000,
            y: Number(curve.t_mobilized ?? 0),
          },
        ],
        pointRadius: 4,
        showLine: false,
        hideFromLegend: true,
      },
    ];
  });
}

export function buildQzCurveDatasets(qzCurve) {
  const label = `${qzCurve?.qz_model ?? 'q-z'} at z = ${formatNumber(qzCurve?.z_tip, 2)} m`;

  return [
    {
      label,
      color: getCurveColor(0),
      data: (qzCurve?.w ?? []).map((w, i) => ({
        x: Number(w) * 1000,
        y: Number(qzCurve?.Q?.[i] ?? 0),
      })),
      pointRadius: 0,
    },
    {
      label: `${label} mobilized`,
      color: '#e76f51',
      data: [
        {
          x: Number(qzCurve?.w_mobilized ?? 0) * 1000,
          y: Number(qzCurve?.Q_mobilized ?? 0),
        },
      ],
      pointRadius: 4,
      showLine: false,
      hideFromLegend: true,
    },
  ];
}

export function graphDefinitions(result) {
  const nodes = result?.results?.nodes ?? {};
  const elements = result?.results?.elements ?? {};
  const tzCurves = result?.curves?.tz ?? [];
  const qzCurve = result?.curves?.qz;
  const depthMax = Number(result?.results?.tip?.z_tip ?? Math.max(...getFiniteValues(nodes.z ?? [])));

  const graphs = [
    {
      id: 'displacement',
      title: 'Displacement vs depth',
      svg: depthChartSvg((nodes.w ?? []).map((value) => value * 1000), nodes.z ?? [], 'Displacement', 'Displacement (mm)', depthMax),
    },
    {
      id: 'axial',
      title: 'Axial force vs depth',
      svg: depthChartSvg(nodes.N ?? [], nodes.z ?? [], 'Axial force', 'Axial force (kN)', depthMax),
    },
    {
      id: 'shaft-mobilised',
      title: 'Mobilised unit shaft resistance vs depth',
      svg: depthChartSvg(elements.t ?? [], elements.z_mid ?? [], 'Mobilised unit shaft resistance', 'Mobilised unit shaft resistance (kPa)', depthMax),
    },
    {
      id: 'shaft-ultimate',
      title: 'Ultimate unit shaft resistance vs depth',
      svg: depthChartSvg(elements.tult ?? [], elements.z_mid ?? [], 'Ultimate unit shaft resistance', 'Ultimate unit shaft resistance (kPa)', depthMax),
    },
    {
      id: 'shaft-ratio',
      title: 'Mobilised / ultimate shaft resistance vs depth',
      svg: depthChartSvg((elements.t_over_tult ?? []).map((value) => value * 100), elements.z_mid ?? [], 'Mobilised / ultimate shaft resistance', 'Mobilised / ultimate shaft resistance (%)', depthMax),
    },
  ];

  if (tzCurves.length > 0) {
    graphs.push({
      id: 'tz-curves',
      title: 't-z curves at selected depths',
      svg: lineChartSvg({
        datasets: buildTzCurveDatasets(tzCurves),
        xLabel: 'Displacement (mm)',
        yLabel: 'Unit shaft resistance (kPa)',
      }),
    });
  }

  if (qzCurve) {
    graphs.push({
      id: 'qz-curve',
      title: 'P-Q curve at pile tip',
      svg: lineChartSvg({
        datasets: buildQzCurveDatasets(qzCurve),
        xLabel: 'Tip settlement (mm)',
        yLabel: 'Base resistance (kN)',
      }),
    });
  }

  return graphs;
}
