import { elements } from '../state.js';

export function showLoadingSpinner(current, total, filename) {
  if (!elements.loadingSpinner) return;
  elements.loadingSpinner.classList.remove('hidden');
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  if (elements.progressText) {
    elements.progressText.textContent = `${current}/${total}: ${filename}`;
  }
  if (elements.progressBar) {
    elements.progressBar.style.width = pct + '%';
  }
  if (elements.progressPct) {
    elements.progressPct.textContent = pct + '%';
  }
}

export function hideLoadingSpinner() {
  if (!elements.loadingSpinner) return;
  elements.loadingSpinner.classList.add('hidden');
  if (elements.progressBar) elements.progressBar.style.width = '0%';
}
