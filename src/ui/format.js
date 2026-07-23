import { state, elements } from '../state.js';
import { PIPELINES, detectPipeline } from '../pipelines/registry.js';
import { renderFileList } from './filelist.js';
import { renderBatchConfirm, updateConvertButton } from './batch.js';

export function updateFormatOptions() {
  const formatSelect = elements.formatSelect;
  const prev = formatSelect.value;
  formatSelect.innerHTML = '<option value="">--Choose a format--</option>';

  if (state.files.length === 0) {
    state.selectedFormat = null;
    return;
  }

  const activePipelines = new Set(
    state.files.map((f) => detectPipeline(f)).filter(Boolean),
  );

  for (const [key, pipeline] of Object.entries(PIPELINES)) {
    if (!activePipelines.has(key)) continue;
    const group = document.createElement('optgroup');
    group.label = pipeline.label;
    for (const opt of pipeline.outputs) {
      const option = document.createElement('option');
      option.value = opt.ext;
      option.textContent = opt.label;
      group.appendChild(option);
    }
    formatSelect.appendChild(group);
  }

  if (prev && formatSelect.querySelector(`option[value="${prev}"]`)) {
    formatSelect.value = prev;
  }
}

export function updateCompressionUI() {
  const compressionEl = document.getElementById('compression-settings');
  const qualityEl = document.getElementById('image-quality-container');
  const bitrateEl = document.getElementById('audio-bitrate-container');
  if (!compressionEl) return;

  const fmt = state.selectedFormat;
  if (!fmt) {
    compressionEl.classList.add('hidden');
    return;
  }
  const isImg = PIPELINES.image.outputs.some((o) => o.ext === fmt);
  const isAud = PIPELINES.audio.outputs.some((o) => o.ext === fmt);
  const isVid = PIPELINES.video.outputs.some((o) => o.ext === fmt);
  const showQuality = isImg || isVid;
  compressionEl.classList.toggle('hidden', !showQuality && !isAud);
  if (qualityEl) qualityEl.classList.toggle('hidden', !showQuality);
  if (bitrateEl) bitrateEl.classList.toggle('hidden', !isAud);
}

export function initFormatHandlers() {
  elements.formatSelect.addEventListener('change', (e) => {
    state.selectedFormat = e.target.value;
    updateCompressionUI();
    renderBatchConfirm();
    updateConvertButton();
    if (state.usePerFileFormats) renderFileList();
  });

  if (elements.qualitySlider && elements.qualityValue) {
    elements.qualitySlider.addEventListener('input', (e) => {
      elements.qualityValue.textContent = e.target.value;
    });
  }
}
