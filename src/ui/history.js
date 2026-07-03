import { state, elements, HISTORY_KEY } from '../state.js';
import { escapeHtml, formatFileSize } from '../utils.js';

export function loadHistory() {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    state.history = Array.isArray(parsed) ? parsed.filter(validEntry) : [];
  } catch (e) {
    state.history = [];
  }
}

function validEntry(item) {
  return item && typeof item === 'object' && typeof item.filename === 'string';
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
  renderHistory();
}

export function clearHistory() {
  state.history = [];
  try { localStorage.removeItem(HISTORY_KEY); } catch (e) {}
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

  historySection.classList.remove('hidden');
  historyList.innerHTML = state.history
    .map((item) => {
      const time = item.timestamp ? new Date(item.timestamp).toLocaleString() : '';
      return `
      <div class="history-item">
        <div class="history-info">
          <span class="history-name">${escapeHtml(item.filename || '')}</span>
          <span class="history-formats">${escapeHtml(item.inputFormat || '?')} → ${escapeHtml(item.outputFormat || '?')}</span>
        </div>
        <div class="history-sizes">${formatFileSize(item.originalSize)} → ${formatFileSize(item.convertedSize)}</div>
        ${time ? `<div class="history-time">${time}</div>` : ''}
      </div>
    `;
    })
    .join('');
}
