import { elements } from '../state.js';

function applyTheme(theme) {
  if (theme && theme !== 'light') {
    document.documentElement.setAttribute('data-theme', theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('theme', theme || 'light');
}

export function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  applyTheme(saved);

  if (!elements.themeToggle) return;

  const clicks = [];

  elements.themeToggle.addEventListener('click', () => {
    const now = Date.now();
    clicks.push(now);
    while (clicks.length && now - clicks[0] > 1500) clicks.shift();

    if (clicks.length >= 5) {
      clicks.length = 0;
      applyTheme('grey');
      elements.themeToggle.classList.add('secret-pulse');
      setTimeout(() => elements.themeToggle.classList.remove('secret-pulse'), 600);
      return;
    }

    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    if (cur === 'grey') {
      applyTheme('light');
    } else {
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    }
  });
}
