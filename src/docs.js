import readmeMarkdown from '../README.md?raw';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function renderTable(lines) {
  const rows = lines
    .filter((line) => !/^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
    );

  if (rows.length === 0) return '';

  const [header, ...body] = rows;

  return `
    <table>
      <thead>
        <tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${body
          .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`)
          .join('')}
      </tbody>
    </table>
  `;
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let listItems = [];
  let tableLines = [];
  let codeLines = [];
  let inCode = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    html.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
    listItems = [];
  };

  const flushTable = () => {
    if (tableLines.length === 0) return;
    html.push(renderTable(tableLines));
    tableLines = [];
  };

  const flushCode = () => {
    if (codeLines.length === 0) return;
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    codeLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (line.trim().startsWith('|')) {
      flushList();
      tableLines.push(line);
      continue;
    }

    flushTable();

    if (line.startsWith('- ')) {
      listItems.push(line.slice(2));
      continue;
    }

    flushList();

    if (!line.trim()) continue;

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 5);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      html.push(`<p>${inlineMarkdown(numbered[1])}</p>`);
      continue;
    }

    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  flushList();
  flushTable();
  flushCode();

  return html.join('');
}

export function initDocs() {
  const button = document.getElementById('docs-btn');
  const modal = document.getElementById('docs-modal');
  const content = document.getElementById('docs-content');

  if (!button || !modal || !content) return;

  content.innerHTML = markdownToHtml(readmeMarkdown);

  const open = () => {
    modal.classList.add('docs-modal-open');
    modal.setAttribute('aria-hidden', 'false');
  };

  const close = () => {
    modal.classList.remove('docs-modal-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  button.addEventListener('click', open);

  modal.querySelectorAll('[data-docs-close]').forEach((el) => {
    el.addEventListener('click', close);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('docs-modal-open')) {
      close();
    }
  });
}
