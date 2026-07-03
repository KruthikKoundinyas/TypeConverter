import { state, elements } from '../state.js';
import { escapeHtml, getFileExtension, formatFileSize } from '../utils.js';
import { addToHistory } from './history.js';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadFile() {
  if (!state.convertedBlob || !state.convertedFilename) return;
  downloadBlob(state.convertedBlob, state.convertedFilename);
}

function isImageByExtension(filename) {
  const ext = getFileExtension(filename);
  return ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
}

export function showBatchResults(files) {
  elements.resultSection.classList.remove('hidden');
  elements.resultContainer.innerHTML = '';

  const summary = document.createElement('div');
  summary.className = 'batch-summary';

  let totalOriginal = 0;
  let totalConverted = 0;
  files.forEach((f) => {
    totalOriginal += f.originalSize || 0;
    totalConverted += f.convertedSize || 0;
  });
  const savings = totalOriginal - totalConverted;
  const savingsPercent = totalOriginal > 0 ? Math.round((savings / totalOriginal) * 100) : 0;

  summary.innerHTML = `
    <h3>Conversion Complete!</h3>
    <p>${files.length} file(s) converted successfully</p>
    ${savings > 0 ? `<p class="size-savings">Total saved: ${formatFileSize(savings)} (${savingsPercent}% smaller)</p>` : ''}
  `;
  elements.resultContainer.appendChild(summary);

  files.forEach((file, index) => {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-result';

    const ext = file.filename.split('.').pop().toLowerCase();
    const isImg = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'bmp'].includes(ext);

    let previewHtml = '';
    if (isImg) {
      const url = URL.createObjectURL(file.blob);
      previewHtml = `<img src="${url}" class="preview-image" alt="${escapeHtml(file.filename)}">`;
    }

    const originalSize = file.originalSize ? formatFileSize(file.originalSize) : 'N/A';
    const convertedSize = file.convertedSize ? formatFileSize(file.convertedSize) : 'N/A';
    const sizeChange = file.originalSize && file.convertedSize
      ? file.convertedSize < file.originalSize ? '↓' : file.convertedSize > file.originalSize ? '↑' : '='
      : '';

    fileDiv.innerHTML = `
      <div class="file-info">
        <span class="file-name">${escapeHtml(file.filename)}</span>
        <button class="download-btn" data-index="${index}">Download</button>
      </div>
      <div class="file-sizes">
        <span>Original: ${originalSize}</span>
        <span class="size-arrow">${sizeChange}</span>
        <span>Converted: ${convertedSize}</span>
      </div>
      ${previewHtml}
    `;

    fileDiv.querySelector('.download-btn').addEventListener('click', () => {
      downloadBlob(file.blob, file.filename);
    });

    elements.resultContainer.appendChild(fileDiv);

    const inputFormat = file.filename.split('.').pop().toLowerCase();
    const outputFormat = elements.formatSelect.value;
    addToHistory({
      filename: file.filename,
      inputFormat,
      outputFormat,
      originalSize: file.originalSize,
      convertedSize: file.convertedSize,
    });
  });

  if (files.length > 1 && typeof JSZip !== 'undefined') {
    const zipBtn = document.createElement('button');
    zipBtn.className = 'convert-btn';
    zipBtn.style.marginTop = '1rem';
    zipBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span class="btn-text">Download All as ZIP</span>
    `;
    zipBtn.type = 'button';
    zipBtn.addEventListener('click', async () => {
      zipBtn.disabled = true;
      zipBtn.querySelector('.btn-text').textContent = 'Creating ZIP...';
      try {
        const zip = new JSZip();
        files.forEach((f) => zip.file(f.filename, f.blob));
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        });
        downloadBlob(zipBlob, 'converted-files.zip');
      } finally {
        zipBtn.disabled = false;
        zipBtn.querySelector('.btn-text').textContent = 'Download All as ZIP';
      }
    });
    elements.resultContainer.appendChild(zipBtn);
  }
}
