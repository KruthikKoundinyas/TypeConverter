import { state, elements, HISTORY_KEY } from '../state.js';
import { escapeHtml, formatFileSize } from '../utils.js';

export function loadHistory() {
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
    console.warn('Failed to save history:', e);
  }
}

export function addToHistory(entry) {
  state.history.unshift(entry);
  if (state.history.length > 50) state.history = state.history.slice(0, 50);
  saveHistory();
}

export function clearHistory() {
  state.history = [];
  saveHistory();
  renderHistory();
}

export function renderHistory() {
  const historySection = elements.historySection;
  const historyList = elements.historyList;
  if (!historySection || !historyList) return;

  if (state.history.length === 0) {
    historySection.classList.add('hidden');
    return;
  }

  historySection.style.display = 'block';
  historyList.innerHTML = state.history
    .map((item) => `
      <div class="history-item">
        <div class="history-info">
          <span class="history-name">${escapeHtml(item.filename)}</span>
          <span class="history-formats">${escapeHtml(item.inputFormat)} → ${escapeHtml(item.outputFormat)}</span>
        </div>
        <div class="history-sizes">${formatFileSize(item.originalSize)} → ${formatFileSize(item.convertedSize)}</div>
        <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
      </div>
    `)
    .join('');
}
