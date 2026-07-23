import { state, elements } from './state.js';
import { detectPipeline, isFormatValidForPipeline, PIPELINES } from './pipelines/registry.js';
import { convertImage } from './pipelines/image.js';
import { convertAudioWithFFmpeg } from './pipelines/audio.js';
import { convertCodeText } from './pipelines/code.js';
import { convertSpreadsheet } from './pipelines/spreadsheet.js';
import { convertArchive } from './pipelines/archive.js';
import { convertVideo } from './pipelines/video.js';
import { convertDocument } from './pipelines/document.js';
import { getFileFormat } from './ui/batch.js';
import { showLoadingSpinner, hideLoadingSpinner } from './ui/progress.js';
import { showBatchResults } from './ui/results.js';

export async function convertFiles() {
  if (state.files.length === 0) return;

  state.convertedFiles = [];
  const skipped = [];
  const totalFiles = state.files.length;

  elements.convertBtn.disabled = true;
  elements.convertBtn.classList.add('processing');
  elements.convertBtn.innerHTML = `<span class="spinner"></span> Converting 0/${totalFiles}...`;
  showLoadingSpinner(0, totalFiles, 'Starting...');

  try {
    for (let i = 0; i < state.files.length; i++) {
      const file = state.files[i];
      const targetFormat = getFileFormat(i);

      const fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
      elements.convertBtn.innerHTML = `<span class="spinner"></span> Converting ${i + 1}/${totalFiles}: ${fileName}`;
      showLoadingSpinner(i + 1, totalFiles, fileName);

      const pipeline = detectPipeline(file);
      if (!targetFormat || !pipeline || !isFormatValidForPipeline(pipeline, targetFormat)) {
        skipped.push(file.name);
        continue;
      }

      let convertedResult;

      switch (pipeline) {
        case 'image': {
          const quality = elements.qualitySlider ? parseInt(elements.qualitySlider.value) : 80;
          convertedResult = await convertImage(file, targetFormat, quality);
          break;
        }
        case 'audio': {
          const bitrate = elements.bitrateSelect ? elements.bitrateSelect.value : '128000';
          convertedResult = await convertAudioWithFFmpeg(file, targetFormat, bitrate);
          break;
        }
        case 'code':
          convertedResult = await convertCodeText(file, targetFormat);
          break;
        case 'spreadsheet':
          convertedResult = await convertSpreadsheet(file, targetFormat);
          break;
        case 'archive':
          convertedResult = await convertArchive(file, targetFormat);
          break;
        case 'video': {
          const quality = elements.qualitySlider ? parseInt(elements.qualitySlider.value) : 80;
          convertedResult = await convertVideo(file, targetFormat, { quality });
          break;
        }
        case 'document':
          convertedResult = await convertDocument(file, targetFormat);
          break;
        case 'presentation':
          skipped.push(`${file.name} (${PIPELINES[pipeline].label} pipeline not yet implemented)`);
          continue;
        default:
          skipped.push(file.name);
          continue;
      }

      const originalName = file.name.replace(/\.[^/.]+$/, '');
      const convertedFilename = `${originalName}.${targetFormat}`;

      state.convertedFiles.push({
        blob: convertedResult.blob,
        filename: convertedFilename,
        originalSize: convertedResult.originalSize,
        convertedSize: convertedResult.convertedSize,
      });
    }

    if (state.convertedFiles.length > 0) {
      showBatchResults(state.convertedFiles);
    }
    if (skipped.length > 0) {
      const msg = state.convertedFiles.length > 0
        ? `Skipped ${skipped.length} file(s):\n${skipped.join('\n')}`
        : `No files converted.\n${skipped.join('\n')}`;
      alert(msg);
    } else if (state.convertedFiles.length === 0) {
      alert('No files were successfully converted.');
    }
  } catch (error) {
    console.error('Conversion error:', error);
    alert('Conversion failed: ' + error.message);
  } finally {
    elements.convertBtn.disabled = false;
    elements.convertBtn.classList.remove('processing');
    elements.convertBtn.innerHTML = `
      <span class="btn-text">Convert Files</span>
      <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
    hideLoadingSpinner();
  }
}
