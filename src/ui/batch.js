import { state, elements } from '../state.js';
import { escapeHtml } from '../utils.js';
import { detectPipeline, isFormatValidForPipeline } from '../pipelines/registry.js';

export function getFileFormat(index) {
  if (state.usePerFileFormats && state.perFileFormats[index]) {
    return state.perFileFormats[index];
  }
  return state.selectedFormat || '';
}

export function renderBatchConfirm() {
  const hasFormat = state.selectedFormat ||
    (state.usePerFileFormats && Object.values(state.perFileFormats).some(Boolean));

  if (!hasFormat || state.files.length === 0) {
    elements.batchConfirm.classList.add('hidden');
    return;
  }

  elements.batchConfirm.classList.remove('hidden');
  const list = elements.batchList;
  list.innerHTML = '';

  let convertCount = 0;
  let skipCount = 0;

  state.files.forEach((file, i) => {
    const pipeline = detectPipeline(file);
    const fmt = getFileFormat(i);
    const canConvert = fmt && pipeline && isFormatValidForPipeline(pipeline, fmt);

    if (canConvert) convertCount++;
    else skipCount++;

    const row = document.createElement('div');
    row.className = 'bc-row' + (canConvert ? '' : ' bc-skip');

    const targetLabel = fmt ? fmt.toUpperCase() : '—';
    const statusIcon = canConvert ? '✓' : '—';

    row.innerHTML = `
      <span class="bc-status ${canConvert ? 'bc-ok' : 'bc-na'}">${statusIcon}</span>
      <span class="bc-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
      <span class="bc-arrow">→</span>
      <span class="bc-target">${canConvert ? '.' + targetLabel : 'skip'}</span>
    `;
    list.appendChild(row);
  });

  elements.batchStats.textContent =
    `${convertCount} to convert` + (skipCount ? `, ${skipCount} skipped` : '');

  const btnText = elements.convertBtn.querySelector('.btn-text');
  if (btnText) {
    btnText.textContent = convertCount > 0
      ? `Convert ${convertCount} file${convertCount !== 1 ? 's' : ''}`
      : 'Convert Files';
  }
}

export function updateConvertButton() {
  let canConvert = false;
  if (state.files.length > 0) {
    for (let i = 0; i < state.files.length; i++) {
      const fmt = getFileFormat(i);
      const pipeline = detectPipeline(state.files[i]);
      if (fmt && pipeline && isFormatValidForPipeline(pipeline, fmt)) {
        canConvert = true;
        break;
      }
    }
  }
  elements.convertBtn.disabled = !canConvert;
}
