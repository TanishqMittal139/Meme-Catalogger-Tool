const COPY_FALLBACK_TEXTAREA_ID = 'meme-clipboard-fallback';

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const copyTextWithExecCommand = (value) => {
  if (!isBrowser) {
    return false;
  }

  let textarea = document.getElementById(COPY_FALLBACK_TEXTAREA_ID);
  if (!textarea) {
    textarea = document.createElement('textarea');
    textarea.id = COPY_FALLBACK_TEXTAREA_ID;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
  }

  textarea.value = value;
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
};

export const buildMemeImageLink = (memeId) => {
  if (!Number.isFinite(memeId) || !isBrowser) {
    throw new Error('No meme link is available to copy.');
  }

  return `${window.location.origin}/api/memes/${memeId}/image`;
};

export const copyTextToClipboard = async (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('No text is available to copy.');
  }

  const clipboardApi = navigator?.clipboard;

  if (clipboardApi?.writeText) {
    await clipboardApi.writeText(value);
    return { copied: true, manual: false };
  }

  if (copyTextWithExecCommand(value)) {
    return { copied: true, manual: false };
  }

  if (isBrowser) {
    window.prompt('Copy meme link:', value);
    return { copied: false, manual: true };
  }

  throw new Error('Clipboard access is not available in this browser.');
};
