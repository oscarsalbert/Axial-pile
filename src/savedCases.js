const STORAGE_KEY = 'axial-pile:saved-cases:v1';

function safeParse(rawValue) {
  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function readStore() {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

function writeStore(cases) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
}

function createCaseId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCaseKey(projectName, analysisName) {
  return `${projectName || 'Untitled project'}::${analysisName || 'Untitled analysis'}`.toLowerCase();
}

export function getSavedCases() {
  return readStore().sort((a, b) => {
    const projectCompare = (a.project_name || '').localeCompare(b.project_name || '');
    if (projectCompare !== 0) return projectCompare;
    return (a.analysis_name || '').localeCompare(b.analysis_name || '');
  });
}

export function saveCase({ input, result = null }) {
  const projectName = input?.project_name?.trim() || 'Untitled project';
  const analysisName = input?.analysis_name?.trim() || 'Untitled analysis';
  const cases = readStore();
  const savedAt = new Date().toISOString();
  const key = getCaseKey(projectName, analysisName);

  const nextCase = {
    id: createCaseId(),
    project_name: projectName,
    analysis_name: analysisName,
    saved_at: savedAt,
    input: {
      ...input,
      project_name: projectName,
      analysis_name: analysisName,
    },
    result,
    summary: result?.summary ?? null,
  };

  const existingIndex = cases.findIndex((item) =>
    getCaseKey(item.project_name, item.analysis_name) === key
  );

  if (existingIndex >= 0) {
    nextCase.id = cases[existingIndex].id;
    cases[existingIndex] = nextCase;
  } else {
    cases.push(nextCase);
  }

  writeStore(cases);
  return nextCase;
}

export function deleteCase(caseId) {
  const cases = readStore().filter((item) => item.id !== caseId);
  writeStore(cases);
  return cases;
}

export function getSavedCase(caseId) {
  return readStore().find((item) => item.id === caseId) ?? null;
}
