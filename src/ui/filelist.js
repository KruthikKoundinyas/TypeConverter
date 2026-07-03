import { state, elements, MAX_FILES, MAX_TOTAL_SIZE, MAX_FILE_SIZE } from '../state.js';
import { escapeHtml, getFileExtension, formatFileSize } from '../utils.js';
import { detectPipeline, getPipelineOutputs, PIPELINES, PIPELINE_ICONS } from '../pipelines/registry.js';
import { renderBatchConfirm, updateConvertButton } from './batch.js';

function getFileLimit() {
  if (state.files.length === 0) return MAX_FILES;
  const totalSize = state.files.reduce((s, f) => s + f.size, 0);
  const avg = totalSize / state.files.length;
  if (avg < 1 * 1024 * 1024) return 100;
  if (avg < 5 * 1024 * 1024) return 50;
  return 25;
}

export function handleFiles(files) {
  const rejected = [];
  let accepted = 0;
  const limit = getFileLimit();
  const totalSize = state.files.reduce((s, f) => s + f.size, 0);

  const newFiles = Array.from(files).filter((file) => {
    if (state.files.length + accepted >= limit) {
      rejected.push(`${file.name}: limit of ${limit} files reached`);
      return false;
    }
    if (totalSize + file.size > MAX_TOTAL_SIZE) {
      rejected.push(`${file.name}: total size would exceed 500 MB`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      rejected.push(`${file.name}: exceeds 100 MB per-file limit`);
      return false;
    }
    const pipeline = detectPipeline(file);
    if (!pipeline) {
      rejected.push(`${file.name}: unsupported file type`);
      return false;
    }
    accepted++;
    return true;
  });

  if (newFiles.length === 0 && state.files.length === 0) {
    const msg = rejected.length
      ? 'No supported files found:\n' + rejected.join('\n')
      : 'Please select a supported file.';
    alert(msg);
    return;
  }

  state.files = [...state.files, ...newFiles];
  if (rejected.length > 0) {
    alert(`${newFiles.length} file(s) added, ${rejected.length} rejected:\n${rejected.slice(0, 5).join('\n')}${rejected.length > 5 ? '\n...' : ''}`);
  }

  document.dispatchEvent(new Event('tc:refresh'));
}

export function removeFile(index) {
  state.files.splice(index, 1);
  delete state.perFileFormats[index];
  const rebuilt = {};
  Object.keys(state.perFileFormats).forEach((k) => {
    const ki = parseInt(k);
    if (ki > index) rebuilt[ki - 1] = state.perFileFormats[ki];
    else rebuilt[ki] = state.perFileFormats[ki];
  });
  state.perFileFormats = rebuilt;
  document.dispatchEvent(new Event('tc:refresh'));
}

export function clearAllFiles() {
  state.files = [];
  state.perFileFormats = {};
  state.selectedFormat = null;
  state.usePerFileFormats = false;
  elements.advancedToggle.checked = false;
  document.dispatchEvent(new Event('tc:refresh'));
}

export function renderFileList() {
  const totalSize = state.files.reduce((s, f) => s + f.size, 0);
  const limit = getFileLimit();
  elements.fileListSummary.textContent =
    `${state.files.length} file${state.files.length !== 1 ? 's' : ''} (${formatFileSize(totalSize)}) — limit ${limit}`;

  const body = elements.fileListBody;
  body.innerHTML = '';

  state.files.forEach((file, i) => {
    const pipeline = detectPipeline(file);
    const icon = PIPELINE_ICONS[pipeline] || '\u{1F4CE}';
    const ext = getFileExtension(file.name).toUpperCase();

    const row = document.createElement('div');
    row.className = 'fl-row';

    let thumbHtml = `<span class="fl-icon">${icon}</span>`;
    const noNativePreview = ['heic', 'heif', 'tiff', 'tif'];
    if (pipeline === 'image' && !noNativePreview.includes(ext.toLowerCase())) {
      const url = URL.createObjectURL(file);
      thumbHtml = `<img src="${url}" class="fl-thumb" alt="" />`;
    }

    let perFileHtml = '';
    if (state.usePerFileFormats) {
      const outputs = getPipelineOutputs(pipeline);
      const selected = state.perFileFormats[i] || state.selectedFormat || '';
      perFileHtml = `<select class="fl-format" data-index="${i}">
        <option value="">--</option>
        ${outputs.map((o) => `<option value="${o.ext}"${o.ext === selected ? ' selected' : ''}>${o.label}</option>`).join('')}
      </select>`;
    }

    row.innerHTML = `
      ${thumbHtml}
      <div class="fl-info">
        <span class="fl-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span class="fl-meta">${formatFileSize(file.size)} · <span class="fl-badge">${PIPELINES[pipeline]?.label || ext}</span></span>
      </div>
      ${perFileHtml}
      <button type="button" class="fl-remove" data-index="${i}" title="Remove">&times;</button>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll('.fl-remove').forEach((btn) =>
    btn.addEventListener('click', (e) => removeFile(parseInt(e.target.dataset.index))),
  );
  body.querySelectorAll('.fl-format').forEach((sel) =>
    sel.addEventListener('change', (e) => {
      state.perFileFormats[parseInt(e.target.dataset.index)] = e.target.value;
      renderBatchConfirm();
      updateConvertButton();
    }),
  );
}
