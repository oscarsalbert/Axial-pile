export function renderAppSkeleton(app) {
  app.innerHTML = `
    <h1>Axial Pile Tool</h1>
    <button id="run">Run Solver</button>
    <pre id="output"></pre>
  `
}

export function renderLoading() {
  document.getElementById('output').textContent = 'Running...'
}

export function renderResult(resultText) {
  document.getElementById('output').textContent = resultText
}

export function renderError(err) {
  document.getElementById('output').textContent = `ERROR: ${err.message || err}`
}