import './styles.css';

import { initPyodide, runSolver } from './pyodide.js';
import { sampleInput } from './sampleInput.js';

import {
  createAppLayout,
  renderBaseInputForm,
  readBaseInputForm,
  setSolverStatus,
  bindLayerEditor,
  renderSavedCases,
} from './ui.js';

import {
  renderResult,
  renderError,
} from './render.js';
import { renderReportControls } from './report.js';
import { initDocs } from './docs.js';
import {
  deleteCase,
  getSavedCase,
  getSavedCases,
  saveCase,
} from './savedCases.js';

const app = document.querySelector('#app');

let currentInput = structuredClone(sampleInput);
let lastRunInput = null;
let lastResult = null;

init();

async function init() {
  createAppLayout(app);
  initDocs();

  renderSavedCases(getSavedCases());
  renderInputs();
  renderReportControls(lastRunInput, lastResult);
  bindSavedCaseActions();

  try {
    setSolverStatus('Loading Pyodide...', 'warning');
    await initPyodide();
    setSolverStatus('Ready', 'neutral');
  } catch (err) {
    console.error(err);
    setSolverStatus('Pyodide failed to load', 'error');
    renderError(err);
    return;
  }

  document
    .getElementById('run-btn')
    .addEventListener('click', handleRun);

  document
    .getElementById('load-sample-btn')
    .addEventListener('click', handleLoadSample);

  document
    .getElementById('save-case-btn')
    .addEventListener('click', handleSaveCase);
}

function renderInputs() {
  const inputForm = document.getElementById('input-form');
  renderBaseInputForm(inputForm, currentInput);
  bindLayerEditor(inputForm, currentInput);
}

function refreshSavedCases() {
  renderSavedCases(getSavedCases());
  bindSavedCaseActions();
}

function isSameInput(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function handleLoadSample() {
  currentInput = structuredClone(sampleInput);
  renderInputs();
  lastRunInput = null;
  lastResult = null;
  document.getElementById('summary-output').innerHTML = '';
  document.getElementById('tables-output').innerHTML = '';
  document.getElementById('plots-output').innerHTML = '';
  renderReportControls(lastRunInput, lastResult);
  setSolverStatus('Sample loaded', 'neutral');
}

async function handleRun() {
  try {
    setSolverStatus('Running solver...', 'warning');

    const formData = readBaseInputForm();
    currentInput = structuredClone(formData);
    lastRunInput = structuredClone(formData);

    const resultRaw = await runSolver(formData);

    const result = JSON.parse(resultRaw);

    result.project_name = formData.project_name;
    result.analysis_name = formData.analysis_name;
    lastResult = structuredClone(result);

    renderResult(result);
    renderReportControls(lastRunInput, lastResult);
    setSolverStatus('Solver completed', 'success');
  } catch (err) {
    console.error(err);
    lastResult = null;
    renderReportControls(lastRunInput, lastResult);
    setSolverStatus('Solver failed', 'error');
    renderError(err);
  }
}

function handleSaveCase() {
  try {
    const formData = readBaseInputForm();
    currentInput = structuredClone(formData);

    const resultCanBeSaved = lastResult && isSameInput(formData, lastRunInput);
    const savedCase = saveCase({
      input: formData,
      result: resultCanBeSaved ? structuredClone(lastResult) : null,
    });

    refreshSavedCases();
    setSolverStatus(
      resultCanBeSaved
        ? `Saved case: ${savedCase.analysis_name}`
        : `Saved inputs: ${savedCase.analysis_name}`,
      'success'
    );
  } catch (err) {
    console.error(err);
    setSolverStatus('Case could not be saved', 'error');
  }
}

function handleLoadSavedCase(caseId) {
  const savedCase = getSavedCase(caseId);
  if (!savedCase) {
    setSolverStatus('Saved case not found', 'error');
    refreshSavedCases();
    return;
  }

  currentInput = structuredClone(savedCase.input);
  renderInputs();

  if (savedCase.result) {
    lastRunInput = structuredClone(savedCase.input);
    lastResult = structuredClone(savedCase.result);
    renderResult(lastResult);
    renderReportControls(lastRunInput, lastResult);
    setSolverStatus(`Loaded saved result: ${savedCase.analysis_name}`, 'neutral');
    return;
  }

  lastRunInput = null;
  lastResult = null;
  document.getElementById('summary-output').innerHTML = '';
  document.getElementById('tables-output').innerHTML = '';
  document.getElementById('plots-output').innerHTML = '';
  renderReportControls(lastRunInput, lastResult);
  setSolverStatus(`Loaded saved inputs: ${savedCase.analysis_name}`, 'neutral');
}

function bindSavedCaseActions() {
  document.querySelectorAll('[data-load-case]').forEach((button) => {
    button.addEventListener('click', () => {
      handleLoadSavedCase(button.dataset.loadCase);
    });
  });

  document.querySelectorAll('[data-delete-case]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteCase(button.dataset.deleteCase);
      refreshSavedCases();
      setSolverStatus('Saved case deleted', 'neutral');
    });
  });
}
