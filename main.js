/**
 * File Converter - Client-Side JavaScript
 * Handles file upload, preview, and conversion entirely in the browser
 */

// ========================================
// State Management
// ========================================
let ffmpeg = null;
let ffmpegLoaded = false;
let ffmpegLoading = false;

const MAX_FILES = 100;
const MAX_TOTAL_SIZE = 500 * 1024 * 1024;

const state = {
  files: [],
  selectedFormat: null,
  perFileFormats: {},
  usePerFileFormats: false,
  convertedBlob: null,
  convertedFilename: null,
  history: [],
};

// ========================================
// Pipeline Registry
// ========================================
const PIPELINES = {
  image: {
    label: 'Images',
    extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'svg', 'ico', 'heic', 'heif', 'raw', 'tga'],
    outputs: [
      { ext: 'jpeg', label: 'JPEG' },
      { ext: 'png', label: 'PNG' },
      { ext: 'webp', label: 'WEBP' },
      { ext: 'gif', label: 'GIF' },
      { ext: 'bmp', label: 'BMP' },
      { ext: 'tiff', label: 'TIFF' },
    ],
  },
  audio: {
    label: 'Audio',
    extensions: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'],
    outputs: [
      { ext: 'mp3', label: 'MP3' },
      { ext: 'wav', label: 'WAV' },
      { ext: 'ogg', label: 'OGG' },
      { ext: 'flac', label: 'FLAC' },
      { ext: 'aac', label: 'AAC' },
      { ext: 'm4a', label: 'M4A' },
    ],
  },
  video: {
    label: 'Video',
    extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    outputs: [
      { ext: 'mp4', label: 'MP4' },
      { ext: 'webm', label: 'WEBM' },
      { ext: 'gif', label: 'GIF (animated)' },
    ],
  },
  document: {
    label: 'Documents',
    extensions: ['pdf', 'doc', 'docx', 'rtf', 'odt', 'epub'],
    outputs: [
      { ext: 'pdf', label: 'PDF' },
      { ext: 'txt', label: 'Plain Text' },
      { ext: 'html', label: 'HTML' },
    ],
  },
  spreadsheet: {
    label: 'Spreadsheets',
    extensions: ['csv', 'xls', 'xlsx', 'tsv'],
    outputs: [
      { ext: 'csv', label: 'CSV' },
      { ext: 'json', label: 'JSON' },
      { ext: 'xlsx', label: 'XLSX' },
    ],
  },
  presentation: {
    label: 'Presentations',
    extensions: ['ppt', 'pptx', 'odp'],
    outputs: [
      { ext: 'pdf', label: 'PDF' },
    ],
  },
  code: {
    label: 'Code / Text',
    extensions: ['html', 'htm', 'md', 'markdown', 'json', 'yaml', 'yml', 'xml', 'txt'],
    outputs: [
      { ext: 'html', label: 'HTML' },
      { ext: 'md', label: 'Markdown' },
      { ext: 'json', label: 'JSON' },
      { ext: 'yaml', label: 'YAML' },
      { ext: 'xml', label: 'XML' },
      { ext: 'txt', label: 'Plain Text' },
    ],
  },
  archive: {
    label: 'Archives',
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2'],
    outputs: [
      { ext: 'zip', label: 'ZIP' },
      { ext: 'tar', label: 'TAR' },
      { ext: 'gz', label: 'GZ' },
    ],
  },
};

const EXT_TO_PIPELINE = {};
for (const [key, p] of Object.entries(PIPELINES)) {
  for (const ext of p.extensions) {
    if (!EXT_TO_PIPELINE[ext]) EXT_TO_PIPELINE[ext] = key;
  }
}

const MIME_TO_PIPELINE = {
  'image/': 'image',
  'audio/': 'audio',
  'video/': 'video',
};

function detectPipeline(file) {
  const ext = getFileExtension(file.name);
  if (ext && EXT_TO_PIPELINE[ext]) return EXT_TO_PIPELINE[ext];
  const mime = file.type || '';
  for (const [prefix, pipeline] of Object.entries(MIME_TO_PIPELINE)) {
    if (mime.startsWith(prefix)) return pipeline;
  }
  return null;
}

function getPipelineOutputs(pipelineKey) {
  return PIPELINES[pipelineKey]?.outputs || [];
}

function isFormatValidForPipeline(pipelineKey, format) {
  return getPipelineOutputs(pipelineKey).some(o => o.ext === format);
}

// ========================================
// LocalStorage History
// ========================================
// Constants
// ========================================
const HISTORY_KEY = "fileConverterHistory";
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit for client-side processing

function loadHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    state.history = stored ? JSON.parse(stored) : [];
  } catch (e) {
    state.history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  } catch (e) {
    console.warn("Failed to save history:", e);
  }
}

function addToHistory(entry) {
  state.history.unshift(entry);
  if (state.history.length > 50) state.history = state.history.slice(0, 50);
  saveHistory();
}

function clearHistory() {
  state.history = [];
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const historySection = document.getElementById("history-section");
  const historyList = document.getElementById("history-list");
  if (!historySection || !historyList) return;

  if (state.history.length === 0) {
    historySection.classList.add("hidden");
    return;
  }

  historySection.style.display = "block";
  historyList.innerHTML = state.history
    .map(
      (item) => `
    <div class="history-item">
      <div class="history-info">
        <span class="history-name">${escapeHtml(item.filename)}</span>
        <span class="history-formats">${escapeHtml(item.inputFormat)} → ${escapeHtml(item.outputFormat)}</span>
      </div>
      <div class="history-sizes">${formatFileSize(item.originalSize)} → ${formatFileSize(item.convertedSize)}</div>
      <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
    </div>
  `,
    )
    .join("");
}

// ========================================
// DOM Elements
// ========================================
const elements = {
  dropZone: document.getElementById("drop-zone"),
  fileInput: document.getElementById("file-input"),
  formatSelect: document.getElementById("format-select"),
  convertBtn: document.getElementById("convert-btn"),
  resultSection: document.getElementById("result-section"),
  resultContainer: document.getElementById("result-container"),
  downloadBtn: document.getElementById("download-btn"),
  qualitySlider: document.getElementById("quality-slider"),
  qualityValue: document.getElementById("quality-value"),
  bitrateSelect: document.getElementById("bitrate-select"),
  historySection: document.getElementById("history-section"),
  historyList: document.getElementById("history-list"),
  clearHistoryBtn: document.getElementById("clear-history-btn"),
  loadingSpinner: document.getElementById("loading-spinner"),
  progressText: document.getElementById("progress-text"),
  progressBar: document.getElementById("progress-bar"),
  progressPct: document.getElementById("progress-pct"),
  themeToggle: document.getElementById("theme-toggle"),
  fileListSection: document.getElementById("file-list-section"),
  fileListToggle: document.getElementById("file-list-toggle"),
  fileListSummary: document.getElementById("file-list-summary"),
  fileListBody: document.getElementById("file-list-body"),
  clearFilesBtn: document.getElementById("clear-files-btn"),
  formatSection: document.getElementById("format-section"),
  advancedToggle: document.getElementById("advanced-toggle"),
  advancedLabel: document.getElementById("advanced-label"),
  batchConfirm: document.getElementById("batch-confirm"),
  batchStats: document.getElementById("batch-stats"),
  batchList: document.getElementById("batch-list"),
};

// ========================================
// Utility Functions
// ========================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename) {
  return filename
    .slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2)
    .toLowerCase();
}

/**
 * Get MIME type from file extension
 */
function getMimeType(extension) {
  const mimeTypes = {
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
    tif: "image/tiff",
    svg: "image/svg+xml",
    heic: "image/heic",
    heif: "image/heif",
    ico: "image/x-icon",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac",
    aac: "audio/aac",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    webm: "video/webm",
    html: "text/html",
    md: "text/markdown",
    json: "application/json",
    yaml: "text/yaml",
    yml: "text/yaml",
    xml: "application/xml",
    txt: "text/plain",
    csv: "text/csv",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
    tar: "application/x-tar",
    gz: "application/gzip",
  };
  return mimeTypes[extension] || "application/octet-stream";
}

/**
 * Check if file type is image
 */
function isImage(file) {
  return file.type.startsWith("image/");
}

/**
 * Check if file type is audio
 */
function isAudio(file) {
  return file.type.startsWith("audio/");
}

/**
 * Check if file type is video
 */
function isVideo(file) {
  return file.type.startsWith("video/");
}

// ========================================
// FFmpeg WASM Integration
// ========================================

/**
 * Load FFmpeg (lazy loading)
 * Only loads when needed for audio/video conversion
 */
async function loadFFmpeg() {
  if (ffmpegLoaded) return true;
  if (ffmpegLoading) {
    // Wait for ongoing loading to complete
    while (ffmpegLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return ffmpegLoaded;
  }

  ffmpegLoading = true;

  try {
    // Update button to show loading state
    const convertBtn = elements.convertBtn;
    if (convertBtn) {
      convertBtn.innerHTML = `
                <span>Loading engine...</span>
                <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
                </svg>
            `;
      convertBtn.disabled = true;
    }

    // Access FFmpeg from global scope (UMD build)
    const { FFmpeg } = FFmpeg;
    const { fetchFile } = FFmpegUtil;

    ffmpeg = new FFmpeg();

    // Log progress
    ffmpeg.on("log", ({ message }) => {
      console.log("[FFmpeg]", message);
    });

    ffmpeg.on("progress", ({ progress, time }) => {
      console.log(`[FFmpeg] Progress: ${Math.round(progress * 100)}%`);
      // Update button with progress
      const convertBtn = elements.convertBtn;
      if (convertBtn) {
        convertBtn.innerHTML = `
                    <span>Converting ${Math.round(progress * 100)}%</span>
                `;
      }
    });

    // Load FFmpeg core
    await ffmpeg.load({
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
      wasmURL:
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
    });

    ffmpegLoaded = true;
    console.log("[FFmpeg] Loaded successfully");
    return true;
  } catch (error) {
    console.error("[FFmpeg] Failed to load:", error);
    ffmpegLoaded = false;
    return false;
  } finally {
    ffmpegLoading = false;
  }
}

/**
 * Convert audio file using FFmpeg WASM
 * @param {File} file - The audio file to convert
 * @param {string} outputFormat - Target format (mp3, wav, ogg)
 * @returns {Promise<Blob>} - Converted file as Blob
 */
function getAudioCodecArgs(outputFormat, bitrate) {
  switch (outputFormat) {
    case "mp3":
      return ["-codec:a", "libmp3lame", "-b:a", bitrate];
    case "ogg":
      return ["-codec:a", "libvorbis", "-b:a", bitrate];
    case "flac":
      return ["-codec:a", "flac"];
    case "aac":
      return ["-codec:a", "aac", "-b:a", bitrate];
    case "m4a":
      return ["-codec:a", "aac", "-b:a", bitrate, "-f", "ipod"];
    case "wav":
      return ["-codec:a", "pcm_s16le"];
    default:
      return ["-codec:a", "pcm_s16le"];
  }
}

async function convertAudioWithFFmpeg(file, outputFormat, bitrate = "128000") {
  const { fetchFile } = FFmpegUtil;

  const loaded = await loadFFmpeg();
  if (!loaded) {
    throw new Error("Failed to load FFmpeg. Please try again.");
  }

  try {
    const inputData = await fetchFile(file);
    const inputExt = getFileExtension(file.name);
    const inputName = `input.${inputExt}`;
    const outExt = outputFormat === "m4a" ? "m4a" : outputFormat;
    const outputName = `output.${outExt}`;

    await ffmpeg.writeFile(inputName, inputData);

    const codecArgs = getAudioCodecArgs(outputFormat, bitrate);
    await ffmpeg.exec(["-i", inputName, ...codecArgs, outputName]);

    const outputData = await ffmpeg.readFile(outputName);

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    const mimeType = getMimeType(outputFormat);
    const blob = new Blob([outputData.buffer], { type: mimeType });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  } catch (error) {
    console.error("[FFmpeg] Conversion error:", error);
    throw new Error(`Audio conversion failed: ${error.message}`);
  }
}

// ========================================
// Code / Text Pipeline
// ========================================

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function jsonToXml(obj, rootName = "root") {
  function serialize(value, tag) {
    if (value === null || value === undefined) return `<${tag}/>`;
    if (Array.isArray(value)) {
      return value.map((item) => serialize(item, "item")).join("\n");
    }
    if (typeof value === "object") {
      const children = Object.entries(value)
        .map(([k, v]) => serialize(v, k))
        .join("\n");
      return `<${tag}>\n${children}\n</${tag}>`;
    }
    const escaped = String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<${tag}>${escaped}</${tag}>`;
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialize(obj, rootName);
}

function xmlToJson(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) throw new Error("Invalid XML");

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      return text || null;
    }
    const children = Array.from(node.childNodes).filter(
      (n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim()),
    );
    if (children.length === 1 && children[0].nodeType === Node.TEXT_NODE) {
      return children[0].textContent.trim();
    }
    const result = {};
    for (const child of children) {
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const key = child.tagName;
      const value = walk(child);
      if (result[key] !== undefined) {
        if (!Array.isArray(result[key])) result[key] = [result[key]];
        result[key].push(value);
      } else {
        result[key] = value;
      }
    }
    return Object.keys(result).length ? result : node.textContent.trim() || "";
  }
  return walk(doc.documentElement);
}

async function convertCodeText(file, targetFormat) {
  const text = await readFileAsText(file);
  const srcExt = getFileExtension(file.name);
  let output;

  if (targetFormat === "html") {
    if (srcExt === "md" || srcExt === "markdown") {
      output = marked.parse(text);
    } else if (srcExt === "json") {
      output = "<pre>" + escapeHtml(JSON.stringify(JSON.parse(text), null, 2)) + "</pre>";
    } else if (srcExt === "yaml" || srcExt === "yml") {
      const data = jsyaml.load(text);
      output = "<pre>" + escapeHtml(JSON.stringify(data, null, 2)) + "</pre>";
    } else if (srcExt === "xml") {
      output = "<pre>" + escapeHtml(text) + "</pre>";
    } else {
      output = "<pre>" + escapeHtml(text) + "</pre>";
    }
  } else if (targetFormat === "md") {
    if (srcExt === "html" || srcExt === "htm") {
      const td = new TurndownService();
      output = td.turndown(text);
    } else if (srcExt === "json") {
      output = "```json\n" + JSON.stringify(JSON.parse(text), null, 2) + "\n```";
    } else if (srcExt === "yaml" || srcExt === "yml") {
      output = "```yaml\n" + text + "\n```";
    } else if (srcExt === "xml") {
      output = "```xml\n" + text + "\n```";
    } else {
      output = text;
    }
  } else if (targetFormat === "json") {
    if (srcExt === "yaml" || srcExt === "yml") {
      const data = jsyaml.load(text);
      output = JSON.stringify(data, null, 2);
    } else if (srcExt === "xml") {
      const data = xmlToJson(text);
      output = JSON.stringify(data, null, 2);
    } else if (srcExt === "json") {
      output = JSON.stringify(JSON.parse(text), null, 2);
    } else {
      output = JSON.stringify({ content: text });
    }
  } else if (targetFormat === "yaml") {
    if (srcExt === "json") {
      const data = JSON.parse(text);
      output = jsyaml.dump(data, { indent: 2 });
    } else if (srcExt === "xml") {
      const data = xmlToJson(text);
      output = jsyaml.dump(data, { indent: 2 });
    } else if (srcExt === "yaml" || srcExt === "yml") {
      const data = jsyaml.load(text);
      output = jsyaml.dump(data, { indent: 2 });
    } else {
      output = jsyaml.dump({ content: text }, { indent: 2 });
    }
  } else if (targetFormat === "xml") {
    if (srcExt === "json") {
      const data = JSON.parse(text);
      output = jsonToXml(data);
    } else if (srcExt === "yaml" || srcExt === "yml") {
      const data = jsyaml.load(text);
      output = jsonToXml(data);
    } else if (srcExt === "xml") {
      output = text;
    } else {
      output = jsonToXml({ content: text });
    }
  } else if (targetFormat === "txt") {
    if (srcExt === "html" || srcExt === "htm") {
      const tmp = document.createElement("div");
      tmp.innerHTML = text;
      output = tmp.textContent || tmp.innerText || "";
    } else if (srcExt === "json") {
      output = JSON.stringify(JSON.parse(text), null, 2);
    } else {
      output = text;
    }
  } else {
    output = text;
  }

  const blob = new Blob([output], { type: getMimeType(targetFormat) });
  return { blob, originalSize: file.size, convertedSize: blob.size };
}

// ========================================
// Spreadsheet Pipeline
// ========================================

async function convertSpreadsheet(file, targetFormat) {
  const srcExt = getFileExtension(file.name);
  let workbook;

  if (srcExt === "csv" || srcExt === "tsv") {
    const text = await readFileAsText(file);
    workbook = XLSX.read(text, { type: "string" });
  } else {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array" });
  }

  let output;
  let mimeType;

  if (targetFormat === "csv") {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    output = XLSX.utils.sheet_to_csv(sheet);
    mimeType = "text/csv";
    const blob = new Blob([output], { type: mimeType });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  } else if (targetFormat === "json") {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    output = JSON.stringify(data, null, 2);
    mimeType = "application/json";
    const blob = new Blob([output], { type: mimeType });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  } else if (targetFormat === "xlsx") {
    const xlsxData = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([xlsxData], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  }

  throw new Error(`Unsupported spreadsheet output format: ${targetFormat}`);
}

// ========================================
// Archive Pipeline
// ========================================

async function convertArchive(file, targetFormat) {
  const srcExt = getFileExtension(file.name);

  if (srcExt === "zip" && targetFormat === "zip") {
    return { blob: file, originalSize: file.size, convertedSize: file.size };
  }

  if (srcExt === "zip") {
    const buffer = await file.arrayBuffer();
    const srcZip = await JSZip.loadAsync(buffer);

    if (targetFormat === "zip") {
      const newZip = new JSZip();
      for (const [name, entry] of Object.entries(srcZip.files)) {
        if (!entry.dir) {
          const data = await entry.async("uint8array");
          newZip.file(name, data);
        }
      }
      const blob = await newZip.generateAsync({ type: "blob" });
      return { blob, originalSize: file.size, convertedSize: blob.size };
    }
  }

  if (targetFormat === "zip") {
    const zip = new JSZip();
    const buffer = await file.arrayBuffer();
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    zip.file(file.name, buffer);
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    return { blob, originalSize: file.size, convertedSize: blob.size };
  }

  throw new Error(
    `Archive conversion from .${srcExt} to .${targetFormat} is not yet supported`,
  );
}

// ========================================
// Drag and Drop Handling
// ========================================

/**
 * Initialize drag and drop events
 */
function initDragAndDrop() {
  const dropZone = elements.dropZone;

  // Prevent default drag behaviors
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop zone when dragging over
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      () => {
        dropZone.classList.add("drag-over");
      },
      false,
    );
  });

  // Remove highlight when dragging leaves or dropping
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      () => {
        dropZone.classList.remove("drag-over");
      },
      false,
    );
  });

  // Handle dropped files
  dropZone.addEventListener("drop", handleDrop, false);
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

// ========================================
// File Handling
// ========================================

function getFileLimit() {
  if (state.files.length === 0) return MAX_FILES;
  const totalSize = state.files.reduce((s, f) => s + f.size, 0);
  const avg = totalSize / state.files.length;
  if (avg < 1 * 1024 * 1024) return 100;
  if (avg < 5 * 1024 * 1024) return 50;
  return 25;
}

function handleFiles(files) {
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
      ? "No supported files found:\n" + rejected.join("\n")
      : "Please select a supported file.";
    alert(msg);
    return;
  }

  state.files = [...state.files, ...newFiles];
  if (rejected.length > 0) {
    alert(`${newFiles.length} file(s) added, ${rejected.length} rejected:\n${rejected.slice(0, 5).join("\n")}${rejected.length > 5 ? "\n..." : ""}`);
  }

  refreshUI();
}

function removeFile(index) {
  state.files.splice(index, 1);
  delete state.perFileFormats[index];
  const rebuilt = {};
  Object.keys(state.perFileFormats).forEach((k) => {
    const ki = parseInt(k);
    if (ki > index) rebuilt[ki - 1] = state.perFileFormats[ki];
    else rebuilt[ki] = state.perFileFormats[ki];
  });
  state.perFileFormats = rebuilt;
  refreshUI();
}

function clearAllFiles() {
  state.files = [];
  state.perFileFormats = {};
  state.selectedFormat = null;
  state.usePerFileFormats = false;
  elements.advancedToggle.checked = false;
  refreshUI();
}

function refreshUI() {
  renderFileList();
  updateFormatOptions();
  renderBatchConfirm();
  updateConvertButton();

  const hasFiles = state.files.length > 0;
  elements.fileListSection.classList.toggle("hidden", !hasFiles);
  elements.formatSection.classList.toggle("hidden", !hasFiles);
  if (!hasFiles) {
    elements.batchConfirm.classList.add("hidden");
  }
}

// ========================================
// File List (collapsible preview)
// ========================================

const PIPELINE_ICONS = {
  image: "🖼", audio: "🎵", video: "🎬", document: "📄",
  spreadsheet: "📊", presentation: "📽", code: "📝", archive: "📦",
};

function renderFileList() {
  const totalSize = state.files.reduce((s, f) => s + f.size, 0);
  const limit = getFileLimit();
  elements.fileListSummary.textContent =
    `${state.files.length} file${state.files.length !== 1 ? "s" : ""} (${formatFileSize(totalSize)}) — limit ${limit}`;

  const body = elements.fileListBody;
  body.innerHTML = "";

  state.files.forEach((file, i) => {
    const pipeline = detectPipeline(file);
    const icon = PIPELINE_ICONS[pipeline] || "📎";
    const ext = getFileExtension(file.name).toUpperCase();

    const row = document.createElement("div");
    row.className = "fl-row";

    let thumbHtml = `<span class="fl-icon">${icon}</span>`;
    const noNativePreview = ["heic", "heif", "tiff", "tif"];
    if (pipeline === "image" && !noNativePreview.includes(ext.toLowerCase())) {
      const url = URL.createObjectURL(file);
      thumbHtml = `<img src="${url}" class="fl-thumb" alt="" />`;
    }

    let perFileHtml = "";
    if (state.usePerFileFormats) {
      const outputs = getPipelineOutputs(pipeline);
      const selected = state.perFileFormats[i] || state.selectedFormat || "";
      perFileHtml = `<select class="fl-format" data-index="${i}">
        <option value="">--</option>
        ${outputs.map((o) => `<option value="${o.ext}"${o.ext === selected ? " selected" : ""}>${o.label}</option>`).join("")}
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

  body.querySelectorAll(".fl-remove").forEach((btn) =>
    btn.addEventListener("click", (e) => removeFile(parseInt(e.target.dataset.index))),
  );
  body.querySelectorAll(".fl-format").forEach((sel) =>
    sel.addEventListener("change", (e) => {
      state.perFileFormats[parseInt(e.target.dataset.index)] = e.target.value;
      renderBatchConfirm();
      updateConvertButton();
    }),
  );
}

// ========================================
// Format Selection
// ========================================

function updateFormatOptions() {
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
    const group = document.createElement("optgroup");
    group.label = pipeline.label;
    for (const opt of pipeline.outputs) {
      const option = document.createElement("option");
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

function handleFormatChange() {
  elements.formatSelect.addEventListener("change", (e) => {
    state.selectedFormat = e.target.value;
    updateCompressionUI();
    renderBatchConfirm();
    updateConvertButton();
    if (state.usePerFileFormats) renderFileList();
  });

  if (elements.qualitySlider && elements.qualityValue) {
    elements.qualitySlider.addEventListener("input", (e) => {
      elements.qualityValue.textContent = e.target.value;
    });
  }
}

function updateCompressionUI() {
  const compressionEl = document.getElementById("compression-settings");
  const qualityEl = document.getElementById("image-quality-container");
  const bitrateEl = document.getElementById("audio-bitrate-container");
  if (!compressionEl) return;

  const fmt = state.selectedFormat;
  if (!fmt) {
    compressionEl.classList.add("hidden");
    return;
  }
  const isImg = PIPELINES.image.outputs.some((o) => o.ext === fmt);
  const isAud = PIPELINES.audio.outputs.some((o) => o.ext === fmt);
  compressionEl.classList.toggle("hidden", !isImg && !isAud);
  if (qualityEl) qualityEl.classList.toggle("hidden", !isImg);
  if (bitrateEl) bitrateEl.classList.toggle("hidden", !isAud);
}

// ========================================
// Batch Confirmation
// ========================================

function getFileFormat(index) {
  if (state.usePerFileFormats && state.perFileFormats[index]) {
    return state.perFileFormats[index];
  }
  return state.selectedFormat || "";
}

function renderBatchConfirm() {
  const hasFormat = state.selectedFormat ||
    (state.usePerFileFormats && Object.values(state.perFileFormats).some(Boolean));

  if (!hasFormat || state.files.length === 0) {
    elements.batchConfirm.classList.add("hidden");
    return;
  }

  elements.batchConfirm.classList.remove("hidden");
  const list = elements.batchList;
  list.innerHTML = "";

  let convertCount = 0;
  let skipCount = 0;

  state.files.forEach((file, i) => {
    const pipeline = detectPipeline(file);
    const fmt = getFileFormat(i);
    const canConvert = fmt && pipeline && isFormatValidForPipeline(pipeline, fmt);

    if (canConvert) convertCount++;
    else skipCount++;

    const row = document.createElement("div");
    row.className = "bc-row" + (canConvert ? "" : " bc-skip");

    const ext = getFileExtension(file.name).toUpperCase();
    const targetLabel = fmt ? fmt.toUpperCase() : "—";
    const statusIcon = canConvert ? "✓" : "—";

    row.innerHTML = `
      <span class="bc-status ${canConvert ? "bc-ok" : "bc-na"}">${statusIcon}</span>
      <span class="bc-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
      <span class="bc-arrow">→</span>
      <span class="bc-target">${canConvert ? "." + targetLabel : "skip"}</span>
    `;
    list.appendChild(row);
  });

  elements.batchStats.textContent =
    `${convertCount} to convert` + (skipCount ? `, ${skipCount} skipped` : "");

  const btnText = elements.convertBtn.querySelector(".btn-text");
  if (btnText) {
    btnText.textContent = convertCount > 0
      ? `Convert ${convertCount} file${convertCount !== 1 ? "s" : ""}`
      : "Convert Files";
  }
}

function updateConvertButton() {
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

// ========================================
// Conversion Logic (Client-Side)
// ========================================

/**
 * Convert file using Canvas API for images
 * @param {File} file - The file to convert
 * @param {string} targetFormat - Target format (jpeg, png, webp, gif)
 * @param {number} quality - Quality value from slider (10-100)
 */
async function decodeHeic(file) {
  const blob = await heic2any({ blob: file, toType: "image/png" });
  return Array.isArray(blob) ? blob[0] : blob;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function imageToCanvas(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return canvas;
}

function encodeBmp(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelDataSize = rowSize * height;
  const fileSize = 54 + pixelDataSize;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);

  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4D); // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelDataSize, true);

  for (let y = 0; y < height; y++) {
    const rowStart = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = rowStart + x * 3;
      view.setUint8(dstIdx, pixels[srcIdx + 2]);     // B
      view.setUint8(dstIdx + 1, pixels[srcIdx + 1]); // G
      view.setUint8(dstIdx + 2, pixels[srcIdx]);     // R
    }
  }

  return new Blob([buf], { type: "image/bmp" });
}

function encodeTiff(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const tiffData = UTIF.encodeImage(rgba, width, height);
  return new Blob([tiffData], { type: "image/tiff" });
}

async function decodeTiffToCanvas(file) {
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  UTIF.decodeImage(buf, ifds[0]);
  const firstPage = ifds[0];
  const rgba = UTIF.toRGBA8(firstPage);
  const canvas = document.createElement("canvas");
  canvas.width = firstPage.width;
  canvas.height = firstPage.height;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(firstPage.width, firstPage.height);
  imgData.data.set(rgba);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

async function convertImage(file, targetFormat, quality = 80) {
  const ext = getFileExtension(file.name);
  let canvas;

  if (ext === "heic" || ext === "heif") {
    const decoded = await decodeHeic(file);
    const url = URL.createObjectURL(decoded);
    try {
      canvas = imageToCanvas(await loadImage(url));
    } finally {
      URL.revokeObjectURL(url);
    }
  } else if (ext === "tiff" || ext === "tif") {
    canvas = await decodeTiffToCanvas(file);
  } else {
    const url = URL.createObjectURL(file);
    try {
      canvas = imageToCanvas(await loadImage(url));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  let outputBlob;
  if (targetFormat === "bmp") {
    outputBlob = encodeBmp(canvas);
  } else if (targetFormat === "tiff") {
    outputBlob = encodeTiff(canvas);
  } else {
    const mimeType = getMimeType(targetFormat);
    const qualityValue = quality / 100;
    outputBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Conversion failed")),
        mimeType,
        qualityValue,
      );
    });
  }

  return { blob: outputBlob, originalSize: file.size, convertedSize: outputBlob.size };
}

/**
 * Main conversion function - Batch processing
 */
async function convertFiles() {
  if (state.files.length === 0) return;

  state.convertedFiles = [];
  const skipped = [];
  const totalFiles = state.files.length;

  elements.convertBtn.disabled = true;
  elements.convertBtn.classList.add("processing");
  elements.convertBtn.innerHTML = `<span class="spinner"></span> Converting 0/${totalFiles}...`;
  showLoadingSpinner(0, totalFiles, "Starting...");

  try {
    for (let i = 0; i < state.files.length; i++) {
      const file = state.files[i];
      const targetFormat = getFileFormat(i);

      const fileName =
        file.name.length > 20 ? file.name.substring(0, 17) + "..." : file.name;
      elements.convertBtn.innerHTML = `<span class="spinner"></span> Converting ${i + 1}/${totalFiles}: ${fileName}`;
      showLoadingSpinner(i + 1, totalFiles, fileName);

      const pipeline = detectPipeline(file);
      if (!targetFormat || !pipeline || !isFormatValidForPipeline(pipeline, targetFormat)) {
        skipped.push(file.name);
        continue;
      }

      let convertedResult;

      switch (pipeline) {
        case "image": {
          const quality = elements.qualitySlider
            ? parseInt(elements.qualitySlider.value) : 80;
          convertedResult = await convertImage(file, targetFormat, quality);
          break;
        }
        case "audio": {
          const bitrate = elements.bitrateSelect
            ? elements.bitrateSelect.value : "128000";
          convertedResult = await convertAudioWithFFmpeg(file, targetFormat, bitrate);
          break;
        }
        case "code":
          convertedResult = await convertCodeText(file, targetFormat);
          break;
        case "spreadsheet":
          convertedResult = await convertSpreadsheet(file, targetFormat);
          break;
        case "archive":
          convertedResult = await convertArchive(file, targetFormat);
          break;
        case "video":
        case "document":
        case "presentation":
          skipped.push(`${file.name} (${PIPELINES[pipeline].label} pipeline not yet implemented)`);
          continue;
        default:
          skipped.push(file.name);
          continue;
      }

      const originalName = file.name.replace(/\.[^/.]+$/, "");
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
        ? `Skipped ${skipped.length} file(s):\n${skipped.join("\n")}`
        : `No files converted.\n${skipped.join("\n")}`;
      alert(msg);
    } else if (state.convertedFiles.length === 0) {
      alert("No files were successfully converted.");
    }
  } catch (error) {
    console.error("Conversion error:", error);
    alert("Conversion failed: " + error.message);
  } finally {
    // Reset button
    elements.convertBtn.disabled = false;
    elements.convertBtn.classList.remove("processing");
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

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Show batch conversion results
 */
function showBatchResults(files) {
  elements.resultSection.classList.remove("hidden");
  elements.resultContainer.innerHTML = "";

  // Create result summary
  const summary = document.createElement("div");
  summary.className = "batch-summary";

  // Calculate total savings
  let totalOriginal = 0;
  let totalConverted = 0;
  files.forEach((f) => {
    totalOriginal += f.originalSize || 0;
    totalConverted += f.convertedSize || 0;
  });
  const savings = totalOriginal - totalConverted;
  const savingsPercent =
    totalOriginal > 0 ? Math.round((savings / totalOriginal) * 100) : 0;

  summary.innerHTML = `
    <h3>Conversion Complete!</h3>
    <p>${files.length} file(s) converted successfully</p>
    ${savings > 0 ? `<p class="size-savings">Total saved: ${formatFileSize(savings)} (${savingsPercent}% smaller)</p>` : ""}
  `;
  elements.resultContainer.appendChild(summary);

  // Show each converted file
  files.forEach((file, index) => {
    const fileDiv = document.createElement("div");
    fileDiv.className = "file-result";

    const ext = file.filename.split(".").pop().toLowerCase();
    const isImage = ["jpeg", "jpg", "png", "gif", "webp", "bmp"].includes(ext);

    let previewHtml = "";
    if (isImage) {
      const url = URL.createObjectURL(file.blob);
      previewHtml = `<img src="${url}" class="preview-image" alt="${file.filename}">`;
    }

    // File size info
    const originalSize = file.originalSize
      ? formatFileSize(file.originalSize)
      : "N/A";
    const convertedSize = file.convertedSize
      ? formatFileSize(file.convertedSize)
      : "N/A";
    const sizeChange =
      file.originalSize && file.convertedSize
        ? file.convertedSize < file.originalSize
          ? "↓"
          : file.convertedSize > file.originalSize
            ? "↑"
            : "="
        : "";

    fileDiv.innerHTML = `
      <div class="file-info">
        <span class="file-name">${file.filename}</span>
        <button class="download-btn" data-index="${index}">Download</button>
      </div>
      <div class="file-sizes">
        <span>Original: ${originalSize}</span>
        <span class="size-arrow">${sizeChange}</span>
        <span>Converted: ${convertedSize}</span>
      </div>
      ${previewHtml}
    `;

    // Add download handler
    fileDiv.querySelector(".download-btn").addEventListener("click", () => {
      downloadBlob(file.blob, file.filename);
    });

    elements.resultContainer.appendChild(fileDiv);

    // Add to history
    const inputFormat = file.filename.split(".").pop().toLowerCase();
    const outputFormat = elements.formatSelect.value;
    addToHistory({
      filename: file.filename,
      inputFormat: inputFormat,
      outputFormat: outputFormat,
      originalSize: file.originalSize,
      convertedSize: file.convertedSize,
    });
  });

  if (files.length > 1 && typeof JSZip !== "undefined") {
    const zipBtn = document.createElement("button");
    zipBtn.className = "convert-btn";
    zipBtn.style.marginTop = "1rem";
    zipBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span class="btn-text">Download All as ZIP</span>
    `;
    zipBtn.type = "button";
    zipBtn.addEventListener("click", async () => {
      zipBtn.disabled = true;
      zipBtn.querySelector(".btn-text").textContent = "Creating ZIP...";
      try {
        const zip = new JSZip();
        files.forEach((f) => zip.file(f.filename, f.blob));
        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });
        downloadBlob(zipBlob, "converted-files.zip");
      } finally {
        zipBtn.disabled = false;
        zipBtn.querySelector(".btn-text").textContent = "Download All as ZIP";
      }
    });
    elements.resultContainer.appendChild(zipBtn);
  }
}

/**
 * Download a blob as file
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Show conversion result
 */
function showResult(blob, filename) {
  elements.resultSection.classList.remove("hidden");

  // Create preview of converted file
  elements.resultContainer.innerHTML = "";

  if (isImageByExtension(filename)) {
    const url = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = url;
    img.className = "preview-image";
    img.alt = "Converted image";
    elements.resultContainer.appendChild(img);
  }

  // Store blob for download
  state.convertedBlob = blob;
  state.convertedFilename = filename;
}

/**
 * Check if filename is an image by extension
 */
function isImageByExtension(filename) {
  const ext = getFileExtension(filename);
  return ["jpeg", "jpg", "png", "gif", "webp", "bmp"].includes(ext);
}

/**
 * Download converted file
 */
function downloadFile() {
  if (!state.convertedBlob || !state.convertedFilename) {
    return;
  }

  const url = URL.createObjectURL(state.convertedBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = state.convertedFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ========================================
// Event Listeners
// ========================================

/**
 * Initialize all event listeners
 */
function initEventListeners() {
  elements.fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  handleFormatChange();

  elements.convertBtn.addEventListener("click", convertFiles);
  elements.downloadBtn.addEventListener("click", downloadFile);
  elements.clearHistoryBtn.addEventListener("click", clearHistory);

  elements.fileListToggle.addEventListener("click", () => {
    const body = elements.fileListBody;
    const open = !body.classList.contains("hidden");
    body.classList.toggle("hidden", open);
    elements.fileListToggle.querySelector(".chevron").textContent = open ? "▾" : "▴";
  });

  elements.clearFilesBtn.addEventListener("click", clearAllFiles);

  elements.advancedToggle.addEventListener("change", (e) => {
    state.usePerFileFormats = e.target.checked;
    elements.formatSelect.closest(".format-global").classList.toggle("hidden", state.usePerFileFormats);
    renderFileList();
    renderBatchConfirm();
    updateConvertButton();
  });
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize the application
 */
function init() {
  initDragAndDrop();
  initEventListeners();
  updateConvertButton();
  loadHistory();
  initTheme();
}

// ========================================
// Theme Toggle
// =======================================-

/**
 * Initialize theme toggle
 */
function applyTheme(theme) {
  if (theme && theme !== "light") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("theme", theme || "light");
}

function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  applyTheme(saved);

  if (!elements.themeToggle) return;

  const clicks = [];

  elements.themeToggle.addEventListener("click", () => {
    const now = Date.now();
    clicks.push(now);
    while (clicks.length && now - clicks[0] > 1500) clicks.shift();

    if (clicks.length >= 5) {
      clicks.length = 0;
      applyTheme("grey");
      elements.themeToggle.classList.add("secret-pulse");
      setTimeout(() => elements.themeToggle.classList.remove("secret-pulse"), 600);
      return;
    }

    const cur = document.documentElement.getAttribute("data-theme") || "light";
    if (cur === "grey") {
      applyTheme("light");
    } else {
      applyTheme(cur === "dark" ? "light" : "dark");
    }
  });
}

/**
 * Show loading spinner during conversion
 */
function showLoadingSpinner(current, total, filename) {
  if (!elements.loadingSpinner) return;
  elements.loadingSpinner.classList.remove("hidden");
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  if (elements.progressText) {
    elements.progressText.textContent = `${current}/${total}: ${filename}`;
  }
  if (elements.progressBar) {
    elements.progressBar.style.width = pct + "%";
  }
  if (elements.progressPct) {
    elements.progressPct.textContent = pct + "%";
  }
}

function hideLoadingSpinner() {
  if (!elements.loadingSpinner) return;
  elements.loadingSpinner.classList.add("hidden");
  if (elements.progressBar) elements.progressBar.style.width = "0%";
}

// Start the application when DOM is ready
document.addEventListener("DOMContentLoaded", init);
