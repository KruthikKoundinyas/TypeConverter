import { state, elements, initElements } from './state.js';
import { initDragAndDrop } from './ui/dropzone.js';
import { handleFiles, renderFileList, clearAllFiles } from './ui/filelist.js';
import { updateFormatOptions, initFormatHandlers } from './ui/format.js';
import { renderBatchConfirm, updateConvertButton } from './ui/batch.js';
import { convertFiles } from './converter.js';
import { downloadFile } from './ui/results.js';
import { loadHistory, clearHistory } from './ui/history.js';
import { initTheme } from './ui/theme.js';
import { initSnakeGame } from './ui/snake.js';

function refreshUI() {
  renderFileList();
  updateFormatOptions();
  renderBatchConfirm();
  updateConvertButton();

  const hasFiles = state.files.length > 0;
  elements.fileListSection.classList.toggle('hidden', !hasFiles);
  elements.formatSection.classList.toggle('hidden', !hasFiles);
  if (!hasFiles) {
    elements.batchConfirm.classList.add('hidden');
  }
}

function initEventListeners() {
  elements.fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
  });

  initFormatHandlers();

  elements.convertBtn.addEventListener('click', convertFiles);
  elements.downloadBtn.addEventListener('click', downloadFile);
  elements.clearHistoryBtn.addEventListener('click', clearHistory);

  elements.fileListToggle.addEventListener('click', () => {
    const body = elements.fileListBody;
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    elements.fileListToggle.querySelector('.chevron').textContent = open ? '▾' : '▴';
  });

  elements.clearFilesBtn.addEventListener('click', clearAllFiles);

  elements.advancedToggle.addEventListener('change', (e) => {
    state.usePerFileFormats = e.target.checked;
    elements.formatSelect.closest('.format-global').classList.toggle('hidden', state.usePerFileFormats);
    renderFileList();
    renderBatchConfirm();
    updateConvertButton();
  });

  document.addEventListener('tc:refresh', refreshUI);
}

function init() {
  initElements();
  initDragAndDrop();
  initEventListeners();
  updateConvertButton();
  loadHistory();
  initTheme();
  initSnakeGame();
}

document.addEventListener('DOMContentLoaded', init);
