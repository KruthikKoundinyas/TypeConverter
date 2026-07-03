export const MAX_FILES = 100;
export const MAX_TOTAL_SIZE = 500 * 1024 * 1024;
export const MAX_FILE_SIZE = 100 * 1024 * 1024;
export const HISTORY_KEY = 'fileConverterHistory';

export const state = {
  files: [],
  selectedFormat: null,
  perFileFormats: {},
  usePerFileFormats: false,
  convertedBlob: null,
  convertedFilename: null,
  convertedFiles: [],
  history: [],
};

export const ffmpegState = {
  instance: null,
  loaded: false,
  loading: false,
};

export const elements = {};

export function initElements() {
  Object.assign(elements, {
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    formatSelect: document.getElementById('format-select'),
    convertBtn: document.getElementById('convert-btn'),
    resultSection: document.getElementById('result-section'),
    resultContainer: document.getElementById('result-container'),
    downloadBtn: document.getElementById('download-btn'),
    qualitySlider: document.getElementById('quality-slider'),
    qualityValue: document.getElementById('quality-value'),
    bitrateSelect: document.getElementById('bitrate-select'),
    historySection: document.getElementById('history-section'),
    historyList: document.getElementById('history-list'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    loadingSpinner: document.getElementById('loading-spinner'),
    progressText: document.getElementById('progress-text'),
    progressBar: document.getElementById('progress-bar'),
    progressPct: document.getElementById('progress-pct'),
    themeToggle: document.getElementById('theme-toggle'),
    fileListSection: document.getElementById('file-list-section'),
    fileListToggle: document.getElementById('file-list-toggle'),
    fileListSummary: document.getElementById('file-list-summary'),
    fileListBody: document.getElementById('file-list-body'),
    clearFilesBtn: document.getElementById('clear-files-btn'),
    formatSection: document.getElementById('format-section'),
    advancedToggle: document.getElementById('advanced-toggle'),
    advancedLabel: document.getElementById('advanced-label'),
    batchConfirm: document.getElementById('batch-confirm'),
    batchStats: document.getElementById('batch-stats'),
    batchList: document.getElementById('batch-list'),
  });
}
