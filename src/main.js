import './style.css'
import { initPyodide, runSolver } from './pyodide.js'
import { sampleInput } from './sampleInput.js'
import {
  renderAppSkeleton,
  renderLoading,
  renderResult,
  renderError
} from './render.js'

const app = document.querySelector('#app')

renderAppSkeleton(app)

await initPyodide()

document.getElementById('run').onclick = async () => {
  try {
    renderLoading()
    const result = await runSolver(sampleInput)
    renderResult(result)
  } catch (err) {
    console.error(err)
    renderError(err)
  }
}