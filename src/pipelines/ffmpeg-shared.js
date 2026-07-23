import { ffmpegState, elements } from '../state.js';

export async function loadFFmpeg() {
  if (ffmpegState.loaded) return true;
  if (ffmpegState.loading) {
    while (ffmpegState.loading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return ffmpegState.loaded;
  }

  ffmpegState.loading = true;

  try {
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

    const FFmpegClass = window.FFmpeg.FFmpeg;
    ffmpegState.instance = new FFmpegClass();

    ffmpegState.instance.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    ffmpegState.instance.on('progress', ({ progress }) => {
      console.log(`[FFmpeg] Progress: ${Math.round(progress * 100)}%`);
      if (convertBtn) {
        convertBtn.innerHTML = `<span>Converting ${Math.round(progress * 100)}%</span>`;
      }
    });

    await ffmpegState.instance.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
    });

    ffmpegState.loaded = true;
    return true;
  } catch (error) {
    console.error('[FFmpeg] Failed to load:', error);
    ffmpegState.loaded = false;
    return false;
  } finally {
    ffmpegState.loading = false;
  }
}

export function fetchFile(file) {
  return window.FFmpegUtil.fetchFile(file);
}
