/**
 * File Converter - Client-Side JavaScript
 * Handles file upload, preview, and conversion entirely in the browser
 */

// ========================================
// State Management
// ========================================
const state = {
  files: [],
  selectedFormat: null,
  convertedBlob: null,
  convertedFilename: null,
  history: [],
};

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
  selectedFiles: document.getElementById("selected-files"),
  formatSelect: document.getElementById("format-select"),
  convertBtn: document.getElementById("convert-btn"),
  previewSection: document.getElementById("preview-section"),
  imagePreview: document.getElementById("image-preview"),
  audioPreview: document.getElementById("audio-preview"),
  videoPreview: document.getElementById("video-preview"),
  previewPlaceholder: document.getElementById("preview-placeholder"),
  resultSection: document.getElementById("result-section"),
  resultContainer: document.getElementById("result-container"),
  downloadBtn: document.getElementById("download-btn"),
  // Compression settings
  qualitySlider: document.getElementById("quality-slider"),
  qualityValue: document.getElementById("quality-value"),
  bitrateSelect: document.getElementById("bitrate-select"),
  // History elements
  historySection: document.getElementById("history-section"),
  historyList: document.getElementById("history-list"),
  clearHistoryBtn: document.getElementById("clear-history-btn"),
  // Loading spinner
  loadingSpinner: document.getElementById("loading-spinner"),
  progressText: document.getElementById("progress-text"),
  // Theme toggle
  themeToggle: document.getElementById("theme-toggle"),
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
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    mp4: "video/mp4",
    webm: "video/webm",
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
async function convertAudioWithFFmpeg(file, outputFormat) {
  const { fetchFile } = FFmpegUtil;

  // Load FFmpeg if not already loaded
  const loaded = await loadFFmpeg();
  if (!loaded) {
    throw new Error("Failed to load FFmpeg. Please try again.");
  }

  try {
    // Read input file
    const inputData = await fetchFile(file);
    const inputExt = file.name.split(".").pop().toLowerCase();
    const inputName = `input.${inputExt}`;
    const outputName = `output.${outputFormat}`;

    // Write input file to FFmpeg's virtual filesystem
    await ffmpeg.writeFile(inputName, inputData);

    // Run FFmpeg command
    await ffmpeg.exec([
      "-i",
      inputName,
      "-codec:a",
      outputFormat === "mp3"
        ? "libmp3lame"
        : outputFormat === "ogg"
          ? "libvorbis"
          : "pcm_s16le",
      outputName,
    ]);

    // Read output file
    const outputData = await ffmpeg.readFile(outputName);

    // Clean up virtual files
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    // Create Blob from output
    const mimeType = getMimeType(outputFormat);
    return new Blob([outputData.buffer], { type: mimeType });
  } catch (error) {
    console.error("[FFmpeg] Conversion error:", error);
    throw new Error(`Audio conversion failed: ${error.message}`);
  }
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

/**
 * Handle file selection from input
 */
function handleFiles(files) {
  const newFiles = Array.from(files).filter((file) => {
    // Filter for supported types
    const supportedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
    ];
    const supportedAudioTypes = ["audio/mpeg", "audio/wav", "audio/ogg"];
    const supportedVideoTypes = ["video/mp4", "video/webm"];

    // Check file size - warn for large files
    if (file.size > MAX_FILE_SIZE) {
      console.warn(
        `File ${file.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
      );
      return false;
    }

    return (
      supportedImageTypes.includes(file.type) ||
      supportedAudioTypes.includes(file.type) ||
      supportedVideoTypes.includes(file.type)
    );
  });

  if (newFiles.length === 0) {
    alert("Please select valid image, audio, or video files under 100MB.");
    return;
  }

  // Add to state
  state.files = [...state.files, ...newFiles];

  // Update UI
  updateSelectedFiles();
  updateFormatOptions();
  showPreviews();
  updateConvertButton();
}

/**
 * Update selected files display
 */
function updateSelectedFiles() {
  elements.selectedFiles.innerHTML = "";

  state.files.forEach((file, index) => {
    const tag = document.createElement("span");
    tag.className = "file-tag";
    tag.innerHTML = `
            ${file.name}
            <span class="remove-file" data-index="${index}">&times;</span>
        `;
    elements.selectedFiles.appendChild(tag);
  });

  // Add remove file listeners
  document.querySelectorAll(".remove-file").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.target.dataset.index);
      removeFile(index);
    });
  });
}

/**
 * Remove file from selection
 */
function removeFile(index) {
  state.files.splice(index, 1);
  updateSelectedFiles();
  updateFormatOptions();
  showPreviews();
  updateConvertButton();
}

/**
 * Update format dropdown based on file types
 */
function updateFormatOptions() {
  const formatSelect = elements.formatSelect;
  const imageFormats = formatSelect.querySelectorAll(".image-formats option");
  const audioFormats = formatSelect.querySelectorAll(".audio-formats option");

  // Reset all options
  imageFormats.forEach((opt) => (opt.disabled = false));
  audioFormats.forEach((opt) => (opt.disabled = false));

  if (state.files.length === 0) {
    state.selectedFormat = null;
    formatSelect.value = "";
    return;
  }

  // Check what file types are present
  let hasImages = state.files.some(isImage);
  let hasAudio = state.files.some(isAudio);
  let hasVideo = state.files.some(isVideo);

  // Disable incompatible formats
  if (hasImages && !hasAudio && !hasVideo) {
    audioFormats.forEach((opt) => (opt.disabled = true));
  } else if (hasAudio && !hasImages && !hasVideo) {
    imageFormats.forEach((opt) => (opt.disabled = true));
  }
}

/**
 * Show file previews
 */
function showPreviews() {
  const { imagePreview, audioPreview, videoPreview, previewPlaceholder } =
    elements;

  // Reset all previews
  imagePreview.classList.add("hidden");
  audioPreview.classList.add("hidden");
  videoPreview.classList.add("hidden");

  if (state.files.length === 0) {
    previewPlaceholder.classList.remove("hidden");
    return;
  }

  previewPlaceholder.classList.add("hidden");

  // Show first valid file preview
  for (const file of state.files) {
    if (isImage(file)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
      break;
    } else if (isAudio(file)) {
      const url = URL.createObjectURL(file);
      audioPreview.src = url;
      audioPreview.classList.remove("hidden");
      break;
    } else if (isVideo(file)) {
      const url = URL.createObjectURL(file);
      videoPreview.src = url;
      videoPreview.classList.remove("hidden");
      break;
    }
  }
}

/**
 * Update convert button state
 */
function updateConvertButton() {
  const canConvert = state.files.length > 0 && elements.formatSelect.value;
  elements.convertBtn.disabled = !canConvert;
}

// ========================================
// Format Selection
// ========================================

/**
 * Handle format selection change
 */
function handleFormatChange() {
  elements.formatSelect.addEventListener("change", (e) => {
    state.selectedFormat = e.target.value;

    // Show/hide compression settings based on format
    if (elements.compressionSettings) {
      if (state.selectedFormat) {
        elements.compressionSettings.classList.remove("hidden");

        // Show quality slider for images, bitrate for audio
        const imageFormats = ["jpeg", "jpg", "png", "webp", "gif"];
        const audioFormats = ["mp3", "wav", "ogg"];

        if (imageFormats.includes(state.selectedFormat)) {
          elements.imageQualityContainer.classList.remove("hidden");
          elements.audioBitrateContainer.classList.add("hidden");
        } else if (audioFormats.includes(state.selectedFormat)) {
          elements.imageQualityContainer.classList.add("hidden");
          elements.audioBitrateContainer.classList.remove("hidden");
        }
      } else {
        elements.compressionSettings.classList.add("hidden");
      }
    }

    updateConvertButton();
  });

  // Quality slider change handler
  if (elements.qualitySlider && elements.qualityValue) {
    elements.qualitySlider.addEventListener("input", (e) => {
      elements.qualityValue.textContent = e.target.value;
    });
  }
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
async function convertImage(file, targetFormat, quality = 80) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const mimeType = getMimeType(targetFormat);
        // Use quality slider value (convert 10-100 to 0.1-1.0)
        const qualityValue = quality / 100;

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob: blob,
                originalSize: file.size,
                convertedSize: blob.size,
              });
              resolve(blob);
            } else {
              reject(new Error("Conversion failed"));
            }
          },
          mimeType,
          quality,
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Main conversion function - Batch processing
 */
async function convertFiles() {
  if (state.files.length === 0 || !state.selectedFormat) {
    return;
  }

  // Reset converted files array for batch
  state.convertedFiles = [];

  const totalFiles = state.files.length;

  // Show loading state with batch info
  elements.convertBtn.disabled = true;
  elements.convertBtn.classList.add("processing");
  elements.convertBtn.innerHTML = `
        <span class="spinner"></span>
        Converting 0/${totalFiles}...
    `;
  showLoadingSpinner(0, totalFiles, "Starting...");

  try {
    // Process files one by one (queue system, not parallel)
    for (let i = 0; i < state.files.length; i++) {
      const file = state.files[i];

      // Update progress: current file name and number processed
      const fileName =
        file.name.length > 20 ? file.name.substring(0, 17) + "..." : file.name;
      elements.convertBtn.innerHTML = `
            <span class="spinner"></span>
            Converting ${i + 1}/${totalFiles}: ${fileName}
        `;
      showLoadingSpinner(i + 1, totalFiles, fileName);

      let convertedResult;

      if (isImage(file)) {
        // Get quality from slider (default 80)
        const quality = elements.qualitySlider
          ? parseInt(elements.qualitySlider.value)
          : 80;
        convertedResult = await convertImage(
          file,
          state.selectedFormat,
          quality,
        );
      } else if (isAudio(file)) {
        // Get bitrate from select (default 128k)
        const bitrate = elements.bitrateSelect
          ? elements.bitrateSelect.value
          : "128000";
        // Use FFmpeg WASM for audio conversion
        convertedResult = await convertAudioWithFFmpeg(
          file,
          state.selectedFormat,
          bitrate,
        );
      } else {
        // Video conversion is not yet supported client-side
        console.warn(`Skipping ${file.name}: Video conversion not supported`);
        continue;
      }

      // Generate output filename
      const originalName = file.name.replace(/\.[^/.]+$/, "");
      const convertedFilename = `${originalName}.${state.selectedFormat}`;

      // Store converted file with size info
      state.convertedFiles.push({
        blob: convertedResult.blob,
        filename: convertedFilename,
        originalSize: convertedResult.originalSize,
        convertedSize: convertedResult.convertedSize,
      });
    }

    // Show result for batch
    if (state.convertedFiles.length > 0) {
      showBatchResults(state.convertedFiles);
    } else {
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
  // File input change
  elements.fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
  });

  // Format selection
  handleFormatChange();

  // Convert button
  elements.convertBtn.addEventListener("click", convertFiles);

  // Download button
  elements.downloadBtn.addEventListener("click", downloadFile);

  // Clear history button
  elements.clearHistoryBtn.addEventListener("click", clearHistory);
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
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  if (elements.themeToggle) {
    elements.themeToggle.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";

      if (newTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }

      localStorage.setItem("theme", newTheme);
    });
  }
}

/**
 * Show loading spinner during conversion
 */
function showLoadingSpinner(current, total, filename) {
  if (elements.loadingSpinner) {
    elements.loadingSpinner.classList.remove("hidden");
    if (elements.progressText) {
      elements.progressText.textContent = `Converting ${current}/${total}: ${filename}`;
    }
  }
}

/**
 * Hide loading spinner
 */
function hideLoadingSpinner() {
  if (elements.loadingSpinner) {
    elements.loadingSpinner.classList.add("hidden");
  }
}

// Start the application when DOM is ready
document.addEventListener("DOMContentLoaded", init);
